import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

// Standard error types
export interface AppError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;
}

// Error codes
export const ERROR_CODES = {
  // Authentication errors
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  INVALID_TOKEN: "INVALID_TOKEN",
  SESSION_EXPIRED: "SESSION_EXPIRED",

  // Validation errors
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",

  // Database errors
  DATABASE_ERROR: "DATABASE_ERROR",
  RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
  DUPLICATE_RECORD: "DUPLICATE_RECORD",
  CONNECTION_ERROR: "CONNECTION_ERROR",

  // External service errors
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
  PAYMENT_ERROR: "PAYMENT_ERROR",
  EMAIL_ERROR: "EMAIL_ERROR",

  // System errors
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  FILE_UPLOAD_ERROR: "FILE_UPLOAD_ERROR",
} as const;

/**
 * Custom application error class
 */
export class ApplicationError extends Error implements AppError {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = ERROR_CODES.INTERNAL_SERVER_ERROR,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = "ApplicationError";
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, ApplicationError);
  }
}

/**
 * Specific error classes for different scenarios
 */
export class ValidationError extends ApplicationError {
  constructor(message: string, details?: any) {
    super(message, 400, ERROR_CODES.VALIDATION_ERROR);
    this.name = "ValidationError";
    if (details) {
      (this as any).details = details;
    }
  }
}

export class AuthenticationError extends ApplicationError {
  constructor(message: string = "Authentication required") {
    super(message, 401, ERROR_CODES.UNAUTHORIZED);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends ApplicationError {
  constructor(message: string = "Insufficient permissions") {
    super(message, 403, ERROR_CODES.FORBIDDEN);
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends ApplicationError {
  constructor(resource: string = "Resource") {
    super(`${resource} not found`, 404, ERROR_CODES.RECORD_NOT_FOUND);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends ApplicationError {
  constructor(message: string) {
    super(message, 409, ERROR_CODES.DUPLICATE_RECORD);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends ApplicationError {
  constructor(message: string = "Rate limit exceeded") {
    super(message, 429, ERROR_CODES.RATE_LIMIT_EXCEEDED);
    this.name = "RateLimitError";
  }
}

/**
 * Error handler wrapper for API routes
 */
export function withErrorHandler<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error);
    }
  };
}

/**
 * Centralized API error handler
 */
export function handleApiError(error: unknown): NextResponse {
  console.error("API Error:", error);

  // Handle known application errors
  if (error instanceof ApplicationError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
      },
      { status: error.statusCode }
    );
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation failed",
        code: ERROR_CODES.VALIDATION_ERROR,
        details: error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        })),
      },
      { status: 400 }
    );
  }

  // Handle Prisma errors
  if (error && typeof error === "object" && "code" in error) {
    const prismaError = error as any;

    switch (prismaError.code) {
      case "P2002":
        return NextResponse.json(
          {
            error: "A record with this information already exists",
            code: ERROR_CODES.DUPLICATE_RECORD,
          },
          { status: 409 }
        );

      case "P2025":
        return NextResponse.json(
          {
            error: "Record not found",
            code: ERROR_CODES.RECORD_NOT_FOUND,
          },
          { status: 404 }
        );

      case "P2003":
        return NextResponse.json(
          {
            error: "Foreign key constraint failed",
            code: ERROR_CODES.VALIDATION_ERROR,
          },
          { status: 400 }
        );

      default:
        return NextResponse.json(
          {
            error: "Database operation failed",
            code: ERROR_CODES.DATABASE_ERROR,
          },
          { status: 500 }
        );
    }
  }

  // Handle generic errors
  if (error instanceof Error) {
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : "Internal server error",
        code: ERROR_CODES.INTERNAL_SERVER_ERROR,
        ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
      },
      { status: 500 }
    );
  }

  // Handle unknown errors
  return NextResponse.json(
    {
      error: "An unexpected error occurred",
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    },
    { status: 500 }
  );
}

/**
 * Async wrapper with error handling
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  fallback?: T
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    console.error("Safe async operation failed:", error);
    return fallback;
  }
}

/**
 * Database operation wrapper with retry logic
 */
