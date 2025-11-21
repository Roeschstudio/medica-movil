import { NextRequest, NextResponse } from "next/server";

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: NextRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
  statusCode?: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (in production, use Redis)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime <= now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Cleanup every minute

export class RateLimiter {
  private config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig) {
    this.config = {
      keyGenerator: (request) => this.getClientIdentifier(request),
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      message: "Too many requests, please try again later",
      statusCode: 429,
      ...config,
    };
  }

  private getClientIdentifier(request: NextRequest): string {
    // Try to get IP from various headers (for proxies/load balancers)
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ip = forwarded?.split(",")[0] || realIp || "unknown";

    // Include user agent for additional uniqueness
    const userAgent = request.headers.get("user-agent") || "unknown";

    return `${ip}:${userAgent}`;
  }

  public async checkLimit(request: NextRequest): Promise<{
    allowed: boolean;
    limit: number;
    remaining: number;
    resetTime: number;
  }> {
    const key = this.config.keyGenerator(request);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    let entry = rateLimitStore.get(key);

    // Reset if window has expired
    if (!entry || entry.resetTime <= now) {
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs,
      };
    }

    const allowed = entry.count < this.config.maxRequests;

    if (allowed) {
      entry.count++;
      rateLimitStore.set(key, entry);
    }

    return {
      allowed,
      limit: this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      resetTime: entry.resetTime,
    };
  }

  public async middleware(
    request: NextRequest,
    handler: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    const result = await this.checkLimit(request);

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: this.config.message,
          code: "RATE_LIMIT_EXCEEDED",
          limit: result.limit,
          remaining: result.remaining,
          resetTime: result.resetTime,
        },
        {
          status: this.config.statusCode,
          headers: {
            "X-RateLimit-Limit": result.limit.toString(),
            "X-RateLimit-Remaining": result.remaining.toString(),
            "X-RateLimit-Reset": result.resetTime.toString(),
            "Retry-After": Math.ceil(
              (result.resetTime - Date.now()) / 1000
            ).toString(),
          },
        }
      );
    }

    const response = await handler();

    // Add rate limit headers to successful responses
    response.headers.set("X-RateLimit-Limit", result.limit.toString());
    response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
    response.headers.set("X-RateLimit-Reset", result.resetTime.toString());

    return response;
  }
}

// Predefined rate limiters for different endpoints
export const chatRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 messages per minute
  message: "Too many messages sent. Please slow down.",
});

export const fileUploadRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 file uploads per minute
  message: "Too many file uploads. Please wait before uploading more files.",
});

export const apiRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 API calls per minute
  message: "Too many API requests. Please slow down.",
});

export const authRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 login attempts per 15 minutes
  message: "Too many authentication attempts. Please try again later.",
});

// User-specific rate limiting (requires authentication)
export class UserRateLimiter extends RateLimiter {
  constructor(config: RateLimitConfig) {
    super({
      ...config,
      keyGenerator: (request) => this.getUserIdentifier(request),
    });
  }

  private getUserIdentifier(request: NextRequest): string {
    // Extract user ID from JWT token or session
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        // In a real implementation, you'd decode the JWT token
        // For now, we'll use a placeholder
        const token = authHeader.substring(7);
        return `user:${token.substring(0, 10)}`; // Use first 10 chars as identifier
      } catch {
        // Fall back to IP-based limiting
        return this.getClientIdentifier(request);
      }
    }

    return this.getClientIdentifier(request);
  }

  private getClientIdentifier(request: NextRequest): string {
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ip = forwarded?.split(",")[0] || realIp || "unknown";
    return `ip:${ip}`;
  }
}

export const userChatRateLimiter = new UserRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 messages per minute per user
  message: "You are sending messages too quickly. Please slow down.",
});

export const userFileUploadRateLimiter = new UserRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5, // 5 file uploads per minute per user
  message:
    "You are uploading files too quickly. Please wait before uploading more.",
});

// Rate limiting middleware factory
export const withRateLimit = (rateLimiter: RateLimiter) => {
  return (handler: (request: NextRequest) => Promise<NextResponse>) => {
    return async (request: NextRequest) => {
      return rateLimiter.middleware(request, () => handler(request));
    };
  };
};

// Multiple rate limiters middleware
export const withMultipleRateLimits = (rateLimiters: RateLimiter[]) => {
  return (handler: (request: NextRequest) => Promise<NextResponse>) => {
    return async (request: NextRequest) => {
      // Check all rate limiters
      for (const rateLimiter of rateLimiters) {
        const result = await rateLimiter.checkLimit(request);
        if (!result.allowed) {
          return NextResponse.json(
            {
              error: "Rate limit exceeded",
              code: "RATE_LIMIT_EXCEEDED",
              limit: result.limit,
              remaining: result.remaining,
              resetTime: result.resetTime,
            },
            {
              status: 429,
              headers: {
                "X-RateLimit-Limit": result.limit.toString(),
                "X-RateLimit-Remaining": result.remaining.toString(),
                "X-RateLimit-Reset": result.resetTime.toString(),
                "Retry-After": Math.ceil(
                  (result.resetTime - Date.now()) / 1000
                ).toString(),
              },
            }
          );
        }
      }

      return handler(request);
    };
  };
};
