/**
 * CallRail / Spark reconciliation core.
 *
 * Shared by the live reconciliation API (`/api/reconciliation/live`) and the
 * missing-lead alert cron (`/api/cron/missing-lead-alerts`). Pure data work:
 * no auth, no HTTP response shaping.
 */

// Token must come from the environment (Vercel + .env.local). No hard-coded fallback.
const CALLRAIL_API_TOKEN = process.env.CALLRAIL_API_TOKEN;
const CALLRAIL_ACCOUNT_ID = process.env.CALLRAIL_ACCOUNT_ID || 'ACC2fd0a83431e1451cba08cdc21d851925';
const CALLRAIL_COMPANY_ID = process.env.CALLRAIL_COMPANY_ID || 'COM01985c132b03722996a8a09a1343b248';
const SPARK_API_KEY = process.env.SPARK_API_KEY!;

export const UTM_FIELD_IDS = {
  utm_source: 22408,
  utm_medium: 22409,
  utm_campaign: 22410,
};

const EMPTY_UTM_VALUES = new Set(['', '(direct)', '(none)', '(not set)', 'null']);
const TEST_EMAIL_PATTERNS = ['@clearph.com', '@dbreck.com', '@example.com', 'testrelay', 'apitest'];

// --- Types ---

export interface ReconContact {
  email: string;
  name: string;
  phone: string;
  callrailSource: string;
  callrailUtmSource: string;
  callrailUtmMedium: string;
  callrailUtmCampaign: string;
  submittedAt: string;
  formType: string;
  submissionCount: number;
  inSpark: boolean;
  sparkContactId: number | null;
  sparkRating: string;
  sparkEmail: string;
  sparkUtmSource: string;
  sparkUtmMedium: string;
  sparkUtmCampaign: string;
  hasPaidSource: boolean;
  hasUtmGap: boolean;
  likelyCause: string;
  /** Required answers absent from the CallRail capture (empty = complete form). */
  captureGaps: string[];
  formUrl: string;
  matchMethod: 'email' | 'phone' | 'name' | 'none';
  warnings: string[];
  callrailZip: string;
  callrailHowHeard: string;
  callrailComments: string;
  callrailIsAgent: boolean;
  callrailBrokerage: string;
}

export interface SourceStats {
  source: string;
  total: number;
  inSpark: number;
  missing: number;
  dropRate: number;
}

// --- API Helpers ---

async function callrailFetch(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`https://api.callrail.com/v3/a/${CALLRAIL_ACCOUNT_ID}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Token token=${CALLRAIL_API_TOKEN}`, Accept: 'application/json' },
  });

  if (!res.ok) throw new Error(`CallRail API error: ${res.status}`);
  return res.json();
}

async function sparkFetch(path: string): Promise<any> {
  const res = await fetch(`https://api.spark.re/v2${path}`, {
    headers: {
      Authorization: `Token token=${SPARK_API_KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Spark API error: ${res.status}`);
  }
  return res.json();
}

// --- Data Fetching ---

async function fetchCallRailSubmissions(startDate?: string, endDate?: string): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const params: Record<string, string> = {
      company_id: CALLRAIL_COMPANY_ID,
      per_page: '250',
      page: String(page),
      fields: 'form_data,utm_source,utm_medium,utm_campaign',
      sort_by: 'submitted_at',
      sort_dir: 'desc',
    };

    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const data = await callrailFetch('form_submissions.json', params);
    totalPages = data.total_pages || 1;
    all.push(...(data.form_submissions || []));
    page++;
  }

  return all;
}

// --- Helpers ---

function isTestEmail(email: string): boolean {
  const lower = email.toLowerCase();
  return TEST_EMAIL_PATTERNS.some(p => lower.includes(p));
}

function isPaidSource(source: string): boolean {
  const lower = (source || '').toLowerCase();
  return lower.includes('facebook') || lower.includes('google ads') || lower.includes('instagram') || lower.includes('meta');
}

