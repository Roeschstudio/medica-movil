import { useUnifiedAuth } from "@/lib/unified-auth-context";
import {
  NotificationPreferences,
  NotificationType,
  UnifiedNotification,
  unifiedNotifications,
} from "@/lib/unified-notifications";
import { useEffect, useState } from "react";

export interface UseUnifiedNotificationsReturn {
  notifications: UnifiedNotification[];
  unreadCount: number;
  isLoading: boolean;

  // Actions
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => void;

  // Preferences
  preferences: NotificationPreferences | null;
  updatePreferences: (
    updates: Partial<NotificationPreferences>
  ) => Promise<void>;
  requestPermission: () => Promise<boolean>;
}

export function useUnifiedNotifications(options?: {
  limit?: number;
  unreadOnly?: boolean;
  types?: NotificationType[];
  autoRefresh?: boolean;
}): UseUnifiedNotificationsReturn {
  const { user } = useUnifiedAuth();
  const [notifications, setNotifications] = useState<UnifiedNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load notifications and preferences
  const loadData = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Load notifications
      const userNotifications = unifiedNotifications.getNotifications(
        user.id,
        options
      );
      setNotifications(userNotifications);

      // Load unread count
      const count = unifiedNotifications.getUnreadCount(
        user.id,
        options?.types
      );
      setUnreadCount(count);

      // Load preferences
      const userPreferences = await unifiedNotifications.getUserPreferences(
        user.id
      );
      setPreferences(userPreferences);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Listen for new notifications
  useEffect(() => {
    if (!user) return;

    const unsubscribe = unifiedNotifications.onNotification((notification) => {
      if (notification.userId === user.id) {
        // Add to notifications list
        setNotifications((prev) => {
          const filtered = options?.types
            ? options.types.includes(notification.type)
            : true;

          if (!filtered) return prev;

          const updated = [notification, ...prev];
          return options?.limit ? updated.slice(0, options.limit) : updated;
        });

        // Update unread count
        if (!notification.isRead) {
          setUnreadCount((prev) => prev + 1);
        }
      }
    });

    return unsubscribe;
  }, [user, options?.types, options?.limit]);

  // Load data when user changes
  useEffect(() => {
    loadData();
  }, [user]);

  // Auto-refresh if enabled
  useEffect(() => {
    if (options?.autoRefresh && user) {
      const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [options?.autoRefresh, user]);

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    await unifiedNotifications.markAsRead(notificationId);

    // Update local state
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
    );

    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!user) return;

    await unifiedNotifications.markAllAsRead(user.id);

    // Update local state
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  // Update preferences
  const updatePreferences = async (
    updates: Partial<NotificationPreferences>
  ) => {
    if (!user) return;

    await unifiedNotifications.updatePreferences(user.id, updates);

    // Update local state
    setPreferences((prev) => (prev ? { ...prev, ...updates } : null));
  };

  // Request browser notification permission
  const requestPermission = async () => {
    return await unifiedNotifications.requestPermission();
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refresh: loadData,
    preferences,
    updatePreferences,
    requestPermission,
  };
}

// Hook for specific notification types
export function useChatNotifications() {
  return useUnifiedNotifications({
    types: ["chat_message"],
    autoRefresh: true,
  });
}

export function useVideoCallNotifications() {
  return useUnifiedNotifications({
    types: ["video_call_incoming", "video_call_started", "video_call_ended"],
    autoRefresh: true,
  });
}

export function usePaymentNotifications() {
  return useUnifiedNotifications({
    types: ["payment_completed", "payment_failed"],
    autoRefresh: true,
  });
}

export function useAdminNotifications() {
  return useUnifiedNotifications({
    types: ["system_alert", "admin_alert"],
    autoRefresh: true,
  });
}

// Hook for unread count only (lightweight)
export function useUnreadNotificationCount(types?: NotificationType[]) {
  const { user } = useUnifiedAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const updateCount = () => {
      const newCount = unifiedNotifications.getUnreadCount(user.id, types);
      setCount(newCount);
    };

    // Initial load
    updateCount();

    // Listen for changes
    const unsubscribe = unifiedNotifications.onNotification((notification) => {
      if (notification.userId === user.id && !notification.isRead) {
        const shouldCount = !types || types.includes(notification.type);
        if (shouldCount) {
          setCount((prev) => prev + 1);
        }
      }
    });

    return unsubscribe;
  }, [user, types]);

  return count;
}
