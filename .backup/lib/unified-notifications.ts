import { toast } from "sonner";
import { unifiedRealtime } from "./unified-realtime";

// Notification types
export type NotificationType =
  | "chat_message"
  | "video_call_incoming"
  | "video_call_started"
  | "video_call_ended"
  | "payment_completed"
  | "payment_failed"
  | "appointment_reminder"
  | "appointment_cancelled"
  | "system_alert"
  | "admin_alert";

// Notification priority levels
export type NotificationPriority = "low" | "medium" | "high" | "urgent";

// Notification interface
export interface UnifiedNotification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  userId: string;
  data?: Record<string, any>;
  timestamp: Date;
  isRead: boolean;
  expiresAt?: Date;
  actionUrl?: string;
  actionLabel?: string;
}

// Notification preferences
export interface NotificationPreferences {
  userId: string;
  email: boolean;
  browser: boolean;
  sound: boolean;
  chatMessages: boolean;
  videoCalls: boolean;
  payments: boolean;
  appointments: boolean;
  systemAlerts: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

// Unified Notification Service
export class UnifiedNotificationService {
  private static instance: UnifiedNotificationService;
  private notifications: Map<string, UnifiedNotification> = new Map();
  private preferences: Map<string, NotificationPreferences> = new Map();
  private eventListeners: Map<
    string,
    Set<(notification: UnifiedNotification) => void>
  > = new Map();

  private constructor() {
    this.initializeRealtimeListeners();
  }

  static getInstance(): UnifiedNotificationService {
    if (!UnifiedNotificationService.instance) {
      UnifiedNotificationService.instance = new UnifiedNotificationService();
    }
    return UnifiedNotificationService.instance;
  }

  // Initialize realtime listeners for cross-feature notifications
  private initializeRealtimeListeners() {
    // Chat message notifications
    unifiedRealtime.on("message", (message) => {
      this.createNotification({
        type: "chat_message",
        priority: "medium",
        title: "New Message",
        message: `${message.sender?.name || "Someone"} sent you a message`,
        userId: message.senderId === message.chatRoomId ? "" : message.senderId, // Simplified logic
        data: {
          chatRoomId: message.chatRoomId,
          messageId: message.id,
          senderId: message.senderId,
        },
        actionUrl: `/chat/${message.chatRoomId}`,
        actionLabel: "View Chat",
      });
    });

    // Video call notifications
    unifiedRealtime.on("video_call_start", (data) => {
      this.createNotification({
        type: "video_call_incoming",
        priority: "high",
        title: "Incoming Video Call",
        message: `You have an incoming video call`,
        userId: data.recipientId || "",
        data: {
          sessionId: data.sessionId,
          initiatorId: data.initiator,
          chatRoomId: data.chatRoomId,
        },
        actionUrl: `/video-call/${data.sessionId}`,
        actionLabel: "Join Call",
        expiresAt: new Date(Date.now() + 30000), // Expire in 30 seconds
      });
    });

    unifiedRealtime.on("video_call_end", (data) => {
      this.createNotification({
        type: "video_call_ended",
        priority: "medium",
        title: "Video Call Ended",
        message: `The video call has ended`,
        userId: data.participantId || "",
        data: {
          sessionId: data.sessionId,
          duration: data.duration,
          endedBy: data.endedBy,
        },
      });
    });

    // System notifications
    unifiedRealtime.on("notification", (notification) => {
      this.createNotification({
        type:
          notification.type === "PAYMENT"
            ? "payment_completed"
            : "system_alert",
        priority: this.getPriorityFromType(notification.type),
        title: notification.title,
        message: notification.message,
        userId: notification.userId,
        data: notification.data,
      });
    });
  }

  // Create a new notification
  async createNotification(
    notificationData: Omit<UnifiedNotification, "id" | "timestamp" | "isRead">
  ) {
    const notification: UnifiedNotification = {
      ...notificationData,
      id: this.generateId(),
      timestamp: new Date(),
      isRead: false,
    };

    // Check user preferences
    const preferences = await this.getUserPreferences(notification.userId);
    if (!this.shouldShowNotification(notification, preferences)) {
      return null;
    }

    // Store notification
    this.notifications.set(notification.id, notification);

    // Show browser notification if enabled
    if (preferences.browser) {
      this.showBrowserNotification(notification);
    }

    // Show toast notification
    this.showToastNotification(notification);

    // Play sound if enabled
    if (preferences.sound && notification.priority !== "low") {
      this.playNotificationSound(notification.priority);
    }

    // Emit to listeners
    this.emitNotification(notification);

    // Store in database for persistence
    await this.persistNotification(notification);

    return notification;
  }

