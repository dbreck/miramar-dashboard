// Types + pure-function aggregations for the Executive Summary report.
// All aggregations operate on the snapshot fetched once from
// /api/executive-summary/stream and re-derive on date-range changes client-side.

export interface ExecSummaryContact {
  id: number;
  createdAt: string;
  sourceName: string;
  isWebsiteSource: boolean;
  city: string | null;
  state: string | null;
  country: string | null;
  postcode: string | null;
  areaCode: string | null;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  rating: string;
  agent: boolean;
  hasReservation: boolean;
}

export interface ExecSummaryReservation {
  id: number;
  reservedAt: string | null;
  createdAt: string | null;
  executedAt: string | null;
  convertedAt: string | null;
  statusId: number | null;
  statusValue?: string | null;
  cancelled?: boolean;
  priceCents: number;
  depositsOwedCents: number;
  depositsPaidCents: number;
  contactId: number | null;
  buyerName: string | null;
  sourceName: string;
  isWebsiteSource: boolean;
  leadDate: string | null;
  daysFromLead: number | null;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export interface ExecSummaryPayload {
  meta: {
    projectId: number;
    snapshotAt: string;
    dataMinDate: string | null;
    dataMaxDate: string | null;
    totalContacts: number;
    totalReservations: number;
    ratingPalette: Record<string, string>;
  };
  contacts: ExecSummaryContact[];
  reservations: ExecSummaryReservation[];
  sources: { name: string; isWebsite: boolean; total: number }[];
}

export interface ExecDateRange {
  start: Date;
  end: Date;
}

// ---------- helpers ----------

export function inRange(iso: string | null | undefined, range: ExecDateRange): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= range.start.getTime() && t <= range.end.getTime();
}

export function centsToDollars(c: number): number {
  return Math.round(c) / 100;
}

