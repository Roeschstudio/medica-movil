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

    // Calculate time range and data points
    const now = new Date();
    let startTime: Date;
    let dataPoints: number;
    let intervalMs: number;

    switch (timeframe) {
      case "1h":
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        dataPoints = 12; // 5-minute intervals
        intervalMs = 5 * 60 * 1000;
        break;
      case "24h":
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        dataPoints = 24; // hourly intervals
        intervalMs = 60 * 60 * 1000;
        break;
      case "7d":
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dataPoints = 7; // daily intervals
        intervalMs = 24 * 60 * 60 * 1000;
        break;
      case "30d":
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        dataPoints = 30; // daily intervals
        intervalMs = 24 * 60 * 60 * 1000;
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        dataPoints = 24;
        intervalMs = 60 * 60 * 1000;
    }

    // Get message volume trends
    const { data: messageData } = await supabase
      .from("chat_messages")
      .select("sent_at")
      .gte("sent_at", startTime.toISOString())
      .order("sent_at", { ascending: true });

    // Get user activity trends
    const { data: userActivityData } = await supabase
      .from("chat_analytics")
      .select("user_id, timestamp")
      .in("event_type", ["chat_opened", "message_sent"])
      .gte("timestamp", startTime.toISOString());

    // Get error rate trends
    const { data: errorData } = await supabase
      .from("chat_analytics")
      .select("timestamp")
      .eq("event_type", "connection_error")
      .gte("timestamp", startTime.toISOString());

    // Get response time trends
    const { data: performanceData } = await supabase
      .from("chat_analytics")
      .select("metadata, timestamp")
      .eq("event_type", "performance_metric")
      .gte("timestamp", startTime.toISOString());

    // Create time buckets
    const timeBuckets = Array.from({ length: dataPoints }, (_, i) => {
      const bucketStart = new Date(startTime.getTime() + i * intervalMs);
      const bucketEnd = new Date(startTime.getTime() + (i + 1) * intervalMs);
      return {
        start: bucketStart,
        end: bucketEnd,
        date: bucketStart.toISOString().split("T")[0],
        messages: 0,
        users: new Set<string>(),
        errors: 0,
        responseTimes: [] as number[],
      };
    });

    // Process message volume
    (messageData || []).forEach((msg) => {
      const msgTime = new Date(msg.sent_at);
      const bucketIndex = Math.floor(
        (msgTime.getTime() - startTime.getTime()) / intervalMs
      );
      if (bucketIndex >= 0 && bucketIndex < dataPoints) {
        timeBuckets[bucketIndex].messages++;
      }
    });

    // Process user activity
    (userActivityData || []).forEach((activity) => {
      const activityTime = new Date(activity.timestamp);
      const bucketIndex = Math.floor(
        (activityTime.getTime() - startTime.getTime()) / intervalMs
      );
      if (bucketIndex >= 0 && bucketIndex < dataPoints) {
        timeBuckets[bucketIndex].users.add(activity.user_id);
      }
    });

    // Process errors
    (errorData || []).forEach((error) => {
      const errorTime = new Date(error.timestamp);
      const bucketIndex = Math.floor(
        (errorTime.getTime() - startTime.getTime()) / intervalMs
      );
      if (bucketIndex >= 0 && bucketIndex < dataPoints) {
        timeBuckets[bucketIndex].errors++;
      }
    });

    // Process response times
    (performanceData || []).forEach((perf) => {
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

    // Format trends data
    const messageVolume = timeBuckets.map((bucket) => ({
      date: bucket.date,
      count: bucket.messages,
    }));

    const userActivity = timeBuckets.map((bucket) => ({
      date: bucket.date,
      users: bucket.users.size,
    }));

    const errorRates = timeBuckets.map((bucket) => {
      const totalEvents = bucket.messages + bucket.errors;
      const rate = totalEvents > 0 ? (bucket.errors / totalEvents) * 100 : 0;
      return {
        date: bucket.date,
        rate: Math.round(rate * 100) / 100,
      };
    });

    const responseTime = timeBuckets.map((bucket) => {
      const avgTime =
        bucket.responseTimes.length > 0
          ? bucket.responseTimes.reduce((a, b) => a + b, 0) /
            bucket.responseTimes.length
          : 0;
      return {
        date: bucket.date,
        time: Math.round(avgTime),
      };
    });

    const trends = {
      messageVolume,
      userActivity,
      errorRates,
      responseTime,
    };

    return NextResponse.json(trends);
  } catch (error) {
    console.error("Error fetching trends analytics:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
