import { unifiedNotifications } from "@/lib/unified-notifications";

// Payment notification integration
export class PaymentNotificationIntegration {
  // Notify when payment is completed
  static async notifyPaymentCompleted(data: {
    userId: string;
    paymentId: string;
    amount: number;
    currency: string;
    provider: string;
    appointmentId?: string;
  }) {
    await unifiedNotifications.createNotification({
      type: "payment_completed",
      priority: "medium",
      title: "Payment Successful",
      message: `Your payment of ${data.amount} ${data.currency} has been processed successfully`,
      userId: data.userId,
      data: {
        paymentId: data.paymentId,
        amount: data.amount,
        currency: data.currency,
        provider: data.provider,
        appointmentId: data.appointmentId,
      },
      actionUrl: data.appointmentId
        ? `/paciente/citas/${data.appointmentId}`
        : "/paciente/payments",
      actionLabel: "View Details",
    });
  }

  // Notify when payment fails
  static async notifyPaymentFailed(data: {
    userId: string;
    paymentId: string;
    amount: number;
    currency: string;
    provider: string;
    error: string;
    appointmentId?: string;
  }) {
    await unifiedNotifications.createNotification({
      type: "payment_failed",
      priority: "high",
      title: "Payment Failed",
      message: `Your payment of ${data.amount} ${data.currency} could not be processed. ${data.error}`,
      userId: data.userId,
      data: {
        paymentId: data.paymentId,
        amount: data.amount,
        currency: data.currency,
        provider: data.provider,
        error: data.error,
        appointmentId: data.appointmentId,
      },
      actionUrl: data.appointmentId
        ? `/pago/${data.appointmentId}`
        : "/paciente/payments",
      actionLabel: "Retry Payment",
    });
  }

  // Notify doctor about payment received
  static async notifyDoctorPaymentReceived(data: {
    doctorId: string;
    patientName: string;
    amount: number;
    currency: string;
    appointmentId: string;
  }) {
    await unifiedNotifications.createNotification({
      type: "payment_completed",
      priority: "medium",
      title: "Payment Received",
      message: `${data.patientName} has paid ${data.amount} ${data.currency} for their appointment`,
      userId: data.doctorId,
      data: {
        patientName: data.patientName,
        amount: data.amount,
        currency: data.currency,
        appointmentId: data.appointmentId,
      },
      actionUrl: `/doctor/citas/${data.appointmentId}`,
      actionLabel: "View Appointment",
    });
  }

  // Notify admin about payment activity
  static async notifyAdminPaymentActivity(data: {
    type: "completed" | "failed" | "refunded";
    paymentId: string;
    amount: number;
    currency: string;
    provider: string;
    userId: string;
    details?: string;
  }) {
    const adminUsers = ["admin"]; // This would typically come from a database query

    for (const adminId of adminUsers) {
      await unifiedNotifications.createNotification({
        type: "admin_alert",
        priority: data.type === "failed" ? "high" : "medium",
        title: `Payment ${
          data.type.charAt(0).toUpperCase() + data.type.slice(1)
        }`,
        message: `Payment ${data.paymentId} (${data.amount} ${data.currency}) via ${data.provider} has been ${data.type}`,
        userId: adminId,
        data: {
          paymentId: data.paymentId,
          amount: data.amount,
          currency: data.currency,
          provider: data.provider,
          userId: data.userId,
          type: data.type,
          details: data.details,
        },
        actionUrl: `/admin/payments/${data.paymentId}`,
        actionLabel: "View Payment",
      });
    }
  }
}

// Appointment notification integration
export class AppointmentNotificationIntegration {
  // Notify about appointment reminder
  static async notifyAppointmentReminder(data: {
    userId: string;
    appointmentId: string;
    doctorName: string;
    scheduledAt: Date;
    type: string;
    hoursUntil: number;
  }) {
    await unifiedNotifications.createNotification({
      type: "appointment_reminder",
      priority: data.hoursUntil <= 1 ? "high" : "medium",
      title: "Appointment Reminder",
      message: `Your ${data.type} appointment with Dr. ${data.doctorName} is in ${data.hoursUntil} hour(s)`,
      userId: data.userId,
      data: {
        appointmentId: data.appointmentId,
        doctorName: data.doctorName,
        scheduledAt: data.scheduledAt.toISOString(),
        type: data.type,
        hoursUntil: data.hoursUntil,
      },
      actionUrl: `/paciente/citas/${data.appointmentId}`,
      actionLabel: "View Appointment",
    });
  }

