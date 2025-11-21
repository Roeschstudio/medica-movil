import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

// Notification interfaces
export interface NotificationData {
  id: string;
  userId: string;
  type: "EMAIL" | "SMS" | "WHATSAPP" | "BROWSER";
  title: string;
  message: string;
  isRead: boolean;
  sentAt?: string;
  createdAt: string;
  metadata?: {
    chatRoomId?: string;
    appointmentId?: string;
    messageId?: string;
    actionUrl?: string;
  };
}

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  browser: boolean;
  appointmentReminders: boolean;
  chatMessages: boolean;
  systemUpdates: boolean;
  marketingEmails: boolean;
  quietHours: {
    enabled: boolean;
    startTime: string; // "22:00"
    endTime: string; // "08:00"
  };
}

export interface NotificationCallbacks {
  onNotification: (notification: NotificationData) => void;
  onNotificationUpdate: (notification: NotificationData) => void;
  onError: (error: Error) => void;
  onConnectionChange: (connected: boolean) => void;
}

export interface BrowserNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  requireInteraction?: boolean;
  silent?: boolean;
}

export interface NotificationGroup {
  id: string;
  type: string;
  count: number;
  latestNotification: NotificationData;
  notifications: NotificationData[];
}

/**
 * Real-time notification service that integrates with chat events
 * Handles browser notifications, notification queuing, and user preferences
 */
export class NotificationService {
  private supabase: SupabaseClient;
  private subscription: RealtimeChannel | null = null;
  private preferences: NotificationPreferences | null = null;
  private notificationQueue: NotificationData[] = [];
  private isOnline: boolean = true;
  private callbacks: NotificationCallbacks | null = null;
  private notificationGroups: Map<string, NotificationGroup> = new Map();
  private groupingTimeout: NodeJS.Timeout | null = null;
  private readonly GROUPING_DELAY = 3000; // 3 seconds
  private readonly MAX_NOTIFICATIONS_PER_GROUP = 5;

  constructor() {
    this.supabase = createSupabaseBrowserClient();
    this.initializeOnlineDetection();
    this.requestNotificationPermission();
  }

  /**
   * Initialize online/offline detection
   */
  private initializeOnlineDetection(): void {
    this.isOnline = navigator.onLine;

    window.addEventListener("online", () => {
      this.isOnline = true;
      this.processNotificationQueue();
    });

    window.addEventListener("offline", () => {
      this.isOnline = false;
    });
  }

