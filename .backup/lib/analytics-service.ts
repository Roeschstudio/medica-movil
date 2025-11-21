"use client";

import { performanceMonitor } from "./performance-monitor";
import { createSupabaseBrowserClient } from "./supabase";

interface UserActivity {
  userId: string;
  sessionId: string;
  action: string;
  context: Record<string, any>;
  timestamp: number;
  duration?: number;
}

interface ChatAnalytics {
  messagesSent: number;
  messagesReceived: number;
  filesShared: number;
  averageResponseTime: number;
  sessionDuration: number;
  activeUsers: number;
  peakConcurrentUsers: number;
}

interface EngagementMetrics {
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  averageSessionDuration: number;
  messagesPerSession: number;
  retentionRate: number;
}

interface PerformanceAnalytics {
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  throughput: number;
  uptime: number;
}

class AnalyticsService {
  private supabase = createSupabaseBrowserClient();
  private activityBuffer: UserActivity[] = [];
  private sessionStartTimes: Map<string, number> = new Map();
  private userSessions: Map<string, string> = new Map();
  private flushInterval: NodeJS.Timeout | null = null;
  private bufferSize = 100;
  private flushIntervalMs = 30000; // 30 seconds

  constructor() {
    this.startBufferFlush();
    this.trackPageVisibility();
  }

  // Track user activity
  trackActivity(
    userId: string,
    action: string,
    context: Record<string, any> = {},
    duration?: number
  ): void {
    const sessionId = this.getOrCreateSession(userId);

    const activity: UserActivity = {
      userId,
      sessionId,
      action,
      context,
      timestamp: Date.now(),
      duration,
    };

    this.activityBuffer.push(activity);

    // Record performance metrics
    performanceMonitor.incrementCounter("analytics.activity", {
      action,
      userId,
    });

    // Flush buffer if it's full
    if (this.activityBuffer.length >= this.bufferSize) {
      this.flushBuffer();
    }
  }

  // Track chat-specific events
  trackChatEvent(
    userId: string,
    event:
      | "message_sent"
      | "message_received"
      | "file_shared"
      | "typing_start"
      | "typing_stop",
    context: {
      roomId?: string;
      messageId?: string;
      fileType?: string;
      fileSize?: number;
      latency?: number;
    } = {}
  ): void {
    this.trackActivity(userId, `chat.${event}`, context);

    // Record specific chat metrics
    switch (event) {
      case "message_sent":
        performanceMonitor.incrementCounter("chat.messages_sent");
        if (context.latency) {
          performanceMonitor.recordGauge("chat.send_latency", context.latency);
        }
        break;
      case "message_received":
        performanceMonitor.incrementCounter("chat.messages_received");
        break;
      case "file_shared":
        performanceMonitor.incrementCounter("chat.files_shared", {
          type: context.fileType || "unknown",
        });
        if (context.fileSize) {
          performanceMonitor.recordGauge("chat.file_size", context.fileSize);
        }
        break;
    }
  }

  // Track session events
  trackSession(
    userId: string,
    event: "start" | "end",
    context: Record<string, any> = {}
  ): void {
    const sessionId = this.getOrCreateSession(userId);

    if (event === "start") {
      this.sessionStartTimes.set(sessionId, Date.now());
      performanceMonitor.incrementCounter("analytics.session_start");
    } else if (event === "end") {
      const startTime = this.sessionStartTimes.get(sessionId);
      const duration = startTime ? Date.now() - startTime : 0;

      this.trackActivity(userId, "session.end", { ...context, duration });

      this.sessionStartTimes.delete(sessionId);
      this.userSessions.delete(userId);

      performanceMonitor.incrementCounter("analytics.session_end");
      performanceMonitor.recordGauge("analytics.session_duration", duration);
    }
  }

  // Track performance events
  trackPerformance(
    metric: string,
    value: number,
    context: Record<string, any> = {}
  ): void {
    performanceMonitor.recordGauge(`analytics.${metric}`, value);

    // Store in activity buffer for historical analysis
    this.trackActivity("system", `performance.${metric}`, {
      value,
      ...context,
    });
  }

