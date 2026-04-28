'use client';

import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import {
  ExecSummaryPayload,
  ExecDateRange,
  leadGrowthBuckets,
} from '@/lib/executive-summary';

type ViewMode = 'combined' | 'all-sources' | 'website' | 'non-website' | 'single';

const SOURCE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#a855f7', '#06b6d4',
  '#84cc16', '#f43f5e', '#6366f1', '#22c55e', '#eab308',
];

interface Props {
  data: ExecSummaryPayload;
  range: ExecDateRange;
}

export default function LeadGrowthChart({ data, range }: Props) {
  const [view, setView] = useState<ViewMode>('combined');
  const [selectedSource, setSelectedSource] = useState<string>('');

  const sourceNames = useMemo(
    () =>
      [...data.sources]
        .sort((a, b) => b.total - a.total)
        .map((s) => s.name),
    [data.sources],
  );

  const buckets = useMemo(() => leadGrowthBuckets(data, range), [data, range]);

  // Build chart data depending on view
  const chartData = useMemo(() => {
    return buckets.buckets.map((b) => {
      const row: Record<string, any> = { label: b.label };
      if (view === 'combined') {
        row.leads = buckets.combined[b.key] || 0;
      } else if (view === 'website') {
        row.leads = buckets.websiteCombined[b.key] || 0;
      } else if (view === 'non-website') {
        row.leads = buckets.nonWebsiteCombined[b.key] || 0;
      } else if (view === 'all-sources') {
        sourceNames.forEach((name) => {
          row[name] = buckets.bySource[name]?.[b.key] || 0;
        });
      } else if (view === 'single') {
        row.leads = selectedSource ? buckets.bySource[selectedSource]?.[b.key] || 0 : 0;
      }
      return row;
    });
  }, [buckets, view, selectedSource, sourceNames]);

  const buttons: { id: ViewMode; label: string }[] = [
    { id: 'combined', label: 'Combined' },
    { id: 'all-sources', label: 'All Sources' },
    { id: 'website', label: 'Website' },
    { id: 'non-website', label: 'Non-Website' },
    { id: 'single', label: 'Single Source' },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Lead Growth Over Time
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {buttons.map((b) => (
            <button
              key={b.id}
              onClick={() => setView(b.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                view === b.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {b.label}
            </button>
          ))}
          {view === 'single' && (
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Pick a source…</option>
              {sourceNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={360}>
        {view === 'all-sources' ? (
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
            <XAxis dataKey="label" stroke="#9ca3af" tick={{ fontSize: 11 }} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {sourceNames.map((name, i) => (
              <Area
                key={name}
                type="monotone"
                dataKey={name}
                stackId="1"
                stroke={SOURCE_COLORS[i % SOURCE_COLORS.length]}
                fill={SOURCE_COLORS[i % SOURCE_COLORS.length]}
                fillOpacity={0.35}
              />
            ))}
          </AreaChart>
        ) : (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
            <XAxis dataKey="label" stroke="#9ca3af" tick={{ fontSize: 11 }} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
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
              dataKey="leads"
              stroke="#3b82f6"
              strokeWidth={3}
              name={
                view === 'website'
                  ? 'Website Leads'
                  : view === 'non-website'
                  ? 'Non-Website Leads'
                  : view === 'single'
                  ? selectedSource || 'Source'
                  : 'New Leads'
              }
              dot={{ r: 3 }}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