function hasRealUtm(s: string | null, m: string | null, c: string | null): boolean {
  return (!!s && !EMPTY_UTM_VALUES.has(s)) || (!!m && !EMPTY_UTM_VALUES.has(m)) || (!!c && !EMPTY_UTM_VALUES.has(c));
}

function extractUtmFromUrl(url: string): { utm_source: string; utm_medium: string; utm_campaign: string } {
  try {
    const parsed = new URL(url);
    return {
      utm_source: parsed.searchParams.get('utm_source') || '',
      utm_medium: parsed.searchParams.get('utm_medium') || '',
      utm_campaign: parsed.searchParams.get('utm_campaign') || '',
    };
  } catch {
    return { utm_source: '', utm_medium: '', utm_campaign: '' };
  }
}

// --- Form Data Extraction ---

function extractFormFields(formData: Record<string, any> | undefined): { zip: string; howHeard: string; comments: string; isAgent: boolean; brokerage: string } {
  if (!formData) return { zip: '', howHeard: '', comments: '', isAgent: false, brokerage: '' };

  let zip = '', howHeard = '', comments = '', brokerage = '';
  let isAgent = false;
  for (const [key, val] of Object.entries(formData)) {
    const k = key.toLowerCase();
    const v = String(val || '');
    if (k === 'agent') isAgent = v === 'true';
    else if (k.includes('brokerage') || k.includes('employer')) brokerage = v;
    else if (k.includes('zip') || k.includes('postal') || k.includes('postcode')) zip = v;
    else if (k.includes('hear') || k.includes('how_did') || k.includes('referral_source')) howHeard = v;
    else if (k.includes('comment') || k.includes('question') || k.includes('message') || k.includes('notes')) comments = v;
  }
  return { zip, howHeard, comments, isAgent, brokerage };
}

// --- Email Typo Detection ---

function detectEmailWarnings(email: string): string[] {
  const warnings: string[] = [];
  const lower = email.toLowerCase();

  // Double TLD: gmail.com.com
  if (/\.\w+\.\w+$/.test(lower)) {
    const parts = lower.split('.');
    if (parts.length >= 3 && parts[parts.length - 1] === parts[parts.length - 2]) {
      warnings.push(`Likely email typo: double ".${parts[parts.length - 1]}" → should be "${lower.replace(/\.(\w+)$/, '')}"`);
    }
  }

  // Truncated TLD: .ne → .net, .co → .com, .con → .com, .or → .org
  const tldFixes: Record<string, string> = {
    '.ne': '.net', '.co': '.com', '.con': '.com', '.or': '.org',
    '.gmai.com': '.gmail.com', '.gmal.com': '.gmail.com',
  };
  for (const [bad, good] of Object.entries(tldFixes)) {
    if (lower.endsWith(bad) && !lower.endsWith(good)) {
      warnings.push(`Likely email typo: "${bad}" → probably "${good}"`);
    }
  }

  // Double @
  if ((email.match(/@/g) || []).length > 1) {
    warnings.push('Email has multiple @ symbols');
  }

  return warnings;
}

// Normalize phone for comparison: strip everything except digits, take last 10
function normalizePhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

// Split name into first/last for Spark search
function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/);
  return {
    first: parts[0] || '',
    last: parts.slice(1).join(' ') || '',
  };
}

// --- Smart Spark Matching ---

