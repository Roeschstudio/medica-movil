import { NextRequest, NextResponse } from "next/server";
import { ChatSecurityAuditor } from "./chat-validation";

interface ChatRateLimitConfig {
  windowMs: number;
  maxRequests: number;
  burstLimit?: number; // Allow short bursts
  burstWindowMs?: number;
  keyGenerator?: (request: NextRequest, context?: any) => string;
  skipCondition?: (request: NextRequest, context?: any) => boolean;
  onLimitReached?: (key: string, request: NextRequest) => void;
  message?: string;
  statusCode?: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  burstCount?: number;
  burstResetTime?: number;
  firstRequest: number;
  violations: number;
}

// Enhanced in-memory store with persistence capability
class ChatRateLimitStore {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired entries every 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 30000);
  }

  get(key: string): RateLimitEntry | undefined {
    return this.store.get(key);
  }

  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry);
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (
        entry.resetTime <= now &&
        (!entry.burstResetTime || entry.burstResetTime <= now)
      ) {
        this.store.delete(key);
      }
    }
  }

  getStats(): {
    totalKeys: number;
    activeKeys: number;
    violationsInLastHour: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    let activeKeys = 0;
    let violationsInLastHour = 0;

    for (const [key, entry] of this.store.entries()) {
      if (
        entry.resetTime > now ||
        (entry.burstResetTime && entry.burstResetTime > now)
      ) {
        activeKeys++;
      }
      if (entry.firstRequest > oneHourAgo && entry.violations > 0) {
        violationsInLastHour += entry.violations;
      }
    }

    return {
      totalKeys: this.store.size,
      activeKeys,
      violationsInLastHour,
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

const rateLimitStore = new ChatRateLimitStore();

export class ChatRateLimiter {
  private config: Required<ChatRateLimitConfig>;

  constructor(config: ChatRateLimitConfig) {
    this.config = {
      burstLimit: config.maxRequests * 2,
      burstWindowMs: 10000, // 10 seconds
      keyGenerator: (request) => this.getDefaultKey(request),
      skipCondition: () => false,
      onLimitReached: () => {},
      message: "Too many requests, please slow down",
      statusCode: 429,
      ...config,
    };
  }

  private getDefaultKey(request: NextRequest): string {
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ip = forwarded?.split(",")[0] || realIp || "unknown";
    return `chat:${ip}`;
  }

  async checkLimit(
    request: NextRequest,
    context?: any
  ): Promise<{
    allowed: boolean;
    limit: number;
    remaining: number;
    resetTime: number;
    burstAllowed?: boolean;
    burstRemaining?: number;
    burstResetTime?: number;
  }> {
    // Check skip condition
    if (this.config.skipCondition(request, context)) {
      return {
        allowed: true,
        limit: this.config.maxRequests,
        remaining: this.config.maxRequests,
        resetTime: Date.now() + this.config.windowMs,
      };
    }

    const key = this.config.keyGenerator(request, context);
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    // Initialize or reset entry if window expired
    if (!entry || entry.resetTime <= now) {
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs,
        burstCount: 0,
        burstResetTime: now + this.config.burstWindowMs!,
        firstRequest: now,
        violations: entry?.violations || 0,
      };
    }

    // Reset burst window if expired
    if (entry.burstResetTime! <= now) {
      entry.burstCount = 0;
      entry.burstResetTime = now + this.config.burstWindowMs!;
    }

    // Check burst limit first
    const burstAllowed = entry.burstCount! < this.config.burstLimit!;
    const regularAllowed = entry.count < this.config.maxRequests;

    const allowed = burstAllowed && regularAllowed;

    if (allowed) {
      entry.count++;
      entry.burstCount!++;
      rateLimitStore.set(key, entry);
    } else {
      // Track violation
      entry.violations++;
      rateLimitStore.set(key, entry);

      // Call limit reached callback
      this.config.onLimitReached(key, request);

      // Log security event for excessive violations
      if (entry.violations > 10) {
        ChatSecurityAuditor.logSecurityEvent({
          userId: context?.user?.id || "unknown",
          chatRoomId: context?.chatRoomId,
          action: "rate_limit_violation",
          ipAddress: this.getClientIP(request),
          userAgent: request.headers.get("user-agent") || "unknown",
          details: {
            key,
            violations: entry.violations,
            windowMs: this.config.windowMs,
            maxRequests: this.config.maxRequests,
          },
          severity: entry.violations > 50 ? "critical" : "high",
        });
      }
    }

    return {
      allowed,
      limit: this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      resetTime: entry.resetTime,
      burstAllowed,
      burstRemaining: Math.max(0, this.config.burstLimit! - entry.burstCount!),
      burstResetTime: entry.burstResetTime,
    };
  }

  private getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    return forwarded?.split(",")[0] || realIp || "unknown";
  }

  async middleware(
    request: NextRequest,
    handler: (request: NextRequest) => Promise<NextResponse>,
    context?: any
  ): Promise<NextResponse> {
    const result = await this.checkLimit(request, context);

    if (!result.allowed) {
      const headers: Record<string, string> = {
        "X-RateLimit-Limit": result.limit.toString(),
        "X-RateLimit-Remaining": result.remaining.toString(),
        "X-RateLimit-Reset": result.resetTime.toString(),
        "Retry-After": Math.ceil(
          (result.resetTime - Date.now()) / 1000
        ).toString(),
      };

      if (result.burstRemaining !== undefined) {
        headers["X-RateLimit-Burst-Limit"] = this.config.burstLimit!.toString();
        headers["X-RateLimit-Burst-Remaining"] =
          result.burstRemaining.toString();
        headers["X-RateLimit-Burst-Reset"] = result.burstResetTime!.toString();
      }

      return NextResponse.json(
        {
          error: this.config.message,
          code: "RATE_LIMIT_EXCEEDED",
          limit: result.limit,
          remaining: result.remaining,
          resetTime: result.resetTime,
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        },
        {
          status: this.config.statusCode,
          headers,
        }
      );
    }

    const response = await handler(request);

    // Add rate limit headers to successful responses
    response.headers.set("X-RateLimit-Limit", result.limit.toString());
    response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
    response.headers.set("X-RateLimit-Reset", result.resetTime.toString());

    if (result.burstRemaining !== undefined) {
      response.headers.set(
        "X-RateLimit-Burst-Limit",
        this.config.burstLimit!.toString()
      );
      response.headers.set(
        "X-RateLimit-Burst-Remaining",
        result.burstRemaining.toString()
      );
      response.headers.set(
        "X-RateLimit-Burst-Reset",
        result.burstResetTime!.toString()
      );
    }

    return response;
  }
}

