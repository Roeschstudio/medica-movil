import { prisma } from "@/lib/db";
import { PaymentProvider } from "@/lib/payments/types";
import { unifiedRealtime } from "@/lib/unified-realtime";
import { PaymentNotificationIntegration } from "./payment-notifications";

// Payment-Appointment Integration Service
export class PaymentAppointmentIntegration {
  // Update appointment status when payment is completed
  static async handlePaymentCompleted(data: {
    paymentId: string;
    appointmentId: string;
    userId: string;
    amount: number;
    currency: string;
    provider: PaymentProvider;
  }) {
    try {
      // Update appointment status
      const appointment = await prisma.appointment.update({
        where: { id: data.appointmentId },
        data: {
          status: "CONFIRMED",
          paymentId: data.paymentId,
        },
        include: {
          patient: true,
          doctor: { include: { user: true } },
        },
      });

      // Create or activate chat room
      await this.activateChatRoom(
        data.appointmentId,
        appointment.patientId,
        appointment.doctorId
      );

      // Notify patient
      await PaymentNotificationIntegration.notifyPaymentCompleted({
        userId: data.userId,
        paymentId: data.paymentId,
        amount: data.amount,
        currency: data.currency,
        provider: data.provider.name,
        appointmentId: data.appointmentId,
      });

      // Notify doctor
      await PaymentNotificationIntegration.notifyDoctorPaymentReceived({
        doctorId: appointment.doctor.userId,
        patientName: appointment.patient.name,
        amount: data.amount,
        currency: data.currency,
        appointmentId: data.appointmentId,
      });

      // Update admin dashboard
      await this.updateAdminPaymentAnalytics({
        type: "completed",
        paymentId: data.paymentId,
        amount: data.amount,
        provider: data.provider.name,
        appointmentId: data.appointmentId,
      });

      return { success: true, appointment };
    } catch (error) {
      console.error("Error handling payment completion:", error);
      return { success: false, error: error.message };
    }
  }

  // Handle payment failure
  static async handlePaymentFailed(data: {
    paymentId: string;
    appointmentId: string;
    userId: string;
    amount: number;
    currency: string;
    provider: PaymentProvider;
    error: string;
  }) {
    try {
      // Keep appointment as PENDING but add failure note
      await prisma.appointment.update({
        where: { id: data.appointmentId },
        data: {
          notes: `Payment failed: ${data.error}. Please retry payment to confirm appointment.`,
        },
      });

      // Notify patient about failure
      await PaymentNotificationIntegration.notifyPaymentFailed({
        userId: data.userId,
        paymentId: data.paymentId,
        amount: data.amount,
        currency: data.currency,
        provider: data.provider.name,
        error: data.error,
        appointmentId: data.appointmentId,
      });

      // Update admin dashboard
      await this.updateAdminPaymentAnalytics({
        type: "failed",
        paymentId: data.paymentId,
        amount: data.amount,
        provider: data.provider.name,
        appointmentId: data.appointmentId,
        error: data.error,
      });

      return { success: true };
    } catch (error) {
      console.error("Error handling payment failure:", error);
      return { success: false, error: error.message };
    }
  }

  // Activate chat room when payment is confirmed
  private static async activateChatRoom(
    appointmentId: string,
    patientId: string,
    doctorId: string
  ) {
    try {
      // Check if chat room already exists
      let chatRoom = await prisma.chatRoom.findUnique({
        where: { appointmentId },
      });

      if (!chatRoom) {
        // Create new chat room
        chatRoom = await prisma.chatRoom.create({
          data: {
            appointmentId,
            patientId,
            doctorId,
            isActive: true,
          },
        });
      } else {
        // Activate existing chat room
        await prisma.chatRoom.update({
          where: { id: chatRoom.id },
          data: { isActive: true },
        });
      }

      // Send welcome message
      await prisma.chatMessage.create({
        data: {
          chatRoomId: chatRoom.id,
          senderId: "system",
          content:
            "Payment confirmed! Your appointment is now active. You can start chatting with your doctor.",
          messageType: "TEXT",
          senderType: "SYSTEM",
          isRead: false,
        },
      });

      return chatRoom;
    } catch (error) {
      console.error("Error activating chat room:", error);
      throw error;
    }
  }

