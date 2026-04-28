'use client';

import { useEffect, useMemo } from 'react';
import { Star, Target, BarChart3, Users, RefreshCw } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { DateRange } from '../DateRangePicker';
import InfoTooltip from '../InfoTooltip';
import { useFilters } from '@/lib/filter-context';
import { useExecutiveSummary } from '@/lib/use-executive-summary';
import { buildDashboardView } from '@/lib/dashboard-snapshot';

interface RatingItem {
  rating: string;
  count: number;
  color: string;
  percentage: number;
}

interface PipelineStage {
  stage: string;
  count: number;
  color: string;
}

interface RatingsData {
  keyMetrics: {
    totalLeads: number;
  };
  ratingDistribution: RatingItem[];
  salesPipeline: PipelineStage[];
  ratingsBySource: Record<string, Array<{ rating: string; count: number }>>;
  availableSources?: string[];
}

interface RatingsTabProps {
  dateRange: DateRange;
  refreshTrigger?: number;
  onDataStatus?: (isCached: boolean, lastFetchedAt: number | null, loading: boolean) => void;
}

const SCORECARD_RATINGS = [
  { key: 'Hot', accent: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400' },
  { key: 'Warm', accent: 'bg-orange-500', textColor: 'text-orange-600 dark:text-orange-400' },
  { key: 'Reservation Holder', accent: 'bg-blue-500', textColor: 'text-blue-600 dark:text-blue-400' },
  { key: 'Contract Holder', accent: 'bg-purple-500', textColor: 'text-purple-600 dark:text-purple-400' },
];

export default function RatingsTab({ dateRange, refreshTrigger, onDataStatus }: RatingsTabProps) {
  const {
    excludedSources,
    excludeAgents,
    excludeNoSource,
    setAvailableSources,
  } = useFilters();

  const { data: payload, loading, error, isCached, lastFetchedAt, notFound } =
    useExecutiveSummary(refreshTrigger ?? 0);

  const data = useMemo(() => {
    if (!payload) return null;
    return buildDashboardView(
      payload,
      { start: dateRange.start, end: dateRange.end },
      { excludedSources, excludeAgents, excludeNoSource },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, dateRange.start.getTime(), dateRange.end.getTime(), excludedSources.join('|'), excludeAgents, excludeNoSource]);

  // Report data status to parent
  useEffect(() => {
    onDataStatus?.(isCached, lastFetchedAt, loading);
  }, [isCached, lastFetchedAt, loading, onDataStatus]);

  // Push available sources to filter panel
  useEffect(() => {
    if (data?.availableSources) setAvailableSources(data.availableSources);
  }, [data, setAvailableSources]);

  // Prepare ratings by source data for the stacked chart - top 8 sources
  const ratingsBySourceData = useMemo(() => {
    if (!data?.ratingsBySource) return [];
    const entries = Object.entries(data.ratingsBySource as Record<string, Array<{ rating: string; count: number }>>);
    // Sort by total count descending, take top 8
    const sorted = entries
      .map(([source, ratings]) => {
        const total = ratings.reduce((sum, r) => sum + r.count, 0);
        const row: Record<string, any> = { source, total };
        ratings.forEach((r) => {
          row[r.rating] = r.count;
        });
        return row;
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
    return sorted;
  }, [data?.ratingsBySource]);

  // Collect unique rating names from ratingsBySource for stacked bars
  const stackedRatingKeys = useMemo(() => {
    if (!data?.ratingsBySource) return [];
    const keys = new Set<string>();
    Object.values(data.ratingsBySource as Record<string, Array<{ rating: string; count: number }>>).forEach((ratings) => {
      ratings.forEach((r) => keys.add(r.rating));
    });
    return Array.from(keys);
  }, [data?.ratingsBySource]);

  // Build a color map from ratingDistribution
  const ratingColorMap = useMemo(() => {
    if (!data?.ratingDistribution) return new Map<string, string>();
    const map = new Map<string, string>();
    (data.ratingDistribution as RatingItem[]).forEach((item) => {
      map.set(item.rating, item.color);
    });
    return map;
  }, [data?.ratingDistribution]);

  if (loading && !data) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center">
        <RefreshCw className="w-6 h-6 text-blue-600 mx-auto mb-3 animate-spin" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading snapshot…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">Error Loading Data</h3>
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center">
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          {notFound ? 'No snapshot deployed yet.' : 'No data loaded yet.'}
        </p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
          Run <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono text-xs">npm run snapshot</code>{' '}
          locally and push, or wait for the next 6am ET cron.
        </p>
      </div>
    );
  }

  const ratingsData = data as RatingsData;
  const { ratingDistribution, salesPipeline } = ratingsData;

  // Helper to find a rating count
  const getRatingCount = (name: string): number => {
    const item = ratingDistribution.find((r) => r.rating === name);
    return item?.count ?? 0;
  };

  // Sort distribution by count for the chart
  const sortedDistribution = [...ratingDistribution].sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      {/* Scorecard Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Contacts */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Contacts</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {ratingsData.keyMetrics.totalLeads}
          </p>
        </div>

        {/* Rating Scorecards */}
        {SCORECARD_RATINGS.map((card) => (
          <div key={card.key} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-lg ${card.accent} flex items-center justify-center`}>
                <Star className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{card.key}</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {getRatingCount(card.key)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {ratingsData.keyMetrics.totalLeads > 0
                ? `${Math.round((getRatingCount(card.key) / ratingsData.keyMetrics.totalLeads) * 100)}% of total`
                : '0% of total'}
            </p>
          </div>
        ))}
      </div>

      {/* Sales Pipeline Funnel - Full Width */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
          <Target className="w-5 h-5 text-blue-600" />
          Sales Pipeline
          <InfoTooltip
            title="Sales Pipeline"
            description="Progression of contacts through the sales funnel: New to Warm to Hot to Reservation Holder to Contract Holder. Shows how many contacts are at each stage."
          />
        </h3>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={salesPipeline} layout="vertical" barSize={40}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="stage" hide />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#fff',
              }}
              formatter={(value: any, name: any, props: any) => [value, props.payload.stage]}
            />
            <Bar dataKey="count" radius={[4, 4, 4, 4]}>
              {salesPipeline.map((entry, index) => (
                <Cell key={`pipeline-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* Pipeline labels below the chart */}
        <div className="flex justify-between mt-3 px-2">
          {salesPipeline.map((stage) => (
            <div key={stage.stage} className="text-center flex-1">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{stage.stage}</span>
              </div>
              <span className="text-lg font-bold text-gray-900 dark:text-white">{stage.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Row: Distribution + By Source */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rating Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Rating Distribution
            <InfoTooltip
              title="Rating Distribution"
              description="Breakdown of all contacts by their current rating. Shows the count and percentage for each rating category, sorted by volume."
            />
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(300, sortedDistribution.length * 40)}>
            <BarChart data={sortedDistribution} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" stroke="#9ca3af" />
              <YAxis
                type="category"
                dataKey="rating"
                stroke="#9ca3af"
                width={140}
                style={{ fontSize: '12px' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#fff',
                }}
                formatter={(value: any, name: any, props: any) => [
                  `${value} (${props.payload.percentage}%)`,
                  props.payload.rating,
                ]}
              />
              <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                {sortedDistribution.map((entry, index) => (
                  <Cell key={`dist-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Ratings by Lead Source */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            <Star className="w-5 h-5 text-blue-600" />
            Ratings by Lead Source
            <InfoTooltip
              title="Ratings by Lead Source"
              description="Shows which lead sources produce contacts at each rating level. Helps identify which channels bring in the highest-quality leads (Hot, Warm, etc.)."
            />
          </h3>
          {ratingsBySourceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(300, ratingsBySourceData.length * 45)}>
              <BarChart data={ratingsBySourceData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#9ca3af" />
                <YAxis
                  type="category"
                  dataKey="source"
                  stroke="#9ca3af"
                  width={140}
                  style={{ fontSize: '12px' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                {stackedRatingKeys.map((ratingKey) => (
                  <Bar
                    key={ratingKey}
                    dataKey={ratingKey}
                    stackId="ratings"
                    fill={ratingColorMap.get(ratingKey) || '#6b7280'}
                    name={ratingKey}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              No lead source data available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
