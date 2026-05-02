'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  Calendar,
  TrendingUp,
  Building2,
  DollarSign,
  Banknote,
  Percent,
  Clock,
  Activity,
  Target,
  MapPin,
  Megaphone,
  Users,
  Flame,
  ThermometerSun,
  Award,
  Sparkles,
  History,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  Legend,
} from 'recharts';
import LeadGrowthChart from '@/components/executive-summary/LeadGrowthChart';
import { useExecutiveSummary } from '@/lib/use-executive-summary';
import { useRatingHistory } from '@/lib/use-rating-history';
import { ratingHistorySeries } from '@/lib/rating-history';
import {
  ExecDateRange,
  formatCurrency,
  formatNumber,
  geographyInRange,
  leadSourcesInRange,
  marketingInRange,
  reservationSourcesInRange,
  reservationsBuckets,
  reservationsInRange,
  summarize,
  qualityBySource,
  qualityByCampaign,
  cohortQuality,
  currentRatingDistribution,
  QUALITY_RATINGS,
} from '@/lib/executive-summary';

type Preset = 'all' | '7d' | '30d' | '90d' | 'ytd' | 'custom';

function fmtSnapshotEST(iso: string): string {
  // Convert UTC ISO to "Apr 28, 2026 11:59 PM EST"
  const d = new Date(iso);
  const eastern = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
  return eastern.format(d);
}