  // Get user notification preferences
  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    if (this.preferences.has(userId)) {
      return this.preferences.get(userId)!;
    }

    // Load from database or use defaults
    const defaultPreferences: NotificationPreferences = {
      userId,
      email: true,
      browser: true,
      sound: true,
      chatMessages: true,
      videoCalls: true,
      payments: true,
      appointments: true,
      systemAlerts: true,
      quietHoursEnabled: false,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
    };

    this.preferences.set(userId, defaultPreferences);
    return defaultPreferences;
  }

  // Check if notification should be shown based on preferences
  private shouldShowNotification(
    notification: UnifiedNotification,
    preferences: NotificationPreferences
  ): boolean {
    // Check quiet hours
    if (preferences.quietHoursEnabled && this.isInQuietHours(preferences)) {
      // Only show urgent notifications during quiet hours
      if (notification.priority !== "urgent") {
        return false;
      }
    }

    // Check type-specific preferences
    switch (notification.type) {
      case "chat_message":
        return preferences.chatMessages;
      case "video_call_incoming":
      case "video_call_started":
      case "video_call_ended":
        return preferences.videoCalls;
      case "payment_completed":
      case "payment_failed":
        return preferences.payments;
      case "appointment_reminder":
      case "appointment_cancelled":
        return preferences.appointments;
      case "system_alert":
      case "admin_alert":
        return preferences.systemAlerts;
      default:
        return true;
    }
  }

