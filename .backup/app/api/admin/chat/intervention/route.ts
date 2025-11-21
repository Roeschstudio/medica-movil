import { createSupabaseServerClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
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
      .select("role, name")
      .eq("id", user.id)
      .single();

    if (userError || userData?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { action, chatRoomId, message, reason } = body;

    if (!action || !chatRoomId) {
      return NextResponse.json(
        { error: "Missing required fields: action, chatRoomId" },
        { status: 400 }
      );
    }

    // Get chat room details
    const { data: chatRoom, error: roomError } = await supabase
      .from("chat_rooms")
      .select(
        `
        id,
        appointmentId,
        patientId,
        doctorId,
        isActive,
        appointment:appointments!inner(
          id,
          scheduledAt,
          type,
          status
        ),
        patient:users!chat_rooms_patientId_fkey(
          id,
          name,
          email
        ),
        doctor:doctors!chat_rooms_doctorId_fkey(
          id,
          specialty,
          user:users(
            id,
            name,
            email
          )
        )
      `
      )
      .eq("id", chatRoomId)
      .single();

    if (roomError || !chatRoom) {
      return NextResponse.json(
        { error: "Chat room not found" },
        { status: 404 }
      );
    }

    let result: any = {};

    switch (action) {
      case "send_message":
        if (!message) {
          return NextResponse.json(
            { error: "Message content required for send_message action" },
            { status: 400 }
          );
        }

        // Send admin message to chat room
        const { data: adminMessage, error: messageError } = await supabase
          .from("chat_messages")
          .insert({
            chatRoomId,
            senderId: user.id,
            content: `[ADMIN INTERVENTION] ${message}`,
            messageType: "TEXT",
            isRead: false,
          })
          .select()
          .single();

        if (messageError) {
          throw messageError;
        }

        result = {
          message: "Admin message sent successfully",
          messageId: adminMessage.id,
        };
        break;

      case "pause_chat":
        // Temporarily disable the chat room
        const { error: pauseError } = await supabase
          .from("chat_rooms")
          .update({
            isActive: false,
            endedAt: new Date().toISOString(),
          })
          .eq("id", chatRoomId);

        if (pauseError) {
          throw pauseError;
        }

        // Send notification to participants
        await supabase.from("chat_messages").insert({
          chatRoomId,
          senderId: user.id,
          content: `[ADMIN NOTICE] This chat has been temporarily paused by an administrator. ${
            reason ? `Reason: ${reason}` : ""
          }`,
          messageType: "TEXT",
          isRead: false,
        });

        result = { message: "Chat paused successfully" };
        break;

      case "resume_chat":
        // Re-enable the chat room
        const { error: resumeError } = await supabase
          .from("chat_rooms")
          .update({
            isActive: true,
            endedAt: null,
          })
          .eq("id", chatRoomId);

        if (resumeError) {
          throw resumeError;
        }

        // Send notification to participants
        await supabase.from("chat_messages").insert({
          chatRoomId,
          senderId: user.id,
          content: `[ADMIN NOTICE] This chat has been resumed by an administrator.`,
          messageType: "TEXT",
          isRead: false,
        });

        result = { message: "Chat resumed successfully" };
        break;

      case "end_chat":
        // Permanently end the chat session
        const { error: endError } = await supabase
          .from("chat_rooms")
          .update({
            isActive: false,
            endedAt: new Date().toISOString(),
          })
          .eq("id", chatRoomId);

        if (endError) {
          throw endError;
        }

        // Send final notification
        await supabase.from("chat_messages").insert({
          chatRoomId,
          senderId: user.id,
          content: `[ADMIN NOTICE] This chat session has been ended by an administrator. ${
            reason ? `Reason: ${reason}` : ""
          }`,
          messageType: "TEXT",
          isRead: false,
        });

        result = { message: "Chat ended successfully" };
        break;

      case "escalate":
        // Create an escalation record
        const { data: escalation, error: escalationError } = await supabase
          .from("chat_escalations")
          .insert({
            chatRoomId,
            adminId: user.id,
            reason: reason || "Manual escalation",
            status: "OPEN",
            priority: "HIGH",
            createdAt: new Date().toISOString(),
          })
          .select()
          .single();

        if (escalationError) {
          throw escalationError;
        }

        result = {
          message: "Chat escalated successfully",
          escalationId: escalation.id,
        };
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    // Log the intervention
    await supabase.from("admin_interventions").insert({
      adminId: user.id,
      adminName: userData.name,
      chatRoomId,
      action,
      reason: reason || null,
      message: message || null,
      timestamp: new Date().toISOString(),
      metadata: {
        chatRoom: {
          appointmentId: chatRoom.appointmentId,
          patientName: chatRoom.patient?.name,
          doctorName: chatRoom.doctor?.user?.name,
          specialty: chatRoom.doctor?.specialty,
        },
      },
    });

    // Send notifications to affected users
    const notifications = [];

    if (chatRoom.patientId) {
      notifications.push({
        userId: chatRoom.patientId,
        type: "SYSTEM",
        title: "Chat Session Update",
        message: `An administrator has ${action.replace(
          "_",
          " "
        )} your chat session.`,
        metadata: { chatRoomId, action, adminAction: true },
      });
    }

    if (chatRoom.doctorId) {
      notifications.push({
        userId: chatRoom.doctorId,
        type: "SYSTEM",
        title: "Chat Session Update",
        message: `An administrator has ${action.replace(
          "_",
          " "
        )} the chat session.`,
        metadata: { chatRoomId, action, adminAction: true },
      });
    }

    if (notifications.length > 0) {
      await supabase.from("notifications").insert(notifications);
    }

    return NextResponse.json({
      success: true,
      ...result,
      intervention: {
        adminId: user.id,
        adminName: userData.name,
        action,
        timestamp: new Date().toISOString(),
        chatRoomId,
      },
    });
  } catch (error) {
    console.error("Error performing chat intervention:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
