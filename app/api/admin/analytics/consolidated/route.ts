import { createSupabaseServerClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";

// Unified analytics endpoint that consolidates all analytics functionality
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

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userError || userData?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "overview"; // overview, performance, trends, usage
    const timeframe = searchParams.get("timeframe") || "24h";

    // Calculate time range
    const now = new Date();
    let startTime: Date;
    let previousStartTime: Date;

    switch (timeframe) {
      case "1h":
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        previousStartTime = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        break;
      case "24h":
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        previousStartTime = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
        break;
      case "7d":
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousStartTime = new Date(now.getTime() - 2 * 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousStartTime = new Date(now.getTime() - 2 * 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        previousStartTime = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    }

    let result: Record<string, unknown> = {};

    switch (type) {
      case "overview":
        result = await getOverviewAnalytics(supabase, startTime, previousStartTime);
        break;
      case "performance":
        result = await getPerformanceAnalytics(supabase, startTime);
        break;
      case "trends":
        result = await getTrendsAnalytics(supabase, startTime, timeframe);
        break;
      case "usage":
        result = await getUsageAnalytics(supabase, startTime);
        break;
      default:
        return NextResponse.json({ error: "Invalid analytics type" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (_error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Overview analytics logic
async function getOverviewAnalytics(supabase: SupabaseClient, startTime: Date, previousStartTime: Date) {
  const [
    totalSessionsResult,
    totalMessagesResult,
    totalUsersResult,
    sessionDurationResult,
    previousSessionsResult,
    previousMessagesResult,
  ] = await Promise.all([
    supabase
      .from("chat_rooms")
      .select("id", { count: "exact" })
      .gte("created_at", startTime.toISOString()),
    supabase
      .from("chat_messages")
      .select("id", { count: "exact" })
      .gte("sent_at", startTime.toISOString()),
    supabase
      .from("chat_messages")
      .select("sender_id")
      .gte("sent_at", startTime.toISOString()),
    supabase
      .from("chat_rooms")
      .select("started_at, ended_at")
      .gte("created_at", startTime.toISOString())
      .not("ended_at", "is", null),
    supabase
      .from("chat_rooms")
      .select("id", { count: "exact" })
      .gte("created_at", previousStartTime.toISOString())
      .lt("created_at", startTime.toISOString()),
    supabase
      .from("chat_messages")
      .select("id", { count: "exact" })
      .gte("sent_at", previousStartTime.toISOString())
      .lt("sent_at", startTime.toISOString()),
  ]);

  const uniqueUsers = new Set(
    totalUsersResult.data?.map((msg) => msg.sender_id) || []
  ).size;

  let averageSessionDuration = 0;
  if (sessionDurationResult.data && sessionDurationResult.data.length > 0) {
    const durations = sessionDurationResult.data
      .filter((session) => session.ended_at)
      .map((session) => {
        const start = new Date(session.started_at);
        const end = new Date(session.ended_at!);
        return (end.getTime() - start.getTime()) / (1000 * 60);
      });

    if (durations.length > 0) {
      averageSessionDuration =
        durations.reduce((a, b) => a + b, 0) / durations.length;
    }
  }

  const currentSessions = totalSessionsResult.count || 0;
  const previousSessions = previousSessionsResult.count || 0;
  const sessionGrowth =
    previousSessions > 0
      ? ((currentSessions - previousSessions) / previousSessions) * 100
      : 0;

  const currentMessages = totalMessagesResult.count || 0;
  const previousMessages = previousMessagesResult.count || 0;
  const messageGrowth =
    previousMessages > 0
      ? ((currentMessages - previousMessages) / previousMessages) * 100
      : 0;

  return {
    totalSessions: currentSessions,
    totalMessages: currentMessages,
    totalUsers: uniqueUsers,
    averageSessionDuration: Math.round(averageSessionDuration * 10) / 10,
    messageGrowth: Math.round(messageGrowth * 10) / 10,
    userGrowth: Math.round(sessionGrowth * 10) / 10,
  };
}

// Performance analytics logic
async function getPerformanceAnalytics(supabase: SupabaseClient, startTime: Date) {
  const [
    performanceData,
    totalEventsResult,
    errorEventsResult,
    messageData,
    userActivityData,
  ] = await Promise.all([
    supabase
      .from("chat_analytics")
      .select("metadata, timestamp")
      .eq("event_type", "performance_metric")
      .gte("timestamp", startTime.toISOString())
      .order("timestamp", { ascending: false }),
    supabase
      .from("chat_analytics")
      .select("id", { count: "exact" })
      .gte("timestamp", startTime.toISOString()),
    supabase
      .from("chat_analytics")
      .select("id", { count: "exact" })
      .eq("event_type", "connection_error")
      .gte("timestamp", startTime.toISOString()),
    supabase
      .from("chat_messages")
      .select("sent_at, chat_room_id")
      .gte("sent_at", startTime.toISOString())
      .order("sent_at", { ascending: true }),
    supabase
      .from("chat_analytics")
      .select("user_id, timestamp")
      .in("event_type", ["chat_opened", "message_sent"])
      .gte("timestamp", startTime.toISOString()),
  ]);

  // Calculate average response time
  let averageResponseTime = 0;
  if (messageData.data && messageData.data.length > 1) {
    const messagesByRoom = messageData.data.reduce((acc, msg) => {
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

  const metrics = (performanceData.data || []).reduce((acc, record) => {
    const metadata = record.metadata as Record<string, unknown>;
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

  const totalEvents = totalEventsResult.count || 0;
  const errorEvents = errorEventsResult.count || 0;
  const errorRate = totalEvents > 0 ? (errorEvents / totalEvents) * 100 : 0;

  const hourlyActivity = (userActivityData.data || []).reduce((acc, activity) => {
    const hour = new Date(activity.timestamp).toISOString().slice(0, 13);
    if (!acc[hour]) acc[hour] = new Set();
    acc[hour].add(activity.user_id);
    return acc;
  }, {} as Record<string, Set<string>>);

  const peakConcurrentUsers = Math.max(
    ...Object.values(hourlyActivity).map((users) => users.size),
    0
  );

  const uptime = totalEvents > 0 ? ((totalEvents - errorEvents) / totalEvents) * 100 : 100;

  return {
    averageResponseTime: Math.round(averageResponseTime),
    messageDeliveryRate: Math.round((100 - errorRate) * 10) / 10,
    errorRate: Math.round(errorRate * 100) / 100,
    uptime: Math.round(uptime * 10) / 10,
    peakConcurrentUsers,
    systemLatency: Math.round(avgMetrics.realtime_latency || 0),
  };
}

// Trends analytics logic
async function getTrendsAnalytics(supabase: SupabaseClient, startTime: Date, timeframe: string) {
  let dataPoints: number;
  let intervalMs: number;

  switch (timeframe) {
    case "1h":
      dataPoints = 12;
      intervalMs = 5 * 60 * 1000;
      break;
    case "24h":
      dataPoints = 24;
      intervalMs = 60 * 60 * 1000;
      break;
    case "7d":
      dataPoints = 7;
      intervalMs = 24 * 60 * 60 * 1000;
      break;
    case "30d":
      dataPoints = 30;
      intervalMs = 24 * 60 * 60 * 1000;
      break;
    default:
      dataPoints = 24;
      intervalMs = 60 * 60 * 1000;
  }

  const [
    messageData,
    userActivityData,
    errorData,
    performanceData,
  ] = await Promise.all([
    supabase
      .from("chat_messages")
      .select("sent_at")
      .gte("sent_at", startTime.toISOString())
      .order("sent_at", { ascending: true }),
    supabase
      .from("chat_analytics")
      .select("user_id, timestamp")
      .in("event_type", ["chat_opened", "message_sent"])
      .gte("timestamp", startTime.toISOString()),
    supabase
      .from("chat_analytics")
      .select("timestamp")
      .eq("event_type", "connection_error")
      .gte("timestamp", startTime.toISOString()),
    supabase
      .from("chat_analytics")
      .select("metadata, timestamp")
      .eq("event_type", "performance_metric")
      .gte("timestamp", startTime.toISOString()),
  ]);

  const timeBuckets = Array.from({ length: dataPoints }, (_, i) => {
    const bucketStart = new Date(startTime.getTime() + i * intervalMs);
    return {
      start: bucketStart,
      date: bucketStart.toISOString().split("T")[0],
      messages: 0,
      users: new Set<string>(),
      errors: 0,
      responseTimes: [] as number[],
    };
  });

  // Process data into buckets
  (messageData.data || []).forEach((msg) => {
    const msgTime = new Date(msg.sent_at);
    const bucketIndex = Math.floor(
      (msgTime.getTime() - startTime.getTime()) / intervalMs
    );
    if (bucketIndex >= 0 && bucketIndex < dataPoints) {
      timeBuckets[bucketIndex].messages++;
    }
  });

  (userActivityData.data || []).forEach((activity) => {
    const activityTime = new Date(activity.timestamp);
    const bucketIndex = Math.floor(
      (activityTime.getTime() - startTime.getTime()) / intervalMs
    );
    if (bucketIndex >= 0 && bucketIndex < dataPoints) {
      timeBuckets[bucketIndex].users.add(activity.user_id);
    }
  });

  (errorData.data || []).forEach((error) => {
    const errorTime = new Date(error.timestamp);
    const bucketIndex = Math.floor(
      (errorTime.getTime() - startTime.getTime()) / intervalMs
    );
    if (bucketIndex >= 0 && bucketIndex < dataPoints) {
      timeBuckets[bucketIndex].errors++;
    }
  });

  (performanceData.data || []).forEach((perf) => {
    const metadata = perf.metadata as any;
    if (metadata?.metric_name === "response_time" && metadata?.value) {
      const perfTime = new Date(perf.timestamp);
      const bucketIndex = Math.floor(
        (perfTime.getTime() - startTime.getTime()) / intervalMs
      );
      if (bucketIndex >= 0 && bucketIndex < dataPoints) {
        timeBuckets[bucketIndex].responseTimes.push(metadata.value);
      }
    }
  });

  return {
    messageVolume: timeBuckets.map((bucket) => ({
      date: bucket.date,
      count: bucket.messages,
    })),
    userActivity: timeBuckets.map((bucket) => ({
      date: bucket.date,
      users: bucket.users.size,
    })),
    errorRates: timeBuckets.map((bucket) => {
      const totalEvents = bucket.messages + bucket.errors;
      const rate = totalEvents > 0 ? (bucket.errors / totalEvents) * 100 : 0;
      return {
        date: bucket.date,
        rate: Math.round(rate * 100) / 100,
      };
    }),
    responseTime: timeBuckets.map((bucket) => {
      const avgTime =
        bucket.responseTimes.length > 0
          ? bucket.responseTimes.reduce((a, b) => a + b, 0) /
            bucket.responseTimes.length
          : 0;
      return {
        date: bucket.date,
        time: Math.round(avgTime),
      };
    }),
  };
}

// Usage analytics logic
async function getUsageAnalytics(supabase: SupabaseClient, startTime: Date) {
  const [
    activeUsersData,
    sessionMessageData,
    fileUploadData,
    timeSlotData,
    specialtyData,
  ] = await Promise.all([
    supabase
      .from("chat_messages")
      .select("sender_id")
      .gte("sent_at", startTime.toISOString()),
    supabase
      .from("chat_rooms")
      .select(`
        id,
        messages:chat_messages(count)
      `)
      .gte("created_at", startTime.toISOString()),
    supabase
      .from("chat_messages")
      .select("chat_room_id")
      .in("message_type", ["FILE", "IMAGE"])
      .gte("sent_at", startTime.toISOString()),
    supabase
      .from("chat_messages")
      .select("sent_at")
      .gte("sent_at", startTime.toISOString()),
    supabase
      .from("chat_rooms")
      .select(`
        id,
        doctor:doctors!chat_rooms_doctor_id_fkey(specialty)
      `)
      .gte("created_at", startTime.toISOString()),
  ]);

  const dailyActiveUsers = new Set(
    activeUsersData.data?.map((msg) => msg.sender_id) || []
  ).size;

  let messagesPerSession = 0;
  if (sessionMessageData.data && sessionMessageData.data.length > 0) {
    const totalMessages = sessionMessageData.data.reduce((sum, session) => {
      return sum + (session.messages?.[0]?.count || 0);
    }, 0);
    messagesPerSession = totalMessages / sessionMessageData.data.length;
  }

  const fileUploadsByRoom = (fileUploadData.data || []).reduce((acc, msg) => {
    acc[msg.chat_room_id] = (acc[msg.chat_room_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalSessions = sessionMessageData.data?.length || 0;
  const totalFileUploads = Object.values(fileUploadsByRoom).reduce(
    (a, b) => a + b,
    0
  );
  const fileUploadsPerSession =
    totalSessions > 0 ? totalFileUploads / totalSessions : 0;

  const hourlyActivity = (timeSlotData.data || []).reduce((acc, msg) => {
    const hour = new Date(msg.sent_at).getHours();
    acc[hour] = (acc[hour] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const popularTimeSlots = Object.entries(hourlyActivity)
    .map(([hour, count]) => ({ hour: parseInt(hour), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const specialtyCounts = (specialtyData.data || []).reduce((acc, room) => {
    const specialty = room.doctor?.specialty || "Unknown";
    acc[specialty] = (acc[specialty] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topSpecialties = Object.entries(specialtyCounts)
    .map(([specialty, sessions]) => ({ specialty, sessions }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 5);

  return {
    dailyActiveUsers,
    messagesPerSession: Math.round(messagesPerSession * 10) / 10,
    fileUploadsPerSession: Math.round(fileUploadsPerSession * 10) / 10,
    popularTimeSlots,
    topSpecialties,
  };
}

// POST endpoint for generating reports
export async function POST(request: NextRequest) {
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

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role, name")
      .eq("id", user.id)
      .single();

    if (userError || userData?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      type,
      timeframe,
      startDate,
      endDate,
    } = body;

    // Calculate time range
    const now = new Date();
    let reportStartTime: Date;
    let reportEndTime: Date = now;

    if (timeframe === "custom" && startDate && endDate) {
      reportStartTime = new Date(startDate);
      reportEndTime = new Date(endDate);
    } else {
      switch (timeframe) {
        case "1h":
          reportStartTime = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case "24h":
          reportStartTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          reportStartTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          reportStartTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          reportStartTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }
    }

    // Get analytics data based on type
    const reportData: Record<string, unknown> = {};
    
    if (type === "overview" || type === "custom") {
      reportData.overview = await getOverviewAnalytics(supabase, reportStartTime, new Date(reportStartTime.getTime() - (reportEndTime.getTime() - reportStartTime.getTime())));
    }
    
    if (type === "performance" || type === "custom") {
      reportData.performance = await getPerformanceAnalytics(supabase, reportStartTime);
    }
    
    if (type === "usage" || type === "custom") {
      reportData.usage = await getUsageAnalytics(supabase, reportStartTime);
    }

    const jsonReport = {
      reportType: type,
      timeframe: {
        start: reportStartTime.toISOString(),
        end: reportEndTime.toISOString(),
      },
      generatedAt: now.toISOString(),
      generatedBy: userData.name,
      data: reportData,
    };

    return NextResponse.json(jsonReport, {
      headers: {
        "Content-Disposition": `attachment; filename="chat-analytics-${type}-${now.toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}