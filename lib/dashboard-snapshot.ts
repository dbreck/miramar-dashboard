// Pure-function aggregations for the main Spark Reporting dashboard tabs.
// Operates on the same snapshot used by the Executive Summary, applying
// date range + filter selections client-side.

import {
  ExecSummaryContact,
  ExecSummaryPayload,
  ExecDateRange,
  inRange,
} from '@/lib/executive-summary';

// ---------- area-code → city/region map (mirrors the dashboard route) ----------
const AREA_CODE_TO_LOCATION: Record<string, string> = {
  // Florida
  '239': 'Fort Myers, FL', '305': 'Miami, FL', '321': 'Orlando, FL', '352': 'Gainesville, FL',
  '386': 'Daytona Beach, FL', '407': 'Orlando, FL', '561': 'West Palm Beach, FL',
  '727': 'St. Petersburg, FL', '754': 'Fort Lauderdale, FL', '772': 'Port St. Lucie, FL',
  '786': 'Miami, FL', '813': 'Tampa, FL', '850': 'Tallahassee, FL', '863': 'Lakeland, FL',
  '904': 'Jacksonville, FL', '941': 'Sarasota, FL', '954': 'Fort Lauderdale, FL',
  // Major US cities
  '212': 'Manhattan, NY', '213': 'Los Angeles, CA', '310': 'West LA, CA', '312': 'Chicago, IL',
  '404': 'Atlanta, GA', '415': 'San Francisco, CA', '512': 'Austin, TX', '617': 'Boston, MA',
  '702': 'Las Vegas, NV', '713': 'Houston, TX', '214': 'Dallas, TX', '602': 'Phoenix, AZ',
  '206': 'Seattle, WA', '303': 'Denver, CO', '215': 'Philadelphia, PA',
};

// Spark rating colors (mirrors what the dashboard route was returning)
const RATING_COLORS: Record<string, string> = {
  New: '#C0D7B1', Agent: '#D3C9EC', Legal: '#FFDD90',
  Hot: '#C33A32', Warm: '#FFBBAA', Cold: '#C0E1F4',
  'Not Interested': '#DBDBDB', Team: '#e4a02c',
  'Reservation Holder': '#2380c4', 'Contract Holder': '#a038cc',
  Influencer: '#000000', 'CB Global Luxury Agent': '#f5e8e8',
  'Not A Buyer': '#055707', Referral: '#e759a0',
  Unrated: '#999999',
};

const PIPELINE_STAGES = ['New', 'Warm', 'Hot', 'Reservation Holder', 'Contract Holder'];

export interface DashboardFilters {
  excludedSources: string[];
  excludeAgents: boolean;
  excludeNoSource: boolean;
}

// Apply user filters (Filter Panel) to a contact list.
function applyFilters(contacts: ExecSummaryContact[], filters: DashboardFilters): ExecSummaryContact[] {
  const excluded = new Set(filters.excludedSources);
  return contacts.filter((c) => {
    if (filters.excludeAgents && c.agent) return false;
    if (filters.excludeNoSource && c.sourceName === 'No Source') return false;
    if (excluded.size > 0 && excluded.has(c.sourceName)) return false;
    // Always-on: exclude Agent Import
    if (c.sourceName.toLowerCase().includes('agent import')) return false;
    return true;
  });
}

// ---------- the shape the existing tabs consume ----------
export interface DashboardView {
  keyMetrics: {
    totalLeads: number;
    trend: { value: number; direction: 'up' | 'down' | 'neutral' };
    unfilteredTotal?: number;
  };
  leadSources: { name: string; contacts: number }[];
  leadGrowth: { date: string; leads: number }[];
  leadGrowthBySource: Record<string, { date: string; leads: number }[]>;
  leadsByLocation: { location: string; leads: number }[];
  leadsByZipCode: { zipCode: string; leads: number }[];
  agentDistribution: { category: string; count: number }[];
  trafficSources: { source: string; leads: number }[];
  topCampaigns: { campaign: string; source: string; medium: string; leads: number }[];
  ratingDistribution: { rating: string; count: number; color: string; percentage: number }[];
  salesPipeline: { stage: string; count: number; color: string }[];
  ratingsBySource: Record<string, { rating: string; count: number }[]>;
  availableSources: string[];
  activeFilters: {
    excludedSources: string[];
    excludeAgents: boolean;
    excludeNoSource: boolean;
    filteredOutCount: number;
  };
}

