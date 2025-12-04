'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ProgressEvent } from '@/components/LoadingProgress';

interface UseDashboardStreamOptions {
  start: Date;
  end: Date;
  excludedSources?: string[];
  excludeAgents?: boolean;
  excludeNoSource?: boolean;
}

interface UseDashboardStreamResult {
  data: any | null;
  loading: boolean;
  error: string | null;
  progress: ProgressEvent | null;
  startTime: number;
  refetch: () => void;
}

export function useDashboardStream(options: UseDashboardStreamOptions): UseDashboardStreamResult {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [fetchTrigger, setFetchTrigger] = useState(0);

  // Use ref to track if component is mounted
  const mountedRef = useRef(true);

  // Stringify options for stable dependency comparison
  const optionsKey = JSON.stringify({
    start: options.start.toISOString(),
    end: options.end.toISOString(),
    excludedSources: options.excludedSources?.sort() || [],
    excludeAgents: options.excludeAgents || false,
    excludeNoSource: options.excludeNoSource || false,
  });

  const refetch = useCallback(() => {
    setFetchTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    setError(null);
    setProgress(null);
    setStartTime(Date.now());

    // Build URL params
    const params = new URLSearchParams({
      start: options.start.toISOString(),
      end: options.end.toISOString(),
    });

    if (options.excludedSources && options.excludedSources.length > 0) {
      params.set('excludeSources', options.excludedSources.join(','));
    }
    if (options.excludeAgents) {
      params.set('excludeAgents', 'true');
    }
    if (options.excludeNoSource) {
      params.set('excludeNoSource', 'true');
    }

    // Create EventSource for SSE
    const eventSource = new EventSource(`/api/dashboard/stream?${params}`);

    eventSource.onmessage = (event) => {
      if (!mountedRef.current) return;

      try {
        const eventData = JSON.parse(event.data) as ProgressEvent;
        setProgress(eventData);

        if (eventData.stage === 'complete') {
          setData(eventData.data);
          setLoading(false);
          eventSource.close();
        } else if (eventData.stage === 'error') {
          setError(eventData.message);
          setLoading(false);
          eventSource.close();
        }
      } catch (e) {
        console.error('Failed to parse SSE event:', e);
      }
    };

    eventSource.onerror = () => {
      if (!mountedRef.current) return;
      setError('Connection lost. Please refresh the page.');
      setLoading(false);
      eventSource.close();
    };

    return () => {
      mountedRef.current = false;
      eventSource.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsKey, fetchTrigger]);

  return { data, loading, error, progress, startTime, refetch };
}
