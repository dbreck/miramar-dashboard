'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ExecSummaryPayload } from '@/lib/executive-summary';
import { ProgressEvent } from '@/components/LoadingProgress';

const CACHE_KEY = 'miramar-execsummary-v1';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface CachedEntry {
  data: ExecSummaryPayload;
  timestamp: number;
}

function getCached(): CachedEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CachedEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > MAX_AGE_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

function setCached(data: ExecSummaryPayload): void {
  try {
    const entry: CachedEntry = { data, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // quota / private browsing — ignore
  }
}

export interface UseExecutiveSummaryResult {
  data: ExecSummaryPayload | null;
  loading: boolean;
  error: string | null;
  progress: ProgressEvent | null;
  startTime: number;
  refetch: () => void;
  isCached: boolean;
  lastFetchedAt: number | null;
}

export function useExecutiveSummary(refreshTrigger: number): UseExecutiveSummaryResult {
  const [data, setData] = useState<ExecSummaryPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [startTime, setStartTime] = useState(Date.now());
  const [isCached, setIsCached] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const mountedRef = useRef(true);

  const refetch = useCallback(() => {
    // bump external trigger via the setter at the page level — caller pattern
  }, []);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const cached = getCached();
    if (cached) {
      setData(cached.data);
      setIsCached(true);
      setLastFetchedAt(cached.timestamp);
    }
  }, []);

  // Fetch when refreshTrigger > 0
  useEffect(() => {
    if (refreshTrigger === 0) return;

    mountedRef.current = true;
    setLoading(true);
    setError(null);
    setProgress(null);
    setStartTime(Date.now());

    const params = new URLSearchParams();
    params.set('force', 'true');
    const eventSource = new EventSource(`/api/executive-summary/stream?${params}`);

    eventSource.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const eventData = JSON.parse(event.data) as ProgressEvent;
        setProgress(eventData);
        if (eventData.stage === 'complete') {
          setData(eventData.data);
          setIsCached(false);
          setLastFetchedAt(Date.now());
          setCached(eventData.data);
          setLoading(false);
          eventSource.close();
        } else if (eventData.stage === 'error') {
          setError(eventData.message || 'Failed to load executive summary');
          setLoading(false);
          eventSource.close();
        }
      } catch (e) {
        console.error('Failed to parse SSE event:', e);
      }
    };

    eventSource.onerror = () => {
      if (!mountedRef.current) return;
      setError('Connection lost. Please try again.');
      setLoading(false);
      eventSource.close();
    };

    return () => {
      mountedRef.current = false;
      eventSource.close();
    };
  }, [refreshTrigger]);

  return { data, loading, error, progress, startTime, refetch, isCached, lastFetchedAt };
}
