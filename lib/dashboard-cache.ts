'use client';

const CACHE_PREFIX = 'dashboard-v1-';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedEntry {
  data: any;
  timestamp: number;
}

export function getCachedDashboard(optionsKey: string): CachedEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + optionsKey);
    if (!raw) return null;
    const entry: CachedEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > MAX_AGE_MS) {
      localStorage.removeItem(CACHE_PREFIX + optionsKey);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

export function setCachedDashboard(optionsKey: string, data: any): void {
  try {
    const entry: CachedEntry = { data, timestamp: Date.now() };
    localStorage.setItem(CACHE_PREFIX + optionsKey, JSON.stringify(entry));
  } catch {
    // Quota exceeded or private browsing — ignore
  }
}

export function clearExpiredCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) keys.push(key);
    }
    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const entry: CachedEntry = JSON.parse(raw);
        if (Date.now() - entry.timestamp > MAX_AGE_MS) {
          localStorage.removeItem(key);
        }
      } catch {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore
  }
}
