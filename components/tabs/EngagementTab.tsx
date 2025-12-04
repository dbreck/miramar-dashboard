'use client';

import { useState, useEffect } from 'react';
import { Target, Activity, TrendingUp, Mail, Phone, MessageSquare } from 'lucide-react';
import LoadingProgress from '../LoadingProgress';
import { DateRange } from '../DateRangePicker';

const StatCard = ({ icon: Icon, title, value, subtitle, color }: any) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-l-4 transition-all hover:shadow-xl" style={{ borderColor: color }}>
    <div className="flex items-center justify-between mb-2">
      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</div>
      <Icon className="w-5 h-5 text-gray-400" />
    </div>
    <div className="flex items-baseline">
      <div className="text-3xl font-bold text-gray-900 dark:text-white">{value}</div>
    </div>
    {subtitle && <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</div>}
  </div>
);

interface EngagementTabProps {
  dateRange: DateRange;
}

export default function EngagementTab({ dateRange }: EngagementTabProps) {
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

  const getIconForType = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('email')) return Mail;
    if (lowerName.includes('phone') || lowerName.includes('call')) return Phone;
    if (lowerName.includes('text') || lowerName.includes('message')) return MessageSquare;
    return Activity;
  };

  const getColorForType = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('email')) return '#3b82f6';
    if (lowerName.includes('phone') || lowerName.includes('call')) return '#10b981';
    if (lowerName.includes('text')) return '#8b5cf6';
    return '#f59e0b';
  };

  const engagementRate = Math.round((data.keyMetrics.activeContacts / data.keyMetrics.totalContacts) * 100);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <StatCard
          icon={Target}
          title="Response Time"
          value={data.keyMetrics.responsiveness}
          subtitle="Median follow-up cadence"
          color="#10b981"
        />
        <StatCard
          icon={Activity}
          title="Engagement Rate"
          value={`${engagementRate}%`}
          subtitle="Contacts with interactions"
          color="#3b82f6"
        />
        <StatCard
          icon={TrendingUp}
          title="Total Interactions"
          value={data.keyMetrics.totalInteractions}
          subtitle="All recorded activities"
          color="#f59e0b"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Interaction Types Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Interaction Type Details</h3>
          <div className="space-y-4">
            {data.interactionTypeBreakdown.slice(0, 5).map((type: any) => {
              const Icon = getIconForType(type.name);
              const color = getColorForType(type.name);
              return (
                <div key={type.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20` }}>
                      <Icon className="w-5 h-5" style={{ color }} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{type.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">ID: {type.id}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold" style={{ color }}>
                      {type.value}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {Math.round((type.value / data.keyMetrics.totalInteractions) * 100)}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Key Insights */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Key Insights</h3>
          <div className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="font-semibold text-green-900 dark:text-green-300 mb-2">✓ Strengths</p>
              <ul className="space-y-1 text-sm text-green-800 dark:text-green-400">
                <li>• {engagementRate}% contact engagement rate</li>
                <li>• {data.keyMetrics.responsiveness} median response time</li>
                <li>• {data.keyMetrics.emailCoverage}% email coverage</li>
                <li>• {data.keyMetrics.totalInteractions} total interactions logged</li>
              </ul>
            </div>
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="font-semibold text-yellow-900 dark:text-yellow-300 mb-2">⚠ Opportunities</p>
              <ul className="space-y-1 text-sm text-yellow-800 dark:text-yellow-400">
                <li>• Improve attribution for unknown sources</li>
                <li>• Increase follow-up consistency</li>
                <li>• Balance team workload distribution</li>
                <li>• Analyze peak activity patterns</li>
              </ul>
            </div>
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="font-semibold text-blue-900 dark:text-blue-300 mb-2">📊 By the Numbers</p>
              <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-400">
                <li>• {data.keyMetrics.activeContacts} unique contacts engaged</li>
                <li>• Avg {data.keyMetrics.avgInteractionsPerContact} interactions per contact</li>
                <li>• {data.interactionTypeBreakdown.length} interaction types active</li>
                <li>• Multi-channel engagement strategy</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