// User-specific chat rate limiter
export class UserChatRateLimiter extends ChatRateLimiter {
  constructor(config: ChatRateLimitConfig) {
    super({
      ...config,
      keyGenerator: (request, context) => this.getUserKey(request, context),
    });
  }

  private getUserKey(request: NextRequest, context?: any): string {
    if (context?.user?.id) {
      return `chat:user:${context.user.id}`;
    }

    // Fall back to IP-based limiting
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ip = forwarded?.split(",")[0] || realIp || "unknown";
    return `chat:ip:${ip}`;
  }
}

// Room-specific rate limiter
export class ChatRoomRateLimiter extends ChatRateLimiter {
  constructor(config: ChatRateLimitConfig) {
    super({
      ...config,
      keyGenerator: (request, context) => this.getRoomKey(request, context),
    });
  }

  private getRoomKey(request: NextRequest, context?: any): string {
    const userId = context?.user?.id || "unknown";
    const roomId = context?.chatRoomId || "unknown";
    return `chat:room:${roomId}:user:${userId}`;
  }
}

// Predefined chat rate limiters
export const chatMessageRateLimiter = new UserChatRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 messages per minute
  burstLimit: 10, // Allow 10 messages in quick succession
  burstWindowMs: 10 * 1000, // 10 seconds
  message: "You are sending messages too quickly. Please slow down.",
  onLimitReached: (key, request) => {
    console.warn(`Chat message rate limit exceeded for key: ${key}`);
  },
});