  // Update admin payment analytics
  private static async updateAdminPaymentAnalytics(data: {
    type: "completed" | "failed";
    paymentId: string;
    amount: number;
    provider: string;
    appointmentId: string;
    error?: string;
  }) {
    try {
      // Emit real-time update to admin dashboard
      unifiedRealtime.emit("admin_payment_update", {
        type: data.type,
        paymentId: data.paymentId,
        amount: data.amount,
        provider: data.provider,
        appointmentId: data.appointmentId,
        timestamp: new Date(),
        error: data.error,
      });

      // Update payment metrics in database
      const today = new Date().toISOString().split("T")[0];

      await prisma.paymentMetrics.upsert({
        where: {
          provider_date: {
            provider: data.provider,
            date: today,
          },
        },
        update: {
          totalPayments: { increment: 1 },
          successfulPayments:
            data.type === "completed" ? { increment: 1 } : undefined,
          totalErrors: data.type === "failed" ? { increment: 1 } : undefined,
        },
        create: {
          provider: data.provider,
          date: today,
          totalPayments: 1,
          successfulPayments: data.type === "completed" ? 1 : 0,
          totalErrors: data.type === "failed" ? 1 : 0,
        },
      });
    } catch (error) {
      console.error("Error updating admin payment analytics:", error);
    }
  }

  // Get payment status for appointment
  static async getAppointmentPaymentStatus(appointmentId: string) {
    try {
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          payment: true,
        },
      });

      if (!appointment) {
        return { status: "not_found" };
      }

      if (!appointment.payment) {
        return { status: "pending", requiresPayment: true };
      }

      return {
        status: appointment.payment.status.toLowerCase(),
        paymentId: appointment.payment.id,
        amount: appointment.payment.amount,
        currency: appointment.payment.currency,
        provider: appointment.payment.provider,
        paidAt: appointment.payment.paidAt,
      };
    } catch (error) {
      console.error("Error getting appointment payment status:", error);
      return { status: "error", error: error.message };
    }
  }
}

// Payment-Chat Integration Service
export class PaymentChatIntegration {
  // Show payment status in chat interface
  static async getChatPaymentStatus(chatRoomId: string) {
    try {
      const chatRoom = await prisma.chatRoom.findUnique({
        where: { id: chatRoomId },
        include: {
          appointment: {
            include: {
              payment: true,
            },
          },
        },
      });

      if (!chatRoom?.appointment) {
        return { hasPayment: false };
      }

      const payment = chatRoom.appointment.payment;
      if (!payment) {
        return {
          hasPayment: false,
          requiresPayment: true,
          appointmentId: chatRoom.appointment.id,
          amount: chatRoom.appointment.price,
        };
      }

      return {
        hasPayment: true,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        provider: payment.provider,
        paidAt: payment.paidAt,
        appointmentId: chatRoom.appointment.id,
      };
    } catch (error) {
      console.error("Error getting chat payment status:", error);
      return { hasPayment: false, error: error.message };
    }
  }

  // Send payment status message to chat
  static async sendPaymentStatusMessage(
    chatRoomId: string,
    status: "completed" | "failed",
    details: any
  ) {
    try {
      const message =
        status === "completed"
          ? `✅ Payment confirmed! Your appointment is now active.`
          : `❌ Payment failed: ${details.error}. Please retry to confirm your appointment.`;

      await prisma.chatMessage.create({
        data: {
          chatRoomId,
          senderId: "system",
          content: message,
          messageType: "TEXT",
          senderType: "SYSTEM",
          isRead: false,
        },
      });

      // Emit real-time update
      unifiedRealtime.emit("chat_payment_update", {
        chatRoomId,
        status,
        message,
        details,
      });
    } catch (error) {
      console.error("Error sending payment status message:", error);
    }
  }
}

// Payment-Video Call Integration Service
export class PaymentVideoCallIntegration {
  // Check if video call is allowed based on payment status
  static async canStartVideoCall(appointmentId: string) {
    try {
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          payment: true,
        },
      });

      if (!appointment) {
        return { allowed: false, reason: "Appointment not found" };
      }

      // For virtual appointments, payment is required
      if (appointment.type === "VIRTUAL") {
        if (
          !appointment.payment ||
          appointment.payment.status !== "COMPLETED"
        ) {
          return {
            allowed: false,
            reason: "Payment required for virtual consultations",
            requiresPayment: true,
            amount: appointment.price,
            appointmentId: appointment.id,
          };
        }
      }

      return { allowed: true };
    } catch (error) {
      console.error("Error checking video call permission:", error);
      return { allowed: false, reason: "Error checking payment status" };
    }
  }

  // Handle video call access based on payment
  static async handleVideoCallAccess(sessionId: string, userId: string) {
    try {
      const videoSession = await prisma.videoSession.findUnique({
        where: { sessionId },
        include: {
          chatRoom: {
            include: {
              appointment: {
                include: {
                  payment: true,
                },
              },
            },
          },
        },
      });

      if (!videoSession?.chatRoom?.appointment) {
        return { allowed: false, reason: "Session not found" };
      }

      const appointment = videoSession.chatRoom.appointment;

      // Check if user is participant
      const isParticipant =
        appointment.patientId === userId || appointment.doctorId === userId;
      if (!isParticipant) {
        return { allowed: false, reason: "Not authorized for this call" };
      }

      // Check payment for virtual appointments
      if (appointment.type === "VIRTUAL") {
        if (
          !appointment.payment ||
          appointment.payment.status !== "COMPLETED"
        ) {
          return {
            allowed: false,
            reason: "Payment required",
            requiresPayment: true,
            appointmentId: appointment.id,
          };
        }
      }

      return { allowed: true, appointment };
    } catch (error) {
      console.error("Error handling video call access:", error);
      return { allowed: false, reason: "Error checking access" };
    }
  }
}