export function formatCurrency(c: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(centsToDollars(c));
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

// Linear least-squares fit. Returns the trend value at each x = 0..n-1.
// Returns an empty array when there are fewer than 2 points (no trend possible).
export function linearTrend(values: number[]): number[] {
  const n = values.length;
  if (n < 2) return [];
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return values.map(() => sumY / n);
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return values.map((_, i) => intercept + slope * i);
}

// Bucket size: pick weekly for >60d ranges, daily otherwise.
export function pickBucketSize(range: ExecDateRange): 'day' | 'week' | 'month' {
  const days = (range.end.getTime() - range.start.getTime()) / 86400000;
  if (days > 365) return 'month';
  if (days > 60) return 'week';
  return 'day';
}

function bucketKey(date: Date, bucket: 'day' | 'week' | 'month'): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  if (bucket === 'month') {
    return `${y}-${String(m + 1).padStart(2, '0')}`;
  }
  if (bucket === 'week') {
    // ISO-like week: snap to the Monday at 00:00 UTC
    const dt = new Date(Date.UTC(y, m, d));
    const dow = dt.getUTCDay(); // 0=Sun .. 6=Sat
    const diff = (dow === 0 ? -6 : 1 - dow); // shift to Monday
    dt.setUTCDate(dt.getUTCDate() + diff);
    return dt.toISOString().split('T')[0];
  }
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function formatBucketLabel(key: string, bucket: 'day' | 'week' | 'month'): string {
  if (bucket === 'month') {
    const [y, m] = key.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }
  const d = new Date(key + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

// ---------- aggregations ----------

export function summarize(
  payload: ExecSummaryPayload,
  range: ExecDateRange,
  options: { excludeAgents?: boolean } = {},
) {
  // Agents are not buyer leads. Excluding them by default keeps the headline
  // lead count, conversion rate, and active pipeline from being skewed by
  // bulk agent imports (e.g. the 2026-07-03 realtor list that landed with no
  // registration source). Callers can pass { excludeAgents: false } to opt in.
  const excludeAgents = options.excludeAgents ?? true;
  const contacts = payload.contacts.filter(
    (c) => inRange(c.createdAt, range) && !(excludeAgents && c.agent),
  );
  const reservations = payload.reservations.filter((r) =>
    inRange(r.reservedAt || r.createdAt, range),
  );

  const totalLeads = contacts.length;
  const totalReservations = reservations.length;
  const reservationValue = reservations.reduce((s, r) => s + (r.priceCents || 0), 0);
  const depositsCollected = reservations.reduce((s, r) => s + (r.depositsPaidCents || 0), 0);
  const depositsOwed = reservations.reduce((s, r) => s + (r.depositsOwedCents || 0), 0);
  const conversionRate =
    totalLeads > 0 ? (totalReservations / totalLeads) * 100 : 0;
  const avgDaysToReservation =
    reservations.length > 0
      ? reservations
          .map((r) => r.daysFromLead)
          .filter((d): d is number => typeof d === 'number')
          .reduce((s, d, _, arr) => s + d / (arr.length || 1), 0)
      : 0;
  const avgReservationPrice =
    totalReservations > 0 ? reservationValue / totalReservations : 0;

  // Active pipeline = leads in stages that represent active interest
  const ACTIVE_STAGES = new Set(['Hot', 'Warm', 'Reservation Holder', 'Contract Holder']);
  const activePipeline = contacts.filter((c) => ACTIVE_STAGES.has(c.rating)).length;

  return {
    totalLeads,
    totalReservations,
    reservationValueCents: reservationValue,
    depositsCollectedCents: depositsCollected,
    depositsOwedCents: depositsOwed,
    conversionRate,
    avgDaysToReservation,
    avgReservationPriceCents: avgReservationPrice,
    activePipeline,
  };
}

export function leadGrowthBuckets(
  payload: ExecSummaryPayload,
  range: ExecDateRange,
  options: { excludeAgents?: boolean } = {},
): {
  buckets: { key: string; label: string; date: number }[];
  combined: Record<string, number>;
  bySource: Record<string, Record<string, number>>;
  websiteCombined: Record<string, number>;
  nonWebsiteCombined: Record<string, number>;
} {
  const excludeAgents = options.excludeAgents ?? true;
  const bucket = pickBucketSize(range);
  const seenKeys = new Set<string>();
  const combined: Record<string, number> = {};
  const bySource: Record<string, Record<string, number>> = {};
  const websiteCombined: Record<string, number> = {};
  const nonWebsiteCombined: Record<string, number> = {};

  payload.contacts.forEach((c) => {
    if (!inRange(c.createdAt, range)) return;
    if (excludeAgents && c.agent) return;
    const d = new Date(c.createdAt);
    const key = bucketKey(d, bucket);
    seenKeys.add(key);
    combined[key] = (combined[key] || 0) + 1;
    if (c.isWebsiteSource) {
      websiteCombined[key] = (websiteCombined[key] || 0) + 1;
    } else {
      nonWebsiteCombined[key] = (nonWebsiteCombined[key] || 0) + 1;
    }
    if (!bySource[c.sourceName]) bySource[c.sourceName] = {};
    bySource[c.sourceName][key] = (bySource[c.sourceName][key] || 0) + 1;
  });

  // Fill in zero buckets to keep the chart smooth
  const start = new Date(range.start);
  const end = new Date(range.end);
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    seenKeys.add(bucketKey(cursor, bucket));
    if (bucket === 'day') cursor.setUTCDate(cursor.getUTCDate() + 1);
    else if (bucket === 'week') cursor.setUTCDate(cursor.getUTCDate() + 7);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  const buckets = Array.from(seenKeys)
    .sort()
    .map((key) => ({
      key,
      label: formatBucketLabel(key, bucket),
      date:
        bucket === 'month'
          ? new Date(`${key}-01T00:00:00Z`).getTime()
          : new Date(`${key}T00:00:00Z`).getTime(),
    }));

  return { buckets, combined, bySource, websiteCombined, nonWebsiteCombined };
}

export function leadSourcesInRange(
  payload: ExecSummaryPayload,
  range: ExecDateRange,
  options: { excludeAgents?: boolean } = {},
): { name: string; leads: number; isWebsite: boolean }[] {
  // Exclude agents by default — a sourceless agent import would otherwise show
  // up here as a giant "No Source" bar and drown out real lead attribution.
  const excludeAgents = options.excludeAgents ?? true;
  const counts = new Map<string, { leads: number; isWebsite: boolean }>();
  payload.contacts.forEach((c) => {
    if (!inRange(c.createdAt, range)) return;
    if (excludeAgents && c.agent) return;
    const entry = counts.get(c.sourceName) || { leads: 0, isWebsite: c.isWebsiteSource };
    entry.leads++;
    counts.set(c.sourceName, entry);
  });
  return Array.from(counts.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.leads - a.leads);
}

export function geographyInRange(
  payload: ExecSummaryPayload,
  range: ExecDateRange,
  options: { excludeAgents?: boolean } = {},
): {
  topCities: { name: string; leads: number }[];
  topStates: { name: string; leads: number }[];
} {
  const excludeAgents = options.excludeAgents ?? true;
  const cities = new Map<string, number>();
  const states = new Map<string, number>();
  payload.contacts.forEach((c) => {
    if (!inRange(c.createdAt, range)) return;
    if (excludeAgents && c.agent) return;
    if (c.city && c.state) {
      const cKey = `${c.city}, ${c.state}`;
      cities.set(cKey, (cities.get(cKey) || 0) + 1);
    } else if (c.city) {
      cities.set(c.city, (cities.get(c.city) || 0) + 1);
    }
    if (c.state) {
      states.set(c.state, (states.get(c.state) || 0) + 1);
    }
  });

  const topCities = Array.from(cities.entries())
    .map(([name, leads]) => ({ name, leads }))
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 15);
  const topStates = Array.from(states.entries())
    .map(([name, leads]) => ({ name, leads }))
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 15);

  return { topCities, topStates };
}

export function marketingInRange(
  payload: ExecSummaryPayload,
  range: ExecDateRange,
  options: { excludeAgents?: boolean } = {},
): {
  utmSources: { name: string; leads: number }[];
  utmMediums: { name: string; leads: number }[];
  topCampaigns: { campaign: string; source: string; medium: string; leads: number }[];
} {
  const excludeAgents = options.excludeAgents ?? true;
  const utmSources = new Map<string, number>();
  const utmMediums = new Map<string, number>();
  const campaigns = new Map<string, { campaign: string; source: string; medium: string; leads: number }>();

  payload.contacts.forEach((c) => {
    if (!inRange(c.createdAt, range)) return;
    if (excludeAgents && c.agent) return;
    utmSources.set(c.utmSource, (utmSources.get(c.utmSource) || 0) + 1);
    utmMediums.set(c.utmMedium, (utmMediums.get(c.utmMedium) || 0) + 1);
    const key = `${c.utmCampaign}|${c.utmSource}|${c.utmMedium}`;
    const existing = campaigns.get(key);
    if (existing) existing.leads++;
    else
      campaigns.set(key, {
        campaign: c.utmCampaign,
        source: c.utmSource,
        medium: c.utmMedium,
        leads: 1,
      });
  });

  return {
    utmSources: Array.from(utmSources.entries())
      .map(([name, leads]) => ({ name, leads }))
      .sort((a, b) => b.leads - a.leads),
    utmMediums: Array.from(utmMediums.entries())
      .map(([name, leads]) => ({ name, leads }))
      .sort((a, b) => b.leads - a.leads),
    topCampaigns: Array.from(campaigns.values())
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 10),
  };
}

