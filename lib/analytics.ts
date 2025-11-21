"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import { ErrorLogger } from "./error-handling-utils";

export interface ChatAnalyticsEvent {
  event_type:
    | "message_sent"
    | "message_received"
    | "file_uploaded"
    | "chat_opened"
    | "chat_closed"
    | "connection_error"
    | "performance_metric";
  chat_room_id?: string;
  user_id?: string;
  session_id?: string;
  metadata?: Record<string, any>;
  timestamp?: string;
}

export interface PerformanceMetric {
  metric_name: string;
  value: number;
  unit: "ms" | "bytes" | "count" | "percentage";
  context?: Record<string, any>;
  timestamp?: string;
}

export interface ErrorEvent {
  error_type: string;
  error_message: string;
  stack_trace?: string;
  user_id?: string;
  chat_room_id?: string;
  context?: Record<string, any>;
  timestamp?: string;
}

class ChatAnalytics {
  private supabase = createSupabaseBrowserClient();
  private sessionId: string;
  private userId?: string;
  private isEnabled: boolean = true;
  private eventQueue: ChatAnalyticsEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private performanceObserver: PerformanceObserver | null = null;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.initializePerformanceMonitoring();
    this.startEventFlushing();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializePerformanceMonitoring() {
    if (typeof window === "undefined") return;

    // Monitor navigation timing
    if (window.performance && window.performance.timing) {
      const timing = window.performance.timing;
      const loadTime = timing.loadEventEnd - timing.navigationStart;

      this.trackPerformance("page_load_time", loadTime, "ms");
    }

    // Monitor resource loading
    if (window.PerformanceObserver) {
      this.performanceObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === "navigation") {
            const navEntry = entry as PerformanceNavigationTiming;
            this.trackPerformance(
              "dom_content_loaded",
              navEntry.domContentLoadedEventEnd -
                navEntry.domContentLoadedEventStart,
              "ms"
            );
          } else if (entry.entryType === "resource") {
            const resourceEntry = entry as PerformanceResourceTiming;
            if (
              resourceEntry.name.includes("supabase") ||
              resourceEntry.name.includes("chat")
            ) {
              this.trackPerformance(
                "resource_load_time",
                resourceEntry.duration,
                "ms",
                {
                  resource_name: resourceEntry.name,
                  resource_type: resourceEntry.initiatorType,
                }
              );
            }
          }
        });
      });

      try {
        this.performanceObserver.observe({
          entryTypes: ["navigation", "resource"],
        });
      } catch (error) {
        ErrorLogger.log(error as Error, { context: "analytics", action: "initialize_performance_monitoring", level: "warn" });
      }
    }

    // Monitor memory usage
    if ("memory" in window.performance) {
      setInterval(() => {
        const memory = (window.performance as any).memory;
        this.trackPerformance("memory_used", memory.usedJSHeapSize, "bytes");
        this.trackPerformance("memory_total", memory.totalJSHeapSize, "bytes");
      }, 30000); // Every 30 seconds
    }
  }

  private startEventFlushing() {
    this.flushInterval = setInterval(() => {
      this.flushEvents();
    }, 5000); // Flush every 5 seconds
  }

  private async flushEvents() {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      const { error } = await this.supabase.from("chat_analytics").insert(
        events.map((event) => ({
          ...event,
          session_id: this.sessionId,
          timestamp: event.timestamp || new Date().toISOString(),
        }))
      );

      if (error) {
        ErrorLogger.log(error as Error, { context: "analytics", action: "flush_events", eventCount: events.length });
        // Re-queue events on failure
        this.eventQueue.unshift(...events);
      }
    } catch (error) {
      ErrorLogger.log(error as Error, { context: "analytics", action: "flush_events_catch", eventCount: events.length });
      // Re-queue events on failure
      this.eventQueue.unshift(...events);
    }
  }

  setUserId(userId: string) {
    this.userId = userId;
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  track(event: Omit<ChatAnalyticsEvent, "session_id" | "timestamp">) {
    if (!this.isEnabled) return;

    const analyticsEvent: ChatAnalyticsEvent = {
      ...event,
      user_id: event.user_id || this.userId,
      timestamp: new Date().toISOString(),
    };

    this.eventQueue.push(analyticsEvent);

    // Flush immediately for critical events
    if (event.event_type === "connection_error") {
      this.flushEvents();
    }
  }

  trackPerformance(
    metricName: string,
    value: number,
    unit: PerformanceMetric["unit"],
    context?: Record<string, any>
  ) {
    this.track({
      event_type: "performance_metric",
      metadata: {
        metric_name: metricName,
        value,
        unit,
        context,
      },
    });
  }

  trackError(error: Error | string, context?: Record<string, any>) {
    const errorMessage = typeof error === "string" ? error : error.message;
    const stackTrace =
      typeof error === "object" && error.stack ? error.stack : undefined;

    this.track({
      event_type: "connection_error",
      metadata: {
        error_message: errorMessage,
        stack_trace: stackTrace,
        context,
      },
    });
  }

  trackChatActivity(
    activity:
      | "opened"
      | "closed"
      | "message_sent"
      | "message_received"
      | "file_uploaded",
    chatRoomId: string,
    metadata?: Record<string, any>
  ) {
    const eventTypeMap = {
      opened: "chat_opened" as const,
      closed: "chat_closed" as const,
      message_sent: "message_sent" as const,
      message_received: "message_received" as const,
      file_uploaded: "file_uploaded" as const,
    };

    this.track({
      event_type: eventTypeMap[activity],
      chat_room_id: chatRoomId,
      metadata,
    });
  }

  async getAnalytics(chatRoomId?: string, startDate?: Date, endDate?: Date) {
    try {
      let query = this.supabase
        .from("chat_analytics")
        .select("*")
        .order("timestamp", { ascending: false });

      if (chatRoomId) {
        query = query.eq("chat_room_id", chatRoomId);
      }

      if (startDate) {
        query = query.gte("timestamp", startDate.toISOString());
      }

      if (endDate) {
        query = query.lte("timestamp", endDate.toISOString());
      }

      const { data, error } = await query.limit(1000);

      if (error) throw error;
      return data || [];
    } catch (error) {
      ErrorLogger.log(error as Error, { context: "analytics", action: "fetch_analytics", timeRange });
      return [];
    }
  }

  async getChatMetrics(chatRoomId: string) {
    try {
      const analytics = await this.getAnalytics(chatRoomId);

      const metrics = {
        totalMessages: analytics.filter((e) => e.event_type === "message_sent")
          .length,
        totalFiles: analytics.filter((e) => e.event_type === "file_uploaded")
          .length,
        averageResponseTime: 0,
        sessionDuration: 0,
        errorCount: analytics.filter((e) => e.event_type === "connection_error")
          .length,
      };

      // Calculate average response time
      const messageTimes = analytics
        .filter((e) => e.event_type === "message_sent")
        .map((e) => new Date(e.timestamp!).getTime())
        .sort();

      if (messageTimes.length > 1) {
        const intervals = [];
        for (let i = 1; i < messageTimes.length; i++) {
          intervals.push(messageTimes[i] - messageTimes[i - 1]);
        }
        metrics.averageResponseTime =
          intervals.reduce((a, b) => a + b, 0) / intervals.length;
      }

      // Calculate session duration
      const openEvent = analytics.find((e) => e.event_type === "chat_opened");
      const closeEvent = analytics.find((e) => e.event_type === "chat_closed");

      if (openEvent && closeEvent) {
        metrics.sessionDuration =
          new Date(closeEvent.timestamp!).getTime() -
          new Date(openEvent.timestamp!).getTime();
      }

      return metrics;
    } catch (error) {
      ErrorLogger.log(error as Error, { context: "analytics", action: "calculate_chat_metrics", chatRoomId });
      return null;
    }
  }

  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }

    // Flush remaining events
    this.flushEvents();
  }
}

// Global analytics instance
export const chatAnalytics = new ChatAnalytics();

// React hook for analytics
export function useChatAnalytics(chatRoomId?: string) {
  const trackActivity = (
    activity:
      | "opened"
      | "closed"
      | "message_sent"
      | "message_received"
      | "file_uploaded",
    metadata?: Record<string, any>
  ) => {
    if (chatRoomId) {
      chatAnalytics.trackChatActivity(activity, chatRoomId, metadata);
    }
  };

  const trackPerformance = (
    metricName: string,
    value: number,
    unit: PerformanceMetric["unit"],
    context?: Record<string, any>
  ) => {
    chatAnalytics.trackPerformance(metricName, value, unit, context);
  };

  const trackError = (error: Error | string, context?: Record<string, any>) => {
    chatAnalytics.trackError(error, context);
  };

  return {
    trackActivity,
    trackPerformance,
    trackError,
  };
}
