'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Users, Target, Award, Zap, Loader2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import StatCard from '../StatCard';
import { DateRange } from '../DateRangePicker';
import InfoTooltip from '../InfoTooltip';

interface PipelineData {
  totalContacts: number;
  engagedContacts: number;
  activePipeline: number;
  reservations: number;
  engagementRate: number;
  leadSources: Array<{
    name: string;
    contacts: number;
    hot: number;
    warm: number;
    reservations: number;
    quality: number;
    color: string;
  }>;
  funnelData: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  ratingDistribution: Array<{
    name: string;
    value: number;
    color: string;
    percentage: number;
  }>;
  sourcePerformance: Array<{
    source: string;
    contacts: number;
    conversionRate: number;
    quality: number;
    hotWarmCount: number;
  }>;
  websiteLeads: {
    contacts: number;
    quality: number;
    conversionRate: number;
  };
}

interface PipelineTabProps {
  dateRange: DateRange;
}

const LEAD_SOURCE_COLORS: Record<string, string> = {
  'Unknown': '#94a3b8',
  'Website': '#3b82f6',
  'Realtor Referral': '#8b5cf6',
  'Friend/Family': '#10b981',
  'Facebook': '#f59e0b',
  'Walk-in': '#ec4899',
};

export default function PipelineTab({ dateRange }: PipelineTabProps) {
  const [data, setData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPipelineData();
  }, [dateRange]);

  const fetchPipelineData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      });
      const response = await fetch(`/api/dashboard?${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch pipeline data');
      }

      const dashboardData = await response.json();
      setData(dashboardData.pipelineData);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching pipeline data:', err);
      setError(err.message || 'Failed to load pipeline data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
          <p className="text-gray-600 dark:text-gray-400">Loading pipeline data...</p>
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
          onClick={fetchPipelineData}
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
      {/* Pipeline Status Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <p className="font-semibold text-blue-900 dark:text-blue-100">Pipeline Status: Active</p>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {data.engagementRate}% engagement • {data.activePipeline} active prospects • Website: {data.websiteLeads.contacts} leads ({((data.websiteLeads.contacts / data.totalContacts) * 100).toFixed(1)}%) • {data.websiteLeads.conversionRate}% conversion
            </p>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          icon={Users}
          title="Total Database"
          value={data.totalContacts}
          subtitle={`${data.engagedContacts} engaged`}
          color="#3b82f6"
        />
        <StatCard
          icon={TrendingUp}
          title="Active Pipeline"
          value={data.activePipeline}
          subtitle="Real prospects"
          color="#10b981"
        />
        <StatCard
          icon={Target}
          title="Website Leads"
          value={data.websiteLeads.contacts}
          subtitle={`${((data.websiteLeads.contacts / data.totalContacts) * 100).toFixed(1)}% of database`}
          color="#3b82f6"
        />
        <StatCard
          icon={Award}
          title="Reservations"
          value={data.reservations}
          subtitle={`${((data.reservations / data.totalContacts) * 100).toFixed(1)}% conversion`}
          color="#f59e0b"
        />
        <StatCard
          icon={Users}
          title="Engagement Rate"
          value={`${data.engagementRate}%`}
          subtitle={`${data.engagedContacts} of ${data.totalContacts} active`}
          color="#8b5cf6"
        />
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Funnel */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            <Target className="w-5 h-5 text-blue-600" />
            Active Sales Funnel
            <InfoTooltip
              title="Active Sales Funnel"
              description="Breakdown of leads by stage in the sales process. Shows the pipeline from new leads through to reservations. Excludes agents, team members, and not interested contacts to focus on active prospects."
            />
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={data.funnelData}
              layout="vertical"
              margin={{ left: 120, right: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
              <XAxis type="number" stroke="#6b7280" />
              <YAxis
                dataKey="name"
                type="category"
                stroke="#6b7280"
                width={110}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
                formatter={(value) => [value + ' contacts', 'Count']}
              />
              <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                {data.funnelData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-xs text-yellow-800 dark:text-yellow-300">
              <span className="font-semibold">Observation:</span> Strong warm pipeline, focus on qualifying warm prospects into hot leads.
            </p>
          </div>
        </div>

        {/* Full Database Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            <Users className="w-5 h-5 text-blue-600" />
            Full Database Distribution
            <InfoTooltip
              title="Full Database Distribution"
              description="Complete breakdown of all contacts by rating category. Includes agents, team members, and not interested contacts in addition to active prospects. Shows the full composition of the database."
            />
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data.ratingDistribution}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={(entry) => `${entry.name}: ${entry.value}`}
                labelLine={false}
              >
                {data.ratingDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-4 max-h-48 overflow-y-auto">
            {data.ratingDistribution.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-900 dark:text-white font-semibold">{item.value}</span>
                  <span className="text-gray-500 dark:text-gray-400 text-xs">({item.percentage}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lead Source Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Source Performance */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Lead Source Performance
            <InfoTooltip
              title="Lead Source Performance"
              description="Comparison of total leads vs. hot + warm leads by source. Shows which sources are generating the most volume and the most engaged prospects. Use this to evaluate channel effectiveness."
            />
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.sourcePerformance} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
              <XAxis type="number" stroke="#6b7280" />
              <YAxis dataKey="source" type="category" stroke="#6b7280" width={100} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar dataKey="contacts" fill="#3b82f6" name="Total Leads" radius={[0, 8, 8, 0]} />
              <Bar dataKey="hotWarmCount" fill="#10b981" name="Hot + Warm" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-800 dark:text-blue-300">
              <span className="font-semibold">🌐 Website Leading:</span> {data.websiteLeads.contacts} total leads from miramarsarasota.com, {(data.leadSources.find(s => s.name === 'Website')?.hot || 0) + (data.leadSources.find(s => s.name === 'Website')?.warm || 0)} hot/warm (47% engagement)
            </p>
          </div>
        </div>

        {/* Lead Source Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            <Users className="w-5 h-5 text-blue-600" />
            Lead Source Breakdown
            <InfoTooltip
              title="Lead Source Breakdown"
              description="Distribution of all leads by originating source. Shows where contacts are coming from and the relative volume from each channel. Helps identify top acquisition channels."
            />
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={data.leadSources}
                dataKey="contacts"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={(entry) => `${entry.name}: ${entry.contacts}`}
                labelLine={false}
              >
                {data.leadSources.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-4">
            {data.leadSources.map((source, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: source.color }}
                  />
                  <span className="text-gray-700 dark:text-gray-300">{source.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-900 dark:text-white font-semibold">{source.contacts}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {source.reservations > 0 ? `${source.reservations} res` : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Conversion Rate by Source */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            <Award className="w-5 h-5 text-blue-600" />
            Conversion Rate by Source
            <InfoTooltip
              title="Conversion Rate by Source"
              description="Comparison of conversion rate (% to reservations) and quality score (95 = highest) by lead source. Website typically shows the best conversion and quality. Use this to prioritize investment in top-performing channels."
            />
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.sourcePerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
              <XAxis dataKey="source" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
                formatter={(value, name) => {
                  if (name === 'Conversion Rate (%)') return [value + '%', name];
                  return [value, name];
                }}
              />
              <Legend />
              <Bar dataKey="conversionRate" fill="#10b981" name="Conversion Rate (%)" radius={[8, 8, 0, 0]} />
              <Bar dataKey="quality" fill="#6366f1" name="Quality Score" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-xs text-green-700 dark:text-green-300 font-semibold">Best Converter</p>
              <p className="text-sm text-green-900 dark:text-green-100 font-bold">Website: {data.websiteLeads.conversionRate}%</p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-300 font-semibold">Highest Quality</p>
              <p className="text-sm text-blue-900 dark:text-blue-100 font-bold">Website: {data.websiteLeads.quality}</p>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <p className="text-xs text-purple-700 dark:text-purple-300 font-semibold">Most Volume</p>
              <p className="text-sm text-purple-900 dark:text-purple-100 font-bold">{data.sourcePerformance[0]?.source}: {data.sourcePerformance[0]?.contacts}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Insights & Actions */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
          <Target className="w-5 h-5 text-blue-600" />
          Key Insights & Recommendations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-green-600 dark:text-green-400 text-sm font-semibold mb-2">✓ Winner</div>
            <p className="text-gray-900 dark:text-white font-medium mb-1">Website Performing Best</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">{data.websiteLeads.contacts} leads ({((data.websiteLeads.contacts / data.totalContacts) * 100).toFixed(1)}%), {data.websiteLeads.quality} quality score, {data.websiteLeads.conversionRate}% conversion. Website is your highest-performing channel.</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-yellow-600 dark:text-yellow-400 text-sm font-semibold mb-2">⚠ Fix Attribution</div>
            <p className="text-gray-900 dark:text-white font-medium mb-1">{data.leadSources.find(s => s.name === 'Unknown')?.contacts || 0} Unknown Sources</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">{((((data.leadSources.find(s => s.name === 'Unknown')?.contacts || 0) / data.totalContacts) * 100).toFixed(0))}% of database lacks source tracking. Implement UTM parameters and better intake forms.</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-blue-600 dark:text-blue-400 text-sm font-semibold mb-2">📊 Opportunity</div>
            <p className="text-gray-900 dark:text-white font-medium mb-1">Scale Website Traffic</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">With {data.websiteLeads.quality} quality score and {data.websiteLeads.conversionRate}% conversion, doubling website leads could yield 1-2 more reservations/month.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
