'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RatingHistoryPayload } from '@/lib/rating-history';

const CACHE_KEY = 'miramar-rating-history-v1';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

interface CachedEntry {
  data: RatingHistoryPayload;
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

function setCached(data: RatingHistoryPayload): void {
  try {
    const entry: CachedEntry = { data, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* ignore quota / private browsing */
  }
}

export interface UseRatingHistoryResult {
  data: RatingHistoryPayload | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  isCached: boolean;
  notFound: boolean;
}

export function useRatingHistory(refreshTrigger: number): UseRatingHistoryResult {
  const [data, setData] = useState<RatingHistoryPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const mountedRef = useRef(true);

  const fetchHistory = useCallback(async (force: boolean) => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const url = `/rating-history.json${force ? `?t=${Date.now()}` : ''}`;
      const res = await fetch(url, { cache: force ? 'no-store' : 'default' });
      if (!mountedRef.current) return;
      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(`Failed to load rating history: HTTP ${res.status}`);
      const payload: RatingHistoryPayload = await res.json();
      setData(payload);
      setIsCached(false);
      setCached(payload);
      setLoading(false);
    } catch (e: any) {
      if (!mountedRef.current) return;
      setError(e?.message || 'Failed to load rating history');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const cached = getCached();
    if (cached) {
      setData(cached.data);
      setIsCached(true);
    }
    fetchHistory(false);
    return () => {
      mountedRef.current = false;
    };
  }, [fetchHistory]);

  useEffect(() => {
    if (refreshTrigger === 0) return;
    fetchHistory(true);
  }, [refreshTrigger, fetchHistory]);

  const refetch = useCallback(() => fetchHistory(true), [fetchHistory]);

  return { data, loading, error, refetch, isCached, notFound };
}