export function reservationsInRange(
  payload: ExecSummaryPayload,
  range: ExecDateRange,
): ExecSummaryReservation[] {
  return payload.reservations.filter((r) => inRange(r.reservedAt || r.createdAt, range));
}

export function reservationsBuckets(
  payload: ExecSummaryPayload,
  range: ExecDateRange,
  options: { activeOnly?: boolean } = {},
): { buckets: { key: string; label: string; date: number }[]; counts: Record<string, number> } {
  const bucket = pickBucketSize(range);
  const seenKeys = new Set<string>();
  const counts: Record<string, number> = {};
  payload.reservations.forEach((r) => {
    if (options.activeOnly && r.cancelled) return;
    const dateStr = r.reservedAt || r.createdAt;
    if (!dateStr || !inRange(dateStr, range)) return;
    const key = bucketKey(new Date(dateStr), bucket);
    seenKeys.add(key);
    counts[key] = (counts[key] || 0) + 1;
  });

  // Fill zero buckets
  const start = new Date(range.start);
  const end = new Date(range.end);
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    seenKeys.add(bucketKey(cursor, bucket));
    if (bucket === 'day') cursor.setUTCDate(cursor.getUTCDate() + 1);
    else if (bucket === 'week') cursor.setUTCDate(cursor.getUTCDate() + 7);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  const buckets = Array.from(seenKeys)
    .sort()
    .map((key) => ({
      key,
      label: formatBucketLabel(key, bucket),
      date:
        bucket === 'month'
          ? new Date(`${key}-01T00:00:00Z`).getTime()
          : new Date(`${key}T00:00:00Z`).getTime(),
    }));

  return { buckets, counts };
}

