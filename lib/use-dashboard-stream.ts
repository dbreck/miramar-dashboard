'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ProgressEvent } from '@/components/LoadingProgress';
import { getCachedDashboard, setCachedDashboard, clearExpiredCache } from '@/lib/dashboard-cache';

interface UseDashboardStreamOptions {
  start: Date;
  end: Date;
  excludedSources?: string[];
  excludeAgents?: boolean;
  excludeNoSource?: boolean;
  refreshTrigger?: number;
}

interface UseDashboardStreamResult {
  data: any | null;
  loading: boolean;
  error: string | null;
  progress: ProgressEvent | null;
  startTime: number;
  refetch: () => void;
  isCached: boolean;
  lastFetchedAt: number | null;
}

export function useDashboardStream(options: UseDashboardStreamOptions): UseDashboardStreamResult {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [isCached, setIsCached] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const mountedRef = useRef(true);

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

  // Hydrate from localStorage on mount and when optionsKey changes
  useEffect(() => {
    clearExpiredCache();
    const cached = getCachedDashboard(optionsKey);
    if (cached) {
      setData(cached.data);
      setIsCached(true);
      setLastFetchedAt(cached.timestamp);
      setError(null);
    } else {
      setData(null);
      setIsCached(false);
      setLastFetchedAt(null);
    }
  }, [optionsKey]);

  // Determine effective trigger: external refreshTrigger or internal fetchTrigger
  const effectiveTrigger = (options.refreshTrigger || 0) + fetchTrigger;

  // Only fetch when trigger fires (not on mount)
  useEffect(() => {
    if (effectiveTrigger === 0) return; // Skip initial mount

    mountedRef.current = true;
    setLoading(true);
    setError(null);
    setProgress(null);
    setStartTime(Date.now());

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

    const eventSource = new EventSource(`/api/dashboard/stream?${params}`);

    eventSource.onmessage = (event) => {
      if (!mountedRef.current) return;

      try {
        const eventData = JSON.parse(event.data) as ProgressEvent;
        setProgress(eventData);

        if (eventData.stage === 'complete') {
          setData(eventData.data);
          setLoading(false);
          setIsCached(false);
          setLastFetchedAt(Date.now());
          setCachedDashboard(optionsKey, eventData.data);
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
  }, [effectiveTrigger]);

  return { data, loading, error, progress, startTime, refetch, isCached, lastFetchedAt };
}