  // Track errors
  trackError(
    userId: string,
    error: Error,
    context: Record<string, any> = {}
  ): void {
    this.trackActivity(userId, "error", {
      message: error.message,
      stack: error.stack,
      ...context,
    });

    performanceMonitor.incrementCounter("analytics.error", {
      type: error.name,
    });
  }

  // Get chat analytics
  async getChatAnalytics(
    timeRange: "1h" | "24h" | "7d" | "30d" = "24h"
  ): Promise<ChatAnalytics> {
    const timeRangeMs = this.getTimeRangeMs(timeRange);
    const since = Date.now() - timeRangeMs;

    try {
      // Get message statistics
      const messagesSent = performanceMonitor
        .getMetrics("chat.messages_sent")
        .filter((m) => m.timestamp > since)
        .reduce((sum, m) => sum + m.value, 0);

      const messagesReceived = performanceMonitor
        .getMetrics("chat.messages_received")
        .filter((m) => m.timestamp > since)
        .reduce((sum, m) => sum + m.value, 0);

      const filesShared = performanceMonitor
        .getMetrics("chat.files_shared")
        .filter((m) => m.timestamp > since)
        .reduce((sum, m) => sum + m.value, 0);

      // Calculate average response time
      const latencyMetrics = performanceMonitor
        .getMetrics("chat.send_latency")
        .filter((m) => m.timestamp > since);
      const averageResponseTime =
        latencyMetrics.length > 0
          ? latencyMetrics.reduce((sum, m) => sum + m.value, 0) /
            latencyMetrics.length
          : 0;

      // Get session data
      const sessionMetrics = performanceMonitor
        .getMetrics("analytics.session_duration")
        .filter((m) => m.timestamp > since);
      const sessionDuration =
        sessionMetrics.length > 0
          ? sessionMetrics.reduce((sum, m) => sum + m.value, 0) /
            sessionMetrics.length
          : 0;

      // Get active users (approximate)
      const activeUsers = this.userSessions.size;
      const peakConcurrentUsers = performanceMonitor
        .getMetrics("chat.active_connections")
        .filter((m) => m.timestamp > since)
        .reduce((max, m) => Math.max(max, m.value), 0);

      return {
        messagesSent,
        messagesReceived,
        filesShared,
        averageResponseTime,
        sessionDuration,
        activeUsers,
        peakConcurrentUsers,
      };
    } catch (error) {
      console.error("Failed to get chat analytics:", error);
      return {
        messagesSent: 0,
        messagesReceived: 0,
        filesShared: 0,
        averageResponseTime: 0,
        sessionDuration: 0,
        activeUsers: 0,
        peakConcurrentUsers: 0,
      };
    }
  }

