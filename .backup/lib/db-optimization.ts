"use client";

import { EnhancedCache } from "./enhanced-cache";
import { performanceMonitor } from "./performance-monitor";
import { createSupabaseBrowserClient } from "./supabase";

interface QueryOptions {
  cache?: boolean;
  cacheTTL?: number;
  cacheKey?: string;
  tags?: string[];
  timeout?: number;
  retries?: number;
  batchSize?: number;
}

interface BatchQuery {
  id: string;
  query: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  options: QueryOptions;
}

class DatabaseOptimizer {
  private supabase = createSupabaseBrowserClient();
  private queryCache = new EnhancedCache({
    ttl: 300000, // 5 minutes default
    maxSize: 1000,
    maxMemory: 50 * 1024 * 1024, // 50MB
  });
  private batchQueue: BatchQuery[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private connectionPool: Map<string, any> = new Map();
  private queryStats = {
    totalQueries: 0,
    cachedQueries: 0,
    failedQueries: 0,
    averageLatency: 0,
  };

  // Execute optimized query
  async executeQuery<T>(
    queryFn: () => Promise<T>,
    options: QueryOptions = {}
  ): Promise<T> {
    const {
      cache = true,
      cacheTTL = 300000,
      cacheKey,
      tags = [],
      timeout = 30000,
      retries = 3,
    } = options;

    const startTime = performanceMonitor.startTiming();
    this.queryStats.totalQueries++;

    // Generate cache key if not provided
    const finalCacheKey = cacheKey || this.generateCacheKey(queryFn.toString());

    // Check cache first
    if (cache) {
      const cached = this.queryCache.get(finalCacheKey);
      if (cached) {
        this.queryStats.cachedQueries++;
        performanceMonitor.recordTiming("db.query.cached", startTime);
        performanceMonitor.incrementCounter("db.cache.hit");
        return cached;
      }
    }

    // Execute query with retries and timeout
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await Promise.race([
          queryFn(),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("Query timeout")), timeout);
          }),
        ]);

        // Cache successful result
        if (cache) {
          await this.queryCache.set(finalCacheKey, result, {
            ttl: cacheTTL,
            tags,
          });
        }

        // Update stats
        const latency = performance.now() - startTime;
        this.updateLatencyStats(latency);

        performanceMonitor.recordTiming("db.query.success", startTime, {
          attempt: attempt.toString(),
        });
        performanceMonitor.incrementCounter("db.query.success");

        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt < retries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise((resolve) => {
            setTimeout(resolve, delay);
          });

          performanceMonitor.incrementCounter("db.query.retry", {
            attempt: attempt.toString(),
          });
        }
      }
    }

    // All retries failed
    this.queryStats.failedQueries++;
    performanceMonitor.recordTiming("db.query.failed", startTime);
    performanceMonitor.incrementCounter("db.query.failed");

    throw lastError || new Error("Query failed after all retries");
  }

  // Batch multiple queries for better performance
  async batchQuery<T>(
    queryFn: () => Promise<T>,
    options: QueryOptions = {}
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const batchQuery: BatchQuery = {
        id: Math.random().toString(36).substr(2, 9),
        query: queryFn,
        resolve,
        reject,
        options,
      };

      this.batchQueue.push(batchQuery);

      // Process batch after a short delay to collect more queries
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
      }

      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, 10); // 10ms batch window
    });
  }

  // Process batched queries
  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const batch = [...this.batchQueue];
    this.batchQueue = [];
    this.batchTimer = null;

    const startTime = performanceMonitor.startTiming();

    try {
      // Group queries by similar patterns for potential optimization
      const results = await Promise.allSettled(
        batch.map(async (batchQuery) => {
          try {
            const result = await this.executeQuery(
              batchQuery.query,
              batchQuery.options
            );
            batchQuery.resolve(result);
            return result;
          } catch (error) {
            batchQuery.reject(error);
            throw error;
          }
        })
      );

      performanceMonitor.recordTiming("db.batch.process", startTime, {
        size: batch.length.toString(),
      });
      performanceMonitor.recordGauge("db.batch.size", batch.length);
    } catch (error) {
      console.error("Batch processing error:", error);
    }
  }

  // Optimized message queries
  async getMessages(
    roomId: string,
    limit: number = 50,
    offset: number = 0,
    options: QueryOptions = {}
  ) {
    return this.executeQuery(
      async () => {
        const { data, error } = await this.supabase
          .from("chat_messages")
          .select(
            `
            *,
            sender:users!chat_messages_senderId_fkey(id, name, role)
          `
          )
          .eq("chatRoomId", roomId)
          .order("sentAt", { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) throw error;
        return (data || []).reverse();
      },
      {
        ...options,
        cacheKey: `messages:${roomId}:${limit}:${offset}`,
        tags: [`room:${roomId}`, "messages"],
        cacheTTL: 60000, // 1 minute for messages
      }
    );
  }

  // Optimized chat room queries
  async getChatRoom(appointmentId: string, options: QueryOptions = {}) {
    return this.executeQuery(
      async () => {
        const { data, error } = await this.supabase
          .from("chat_rooms")
          .select(
            `
            *,
            appointment:appointments!inner(id, scheduledAt, type, status, patientId, doctorId),
            patient:users!chat_rooms_patientId_fkey(id, name, role),
            doctor:doctors!chat_rooms_doctorId_fkey(id, specialty, user:users(id, name))
          `
          )
          .eq("appointmentId", appointmentId)
          .single();

        if (error) throw error;
        return data;
      },
      {
        ...options,
        cacheKey: `chatroom:${appointmentId}`,
        tags: [`appointment:${appointmentId}`, "chatrooms"],
        cacheTTL: 300000, // 5 minutes for chat rooms
      }
    );
  }

  // Optimized user queries with connection pooling
  async getUser(userId: string, options: QueryOptions = {}) {
    return this.executeQuery(
      async () => {
        const { data, error } = await this.supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .single();

        if (error) throw error;
        return data;
      },
      {
        ...options,
        cacheKey: `user:${userId}`,
        tags: [`user:${userId}`, "users"],
        cacheTTL: 600000, // 10 minutes for user data
      }
    );
  }

  // Bulk operations with optimized batching
  async bulkInsert(table: string, records: any[], options: QueryOptions = {}) {
    const { batchSize = 100 } = options;

    if (records.length <= batchSize) {
      return this.executeQuery(async () => {
        const { data, error } = await this.supabase.from(table).insert(records);

        if (error) throw error;
        return data;
      }, options);
    }

    // Split into batches
    const batches = [];
    for (let i = 0; i < records.length; i += batchSize) {
      batches.push(records.slice(i, i + batchSize));
    }

    const results = await Promise.all(
      batches.map((batch) =>
        this.executeQuery(
          async () => {
            const { data, error } = await this.supabase
              .from(table)
              .insert(batch);

            if (error) throw error;
            return data;
          },
          { ...options, cache: false } // Don't cache bulk operations
        )
      )
    );

    return results.flat();
  }

  // Invalidate cache by patterns
  invalidateCache(pattern: string | RegExp): void {
    if (typeof pattern === "string") {
      this.queryCache.invalidateByTags([pattern]);
    } else {
      // For regex patterns, we'd need to implement pattern matching
      // For now, clear all cache
      this.queryCache.clear();
    }

    performanceMonitor.incrementCounter("db.cache.invalidate");
  }

  // Get query statistics
  getStats() {
    return {
      ...this.queryStats,
      cacheStats: this.queryCache.getStats(),
      hitRate:
        this.queryStats.totalQueries > 0
          ? this.queryStats.cachedQueries / this.queryStats.totalQueries
          : 0,
    };
  }

  // Generate cache key from query function
  private generateCacheKey(queryString: string): string {
    // Simple hash function for cache key generation
    let hash = 0;
    for (let i = 0; i < queryString.length; i++) {
      const char = queryString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `query:${Math.abs(hash)}`;
  }

  // Update latency statistics
  private updateLatencyStats(latency: number): void {
    const totalLatency =
      this.queryStats.averageLatency * (this.queryStats.totalQueries - 1);
    this.queryStats.averageLatency =
      (totalLatency + latency) / this.queryStats.totalQueries;

    performanceMonitor.recordGauge("db.query.latency", latency);
    performanceMonitor.recordGauge(
      "db.query.average_latency",
      this.queryStats.averageLatency
    );
  }

  // Cleanup resources
  destroy(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.queryCache.destroy();
    this.connectionPool.clear();

    // Reject any pending batch queries
    this.batchQueue.forEach((query) => {
      query.reject(new Error("Database optimizer destroyed"));
    });
    this.batchQueue = [];
  }
}

// Global database optimizer instance
export const dbOptimizer = new DatabaseOptimizer();

// React hook for optimized database queries
export function useOptimizedQuery<T>(
  queryFn: () => Promise<T>,
  dependencies: any[] = [],
  options: QueryOptions = {}
) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const executeQuery = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await dbOptimizer.executeQuery(queryFn, options);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [queryFn, options]);

  useEffect(() => {
    executeQuery();
  }, dependencies);

  const refetch = useCallback(() => {
    executeQuery();
  }, [executeQuery]);

  return {
    data,
    isLoading,
    error,
    refetch,
  };
}

// Hook for batch queries
export function useBatchQuery() {
  const batchQuery = useCallback(
    <T>(queryFn: () => Promise<T>, options: QueryOptions = {}) => {
      return dbOptimizer.batchQuery(queryFn, options);
    },
    []
  );

  return { batchQuery };
}
