"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  isStale: boolean;
}

interface QueryCacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of cached entries
  staleTime?: number; // Time before data is considered stale
  gcInterval?: number; // Garbage collection interval
}

interface QueryCacheResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isStale: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => void;
  setData: (data: T) => void;
}

class QueryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize: number;
  private gcInterval: NodeJS.Timeout | null = null;

  constructor(maxSize = 100, gcIntervalMs = 60000) {
    this.maxSize = maxSize;
    this.startGarbageCollection(gcIntervalMs);
  }

  private startGarbageCollection(interval: number) {
    this.gcInterval = setInterval(() => {
      this.cleanup();
    }, interval);
  }

  private cleanup() {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());

    // Remove expired entries
    entries.forEach(([key, entry]) => {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    });

    // If still over max size, remove oldest entries
    if (this.cache.size > this.maxSize) {
      const sortedEntries = entries
        .filter(([key]) => this.cache.has(key)) // Only include non-expired entries
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);

      const toRemove = sortedEntries.slice(0, this.cache.size - this.maxSize);
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  get<T>(key: string): CacheEntry<T> | undefined {
    return this.cache.get(key);
  }

  set<T>(key: string, data: T, ttl: number, staleTime: number) {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + ttl,
      isStale: false,
    };

    this.cache.set(key, entry);

    // Mark as stale after staleTime
    if (staleTime < ttl) {
      setTimeout(() => {
        const currentEntry = this.cache.get(key);
        if (currentEntry && currentEntry.timestamp === entry.timestamp) {
          currentEntry.isStale = true;
        }
      }, staleTime);
    }
  }

  delete(key: string) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  destroy() {
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
    }
    this.clear();
  }
}

// Global cache instance
const globalCache = new QueryCache();

export function useQueryCache<T>(
  key: string,
  queryFn: () => Promise<T>,
  options: QueryCacheOptions = {}
): QueryCacheResult<T> {
  const {
    ttl = 300000, // 5 minutes default
    staleTime = 60000, // 1 minute default
  } = options;

  const [data, setData] = useState<T | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Check cache and load data
  const loadData = useCallback(
    async (forceRefresh = false) => {
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const cachedEntry = globalCache.get<T>(key);
      const now = Date.now();

      // Use cached data if available and not expired
      if (cachedEntry && !forceRefresh && now < cachedEntry.expiresAt) {
        setData(cachedEntry.data);
        setIsStale(cachedEntry.isStale);
        setError(null);

        // If data is stale, fetch in background
        if (cachedEntry.isStale) {
          loadData(true).catch(console.error);
        }

        return;
      }

      setIsLoading(true);
      setError(null);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const result = await queryFn();

        if (!abortController.signal.aborted && mountedRef.current) {
          globalCache.set(key, result, ttl, staleTime);
          setData(result);
          setIsStale(false);
          setError(null);
        }
      } catch (err) {
        if (!abortController.signal.aborted && mountedRef.current) {
          const error = err instanceof Error ? err : new Error("Query failed");
          setError(error);

          // Keep stale data if available
          if (cachedEntry) {
            setData(cachedEntry.data);
            setIsStale(true);
          }
        }
      } finally {
        if (!abortController.signal.aborted && mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [key, queryFn, ttl, staleTime]
  );

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Refetch function
  const refetch = useCallback(async () => {
    await loadData(true);
  }, [loadData]);

  // Invalidate cache entry
  const invalidate = useCallback(() => {
    globalCache.delete(key);
    setIsStale(true);
  }, [key]);

  // Set data manually
  const setDataManually = useCallback(
    (newData: T) => {
      globalCache.set(key, newData, ttl, staleTime);
      setData(newData);
      setIsStale(false);
      setError(null);
    },
    [key, ttl, staleTime]
  );

  return {
    data,
    isLoading,
    isStale,
    error,
    refetch,
    invalidate,
    setData: setDataManually,
  };
}

// Hook for batch invalidation
export function useCacheInvalidation() {
  const invalidatePattern = useCallback((pattern: string | RegExp) => {
    const keys = Array.from((globalCache as any).cache.keys());
    const keysToInvalidate = keys.filter((key: string) => {
      if (typeof pattern === "string") {
        return key.includes(pattern);
      }
      return pattern.test(key);
    });

    keysToInvalidate.forEach((key) => globalCache.delete(key));
  }, []);

  const invalidateAll = useCallback(() => {
    globalCache.clear();
  }, []);

  return {
    invalidatePattern,
    invalidateAll,
  };
}

// Cleanup function for app shutdown
export function destroyQueryCache() {
  globalCache.destroy();
}
