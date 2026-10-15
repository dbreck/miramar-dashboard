/**
 * Missing-lead alert cron, with optional auto-push into Spark.
 *
 * Runs the CallRail / Spark reconciliation over the last few days and finds
 * CallRail submissions with no Spark match. Then:
 *
 *   AUTO_PUSH_ENABLED=true  -> creates each one in Spark via the API, held for
 *                              review (assigned to Heather, rating Lead, source
 *                              Reconciliation Import, explanatory note). See
 *                              lib/spark-push.ts and
 *                              docs/plans/2026-10-15-auto-push-missing-leads.md.
 *   otherwise               -> records it as a missing-lead alert (original behaviour).
 *
 * Every outcome is written to the `lead_alerts` ledger first with
 * `digest_sent_at = null`; the digest then goes to every `alert_recipients`
 * address and marks those rows sent. A failed email is therefore retried on
 * the next tick without pushing anything to Spark twice. Previously alerted
 * emails that now match a Spark contact are marked resolved.
 *
 * Scheduled by `.github/workflows/missing-lead-alerts.yml` (hourly). Vercel
 * Hobby crons are once a day, so GitHub Actions does the scheduling and hits
 * this route with `Authorization: Bearer $CRON_SECRET`.
 *
 * Manual use (signed-in admin):
 *   GET /api/cron/missing-lead-alerts?dryRun=1             -> no Spark writes, no email, no ledger writes; returns preview
 *   GET /api/cron/missing-lead-alerts?dryRun=1&autoPush=1  -> same, previewing auto-push even while it is switched off
 *   GET /api/cron/missing-lead-alerts                      -> real run
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { callrailConfigured, isTestEmail, runReconciliation, type ReconContact } from '@/lib/reconciliation';
import { alertHtml, digestHasNews, digestSubject, sendAlertEmail, type DigestSections } from '@/lib/lead-alert-email';
import { getAlertRecipients } from '@/lib/alert-recipients';
import { SparkAPIClient } from '@/lib/spark-client';
import { autoPushContact, autoPushEnabled, buildAutoPushPayload, type AutoPushResult } from '@/lib/spark-push';
import { logPush } from '@/lib/push-logger';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// CallRail window. Wide enough to absorb Spark's list-index lag and a few
// failed cron ticks; the ledger keeps re-seen leads from re-alerting.
const LOOKBACK_DAYS = Number(process.env.LEAD_ALERT_LOOKBACK_DAYS || 3);
// Wait this long after the CallRail capture before pushing, so a visitor who
// fixes the form and resubmits is matched instead of duplicated, and Spark's
// 15 to 30 minute list-index lag has cleared.
const GRACE_MINUTES = Number(process.env.AUTO_PUSH_GRACE_MINUTES || 120);
// More than this per hour means CallRail or the matcher has gone wrong, not
// that a crowd abandoned forms. Also keeps the run inside maxDuration.
const PUSH_CAP = Number(process.env.AUTO_PUSH_MAX_PER_RUN || 10);
const MAX_PUSH_ATTEMPTS = 3;
const PUSH_GAP_MS = 500;

interface LedgerRow {
  email: string;
  name: string | null;
  status: 'alerted' | 'pushed' | 'push_failed' | 'skipped';
  push_attempts: number;
  resolved_at: string | null;
  digest_sent_at: string | null;
  payload: ReconContact | null;
  spark_contact_id: number | null;
  push_error: string | null;
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

async function authorized(request: NextRequest): Promise<'cron' | 'admin' | null> {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('authorization') || '';
  if (secret && header === `Bearer ${secret}`) return 'cron';
  if (await requireAdmin()) return 'admin';
  return null;
}

function baseRow(c: ReconContact) {
  return {
    email: c.email,
    name: c.name || null,
    phone: c.phone || null,
    source: c.callrailSource,
    form_type: c.formType,
    form_url: c.formUrl || null,
    submitted_at: c.submittedAt,
    capture_gaps: c.captureGaps,
    likely_cause: c.likelyCause || null,
    payload: c,
  };
}

export async function GET(request: NextRequest) {
  const who = await authorized(request);
  if (!who) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!callrailConfigured()) {
    return NextResponse.json({ error: 'CALLRAIL_API_TOKEN is not configured.' }, { status: 500 });
  }

  const params = new URL(request.url).searchParams;
  const dryRun = params.get('dryRun') === '1';
  const autoPush = autoPushEnabled() || (dryRun && params.get('autoPush') === '1');

  const { to: recipients, source: recipientSource } = await getAlertRecipients();
  if (!dryRun && recipients.length === 0) {
    // Fail before touching Spark: nothing gets pushed without someone being told.
    return NextResponse.json(
      { error: 'No alert recipients. Add one on /admin or set LEAD_ALERT_TO.' },
      { status: 500 },
    );
  }

  const dashboardUrl = (process.env.DASHBOARD_URL || new URL(request.url).origin).replace(/\/$/, '');
  const start = isoDate(new Date(Date.now() - LOOKBACK_DAYS * 86_400_000));
  const windowLabel = `${start} to ${isoDate(new Date())}`;

  try {
    const result = await runReconciliation(start);
    const missing = result.contacts.filter(c => !c.inSpark);
    const matched = result.contacts.filter(c => c.inSpark);

    const db = createAdminClient();
    const emails = result.contacts.map(c => c.email);
    const { data: known, error: readErr } = emails.length
      ? await db
          .from('lead_alerts')
          .select('email, name, status, push_attempts, resolved_at, digest_sent_at')
          .in('email', emails)
      : { data: [] as any[], error: null };
    if (readErr) throw new Error(`lead_alerts read failed: ${readErr.message}`);

    const knownByEmail = new Map<string, LedgerRow>((known || []).map((r: any) => [r.email, r]));
    const resolved = matched
      .filter(c => knownByEmail.has(c.email) && !knownByEmail.get(c.email)!.resolved_at)
      .map(c => ({ email: c.email, name: c.name || null, sparkContactId: c.sparkContactId }));

    // --- Decide this tick's work ---------------------------------------------
    let toPush: ReconContact[] = [];
    let inGrace = 0;
    let heldByCap = 0;
    let newAlerts: ReconContact[] = [];

    if (autoPush) {
      const cutoff = Date.now() - GRACE_MINUTES * 60_000;
      const eligible = missing.filter(c => {
        if (isTestEmail(c.email)) return false;
        const row = knownByEmail.get(c.email);
        if (!row) return true;
        if (row.resolved_at) return false;
        if (row.status === 'alerted') return true; // emailed before auto-push existed; still missing
        return row.status === 'push_failed' && row.push_attempts < MAX_PUSH_ATTEMPTS;
      });
      const ready = eligible.filter(c => {
        const ok = new Date(c.submittedAt).getTime() <= cutoff;
        if (!ok) inGrace++;
        return ok;
      });
      toPush = ready.slice(0, PUSH_CAP);
      heldByCap = ready.length - toPush.length;
    } else {
      newAlerts = missing.filter(c => !knownByEmail.has(c.email));
    }

    if (dryRun) {
      const preview: DigestSections = {
        added: toPush.map(c => ({ contact: c, sparkContactId: null })),
        failed: [],
        missing: newAlerts,
        resolved,
      };
      return NextResponse.json({
        ok: true,
        dryRun: true,
        autoPush,
        autoPushEnabled: autoPushEnabled(),
        triggeredBy: who,
        window: { start, lookbackDays: LOOKBACK_DAYS },
        scanned: result.summary.total,
        missingInWindow: missing.length,
        wouldPush: toPush.map(c => ({ email: c.email, name: c.name, payload: buildAutoPushPayload(c) })),
        inGrace,
        heldByCap,
        newAlerts: newAlerts.map(c => ({ email: c.email, name: c.name, captureGaps: c.captureGaps })),
        resolved: resolved.map(r => r.email),
        recipients: { to: recipients, source: recipientSource },
        previewSubject: digestSubject(preview, windowLabel),
        previewHtml: digestHasNews(preview) ? alertHtml({ ...preview, windowLabel, dashboardUrl }) : '',
      });
    }

    // --- Writes --------------------------------------------------------------
    const nowIso = () => new Date().toISOString();

    for (const r of resolved) {
      await db
        .from('lead_alerts')
        .update({ resolved_at: nowIso(), spark_contact_id: r.sparkContactId })
        .eq('email', r.email);
    }

    const pushOutcomes: { contact: ReconContact; result: AutoPushResult }[] = [];
    if (toPush.length) {
      const client = new SparkAPIClient(process.env.SPARK_API_KEY!);
      for (const [i, c] of toPush.entries()) {
        if (i) await new Promise(r => setTimeout(r, PUSH_GAP_MS));
        const res = await autoPushContact(client, c);
        pushOutcomes.push({ contact: c, result: res });

        const prev = knownByEmail.get(c.email);
        const attempts = (prev?.push_attempts || 0) + (res.status === 'skipped' ? 0 : 1);
        let row: Record<string, any>;
        if (res.status === 'pushed') {
          const at = nowIso();
          row = { ...baseRow(c), status: 'pushed', pushed_at: at, resolved_at: at, spark_contact_id: res.sparkContactId, push_error: null, push_attempts: attempts, digest_sent_at: null };
        } else if (res.status === 'skipped') {
          // Already in Spark (the scan was stale). Nothing written; report as resolved.
          row = { ...baseRow(c), status: 'skipped', resolved_at: nowIso(), spark_contact_id: res.sparkContactId, digest_sent_at: nowIso() };
          resolved.push({ email: c.email, name: c.name || null, sparkContactId: res.sparkContactId });
        } else {
          row = { ...baseRow(c), status: 'push_failed', push_error: res.error, push_attempts: attempts };
          // Report the first failure; later retries stay quiet unless they succeed.
          if (prev?.status !== 'push_failed') row.digest_sent_at = null;
        }
        const { error: upErr } = await db.from('lead_alerts').upsert(row, { onConflict: 'email' });
        if (upErr) {
          // The Spark write already happened; log loudly so the contact is not orphaned silently.
          console.error(`lead_alerts write failed for ${c.email} after ${res.status}: ${upErr.message}`);
        }
      }

      await logPush({
        action: 'create_contact',
        timestamp: nowIso(),
        actor: 'cron:auto-push',
        contacts: pushOutcomes.map(({ contact, result: res }) => ({
          name: contact.name,
          email: contact.email,
          success: res.status !== 'push_failed',
          sparkContactId: res.status === 'push_failed' ? undefined : res.sparkContactId,
          error: res.status === 'push_failed' ? res.error : res.status === 'skipped' ? 'skipped: already in Spark' : undefined,
          callrailSource: contact.callrailSource,
        })),
        summary: {
          total: pushOutcomes.length,
          succeeded: pushOutcomes.filter(o => o.result.status !== 'push_failed').length,
          failed: pushOutcomes.filter(o => o.result.status === 'push_failed').length,
        },
      });
    }

    if (newAlerts.length) {
      const { error: insErr } = await db
        .from('lead_alerts')
        .upsert(newAlerts.map(c => ({ ...baseRow(c), status: 'alerted' })), { onConflict: 'email' });
      if (insErr) throw new Error(`lead_alerts write failed: ${insErr.message}`);
    }

    // --- Digest: everything still owed one, including rows from failed sends --
    const { data: pending, error: pendErr } = await db
      .from('lead_alerts')
      .select('email, name, status, push_attempts, resolved_at, digest_sent_at, payload, spark_contact_id, push_error')
      .is('digest_sent_at', null)
      .order('first_alerted_at', { ascending: true });
    if (pendErr) throw new Error(`lead_alerts pending read failed: ${pendErr.message}`);

    const owed = ((pending || []) as LedgerRow[]).filter(r => r.payload);
    const digest: DigestSections = {
      added: owed.filter(r => r.status === 'pushed').map(r => ({ contact: r.payload!, sparkContactId: r.spark_contact_id })),
      failed: owed.filter(r => r.status === 'push_failed').map(r => ({
        contact: r.payload!,
        error: r.push_error || 'Unknown error',
        attempts: r.push_attempts,
        willRetry: autoPush && r.push_attempts < MAX_PUSH_ATTEMPTS,
      })),
      missing: owed.filter(r => r.status === 'alerted').map(r => r.payload!),
      resolved: resolved.map(r => ({ email: r.email, name: r.name })),
    };

    const subject = digestSubject(digest, windowLabel);
    let emailId: string | null = null;
    if (digestHasNews(digest)) {
      emailId = (await sendAlertEmail({ to: recipients, subject, html: alertHtml({ ...digest, windowLabel, dashboardUrl }) })).id;
      const { error: markErr } = await db
        .from('lead_alerts')
        .update({ digest_sent_at: nowIso() })
        .in('email', owed.map(r => r.email));
      if (markErr) throw new Error(`lead_alerts digest mark failed after email ${emailId}: ${markErr.message}`);
    }

    return NextResponse.json({
      ok: true,
      dryRun: false,
      autoPush,
      triggeredBy: who,
      window: { start, lookbackDays: LOOKBACK_DAYS },
      scanned: result.summary.total,
      missingInWindow: missing.length,
      pushed: pushOutcomes.map(o => ({ email: o.contact.email, ...o.result })),
      inGrace,
      heldByCap,
      newAlerts: newAlerts.map(c => ({ email: c.email, name: c.name, captureGaps: c.captureGaps })),
      resolved: resolved.map(r => r.email),
      recipients: { to: recipients, source: recipientSource },
      emailed: emailId
        ? { id: emailId, to: recipients, subject, added: digest.added.length, failed: digest.failed.length, missing: digest.missing.length }
        : null,
    });
  } catch (error: any) {
    console.error('missing-lead-alerts error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
