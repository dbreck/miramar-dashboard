'use client';

import { useState, useEffect } from 'react';
import { Users, Loader2, TrendingUp, TrendingDown, MapPin, Filter } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { DateRange } from '../DateRangePicker';
import InfoTooltip from '../InfoTooltip';
import { useFilters } from '@/lib/filter-context';

interface DashboardData {
  keyMetrics: {
    totalLeads: number;
    trend: {
      value: number;
      direction: 'up' | 'down' | 'neutral';
    };
    unfilteredTotal?: number;
  };
  leadSources: Array<{ name: string; contacts: number }>;
  leadGrowth: Array<{ date: string; leads: number }>;
  leadGrowthBySource: Record<string, Array<{ date: string; leads: number }>>;
  leadsByLocation: Array<{ location: string; leads: number }>;
  leadsByZipCode: Array<{ zipCode: string; leads: number }>;
  agentDistribution: Array<{ category: string; count: number }>;
  availableSources?: string[];
  activeFilters?: {
    excludedSources: string[];
    excludeAgents: boolean;
    excludeNoSource: boolean;
    filteredOutCount: number;
  };
}

interface OverviewTabProps {
  dateRange: DateRange;
}

export default function OverviewTab({ dateRange }: OverviewTabProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string>('All');

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
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, excludedSourcesKey, excludeAgents, excludeNoSource]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch dashboard data');
      }

      const dashboardData = await response.json();
      setData(dashboardData);
      setError(null);

      // Update available sources in filter context
      if (dashboardData.availableSources) {
        setAvailableSources(dashboardData.availableSources);
      }
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
          <p className="text-gray-600 dark:text-gray-400">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">Error Loading Data</h3>
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={fetchDashboardData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Lead Scorecards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total Leads */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Total Leads
              {data.activeFilters?.filteredOutCount && data.activeFilters.filteredOutCount > 0 && (
                <span className="ml-1 text-xs text-blue-500">(filtered)</span>
              )}
            </h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {data.keyMetrics.totalLeads}
          </p>
          <div className="flex items-center gap-2 mt-2">
            {data.keyMetrics.trend.direction !== 'neutral' && (
              <div className={`flex items-center gap-1 ${
                data.keyMetrics.trend.direction === 'up'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {data.keyMetrics.trend.direction === 'up' ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span className="font-semibold text-sm">{data.keyMetrics.trend.value}%</span>
              </div>
            )}
            {data.activeFilters?.filteredOutCount && data.activeFilters.filteredOutCount > 0 && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Filter className="w-3 h-3" />
                <span>{data.activeFilters.filteredOutCount} hidden</span>
              </div>
            )}
          </div>
        </div>

        {/* Individual Source Cards - Show top 5 */}
        {data.leadSources.slice(0, 5).map((source, idx) => (
          <div key={source.name} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                idx === 0 ? 'bg-purple-500' :
                idx === 1 ? 'bg-green-500' :
                idx === 2 ? 'bg-orange-500' :
                idx === 3 ? 'bg-pink-500' :
                'bg-cyan-500'
              }`}>
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{source.name}</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {source.contacts}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {Math.round((source.contacts / data.keyMetrics.totalLeads) * 100)}% of total
            </p>
          </div>
        ))}
      </div>

      {/* Charts Grid - Row 1: Lead Sources + Agent Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Sources */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            <Users className="w-5 h-5 text-blue-600" />
            Lead Sources
            <InfoTooltip
              title="Lead Sources"
              description="Total leads created in the selected date range, grouped by registration source. Shows where your leads are coming from (Website, Referrals, Facebook, etc.)"
            />
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.leadSources} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" stroke="#6b7280" />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#6b7280"
                width={200}
                style={{ fontSize: '12px' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
                formatter={(value: any, name: any, props: any) => [value, props.payload.name]}
              />
              <Bar dataKey="contacts" fill="#3b82f6" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Agent Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            <Users className="w-5 h-5 text-blue-600" />
            Agent Distribution
            <InfoTooltip
              title="Agent vs Non-Agent Breakdown"
              description="Breakdown of all leads created in the selected date range by agent status. Shows total leads, contacts marked as agents, and non-agent contacts."
            />
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.agentDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="category" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Lead Growth Over Time - Full Width */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Lead Growth Over Time
            </h3>
            <InfoTooltip
              title="Lead Growth Timeline"
              description="Number of new leads created per day during the selected date range. Filter by source to see growth for specific channels."
            />
          </div>
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Sources</option>
            {data.leadSources.map((source) => (
              <option key={source.name} value={source.name}>
                {source.name}
              </option>
            ))}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={selectedSource === 'All' ? data.leadGrowth : (data.leadGrowthBySource[selectedSource] || [])}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
            <XAxis dataKey="date" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
            />
            <Line type="monotone" dataKey="leads" stroke="#3b82f6" strokeWidth={3} name="New Leads" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Location Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads by Area Code */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            <MapPin className="w-5 h-5 text-blue-600" />
            Leads by Location (Area Code)
            <InfoTooltip
              title="Geographic Distribution"
              description="Location of leads based on phone area codes. Shows which cities/regions your leads are calling from, sorted by volume."
            />
          </h3>
          <ResponsiveContainer width="100%" height={500}>
            <BarChart data={data.leadsByLocation.slice(0, 15)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" stroke="#6b7280" />
              <YAxis
                type="category"
                dataKey="location"
                stroke="#6b7280"
                width={160}
                style={{ fontSize: '12px' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="leads" fill="#10b981" radius={[0, 8, 8, 0]} name="Leads" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Leads by ZIP Code */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            <MapPin className="w-5 h-5 text-blue-600" />
            Leads by Location (ZIP Code)
            <InfoTooltip
              title="ZIP Code Distribution"
              description="Location of leads based on postal/ZIP codes. Shows the most common ZIP codes where your leads are located, sorted by volume."
            />
          </h3>
          <ResponsiveContainer width="100%" height={500}>
            <BarChart data={data.leadsByZipCode.slice(0, 15)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" stroke="#6b7280" />
              <YAxis
                type="category"
                dataKey="zipCode"
                stroke="#6b7280"
                width={160}
                style={{ fontSize: '12px' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="leads" fill="#10b981" radius={[0, 8, 8, 0]} name="Leads" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
