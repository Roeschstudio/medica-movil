import { createSupabaseServerClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    // Verify admin access
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userError || userData?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get("timeframe") || "24h";

    // Calculate time range
    const now = new Date();
    let startTime: Date;

    switch (timeframe) {
      case "1h":
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case "24h":
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Get chat metrics
    const [
      totalMessagesResult,
      activeRoomsResult,
      errorRateResult,
      responseTimeResult,
      fileUploadsResult,
      userActivityResult,
    ] = await Promise.all([
      // Total messages in timeframe
      supabase
        .from("chat_messages")
        .select("id", { count: "exact" })
        .gte("sentAt", startTime.toISOString()),

      // Active chat rooms
      supabase
        .from("chat_rooms")
        .select("id", { count: "exact" })
        .eq("isActive", true),

      // Error rate from analytics
      supabase
        .from("chat_analytics")
        .select("id", { count: "exact" })
        .eq("event_type", "connection_error")
        .gte("timestamp", startTime.toISOString()),

      // Average response time calculation
      supabase
        .from("chat_messages")
        .select("sentAt, chatRoomId")
        .gte("sentAt", startTime.toISOString())
        .order("sentAt", { ascending: true }),

      // File uploads
      supabase
        .from("chat_messages")
        .select("id", { count: "exact" })
        .in("messageType", ["FILE", "IMAGE"])
        .gte("sentAt", startTime.toISOString()),

      // User activity
      supabase
        .from("chat_analytics")
        .select("user_id, event_type, timestamp")
        .in("event_type", ["chat_opened", "message_sent"])
        .gte("timestamp", startTime.toISOString()),
    ]);

    // Calculate response times
    let averageResponseTime = 0;
    if (responseTimeResult.data && responseTimeResult.data.length > 1) {
      const messagesByRoom = responseTimeResult.data.reduce((acc, msg) => {
        if (!acc[msg.chatRoomId]) acc[msg.chatRoomId] = [];
        acc[msg.chatRoomId].push(new Date(msg.sentAt).getTime());
        return acc;
      }, {} as Record<string, number[]>);

      const responseTimes: number[] = [];
      Object.values(messagesByRoom).forEach((times) => {
        if (times.length > 1) {
          times.sort();
          for (let i = 1; i < times.length; i++) {
            responseTimes.push(times[i] - times[i - 1]);
          }
        }
      });

      if (responseTimes.length > 0) {
        averageResponseTime =
          responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      }
    }

    // Calculate error rate
    const totalEvents =
      (totalMessagesResult.count || 0) + (errorRateResult.count || 0);
    const errorRate =
      totalEvents > 0 ? (errorRateResult.count || 0) / totalEvents : 0;

    // Calculate peak concurrent users
    const userActivities = userActivityResult.data || [];
    const hourlyActivity = userActivities.reduce((acc, activity) => {
      const hour = new Date(activity.timestamp).toISOString().slice(0, 13);
      if (!acc[hour]) acc[hour] = new Set();
      acc[hour].add(activity.user_id);
      return acc;
    }, {} as Record<string, Set<string>>);

    const peakConcurrentUsers = Math.max(
      ...Object.values(hourlyActivity).map((users) => users.size),
      0
    );

    // Get system performance metrics
    const { data: performanceData } = await supabase
      .from("chat_analytics")
      .select("metadata")
      .eq("event_type", "performance_metric")
      .gte("timestamp", startTime.toISOString())
      .order("timestamp", { ascending: false })
      .limit(100);

    const performanceMetrics =
      performanceData?.reduce((acc, record) => {
        const metadata = record.metadata as Record<string, unknown>;
        if (metadata?.metric_name && metadata?.value) {
          if (!acc[metadata.metric_name]) acc[metadata.metric_name] = [];
          acc[metadata.metric_name].push(metadata.value);
        }
        return acc;
      }, {} as Record<string, number[]>) || {};

    const avgPerformanceMetrics = Object.entries(performanceMetrics).reduce(
      (acc, [key, values]) => {
        acc[key] = values.reduce((a, b) => a + b, 0) / values.length;
        return acc;
      },
      {} as Record<string, number>
    );

    const metrics = {
      totalMessages: totalMessagesResult.count || 0,
      activeRooms: activeRoomsResult.count || 0,
      averageResponseTime: Math.round(averageResponseTime),
      errorRate: parseFloat((errorRate * 100).toFixed(2)),
      peakConcurrentUsers,
      fileUploads: fileUploadsResult.count || 0,
      performance: {
        averageLoadTime: avgPerformanceMetrics.page_load_time || 0,
        memoryUsage: avgPerformanceMetrics.memory_used || 0,
        realtimeLatency: avgPerformanceMetrics.realtime_latency || 0,
        databaseResponseTime: avgPerformanceMetrics.database_response_time || 0,
      },
      timeframe,
      generatedAt: now.toISOString(),
    };

    return NextResponse.json(metrics);
  } catch (_error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
