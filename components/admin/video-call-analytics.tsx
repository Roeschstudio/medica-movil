"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase-client";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, intervalToDuration } from "date-fns";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Play,
  TrendingUp,
  Users,
  Video,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface VideoCallStats {
  totalCalls: number;
  activeCalls: number;
  completedCalls: number;
  failedCalls: number;
  cancelledCalls: number;
  avgDuration: number;
  totalDuration: number;
  successRate: number;
}

interface ActiveCall {
  id: string;
  sessionId: string;
  roomName: string;
  type: "CONSULTATION" | "FOLLOW_UP" | "EMERGENCY";
  status: "WAITING" | "ACTIVE" | "ENDED" | "CANCELLED";
  initiatorId: string;
  duration: number;
  startedAt: string;
  chatRoom: {
    appointment: {
      doctor: {
        user: {
          name: string;
        };
      };
      patient: {
        name: string;
      };
    };
  };
  participants: Array<{
    id: string;
    userId: string;
    joinedAt?: string;
    leftAt?: string;
    isConnected: boolean;
    user: {
      name: string;
      role: "PATIENT" | "DOCTOR" | "ADMIN";
    };
  }>;
}

interface VideoCall {
  id: string;
  sessionId: string;
  roomName: string;
  type: "CONSULTATION" | "FOLLOW_UP" | "EMERGENCY";
  status: "WAITING" | "ACTIVE" | "ENDED" | "CANCELLED";
  duration: number;
  startedAt: string;
  endedAt?: string;
  chatRoom: {
    appointment: {
      doctor: {
        user: {
          name: string;
        };
      };
      patient: {
        name: string;
      };
    };
  };
}