// Payment Analytics Integration Service
export class PaymentAnalyticsIntegration {
  // Get real-time payment analytics for admin dashboard
  static async getRealtimePaymentAnalytics() {
    try {
      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      const startOfWeek = new Date(
        today.getTime() - today.getDay() * 24 * 60 * 60 * 1000
      );
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      // Get payment statistics
      const [dailyStats, weeklyStats, monthlyStats, recentPayments] =
        await Promise.all([
          // Daily stats
          prisma.payment.aggregate({
            where: {
              createdAt: { gte: startOfDay },
              status: "COMPLETED",
            },
            _sum: { amount: true },
            _count: true,
          }),

          // Weekly stats
          prisma.payment.aggregate({
            where: {
              createdAt: { gte: startOfWeek },
              status: "COMPLETED",
            },
            _sum: { amount: true },
            _count: true,
          }),

          // Monthly stats
          prisma.payment.aggregate({
            where: {
              createdAt: { gte: startOfMonth },
              status: "COMPLETED",
            },
            _sum: { amount: true },
            _count: true,
          }),

          // Recent payments
          prisma.payment.findMany({
            take: 10,
            orderBy: { createdAt: "desc" },
            include: {
              user: { select: { name: true } },
              appointment: {
                include: {
                  doctor: {
                    include: {
                      user: { select: { name: true } },
                    },
                  },
                },
              },
            },
          }),
        ]);

      // Get provider breakdown
      const providerStats = await prisma.payment.groupBy({
        by: ["provider"],
        where: {
          createdAt: { gte: startOfMonth },
          status: "COMPLETED",
        },
        _sum: { amount: true },
        _count: true,
      });

      // Get failure rate
      const failureStats = await prisma.payment.groupBy({
        by: ["status"],
        where: {
          createdAt: { gte: startOfDay },
        },
        _count: true,
      });

      return {
        daily: {
          revenue: dailyStats._sum.amount || 0,
          count: dailyStats._count,
        },
        weekly: {
          revenue: weeklyStats._sum.amount || 0,
          count: weeklyStats._count,
        },
        monthly: {
          revenue: monthlyStats._sum.amount || 0,
          count: monthlyStats._count,
        },
        providers: providerStats.map((stat) => ({
          provider: stat.provider,
          revenue: stat._sum.amount || 0,
          count: stat._count,
        })),
        recentPayments: recentPayments.map((payment) => ({
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          provider: payment.provider,
          status: payment.status,
          patientName: payment.user.name,
          doctorName: payment.appointment?.doctor?.user?.name,
          createdAt: payment.createdAt,
        })),
        failureRate: this.calculateFailureRate(failureStats),
      };
    } catch (error) {
      console.error("Error getting payment analytics:", error);
      return null;
    }
  }

  // Calculate failure rate from stats
  private static calculateFailureRate(stats: any[]) {
    const total = stats.reduce((sum, stat) => sum + stat._count, 0);
    const failed = stats.find((stat) => stat.status === "FAILED")?._count || 0;

    return total > 0 ? (failed / total) * 100 : 0;
  }

  // Stream real-time payment updates to admin dashboard
  static streamPaymentUpdates() {
    // This would typically set up a real-time subscription
    // For now, we'll emit updates when payments are processed
    return {
      subscribe: (callback: (update: any) => void) => {
        unifiedRealtime.on("admin_payment_update", callback);
        return () => unifiedRealtime.off("admin_payment_update", callback);
      },
    };
  }
}

// Export all integration services
export {
  PaymentAnalyticsIntegration,
  PaymentAppointmentIntegration,
  PaymentChatIntegration,
  PaymentVideoCallIntegration,
};
