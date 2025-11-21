import { prisma } from "@/lib/db";
import {
  PaymentProviderType,
  PaymentRequest,
  PaymentResult,
  PaymentStatus,
} from "../types";

export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

export interface PaymentLogEntry {
  id: string;
  level: LogLevel;
  provider: PaymentProviderType;
  operation: string;
  message: string;
  data?: Record<string, any>;
  timestamp: Date;
  duration?: number;
  success: boolean;
}

export class PaymentLogger {
  private static logs: PaymentLogEntry[] = [];
  private static readonly MAX_MEMORY_LOGS = 1000;

  static async logPaymentOperation(
    provider: PaymentProviderType,
    operation: string,
    data: Record<string, any>,
    success: boolean,
    duration?: number,
    level: LogLevel = LogLevel.INFO
  ): Promise<void> {
    const logEntry: PaymentLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level,
      provider,
      operation,
      message: `${operation} ${
        success ? "succeeded" : "failed"
      } for ${provider}`,
      data: this.sanitizeLogData(data),
      timestamp: new Date(),
      duration,
      success,
    };

    // Add to memory logs
    this.logs.push(logEntry);
    if (this.logs.length > this.MAX_MEMORY_LOGS) {
      this.logs = this.logs.slice(-this.MAX_MEMORY_LOGS);
    }

    // Console logging
    const logMethod = this.getConsoleMethod(level);
    console[logMethod](`[${provider.toUpperCase()}] ${operation}:`, {
      success,
      duration: duration ? `${duration}ms` : undefined,
      data: logEntry.data,
    });

