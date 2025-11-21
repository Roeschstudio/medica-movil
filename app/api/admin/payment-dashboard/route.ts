import { authOptions } from "@/lib/unified-auth";
import { PaymentErrorHandler } from "@/lib/payments/errors/PaymentErrorHandler";
import { PaymentMonitoring } from "@/lib/payments/monitoring";
import { PaymentLogger } from "@/lib/payments/monitoring/PaymentLogger";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { ErrorLogger } from "@/lib/error-handling-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Check if user is admin
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get("hours") || "24");

    // Get comprehensive dashboard data
    const [
      operationStats,
      errorStats,
      performanceMetrics,
      paymentStats,
      recentErrors,
      adminNotifications,
    ] = await Promise.all([
      PaymentLogger.getOperationStats(hours),
      PaymentErrorHandler.getErrorStats(hours),
      Promise.all([
        PaymentLogger.getPerformanceMetrics("stripe"),
        PaymentLogger.getPerformanceMetrics("paypal"),
        PaymentLogger.getPerformanceMetrics("mercadopago"),
        PaymentLogger.getPerformanceMetrics(), // Overall
      ]),
      new PaymentMonitoring().getPaymentStats(hours),
      getRecentErrors(10),
      getUnreadAdminNotifications(20),
    ]);

    const [stripeMetrics, paypalMetrics, mercadopagoMetrics, overallMetrics] =
      performanceMetrics;

    const dashboardData = {
      timeRange: `${hours} hours`,
      timestamp: new Date().toISOString(),

      // Overall statistics
      overview: {
        totalOperations: operationStats.total,
        successfulOperations: operationStats.successful,
        failedOperations: operationStats.failed,
        successRate:
          operationStats.total > 0
            ? Math.round(
                (operationStats.successful / operationStats.total) * 100
              )
            : 0,
        averageResponseTime: Math.round(operationStats.averageDuration),
        totalPayments: paymentStats.total,
        completedPayments: paymentStats.completed,
        pendingPayments: paymentStats.pending,
        failedPayments: paymentStats.failed,
      },

      // Provider-specific metrics
      providers: {
        stripe: {
          operations: operationStats.byProvider.stripe || {
            total: 0,
            successful: 0,
            failed: 0,
          },
          performance: stripeMetrics,
          payments: paymentStats.byProvider.stripe || 0,
        },
        paypal: {
          operations: operationStats.byProvider.paypal || {
            total: 0,
            successful: 0,
            failed: 0,
          },
          performance: paypalMetrics,
          payments: paymentStats.byProvider.paypal || 0,
        },
        mercadopago: {
          operations: operationStats.byProvider.mercadopago || {
            total: 0,
            successful: 0,
            failed: 0,
          },
          performance: mercadopagoMetrics,
          payments: paymentStats.byProvider.mercadopago || 0,
        },
      },

      // Operation breakdown
      operations: operationStats.byOperation,

      // Error analysis
      errors: {
        total: errorStats.total,
        byProvider: errorStats.byProvider,
        byCategory: errorStats.byCategory,
        bySeverity: errorStats.bySeverity,
        recent: recentErrors,
      },

      // Performance metrics
      performance: {
        overall: overallMetrics,
        byProvider: {
          stripe: stripeMetrics,
          paypal: paypalMetrics,
          mercadopago: mercadopagoMetrics,
        },
      },

      // System health
      health: {
        overallStatus: getOverallHealthStatus(operationStats, errorStats),
        alerts: adminNotifications.filter(
          (n) => n.severity === "HIGH" || n.severity === "CRITICAL"
        ),
        warnings: adminNotifications.filter((n) => n.severity === "MEDIUM"),
      },

      // Recent notifications
      notifications: adminNotifications,
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    ErrorLogger.log({
      error: error as Error,
      context: 'admin_payment_dashboard',
      action: 'get_dashboard_data',
      level: 'error'
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function getRecentErrors(limit: number) {
  try {
    const errors = await prisma.paymentErrorLog.findMany({
      take: limit,
      orderBy: { timestamp: "desc" },
      where: { resolved: false },
    });

    return errors.map((error) => ({
      id: error.id,
      code: error.errorCode,
      message: error.errorMessage,
      provider: error.provider,
      category: error.category,
      severity: error.severity,
      timestamp: error.timestamp,
      retryable: error.retryable,
    }));
  } catch (error) {
    ErrorLogger.log({
      error: error as Error,
      context: 'admin_payment_dashboard',
      action: 'get_recent_errors',
      level: 'error'
    });
    return [];
  }
}

async function getUnreadAdminNotifications(limit: number) {
  try {
    const notifications = await prisma.adminNotification.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      where: { read: false },
    });

    return notifications.map((notification) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      severity: notification.severity,
      createdAt: notification.createdAt,
      data: notification.data,
    }));
  } catch (error) {
    ErrorLogger.log({
      error: error as Error,
      context: 'admin_payment_dashboard',
      action: 'get_admin_notifications',
      level: 'error'
    });
    return [];
  }
}

interface OperationStats {
  total: number;
  successful: number;
}

interface ErrorStats {
  total: number;
  bySeverity?: {
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
  };
}

function getOverallHealthStatus(
  operationStats: OperationStats,
  errorStats: ErrorStats
): "healthy" | "degraded" | "unhealthy" {
  const successRate =
    operationStats.total > 0
      ? (operationStats.successful / operationStats.total) * 100
      : 100;

  const errorRate = errorStats.total;
  const criticalErrors = errorStats.bySeverity?.critical || 0;
  const highErrors = errorStats.bySeverity?.high || 0;

  if (criticalErrors > 0 || successRate < 80) {
    return "unhealthy";
  }

  if (highErrors > 5 || successRate < 95 || errorRate > 10) {
    return "degraded";
  }

  return "healthy";
}

// POST endpoint for admin actions
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case "mark_error_resolved":
        await markErrorResolved(data.errorId, session.user.id);
        return NextResponse.json({ success: true });

      case "mark_notification_read":
        await markNotificationRead(data.notificationId);
        return NextResponse.json({ success: true });

      case "trigger_payment_monitoring":
        const monitoring = new PaymentMonitoring();
        const result = await monitoring.updatePendingPayments();
        return NextResponse.json({ result });

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    ErrorLogger.log({
      error: error as Error,
      context: 'admin_payment_dashboard',
      action: 'post_dashboard_action',
      level: 'error'
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function markErrorResolved(errorId: string, resolvedBy: string) {
  await prisma.paymentErrorLog.update({
    where: { id: errorId },
    data: {
      resolved: true,
      resolvedAt: new Date(),
      resolvedBy,
    },
  });
}

async function markNotificationRead(notificationId: string) {
  await prisma.adminNotification.update({
    where: { id: notificationId },
    data: {
      read: true,
      readAt: new Date(),
    },
  });
}
