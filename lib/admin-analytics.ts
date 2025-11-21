"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import { ErrorLogger } from "./error-handling-utils";

export interface AdminChatMetrics {
  activeSessions: number;
  totalMessages: number;
  averageResponseTime: number;
  errorRate: number;
  peakConcurrentUsers: number;
  fileUploads: number;
  systemHealth: {
    realtimeLatency: number;
    databaseResponseTime: number;
    memoryUsage: number;
    uptime: number;
  };
}

export interface ChatSessionSummary {
  id: string;
  appointmentId: string;
  patientName: string;
  doctorName: string;
  specialty: string;
  isActive: boolean;
  messageCount: number;
  unreadCount: number;
  duration: number;
  lastActivity: string;
  hasRecentActivity: boolean;
}

class AdminAnalyticsService {
  private supabase = createSupabaseBrowserClient();

  async getChatMetrics(
    timeframe: string = "24h"
  ): Promise<AdminChatMetrics | null> {
    try {
      const response = await fetch(
        `/api/admin/chat/metrics?timeframe=${timeframe}`
      );
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      ErrorLogger.log(error as Error, { context: "admin_analytics", action: "fetch_chat_metrics", timeframe });
      return null;
    }
  }

  async getChatSessions(status: string = "all"): Promise<ChatSessionSummary[]> {
    try {
      const response = await fetch(`/api/admin/chat/sessions?status=${status}`);
      if (response.ok) {
        const data = await response.json();
        return (
          data.sessions?.map((session: any) => ({
            id: session.id,
            appointmentId: session.appointmentId,
            patientName: session.patient?.name || "Unknown",
            doctorName: session.doctor?.user?.name || "Unknown",
            specialty: session.doctor?.specialty || "Unknown",
            isActive: session.isActive,
            messageCount: session.messageCount || 0,
            unreadCount: session.unreadCount || 0,
            duration: this.calculateDuration(
              session.startedAt,
              session.endedAt
            ),
            lastActivity: session.presence?.lastActivity || session.updatedAt,
            hasRecentActivity: session.presence?.hasRecentActivity || false,
          })) || []
        );
      }
      return [];
    } catch (error) {
      ErrorLogger.log(error as Error, { context: "admin_analytics", action: "fetch_chat_sessions", status });
      return [];
    }
  }

  async performIntervention(
    action: string,
    chatRoomId: string,
    message?: string,
    reason?: string
  ): Promise<boolean> {
    try {
      const response = await fetch("/api/admin/chat/intervention", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          chatRoomId,
          message,
          reason,
        }),
      });

      return response.ok;
    } catch (error) {
      ErrorLogger.log(error as Error, { context: "admin_analytics", action: "perform_intervention", chatRoomId, interventionAction: action });
      return false;
    }
  }

  async getSystemHealth(): Promise<any> {
    try {
      const response = await fetch("/api/chat/health");
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      ErrorLogger.log(error as Error, { context: "admin_analytics", action: "fetch_system_health" });
      return null;
    }
  }

  async getAnalyticsHistory(
    chatRoomId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from("chat_analytics")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(1000);

      if (error) throw error;

      let filteredData = data || [];

      if (chatRoomId) {
        filteredData = filteredData.filter(
          (item) => item.chat_room_id === chatRoomId
        );
      }

      if (startDate) {
        filteredData = filteredData.filter(
          (item) => new Date(item.timestamp) >= startDate
        );
      }

      if (endDate) {
        filteredData = filteredData.filter(
          (item) => new Date(item.timestamp) <= endDate
        );
      }

      return filteredData;
    } catch (error) {
      ErrorLogger.log(error as Error, { context: "admin_analytics", action: "fetch_analytics_history", chatRoomId });
      return [];
    }
  }

  async getInterventionHistory(): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from("admin_interventions")
        .select(
          `
          *,
          admin:users!admin_interventions_admin_id_fkey(name, email),
          chat_room:chat_rooms!admin_interventions_chat_room_id_fkey(
            appointmentId,
            patient:users!chat_rooms_patientId_fkey(name),
            doctor:doctors!chat_rooms_doctorId_fkey(
              specialty,
              user:users(name)
            )
          )
        `
        )
        .order("timestamp", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    } catch (error) {
      ErrorLogger.log(error as Error, { context: "admin_analytics", action: "fetch_intervention_history" });
      return [];
    }
  }

  async getEscalations(status?: string): Promise<any[]> {
    try {
      let query = this.supabase
        .from("chat_escalations")
        .select(
          `
          *,
          admin:users!chat_escalations_admin_id_fkey(name, email),
          assigned_admin:users!chat_escalations_assigned_to_fkey(name, email),
          chat_room:chat_rooms!chat_escalations_chat_room_id_fkey(
            appointmentId,
            patient:users!chat_rooms_patientId_fkey(name),
            doctor:doctors!chat_rooms_doctorId_fkey(
              specialty,
              user:users(name)
            )
          )
        `
        )
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      ErrorLogger.log(error as Error, { context: "admin_analytics", action: "fetch_escalations", status });
      return [];
    }
  }

  private calculateDuration(startTime: string, endTime?: string): number {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    return end.getTime() - start.getTime();
  }

  // Real-time subscription for admin monitoring
  subscribeToAdminUpdates(callback: (update: any) => void) {
    const channel = this.supabase
      .channel("admin_monitoring")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_rooms",
        },
        callback
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
        },
        callback
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "admin_interventions",
        },
        callback
      )
      .subscribe();

    return channel;
  }

  unsubscribeFromAdminUpdates(channel: any) {
    if (channel) {
      this.supabase.removeChannel(channel);
    }
  }
}

// Export singleton instance
export const adminAnalyticsService = new AdminAnalyticsService();
