/**
 * Lead Inquiry Response: point-in-time data, pulled 2026-10-12.
 *
 * Static snapshot backing /lead-inquiry (Heather's 2026-10-12 "Lead Inquiry"
 * email). Every number comes from the validation findings in
 * heather-analysis/findings (Spark API, Looker Studio, GA4, CallRail,
 * Microsoft Clarity). Do not edit numbers here without re-pulling the source.
 * Aggregates only: no names, emails or phone numbers.
 */

export const AS_OF = '2026-10-12';
export const AS_OF_LABEL = 'October 12, 2026';

export type VerdictState = 'right' | 'partly' | 'not-supported';

export interface MonthPoint {
  month: string;
  /** true for Oct 1–12 (partial month) */
  partial?: boolean;
}

// ---------- At a glance ----------

export interface GlanceTile {
  id: string;
  label: string;
  from: string;
  to: string;
  change?: string;
  meaning: string;
}

export const GLANCE: GlanceTile[] = [
  {
    id: 'spend',
    label: 'Ad spend per day, Sep → Oct',
    from: '$737',
    to: '$1,142',
    change: '+55%',
    meaning: 'We are spending a lot more per day in October.',
  },
  {
    id: 'leads',
    label: 'Leads per day, Sep → Oct',
    from: '3.13',
    to: '3.08',
    change: 'Flat',
    meaning: 'The extra spend has not brought extra leads.',
  },
  {
    id: 'cpl',
    label: 'Cost per lead, Sep → Oct',
    from: '$235',
    to: '$370',
    meaning: 'Each lead costs more. This is the real problem.',
  },
  {
    id: 'contacts',
    label: 'Contacts, Oct 1–12 vs Sep 1–12',
    from: '24',
    to: '30',
    meaning: 'In Spark. Your sheet shows 28 vs 25. Early October is up, not down.',
  },
];

// ---------- Claim 1 ----------

export interface MonthlyContacts extends MonthPoint {
  contacts: number;
  /** 30-day pace for a partial month */
  pace?: number;
}

/** Spark buyer contacts on Heather's own rule (registered in month, rating not Agent/Influencer/Legal/Team). */
export const MONTHLY_CONTACTS: MonthlyContacts[] = [
  { month: 'Jun', contacts: 45 },
  { month: 'Jul', contacts: 81 },
  { month: 'Aug', contacts: 83 },
  { month: 'Sep', contacts: 65 },
  { month: 'Oct 1–12', contacts: 30, pace: 75, partial: true },
];

export interface SpendLeadsPerDay extends MonthPoint {
  spendPerDay: number;
  leadsPerDay: number;
}

/** Looker: Google cost tile + Meta spend; Google conversions + Meta leads. */
export const SPEND_LEADS_PER_DAY: SpendLeadsPerDay[] = [
  { month: 'Jun', spendPerDay: 619, leadsPerDay: 2.23 },
  { month: 'Jul', spendPerDay: 715, leadsPerDay: 3.73 },
  { month: 'Aug', spendPerDay: 644, leadsPerDay: 3.27 },
  { month: 'Sep', spendPerDay: 737, leadsPerDay: 3.13 },
  { month: 'Oct 1–12', spendPerDay: 1142, leadsPerDay: 3.08, partial: true },
];

// ---------- Claim 2 ----------

export interface GoogleMonth extends MonthPoint {
  /** Spark contacts with utm google / cpc */
  spark: number;
  /** 30-day pace for the partial month (Spark) */
  sparkPace?: number;
  /** Google Ads conversions (Looker) */
  looker: number;
}

export const GOOGLE_BY_MONTH: GoogleMonth[] = [
  { month: 'Jun', spark: 13, looker: 19 },
  { month: 'Jul', spark: 19, looker: 33.5 },
  { month: 'Aug', spark: 21, looker: 32.5 },
  { month: 'Sep', spark: 17, looker: 40 },
  { month: 'Oct 1–12', spark: 6, sparkPace: 15, looker: 7, partial: true },
];

export const GOOGLE_FACTS = {
  bestMonthConversions: 40,
  bestMonthCpl: '$323',
  first12Before: 14,
  first12After: 7,
  first12SpendIncrease: '77%',
  lookerOctCpl: '$616',
  lookerTableSpend: '$4.3K',
  octGoogleSpend: '$7.9K',
  campaignsShown: 5,
  unshownSpend: '$3.0K',
  youtubeSpend: '$569',
  reserveGoogleLeadsUncounted: 11,
};

// ---------- Claim 3 ----------

export interface FormAuditRow {
  form: string;
  page: string;
  phoneRequired: boolean;
  note?: string;
}

