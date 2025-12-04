'use client';

import { useState, useEffect } from 'react';
import { Loader2, Database, Users, BarChart3, Filter, CheckCircle2, AlertCircle } from 'lucide-react';

export interface ProgressEvent {
  stage: 'sources' | 'fields' | 'contacts' | 'details' | 'no-source' | 'aggregate' | 'complete' | 'error';
  message: string;
  progress?: {
    current: number;
    total: number;
    source?: string;
  };
  data?: any;
}

interface LoadingProgressProps {
  progress?: ProgressEvent | null;
  startTime?: number;
}

const stageIcons: Record<string, any> = {
  'sources': Filter,
  'fields': Database,
  'contacts': Users,
  'details': Users,
  'no-source': Users,
  'aggregate': BarChart3,
  'complete': CheckCircle2,
  'error': AlertCircle,
};

export default function LoadingProgress({ progress, startTime }: LoadingProgressProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const start = startTime || Date.now();

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - start);
    }, 100);
    return () => clearInterval(interval);
  }, [start]);

  const seconds = Math.floor(elapsedTime / 1000);
  const CurrentIcon = progress?.stage ? stageIcons[progress.stage] || Database : Database;
  const message = progress?.message || 'Connecting to Spark API...';

  // Calculate percentage if we have progress data
  const progressPercent = progress?.progress
    ? Math.round((progress.progress.current / progress.progress.total) * 100)
    : null;

  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center space-y-6 max-w-md">
        {/* Main spinner with icon */}
        <div className="relative">
          <Loader2 className="w-16 h-16 animate-spin text-blue-600/30 mx-auto" />
          <CurrentIcon className={`w-8 h-8 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${
            progress?.stage === 'error' ? 'text-red-500' : 'text-blue-600'
          }`} />
        </div>

        {/* Current status message */}
        <div className="space-y-2">
          <p className={`text-lg font-medium ${
            progress?.stage === 'error'
              ? 'text-red-500'
              : 'text-gray-800 dark:text-gray-200'
          }`}>
            {message}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {seconds > 0 && `${seconds}s elapsed`}
          </p>
        </div>

        {/* Progress bar (if we have progress data) */}
        {progress?.progress && (
          <div className="w-full max-w-xs mx-auto">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>{progress.progress.current} of {progress.progress.total}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Helpful context */}
        <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs mx-auto">
          Loading data from Spark API. This may take a moment depending on the date range and filters.
        </p>
      </div>
    </div>
  );
}
