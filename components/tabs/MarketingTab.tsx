'use client';

import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Filter } from 'lucide-react';
import LoadingProgress from '../LoadingProgress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DateRange } from '@/components/DateRangePicker';
import { TrafficSource, Campaign } from '@/lib/types';
import { useFilters } from '@/lib/filter-context';

interface MarketingData {
  trafficSources: TrafficSource[];
  topCampaigns: Campaign[];
  activeFilters?: {
    filteredOutCount: number;
  };
}

export default function MarketingTab({ dateRange }: { dateRange: DateRange }) {
  const [data, setData] = useState<MarketingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadStartTime, setLoadStartTime] = useState<number>(Date.now());

  const {
    excludedSources,
    excludeAgents,
    excludeNoSource,
    setAvailableSources,
    getFilterParams,
  } = useFilters();

  // Stringify for stable dependency (array reference changes on context updates)
  const excludedSourcesKey = JSON.stringify(excludedSources);

  useEffect(() => {
    const fetchData = async () => {
      setLoadStartTime(Date.now());
      setLoading(true);
      try {
        const params = new URLSearchParams({
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString(),
        });

        // Add filter parameters
        const filterParams = getFilterParams();
        filterParams.forEach((value, key) => {
          params.set(key, value);
        });

        const response = await fetch(`/api/dashboard?${params}`);
        const result = await response.json();

        setData({
          trafficSources: result.trafficSources || [],
          topCampaigns: result.topCampaigns || [],
          activeFilters: result.activeFilters,
        });

        // Update available sources in filter context
        if (result.availableSources) {
          setAvailableSources(result.availableSources);
        }
      } catch (error) {
        console.error('Error fetching marketing data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, excludedSourcesKey, excludeAgents, excludeNoSource]);

  if (loading) {
    return <LoadingProgress startTime={loadStartTime} />;
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">No data available</div>
      </div>
    );
  }

  // Colors for the bar chart
  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#ef4444', '#06b6d4'];

  return (
    <div className="space-y-6">
      {/* Traffic Sources Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Traffic Sources</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Leads by UTM source</p>
            </div>
          </div>
          {data.activeFilters?.filteredOutCount && data.activeFilters.filteredOutCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
              <Filter className="w-3 h-3" />
              <span>{data.activeFilters.filteredOutCount} contacts filtered</span>
            </div>
          )}
        </div>

        {data.trafficSources.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p>No UTM tracking data available yet.</p>
            <p className="text-sm mt-2">UTM parameters will appear here once contacts are captured with tracking codes.</p>
          </div>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.trafficSources} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis
                  dataKey="source"
                  className="text-xs fill-gray-500 dark:fill-gray-300"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis className="text-xs fill-gray-500 dark:fill-gray-300" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Bar dataKey="leads" radius={[8, 8, 0, 0]}>
                  {data.trafficSources.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Top Campaigns Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
            <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Top Campaigns</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Campaign performance by source and medium</p>
          </div>
        </div>

        {data.topCampaigns.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p>No campaign data available yet.</p>
            <p className="text-sm mt-2">Campaign tracking will appear here once UTM parameters are captured.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Campaign</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Source</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Medium</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Leads</th>
                </tr>
              </thead>
              <tbody>
                {data.topCampaigns.map((campaign, index) => (
                  <tr
                    key={index}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white font-medium">
                      {campaign.campaign}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {campaign.source}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                        {campaign.medium}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-right font-semibold text-gray-900 dark:text-white">
                      {campaign.leads}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