export const FORM_AUDIT: FormAuditRow[] = [
  { form: 'Book a Private Tour', page: '/reserve/ (new page)', phoneRequired: true },
  { form: 'Send Me the Brochure', page: '/reserve/ (new page)', phoneRequired: false, note: 'Optional by design' },
  { form: 'Main inquiry form', page: 'Original ad page', phoneRequired: true },
  { form: 'Footer form', page: 'Home and original ad page', phoneRequired: true },
  { form: 'Timed popup', page: 'Home and other pages', phoneRequired: true },
  { form: 'Contact form', page: '/contact/', phoneRequired: true },
  { form: 'Brochure form', page: '/brochure-form/', phoneRequired: true },
  { form: 'Brochure download popup', page: '/brochure-download/', phoneRequired: true },
];

export interface ShareRow {
  label: string;
  detail?: string;
  count: number;
  total: number;
  /** percent as published in the findings (omit when the findings do not state one) */
  pct?: number;
  emphasis?: boolean;
}

/** Spark buyer leads with no phone number at all. */
export const MISSING_PHONE: ShareRow[] = [
  { label: 'All leads, Jun 1 – Sep 3', detail: 'Before the new page', count: 0, total: 217, pct: 0 },
  { label: 'All leads, Sep 4 – Oct 12', detail: 'Since the new page', count: 4, total: 94 },
  { label: 'Send Me the Brochure', detail: '/reserve/, Sep 4 – Oct 12', count: 4, total: 28, pct: 14, emphasis: true },
  { label: 'Book a Private Tour', detail: '/reserve/, Sep 4 – Oct 12', count: 0, total: 14, pct: 0 },
];

/** Sep 4–30 leads (each had at least 12 days to be worked), rated Non Responsive or Do Not Disturb today. */
export const NON_RESPONSIVE: ShareRow[] = [
  { label: 'Send Me the Brochure', detail: '/reserve/', count: 9, total: 15, pct: 60, emphasis: true },
  { label: 'Original ad page', detail: 'Main inquiry form', count: 1, total: 13, pct: 8 },
  { label: 'Book a Private Tour', detail: '/reserve/', count: 1, total: 8, pct: 12 },
];

export interface CvrRow {
  segment: string;
  reserve: number;
  original: number;
}

/** GA4, Sep 1 – Oct 12. /reserve/ = lead_submit per landing session; original = key-event rate. */
export const CONVERSION_RATES: CvrRow[] = [
  { segment: 'All traffic, Sep', reserve: 2.15, original: 0.39 },
  { segment: 'All traffic, Oct 1–12', reserve: 1.53, original: 0.42 },
  { segment: 'Google paid', reserve: 1.09, original: 0.34 },
  { segment: 'Meta paid', reserve: 2.19, original: 1.75 },
];

export const PAGE_FACTS = {
  scrollReserve: 68,
  scrollOriginal: 29,
  googleShareToReserve: 21,
  metaShareToReserve: 65,
  allLeadsNonResponsiveRange: '37–41%',
  brochureNonResponsiveWithPhone: 10,
  brochureNonResponsiveTotal: 12,
  tourNegative: 7,
  tourTotal: 8,
};

// ---------- What we fixed ----------

export type FixStatus = 'done' | 'in-progress' | 'needs-you' | 'next';

export interface FixItem {
  status: FixStatus;
  title: string;
  detail: string;
}

export const FIXES: FixItem[] = [
  {
    status: 'done',
    title: 'GA4 now counts /reserve/ form submissions as conversions',
    detail:
      'Done October 12. Before this, 47 /reserve/ submissions (Sep 1 to Oct 12) were not counted as conversions in GA4. Counting starts October 12, so earlier reports will not change.',
  },
  {
    status: 'in-progress',
    title: 'Phone number required on the brochure option',
    detail: 'The change is written and tested. It is waiting to go live on the site.',
  },
  {
    status: 'done',
    title: 'Dashboard shows the newer Spark ratings',
    detail:
      'Lead, Non Responsive and Do Not Disturb were missing from our dashboard and showed as Unrated. They now display correctly.',
  },
  {
    status: 'next',
    title: 'Spark cleanup',
    detail:
      '4 likely duplicate people, 6 rows flagged as agents, and 13 manual entries with no registration date. These slightly change counts in the spreadsheet.',
  },
];

export const SOURCES: string[] = [
  'Spark API, full pull: 9,362 contacts, 1,917 detail records',
  'Looker Studio, by calendar month',
  'GA4 property for miramarsarasota.com',
  'CallRail API: 551 form submissions, Jun 1 – Oct 12',
  'Microsoft Clarity, Oct 10 – 12',
  'Live site form code',
];
