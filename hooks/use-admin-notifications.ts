import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export interface AdminNotification {
  id: string;
  userId: string;
  type: "CHAT" | "PAYMENT" | "VIDEO_CALL" | "SYSTEM";
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  createdAt: string;
}

interface NotificationState {
  notifications: AdminNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
}

export function useAdminNotifications() {
  const [state, setState] = useState<NotificationState>({
    notifications: [],
    unreadCount: 0,
    isLoading: true,
    error: null,
  });

  const supabase = createSupabaseBrowserClient();

  // Load initial notifications
  const loadNotifications = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const { data, error } = await supabase
        .from("admin_monitoring_notifications")
        .select("*")
        .eq("userId", "admin")
        .order("createdAt", { ascending: false })
        .limit(50);

      if (error) throw error;

      const notifications = data || [];
      const unreadCount = notifications.filter((n) => !n.isRead).length;

      setState((prev) => ({
        ...prev,
        notifications,
        unreadCount,
        isLoading: false,
      }));
    } catch (error) {
      console.error("Error loading notifications:", error);
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load notifications",
        isLoading: false,
      }));
    }
  }, [supabase]);

  // Mark notification as read
  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        const { error } = await supabase
          .from("admin_monitoring_notifications")
          .update({ isRead: true })
          .eq("id", notificationId);

        if (error) throw error;

        setState((prev) => ({
          ...prev,
          notifications: prev.notifications.map((n) =>
            n.id === notificationId ? { ...n, isRead: true } : n
          ),
          unreadCount: Math.max(0, prev.unreadCount - 1),
        }));
      } catch (error) {
        console.error("Error marking notification as read:", error);
      }
    },
    [supabase]
  );

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const { error } = await supabase
        .from("admin_monitoring_notifications")
        .update({ isRead: true })
        .eq("userId", "admin")
        .eq("isRead", false);

      if (error) throw error;

      setState((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  }, [supabase]);

  // Create notification (for testing or manual creation)
  const createNotification = useCallback(
    async (
      type: AdminNotification["type"],
      title: string,
      message: string,
      data?: any
    ) => {
      try {
        const { data: newNotification, error } = await supabase
          .from("admin_monitoring_notifications")
          .insert({
            userId: "admin",
            type,
            title,
            message,
            data,
          })
          .select()
          .single();

        if (error) throw error;

        // Show toast notification
        toast.success(title, {
          description: message,
          duration: 5000,
        });

        return newNotification;
      } catch (error) {
        console.error("Error creating notification:", error);
        throw error;
      }
    },
    [supabase]
  );

  // Set up real-time subscriptions
  useEffect(() => {
    loadNotifications();

    // Subscribe to new notifications
    const notificationChannel = supabase
      .channel("admin-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "admin_monitoring_notifications",
          filter: "userId=eq.admin",
        },
        (payload) => {
          const newNotification = payload.new as AdminNotification;

          setState((prev) => ({
            ...prev,
            notifications: [newNotification, ...prev.notifications],
            unreadCount: prev.unreadCount + 1,
          }));

          // Show toast notification for new notifications
          toast.info(newNotification.title, {
            description: newNotification.message,
            duration: 5000,
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "admin_monitoring_notifications",
          filter: "userId=eq.admin",
        },
        (payload) => {
          const updatedNotification = payload.new as AdminNotification;

          setState((prev) => ({
            ...prev,
            notifications: prev.notifications.map((n) =>
              n.id === updatedNotification.id ? updatedNotification : n
            ),
            unreadCount:
              prev.notifications.filter(
                (n) => n.id !== updatedNotification.id && !n.isRead
              ).length + (updatedNotification.isRead ? 0 : 1),
          }));
        }
      )
      .subscribe();

    // Subscribe to chat messages for notifications
    const chatChannel = supabase
      .channel("admin-chat-monitoring")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        async (payload) => {
          const message = payload.new;

          // Check if this is the first message in a new conversation
          const { data: messageCount } = await supabase
            .from("chat_messages")
            .select("id", { count: "exact" })
            .eq("chatRoomId", message.chatRoomId);

          if (messageCount && messageCount.length === 1) {
            // This is the first message, create notification
            await createNotification(
              "CHAT",
              "New Chat Started",
              "A new chat conversation has been initiated",
              { chatRoomId: message.chatRoomId, messageId: message.id }
            );
          }
        }
      )
      .subscribe();

    // Subscribe to video calls for notifications
    const videoChannel = supabase
      .channel("admin-video-monitoring")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "video_sessions",
        },
        async (payload) => {
          const session = payload.new;

          await createNotification(
            "VIDEO_CALL",
            "New Video Call Started",
            "A new video call session has been initiated",
            { sessionId: session.id, roomName: session.roomName }
          );
        }
      )
      .subscribe();

    // Subscribe to payments for notifications
    const paymentChannel = supabase
      .channel("admin-payment-monitoring")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "payments",
        },
        async (payload) => {
          const payment = payload.new;
          const oldPayment = payload.old;

          // Only notify when payment status changes to completed
          if (
            oldPayment.status !== "COMPLETED" &&
            payment.status === "COMPLETED"
          ) {
            await createNotification(
              "PAYMENT",
              "Payment Completed",
              `Payment of $${payment.amount} ${payment.currency} completed via ${payment.method}`,
              {
                paymentId: payment.id,
                amount: payment.amount,
                method: payment.method,
              }
            );
          }
        }
      )
      .subscribe();

    // Cleanup subscriptions
    return () => {
      notificationChannel.unsubscribe();
      chatChannel.unsubscribe();
      videoChannel.unsubscribe();
      paymentChannel.unsubscribe();
    };
  }, [supabase, loadNotifications, createNotification]);

  return {
    notifications: state.notifications,
    unreadCount: state.unreadCount,
    isLoading: state.isLoading,
    error: state.error,
    markAsRead,
    markAllAsRead,
    createNotification,
    refresh: loadNotifications,
  };
}