async function findInSpark(email: string, phone: string, name: string): Promise<{
  contact: any | null;
  matchMethod: 'email' | 'phone' | 'name' | 'none';
  warnings: string[];
}> {
  const warnings: string[] = [];

  // 1. Try exact email match
  try {
    const byEmail = await sparkFetch(`/contacts?email_eq=${encodeURIComponent(email)}&per_page=10`);
    if (Array.isArray(byEmail) && byEmail.length > 0) {
      const full = await sparkFetch(`/contacts/${byEmail[0].id}`);
      return { contact: full, matchMethod: 'email', warnings };
    }
  } catch { /* continue */ }

  // 2. Try phone match
  const normPhone = normalizePhone(phone);
  if (normPhone.length >= 10) {
    try {
      const byPhone = await sparkFetch(`/contacts?phone_cont=${normPhone.slice(-7)}&per_page=10`);
      if (Array.isArray(byPhone) && byPhone.length > 0) {
        // Verify phone match is real (last 10 digits match)
        for (const candidate of byPhone) {
          if (normalizePhone(candidate.phone || '') === normPhone ||
              normalizePhone(candidate.mobile_phone || '') === normPhone) {
            const full = await sparkFetch(`/contacts/${candidate.id}`);
            warnings.push(`Matched by phone number — Spark email: ${candidate.email || '(none)'}`);
            return { contact: full, matchMethod: 'phone', warnings };
          }
        }
      }
    } catch { /* continue */ }
  }

  // 3. Try name match (first + last)
  const { first, last } = splitName(name);
  if (first && last && last.length > 1) {
    try {
      const byName = await sparkFetch(
        `/contacts?first_name_eq=${encodeURIComponent(first)}&last_name_eq=${encodeURIComponent(last)}&per_page=10`
      );
      if (Array.isArray(byName) && byName.length > 0) {
        const full = await sparkFetch(`/contacts/${byName[0].id}`);
        warnings.push(`Matched by name "${first} ${last}" — Spark email: ${byName[0].email || '(none)'}`);
        return { contact: full, matchMethod: 'name', warnings };
      }
    } catch { /* continue */ }
  }

  return { contact: null, matchMethod: 'none', warnings };
}

function determineLikelyCause(sub: any): string {
  const source = (sub.source || '').toLowerCase();
  const referrer = (sub.referrer || '').toLowerCase();
  const landingUrl = (sub.landing_page_url || '').toLowerCase();
  const formUrl = (sub.form_url || '').toLowerCase();
  const email = (sub.customer_email || '').toLowerCase();

  if (source.includes('facebook') || source.includes('instagram') || referrer.includes('m.facebook.com') || referrer.includes('instagram') || landingUrl.includes('fbclid')) {
    return 'Meta in-app browser';
  }
  if (email.endsWith('.ne') || email.endsWith('.co') || email.endsWith('.con') || email.includes('@@')) {
    return 'Email typo';
  }
  if (source.includes('google ads')) return 'Google Ads reCAPTCHA';
  if (formUrl.includes('community-workshop')) return 'Workshop endpoint error';
  return 'Form submission failure';
}

function getFormType(formUrl: string): string {
  if (formUrl.includes('community-workshop')) return 'Workshop';
  if (formUrl.includes('contact') || formUrl.includes('inquire')) return 'Contact';
  if (formUrl.includes('popup')) return 'Popup';
  return 'Other';
}

// --- Main Handler ---

// --- Capture-gap detection ---
//
// CallRail's click capture fires before native browser validation and drops
// empty fields from the payload, so a "missing" lead whose capture lacks a
// required field almost always means the browser refused to send the form
// (see Lead Review 2026-10-13). This flags which required answers are absent
// so an alert reader can triage without opening CallRail.

const GAP_CHECKS: { label: string; test: (keys: string[], formData: Record<string, any>) => boolean }[] = [
  { label: 'How did you hear about us', test: keys => !keys.some(k => k.includes('hear') || k.includes('answers')) },
  { label: 'Broker / Future Resident choice', test: keys => !keys.includes('agent') },
  { label: 'Phone', test: keys => !keys.some(k => k.includes('phone')) },
  { label: 'ZIP', test: keys => !keys.some(k => k.includes('zip') || k.includes('postal') || k.includes('postcode')) },
  { label: 'Email', test: keys => !keys.some(k => k.includes('email')) },
  { label: 'Brokerage', test: keys => !keys.some(k => k.includes('brokerage') || k.includes('employer')) },
];

