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

    // Get daily active users
    const { data: activeUsersData } = await supabase
      .from("chat_messages")
      .select("sender_id")
      .gte("sent_at", startTime.toISOString());

    const dailyActiveUsers = new Set(
      activeUsersData?.map((msg) => msg.sender_id) || []
    ).size;

    // Get messages per session
    const { data: sessionMessageData } = await supabase
      .from("chat_rooms")
      .select(
        `
        id,
        messages:chat_messages(count)
      `
      )
      .gte("created_at", startTime.toISOString());

    let messagesPerSession = 0;
    if (sessionMessageData && sessionMessageData.length > 0) {
      const totalMessages = sessionMessageData.reduce((sum, session) => {
        return sum + (session.messages?.[0]?.count || 0);
      }, 0);
      messagesPerSession = totalMessages / sessionMessageData.length;
    }

    // Get file uploads per session
    const { data: fileUploadData } = await supabase
      .from("chat_messages")
      .select("chat_room_id")
      .in("message_type", ["FILE", "IMAGE"])
      .gte("sent_at", startTime.toISOString());

    const fileUploadsByRoom = (fileUploadData || []).reduce((acc, msg) => {
      acc[msg.chat_room_id] = (acc[msg.chat_room_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalSessions = sessionMessageData?.length || 0;
    const totalFileUploads = Object.values(fileUploadsByRoom).reduce(
      (a, b) => a + b,
      0
    );
    const fileUploadsPerSession =
      totalSessions > 0 ? totalFileUploads / totalSessions : 0;

    // Get popular time slots
    const { data: timeSlotData } = await supabase
      .from("chat_messages")
      .select("sent_at")
      .gte("sent_at", startTime.toISOString());

    const hourlyActivity = (timeSlotData || []).reduce((acc, msg) => {
      const hour = new Date(msg.sent_at).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const popularTimeSlots = Object.entries(hourlyActivity)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // Get top specialties
    const { data: specialtyData } = await supabase
      .from("chat_rooms")
      .select(
        `
        id,
        doctor:doctors!chat_rooms_doctor_id_fkey(specialty)
      `
      )
      .gte("created_at", startTime.toISOString());

    const specialtyCounts = (specialtyData || []).reduce((acc, room) => {
      const specialty = room.doctor?.specialty || "Unknown";
      acc[specialty] = (acc[specialty] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topSpecialties = Object.entries(specialtyCounts)
      .map(([specialty, sessions]) => ({ specialty, sessions }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 5);

    const usage = {
      dailyActiveUsers,
      messagesPerSession: Math.round(messagesPerSession * 10) / 10,
      fileUploadsPerSession: Math.round(fileUploadsPerSession * 10) / 10,
      popularTimeSlots,
      topSpecialties,
    };

    return NextResponse.json(usage);
  } catch (error) {
    console.error("Error fetching usage analytics:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
