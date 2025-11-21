"use client";

import { performanceMonitor } from "./performance-monitor";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  tags: Set<string>;
}

interface CacheOptions {
  ttl?: number;
  maxSize?: number;
  maxMemory?: number; // in bytes
  staleTime?: number;
  gcInterval?: number;
  compressionThreshold?: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  memoryUsage: number;
  hitRate: number;
}

class EnhancedCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    memoryUsage: 0,
    hitRate: 0,
  };
  private options: Required<CacheOptions>;
  private gcInterval: NodeJS.Timeout | null = null;
  private compressionWorker: Worker | null = null;

  constructor(options: CacheOptions = {}) {
    this.options = {
      ttl: options.ttl || 300000, // 5 minutes
      maxSize: options.maxSize || 1000,
      maxMemory: options.maxMemory || 50 * 1024 * 1024, // 50MB
      staleTime: options.staleTime || 60000, // 1 minute
      gcInterval: options.gcInterval || 60000, // 1 minute
      compressionThreshold: options.compressionThreshold || 1024, // 1KB
    };

    this.startGarbageCollection();
    this.initializeCompression();
  }

  // Get item from cache
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    const now = Date.now();

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      performanceMonitor.incrementCounter("cache.miss", { key });
      return undefined;
    }

    // Check if expired
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      this.updateStats();
      performanceMonitor.incrementCounter("cache.expired", { key });
      return undefined;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = now;
    this.stats.hits++;
    this.updateHitRate();

    performanceMonitor.incrementCounter("cache.hit", { key });
    performanceMonitor.recordGauge("cache.access_count", entry.accessCount);

    return entry.data;
  }

  // Set item in cache
  async set(
    key: string,
    data: T,
    options?: { ttl?: number; tags?: string[] }
  ): Promise<void> {
    const now = Date.now();
    const ttl = options?.ttl || this.options.ttl;
    const tags = new Set(options?.tags || []);

    // Calculate data size
    const size = this.calculateSize(data);

    // Check if we need to compress
    let finalData = data;
    if (size > this.options.compressionThreshold && this.compressionWorker) {
      try {
        finalData = await this.compressData(data);
        performanceMonitor.incrementCounter("cache.compression", { key });
      } catch (error) {
        console.warn("Compression failed, storing uncompressed:", error);
      }
    }

    const entry: CacheEntry<T> = {
      data: finalData,
      timestamp: now,
      expiresAt: now + ttl,
      accessCount: 0,
      lastAccessed: now,
      size,
      tags,
    };

    // Check memory limits before adding
    if (this.stats.memoryUsage + size > this.options.maxMemory) {
      await this.evictLRU(size);
    }

    // Check size limits
    if (this.cache.size >= this.options.maxSize) {
      await this.evictLRU();
    }

    this.cache.set(key, entry);
    this.updateStats();

    performanceMonitor.recordGauge("cache.size", this.cache.size);
    performanceMonitor.recordGauge(
      "cache.memory_usage",
      this.stats.memoryUsage
    );
  }

  // Check if key exists and is not expired
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      this.updateStats();
      return false;
    }

    return true;
  }

  // Delete item from cache
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.updateStats();
      performanceMonitor.incrementCounter("cache.delete", { key });
    }
    return deleted;
  }

  // Clear cache
  clear(): void {
    this.cache.clear();
    this.resetStats();
    performanceMonitor.incrementCounter("cache.clear");
  }

  // Get cache statistics
  getStats(): CacheStats {
    return { ...this.stats };
  }

  // Invalidate by tags
  invalidateByTags(tags: string[]): number {
    let invalidated = 0;
    const tagSet = new Set(tags);

    for (const [key, entry] of this.cache) {
      const hasMatchingTag = Array.from(entry.tags).some((tag) =>
        tagSet.has(tag)
      );
      if (hasMatchingTag) {
        this.cache.delete(key);
        invalidated++;
      }
    }

    this.updateStats();
    performanceMonitor.recordGauge("cache.invalidated", invalidated);
    return invalidated;
  }

  // Get all keys
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  // Get cache entries for debugging
  entries(): Array<[string, CacheEntry<T>]> {
    return Array.from(this.cache.entries());
  }

  // Prewarm cache with data
  async prewarm(
    entries: Array<{
      key: string;
      data: T;
      options?: { ttl?: number; tags?: string[] };
    }>
  ): Promise<void> {
    const promises = entries.map(({ key, data, options }) =>
      this.set(key, data, options)
    );
    await Promise.all(promises);
    performanceMonitor.recordGauge("cache.prewarmed", entries.length);
  }

  // Calculate approximate size of data
  private calculateSize(data: T): number {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      // Fallback for non-serializable data
      return 1024; // 1KB estimate
    }
  }

  // Compress data using worker
  private async compressData(data: T): Promise<T> {
    if (!this.compressionWorker) return data;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Compression timeout")),
        5000
      );

      this.compressionWorker!.onmessage = (e) => {
        clearTimeout(timeout);
        resolve(e.data);
      };

      this.compressionWorker!.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };

      this.compressionWorker!.postMessage(data);
    });
  }

  // Initialize compression worker
  private initializeCompression(): void {
    if (typeof Worker === "undefined") return;

    try {
      const workerCode = `
        self.onmessage = function(e) {
          try {
            // Simple compression using JSON stringify with reduced precision
            const data = e.data;
            const compressed = JSON.stringify(data, (key, value) => {
              if (typeof value === 'number') {
                return Math.round(value * 100) / 100; // Round to 2 decimal places
              }
              return value;
            });
            self.postMessage(JSON.parse(compressed));
          } catch (error) {
            self.postMessage(e.data); // Return original data on error
          }
        };
      `;

      const blob = new Blob([workerCode], { type: "application/javascript" });
      this.compressionWorker = new Worker(URL.createObjectURL(blob));
    } catch (error) {
      console.warn("Failed to initialize compression worker:", error);
    }
  }

  // Evict least recently used items
  private async evictLRU(requiredSpace?: number): Promise<void> {
    const entries = Array.from(this.cache.entries());
    entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

    let freedSpace = 0;
    let evicted = 0;

    for (const [key, entry] of entries) {
      this.cache.delete(key);
      freedSpace += entry.size;
      evicted++;
      this.stats.evictions++;

      if (requiredSpace && freedSpace >= requiredSpace) break;
      if (!requiredSpace && this.cache.size < this.options.maxSize * 0.8) break;
    }

    this.updateStats();
    performanceMonitor.recordGauge("cache.evicted", evicted);
  }

  // Update cache statistics
  private updateStats(): void {
    this.stats.size = this.cache.size;
    this.stats.memoryUsage = Array.from(this.cache.values()).reduce(
      (total, entry) => total + entry.size,
      0
    );
  }

  // Update hit rate
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  // Reset statistics
  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      memoryUsage: 0,
      hitRate: 0,
    };
  }

  // Start garbage collection
  private startGarbageCollection(): void {
    this.gcInterval = setInterval(() => {
      this.cleanup();
    }, this.options.gcInterval);
  }

  // Cleanup expired entries
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.updateStats();
      performanceMonitor.recordGauge("cache.cleaned", cleaned);
    }
  }

  // Destroy cache
  destroy(): void {
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
    }

    if (this.compressionWorker) {
      this.compressionWorker.terminate();
    }

    this.clear();
  }
}

