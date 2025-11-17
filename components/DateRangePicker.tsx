'use client';

import { Calendar } from 'lucide-react';
import { useState } from 'react';

export interface DateRange {
  start: Date;
  end: Date;
  preset: '7d' | '30d' | '90d' | 'custom';
}

interface DateRangePickerProps {
  dateRange: DateRange;
  onChange: (range: DateRange) => void;
}

export default function DateRangePicker({ dateRange, onChange }: DateRangePickerProps) {
  const [showCustom, setShowCustom] = useState(false);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const calculatePreviousPeriod = (start: Date, end: Date) => {
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const prevStart = new Date(start.getTime() - days * 24 * 60 * 60 * 1000);
    const prevEnd = new Date(start);
    return { prevStart, prevEnd };
  };

  const handlePresetClick = (preset: '7d' | '30d' | '90d') => {
    // IMPORTANT: Spark's "last 30 days" means 31 calendar days (today + 30 days back)
    // Use UTC to avoid timezone issues when comparing with API timestamps
    // End date: Set to end of today UTC (23:59:59.999)
    // Start date: Set to start of day N days ago UTC (00:00:00)
    const end = new Date();
    end.setUTCHours(23, 59, 59, 999);

    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);

    switch (preset) {
      case '7d':
        start.setUTCDate(start.getUTCDate() - 7);
        break;
      case '30d':
        start.setUTCDate(start.getUTCDate() - 30);
        break;
      case '90d':
        start.setUTCDate(start.getUTCDate() - 90);
        break;
    }

    onChange({ start, end, preset });
    setShowCustom(false);
  };

  const handleCustomClick = () => {
    setShowCustom(!showCustom);
  };

  const handleCustomDateChange = (type: 'start' | 'end', value: string) => {
    const newDate = new Date(value);
    if (type === 'start') {
      onChange({ ...dateRange, start: newDate, preset: 'custom' });
    } else {
      onChange({ ...dateRange, end: newDate, preset: 'custom' });
    }
  };

  const { prevStart, prevEnd } = calculatePreviousPeriod(dateRange.start, dateRange.end);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Preset Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handlePresetClick('7d')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              dateRange.preset === '7d'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Last 7d
          </button>
          <button
            onClick={() => handlePresetClick('30d')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              dateRange.preset === '30d'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Last 30d
          </button>
          <button
            onClick={() => handlePresetClick('90d')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              dateRange.preset === '90d'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Last 90d
          </button>
          <button
            onClick={handleCustomClick}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              dateRange.preset === 'custom'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Calendar className="w-4 h-4 inline-block mr-1" />
            Custom
          </button>
        </div>

        {/* Date Display */}
        <div className="flex flex-col text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-white">Current:</span>
            <span>{formatDate(dateRange.start)} - {formatDate(dateRange.end)}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-medium text-gray-500 dark:text-gray-400">vs Previous:</span>
            <span className="text-gray-500 dark:text-gray-500">{formatDate(prevStart)} - {formatDate(prevEnd)}</span>
          </div>
        </div>
      </div>

      {/* Custom Date Inputs */}
      {showCustom && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.start.toISOString().split('T')[0]}
                onChange={(e) => handleCustomDateChange('start', e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={dateRange.end.toISOString().split('T')[0]}
                onChange={(e) => handleCustomDateChange('end', e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