  // Get engagement metrics
  async getEngagementMetrics(): Promise<EngagementMetrics> {
    try {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const weekMs = 7 * dayMs;
      const monthMs = 30 * dayMs;

      // Get unique users from activity buffer and performance metrics
      const dailyUsers = new Set();
      const weeklyUsers = new Set();
      const monthlyUsers = new Set();

      // Analyze activity buffer
      this.activityBuffer.forEach((activity) => {
        if (now - activity.timestamp <= dayMs) {
          dailyUsers.add(activity.userId);
        }
        if (now - activity.timestamp <= weekMs) {
          weeklyUsers.add(activity.userId);
        }
        if (now - activity.timestamp <= monthMs) {
          monthlyUsers.add(activity.userId);
        }
      });

      // Get session metrics
      const sessionMetrics = performanceMonitor
        .getMetrics("analytics.session_duration")
        .filter((m) => now - m.timestamp <= dayMs);

      const averageSessionDuration =
        sessionMetrics.length > 0
          ? sessionMetrics.reduce((sum, m) => sum + m.value, 0) /
            sessionMetrics.length
          : 0;

      // Calculate messages per session
      const dailyMessages = performanceMonitor
        .getMetrics("chat.messages_sent")
        .filter((m) => now - m.timestamp <= dayMs)
        .reduce((sum, m) => sum + m.value, 0);

      const dailySessions = performanceMonitor
        .getMetrics("analytics.session_start")
        .filter((m) => now - m.timestamp <= dayMs).length;

      const messagesPerSession =
        dailySessions > 0 ? dailyMessages / dailySessions : 0;

      // Simple retention rate calculation (users active today who were also active yesterday)
      const yesterdayUsers = new Set();
      this.activityBuffer.forEach((activity) => {
        const daysSince = (now - activity.timestamp) / dayMs;
        if (daysSince >= 1 && daysSince <= 2) {
          yesterdayUsers.add(activity.userId);
        }
      });

      const retentionRate =
        yesterdayUsers.size > 0
          ? Array.from(dailyUsers).filter((user) => yesterdayUsers.has(user))
              .length / yesterdayUsers.size
          : 0;

      return {
        dailyActiveUsers: dailyUsers.size,
        weeklyActiveUsers: weeklyUsers.size,
        monthlyActiveUsers: monthlyUsers.size,
        averageSessionDuration,
        messagesPerSession,
        retentionRate,
      };
    } catch (error) {
      console.error("Failed to get engagement metrics:", error);
      return {
        dailyActiveUsers: 0,
        weeklyActiveUsers: 0,
        monthlyActiveUsers: 0,
        averageSessionDuration: 0,
        messagesPerSession: 0,
        retentionRate: 0,
      };
    }
  }

  // Get performance analytics
  getPerformanceAnalytics(
    timeRange: "1h" | "24h" | "7d" = "24h"
  ): PerformanceAnalytics {
    const timeRangeMs = this.getTimeRangeMs(timeRange);
    const since = Date.now() - timeRangeMs;

    const latencyMetrics = performanceMonitor
      .getMetrics("chat.message_latency")
      .filter((m) => m.timestamp > since)
      .map((m) => m.value);

    const averageLatency =
      latencyMetrics.length > 0
        ? latencyMetrics.reduce((sum, val) => sum + val, 0) /
          latencyMetrics.length
        : 0;

    const sortedLatencies = latencyMetrics.sort((a, b) => a - b);
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p99Index = Math.floor(sortedLatencies.length * 0.99);

    const p95Latency = sortedLatencies[p95Index] || 0;
    const p99Latency = sortedLatencies[p99Index] || 0;

    const errorCount = performanceMonitor
      .getMetrics("analytics.error")
      .filter((m) => m.timestamp > since).length;
    const totalOperations = performanceMonitor
      .getMetrics("chat.messages_sent")
      .filter((m) => m.timestamp > since).length;

    const errorRate = totalOperations > 0 ? errorCount / totalOperations : 0;

    const throughput =
      performanceMonitor
        .getMetrics("chat.messages_sent")
        .filter((m) => m.timestamp > since).length /
      (timeRangeMs / (60 * 1000)); // per minute

    const uptime =
      performanceMonitor.getLatestMetric("health.uptime")?.value || 0;

    return {
      averageLatency,
      p95Latency,
      p99Latency,
      errorRate,
      throughput,
      uptime,
    };
  }

  // Export analytics data
  async exportAnalytics(
    startDate: Date,
    endDate: Date,
    format: "json" | "csv" = "json"
  ): Promise<string> {
    const activities = this.activityBuffer.filter(
      (activity) =>
        activity.timestamp >= startDate.getTime() &&
        activity.timestamp <= endDate.getTime()
    );

    if (format === "csv") {
      const headers = [
        "userId",
        "sessionId",
        "action",
        "timestamp",
        "duration",
        "context",
      ];
      const rows = activities.map((activity) => [
        activity.userId,
        activity.sessionId,
        activity.action,
        new Date(activity.timestamp).toISOString(),
        activity.duration || "",
        JSON.stringify(activity.context),
      ]);

      return [headers, ...rows].map((row) => row.join(",")).join("\n");
    } else {
      return JSON.stringify(activities, null, 2);
    }
  }

