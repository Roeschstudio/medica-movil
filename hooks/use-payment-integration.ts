import {
  PaymentAnalyticsIntegration,
  PaymentAppointmentIntegration,
  PaymentChatIntegration,
  PaymentVideoCallIntegration,
} from "@/lib/integrations/payment-system-integration";
import { useUnifiedAuth } from "@/lib/unified-auth-context";
import { useUnifiedRealtime } from "@/lib/unified-realtime-context";
import { useEffect, useState } from "react";

// Hook for appointment payment integration
export function useAppointmentPayment(appointmentId: string) {
  const [paymentStatus, setPaymentStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appointmentId) return;

    const loadPaymentStatus = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const status =
          await PaymentAppointmentIntegration.getAppointmentPaymentStatus(
            appointmentId
          );
        setPaymentStatus(status);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load payment status"
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadPaymentStatus();
  }, [appointmentId]);

  return {
    paymentStatus,
    isLoading,
    error,
    isPaid: paymentStatus?.status === "completed",
    requiresPayment: paymentStatus?.requiresPayment || false,
    refresh: () => {
      if (appointmentId) {
        PaymentAppointmentIntegration.getAppointmentPaymentStatus(appointmentId)
          .then(setPaymentStatus)
          .catch((err) => setError(err.message));
      }
    },
  };
}