// Global cache instances
const messageCache = new EnhancedCache({
  ttl: 600000, // 10 minutes
  maxSize: 2000,
  maxMemory: 20 * 1024 * 1024, // 20MB
  staleTime: 120000, // 2 minutes
});

const userCache = new EnhancedCache({
  ttl: 1800000, // 30 minutes
  maxSize: 500,
  maxMemory: 5 * 1024 * 1024, // 5MB
  staleTime: 300000, // 5 minutes
});

const fileCache = new EnhancedCache({
  ttl: 3600000, // 1 hour
  maxSize: 100,
  maxMemory: 100 * 1024 * 1024, // 100MB
  staleTime: 600000, // 10 minutes
});

export { EnhancedCache, fileCache, messageCache, userCache };

// React hook for cache usage
export function useEnhancedCache<T>(cacheInstance: EnhancedCache<T>) {
  const get = (key: string) => cacheInstance.get(key);
  const set = (
    key: string,
    data: T,
    options?: { ttl?: number; tags?: string[] }
  ) => cacheInstance.set(key, data, options);
  const has = (key: string) => cacheInstance.has(key);
  const del = (key: string) => cacheInstance.delete(key);
  const clear = () => cacheInstance.clear();
  const getStats = () => cacheInstance.getStats();
  const invalidateByTags = (tags: string[]) =>
    cacheInstance.invalidateByTags(tags);

  return {
    get,
    set,
    has,
    delete: del,
    clear,
    getStats,
    invalidateByTags,
  };
}