function fmtRelative(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr${hr === 1 ? '' : 's'} ago`;
  const days = Math.floor(hr / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function startOfDayUTC(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}
function endOfDayUTC(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}

export default function ExecutiveSummaryPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { data, loading, error, isCached, lastFetchedAt, notFound } =
    useExecutiveSummary(refreshTrigger);
  const { data: history, notFound: historyNotFound } =
    useRatingHistory(refreshTrigger);

  // Date filter state
  const [preset, setPreset] = useState<Preset>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // "Reservations Over Time" chart filter — exclude cancelled reservations when true
  const [reservationsActiveOnly, setReservationsActiveOnly] = useState<boolean>(false);
  // Reservation Detail table — independent All / Active toggle
  const [detailActiveOnly, setDetailActiveOnly] = useState<boolean>(false);
  // Lead Quality threshold toggles
  const [sourceMinN, setSourceMinN] = useState<number>(10);
  const [campaignMinN, setCampaignMinN] = useState<number>(5);

  // Effective range — bounded by snapshot's data window
  const range: ExecDateRange | null = useMemo(() => {
    if (!data?.meta.dataMinDate || !data?.meta.dataMaxDate) return null;
    const min = startOfDayUTC(new Date(data.meta.dataMinDate));
    const max = endOfDayUTC(new Date(data.meta.dataMaxDate));
    let start = min;
    let end = max;
    const now = max;
    if (preset === 'all') {
      start = min;
      end = max;
    } else if (preset === '7d') {
      start = startOfDayUTC(new Date(now.getTime() - 7 * 86400000));
      end = max;
    } else if (preset === '30d') {
      start = startOfDayUTC(new Date(now.getTime() - 30 * 86400000));
      end = max;
    } else if (preset === '90d') {
      start = startOfDayUTC(new Date(now.getTime() - 90 * 86400000));
      end = max;
    } else if (preset === 'ytd') {
      const y = new Date(now).getUTCFullYear();
      start = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0));
      end = max;
    } else if (preset === 'custom') {
      if (customStart) start = startOfDayUTC(new Date(customStart));
      if (customEnd) end = endOfDayUTC(new Date(customEnd));
    }
    // Clamp to dataset bounds
    if (start.getTime() < min.getTime()) start = min;
    if (end.getTime() > max.getTime()) end = max;
    if (start.getTime() > end.getTime()) start = end;
    return { start, end };
  }, [data, preset, customStart, customEnd]);

  useEffect(() => {
    if (data?.meta.dataMinDate && data?.meta.dataMaxDate) {
      // initialize custom inputs lazily
      if (!customStart) setCustomStart(new Date(data.meta.dataMinDate).toISOString().split('T')[0]);
      if (!customEnd) setCustomEnd(new Date(data.meta.dataMaxDate).toISOString().split('T')[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.meta.dataMinDate, data?.meta.dataMaxDate]);

  const minISO = data?.meta.dataMinDate
    ? new Date(data.meta.dataMinDate).toISOString().split('T')[0]
    : '';
  const maxISO = data?.meta.dataMaxDate
    ? new Date(data.meta.dataMaxDate).toISOString().split('T')[0]
    : '';

  const aggregates = useMemo(() => {
    if (!data || !range) return null;
    return summarize(data, range);
  }, [data, range]);

  const leadSources = useMemo(() => {
    if (!data || !range) return [];
    return leadSourcesInRange(data, range);
  }, [data, range]);

  const reservations = useMemo(() => {
    if (!data || !range) return [];
    return reservationsInRange(data, range);
  }, [data, range]);

  const resBuckets = useMemo(() => {
    if (!data || !range) return null;
    return reservationsBuckets(data, range, { activeOnly: reservationsActiveOnly });
  }, [data, range, reservationsActiveOnly]);

  const resBySource = useMemo(() => {
    if (!data || !range) return [];
    return reservationSourcesInRange(data, range);
  }, [data, range]);

  const geo = useMemo(() => {
    if (!data || !range) return { topCities: [], topStates: [] };
    return geographyInRange(data, range);
  }, [data, range]);

  const marketing = useMemo(() => {
    if (!data || !range) return { utmSources: [], utmMediums: [], topCampaigns: [] };
    return marketingInRange(data, range);
  }, [data, range]);

  // Lead quality aggregations — all derived from the same snapshot.
  const qualityBySrc = useMemo(() => {
    if (!data || !range) return { buckets: [], excluded: 0 };
    return qualityBySource(data, range, { minN: sourceMinN });
  }, [data, range, sourceMinN]);

  const qualityByCmp = useMemo(() => {
    if (!data || !range) return { buckets: [], excluded: 0 };
    return qualityByCampaign(data, range, { minN: campaignMinN });
  }, [data, range, campaignMinN]);

  const cohort = useMemo(() => {
    if (!data) return { rows: [], ratingsSeen: [] };
    return cohortQuality(data);
  }, [data]);

  const ratingDist = useMemo(() => {
    if (!data) return [];
    return currentRatingDistribution(data);
  }, [data]);

  const ratingTimeSeries = useMemo(() => {
    if (!history) return null;
    return ratingHistorySeries(history);
  }, [history]);

  const handleRefresh = () => setRefreshTrigger((n) => n + 1);

  // Empty / loading shell when there is no data yet
  if (!data) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <Header
            snapshotISO={null}
            lastFetchedAt={lastFetchedAt}
            isCached={isCached}
            loading={loading}
            onRefresh={handleRefresh}
            rangeLabel={null}
          />
          {loading && (
            <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-10 text-center">
              <RefreshCw className="w-8 h-8 text-blue-600 mx-auto mb-3 animate-spin" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Loading snapshot…
              </p>
            </div>
          )}
          {!loading && error && (
            <div className="mt-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 rounded-xl p-4 text-sm">
              {error}
            </div>
          )}
          {!loading && !error && notFound && (
            <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-10 text-center">
              <Activity className="w-10 h-10 text-blue-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                No snapshot deployed yet
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Run <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono text-xs">npm run snapshot</code>{' '}
                locally, then commit and push <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono text-xs">public/exec-summary-snapshot.json</code>.
                Once Vercel redeploys, the report appears here.
              </p>
              <button
                onClick={handleRefresh}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const rangeLabel =
    range &&
    `${new Date(range.start).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    })} – ${new Date(range.end).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    })}`;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <Header
          snapshotISO={data.meta.snapshotAt}
          lastFetchedAt={lastFetchedAt}
          isCached={isCached}
          loading={loading}
          onRefresh={handleRefresh}
          rangeLabel={rangeLabel}
        />

        {/* Date range filter */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Calendar className="w-4 h-4 text-blue-600" />
              Filter:
            </div>
            <div className="flex flex-wrap gap-2">
              {(['all', '7d', '30d', '90d', 'ytd', 'custom'] as Preset[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPreset(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    preset === p
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {p === 'all'
                    ? 'All time'
                    : p === 'ytd'
                    ? 'YTD'
                    : p === 'custom'
                    ? 'Custom'
                    : `Last ${p}`}
                </button>
              ))}
            </div>
            {preset === 'custom' && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <input
                  type="date"
                  value={customStart}
                  min={minISO}
                  max={customEnd || maxISO}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white text-xs"
                />
                <span className="text-gray-500">→</span>
                <input
                  type="date"
                  value={customEnd}
                  min={customStart || minISO}
                  max={maxISO}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white text-xs"
                />
              </div>
            )}
            <div className="lg:ml-auto text-xs text-gray-500 dark:text-gray-400">
              {rangeLabel} · {formatNumber(aggregates?.totalLeads || 0)} leads ·{' '}
              {formatNumber(aggregates?.totalReservations || 0)} reservations
            </div>
          </div>
        </div>

        {/* Scorecards */}
        {aggregates && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat
              icon={Users}
              label="Total Leads"
              value={formatNumber(aggregates.totalLeads)}
              accent="text-blue-600"
            />
            <Stat
              icon={Building2}
              label="Reservations"
              value={formatNumber(aggregates.totalReservations)}
              accent="text-emerald-600"
            />
            <Stat
              icon={DollarSign}
              label="Reservation Value"
              value={formatCurrency(aggregates.reservationValueCents)}
              accent="text-amber-600"
            />
            <Stat
              icon={Banknote}
              label="Deposits Collected"
              value={formatCurrency(aggregates.depositsCollectedCents)}
              accent="text-green-600"
              sub={`of ${formatCurrency(aggregates.depositsOwedCents)} owed`}
            />
            <Stat
              icon={Percent}
              label="Lead → Reservation"
              value={`${aggregates.conversionRate.toFixed(2)}%`}
              accent="text-purple-600"
            />
            <Stat
              icon={Clock}
              label="Avg Days to Reservation"
              value={
                aggregates.avgDaysToReservation > 0
                  ? `${Math.round(aggregates.avgDaysToReservation)} days`
                  : '—'
              }
              accent="text-rose-600"
            />
            <Stat
              icon={Activity}
              label="Active Pipeline"
              value={formatNumber(aggregates.activePipeline)}
              accent="text-indigo-600"
              sub="Hot + Warm + Reservation/Contract Holders"
            />
            <Stat
              icon={Target}
              label="Avg Reservation Price"
              value={
                aggregates.avgReservationPriceCents > 0
                  ? formatCurrency(aggregates.avgReservationPriceCents)
                  : '—'
              }
              accent="text-cyan-600"
            />
          </div>
        )}

        {/* Lead Growth Over Time */}
        {range && <LeadGrowthChart data={data} range={range} />}

        {/* Lead Sources */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Lead Sources
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({leadSources.length} sources)
            </span>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(280, leadSources.length * 28)}>
            <BarChart data={leadSources} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#9ca3af"
                width={200}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="leads" radius={[0, 6, 6, 0]}>
                {leadSources.map((s, i) => (
                  <Cell key={i} fill={s.isWebsite ? '#3b82f6' : '#10b981'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-blue-500" /> Website
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" /> Non-Website
            </span>
          </div>
        </div>

        {/* Lead Quality — current rating distribution scorecards */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-2 mb-1">
            <Award className="w-5 h-5 text-amber-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Lead Quality Snapshot
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              (current ratings · all-time, agents excluded)
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Today&apos;s state of every contact in the project. Funded ad spend
            should chase Hot + Warm signal at the source level below.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {QUALITY_RATINGS.map((r) => {
              const entry = ratingDist.find((d) => d.rating === r);
              const count = entry?.count || 0;
              const Icon =
                r === 'Hot'
                  ? Flame
                  : r === 'Warm'
                  ? ThermometerSun
                  : r === 'Reservation Holder'
                  ? Sparkles
                  : Award;
              const accent =
                r === 'Hot'
                  ? 'text-red-600'
                  : r === 'Warm'
                  ? 'text-orange-500'
                  : r === 'Reservation Holder'
                  ? 'text-blue-600'
                  : 'text-purple-600';
              return (
                <div
                  key={r}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 p-3"
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <Icon className={`w-3.5 h-3.5 ${accent}`} />
                    {r}
                  </div>
                  <div className="mt-1.5 text-2xl font-bold text-gray-900 dark:text-white">
                    {formatNumber(count)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lead Quality by Source */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Lead Quality by Source
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ({qualityBySrc.buckets.length} sources shown
                {qualityBySrc.excluded > 0
                  ? ` · ${qualityBySrc.excluded} below threshold`
                  : ''})
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>Min leads:</span>
              {[5, 10, 25].map((n) => (
                <button
                  key={n}
                  onClick={() => setSourceMinN(n)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    sourceMinN === n
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            % of each source&apos;s leads that reached Hot, Warm, Reservation
            Holder, or Contract Holder. Higher = better ad spend ROI.
          </p>
          {qualityBySrc.buckets.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 italic">
              No sources cleared the {sourceMinN}-lead threshold for this date range.
            </div>
          ) : (
            <ResponsiveContainer
              width="100%"
              height={Math.max(220, qualityBySrc.buckets.length * 32)}
            >
              <BarChart data={qualityBySrc.buckets} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  unit="%"
                  stroke="#9ca3af"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#9ca3af"
                  width={210}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: any, _name: any, props: any) => {
                    const b = props?.payload;
                    return [
                      `${Number(value).toFixed(1)}% (${b?.qualityCount}/${b?.total})`,
                      'Quality Rate',
                    ];
                  }}
                  labelFormatter={(label: any, payload: any) => {
                    const b = payload?.[0]?.payload;
                    if (!b) return label;
                    return `${label} · Hot ${b.hot} · Warm ${b.warm} · Res ${b.resHolder} · Contract ${b.contractHolder}`;
                  }}
                />
                <Bar dataKey="qualityRate" radius={[0, 6, 6, 0]} fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Lead Quality by Campaign */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Lead Quality by Campaign
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ({qualityByCmp.buckets.length} campaigns shown
                {qualityByCmp.excluded > 0
                  ? ` · ${qualityByCmp.excluded} below threshold`
                  : ''})
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>Min leads:</span>
              {[3, 5, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => setCampaignMinN(n)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    campaignMinN === n
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Same quality lens, scoped to attributed paid traffic
            (utm_source × utm_campaign). Direct/Unknown rows are omitted.
          </p>
          {qualityByCmp.buckets.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 italic">
              No campaigns cleared the {campaignMinN}-lead threshold for this date range.
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-2 py-2 font-medium">Campaign</th>
                    <th className="px-2 py-2 font-medium">UTM Source</th>
                    <th className="px-2 py-2 font-medium text-right">Leads</th>
                    <th className="px-2 py-2 font-medium text-right">Hot</th>
                    <th className="px-2 py-2 font-medium text-right">Warm</th>
                    <th className="px-2 py-2 font-medium text-right">Res</th>
                    <th className="px-2 py-2 font-medium text-right">Contract</th>
                    <th className="px-2 py-2 font-medium text-right">Quality %</th>
                  </tr>
                </thead>
                <tbody>
                  {qualityByCmp.buckets.map((b, i) => (
                    <tr
                      key={i}
                      className="border-b border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-200"
                    >
                      <td className="px-2 py-2 max-w-[260px] truncate" title={b.campaign}>
                        {b.campaign}
                      </td>
                      <td className="px-2 py-2">{b.source}</td>
                      <td className="px-2 py-2 text-right">{b.total}</td>
                      <td className="px-2 py-2 text-right">{b.hot || '—'}</td>
                      <td className="px-2 py-2 text-right">{b.warm || '—'}</td>
                      <td className="px-2 py-2 text-right">{b.resHolder || '—'}</td>
                      <td className="px-2 py-2 text-right">{b.contractHolder || '—'}</td>
                      <td className="px-2 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {b.qualityRate.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Cohort Quality — current ratings of contacts grouped by signup month */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-5 h-5 text-cyan-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Cohort Outcomes
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              (where each month&apos;s leads stand today)
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            For every month a contact entered the funnel, the stack shows
            their <em>current</em> rating. Useful for spotting cohorts that
            converted unusually well or that stalled.
          </p>
          {(() => {
            // Order: most "buyer-positive" at the bottom of the stack,
            // noise at the top. Use the snapshot's palette for fill colors.
            const palette = data.meta.ratingPalette || {};
            const RATING_ORDER = [
              'Contract Holder',
              'Reservation Holder',
              'Hot',
              'Warm',
              'New',
              'Cold',
              'Not Interested',
              'Not A Buyer',
              'Influencer',
              'Referral',
              'Agent',
              'CB Global Luxury Agent',
              'Team',
              'Legal',
              'Unrated',
            ];
            const present = RATING_ORDER.filter((r) =>
              cohort.ratingsSeen.includes(r),
            );
            // Append any unknown ratings we don't have in our order list
            cohort.ratingsSeen.forEach((r) => {
              if (!present.includes(r)) present.push(r);
            });

            const chartData = cohort.rows.map((row) => {
              const obj: Record<string, any> = { label: row.label };
              present.forEach((r) => {
                obj[r] = row.ratings[r] || 0;
              });
              return obj;
            });

            if (chartData.length === 0) {
              return (
                <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                  No contacts to bucket.
                </div>
              );
            }

            return (
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {present.map((r) => (
                    <Bar
                      key={r}
                      dataKey={r}
                      stackId="cohort"
                      fill={palette[r] || '#999999'}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            );
          })()}
        </div>

        {/* Rating Over Time — accumulates from rating-history.json */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-2 mb-1">
            <History className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Rating Distribution Over Time
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {ratingTimeSeries
                ? `(${ratingTimeSeries.rows.length} snapshot${ratingTimeSeries.rows.length === 1 ? '' : 's'})`
                : ''}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            A cron writes the current rating counts to a committed time-series
            file twice daily (6am and 6pm). The chart fills in as snapshots
            accumulate.
          </p>
          {historyNotFound ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 italic">
              No history file yet — run <code className="font-mono text-xs px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700">npm run snapshot</code> and commit to seed the first entry.
            </div>
          ) : !ratingTimeSeries ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 italic">
              Loading history…
            </div>
          ) : ratingTimeSeries.rows.length < 2 ? (
            <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 text-sm text-gray-600 dark:text-gray-400">
              Only one snapshot recorded so far ({ratingTimeSeries.rows[0]?.label}).
              The line chart fills in starting with the next cron run.
              Counts captured today:{' '}
              {QUALITY_RATINGS.map((r) => {
                const v = ratingTimeSeries.rows[0]?.[r];
                return (
                  <span key={r} className="mr-2">
                    <span className="font-semibold text-gray-900 dark:text-white">{r}</span>{' '}
                    {typeof v === 'number' ? v : 0}
                  </span>
                );
              })}
            </div>
          ) : (() => {
            const palette = data.meta.ratingPalette || {};
            // Show buyer-relevant ratings only — exclude high-noise non-buyer
            // categories that would dominate the y-axis.
            const NOISE = new Set(['Agent', 'CB Global Luxury Agent', 'Team', 'Legal', 'Unrated']);
            const series = ratingTimeSeries.ratings.filter((r) => !NOISE.has(r));
            return (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={ratingTimeSeries.rows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {series.map((r) => (
                    <Line
                      key={r}
                      type="monotone"
                      dataKey={r}
                      stroke={palette[r] || '#9ca3af'}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            );
          })()}
        </div>

        {/* Reservations section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 space-y-6">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Reservations
            </h3>
          </div>

          {/* Reservations over time */}
          {resBuckets && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Reservations Over Time
                </h4>
                <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-0.5">
                  <button
                    onClick={() => setReservationsActiveOnly(false)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      !reservationsActiveOnly
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setReservationsActiveOnly(true)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      reservationsActiveOnly
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    Active
                  </button>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={resBuckets.buckets.map((b) => ({
                    label: b.label,
                    reservations: resBuckets.counts[b.key] || 0,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} stroke="#9ca3af" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="reservations"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    name="Reservations"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Reservations by source */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reservations by Lead Source
            </h4>
            {resBySource.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                No reservations in this date range.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(180, resBySource.length * 36)}>
                <BarChart data={resBySource} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" stroke="#9ca3af" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="#9ca3af" width={200} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: any, name: string) => {
                      if (name === 'valueCents') return [formatCurrency(Number(value)), 'Total Value'];
                      return [value, 'Reservations'];
                    }}
                  />
                  <Bar dataKey="reservations" radius={[0, 6, 6, 0]} fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Reservation detail table */}
          {reservations.length > 0 && (() => {
            const detailRows = detailActiveOnly
              ? reservations.filter((r) => !r.cancelled)
              : reservations;
            const totals = detailRows.reduce(
              (acc, r) => {
                acc.priceCents += r.priceCents || 0;
                acc.depositsOwedCents += r.depositsOwedCents || 0;
                acc.depositsPaidCents += r.depositsPaidCents || 0;
                if (r.daysFromLead !== null && r.daysFromLead !== undefined) {
                  acc.daysSum += r.daysFromLead;
                  acc.daysCount += 1;
                }
                return acc;
              },
              { priceCents: 0, depositsOwedCents: 0, depositsPaidCents: 0, daysSum: 0, daysCount: 0 },
            );
            const avgDays = totals.daysCount > 0 ? Math.round(totals.daysSum / totals.daysCount) : null;
            return (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Reservation Detail ({detailRows.length})
                </h4>
                <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-0.5">
                  <button
                    onClick={() => setDetailActiveOnly(false)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      !detailActiveOnly
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setDetailActiveOnly(true)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      detailActiveOnly
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    Active
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto -mx-2">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="px-2 py-2 font-medium">Reserved</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                      <th className="px-2 py-2 font-medium">Buyer</th>
                      <th className="px-2 py-2 font-medium">Source</th>
                      <th className="px-2 py-2 font-medium">UTM Source</th>
                      <th className="px-2 py-2 font-medium">UTM Medium</th>
                      <th className="px-2 py-2 font-medium">UTM Campaign</th>
                      <th className="px-2 py-2 font-medium text-right">Price</th>
                      <th className="px-2 py-2 font-medium text-right">Deposits Owed</th>
                      <th className="px-2 py-2 font-medium text-right">Deposits Paid</th>
                      <th className="px-2 py-2 font-medium text-right">Days from Lead</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows
                      .slice()
                      .sort((a, b) => {
                        const ad = new Date(a.reservedAt || a.createdAt || 0).getTime();
                        const bd = new Date(b.reservedAt || b.createdAt || 0).getTime();
                        return bd - ad;
                      })
                      .map((r) => (
                        <tr
                          key={r.id}
                          className="border-b border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-200"
                        >
                          <td className="px-2 py-2 whitespace-nowrap">
                            {(r.reservedAt || r.createdAt) &&
                              new Date(r.reservedAt || r.createdAt!).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: '2-digit',
                              })}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            {r.cancelled ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                                Cancelled
                              </span>
                            ) : r.statusValue ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                {r.statusValue}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">{r.buyerName || '—'}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{r.sourceName}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{r.utmSource || '—'}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{r.utmMedium || '—'}</td>
                          <td
                            className="px-2 py-2 max-w-[220px] truncate"
                            title={r.utmCampaign || ''}
                          >
                            {r.utmCampaign || '—'}
                          </td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">
                            {r.priceCents > 0 ? formatCurrency(r.priceCents) : '—'}
                          </td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">
                            {r.depositsOwedCents > 0 ? formatCurrency(r.depositsOwedCents) : '—'}
                          </td>
                          <td className="px-2 py-2 text-right whitespace-nowrap text-emerald-700 dark:text-emerald-400">
                            {r.depositsPaidCents > 0 ? formatCurrency(r.depositsPaidCents) : '—'}
                          </td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">
                            {r.daysFromLead !== null ? r.daysFromLead : '—'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 font-semibold text-gray-900 dark:text-white">
                      <td className="px-2 py-2 whitespace-nowrap">Totals</td>
                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400 font-normal">
                        {detailRows.length} {detailRows.length === 1 ? 'reservation' : 'reservations'}
                      </td>
                      <td className="px-2 py-2">—</td>
                      <td className="px-2 py-2">—</td>
                      <td className="px-2 py-2">—</td>
                      <td className="px-2 py-2">—</td>
                      <td className="px-2 py-2">—</td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        {totals.priceCents > 0 ? formatCurrency(totals.priceCents) : '—'}
                      </td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        {totals.depositsOwedCents > 0 ? formatCurrency(totals.depositsOwedCents) : '—'}
                      </td>
                      <td className="px-2 py-2 text-right whitespace-nowrap text-emerald-700 dark:text-emerald-400">
                        {totals.depositsPaidCents > 0 ? formatCurrency(totals.depositsPaidCents) : '—'}
                      </td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        {avgDays !== null ? `${avgDays} avg` : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            );
          })()}
        </div>

        {/* Geography */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top Cities</h3>
            </div>
            {geo.topCities.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                No city data available for this range.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(260, geo.topCities.length * 26)}>
                <BarChart data={geo.topCities} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" allowDecimals={false} stroke="#9ca3af" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={160} stroke="#9ca3af" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="leads" fill="#10b981" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-cyan-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top States</h3>
            </div>
            {geo.topStates.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                No state data available for this range.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(260, geo.topStates.length * 26)}>
                <BarChart data={geo.topStates} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" allowDecimals={false} stroke="#9ca3af" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} stroke="#9ca3af" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="leads" fill="#06b6d4" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Marketing */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 space-y-6">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Marketing Attribution
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                UTM Source
              </h4>
              <ResponsiveContainer width="100%" height={Math.max(220, marketing.utmSources.length * 28)}>
                <BarChart data={marketing.utmSources.slice(0, 12)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" allowDecimals={false} stroke="#9ca3af" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} stroke="#9ca3af" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="leads" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                UTM Medium
              </h4>
              <ResponsiveContainer width="100%" height={Math.max(220, marketing.utmMediums.length * 28)}>
                <BarChart data={marketing.utmMediums.slice(0, 12)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" allowDecimals={false} stroke="#9ca3af" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} stroke="#9ca3af" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="leads" fill="#ec4899" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Top 10 Campaigns
            </h4>
            <div className="overflow-x-auto -mx-2">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-2 py-2 font-medium">Campaign</th>
                    <th className="px-2 py-2 font-medium">Source</th>
                    <th className="px-2 py-2 font-medium">Medium</th>
                    <th className="px-2 py-2 font-medium text-right">Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {marketing.topCampaigns.map((c, i) => (
                    <tr
                      key={i}
                      className="border-b border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-200"
                    >
                      <td className="px-2 py-2 truncate max-w-[280px]">{c.campaign}</td>
                      <td className="px-2 py-2">{c.source}</td>
                      <td className="px-2 py-2">{c.medium}</td>
                      <td className="px-2 py-2 text-right font-medium">{c.leads}</td>
                    </tr>
                  ))}
                  {marketing.topCampaigns.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-2 py-3 text-gray-500 italic">
                        No campaigns in this date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function Header({
  snapshotISO,
  lastFetchedAt,
  isCached,
  loading,
  onRefresh,
  rangeLabel,
}: {
  snapshotISO: string | null;
  lastFetchedAt: number | null;
  isCached: boolean;
  loading: boolean;
  onRefresh: () => void;
  rangeLabel: string | null;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Executive Summary
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            All-time Mira Mar Sarasota performance
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {snapshotISO && (
              <span className="text-gray-700 dark:text-gray-300">
                <span className="font-medium">Data through:</span>{' '}
                {fmtSnapshotEST(snapshotISO)}
              </span>
            )}
            {lastFetchedAt && (
              <span className="text-gray-500 dark:text-gray-400">
                {isCached ? 'Cached' : 'Refreshed'} {fmtRelative(lastFetchedAt)}
              </span>
            )}
            {rangeLabel && (
              <span className="text-gray-500 dark:text-gray-400">
                <span className="font-medium">Showing:</span> {rangeLabel}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing…' : 'Refresh Report'}
        </button>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  accent,
  sub,
}: {
  icon: any;
  label: string;
  value: string;
  accent: string;
  sub?: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        <Icon className={`w-3.5 h-3.5 ${accent}`} />
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{sub}</div>}
    </div>
  );
}
