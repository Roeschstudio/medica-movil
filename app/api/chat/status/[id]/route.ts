import { authOptions } from "@/lib/unified-auth";
import { prisma as db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { ErrorLogger } from "@/lib/error-logger";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const appointmentId = params.id;

    // First, verify the user has access to this appointment
    const appointment = await db.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        patientId: true,
        doctorId: true,
        status: true,
      },
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Cita no encontrada" },
        { status: 404 }
      );
    }

    // Check access permissions
    const hasAccess =
      (session.user.role === "PATIENT" &&
        appointment.patientId === session.user.id) ||
      (session.user.role === "DOCTOR" &&
        appointment.doctorId === session.user.id) ||
      session.user.role === "ADMIN";

    if (!hasAccess) {
      return NextResponse.json(
        { error: "No tienes acceso a esta cita" },
        { status: 403 }
      );
    }

    // Get chat room and status
    const chatRoom = await db.chatRoom.findUnique({
      where: { appointmentId },
      include: {
        messages: {
          where: {
            isRead: false,
            senderId: { not: session.user.id }, // Only unread messages from others
          },
          select: { id: true },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    if (!chatRoom) {
      // No chat room exists yet
      return NextResponse.json({
        hasChat: false,
        isActive: false,
        unreadCount: 0,
        totalMessages: 0,
      });
    }

    // Get the latest message timestamp
    const latestMessage = await db.chatMessage.findFirst({
      where: { chatRoomId: chatRoom.id },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true },
    });

    const chatStatus = {
      hasChat: true,
      isActive: chatRoom.isActive,
      unreadCount: chatRoom.messages.length,
      totalMessages: chatRoom._count.messages,
      lastMessageAt: latestMessage?.sentAt?.toISOString(),
      chatRoomId: chatRoom.id,
    };

    return NextResponse.json(chatStatus);
  } catch (error) {
    ErrorLogger.log({
      error,
      context: "Error fetching chat status",
      action: "GET /api/chat/status/[id]",
      level: "error",
      userId: session?.user?.id
    });
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
