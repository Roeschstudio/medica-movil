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
    const status = searchParams.get("status") || "all";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query for active chat sessions
    let query = supabase
      .from("chat_rooms")
      .select(
        `
        id,
        appointmentId,
        isActive,
        startedAt,
        endedAt,
        createdAt,
        updatedAt,
        appointment:appointments!inner(
          id,
          scheduledAt,
          type,
          status
        ),
        patient:users!chat_rooms_patientId_fkey(
          id,
          name,
          email,
          phone
        ),
        doctor:doctors!chat_rooms_doctorId_fkey(
          id,
          specialty,
          user:users(
            id,
            name,
            email
          )
        ),
        messages:chat_messages(
          id,
          sentAt,
          messageType,
          isRead
        ),
        _messageCount:chat_messages(count)
      `
      )
      .order("updatedAt", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status === "active") {
      query = query.eq("isActive", true);
    } else if (status === "inactive") {
      query = query.eq("isActive", false);
    }

    const { data: sessions, error } = await query;

    if (error) {
      throw error;
    }

    // Get real-time presence data for active sessions
    const activeSessions =
      sessions?.filter((session) => session.isActive) || [];
    const presenceData = await Promise.all(
      activeSessions.map(async (session) => {
        try {
          // Get recent activity (messages in last 5 minutes)
          const { data: recentMessages } = await supabase
            .from("chat_messages")
            .select("sentAt, senderId")
            .eq("chatRoomId", session.id)
            .gte("sentAt", new Date(Date.now() - 5 * 60 * 1000).toISOString())
            .order("sentAt", { ascending: false });

          return {
            sessionId: session.id,
            hasRecentActivity: (recentMessages?.length || 0) > 0,
            lastActivity: recentMessages?.[0]?.sentAt || session.updatedAt,
            activeUsers: [
              ...new Set(recentMessages?.map((m) => m.senderId) || []),
            ].length,
          };
        } catch (error) {
          console.error(
            `Error getting presence for session ${session.id}:`,
            error
          );
          return {
            sessionId: session.id,
            hasRecentActivity: false,
            lastActivity: session.updatedAt,
            activeUsers: 0,
          };
        }
      })
    );

    // Enhance sessions with presence data
    const enhancedSessions = sessions?.map((session) => {
      const presence = presenceData.find((p) => p.sessionId === session.id);
      const messageCount = session.messages?.length || 0;
      const unreadCount =
        session.messages?.filter((m) => !m.isRead).length || 0;

      return {
        ...session,
        messageCount,
        unreadCount,
        presence: presence || {
          hasRecentActivity: false,
          lastActivity: session.updatedAt,
          activeUsers: 0,
        },
      };
    });

    return NextResponse.json({
      sessions: enhancedSessions,
      total: sessions?.length || 0,
      hasMore: (sessions?.length || 0) === limit,
    });
  } catch (error) {
    console.error("Error fetching chat sessions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
