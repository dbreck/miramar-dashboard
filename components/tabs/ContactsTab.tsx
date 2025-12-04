'use client';

import { useState, useEffect } from 'react';
import LoadingProgress from '../LoadingProgress';
import {
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { DateRange } from '../DateRangePicker';
import InfoTooltip from '../InfoTooltip';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface ContactsTabProps {
  dateRange: DateRange;
}

export default function ContactsTab({ dateRange }: ContactsTabProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadStartTime, setLoadStartTime] = useState<number>(Date.now());

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    try {
      setLoadStartTime(Date.now());
      const params = new URLSearchParams({
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      });
      const response = await fetch(`/api/dashboard?${params}`);
      const dashboardData = await response.json();
      setData(dashboardData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingProgress startTime={loadStartTime} />;
  }

  if (!data) return null;

  const sourceQuality = data.leadSources.map((s: any) => ({
    source: s.name,
    Quality: s.quality,
    Engagement: s.engagement,
    'Email Coverage': s.email,
  }));

  return (
    <div className="space-y-6">
      {/* Lead Source Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            Lead Source Volume
            <InfoTooltip
              title="Active Lead Source Volume"
              description="Total number of contacts from each source that had interactions during the selected period. Only includes contacts that were actively engaged (emails, calls, meetings, etc.). Contacts with zero interactions are not shown."
            />
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={data.leadSources}
                dataKey="contacts"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={110}
                label={(entry) => `${entry.name} (${entry.contacts})`}
              >
                {data.leadSources.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Source Quality Radar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            Source Quality Metrics
            <InfoTooltip
              title="Source Quality Metrics"
              description="Quality: % of contacts with 2+ interactions (engagement rate). Engagement: % of contacts actively communicating. Email: % with email interactions. Higher scores indicate better lead quality from that source. Calculated from real interaction data."
            />
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={sourceQuality.slice(0, 5)}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="source" stroke="#6b7280" />
              <PolarRadiusAxis stroke="#6b7280" />
              <Radar name="Quality" dataKey="Quality" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
              <Radar name="Engagement" dataKey="Engagement" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
              <Radar name="Email" dataKey="Email Coverage" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} />
              <Legend />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Source Performance Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-2">
          <h3 className="text-lg font-semibold text-white">Lead Source Performance</h3>
          <div className="ml-auto">
            <InfoTooltip
              title="Lead Source Performance Table"
              description="Detailed breakdown of each source's performance for the selected period. Quality score (out of 100) measures engagement rate. Engagement shows % with multiple interactions. Email coverage shows % with email activity. Use this to identify best-performing lead sources."
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Contacts
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Quality
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Engagement
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Email Coverage
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {data.leadSources.map((source: any, idx: number) => (
                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">
                    {source.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-semibold text-blue-600">{source.contacts}</span>
                    <span className="text-gray-400 text-sm ml-2">
                      ({Math.round((source.contacts / data.keyMetrics.totalContacts) * 100)}%)
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        source.quality >= 95
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                          : source.quality >= 90
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                      }`}
                    >
                      {source.quality}/100
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${source.engagement}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {source.engagement}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${source.email}%` }} />
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{source.email}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