// Hook for chat payment integration
export function useChatPayment(chatRoomId: string) {
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const realtime = useUnifiedRealtime();

  useEffect(() => {
    if (!chatRoomId) return;

    const loadPaymentInfo = async () => {
      setIsLoading(true);

      try {
        const info = await PaymentChatIntegration.getChatPaymentStatus(
          chatRoomId
        );
        setPaymentInfo(info);
      } catch (error) {
        console.error("Failed to load chat payment info:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPaymentInfo();

    // Listen for payment updates
    const handlePaymentUpdate = (update: any) => {
      if (update.chatRoomId === chatRoomId) {
        loadPaymentInfo(); // Refresh payment info
      }
    };

    realtime.service.on("chat_payment_update", handlePaymentUpdate);

    return () => {
      realtime.service.off("chat_payment_update", handlePaymentUpdate);
    };
  }, [chatRoomId, realtime]);

  return {
    paymentInfo,
    isLoading,
    hasPayment: paymentInfo?.hasPayment || false,
    requiresPayment: paymentInfo?.requiresPayment || false,
    paymentStatus: paymentInfo?.status,
    appointmentId: paymentInfo?.appointmentId,
  };
}

// Hook for video call payment integration
export function useVideoCallPayment(
  appointmentId?: string,
  sessionId?: string
) {
  const [canStartCall, setCanStartCall] = useState<any>(null);
  const [accessCheck, setAccessCheck] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useUnifiedAuth();

  // Check if video call can be started
  const checkCallPermission = async () => {
    if (!appointmentId) return;

    setIsLoading(true);
    try {
      const result = await PaymentVideoCallIntegration.canStartVideoCall(
        appointmentId
      );
      setCanStartCall(result);
    } catch (error) {
      console.error("Failed to check call permission:", error);
      setCanStartCall({ allowed: false, reason: "Error checking permission" });
    } finally {
      setIsLoading(false);
    }
  };

  // Check video call access
  const checkCallAccess = async () => {
    if (!sessionId || !user) return;

    setIsLoading(true);
    try {
      const result = await PaymentVideoCallIntegration.handleVideoCallAccess(
        sessionId,
        user.id
      );
      setAccessCheck(result);
    } catch (error) {
      console.error("Failed to check call access:", error);
      setAccessCheck({ allowed: false, reason: "Error checking access" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (appointmentId) {
      checkCallPermission();
    }
  }, [appointmentId]);

  useEffect(() => {
    if (sessionId && user) {
      checkCallAccess();
    }
  }, [sessionId, user]);

  return {
    canStartCall: canStartCall?.allowed || false,
    canAccessCall: accessCheck?.allowed || false,
    callPermission: canStartCall,
    callAccess: accessCheck,
    isLoading,
    requiresPayment:
      canStartCall?.requiresPayment || accessCheck?.requiresPayment || false,
    checkPermission: checkCallPermission,
    checkAccess: checkCallAccess,
  };
}

// Hook for payment analytics (admin)
export function usePaymentAnalytics() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const realtime = useUnifiedRealtime();

  useEffect(() => {
    const loadAnalytics = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data =
          await PaymentAnalyticsIntegration.getRealtimePaymentAnalytics();
        setAnalytics(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load analytics"
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalytics();

    // Listen for real-time updates
    const handlePaymentUpdate = (update: any) => {
      // Update analytics with new data
      setAnalytics((prev: any) => {
        if (!prev) return prev;

        // Update daily stats
        const updatedAnalytics = { ...prev };
        if (update.type === "completed") {
          updatedAnalytics.daily.revenue += update.amount;
          updatedAnalytics.daily.count += 1;
        }

        // Add to recent payments
        updatedAnalytics.recentPayments = [
          {
            id: update.paymentId,
            amount: update.amount,
            provider: update.provider,
            status: update.type,
            createdAt: update.timestamp,
          },
          ...updatedAnalytics.recentPayments.slice(0, 9),
        ];

        return updatedAnalytics;
      });
    };

    realtime.service.on("admin_payment_update", handlePaymentUpdate);

    // Refresh analytics every 5 minutes
    const interval = setInterval(loadAnalytics, 5 * 60 * 1000);

    return () => {
      realtime.service.off("admin_payment_update", handlePaymentUpdate);
      clearInterval(interval);
    };
  }, [realtime]);

  return {
    analytics,
    isLoading,
    error,
    refresh: async () => {
      const data =
        await PaymentAnalyticsIntegration.getRealtimePaymentAnalytics();
      setAnalytics(data);
    },
  };
}

// Hook for payment status across all features
export function usePaymentStatus(context: {
  appointmentId?: string;
  chatRoomId?: string;
  sessionId?: string;
}) {
  const appointmentPayment = useAppointmentPayment(context.appointmentId || "");
  const chatPayment = useChatPayment(context.chatRoomId || "");
  const videoPayment = useVideoCallPayment(
    context.appointmentId,
    context.sessionId
  );

  // Determine overall payment status
  const getOverallStatus = () => {
    if (appointmentPayment.isPaid || chatPayment.hasPayment) {
      return "paid";
    }

    if (
      appointmentPayment.requiresPayment ||
      chatPayment.requiresPayment ||
      videoPayment.requiresPayment
    ) {
      return "required";
    }

    return "not_required";
  };

  return {
    // Individual statuses
    appointment: appointmentPayment,
    chat: chatPayment,
    video: videoPayment,

    // Overall status
    overallStatus: getOverallStatus(),
    isPaid: appointmentPayment.isPaid || chatPayment.hasPayment,
    requiresPayment:
      appointmentPayment.requiresPayment ||
      chatPayment.requiresPayment ||
      videoPayment.requiresPayment,

    // Loading states
    isLoading:
      appointmentPayment.isLoading ||
      chatPayment.isLoading ||
      videoPayment.isLoading,

    // Actions
    refreshAll: () => {
      appointmentPayment.refresh();
      videoPayment.checkPermission();
      videoPayment.checkAccess();
    },
  };
}

// Hook for payment integration notifications
export function usePaymentNotifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const realtime = useUnifiedRealtime();

  useEffect(() => {
    const handlePaymentNotification = (notification: any) => {
      if (notification.type.includes("payment")) {
        setNotifications((prev) => [notification, ...prev.slice(0, 9)]);
      }
    };

    realtime.service.on("notification", handlePaymentNotification);

    return () => {
      realtime.service.off("notification", handlePaymentNotification);
    };
  }, [realtime]);

  return {
    notifications,
    clearNotifications: () => setNotifications([]),
  };
}