export function detectCaptureGaps(formData: Record<string, any> | undefined, formUrl: string, source: string): string[] {
  if (!formData) return [];
  const keys = Object.keys(formData).map(k => k.toLowerCase());
  const url = (formUrl || '').toLowerCase();
  const src = (source || '').toLowerCase();

  // Which fields each form actually requires.
  let required: string[];
  if (src.includes('broker toolkit')) {
    required = ['Phone', 'Email', 'Brokerage'];
  } else if (url.includes('/reserve')) {
    // PPC landing page: referral + zip required; phone only on the tour form.
    required = ['How did you hear about us', 'ZIP', 'Email'];
    if (!src.includes('brochure')) required.push('Phone');
  } else {
    // Vanilla Spark forms (Welcome, contact, footer, popup).
    required = ['How did you hear about us', 'Broker / Future Resident choice', 'Phone', 'ZIP', 'Email'];
  }

  return GAP_CHECKS.filter(g => required.includes(g.label) && g.test(keys, formData)).map(g => g.label);
}

// --- Main entry point ---

export interface ReconciliationResult {
  summary: { total: number; inSpark: number; missing: number; utmGaps: number; matchRate: number; dropRate: number };
  sourceStats: SourceStats[];
  contacts: ReconContact[];
  generatedAt: string;
  dateRange: { start: string; end: string };
}

export function callrailConfigured(): boolean {
  return !!CALLRAIL_API_TOKEN;
}

/**
 * Pull CallRail form submissions for the window, dedupe by email, and match
 * each against Spark (email → phone → name). Dates are YYYY-MM-DD strings.
 */
