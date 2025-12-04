'use client';

import { useState, useEffect } from 'react';
import { Loader2, Database, Users, BarChart3, Filter, CheckCircle2 } from 'lucide-react';

interface LoadingProgressProps {
  startTime?: number;
}

const loadingStages = [
  { icon: Database, message: 'Connecting to Spark API...', minDuration: 1500 },
  { icon: Filter, message: 'Fetching registration sources...', minDuration: 3000 },
  { icon: Users, message: 'Loading contacts by source...', minDuration: 6000 },
  { icon: Users, message: 'Fetching contact details...', minDuration: 10000 },
  { icon: BarChart3, message: 'Aggregating analytics data...', minDuration: 6000 },
  { icon: CheckCircle2, message: 'Preparing dashboard...', minDuration: 3000 },
];

export default function LoadingProgress({ startTime }: LoadingProgressProps) {
  const [currentStage, setCurrentStage] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const start = startTime || Date.now();

  useEffect(() => {
    // Update elapsed time every 100ms
    const timeInterval = setInterval(() => {
      setElapsedTime(Date.now() - start);
    }, 100);

    return () => clearInterval(timeInterval);
  }, [start]);

  useEffect(() => {
    // Progress through stages based on elapsed time
    let totalDuration = 0;
    for (let i = 0; i < loadingStages.length; i++) {
      totalDuration += loadingStages[i].minDuration;
      if (elapsedTime < totalDuration) {
        setCurrentStage(i);
        return;
      }
    }
    // If we've exceeded all stages, stay on the last one
    setCurrentStage(loadingStages.length - 1);
  }, [elapsedTime]);

  const CurrentIcon = loadingStages[currentStage].icon;
  const currentMessage = loadingStages[currentStage].message;
  const seconds = Math.floor(elapsedTime / 1000);

  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center space-y-6 max-w-md">
        {/* Main spinner with icon */}
        <div className="relative">
          <Loader2 className="w-16 h-16 animate-spin text-blue-600/30 mx-auto" />
          <CurrentIcon className="w-8 h-8 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
        </div>

        {/* Current status message */}
        <div className="space-y-2">
          <p className="text-lg font-medium text-gray-800 dark:text-gray-200">
            {currentMessage}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {seconds > 0 && `${seconds}s elapsed`}
          </p>
        </div>

        {/* Progress stages indicator */}
        <div className="flex justify-center gap-2">
          {loadingStages.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index <= currentStage
                  ? 'bg-blue-600 scale-100'
                  : 'bg-gray-300 dark:bg-gray-600 scale-75'
              }`}
            />
          ))}
        </div>

        {/* Helpful context */}
        <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs mx-auto">
          Loading data from Spark API. This may take a moment depending on the date range and filters.
        </p>
      </div>
    </div>
  );
}
