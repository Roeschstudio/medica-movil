import { prisma } from "@/lib/db";
import { unifiedRealtime } from "@/lib/unified-realtime";
import { AdminMonitoringIntegration } from "./payment-notifications";

// Admin Dashboard System Integration
export class AdminDashboardIntegration {
  // Integrate monitoring across all system components
  static async getSystemOverview() {
    try {
      const [chatStats, videoStats, paymentStats, systemHealth] =
        await Promise.all([
          this.getChatSystemStats(),
          this.getVideoSystemStats(),
          this.getPaymentSystemStats(),
          this.getSystemHealthStats(),
        ]);

      return {
        chat: chatStats,
        video: videoStats,
        payments: paymentStats,
        system: systemHealth,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error("Error getting system overview:", error);
      return null;
    }
  }

  // Get chat system statistics
  private static async getChatSystemStats() {
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    const [activeRooms, todayMessages, totalUsers] = await Promise.all([
      prisma.chatRoom.count({ where: { isActive: true } }),
      prisma.chatMessage.count({ where: { sentAt: { gte: startOfDay } } }),
      prisma.user.count({ where: { isActive: true } }),
    ]);

    return {
      activeRooms,
      todayMessages,
      totalUsers,
      status: "healthy",
    };
  }

  // Get video system statistics
  private static async getVideoSystemStats() {
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    const [activeCalls, todayCalls, completedCalls] = await Promise.all([
      prisma.videoSession.count({ where: { status: "ACTIVE" } }),
      prisma.videoSession.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.videoSession.count({ where: { status: "ENDED" } }),
    ]);

    return {
      activeCalls,
      todayCalls,
      completedCalls,
      status: "healthy",
    };
  }

  // Get payment system statistics
  private static async getPaymentSystemStats() {
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    const [todayRevenue, todayPayments, failedPayments] = await Promise.all([
      prisma.payment.aggregate({
        where: { createdAt: { gte: startOfDay }, status: "COMPLETED" },
        _sum: { amount: true },
      }),
      prisma.payment.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.payment.count({
        where: { createdAt: { gte: startOfDay }, status: "FAILED" },
      }),
    ]);

    const failureRate =
      todayPayments > 0 ? (failedPayments / todayPayments) * 100 : 0;

    return {
      todayRevenue: todayRevenue._sum.amount || 0,
      todayPayments,
      failedPayments,
      failureRate,
      status: failureRate > 10 ? "warning" : "healthy",
    };
  }

  // Get system health statistics
  private static async getSystemHealthStats() {
    // This would typically check various system metrics
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      status: "healthy",
    };
  }

  // Unified admin notification system
  static setupAdminNotifications() {
    // Monitor chat system
    unifiedRealtime.on("message", (message) => {
      this.handleChatActivity(message);
    });

    // Monitor video calls
    unifiedRealtime.on("video_call_start", (data) => {
      this.handleVideoActivity(data);
    });

    // Monitor payments
    unifiedRealtime.on("admin_payment_update", (data) => {
      this.handlePaymentActivity(data);
    });
  }

  private static async handleChatActivity(data: any) {
    // Log chat activity for admin monitoring
    await AdminMonitoringIntegration.notifyHighActivity({
      type: "chat",
      count: 1,
      threshold: 100,
      timeframe: "1 hour",
    });
  }

  private static async handleVideoActivity(data: any) {
    // Log video activity for admin monitoring
    console.log("Video activity:", data);
  }

  private static async handlePaymentActivity(data: any) {
    // Log payment activity for admin monitoring
    if (data.type === "failed") {
      await AdminMonitoringIntegration.notifySystemAlert({
        type: "warning",
        title: "Payment Failure",
        message: `Payment ${data.paymentId} failed: ${data.error}`,
        component: "payment-system",
      });
    }
  }
}

export { AdminDashboardIntegration };
