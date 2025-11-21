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
        previousStartTime = new Date(
          now.getTime() - 2 * 7 * 24 * 60 * 60 * 1000
        );
        break;
      case "30d":
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousStartTime = new Date(
          now.getTime() - 2 * 30 * 24 * 60 * 60 * 1000
        );
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        previousStartTime = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    }

    // Get current period metrics
    const [
      totalSessionsResult,
      totalMessagesResult,
      totalUsersResult,
      sessionDurationResult,
    ] = await Promise.all([
      // Total chat sessions
      supabase
        .from("chat_rooms")
        .select("id", { count: "exact" })
        .gte("created_at", startTime.toISOString()),

      // Total messages
      supabase
        .from("chat_messages")
        .select("id", { count: "exact" })
        .gte("sent_at", startTime.toISOString()),

      // Active users (users who sent messages)
      supabase
        .from("chat_messages")
        .select("sender_id")
        .gte("sent_at", startTime.toISOString()),

      // Session durations
      supabase
        .from("chat_rooms")
        .select("started_at, ended_at")
        .gte("created_at", startTime.toISOString())
        .not("ended_at", "is", null),
    ]);

    // Get previous period metrics for growth calculation
    const [previousSessionsResult, previousMessagesResult] = await Promise.all([
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

    // Calculate unique users
    const uniqueUsers = new Set(
      totalUsersResult.data?.map((msg) => msg.sender_id) || []
    ).size;

    // Calculate average session duration
    let averageSessionDuration = 0;
    if (sessionDurationResult.data && sessionDurationResult.data.length > 0) {
      const durations = sessionDurationResult.data
        .filter((session) => session.ended_at)
        .map((session) => {
          const start = new Date(session.started_at);
          const end = new Date(session.ended_at!);
          return (end.getTime() - start.getTime()) / (1000 * 60); // minutes
        });

      if (durations.length > 0) {
        averageSessionDuration =
          durations.reduce((a, b) => a + b, 0) / durations.length;
      }
    }

    // Calculate growth rates
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

    const overview = {
      totalSessions: currentSessions,
      totalMessages: currentMessages,
      totalUsers: uniqueUsers,
      averageSessionDuration: Math.round(averageSessionDuration * 10) / 10,
      messageGrowth: Math.round(messageGrowth * 10) / 10,
      userGrowth: Math.round(sessionGrowth * 10) / 10, // Using session growth as proxy for user growth
    };

    return NextResponse.json(overview);
  } catch (error) {
    console.error("Error fetching overview analytics:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
