import { prisma } from "@/lib/db";
import { PaymentError, PaymentProviderType } from "../types";
import {
  ClassifiedError,
  ErrorSeverity,
  PaymentErrorClassifier,
} from "./PaymentErrorClassifier";
import { ErrorLogger } from "../../error-handling-utils";

export interface ErrorNotification {
  id: string;
  error: ClassifiedError;
  timestamp: Date;
  context: Record<string, any>;
  resolved: boolean;
}

export class PaymentErrorHandler {
  private static errorLog: ErrorNotification[] = [];

  static async handleError(
    error: PaymentError,
    provider: PaymentProviderType,
    context: Record<string, any> = {}
  ): Promise<ClassifiedError> {
    // Classify the error
    const classifiedError = PaymentErrorClassifier.classifyError(
      error,
      provider,
      context
    );

    // Log the error
    await this.logError(classifiedError, context);

    // Send admin notification if needed
    if (classifiedError.shouldNotifyAdmin) {
      await this.notifyAdmin(classifiedError, context);
    }

    // Store error metrics
    await this.recordErrorMetrics(classifiedError, provider, context);

    return classifiedError;
  }

  static async retryWithBackoff<T>(
    operation: () => Promise<T>,
    error: ClassifiedError,
    maxAttempts?: number
  ): Promise<T> {
    const attempts = maxAttempts || error.retryStrategy.maxRetries;
    let lastError = error;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        if (attempt > 0) {
          const delay = PaymentErrorClassifier.getRetryDelay(error, attempt);
          await this.sleep(delay);
        }

        return await operation();
      } catch (err) {
        lastError = err as ClassifiedError;

        if (!PaymentErrorClassifier.shouldRetry(error, attempt + 1)) {
          break;
        }

        ErrorLogger.log(err as Error, { context: "payment_retry_attempt", level: "info", attempt: attempt + 1, maxAttempts: attempts });
      }
    }

    throw lastError;
  }

  private static async logError(
    error: ClassifiedError,
    context: Record<string, any>
  ): Promise<void> {
    const errorNotification: ErrorNotification = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      error,
      timestamp: new Date(),
      context,
      resolved: false,
    };

    // Add to in-memory log (for development)
    this.errorLog.push(errorNotification);

    // Keep only last 1000 errors in memory
    if (this.errorLog.length > 1000) {
      this.errorLog = this.errorLog.slice(-1000);
    }

    // Log to database for persistence
    try {
      await prisma.paymentErrorLog.create({
        data: {
          id: errorNotification.id,
          errorCode: error.code,
          errorMessage: error.message,
          provider: error.provider,
          category: error.category,
          severity: error.severity,
          userMessage: error.userMessage,
          adminMessage: error.adminMessage,
          retryable: error.retryable,
          context: context as any,
          timestamp: errorNotification.timestamp,
          resolved: false,
        },
      });
    } catch (dbError) {
      ErrorLogger.log(dbError as Error, { context: "payment_error_database_log", action: "log_to_database" });
    }

    // Log with ErrorLogger
    ErrorLogger.log(new Error(`Payment Error [${error.category}/${error.severity}]: ${error.message}`), {
      context: "payment_error_log",
      code: error.code,
      provider: error.provider,
      severity: error.severity,
      category: error.category,
      details: context
    });
  }

  private static async notifyAdmin(
    error: ClassifiedError,
    context: Record<string, any>
  ): Promise<void> {
    // In a real implementation, this would send notifications via:
    // - Email
    // - Slack
    // - SMS
    // - Push notifications
    // - Monitoring systems (Sentry, DataDog, etc.)

    const notification = {
      title: `Payment Error Alert - ${error.severity.toUpperCase()}`,
      message: error.adminMessage,
      details: {
        provider: error.provider,
        category: error.category,
        severity: error.severity,
        code: error.code,
        retryable: error.retryable,
        context,
      },
      timestamp: new Date().toISOString(),
    };

    // For now, log to console and store for later processing
    ErrorLogger.log(new Error(`Admin notification: ${notification.title}`), { context: "payment_admin_notification", notification });

    // Store notification for admin dashboard
    try {
      await prisma.adminNotification.create({
        data: {
          type: "PAYMENT_ERROR",
          title: notification.title,
          message: notification.message,
          severity: error.severity.toUpperCase(),
          data: notification.details as any,
          read: false,
          createdAt: new Date(),
        },
      });
    } catch (dbError) {
      ErrorLogger.log(dbError as Error, { context: "payment_admin_notification_storage", action: "store_notification" });
    }
  }

  private static async recordErrorMetrics(
    error: ClassifiedError,
    provider: PaymentProviderType,
    context: Record<string, any>
  ): Promise<void> {
    try {
      // Record error metrics for monitoring and analytics
      await prisma.paymentMetrics.upsert({
        where: {
          provider_date: {
            provider,
            date: new Date().toISOString().split("T")[0], // YYYY-MM-DD
          },
        },
        update: {
          totalErrors: { increment: 1 },
          errorsByCategory: {
            upsert: {
              [error.category]: { increment: 1 },
            },
          },
          errorsBySeverity: {
            upsert: {
              [error.severity]: { increment: 1 },
            },
          },
        },
        create: {
          provider,
          date: new Date().toISOString().split("T")[0],
          totalPayments: 0,
          successfulPayments: 0,
          totalErrors: 1,
          errorsByCategory: { [error.category]: 1 },
          errorsBySeverity: { [error.severity]: 1 },
        },
      });
    } catch (dbError) {
      ErrorLogger.log(dbError as Error, { context: "payment_error_metrics", action: "record_metrics" });
    }
  }

  private static getLogLevel(
    severity: ErrorSeverity
  ): "log" | "warn" | "error" {
    switch (severity) {
      case ErrorSeverity.LOW:
        return "log";
      case ErrorSeverity.MEDIUM:
        return "warn";
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        return "error";
      default:
        return "warn";
    }
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  // Utility methods for error analysis
  static getRecentErrors(limit: number = 100): ErrorNotification[] {
    return this.errorLog.slice(-limit);
  }

  static getErrorsByProvider(
    provider: PaymentProviderType
  ): ErrorNotification[] {
    return this.errorLog.filter(
      (notification) => notification.error.provider === provider
    );
  }

  static getErrorsByCategory(category: string): ErrorNotification[] {
    return this.errorLog.filter(
      (notification) => notification.error.category === category
    );
  }

  static getErrorsBySeverity(severity: ErrorSeverity): ErrorNotification[] {
    return this.errorLog.filter(
      (notification) => notification.error.severity === severity
    );
  }

  static async getErrorStats(hours: number = 24): Promise<{
    total: number;
    byProvider: Record<string, number>;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    try {
      const errors = await prisma.paymentErrorLog.findMany({
        where: {
          timestamp: { gte: since },
        },
      });

      const stats = {
        total: errors.length,
        byProvider: {} as Record<string, number>,
        byCategory: {} as Record<string, number>,
        bySeverity: {} as Record<string, number>,
      };

      errors.forEach((error) => {
        stats.byProvider[error.provider] =
          (stats.byProvider[error.provider] || 0) + 1;
        stats.byCategory[error.category] =
          (stats.byCategory[error.category] || 0) + 1;
        stats.bySeverity[error.severity] =
          (stats.bySeverity[error.severity] || 0) + 1;
      });

      return stats;
    } catch (dbError) {
      ErrorLogger.log(dbError as Error, { context: "payment_error_stats", action: "get_stats" });
      return {
        total: 0,
        byProvider: {},
        byCategory: {},
        bySeverity: {},
      };
    }
  }
}