  // Get or create session ID for user
  private getOrCreateSession(userId: string): string {
    if (!this.userSessions.has(userId)) {
      const sessionId = `${userId}_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      this.userSessions.set(userId, sessionId);
    }
    return this.userSessions.get(userId)!;
  }

  // Convert time range to milliseconds
  private getTimeRangeMs(timeRange: string): number {
    switch (timeRange) {
      case "1h":
        return 60 * 60 * 1000;
      case "24h":
        return 24 * 60 * 60 * 1000;
      case "7d":
        return 7 * 24 * 60 * 60 * 1000;
      case "30d":
        return 30 * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  // Start buffer flush interval
  private startBufferFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flushBuffer();
    }, this.flushIntervalMs);
  }

  // Flush activity buffer
  private async flushBuffer(): Promise<void> {
    if (this.activityBuffer.length === 0) return;

    const activities = [...this.activityBuffer];
    this.activityBuffer = [];

    try {
      // Store activities in Supabase (optional - for persistent analytics)
      // This could be disabled for privacy or performance reasons
      if (process.env.NEXT_PUBLIC_ENABLE_ANALYTICS_STORAGE === "true") {
        await this.supabase.from("user_activities").insert(
          activities.map((activity) => ({
            user_id: activity.userId,
            session_id: activity.sessionId,
            action: activity.action,
            context: activity.context,
            timestamp: new Date(activity.timestamp).toISOString(),
            duration: activity.duration,
          }))
        );
      }

      performanceMonitor.recordGauge(
        "analytics.buffer_flushed",
        activities.length
      );
    } catch (error) {
      console.error("Failed to flush analytics buffer:", error);
      // Re-add activities to buffer for retry
      this.activityBuffer.unshift(...activities);
    }
  }

  // Track page visibility changes
  private trackPageVisibility(): void {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        const userId = this.getCurrentUserId();
        if (userId) {
          if (document.hidden) {
            this.trackActivity(userId, "page.hidden");
          } else {
            this.trackActivity(userId, "page.visible");
          }
        }
      });
    }
  }

  // Get current user ID (implement based on your auth system)
  private getCurrentUserId(): string | null {
    // This should be implemented based on your authentication system
    // For now, return null
    return null;
  }

  // Destroy analytics service
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    // Flush remaining activities
    this.flushBuffer();

    this.activityBuffer = [];
    this.sessionStartTimes.clear();
    this.userSessions.clear();
  }
}

// Global analytics service instance
export const analyticsService = new AnalyticsService();

// React hook for analytics
export function useAnalytics() {
  const trackActivity = (
    action: string,
    context?: Record<string, any>,
    duration?: number
  ) => {
    const userId = getCurrentUserId(); // Implement this based on your auth
    if (userId) {
      analyticsService.trackActivity(userId, action, context, duration);
    }
  };

  const trackChatEvent = (
    event:
      | "message_sent"
      | "message_received"
      | "file_shared"
      | "typing_start"
      | "typing_stop",
    context?: Record<string, any>
  ) => {
    const userId = getCurrentUserId();
    if (userId) {
      analyticsService.trackChatEvent(userId, event, context);
    }
  };

  const trackError = (error: Error, context?: Record<string, any>) => {
    const userId = getCurrentUserId();
    if (userId) {
      analyticsService.trackError(userId, error, context);
    }
  };

  return {
    trackActivity,
    trackChatEvent,
    trackError,
    getChatAnalytics: analyticsService.getChatAnalytics.bind(analyticsService),
    getEngagementMetrics:
      analyticsService.getEngagementMetrics.bind(analyticsService),
    getPerformanceAnalytics:
      analyticsService.getPerformanceAnalytics.bind(analyticsService),
  };
}

// Helper function to get current user ID (implement based on your auth system)
function getCurrentUserId(): string | null {
  // This should be implemented based on your authentication system
  // For example, if using NextAuth:
  // const { data: session } = useSession();
  // return session?.user?.id || null;
  return null;
}