// ---------- Lead quality ----------
//
// Quality ratings are the "active pipeline" set: a contact in any of these
// states has demonstrated real buying intent or has already converted.
// The quality rate of a source/campaign = % of its leads that reached one
// of these ratings. This is the headline number for ad-spend allocation.

export const QUALITY_RATINGS = ['Hot', 'Warm', 'Reservation Holder', 'Contract Holder'] as const;
const QUALITY_SET = new Set<string>(QUALITY_RATINGS);

export interface QualityBucket {
  name: string;
  total: number;
  hot: number;
  warm: number;
  resHolder: number;
  contractHolder: number;
  qualityCount: number;
  qualityRate: number; // 0..100
}

function bumpRating(b: QualityBucket, rating: string) {
  b.total++;
  if (QUALITY_SET.has(rating)) b.qualityCount++;
  if (rating === 'Hot') b.hot++;
  else if (rating === 'Warm') b.warm++;
  else if (rating === 'Reservation Holder') b.resHolder++;
  else if (rating === 'Contract Holder') b.contractHolder++;
}

function finalizeQuality(buckets: Map<string, QualityBucket>, minN: number): QualityBucket[] {
  const out: QualityBucket[] = [];
  buckets.forEach((b) => {
    if (b.total < minN) return;
    b.qualityRate = b.total > 0 ? (b.qualityCount / b.total) * 100 : 0;
    out.push(b);
  });
  // Primary sort: highest quality rate. Secondary: more leads breaks ties.
  out.sort((a, b) => b.qualityRate - a.qualityRate || b.total - a.total);
  return out;
}

export function qualityBySource(
  payload: ExecSummaryPayload,
  range: ExecDateRange,
  options: { minN?: number } = {},
): { buckets: QualityBucket[]; excluded: number } {
  const minN = options.minN ?? 10;
  const map = new Map<string, QualityBucket>();
  let excluded = 0;
  payload.contacts.forEach((c) => {
    if (!inRange(c.createdAt, range)) return;
    if (c.agent) return; // agents pollute quality math
    const key = c.sourceName || 'No Source';
    let b = map.get(key);
    if (!b) {
      b = {
        name: key,
        total: 0, hot: 0, warm: 0, resHolder: 0, contractHolder: 0,
        qualityCount: 0, qualityRate: 0,
      };
      map.set(key, b);
    }
    bumpRating(b, c.rating);
  });
  // Count sources we're filtering out so the UI can show "+N below threshold"
  map.forEach((b) => { if (b.total < minN) excluded++; });
  return { buckets: finalizeQuality(map, minN), excluded };
}

