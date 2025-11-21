"use client";

import {
  NotificationData,
  NotificationPreferences,
} from "@/lib/notification-service";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

interface NotificationStats {
  total: number;
  unread: number;
  read: number;
  byType: Record<string, number>;
}

export function useNotifications() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [stats, setStats] = useState<NotificationStats>({
    total: 0,
    unread: 0,
    read: 0,
    byType: {},
  });
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(
    async (limit = 10) => {
      if (!session?.user?.id) return;

      try {
        setLoading(true);
        const response = await fetch(`/api/notifications?limit=${limit}`);
        if (response.ok) {
          const data = await response.json();
          setNotifications(data.notifications || []);
        }
      } catch (error) {
        console.error("Error fetching notifications:", error);
      } finally {
        setLoading(false);
      }
    },
    [session?.user?.id]
  );

  // Fetch notification stats
  const fetchStats = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      const stats = await notificationService.getNotificationStats();
      setStats(stats);
    } catch (error) {
      console.error("Error fetching notification stats:", error);
    }
  }, [session?.user?.id]);

  // Load notification preferences
  const loadPreferences = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      const prefs = await notificationService.loadPreferences();
      setPreferences(prefs);
    } catch (error) {
      console.error("Error loading notification preferences:", error);
    }
  }, [session?.user?.id]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);

      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId
            ? { ...notification, isRead: true }
            : notification
        )
      );
      setStats((prev) => ({
        ...prev,
        unread: Math.max(0, prev.unread - 1),
        read: prev.read + 1,
      }));
      return true;
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return false;
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);
    if (unreadIds.length === 0) return true;

    try {
      const response = await fetch("/api/notifications/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: unreadIds, isRead: true }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((notification) => ({ ...notification, isRead: true }))
        );
        setStats((prev) => ({
          ...prev,
          unread: 0,
          read: prev.total,
        }));
        return true;
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
    return false;
  }, [notifications]);

  // Delete notification
  const deleteNotification = useCallback(
    async (notificationId: string) => {
      try {
        const response = await fetch(`/api/notifications/${notificationId}`, {
          method: "DELETE",
        });

        if (response.ok) {
          const deletedNotification = notifications.find(
            (n) => n.id === notificationId
          );
          setNotifications((prev) =>
            prev.filter((n) => n.id !== notificationId)
          );
          setStats((prev) => ({
            total: prev.total - 1,
            unread: deletedNotification?.isRead
              ? prev.unread
              : Math.max(0, prev.unread - 1),
            read: deletedNotification?.isRead
              ? Math.max(0, prev.read - 1)
              : prev.read,
          }));
          return true;
        }
      } catch (error) {
        console.error("Error deleting notification:", error);
      }
      return false;
    },
    [notifications]
  );

  // Update notification preferences
  const updatePreferences = useCallback(
    async (newPreferences: Partial<NotificationPreferences>) => {
      try {
        await notificationService.updatePreferences(newPreferences);
        setPreferences((prev) =>
          prev ? { ...prev, ...newPreferences } : null
        );
        return true;
      } catch (error) {
        console.error("Error updating notification preferences:", error);
        return false;
      }
    },
    []
  );

  // Create chat notification
  const createChatNotification = useCallback(
    async (
      chatRoomId: string,
      senderId: string,
      messageContent: string,
      recipientId: string
    ) => {
      try {
        await notificationService.createChatNotification(
          chatRoomId,
          senderId,
          messageContent,
          recipientId
        );
        return true;
      } catch (error) {
        console.error("Error creating chat notification:", error);
        return false;
      }
    },
    []
  );

  // Set up real-time subscription for new notifications
  useEffect(() => {
    if (!session?.user?.id) return;

    const callbacks = {
      onNotification: (notification: NotificationData) => {
        setNotifications((prev) => [notification, ...prev]);
        setStats((prev) => ({
          ...prev,
          total: prev.total + 1,
          unread: prev.unread + 1,
          byType: {
            ...prev.byType,
            [notification.type]: (prev.byType[notification.type] || 0) + 1,
          },
        }));
      },
      onNotificationUpdate: (notification: NotificationData) => {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? notification : n))
        );
      },
      onError: (error: Error) => {
        console.error("Notification service error:", error);
      },
      onConnectionChange: (connected: boolean) => {
        setIsConnected(connected);
      },
    };

    notificationService.subscribeToNotifications(callbacks);

    return () => {
      notificationService.unsubscribeFromNotifications();
    };
  }, [session?.user?.id]);

  // Initial fetch
  useEffect(() => {
    if (session?.user?.id) {
      fetchNotifications();
      fetchStats();
      loadPreferences();
    }
  }, [session?.user?.id, fetchNotifications, fetchStats, loadPreferences]);

  return {
    notifications,
    stats,
    loading,
    isConnected,
    preferences,
    fetchNotifications,
    fetchStats,
    loadPreferences,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    updatePreferences,
    createChatNotification,
  };
}
