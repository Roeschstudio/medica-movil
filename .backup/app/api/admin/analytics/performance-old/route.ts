import { createSupabaseServerClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();

    // Verify admin access
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Get performance metrics from analytics
    const { data: performanceData, error: perfError } = await supabase
      .from("chat_analytics")
      .select("metadata, timestamp")
      .eq("event_type", "performance_metric")
      .gte("timestamp", startTime.toISOString())
      .order("timestamp", { ascending: false });

    if (perfError) {
      console.error("Error fetching performance data:", perfError);
    }

    // Get error metrics
    const [totalEventsResult, errorEventsResult] = await Promise.all([
      supabase
        .from("chat_analytics")
        .select("id", { count: "exact" })
        .gte("timestamp", startTime.toISOString()),

      supabase
        .from("chat_analytics")
        .select("id", { count: "exact" })
        .eq("event_type", "connection_error")
        .gte("timestamp", startTime.toISOString()),
    ]);

    // Calculate response times from message data
    const { data: messageData } = await supabase
      .from("chat_messages")
      .select("sent_at, chat_room_id")
      .gte("sent_at", startTime.toISOString())
      .order("sent_at", { ascending: true });

    // Calculate average response time
    let averageResponseTime = 0;
    if (messageData && messageData.length > 1) {
      const messagesByRoom = messageData.reduce((acc, msg) => {
        if (!acc[msg.chat_room_id]) acc[msg.chat_room_id] = [];
        acc[msg.chat_room_id].push(new Date(msg.sent_at).getTime());
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

    // Process performance metrics
    const metrics = (performanceData || []).reduce((acc, record) => {
      const metadata = record.metadata as any;
      if (metadata?.metric_name && metadata?.value) {
        if (!acc[metadata.metric_name]) acc[metadata.metric_name] = [];
        acc[metadata.metric_name].push(metadata.value);
      }
      return acc;
    }, {} as Record<string, number[]>);

    const avgMetrics = Object.entries(metrics).reduce((acc, [key, values]) => {
      acc[key] = values.reduce((a, b) => a + b, 0) / values.length;
      return acc;
    }, {} as Record<string, number>);

    // Calculate error rate
    const totalEvents = totalEventsResult.count || 0;
    const errorEvents = errorEventsResult.count || 0;
    const errorRate = totalEvents > 0 ? (errorEvents / totalEvents) * 100 : 0;

    // Get peak concurrent users from analytics
    const { data: userActivityData } = await supabase
      .from("chat_analytics")
      .select("user_id, timestamp")
      .in("event_type", ["chat_opened", "message_sent"])
      .gte("timestamp", startTime.toISOString());

    // Calculate peak concurrent users by hour
    const hourlyActivity = (userActivityData || []).reduce((acc, activity) => {
      const hour = new Date(activity.timestamp).toISOString().slice(0, 13);
      if (!acc[hour]) acc[hour] = new Set();
      acc[hour].add(activity.user_id);
      return acc;
    }, {} as Record<string, Set<string>>);

    const peakConcurrentUsers = Math.max(
      ...Object.values(hourlyActivity).map((users) => users.size),
      0
    );

    // Calculate uptime (simplified - based on successful vs failed operations)
    const uptime =
      totalEvents > 0 ? ((totalEvents - errorEvents) / totalEvents) * 100 : 100;

    const performance = {
      averageResponseTime: Math.round(averageResponseTime),
      messageDeliveryRate: Math.round((100 - errorRate) * 10) / 10,
      errorRate: Math.round(errorRate * 100) / 100,
      uptime: Math.round(uptime * 10) / 10,
      peakConcurrentUsers,
      systemLatency: Math.round(avgMetrics.realtime_latency || 0),
    };

    return NextResponse.json(performance);
  } catch (error) {
    console.error("Error fetching performance analytics:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