  // Notify about appointment cancellation
  static async notifyAppointmentCancelled(data: {
    userId: string;
    appointmentId: string;
    doctorName: string;
    scheduledAt: Date;
    reason?: string;
    cancelledBy: "doctor" | "patient" | "admin";
  }) {
    await unifiedNotifications.createNotification({
      type: "appointment_cancelled",
      priority: "high",
      title: "Appointment Cancelled",
      message: `Your appointment with Dr. ${
        data.doctorName
      } has been cancelled${data.reason ? `: ${data.reason}` : ""}`,
      userId: data.userId,
      data: {
        appointmentId: data.appointmentId,
        doctorName: data.doctorName,
        scheduledAt: data.scheduledAt.toISOString(),
        reason: data.reason,
        cancelledBy: data.cancelledBy,
      },
      actionUrl: "/paciente/citas",
      actionLabel: "Book New Appointment",
    });
  }
}

// Video call notification integration
export class VideoCallNotificationIntegration {
  // Notify about incoming video call
  static async notifyIncomingVideoCall(data: {
    recipientId: string;
    initiatorName: string;
    chatRoomId: string;
    sessionId: string;
  }) {
    await unifiedNotifications.createNotification({
      type: "video_call_incoming",
      priority: "urgent",
      title: "Incoming Video Call",
      message: `${data.initiatorName} is calling you`,
      userId: data.recipientId,
      data: {
        initiatorName: data.initiatorName,
        chatRoomId: data.chatRoomId,
        sessionId: data.sessionId,
      },
      actionUrl: `/video-call/${data.sessionId}`,
      actionLabel: "Join Call",
      expiresAt: new Date(Date.now() + 30000), // Expire in 30 seconds
    });
  }

  // Notify about video call started
  static async notifyVideoCallStarted(data: {
    participantIds: string[];
    sessionId: string;
    initiatorName: string;
  }) {
    for (const participantId of data.participantIds) {
      await unifiedNotifications.createNotification({
        type: "video_call_started",
        priority: "medium",
        title: "Video Call Started",
        message: `Video call with ${data.initiatorName} has started`,
        userId: participantId,
        data: {
          sessionId: data.sessionId,
          initiatorName: data.initiatorName,
        },
        actionUrl: `/video-call/${data.sessionId}`,
        actionLabel: "Join Call",
      });
    }
  }

  // Notify about video call ended
  static async notifyVideoCallEnded(data: {
    participantIds: string[];
    sessionId: string;
    duration: number;
    endedBy: string;
  }) {
    for (const participantId of data.participantIds) {
      await unifiedNotifications.createNotification({
        type: "video_call_ended",
        priority: "low",
        title: "Video Call Ended",
        message: `Video call ended after ${Math.round(
          data.duration / 60
        )} minutes`,
        userId: participantId,
        data: {
          sessionId: data.sessionId,
          duration: data.duration,
          endedBy: data.endedBy,
        },
      });
    }
  }
}

// Admin monitoring notification integration
export class AdminMonitoringIntegration {
  // Notify about system alerts
  static async notifySystemAlert(data: {
    type: "error" | "warning" | "info";
    title: string;
    message: string;
    component: string;
    details?: any;
  }) {
    const adminUsers = ["admin"]; // This would typically come from a database query

    for (const adminId of adminUsers) {
      await unifiedNotifications.createNotification({
        type: "system_alert",
        priority:
          data.type === "error"
            ? "urgent"
            : data.type === "warning"
            ? "high"
            : "medium",
        title: `System Alert: ${data.title}`,
        message: data.message,
        userId: adminId,
        data: {
          alertType: data.type,
          component: data.component,
          details: data.details,
        },
        actionUrl: "/admin/monitoring",
        actionLabel: "View Monitoring",
      });
    }
  }

  // Notify about high activity
  static async notifyHighActivity(data: {
    type: "chat" | "video" | "payment";
    count: number;
    threshold: number;
    timeframe: string;
  }) {
    const adminUsers = ["admin"];

    for (const adminId of adminUsers) {
      await unifiedNotifications.createNotification({
        type: "admin_alert",
        priority: "medium",
        title: "High Activity Alert",
        message: `${data.type} activity is high: ${data.count} events in ${data.timeframe} (threshold: ${data.threshold})`,
        userId: adminId,
        data: {
          activityType: data.type,
          count: data.count,
          threshold: data.threshold,
          timeframe: data.timeframe,
        },
        actionUrl: "/admin/analytics",
        actionLabel: "View Analytics",
      });
    }
  }
}

// Export all integrations
export {
  AdminMonitoringIntegration,
  AppointmentNotificationIntegration,
  PaymentNotificationIntegration,
  VideoCallNotificationIntegration,
};