    // Persist to database (async, don't block)
    this.persistLogEntry(logEntry).catch((error) => {
      console.error("Failed to persist log entry:", error);
    });
  }

  static async logPaymentCreation(
    provider: PaymentProviderType,
    request: PaymentRequest,
    result: PaymentResult,
    duration: number
  ): Promise<void> {
    await this.logPaymentOperation(
      provider,
      "payment_creation",
      {
        appointmentId: request.appointmentId,
        amount: request.amount,
        currency: request.currency,
        success: result.success,
        paymentId: result.paymentId,
        error: result.error,
      },
      result.success,
      duration
    );

    // Update metrics
    await this.updateMetrics(
      provider,
      "payment_creation",
      result.success,
      duration
    );
  }

  static async logPaymentCapture(
    provider: PaymentProviderType,
    paymentId: string,
    result: PaymentResult,
    duration: number
  ): Promise<void> {
    await this.logPaymentOperation(
      provider,
      "payment_capture",
      {
        paymentId,
        success: result.success,
        error: result.error,
      },
      result.success,
      duration
    );

    await this.updateMetrics(
      provider,
      "payment_capture",
      result.success,
      duration
    );
  }

  static async logPaymentStatusCheck(
    provider: PaymentProviderType,
    paymentId: string,
    status: PaymentStatus | null,
    duration: number
  ): Promise<void> {
    await this.logPaymentOperation(
      provider,
      "status_check",
      {
        paymentId,
        status: status?.status || "unknown",
      },
      status !== null,
      duration
    );

    await this.updateMetrics(
      provider,
      "status_check",
      status !== null,
      duration
    );
  }

  static async logWebhookProcessing(
    provider: PaymentProviderType,
    eventType: string,
    paymentId: string,
    success: boolean,
    duration: number,
    error?: string
  ): Promise<void> {
    await this.logPaymentOperation(
      provider,
      "webhook_processing",
      {
        eventType,
        paymentId,
        error,
      },
      success,
      duration
    );

    await this.updateMetrics(provider, "webhook_processing", success, duration);
  }

  private static sanitizeLogData(
    data: Record<string, any>
  ): Record<string, any> {
    const sanitized = { ...data };

    // Remove sensitive information
    const sensitiveFields = [
      "password",
      "token",
      "secret",
      "key",
      "authorization",
      "cardNumber",
      "cvv",
      "expiryDate",
      "ssn",
      "taxId",
    ];

    const sanitizeObject = (obj: any): any => {
      if (typeof obj !== "object" || obj === null) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }

      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveFields.some((field) => lowerKey.includes(field))) {
          result[key] = "[REDACTED]";
        } else if (typeof value === "object") {
          result[key] = sanitizeObject(value);
        } else {
          result[key] = value;
        }
      }
      return result;
    };

    return sanitizeObject(sanitized);
  }

  private static getConsoleMethod(
    level: LogLevel
  ): "log" | "warn" | "error" | "debug" {
    switch (level) {
      case LogLevel.DEBUG:
        return "debug";
      case LogLevel.INFO:
        return "log";
      case LogLevel.WARN:
        return "warn";
      case LogLevel.ERROR:
        return "error";
      default:
        return "log";
    }
  }

  private static async persistLogEntry(entry: PaymentLogEntry): Promise<void> {
    try {
      await prisma.paymentOperationLog.create({
        data: {
          id: entry.id,
          level: entry.level,
          provider: entry.provider,
          operation: entry.operation,
          message: entry.message,
          data: entry.data as any,
          timestamp: entry.timestamp,
          duration: entry.duration,
          success: entry.success,
        },
      });
    } catch (error) {
      // Don't throw here to avoid breaking the main operation
      console.error("Failed to persist log entry to database:", error);
    }
  }

  private static async updateMetrics(
    provider: PaymentProviderType,
    operation: string,
    success: boolean,
    duration: number
  ): Promise<void> {
    try {
      const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

      await prisma.paymentMetrics.upsert({
        where: {
          provider_date: { provider, date },
        },
        update: {
          totalPayments: { increment: 1 },
          successfulPayments: success ? { increment: 1 } : undefined,
          averageProcessingTime: {
            // Calculate running average
            // This is a simplified approach - in production you might want more sophisticated metrics
            set: duration,
          },
        },
        create: {
          provider,
          date,
          totalPayments: 1,
          successfulPayments: success ? 1 : 0,
          totalErrors: 0,
          averageProcessingTime: duration,
        },
      });
    } catch (error) {
      console.error("Failed to update payment metrics:", error);
    }
  }

  // Query methods
  static getRecentLogs(limit: number = 100): PaymentLogEntry[] {
    return this.logs.slice(-limit);
  }

  static getLogsByProvider(provider: PaymentProviderType): PaymentLogEntry[] {
    return this.logs.filter((log) => log.provider === provider);
  }

  static getLogsByOperation(operation: string): PaymentLogEntry[] {
    return this.logs.filter((log) => log.operation === operation);
  }

  static getFailedOperations(): PaymentLogEntry[] {
    return this.logs.filter((log) => !log.success);
  }

  static async getOperationStats(hours: number = 24): Promise<{
    total: number;
    successful: number;
    failed: number;
    byProvider: Record<
      string,
      { total: number; successful: number; failed: number }
    >;
    byOperation: Record<
      string,
      { total: number; successful: number; failed: number }
    >;
    averageDuration: number;
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    try {
      const logs = await prisma.paymentOperationLog.findMany({
        where: {
          timestamp: { gte: since },
        },
      });

      const stats = {
        total: logs.length,
        successful: 0,
        failed: 0,
        byProvider: {} as Record<
          string,
          { total: number; successful: number; failed: number }
        >,
        byOperation: {} as Record<
          string,
          { total: number; successful: number; failed: number }
        >,
        averageDuration: 0,
      };

      let totalDuration = 0;
      let durationsCount = 0;

      logs.forEach((log) => {
        if (log.success) {
          stats.successful++;
        } else {
          stats.failed++;
        }

        // By provider
        if (!stats.byProvider[log.provider]) {
          stats.byProvider[log.provider] = {
            total: 0,
            successful: 0,
            failed: 0,
          };
        }
        stats.byProvider[log.provider].total++;
        if (log.success) {
          stats.byProvider[log.provider].successful++;
        } else {
          stats.byProvider[log.provider].failed++;
        }

        // By operation
        if (!stats.byOperation[log.operation]) {
          stats.byOperation[log.operation] = {
            total: 0,
            successful: 0,
            failed: 0,
          };
        }
        stats.byOperation[log.operation].total++;
        if (log.success) {
          stats.byOperation[log.operation].successful++;
        } else {
          stats.byOperation[log.operation].failed++;
        }

        // Duration
        if (log.duration) {
          totalDuration += log.duration;
          durationsCount++;
        }
      });

      stats.averageDuration =
        durationsCount > 0 ? totalDuration / durationsCount : 0;

      return stats;
    } catch (error) {
      console.error("Failed to get operation stats:", error);
      return {
        total: 0,
        successful: 0,
        failed: 0,
        byProvider: {},
        byOperation: {},
        averageDuration: 0,
      };
    }
  }

  static async getPerformanceMetrics(provider?: PaymentProviderType): Promise<{
    averageResponseTime: number;
    successRate: number;
    errorRate: number;
    throughput: number; // operations per hour
  }> {
    const hours = 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    try {
      const whereClause = provider
        ? { timestamp: { gte: since }, provider }
        : { timestamp: { gte: since } };

      const logs = await prisma.paymentOperationLog.findMany({
        where: whereClause,
      });

      if (logs.length === 0) {
        return {
          averageResponseTime: 0,
          successRate: 0,
          errorRate: 0,
          throughput: 0,
        };
      }

      const successful = logs.filter((log) => log.success).length;
      const failed = logs.length - successful;
      const totalDuration = logs
        .filter((log) => log.duration)
        .reduce((sum, log) => sum + (log.duration || 0), 0);
      const durationsCount = logs.filter((log) => log.duration).length;

      return {
        averageResponseTime:
          durationsCount > 0 ? totalDuration / durationsCount : 0,
        successRate: (successful / logs.length) * 100,
        errorRate: (failed / logs.length) * 100,
        throughput: logs.length / hours,
      };
    } catch (error) {
      console.error("Failed to get performance metrics:", error);
      return {
        averageResponseTime: 0,
        successRate: 0,
        errorRate: 0,
        throughput: 0,
      };
    }
  }
}