  /**
   * Request browser notification permission
   */
  private async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!("Notification" in window)) {
      console.warn("This browser does not support notifications");
      return "denied";
    }

    if (Notification.permission === "default") {
      return Notification.requestPermission();
    }

    return Notification.permission;
  }

  /**
   * Load user notification preferences
   */
  async loadPreferences(): Promise<NotificationPreferences> {
    try {
      const {
        data: { user },
      } = await this.supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      const response = await fetch("/api/notifications/preferences");
      if (response.ok) {
        const preferences = await response.json();
        this.preferences = preferences;
        return preferences;
      }

      // Return default preferences if none found
      const defaultPreferences: NotificationPreferences = {
        email: true,
        sms: true,
        whatsapp: false,
        browser: true,
        appointmentReminders: true,
        chatMessages: true,
        systemUpdates: true,
        marketingEmails: false,
        quietHours: {
          enabled: false,
          startTime: "22:00",
          endTime: "08:00",
        },
      };

      this.preferences = defaultPreferences;
      return defaultPreferences;
    } catch (error) {
      console.error("Error loading notification preferences:", error);
      throw error;
    }
  }

  /**
   * Subscribe to real-time notifications for the current user
   */
  async subscribeToNotifications(
    callbacks: NotificationCallbacks
  ): Promise<void> {
    try {
      const {
        data: { user },
      } = await this.supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      this.callbacks = callbacks;

      // Load preferences first
      await this.loadPreferences();

      // Unsubscribe from existing subscription
      this.unsubscribeFromNotifications();

      // Create new subscription
      this.subscription = this.supabase
        .channel(`notifications_${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `userId=eq.${user.id}`,
          },
          (payload) => {
            const notification = this.formatNotification(payload.new);
            this.handleNewNotification(notification);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "notifications",
            filter: `userId=eq.${user.id}`,
          },
          (payload) => {
            const notification = this.formatNotification(payload.new);
            callbacks.onNotificationUpdate(notification);
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            callbacks.onConnectionChange(true);
          } else if (status === "CLOSED") {
            callbacks.onConnectionChange(false);
          }
        });
    } catch (error) {
      console.error("Error subscribing to notifications:", error);
      callbacks.onError(error as Error);
    }
  }

  /**
   * Handle new notification with grouping and preferences
   */
  private handleNewNotification(notification: NotificationData): void {
    if (!this.callbacks) return;

    // Check if notification should be shown based on preferences
    if (!this.shouldShowNotification(notification)) {
      return;
    }

    // If offline, queue the notification
    if (!this.isOnline) {
      this.notificationQueue.push(notification);
      return;
    }

    // Check quiet hours
    if (this.isInQuietHours()) {
      this.notificationQueue.push(notification);
      return;
    }

    // Handle notification grouping for chat messages
    if (notification.metadata?.chatRoomId) {
      this.handleChatNotificationGrouping(notification);
    } else {
      // Show notification immediately for non-chat notifications
      this.showNotification(notification);
    }

    // Notify callbacks
    this.callbacks.onNotification(notification);
  }

  /**
   * Handle chat notification grouping to prevent spam
   */
  private handleChatNotificationGrouping(notification: NotificationData): void {
    const chatRoomId = notification.metadata?.chatRoomId;
    if (!chatRoomId) {
      this.showNotification(notification);
      return;
    }

    const groupKey = `chat_${chatRoomId}`;
    const existingGroup = this.notificationGroups.get(groupKey);

    if (existingGroup) {
      // Add to existing group
      existingGroup.notifications.push(notification);
      existingGroup.count = existingGroup.notifications.length;
      existingGroup.latestNotification = notification;

      // If group is at max size, show grouped notification
      if (existingGroup.count >= this.MAX_NOTIFICATIONS_PER_GROUP) {
        this.showGroupedNotification(existingGroup);
        this.notificationGroups.delete(groupKey);
      }
    } else {
      // Create new group
      const newGroup: NotificationGroup = {
        id: groupKey,
        type: "chat",
        count: 1,
        latestNotification: notification,
        notifications: [notification],
      };

      this.notificationGroups.set(groupKey, newGroup);

      // Set timeout to show notification if no more messages arrive
      if (this.groupingTimeout) {
        clearTimeout(this.groupingTimeout);
      }

      this.groupingTimeout = setTimeout(() => {
        const group = this.notificationGroups.get(groupKey);
        if (group) {
          if (group.count === 1) {
            // Show single notification
            this.showNotification(group.latestNotification);
          } else {
            // Show grouped notification
            this.showGroupedNotification(group);
          }
          this.notificationGroups.delete(groupKey);
        }
      }, this.GROUPING_DELAY);
    }
  }

  /**
   * Show a single browser notification
   */
  private async showNotification(
    notification: NotificationData
  ): Promise<void> {
    if (!this.preferences?.browser || Notification.permission !== "granted") {
      return;
    }

    try {
      const options: BrowserNotificationOptions = {
        body: notification.message,
        icon: "/icons/notification-icon.png",
        badge: "/icons/notification-badge.png",
        tag: notification.id,
        data: {
          notificationId: notification.id,
          chatRoomId: notification.metadata?.chatRoomId,
          appointmentId: notification.metadata?.appointmentId,
          actionUrl: notification.metadata?.actionUrl,
        },
        requireInteraction: notification.type === "BROWSER",
        silent: false,
      };

      const browserNotification = new Notification(notification.title, options);

      // Handle notification click
      browserNotification.onclick = () => {
        this.handleNotificationClick(notification);
        browserNotification.close();
      };

      // Auto-close after 5 seconds for non-interactive notifications
      if (!options.requireInteraction) {
        setTimeout(() => {
          browserNotification.close();
        }, 5000);
      }
    } catch (error) {
      console.error("Error showing browser notification:", error);
    }
  }

  /**
   * Show grouped notification for multiple messages
   */
  private async showGroupedNotification(
    group: NotificationGroup
  ): Promise<void> {
    if (!this.preferences?.browser || Notification.permission !== "granted") {
      return;
    }

    try {
      const title = `${group.count} nuevos mensajes`;
      const body = `Tienes ${group.count} mensajes nuevos en el chat`;

      const options: BrowserNotificationOptions = {
        body,
        icon: "/icons/notification-icon.png",
        badge: "/icons/notification-badge.png",
        tag: group.id,
        data: {
          groupId: group.id,
          chatRoomId: group.latestNotification.metadata?.chatRoomId,
          notificationCount: group.count,
        },
        requireInteraction: true,
        silent: false,
      };

      const browserNotification = new Notification(title, options);

      // Handle notification click
      browserNotification.onclick = () => {
        this.handleGroupNotificationClick(group);
        browserNotification.close();
      };
    } catch (error) {
      console.error("Error showing grouped browser notification:", error);
    }
  }

  /**
   * Handle notification click
   */
  private handleNotificationClick(notification: NotificationData): void {
    // Focus the window
    if (window.focus) {
      window.focus();
    }

    // Navigate to appropriate page
    if (notification.metadata?.actionUrl) {
      window.location.href = notification.metadata.actionUrl;
    } else if (notification.metadata?.chatRoomId) {
      window.location.href = `/chat/${notification.metadata.chatRoomId}`;
    } else if (notification.metadata?.appointmentId) {
      window.location.href = `/appointments/${notification.metadata.appointmentId}`;
    }

    // Mark notification as read
    this.markAsRead(notification.id);
  }

  /**
   * Handle grouped notification click
   */
  private handleGroupNotificationClick(group: NotificationGroup): void {
    // Focus the window
    if (window.focus) {
      window.focus();
    }

    // Navigate to chat room
    if (group.latestNotification.metadata?.chatRoomId) {
      window.location.href = `/chat/${group.latestNotification.metadata.chatRoomId}`;
    }

    // Mark all notifications in group as read
    group.notifications.forEach((notification) => {
      this.markAsRead(notification.id);
    });
  }

  /**
   * Check if notification should be shown based on preferences
   */
  private shouldShowNotification(notification: NotificationData): boolean {
    if (!this.preferences) return true;

    // Check notification type preferences
    if (notification.metadata?.chatRoomId && !this.preferences.chatMessages) {
      return false;
    }

    if (
      notification.metadata?.appointmentId &&
      !this.preferences.appointmentReminders
    ) {
      return false;
    }

    // Check channel preferences
    switch (notification.type) {
      case "EMAIL":
        return this.preferences.email;
      case "SMS":
        return this.preferences.sms;
      case "WHATSAPP":
        return this.preferences.whatsapp;
      case "BROWSER":
        return this.preferences.browser;
      default:
        return true;
    }
  }

  /**
   * Check if current time is in quiet hours
   */
  private isInQuietHours(): boolean {
    if (!this.preferences?.quietHours.enabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = this.preferences.quietHours.startTime
      .split(":")
      .map(Number);
    const [endHour, endMin] = this.preferences.quietHours.endTime
      .split(":")
      .map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    }

    // Handle same-day quiet hours (e.g., 12:00 to 14:00)
    return currentTime >= startTime && currentTime <= endTime;
  }

  /**
   * Process queued notifications when coming back online or after quiet hours
   */
  private async processNotificationQueue(): Promise<void> {
    if (this.notificationQueue.length === 0) return;

    // If still in quiet hours, don't process queue
    if (this.isInQuietHours()) return;

    const queue = [...this.notificationQueue];
    this.notificationQueue = [];

    // Group notifications by type and show summary
    const groupedNotifications = this.groupQueuedNotifications(queue);

    for (const group of groupedNotifications) {
      if (group.notifications.length === 1) {
        await this.showNotification(group.notifications[0]);
      } else {
        await this.showGroupedNotification(group);
      }
    }
  }

  /**
   * Group queued notifications for batch display
   */
  private groupQueuedNotifications(
    notifications: NotificationData[]
  ): NotificationGroup[] {
    const groups = new Map<string, NotificationGroup>();

    notifications.forEach((notification) => {
      let groupKey = "general";

      if (notification.metadata?.chatRoomId) {
        groupKey = `chat_${notification.metadata.chatRoomId}`;
      } else if (notification.metadata?.appointmentId) {
        groupKey = `appointment_${notification.metadata.appointmentId}`;
      }

      const existingGroup = groups.get(groupKey);
      if (existingGroup) {
        existingGroup.notifications.push(notification);
        existingGroup.count = existingGroup.notifications.length;
        existingGroup.latestNotification = notification;
      } else {
        groups.set(groupKey, {
          id: groupKey,
          type: notification.metadata?.chatRoomId ? "chat" : "general",
          count: 1,
          latestNotification: notification,
          notifications: [notification],
        });
      }
    });

    return Array.from(groups.values());
  }

  /**
   * Create a chat notification
   */
  async createChatNotification(
    chatRoomId: string,
    senderId: string,
    messageContent: string,
    recipientId: string
  ): Promise<void> {
    try {
      const response = await fetch("/api/notifications/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatRoomId,
          senderId,
          messageContent,
          recipientId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create chat notification");
      }
    } catch (error) {
      console.error("Error creating chat notification:", error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isRead: true }),
      });

      if (!response.ok) {
        throw new Error("Failed to mark notification as read");
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(
    preferences: Partial<NotificationPreferences>
  ): Promise<void> {
    try {
      const response = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(preferences),
      });

      if (!response.ok) {
        throw new Error("Failed to update notification preferences");
      }

      // Update local preferences
      this.preferences = {
        ...this.preferences,
        ...preferences,
      } as NotificationPreferences;
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      throw error;
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(): Promise<{
    total: number;
    unread: number;
    byType: Record<string, number>;
  }> {
    try {
      const response = await fetch("/api/notifications/stats");
      if (!response.ok) {
        throw new Error("Failed to fetch notification stats");
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching notification stats:", error);
      throw error;
    }
  }

  /**
   * Unsubscribe from notifications
   */
  unsubscribeFromNotifications(): void {
    if (this.subscription) {
      this.supabase.removeChannel(this.subscription);
      this.subscription = null;
    }

    // Clear grouping timeout
    if (this.groupingTimeout) {
      clearTimeout(this.groupingTimeout);
      this.groupingTimeout = null;
    }

    // Clear notification groups
    this.notificationGroups.clear();
  }

  /**
   * Format notification data
   */
  private formatNotification(data: any): NotificationData {
    return {
      id: data.id,
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      isRead: data.isRead,
      sentAt: data.sentAt,
      createdAt: data.createdAt,
      metadata: data.metadata ? JSON.parse(data.metadata) : undefined,
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.unsubscribeFromNotifications();
    this.notificationQueue = [];
    this.callbacks = null;
    this.preferences = null;

    // Remove event listeners
    window.removeEventListener("online", this.processNotificationQueue);
    window.removeEventListener("offline", () => {});
  }
}

// Export singleton instance
let _notificationService: NotificationService | null = null;

export const notificationService = (() => {
  if (!_notificationService) {
    _notificationService = new NotificationService();
  }
  return _notificationService;
})();

// Export factory function for testing
export const createNotificationService = () => {
  return new NotificationService();
};