export function qualityByCampaign(
  payload: ExecSummaryPayload,
  range: ExecDateRange,
  options: { minN?: number } = {},
): { buckets: (QualityBucket & { source: string; campaign: string })[]; excluded: number } {
  const minN = options.minN ?? 5;
  const map = new Map<
    string,
    QualityBucket & { source: string; campaign: string }
  >();
  let excluded = 0;
  payload.contacts.forEach((c) => {
    if (!inRange(c.createdAt, range)) return;
    if (c.agent) return;
    // Skip rows with no real campaign attribution — they swamp the chart.
    if (
      (c.utmSource === 'Direct' || !c.utmSource) &&
      (c.utmCampaign === 'No Campaign' || !c.utmCampaign)
    ) {
      return;
    }
    const key = `${c.utmSource}|${c.utmCampaign}`;
    let b = map.get(key);
    if (!b) {
      b = {
        name: c.utmCampaign,
        source: c.utmSource,
        campaign: c.utmCampaign,
        total: 0, hot: 0, warm: 0, resHolder: 0, contractHolder: 0,
        qualityCount: 0, qualityRate: 0,
      };
      map.set(key, b);
    }
    bumpRating(b, c.rating);
  });
  map.forEach((b) => { if (b.total < minN) excluded++; });
  // finalizeQuality returns QualityBucket[] but map values carry the extra fields
  const filtered: (QualityBucket & { source: string; campaign: string })[] = [];
  map.forEach((b) => {
    if (b.total < minN) return;
    b.qualityRate = b.total > 0 ? (b.qualityCount / b.total) * 100 : 0;
    filtered.push(b);
  });
  filtered.sort((a, b) => b.qualityRate - a.qualityRate || b.total - a.total);
  return { buckets: filtered, excluded };
}

// ---------- Cohort quality ----------
//
// "Of contacts who entered the funnel in month X, where are they now?"
// X-axis = createdAt month bucket; stack = current rating distribution.
// This is NOT rating-over-time — it's a snapshot of cohort outcomes today.

export interface CohortRow {
  monthKey: string;
  label: string;
  date: number;
  total: number;
  ratings: Record<string, number>;
}

export function cohortQuality(
  payload: ExecSummaryPayload,
  options: { excludeAgents?: boolean } = {},
): { rows: CohortRow[]; ratingsSeen: string[] } {
  const excludeAgents = options.excludeAgents ?? true;
  const map = new Map<string, CohortRow>();
  const ratingsSeen = new Set<string>();
  payload.contacts.forEach((c) => {
    if (excludeAgents && c.agent) return;
    if (!c.createdAt) return;
    const d = new Date(c.createdAt);
    const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    let row = map.get(monthKey);
    if (!row) {
      row = {
        monthKey,
        label: new Date(`${monthKey}-01T00:00:00Z`).toLocaleDateString('en-US', {
          month: 'short',
          year: '2-digit',
          timeZone: 'UTC',
        }),
        date: new Date(`${monthKey}-01T00:00:00Z`).getTime(),
        total: 0,
        ratings: {},
      };
      map.set(monthKey, row);
    }
    row.total++;
    row.ratings[c.rating] = (row.ratings[c.rating] || 0) + 1;
    ratingsSeen.add(c.rating);
  });
  const rows = Array.from(map.values()).sort((a, b) => a.date - b.date);
  return { rows, ratingsSeen: Array.from(ratingsSeen) };
}

// ---------- Current rating distribution ----------

export function currentRatingDistribution(
  payload: ExecSummaryPayload,
  options: { excludeAgents?: boolean } = {},
): { rating: string; count: number }[] {
  const excludeAgents = options.excludeAgents ?? true;
  const counts = new Map<string, number>();
  payload.contacts.forEach((c) => {
    if (excludeAgents && c.agent) return;
    counts.set(c.rating, (counts.get(c.rating) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([rating, count]) => ({ rating, count }))
    .sort((a, b) => b.count - a.count);
}

export function reservationSourcesInRange(
  payload: ExecSummaryPayload,
  range: ExecDateRange,
): { name: string; reservations: number; valueCents: number }[] {
  const map = new Map<string, { reservations: number; valueCents: number }>();
  payload.reservations.forEach((r) => {
    const dateStr = r.reservedAt || r.createdAt;
    if (!dateStr || !inRange(dateStr, range)) return;
    const entry = map.get(r.sourceName) || { reservations: 0, valueCents: 0 };
    entry.reservations++;
    entry.valueCents += r.priceCents || 0;
    map.set(r.sourceName, entry);
  });
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.reservations - a.reservations);
}
