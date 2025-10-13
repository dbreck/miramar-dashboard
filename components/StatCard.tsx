'use client';

import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface Trend {
  value: number;
  direction: 'up' | 'down' | 'neutral';
}

interface StatCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  subtitle?: string;
  color: string;
  trend?: Trend;
}

export default function StatCard({ icon: Icon, title, value, subtitle, color, trend }: StatCardProps) {
  const getTrendIcon = () => {
    if (!trend) return null;

    switch (trend.direction) {
      case 'up':
        return <TrendingUp className="w-4 h-4" />;
      case 'down':
        return <TrendingDown className="w-4 h-4" />;
      case 'neutral':
        return <Minus className="w-4 h-4" />;
    }
  };

  const getTrendColor = () => {
    if (!trend) return '';

    switch (trend.direction) {
      case 'up':
        return 'text-green-600 dark:text-green-400';
      case 'down':
        return 'text-red-600 dark:text-red-400';
      case 'neutral':
        return 'text-gray-500 dark:text-gray-400';
    }
  };

  const getTrendBgColor = () => {
    if (!trend) return '';

    switch (trend.direction) {
      case 'up':
        return 'bg-green-50 dark:bg-green-900/20';
      case 'down':
        return 'bg-red-50 dark:bg-red-900/20';
      case 'neutral':
        return 'bg-gray-50 dark:bg-gray-700/20';
    }
  };

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-l-4 transition-all hover:shadow-xl"
      style={{ borderColor: color }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</div>
        <Icon className="w-5 h-5 text-gray-400" />
      </div>

      <div className="flex items-baseline justify-between">
        <div className="text-3xl font-bold text-gray-900 dark:text-white">{value}</div>

        {trend && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${getTrendBgColor()} ${getTrendColor()}`}>
            {getTrendIcon()}
            <span className="text-sm font-semibold">{trend.value}%</span>
          </div>
        )}
      </div>

      {subtitle && (
        <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</div>
      )}

      {trend && (
        <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          vs previous period
        </div>
      )}
    </div>
  );
}