export function buildDashboardView(
  payload: ExecSummaryPayload,
  range: ExecDateRange,
  filters: DashboardFilters,
): DashboardView {
  // 1. Date-filter on snapshot (matches the API behavior: filter by created_at)
  const dateFiltered = payload.contacts.filter((c) => inRange(c.createdAt, range));
  // 2. User filters
  const contacts = applyFilters(dateFiltered, filters);

  // ---- Trend (current vs previous equal-length window) ----
  const days = Math.max(
    1,
    Math.ceil((range.end.getTime() - range.start.getTime()) / 86400000),
  );
  const prevEnd = new Date(range.start);
  const prevStart = new Date(range.start.getTime() - days * 86400000);
  const previousDateFiltered = payload.contacts.filter((c) =>
    inRange(c.createdAt, { start: prevStart, end: prevEnd }),
  );
  const previous = applyFilters(previousDateFiltered, filters);
  const currentTotal = contacts.length;
  const previousTotal = previous.length;
  const trendValue =
    previousTotal === 0 ? 0 : Math.round(((currentTotal - previousTotal) / previousTotal) * 100);
  const trendDirection: 'up' | 'down' | 'neutral' =
    currentTotal > previousTotal ? 'up' : currentTotal < previousTotal ? 'down' : 'neutral';

  // ---- Lead sources (bar chart) ----
  const sourceCounts = new Map<string, number>();
  contacts.forEach((c) => {
    sourceCounts.set(c.sourceName, (sourceCounts.get(c.sourceName) || 0) + 1);
  });
  const leadSources = Array.from(sourceCounts.entries())
    .map(([name, contactsCount]) => ({ name, contacts: contactsCount }))
    .sort((a, b) => b.contacts - a.contacts);

  // ---- Lead growth (per-day) ----
  const leadsByDate = new Map<string, number>();
  const leadsByDateAndSource = new Map<string, Map<string, number>>();
  contacts.forEach((c) => {
    const dateKey = c.createdAt.split('T')[0];
    leadsByDate.set(dateKey, (leadsByDate.get(dateKey) || 0) + 1);
    if (!leadsByDateAndSource.has(dateKey)) leadsByDateAndSource.set(dateKey, new Map());
    const m = leadsByDateAndSource.get(dateKey)!;
    m.set(c.sourceName, (m.get(c.sourceName) || 0) + 1);
  });
  const fmtDay = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const leadGrowth = Array.from(leadsByDate.entries())
    .map(([key, leads]) => ({
      key,
      date: fmtDay(new Date(`${key}T00:00:00Z`)),
      leads,
      sortDate: new Date(`${key}T00:00:00Z`).getTime(),
    }))
    .sort((a, b) => a.sortDate - b.sortDate)
    .map(({ date, leads }) => ({ date, leads }));

  const leadGrowthBySource: Record<string, { date: string; leads: number }[]> = {};
  for (const [dateKey, sourcesMap] of leadsByDateAndSource.entries()) {
    const date = fmtDay(new Date(`${dateKey}T00:00:00Z`));
    const sortDate = new Date(`${dateKey}T00:00:00Z`).getTime();
    for (const [sourceName, leads] of sourcesMap.entries()) {
      if (!leadGrowthBySource[sourceName]) leadGrowthBySource[sourceName] = [];
      leadGrowthBySource[sourceName].push({ date, leads, ...({ sortDate } as any) });
    }
  }
  for (const sourceName of Object.keys(leadGrowthBySource)) {
    leadGrowthBySource[sourceName] = leadGrowthBySource[sourceName]
      .sort((a: any, b: any) => a.sortDate - b.sortDate)
      .map(({ date, leads }: any) => ({ date, leads }));
  }

  // ---- Leads by Location (area code) ----
  const locationCounts = new Map<string, number>();
  let noLocationCount = 0;
  contacts.forEach((c) => {
    if (c.areaCode && AREA_CODE_TO_LOCATION[c.areaCode]) {
      const loc = AREA_CODE_TO_LOCATION[c.areaCode];
      locationCounts.set(loc, (locationCounts.get(loc) || 0) + 1);
    } else {
      noLocationCount++;
    }
  });
  const leadsByLocation = Array.from(locationCounts.entries())
    .map(([location, leads]) => ({ location, leads }))
    .sort((a, b) => b.leads - a.leads);
  if (noLocationCount > 0) {
    leadsByLocation.push({ location: 'Unknown', leads: noLocationCount });
    leadsByLocation.sort((a, b) => b.leads - a.leads);
  }

  // ---- Leads by ZIP ----
  const zipCounts = new Map<string, { count: number; city: string }>();
  let noZipCount = 0;
  contacts.forEach((c) => {
    if (c.postcode) {
      const existing = zipCounts.get(c.postcode);
      if (existing) {
        zipCounts.set(c.postcode, {
          count: existing.count + 1,
          city: existing.city || c.city || '',
        });
      } else {
        zipCounts.set(c.postcode, { count: 1, city: c.city || '' });
      }
    } else {
      noZipCount++;
    }
  });
  const leadsByZipCode = Array.from(zipCounts.entries())
    .map(([zip, v]) => ({
      zipCode: v.city ? `${zip} ${v.city}` : zip,
      leads: v.count,
    }))
    .sort((a, b) => b.leads - a.leads);
  if (noZipCount > 0) {
    leadsByZipCode.push({ zipCode: 'Unknown', leads: noZipCount });
    leadsByZipCode.sort((a, b) => b.leads - a.leads);
  }

  // ---- Agent distribution ----
  const agentCount = contacts.filter((c) => c.agent).length;
  const nonAgentCount = contacts.length - agentCount;
  const agentDistribution = [
    { category: 'All Leads', count: contacts.length },
    { category: 'Agents', count: agentCount },
    { category: 'Non-Agents', count: nonAgentCount },
  ];

  // ---- Marketing UTM ----
  const utmSourceCounts = new Map<string, number>();
  const campaignKeys = new Map<
    string,
    { campaign: string; source: string; medium: string; count: number }
  >();
  contacts.forEach((c) => {
    utmSourceCounts.set(c.utmSource, (utmSourceCounts.get(c.utmSource) || 0) + 1);
    const key = `${c.utmCampaign}|${c.utmSource}|${c.utmMedium}`;
    const existing = campaignKeys.get(key);
    if (existing) existing.count++;
    else
      campaignKeys.set(key, {
        campaign: c.utmCampaign,
        source: c.utmSource,
        medium: c.utmMedium,
        count: 1,
      });
  });
  const trafficSources = Array.from(utmSourceCounts.entries())
    .map(([source, leads]) => ({ source, leads }))
    .sort((a, b) => b.leads - a.leads);
  const topCampaigns = Array.from(campaignKeys.values())
    .map(({ campaign, source, medium, count }) => ({ campaign, source, medium, leads: count }))
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 20);

  // ---- Ratings ----
  const ratingCounts = new Map<string, number>();
  const ratingsBySourceMap = new Map<string, Map<string, number>>();
  contacts.forEach((c) => {
    ratingCounts.set(c.rating, (ratingCounts.get(c.rating) || 0) + 1);
    if (!ratingsBySourceMap.has(c.sourceName)) ratingsBySourceMap.set(c.sourceName, new Map());
    const m = ratingsBySourceMap.get(c.sourceName)!;
    m.set(c.rating, (m.get(c.rating) || 0) + 1);
  });
  const total = contacts.length || 1;
  const ratingDistribution = Array.from(ratingCounts.entries())
    .map(([rating, count]) => ({
      rating,
      count,
      color: RATING_COLORS[rating] || '#999999',
      percentage: Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);
  const salesPipeline = PIPELINE_STAGES.map((stage) => ({
    stage,
    count: ratingCounts.get(stage) || 0,
    color: RATING_COLORS[stage] || '#999999',
  }));
  const ratingsBySource: Record<string, { rating: string; count: number }[]> = {};
  for (const [sourceName, ratingsMap] of ratingsBySourceMap.entries()) {
    ratingsBySource[sourceName] = Array.from(ratingsMap.entries())
      .map(([rating, count]) => ({ rating, count }))
      .sort((a, b) => b.count - a.count);
  }

  // ---- Available sources for FilterPanel ----
  const availableSources = Array.from(
    new Set(
      payload.contacts
        .map((c) => c.sourceName)
        .filter((n) => !n.toLowerCase().includes('agent import')),
    ),
  ).sort((a, b) => a.localeCompare(b));

  return {
    keyMetrics: {
      totalLeads: currentTotal,
      trend: { value: Math.abs(trendValue), direction: trendDirection },
      unfilteredTotal: dateFiltered.length,
    },
    leadSources,
    leadGrowth,
    leadGrowthBySource,
    leadsByLocation,
    leadsByZipCode,
    agentDistribution,
    trafficSources,
    topCampaigns,
    ratingDistribution,
    salesPipeline,
    ratingsBySource,
    availableSources,
    activeFilters: {
      excludedSources: filters.excludedSources,
      excludeAgents: filters.excludeAgents,
      excludeNoSource: filters.excludeNoSource,
      filteredOutCount: dateFiltered.length - currentTotal,
    },
  };
}