interface VideoCallAnalyticsState {
  stats: VideoCallStats;
  activeCalls: ActiveCall[];
  recentCalls: VideoCall[];
  isLoading: boolean;
  error: string | null;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case "WAITING":
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case "ACTIVE":
      return <Play className="h-4 w-4 text-green-500" />;
    case "ENDED":
      return <CheckCircle className="h-4 w-4 text-blue-500" />;
    case "CANCELLED":
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Video className="h-4 w-4 text-gray-500" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "WAITING":
      return "bg-yellow-100 text-yellow-800";
    case "ACTIVE":
      return "bg-green-100 text-green-800";
    case "ENDED":
      return "bg-blue-100 text-blue-800";
    case "CANCELLED":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const formatCallDuration = (seconds: number) => {
  if (seconds === 0) return "0:00";

  const duration = intervalToDuration({ start: 0, end: seconds * 1000 });
  const hours = duration.hours || 0;
  const minutes = duration.minutes || 0;
  const secs = duration.seconds || 0;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
};

export function VideoCallAnalytics() {
  const [state, setState] = useState<VideoCallAnalyticsState>({
    stats: {
      totalCalls: 0,
      activeCalls: 0,
      completedCalls: 0,
      failedCalls: 0,
      cancelledCalls: 0,
      avgDuration: 0,
      totalDuration: 0,
      successRate: 0,
    },
    activeCalls: [],
    recentCalls: [],
    isLoading: true,
    error: null,
  });

  // Using imported supabase client

  // Calculate video call statistics
  const calculateStats = useCallback(async () => {
    try {
      // Get total calls count by status
      const { data: allCalls, error: callsError } = await supabase
        .from("video_sessions")
        .select("status, duration, startedAt, endedAt");

      if (callsError) throw callsError;

      const calls = allCalls || [];
      const totalCalls = calls.length;
      const activeCalls = calls.filter(
        (call) => call.status === "ACTIVE"
      ).length;
      const completedCalls = calls.filter(
        (call) => call.status === "ENDED"
      ).length;
      const cancelledCalls = calls.filter(
        (call) => call.status === "CANCELLED"
      ).length;
      const failedCalls = calls.filter(
        (call) => call.status === "ENDED" && call.duration < 60 // Consider calls under 1 minute as failed
      ).length;

      const totalDuration = calls.reduce(
        (sum, call) => sum + (call.duration || 0),
        0
      );
      const avgDuration =
        completedCalls > 0 ? totalDuration / completedCalls : 0;
      const successRate =
        totalCalls > 0
          ? ((completedCalls - failedCalls) / totalCalls) * 100
          : 0;

      return {
        totalCalls,
        activeCalls,
        completedCalls,
        failedCalls,
        cancelledCalls,
        avgDuration,
        totalDuration,
        successRate,
      };
    } catch (error) {
      console.error("Error calculating stats:", error);
      throw error;
    }
  }, [supabase]);

  // Load active calls
  const loadActiveCalls = useCallback(async () => {
    try {
      const { data: calls, error } = await supabase
        .from("video_sessions")
        .select(
          `
          id,
          sessionId,
          roomName,
          type,
          status,
          initiatorId,
          duration,
          startedAt,
          chatRoom:chat_rooms(
            appointment:appointments(
              doctor:doctors(
                user:users(name)
              ),
              patient:users!appointments_patientId_fkey(name)
            )
          ),
          participants:video_session_participants(
            id,
            userId,
            joinedAt,
            leftAt,
            isConnected,
            user:users(name, role)
          )
        `
        )
        .in("status", ["WAITING", "ACTIVE"])
        .order("startedAt", { ascending: false });

      if (error) throw error;

      return calls || [];
    } catch (error) {
      console.error("Error loading active calls:", error);
      throw error;
    }
  }, [supabase]);

  // Load recent calls
  const loadRecentCalls = useCallback(async () => {
    try {
      const { data: calls, error } = await supabase
        .from("video_sessions")
        .select(
          `
          id,
          sessionId,
          roomName,
          type,
          status,
          duration,
          startedAt,
          endedAt,
          chatRoom:chat_rooms(
            appointment:appointments(
              doctor:doctors(
                user:users(name)
              ),
              patient:users!appointments_patientId_fkey(name)
            )
          )
        `
        )
        .order("startedAt", { ascending: false })
        .limit(20);

      if (error) throw error;

      return calls || [];
    } catch (error) {
      console.error("Error loading recent calls:", error);
      throw error;
    }
  }, [supabase]);

  // Load all data
  const loadData = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const [stats, activeCalls, recentCalls] = await Promise.all([
        calculateStats(),
        loadActiveCalls(),
        loadRecentCalls(),
      ]);

      setState((prev) => ({
        ...prev,
        stats,
        activeCalls,
        recentCalls,
        isLoading: false,
      }));
    } catch (error) {
      console.error("Error loading video call data:", error);
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load video call data",
        isLoading: false,
      }));
    }
  }, [calculateStats, loadActiveCalls, loadRecentCalls]);

  // Set up real-time subscriptions
  useEffect(() => {
    loadData();

    // Subscribe to video session changes
    const videoChannel = supabase
      .channel("admin-video-analytics")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "video_sessions",
        },
        () => {
          loadData();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "video_session_participants",
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      videoChannel.unsubscribe();
    };
  }, [supabase, loadData]);

  const { stats, activeCalls, recentCalls, isLoading, error } = state;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Calls</p>
                <p className="text-2xl font-bold">{stats.totalCalls}</p>
              </div>
              <Video className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Active Calls
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.activeCalls}
                </p>
              </div>
              <Play className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Success Rate
                </p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    stats.successRate >= 80
                      ? "text-green-600"
                      : stats.successRate >= 60
                      ? "text-yellow-600"
                      : "text-red-600"
                  )}
                >
                  {stats.successRate.toFixed(1)}%
                </p>
              </div>
              <TrendingUp
                className={cn(
                  "h-8 w-8",
                  stats.successRate >= 80
                    ? "text-green-500"
                    : stats.successRate >= 60
                    ? "text-yellow-500"
                    : "text-red-500"
                )}
              />
            </div>
            {stats.successRate < 80 && (
              <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
                <AlertTriangle className="h-3 w-3" />
                <span>Below target (80%)</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Avg Duration
                </p>
                <p className="text-2xl font-bold">
                  {formatCallDuration(stats.avgDuration)}
                </p>
              </div>
              <Clock className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Calls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-green-500" />
              Active Calls
              <Badge variant="secondary">{activeCalls.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeCalls.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Video className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No active calls</p>
              </div>
            ) : (
              <ScrollArea className="h-80">
                <div className="space-y-3">
                  {activeCalls.map((call) => (
                    <div key={call.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(call.status)}
                          <Badge className={getStatusColor(call.status)}>
                            {call.status}
                          </Badge>
                        </div>
                        <span className="text-sm font-mono">
                          {formatCallDuration(call.duration)}
                        </span>
                      </div>

                      <div className="space-y-1 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            Dr. {call.chatRoom.appointment.doctor.user.name}
                          </span>
                          <span className="text-gray-500">
                            {call.chatRoom.appointment.patient.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Room: {call.roomName}</span>
                          <span>Type: {call.type}</span>
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                          <Users className="h-3 w-3" />
                          <span className="text-xs">
                            {
                              call.participants.filter((p) => p.isConnected)
                                .length
                            }{" "}
                            connected
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Recent Calls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Calls
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentCalls.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Video className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No recent calls</p>
              </div>
            ) : (
              <ScrollArea className="h-80">
                <div className="space-y-3">
                  {recentCalls.map((call) => (
                    <div key={call.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(call.status)}
                          <Badge className={getStatusColor(call.status)}>
                            {call.status}
                          </Badge>
                        </div>
                        <span className="text-sm font-mono">
                          {formatCallDuration(call.duration)}
                        </span>
                      </div>

                      <div className="space-y-1 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            Dr. {call.chatRoom.appointment.doctor.user.name}
                          </span>
                          <span className="text-gray-500">
                            {call.chatRoom.appointment.patient.name}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>Type: {call.type}</span>
                          <span>
                            {formatDistanceToNow(new Date(call.startedAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
