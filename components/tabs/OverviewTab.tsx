'use client';

import { useState, useEffect } from 'react';
import { Users, Activity, TrendingUp, Target, Award, Loader2 } from 'lucide-react';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import StatCard, { Trend } from '../StatCard';
import { DateRange } from '../DateRangePicker';
import InfoTooltip from '../InfoTooltip';

interface DashboardData {
  keyMetrics: {
    totalContacts: number;
    activeContacts: number;
    totalInteractions: number;
    avgInteractionsPerContact: number;
    agentPercentage: number;
    emailCoverage: number;
    responsiveness: string;
  };
  trends: {
    activeContacts: Trend;
    totalInteractions: Trend;
    avgInteractionsPerContact: Trend;
  };
  interactionTypeBreakdown: Array<{ id: number; name: string; value: number }>;
  teamPerformance: Array<{ id: number; name: string; interactions: number; percentage: number }>;
  leadSources: Array<{ name: string; contacts: number; quality: number; engagement: number; email: number }>;
  activityTimeline: Array<{ date: string; interactions: number; emails: number; calls: number }>;
  topContacts: Array<{ id: number; name: string; interactions: number }>;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface OverviewTabProps {
  dateRange: DateRange;
}

export default function OverviewTab({ dateRange }: OverviewTabProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      });
      const response = await fetch(`/api/dashboard?${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch dashboard data');
      }

      const dashboardData = await response.json();
      setData(dashboardData);
      setError(null);
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
      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          title="Total Contacts"
          value={data.keyMetrics.totalContacts}
          subtitle={`${data.keyMetrics.agentPercentage}% agents`}
          color="#3b82f6"
        />
        <StatCard
          icon={Activity}
          title="Active Contacts"
          value={data.keyMetrics.activeContacts}
          subtitle={`${data.keyMetrics.totalContacts > 0
            ? Math.round((data.keyMetrics.activeContacts / data.keyMetrics.totalContacts) * 100)
            : 0}% of total`}
          color="#10b981"
          trend={data.trends.activeContacts}
        />
        <StatCard
          icon={TrendingUp}
          title="Interactions"
          value={data.keyMetrics.totalInteractions}
          subtitle="In selected period"
          color="#f59e0b"
          trend={data.trends.totalInteractions}
        />
        <StatCard
          icon={Target}
          title="Avg Per Contact"
          value={data.keyMetrics.avgInteractionsPerContact}
          subtitle="Interactions"
          color="#8b5cf6"
          trend={data.trends.avgInteractionsPerContact}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Timeline */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            <Activity className="w-5 h-5 text-blue-600" />
            Recent Activity
            <InfoTooltip
              title="Recent Activity Timeline"
              description="Total interactions (emails + calls + texts) per day for the selected date range. Shows communication volume trends over time. Helps identify busy periods and engagement patterns."
            />
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.activityTimeline}>
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
              <Legend />
              <Line type="monotone" dataKey="interactions" stroke="#3b82f6" strokeWidth={3} name="Total" />
              <Line type="monotone" dataKey="emails" stroke="#10b981" strokeWidth={2} name="Emails" />
              <Line type="monotone" dataKey="calls" stroke="#f59e0b" strokeWidth={2} name="Calls" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Interaction Types */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Interaction Type Distribution
            <InfoTooltip
              title="Interaction Type Distribution"
              description="Breakdown of all interactions by type (Email Out, Phone Call, Email In, etc.) for the selected period. Helps identify primary communication channels and contact preferences."
            />
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.interactionTypeBreakdown}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={(entry) => `${entry.name}: ${entry.value}`}
                labelLine={false}
              >
                {data.interactionTypeBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Lead Sources */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            <Users className="w-5 h-5 text-blue-600" />
            Lead Sources
            <InfoTooltip
              title="Lead Sources"
              description="Where active contacts came from during the selected period (Website, Referral, Direct, etc.). Based on estimated distribution since direct source data is not available from the API. Shows relative volumes by source."
            />
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.leadSources.slice(0, 5)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="contacts" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Contacts */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            <Award className="w-5 h-5 text-blue-600" />
            Most Engaged Contacts
            <InfoTooltip
              title="Most Engaged Contacts"
              description="Contacts with the highest interaction count in the selected period. Higher engagement typically indicates hotter leads, active deals, or high-priority relationships. Use this to prioritize follow-ups."
            />
          </h3>
          <div className="space-y-3">
            {data.topContacts.slice(0, 8).map((contact, idx) => (
              <div
                key={contact.id}
                className="flex items-center justify-between p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                      idx === 0
                        ? 'bg-yellow-500'
                        : idx === 1
                        ? 'bg-gray-400'
                        : idx === 2
                        ? 'bg-orange-600'
                        : 'bg-blue-500'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-white">{contact.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">ID: {contact.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${Math.min((contact.interactions / 5) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-blue-600 w-8 text-right">
                    {contact.interactions}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
