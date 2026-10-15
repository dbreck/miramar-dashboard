/**
 * Automated push of a missing CallRail lead into Spark via the v2 API.
 *
 * Used by the missing-lead cron (`/api/cron/missing-lead-alerts`) when
 * AUTO_PUSH_ENABLED=true. The cron has no browser, so it cannot mint the
 * reCAPTCHA token Spark's registration form requires; the API path is the only
 * option and deliberately skips round-robin and the auto-reply. Contacts land
 * held for review: assigned to Heather, rating "New", source "Reconciliation
 * Import", with a note explaining the incomplete capture.
 * Decisions + spike: docs/plans/2026-10-15-auto-push-missing-leads.md.
 */

import { SparkAPIClient } from '@/lib/spark-client';
import { splitName, UTM_FIELD_IDS, type ReconContact } from '@/lib/reconciliation';

/** Reconciliation Import (registration source 18468, project 2855). */
export const AUTO_PUSH_SOURCE_ID = 18468;
/** "New" rating (58245). Heather (2026-10-15): the sales team reads New as "not yet reached out". */
export const AUTO_PUSH_RATING_ID = 58245;
/** Heather Van Workum (7926). Override with AUTO_PUSH_TEAM_MEMBER_IDS="7926,7924". */
const DEFAULT_TEAM_MEMBER_IDS = [7926];

/** Kill switch. Off unless AUTO_PUSH_ENABLED=true is set on Vercel. */
export function autoPushEnabled(): boolean {
  return process.env.AUTO_PUSH_ENABLED === 'true';
}

export function autoPushTeamMemberIds(): number[] {
  const ids = (process.env.AUTO_PUSH_TEAM_MEMBER_IDS || '')
    .split(',')
    .map(s => Number(s.trim()))
    .filter(n => Number.isInteger(n) && n > 0);
  return ids.length ? ids : DEFAULT_TEAM_MEMBER_IDS;
}

// Map CallRail source names to Spark marketing_source values
export function mapMarketingSource(callrailSource: string): string {
  const s = callrailSource.toLowerCase();
  if (s.includes('facebook')) return 'Facebook';
  if (s.includes('instagram')) return 'Instagram';
  if (s.includes('google ads')) return 'Google';
  if (s.includes('google organic')) return 'Google';
  if (s.includes('duckduck')) return 'DuckDuckGo';
  if (s.includes('miramarsarasota')) return 'Website';
  return '';
}

const EMPTY_UTM = new Set(['', '(direct)', '(none)', '(not set)', 'null']);

function captureStamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    }) + ' ET';
  } catch {
    return iso;
  }
}

/** Spark stores `comments` as a contact note ("Registered with comment: ..."). */
export function autoPushNote(c: ReconContact): string {
  const gaps = c.captureGaps.length
    ? `form incomplete: ${c.captureGaps.join(', ')}`
    : 'form looked complete but never reached Spark';
  const lines = [
    `[Auto-import from CallRail capture ${captureStamp(c.submittedAt)}, ${gaps}. Not submitted through the website form; review before contacting.]`,
  ];
  if (c.formUrl) lines.push(`Page: ${c.formUrl}`);
  if (c.callrailHowHeard) lines.push(`Heard via: ${c.callrailHowHeard}`);
  if (c.callrailIsAgent) lines.push(`Marked as broker${c.callrailBrokerage ? ` (${c.callrailBrokerage})` : ''}`);
  if (c.callrailComments) lines.push(`Comments: ${c.callrailComments}`);
  return lines.join('\n');
}

export function buildAutoPushPayload(c: ReconContact): Record<string, any> {
  const { first, last } = splitName(c.name || '');
  const customFields = [
    [UTM_FIELD_IDS.utm_source, c.callrailUtmSource],
    [UTM_FIELD_IDS.utm_medium, c.callrailUtmMedium],
    [UTM_FIELD_IDS.utm_campaign, c.callrailUtmCampaign],
  ]
    .filter(([, v]) => !EMPTY_UTM.has(String(v ?? '').trim().toLowerCase()))
    .map(([id, v]) => ({ custom_field_id: id, value: v }));

  const body: Record<string, any> = {
    email: c.email,
    first_name: first,
    last_name: last,
    registration_source_id: AUTO_PUSH_SOURCE_ID,
    rating_id: AUTO_PUSH_RATING_ID,
    team_member_ids: autoPushTeamMemberIds(),
    agent: c.callrailIsAgent,
    comments: autoPushNote(c),
  };
  if (c.phone) body.phone = c.phone;
  if (c.callrailZip) body.postcode = c.callrailZip;
  const ms = mapMarketingSource(c.callrailSource);
  if (ms) body.marketing_source = ms;
  if (customFields.length) body.custom_field_values = customFields;
  return body;
}

export type AutoPushResult =
  | { status: 'pushed'; sparkContactId: number }
  | { status: 'skipped'; sparkContactId: number }
  | { status: 'push_failed'; error: string };

/**
 * Push one contact. Spark's create endpoint upserts on email and would
 * overwrite an existing contact's rating and team, so look the email up first
 * and skip if it is already there (the reconciliation scan can be stale by the
 * time we get here, and Spark's list index lags writes by 15 to 30 minutes).
 */
export async function autoPushContact(client: SparkAPIClient, c: ReconContact): Promise<AutoPushResult> {
  try {
    const existing = await client.listContacts({ email_eq: c.email, per_page: 5 });
    const list = Array.isArray(existing) ? existing : existing?.data || [];
    if (list.length) return { status: 'skipped', sparkContactId: list[0].id };

    const created = await client.createContact(buildAutoPushPayload(c));
    if (!created?.id) return { status: 'push_failed', error: `Spark returned no id: ${JSON.stringify(created).slice(0, 200)}` };
    return { status: 'pushed', sparkContactId: created.id };
  } catch (err: any) {
    return { status: 'push_failed', error: String(err?.message || err).slice(0, 500) };
  }
}