export const chatFileUploadRateLimiter = new UserChatRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5, // 5 file uploads per minute
  burstLimit: 3, // Allow 3 files in quick succession
  burstWindowMs: 30 * 1000, // 30 seconds
  message:
    "You are uploading files too quickly. Please wait before uploading more.",
  onLimitReached: (key, request) => {
    console.warn(`File upload rate limit exceeded for key: ${key}`);
  },
});

export const chatRoomCreationRateLimiter = new UserChatRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 3, // 3 room creations per minute
  burstLimit: 2, // Allow 2 rooms in quick succession
  burstWindowMs: 60 * 1000, // 1 minute
  message: "You are creating chat rooms too quickly. Please wait.",
  onLimitReached: (key, request) => {
    console.warn(`Chat room creation rate limit exceeded for key: ${key}`);
  },
});

// Adaptive rate limiter that adjusts based on user behavior
export class AdaptiveChatRateLimiter extends UserChatRateLimiter {
  private userBehaviorScores = new Map<string, number>();

  constructor(config: ChatRateLimitConfig) {
    super(config);
  }

  private calculateUserScore(userId: string): number {
    // Get user's recent security events
    const recentEvents = ChatSecurityAuditor.getSecurityLogs({
      userId,
      since: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    });

    let score = 100; // Start with perfect score

    // Deduct points for violations
    recentEvents.forEach((event) => {
      switch (event.severity) {
        case "low":
          score -= 1;
          break;
        case "medium":
          score -= 5;
          break;
        case "high":
          score -= 15;
          break;
        case "critical":
          score -= 30;
          break;
      }
    });

    return Math.max(0, Math.min(100, score));
  }

  async checkLimit(request: NextRequest, context?: any): Promise<any> {
    if (context?.user?.id) {
      const userScore = this.calculateUserScore(context.user.id);
      this.userBehaviorScores.set(context.user.id, userScore);

      // Adjust limits based on user score
      if (userScore < 50) {
        // Reduce limits for suspicious users
        this.config.maxRequests = Math.floor(this.config.maxRequests * 0.5);
        this.config.burstLimit = Math.floor(this.config.burstLimit! * 0.3);
      } else if (userScore > 90) {
        // Increase limits for trusted users
        this.config.maxRequests = Math.floor(this.config.maxRequests * 1.5);
        this.config.burstLimit = Math.floor(this.config.burstLimit! * 1.2);
      }
    }

    return super.checkLimit(request, context);
  }

  getUserScore(userId: string): number {
    return this.userBehaviorScores.get(userId) || 100;
  }
}

// Rate limiting middleware factory
export const withChatRateLimit = (rateLimiter: ChatRateLimiter) => {
  return (
    handler: (request: NextRequest, context?: any) => Promise<NextResponse>,
    contextExtractor?: (request: NextRequest) => any
  ) => {
    return async (request: NextRequest) => {
      const context = contextExtractor ? contextExtractor(request) : undefined;
      return rateLimiter.middleware(
        request,
        (req) => handler(req, context),
        context
      );
    };
  };
};

// Multiple rate limiters for comprehensive protection
export const withMultipleChatRateLimits = (rateLimiters: ChatRateLimiter[]) => {
  return (
    handler: (request: NextRequest, context?: any) => Promise<NextResponse>,
    contextExtractor?: (request: NextRequest) => any
  ) => {
    return async (request: NextRequest) => {
      const context = contextExtractor ? contextExtractor(request) : undefined;

      // Check all rate limiters
      for (const rateLimiter of rateLimiters) {
        const result = await rateLimiter.checkLimit(request, context);
        if (!result.allowed) {
          return NextResponse.json(
            {
              error: "Rate limit exceeded",
              code: "RATE_LIMIT_EXCEEDED",
              limit: result.limit,
              remaining: result.remaining,
              resetTime: result.resetTime,
              retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
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

      return handler(request, context);
    };
  };
};

// Get rate limiting statistics
export const getChatRateLimitStats = () => {
  return rateLimitStore.getStats();
};

// Cleanup function for graceful shutdown
export const cleanupChatRateLimit = () => {
  rateLimitStore.destroy();
};