  // Check if current time is in quiet hours
  private isInQuietHours(preferences: NotificationPreferences): boolean {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = preferences.quietHoursStart
      .split(":")
      .map(Number);
    const [endHour, endMin] = preferences.quietHoursEnd.split(":").map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Quiet hours span midnight
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  // Show browser notification
  private showBrowserNotification(notification: UnifiedNotification) {
    if ("Notification" in window && Notification.permission === "granted") {
      const browserNotification = new Notification(notification.title, {
        body: notification.message,
        icon: "/favicon.ico",
        tag: notification.id,
        requireInteraction: notification.priority === "urgent",
      });

      browserNotification.onclick = () => {
        if (notification.actionUrl) {
          window.open(notification.actionUrl, "_blank");
        }
        browserNotification.close();
      };

      // Auto-close after 5 seconds for non-urgent notifications
      if (notification.priority !== "urgent") {
        setTimeout(() => browserNotification.close(), 5000);
      }
    }
  }

  // Show toast notification
  private showToastNotification(notification: UnifiedNotification) {
    const toastOptions = {
      description: notification.message,
      action: notification.actionUrl
        ? {
            label: notification.actionLabel || "View",
            onClick: () => window.open(notification.actionUrl, "_blank"),
          }
        : undefined,
      duration: this.getToastDuration(notification.priority),
    };

    switch (notification.priority) {
      case "urgent":
        toast.error(notification.title, toastOptions);
        break;
      case "high":
        toast.warning(notification.title, toastOptions);
        break;
      case "medium":
        toast.info(notification.title, toastOptions);
        break;
      case "low":
        toast(notification.title, toastOptions);
        break;
    }
  }

  // Play notification sound
  private playNotificationSound(priority: NotificationPriority) {
    try {
      const audio = new Audio();
      switch (priority) {
        case "urgent":
          audio.src = "/sounds/urgent-notification.mp3";
          break;
        case "high":
          audio.src = "/sounds/high-notification.mp3";
          break;
        default:
          audio.src = "/sounds/default-notification.mp3";
          break;
      }
      audio.play().catch(console.error);
    } catch (error) {
      console.error("Failed to play notification sound:", error);
    }
  }

  // Get toast duration based on priority
  private getToastDuration(priority: NotificationPriority): number {
    switch (priority) {
      case "urgent":
        return 10000; // 10 seconds
      case "high":
        return 7000; // 7 seconds
      case "medium":
        return 5000; // 5 seconds
      case "low":
        return 3000; // 3 seconds
      default:
        return 5000;
    }
  }

  // Get priority from notification type
  private getPriorityFromType(type: string): NotificationPriority {
    switch (type) {
      case "VIDEO_CALL":
        return "high";
      case "PAYMENT":
        return "medium";
      case "APPOINTMENT":
        return "medium";
      case "SYSTEM":
        return "high";
      default:
        return "medium";
    }
  }

  // Persist notification to database
  private async persistNotification(notification: UnifiedNotification) {
    try {
      // This would typically save to Supabase
      // For now, we'll just log it
      console.log("Persisting notification:", notification);
    } catch (error) {
      console.error("Failed to persist notification:", error);
    }
  }

  // Emit notification to listeners
  private emitNotification(notification: UnifiedNotification) {
    const listeners = this.eventListeners.get("notification") || new Set();
    listeners.forEach((callback) => callback(notification));
  }

  // Subscribe to notifications
  onNotification(callback: (notification: UnifiedNotification) => void) {
    if (!this.eventListeners.has("notification")) {
      this.eventListeners.set("notification", new Set());
    }
    this.eventListeners.get("notification")!.add(callback);

    return () => {
      this.eventListeners.get("notification")?.delete(callback);
    };
  }

  // Get notifications for a user
  getNotifications(
    userId: string,
    options?: {
      limit?: number;
      unreadOnly?: boolean;
      types?: NotificationType[];
    }
  ): UnifiedNotification[] {
    const userNotifications = Array.from(this.notifications.values())
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    let filtered = userNotifications;

    if (options?.unreadOnly) {
      filtered = filtered.filter((n) => !n.isRead);
    }

    if (options?.types) {
      filtered = filtered.filter((n) => options.types!.includes(n.type));
    }

    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  // Mark notification as read
  async markAsRead(notificationId: string) {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.isRead = true;
      this.notifications.set(notificationId, notification);
      // Update in database
      await this.persistNotification(notification);
    }
  }

  // Mark all notifications as read for a user
  async markAllAsRead(userId: string) {
    const userNotifications = Array.from(this.notifications.values()).filter(
      (n) => n.userId === userId && !n.isRead
    );

    for (const notification of userNotifications) {
      notification.isRead = true;
      this.notifications.set(notification.id, notification);
    }

    // Batch update in database
    console.log(
      `Marked ${userNotifications.length} notifications as read for user ${userId}`
    );
  }

  // Get unread count for a user
  getUnreadCount(userId: string, types?: NotificationType[]): number {
    return this.getNotifications(userId, { unreadOnly: true, types }).length;
  }

  // Request browser notification permission
  async requestPermission(): Promise<boolean> {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    }
    return false;
  }

  // Update user preferences
  async updatePreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ) {
    const current = await this.getUserPreferences(userId);
    const updated = { ...current, ...preferences };
    this.preferences.set(userId, updated);

    // Persist to database
    console.log(
      "Updated notification preferences for user:",
      userId,
      preferences
    );
  }

  // Generate unique ID
  private generateId(): string {
    return `notification_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }

  // Cleanup expired notifications
  cleanup() {
    const now = new Date();
    for (const [id, notification] of this.notifications.entries()) {
      if (notification.expiresAt && notification.expiresAt < now) {
        this.notifications.delete(id);
      }
    }
  }
}

// Export singleton instance
export const unifiedNotifications = UnifiedNotificationService.getInstance();

// Convenience functions
export const createNotification = (
  data: Omit<UnifiedNotification, "id" | "timestamp" | "isRead">
) => unifiedNotifications.createNotification(data);

export const onNotification = (
  callback: (notification: UnifiedNotification) => void
) => unifiedNotifications.onNotification(callback);

export const getNotifications = (userId: string, options?: any) =>
  unifiedNotifications.getNotifications(userId, options);

export const markAsRead = (notificationId: string) =>
  unifiedNotifications.markAsRead(notificationId);

export const markAllAsRead = (userId: string) =>
  unifiedNotifications.markAllAsRead(userId);

export const getUnreadCount = (userId: string, types?: NotificationType[]) =>
  unifiedNotifications.getUnreadCount(userId, types);

export const requestNotificationPermission = () =>
  unifiedNotifications.requestPermission();

export const updateNotificationPreferences = (
  userId: string,
  preferences: Partial<NotificationPreferences>
) => unifiedNotifications.updatePreferences(userId, preferences);
