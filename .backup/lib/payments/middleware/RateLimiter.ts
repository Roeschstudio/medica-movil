import { NextRequest, NextResponse } from "next/server";

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: NextRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export class RateLimiter {
  private static stores = new Map<
    string,
    Map<string, { count: number; resetTime: number }>
  >();

  /**
   * Create rate limiting middleware for payment endpoints
   */
  static createPaymentRateLimit(config: RateLimitConfig) {
    const storeName = `payment_${config.windowMs}_${config.maxRequests}`;

    if (!this.stores.has(storeName)) {
      this.stores.set(storeName, new Map());
    }

    return async (
      request: NextRequest
    ): Promise<{
      allowed: boolean;
      info: RateLimitInfo;
      response?: NextResponse;
    }> => {
      const store = this.stores.get(storeName)!;
      const key = config.keyGenerator
        ? config.keyGenerator(request)
        : this.getDefaultKey(request);
      const now = Date.now();

      // Clean up expired entries
      this.cleanupExpiredEntries(store, now);

      // Get or create entry for this key
      let entry = store.get(key);
      if (!entry || now >= entry.resetTime) {
        entry = {
          count: 0,
          resetTime: now + config.windowMs,
        };
        store.set(key, entry);
      }

      // Check if limit exceeded
      const isAllowed = entry.count < config.maxRequests;

      if (isAllowed) {
        entry.count++;
      }

      const info: RateLimitInfo = {
        limit: config.maxRequests,
        remaining: Math.max(0, config.maxRequests - entry.count),
        resetTime: entry.resetTime,
        retryAfter: isAllowed
          ? undefined
          : Math.ceil((entry.resetTime - now) / 1000),
      };

      if (!isAllowed) {
        const response = NextResponse.json(
          {
            error: config.message || "Too many requests",
            retryAfter: info.retryAfter,
          },
          { status: 429 }
        );

        // Add rate limit headers
        response.headers.set(
          "X-RateLimit-Limit",
          config.maxRequests.toString()
        );
        response.headers.set(
          "X-RateLimit-Remaining",
          info.remaining.toString()
        );
        response.headers.set(
          "X-RateLimit-Reset",
          Math.ceil(entry.resetTime / 1000).toString()
        );
        response.headers.set("Retry-After", info.retryAfter!.toString());

        return { allowed: false, info, response };
      }

      return { allowed: true, info };
    };
  }

  /**
   * Predefined rate limiters for different payment operations
   */
  static readonly PAYMENT_CREATION_LIMITER = this.createPaymentRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10, // 10 payment attempts per 15 minutes per user
    message: "Too many payment attempts. Please try again later.",
    keyGenerator: (request) => {
      // Use user ID from session if available, otherwise IP
      const userId = request.headers.get("x-user-id");
      return userId || request.ip || "anonymous";
    },
  });

  static readonly WEBHOOK_LIMITER = this.createPaymentRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 webhooks per minute per provider
    message: "Webhook rate limit exceeded",
    keyGenerator: (request) => {
      const provider = request.nextUrl.pathname.split("/").pop();
      const ip = request.ip || "unknown";
      return `webhook_${provider}_${ip}`;
    },
  });

  static readonly STATUS_CHECK_LIMITER = this.createPaymentRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 status checks per minute per user
    message: "Too many status check requests",
    keyGenerator: (request) => {
      const userId = request.headers.get("x-user-id");
      return `status_${userId || request.ip || "anonymous"}`;
    },
  });

  static readonly ADMIN_DASHBOARD_LIMITER = this.createPaymentRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute for admin dashboard
    message: "Admin dashboard rate limit exceeded",
    keyGenerator: (request) => {
      const userId = request.headers.get("x-user-id");
      return `admin_${userId || request.ip || "anonymous"}`;
    },
  });

  /**
   * Apply rate limiting to a request
   */
  static async applyRateLimit(
    request: NextRequest,
    limiterType: "payment" | "webhook" | "status" | "admin"
  ): Promise<{ allowed: boolean; response?: NextResponse }> {
    let limiter;

    switch (limiterType) {
      case "payment":
        limiter = this.PAYMENT_CREATION_LIMITER;
        break;
      case "webhook":
        limiter = this.WEBHOOK_LIMITER;
        break;
      case "status":
        limiter = this.STATUS_CHECK_LIMITER;
        break;
      case "admin":
        limiter = this.ADMIN_DASHBOARD_LIMITER;
        break;
      default:
        throw new Error(`Unknown limiter type: ${limiterType}`);
    }

    const result = await limiter(request);
    return { allowed: result.allowed, response: result.response };
  }

  /**
   * Get default key for rate limiting (IP address)
   */
  private static getDefaultKey(request: NextRequest): string {
    // Try to get real IP from various headers
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const cfConnectingIp = request.headers.get("cf-connecting-ip");

    return (
      cfConnectingIp ||
      realIp ||
      (forwarded && forwarded.split(",")[0].trim()) ||
      request.ip ||
      "unknown"
    );
  }

  /**
   * Clean up expired entries from store
   */
  private static cleanupExpiredEntries(
    store: Map<string, { count: number; resetTime: number }>,
    now: number
  ): void {
    for (const [key, entry] of store.entries()) {
      if (now >= entry.resetTime) {
        store.delete(key);
      }
    }
  }

  /**
   * Get current rate limit status for a key
   */
  static getRateLimitStatus(
    storeName: string,
    key: string
  ): RateLimitInfo | null {
    const store = this.stores.get(storeName);
    if (!store) return null;

    const entry = store.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now >= entry.resetTime) return null;

    // Extract config from store name (basic parsing)
    const parts = storeName.split("_");
    const maxRequests = parseInt(parts[parts.length - 1]) || 100;

    return {
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - entry.count),
      resetTime: entry.resetTime,
      retryAfter:
        entry.count >= maxRequests
          ? Math.ceil((entry.resetTime - now) / 1000)
          : undefined,
    };
  }

  /**
   * Reset rate limit for a specific key (admin function)
   */
  static resetRateLimit(storeName: string, key: string): boolean {
    const store = this.stores.get(storeName);
    if (!store) return false;

    return store.delete(key);
  }

  /**
   * Get all active rate limit entries (admin function)
   */
  static getAllRateLimits(): Record<
    string,
    Array<{ key: string; count: number; resetTime: number }>
  > {
    const result: Record<
      string,
      Array<{ key: string; count: number; resetTime: number }>
    > = {};

    for (const [storeName, store] of this.stores.entries()) {
      result[storeName] = [];
      for (const [key, entry] of store.entries()) {
        result[storeName].push({
          key,
          count: entry.count,
          resetTime: entry.resetTime,
        });
      }
    }

    return result;
  }

  /**
   * Clear all rate limit data (admin function)
   */
  static clearAllRateLimits(): void {
    for (const store of this.stores.values()) {
      store.clear();
    }
  }

  /**
   * Periodic cleanup of expired entries
   */
  static startPeriodicCleanup(
    intervalMs: number = 5 * 60 * 1000
  ): NodeJS.Timeout {
    return setInterval(() => {
      const now = Date.now();
      for (const store of this.stores.values()) {
        this.cleanupExpiredEntries(store, now);
      }
    }, intervalMs);
  }
}
