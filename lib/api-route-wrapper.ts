import { UserRole } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "./auth-config";
import { connectionHealthMonitor } from "./connection-health-monitor";
import {
  AuthenticationError,
  AuthorizationError,
  withErrorHandler,
} from "./error-handling-utils";

// Enhanced API route handler with comprehensive error handling and monitoring
export interface ApiRouteContext {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  };
  request: NextRequest;
  params?: Record<string, string>;
}

export type ApiRouteHandler = (
  request: NextRequest,
  context: ApiRouteContext
) => Promise<NextResponse>;

export interface ApiRouteOptions {
  requireAuth?: boolean;
  allowedRoles?: UserRole[];
  rateLimit?: {
    requests: number;
    windowMs: number;
  };
  timeout?: number;
  validateHealth?: boolean;
}

/**
 * Enhanced API route wrapper with comprehensive error handling
 */
export function createApiRoute(
  handler: ApiRouteHandler,
  options: ApiRouteOptions = {}
) {
  const {
    requireAuth = true,
    allowedRoles = [],
    timeout = 30000,
    validateHealth = false,
  } = options;

  return withErrorHandler(async (request: NextRequest, { params } = {}) => {
    const startTime = Date.now();

    try {
      // Health check validation
      if (validateHealth) {
        const healthReport = await connectionHealthMonitor.getSystemHealth();
        if (healthReport.overall === "unhealthy") {
          return NextResponse.json(
            {
              error: "System temporarily unavailable",
              code: "SYSTEM_UNHEALTHY",
            },
            { status: 503 }
          );
        }
      }

      // Timeout handling
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Request timeout")), timeout);
      });

      // Authentication check
      let user = null;
      if (requireAuth) {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
          throw new AuthenticationError("Authentication required");
        }

        user = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          role: session.user.role as UserRole,
        };

        // Role-based authorization
        if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
          throw new AuthorizationError(
            `Access denied. Required roles: ${allowedRoles.join(", ")}`
          );
        }
      }

      // Create context
      const context: ApiRouteContext = {
        user: user!,
        request,
        params: params || {},
      };

      // Execute handler with timeout
      const response = await Promise.race([
        handler(request, context),
        timeoutPromise,
      ]);

      // Add performance headers
      const duration = Date.now() - startTime;
      response.headers.set("X-Response-Time", `${duration}ms`);

      // Log slow requests
      if (duration > 5000) {
        ErrorLogger.log(new Error(`Slow API request: ${request.method} ${request.url} took ${duration}ms`), { 
          context: "api_route_wrapper", 
          action: "slow_request_warning", 
          method: request.method, 
          url: request.url, 
          duration 
        });
      }

      return response;
    } catch (error) {
      // Log error with context
      ErrorLogger.log(error as Error, {
        context: "api_route_wrapper",
        action: "api_route_error",
        method: request.method,
        url: request.url,
        duration: Date.now() - startTime,
        userAgent: request.headers.get("user-agent"),
      });

      throw error;
    }
  });
}

/**
 * Specific wrappers for different route types
 */

// Public route (no authentication required)
export function createPublicRoute(handler: ApiRouteHandler) {
  return createApiRoute(handler, { requireAuth: false });
}

// Protected route (authentication required)
export function createProtectedRoute(handler: ApiRouteHandler) {
  return createApiRoute(handler, { requireAuth: true });
}

// Admin-only route
export function createAdminRoute(handler: ApiRouteHandler) {
  return createApiRoute(handler, {
    requireAuth: true,
    allowedRoles: [UserRole.ADMIN],
  });
}

// Doctor-only route
export function createDoctorRoute(handler: ApiRouteHandler) {
  return createApiRoute(handler, {
    requireAuth: true,
    allowedRoles: [UserRole.DOCTOR, UserRole.ADMIN],
  });
}

// Patient-only route
export function createPatientRoute(handler: ApiRouteHandler) {
  return createApiRoute(handler, {
    requireAuth: true,
    allowedRoles: [UserRole.PATIENT, UserRole.ADMIN],
  });
}

// High-availability route with health checks
export function createCriticalRoute(handler: ApiRouteHandler) {
  return createApiRoute(handler, {
    requireAuth: true,
    validateHealth: true,
    timeout: 10000, // Shorter timeout for critical routes
  });
}

/**
 * Database operation wrapper with retry logic
 */
export async function withDatabaseOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on validation errors
      if (error instanceof Error && error.message.includes("validation")) {
        throw error;
      }

      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise((resolve) => {
        setTimeout(resolve, delay);
      });
    }
  }

  throw lastError!;
}

/**
 * Validation helper for request bodies
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  schema: any
): Promise<T> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Invalid JSON in request body");
    }
    throw error;
  }
}

/**
 * Pagination helper
 */
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaultLimit: number = 10,
  maxLimit: number = 100
): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(searchParams.get("limit") || String(defaultLimit), 10))
  );
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Response helpers
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  status: number = 200
) {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(message && { message }),
    },
    { status }
  );
}

export function createPaginatedResponse<T>(
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  },
  message?: string
) {
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      ...pagination,
      pages: Math.ceil(pagination.total / pagination.limit),
      hasMore: pagination.page * pagination.limit < pagination.total,
    },
    ...(message && { message }),
  });
}