export async function runReconciliation(startDate?: string, endDate?: string): Promise<ReconciliationResult> {
  if (!CALLRAIL_API_TOKEN) {
    throw new Error('CALLRAIL_API_TOKEN is not configured. Set it in Vercel and .env.local.');
  }

  // Step 1: Fetch CallRail submissions
  const submissions = await fetchCallRailSubmissions(startDate, endDate);

  // Step 2: Deduplicate by email (keep earliest)
  const emailMap = new Map<string, { sub: any; count: number }>();
  for (const sub of submissions) {
    const email = (sub.customer_email || '').toLowerCase().trim();
    if (!email || isTestEmail(email)) continue;

    // Filter to miramarsarasota.com submissions only
    const formUrl = (sub.form_url || '').toLowerCase();
    if (!formUrl.includes('miramarsarasota')) continue;

    const existing = emailMap.get(email);
    if (!existing) {
      emailMap.set(email, { sub, count: 1 });
    } else {
      existing.count++;
      if (sub.submitted_at < existing.sub.submitted_at) existing.sub = sub;
    }
  }

  // Step 3: Check each against Spark (batched)
  const contacts = Array.from(emailMap.entries());
  const records: ReconContact[] = [];
  const BATCH_SIZE = 5;

  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async ([email, { sub, count }]) => {
        const contactName = sub.formatted_customer_name || sub.customer_name || '';
        const contactPhone = sub.formatted_customer_phone_number || '';

        // Smart matching: email → phone → name
        const { contact: sparkContact, matchMethod, warnings } = await findInSpark(email, contactPhone, contactName);

        // Add email typo warnings
        warnings.push(...detectEmailWarnings(email));

        const sparkUtm = { utm_source: '', utm_medium: '', utm_campaign: '' };
        let sparkRating = '';
        let sparkEmail = '';

        if (sparkContact) {
          sparkEmail = sparkContact.email || '';
          for (const cfv of sparkContact.custom_field_values || []) {
            if (cfv.custom_field_id === UTM_FIELD_IDS.utm_source) sparkUtm.utm_source = cfv.value || '';
            if (cfv.custom_field_id === UTM_FIELD_IDS.utm_medium) sparkUtm.utm_medium = cfv.value || '';
            if (cfv.custom_field_id === UTM_FIELD_IDS.utm_campaign) sparkUtm.utm_campaign = cfv.value || '';
          }
          sparkRating = (sparkContact.ratings || []).map((r: any) => r.value).join(', ') || 'Unrated';
        }

        const inSpark = sparkContact !== null;
        const callrailSource = sub.source || 'Unknown';
        const hasPaidSource = isPaidSource(callrailSource) || hasRealUtm(sub.utm_source, sub.utm_medium, sub.utm_campaign);

        // Check UTM gap
        let hasUtmGap = false;
        if (inSpark && hasPaidSource) {
          hasUtmGap = EMPTY_UTM_VALUES.has(sparkUtm.utm_source) && EMPTY_UTM_VALUES.has(sparkUtm.utm_medium) && EMPTY_UTM_VALUES.has(sparkUtm.utm_campaign);
        }

        // Get UTM values from CallRail (direct or from URL)
        const urlUtm = extractUtmFromUrl(sub.landing_page_url || '');
        const formFields = extractFormFields(sub.form_data);

        return {
          email,
          name: contactName,
          phone: contactPhone,
          callrailSource,
          callrailUtmSource: sub.utm_source || urlUtm.utm_source || '',
          callrailUtmMedium: sub.utm_medium || urlUtm.utm_medium || '',
          callrailUtmCampaign: sub.utm_campaign || urlUtm.utm_campaign || '',
          submittedAt: sub.submitted_at,
          formType: getFormType(sub.form_url || ''),
          formUrl: sub.form_url || '',
          submissionCount: count,
          inSpark,
          sparkContactId: sparkContact?.id || null,
          sparkRating,
          sparkEmail,
          sparkUtmSource: sparkUtm.utm_source,
          sparkUtmMedium: sparkUtm.utm_medium,
          sparkUtmCampaign: sparkUtm.utm_campaign,
          hasPaidSource,
          hasUtmGap,
          likelyCause: inSpark ? '' : determineLikelyCause(sub),
          captureGaps: inSpark ? [] : detectCaptureGaps(sub.form_data, sub.form_url || '', callrailSource),
          matchMethod,
          warnings,
          callrailZip: formFields.zip,
          callrailHowHeard: formFields.howHeard,
          callrailComments: formFields.comments,
          callrailIsAgent: formFields.isAgent,
          callrailBrokerage: formFields.brokerage,
        } as ReconContact;
      })
    );
    records.push(...batchResults);

    // Small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < contacts.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Step 4: Build source stats
  const sourceMap = new Map<string, { total: number; inSpark: number; missing: number }>();
  for (const r of records) {
    const entry = sourceMap.get(r.callrailSource) || { total: 0, inSpark: 0, missing: 0 };
    entry.total++;
    if (r.inSpark) entry.inSpark++;
    else entry.missing++;
    sourceMap.set(r.callrailSource, entry);
  }

  const sourceStats: SourceStats[] = Array.from(sourceMap.entries())
    .map(([source, data]) => ({
      source,
      ...data,
      dropRate: data.total > 0 ? Math.round((data.missing / data.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const total = records.length;
  const inSpark = records.filter(r => r.inSpark).length;
  const missing = records.filter(r => !r.inSpark).length;
  const utmGaps = records.filter(r => r.hasUtmGap).length;

  return {
    summary: {
      total,
      inSpark,
      missing,
      utmGaps,
      matchRate: total > 0 ? Math.round((inSpark / total) * 100) : 0,
      dropRate: total > 0 ? Math.round((missing / total) * 100) : 0,
    },
    sourceStats,
    contacts: records.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    generatedAt: new Date().toISOString(),
    dateRange: { start: startDate || 'all-time', end: endDate || 'now' },
  };
}