export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on validation errors or not found errors
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }

      if (attempt === maxRetries) {
        break;
      }

      // Wait before retrying with exponential backoff
      await new Promise((resolve) => {
        setTimeout(resolve, delay * attempt);
      });
    }
  }

  throw new ApplicationError(
    `Database operation failed after ${maxRetries} attempts: ${
      lastError!.message
    }`,
    500,
    ERROR_CODES.DATABASE_ERROR
  );
}

/**
 * External service call wrapper with timeout and retry
 */
export async function withExternalServiceCall<T>(
  operation: () => Promise<T>,
  timeoutMs: number = 10000,
  maxRetries: number = 2
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Operation timeout")), timeoutMs);
  });

  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await Promise.race([operation(), timeoutPromise]);
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        break;
      }

      // Wait before retrying
      await new Promise((resolve) => {
        setTimeout(resolve, 1000 * attempt);
      });
    }
  }

  throw new ApplicationError(
    `External service call failed: ${lastError!.message}`,
    503,
    ERROR_CODES.EXTERNAL_SERVICE_ERROR
  );
}

/**
 * Validation helper with better error messages
 */
export function validateRequired<T>(
  value: T | null | undefined,
  fieldName: string
): T {
  if (value === null || value === undefined || value === "") {
    throw new ValidationError(`${fieldName} is required`);
  }
  return value;
}

/**
 * Email validation helper
 */
export function validateEmail(email: string): string {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError("Invalid email format");
  }
  return email.toLowerCase().trim();
}

/**
 * Phone validation helper (Mexican format)
 */
export function validateMexicanPhone(phone: string): string {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, "");

  // Check if it's a valid Mexican phone number
  if (cleaned.length === 10) {
    return `+52${cleaned}`;
  } else if (cleaned.length === 12 && cleaned.startsWith("52")) {
    return `+${cleaned}`;
  } else if (cleaned.length === 13 && cleaned.startsWith("52")) {
    return `+${cleaned}`;
  }

  throw new ValidationError("Invalid Mexican phone number format");
}

/**
 * Error boundary for React components
 */
export class ErrorBoundary extends Error {
  constructor(
    public readonly componentName: string,
    public readonly originalError: Error
  ) {
    super(`Error in component ${componentName}: ${originalError.message}`);
    this.name = "ErrorBoundary";
  }
}

/**
 * Logger utility for errors
 */
export class ErrorLogger {
  static log(error: Error, context?: Record<string, any>) {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      name: error.name,
      message: error.message,
      stack: error.stack,
      context,
    };

    // In production, you would send this to your logging service
    if (process.env.NODE_ENV === "production") {
      // Send to logging service (e.g., Sentry, LogRocket, etc.)
      console.error("Production Error:", JSON.stringify(errorInfo, null, 2));
    } else {
      console.error("Development Error:", errorInfo);
    }
  }

  static logApiError(
    error: Error,
    request: NextRequest,
    additionalContext?: Record<string, any>
  ) {
    const context = {
      method: request.method,
      url: request.url,
      userAgent: request.headers.get("user-agent"),
      ...additionalContext,
    };

    this.log(error, context);
  }
}

/**
 * Performance monitoring for error-prone operations
 */
export async function withPerformanceMonitoring<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await operation();
    const duration = Date.now() - startTime;

    // Log successful operations that take too long
    if (duration > 5000) {
      console.warn(
        `Slow operation detected: ${operationName} took ${duration}ms`
      );
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    ErrorLogger.log(error as Error, {
      operation: operationName,
      duration,
    });
    throw error;
  }
}

/**
 * Circuit breaker pattern for external services
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";

  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = "HALF_OPEN";
      } else {
        throw new ApplicationError(
          "Circuit breaker is OPEN",
          503,
          ERROR_CODES.EXTERNAL_SERVICE_ERROR
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = "CLOSED";
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = "OPEN";
    }
  }
}

// Export commonly used instances
export const paymentCircuitBreaker = new CircuitBreaker(3, 30000);
export const emailCircuitBreaker = new CircuitBreaker(5, 60000);
