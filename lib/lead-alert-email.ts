/**
 * Missing-lead alert email: subject + HTML body, and the Resend send call.
 *
 * Plain HTML tables so it reads in Gmail / Outlook / iOS Mail. No em dashes
 * (outbound client-facing copy).
 */

import type { ReconContact } from '@/lib/reconciliation';

const SPARK_SEARCH = 'https://app.spark.re/projects/2855/contacts?&direction=&display=&order=&q=';

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    }) + ' ET';
  } catch {
    return iso;
  }
}

function pageLabel(c: ReconContact): string {
  const url = (c.formUrl || '').toLowerCase();
  if (url.includes('/reserve')) return 'Reserve (PPC landing)';
  if (url.includes('broker')) return 'Broker Toolkit';
  try {
    const path = new URL(c.formUrl).pathname.replace(/\/$/, '');
    return path ? path : 'Home';
  } catch {
    return c.formType || 'Unknown';
  }
}

export interface DigestSections {
  /** Created in Spark by the cron, held for review. */
  added: { contact: ReconContact; sparkContactId: number | null }[];
  /** Spark rejected the create; listed so someone pushes them by hand. */
  failed: { contact: ReconContact; error: string; attempts: number; willRetry: boolean }[];
  /** Alert-only mode (AUTO_PUSH_ENABLED off): missing, nothing written to Spark. */
  missing: ReconContact[];
  /** Previously alerted leads that now match a Spark contact. */
  resolved: { email: string; name: string | null }[];
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function digestSubject(d: DigestSections, window: string): string {
  const parts: string[] = [];
  if (d.added.length) parts.push(`${plural(d.added.length, 'incomplete-form lead', 'incomplete-form leads')} added to Spark for review`);
  if (d.failed.length) parts.push(`${plural(d.failed.length, 'lead', 'leads')} could not be added`);
  if (d.missing.length) parts.push(plural(d.missing.length, 'new missing lead', 'new missing leads'));
  return `Mira Mar: ${parts.join(', ') || 'no new leads'} (${window})`;
}

/** True when the digest has anything worth sending (resolutions alone are not). */
export function digestHasNews(d: DigestSections): boolean {
  return d.added.length + d.failed.length + d.missing.length > 0;
}

function contactRow(c: ReconContact, action: string): string {
  const gaps = c.captureGaps.length
    ? `<span style="color:#b45309">${esc(c.captureGaps.join(', '))}</span>`
    : '<span style="color:#15803d">None. Form looked complete.</span>';
  const flags: string[] = [];
  if (c.callrailIsAgent) flags.push('Marked as broker' + (c.callrailBrokerage ? ` (${esc(c.callrailBrokerage)})` : ''));
  for (const w of c.warnings) flags.push(esc(w));
  if (c.submissionCount > 1) flags.push(`${c.submissionCount} attempts`);
  return `
      <tr>
        <td style="padding:10px 12px;border-top:1px solid #e5e7eb;vertical-align:top">
          <strong>${esc(c.name || '(no name)')}</strong><br>
          <a href="mailto:${esc(c.email)}" style="color:#2563eb">${esc(c.email)}</a><br>
          ${esc(c.phone || '')}${c.callrailZip ? ` &middot; ZIP ${esc(c.callrailZip)}` : ''}
        </td>
        <td style="padding:10px 12px;border-top:1px solid #e5e7eb;vertical-align:top">
          ${fmtWhen(c.submittedAt)}<br>
          <span style="color:#6b7280">${esc(pageLabel(c))}</span><br>
          <span style="color:#6b7280">${esc(c.callrailSource)}${c.callrailUtmCampaign ? ` / ${esc(c.callrailUtmCampaign)}` : ''}</span>
        </td>
        <td style="padding:10px 12px;border-top:1px solid #e5e7eb;vertical-align:top">
          ${gaps}
          ${c.callrailHowHeard ? `<br><span style="color:#6b7280">Heard via: ${esc(c.callrailHowHeard)}</span>` : ''}
          ${c.callrailComments ? `<br><span style="color:#6b7280">&ldquo;${esc(c.callrailComments.slice(0, 160))}${c.callrailComments.length > 160 ? '&hellip;' : ''}&rdquo;</span>` : ''}
          ${flags.length ? `<br><span style="color:#b45309">${flags.join('; ')}</span>` : ''}
        </td>
        <td style="padding:10px 12px;border-top:1px solid #e5e7eb;vertical-align:top;white-space:nowrap">
          ${action}
        </td>
      </tr>`;
}

function table(rows: string): string {
  return `
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="text-align:left;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.04em">
          <th style="padding:0 12px 8px">Contact</th>
          <th style="padding:0 12px 8px">When / page / source</th>
          <th style="padding:0 12px 8px">Required fields missing from capture</th>
          <th style="padding:0 12px 8px"></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function sparkLink(email: string, label: string): string {
  return `<a href="${esc(SPARK_SEARCH + encodeURIComponent(email))}" style="color:#2563eb">${label}</a>`;
}

export function alertHtml(opts: DigestSections & { windowLabel: string; dashboardUrl: string }): string {
  const { added, failed, missing, resolved, windowLabel, dashboardUrl } = opts;
  const blocks: string[] = [];

  if (added.length) {
    blocks.push(`
    <h2 style="margin:0 0 4px;font-size:18px">${plural(added.length, 'lead', 'leads')} added to Spark for review</h2>
    <p style="margin:0 0 16px;color:#6b7280">These visitors started an inquiry form but it never reached Spark, so the dashboard added them automatically.
      Each is assigned to Heather with source <strong>Reconciliation Import</strong> and rating <strong>Lead</strong>, and has a note saying it came from an incomplete form.
      No auto-reply was sent and no round-robin assignment happened. Please review before anyone reaches out.</p>
    ${table(added.map(a => contactRow(a.contact, sparkLink(a.contact.email, 'Open in Spark'))).join(''))}`);
  }

  if (failed.length) {
    blocks.push(`
    <h2 style="margin:${blocks.length ? '28px' : '0'} 0 4px;font-size:18px;color:#b91c1c">${plural(failed.length, 'lead', 'leads')} could not be added to Spark</h2>
    <p style="margin:0 0 16px;color:#6b7280">Spark rejected the automatic add. Push these from the Reconcile page, or add them in Spark by hand.</p>
    ${table(failed.map(f => contactRow(
      f.contact,
      `${sparkLink(f.contact.email, 'Search Spark')}<br><span style="color:#b91c1c;white-space:normal;font-size:12px">${esc(f.error.slice(0, 200))}</span>` +
      `<br><span style="color:#6b7280;font-size:12px">${f.willRetry ? `Attempt ${f.attempts}, will retry next hour` : `Gave up after ${f.attempts} attempts`}</span>`,
    )).join(''))}`);
  }

  if (missing.length) {
    blocks.push(`
    <h2 style="margin:${blocks.length ? '28px' : '0'} 0 4px;font-size:18px">${plural(missing.length, 'new missing lead', 'new missing leads')}</h2>
    <p style="margin:0 0 16px;color:#6b7280">CallRail captured a form submission that has no matching contact in Spark (checked by email, phone and name).</p>
    ${table(missing.map(c => contactRow(c, sparkLink(c.email, 'Search Spark'))).join(''))}`);
  }

  const resolvedBlock = resolved.length
    ? `<p style="margin:24px 0 8px;color:#374151"><strong>${resolved.length} previously alerted ${resolved.length === 1 ? 'lead is' : 'leads are'} now in Spark:</strong>
       ${resolved.map(r => esc(r.name || r.email)).join(', ')}.</p>`
    : '';

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f9fafb;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111827;font-size:14px;line-height:1.45">
  <div style="max-width:860px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:24px">
    ${blocks.join('\n')}

    <p style="margin:20px 0 0;color:#6b7280;font-size:12px">
      <strong>How to read "missing from capture":</strong> CallRail records the button press before the browser validates the form and leaves out empty fields.
      When a required answer is listed here, the browser most likely blocked the submit and Spark never received it. "None" means the form looked complete and the submission needs a closer look.
    </p>
    ${resolvedBlock}

    <p style="margin:24px 0 0">
      <a href="${esc(dashboardUrl)}/reconciliation" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px">Open Reconcile</a>
    </p>
    <p style="margin:16px 0 0;color:#9ca3af;font-size:12px">Sent by the Mira Mar dashboard. Window checked: ${esc(windowLabel)}. Each lead is reported once; when it later appears in Spark by other means it is listed as resolved.</p>
  </div>
</body></html>`;
}

export async function sendAlertEmail(opts: { to: string[]; subject: string; html: string }): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LEAD_ALERT_FROM || 'Mira Mar Dashboard <alerts@clearph.com>';
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured.');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${body?.message || JSON.stringify(body)}`);
  }
  return { id: body.id };
}
