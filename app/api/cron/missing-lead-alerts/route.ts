/**
 * Missing-lead alert cron.
 *
 * Runs the CallRail / Spark reconciliation over the last few days, finds
 * CallRail submissions with no Spark match that have not been alerted on
 * before, emails them in one digest, and records each in the `lead_alerts`
 * table so it is never alerted twice. Previously alerted emails that now
 * match a Spark contact are marked resolved.
 *
 * Scheduled by `.github/workflows/missing-lead-alerts.yml` (hourly). Vercel
 * Hobby crons are once a day, so GitHub Actions does the scheduling and hits
 * this route with `Authorization: Bearer $CRON_SECRET`.
 *
 * Manual use (signed-in admin):
 *   GET /api/cron/missing-lead-alerts?dryRun=1   -> no email, no writes, returns preview
 *   GET /api/cron/missing-lead-alerts            -> real run
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { callrailConfigured, runReconciliation, type ReconContact } from '@/lib/reconciliation';
import { alertHtml, alertSubject, sendAlertEmail } from '@/lib/lead-alert-email';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// CallRail window. Wide enough to absorb Spark's list-index lag and a few
// failed cron ticks; the ledger keeps re-seen leads from re-alerting.
const LOOKBACK_DAYS = Number(process.env.LEAD_ALERT_LOOKBACK_DAYS || 3);

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

export async function GET(request: NextRequest) {
  const who = await authorized(request);
  if (!who) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!callrailConfigured()) {
    return NextResponse.json({ error: 'CALLRAIL_API_TOKEN is not configured.' }, { status: 500 });
  }

  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1';
  const recipients = (process.env.LEAD_ALERT_TO || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (!dryRun && recipients.length === 0) {
    return NextResponse.json({ error: 'LEAD_ALERT_TO is not configured (comma-separated emails).' }, { status: 500 });
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
      ? await db.from('lead_alerts').select('email, name, resolved_at').in('email', emails)
      : { data: [] as any[], error: null };
    if (readErr) throw new Error(`lead_alerts read failed: ${readErr.message}`);

    const knownByEmail = new Map((known || []).map((r: any) => [r.email, r]));
    const newMissing: ReconContact[] = missing.filter(c => !knownByEmail.has(c.email));
    const resolved = matched
      .filter(c => knownByEmail.has(c.email) && !knownByEmail.get(c.email)!.resolved_at)
      .map(c => ({ email: c.email, name: c.name || null, sparkContactId: c.sparkContactId }));

    const subject = alertSubject(newMissing.length, windowLabel);
    const html = newMissing.length
      ? alertHtml({ newMissing, resolved, windowLabel, dashboardUrl })
      : '';

    let emailId: string | null = null;
    if (!dryRun) {
      // Mark resolutions regardless of whether there is anything new to send.
      for (const r of resolved) {
        await db
          .from('lead_alerts')
          .update({ resolved_at: new Date().toISOString(), spark_contact_id: r.sparkContactId })
          .eq('email', r.email);
      }

      if (newMissing.length) {
        // Send first, record second: a failed send must not consume the alert.
        emailId = (await sendAlertEmail({ to: recipients, subject, html })).id;

        const rows = newMissing.map(c => ({
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
        }));
        const { error: insErr } = await db.from('lead_alerts').upsert(rows, { onConflict: 'email' });
        if (insErr) throw new Error(`lead_alerts write failed after email ${emailId}: ${insErr.message}`);
      }
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      triggeredBy: who,
      window: { start, lookbackDays: LOOKBACK_DAYS },
      scanned: result.summary.total,
      missingInWindow: missing.length,
      newAlerts: newMissing.map(c => ({ email: c.email, name: c.name, captureGaps: c.captureGaps })),
      resolved: resolved.map(r => r.email),
      emailed: emailId ? { id: emailId, to: recipients, subject } : null,
      ...(dryRun ? { previewSubject: subject, previewHtml: html } : {}),
    });
  } catch (error: any) {
    console.error('missing-lead-alerts error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
