import { authOptions } from "@/lib/unified-auth";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ErrorLogger } from "@/lib/error-logger";

const updateRoomSchema = z.object({
  isActive: z.boolean().optional(),
  endedAt: z.string().datetime().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomId } = params;

    // Get chat room with appointment details
    const chatRoom = await prisma.chatRoom.findFirst({
      where: {
        id: roomId,
        OR: [{ patientId: session.user.id }, { doctorId: session.user.id }],
      },
      include: {
        appointment: {
          include: {
            patient: true,
            doctor: { include: { user: true } },
          },
        },
        messages: {
          orderBy: { sentAt: "desc" },
          take: 10,
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: true,
            videoSessions: true,
          },
        },
      },
    });

    if (!chatRoom) {
      return NextResponse.json(
        { error: "Chat room not found or access denied" },
        { status: 404 }
      );
    }

    // Get unread message count for current user
    const unreadCount = await prisma.chatMessage.count({
      where: {
        chatRoomId: roomId,
        senderId: { not: session.user.id },
        isRead: false,
      },
    });

    return NextResponse.json({
      ...chatRoom,
      unreadCount,
    });
  } catch (error) {
    ErrorLogger.log({
      error,
      context: "Error fetching chat room",
      action: "GET /api/chat/[roomId]",
      level: "error",
      userId: session?.user?.id
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomId } = params;
    const body = await request.json();
    const validationResult = updateRoomSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const updateData = validationResult.data;

    // Convert endedAt string to Date if provided
    if (updateData.endedAt) {
      updateData.endedAt = new Date(updateData.endedAt);
    }

    // Verify user has access to the chat room (only doctors can update room status)
    const chatRoom = await prisma.chatRoom.findFirst({
      where: {
        id: roomId,
        doctorId: session.user.id,
      },
    });

    if (!chatRoom) {
      return NextResponse.json(
        { error: "Chat room not found or unauthorized" },
        { status: 404 }
      );
    }

    // Update chat room
    const updatedRoom = await prisma.chatRoom.update({
      where: { id: roomId },
      data: updateData,
      include: {
        appointment: {
          include: {
            patient: true,
            doctor: { include: { user: true } },
          },
        },
      },
    });

    return NextResponse.json(updatedRoom);
  } catch (error) {
    ErrorLogger.log({
      error,
      context: "Error updating chat room",
      action: "PATCH /api/chat/[roomId]",
      level: "error",
      userId: session?.user?.id
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomId } = params;

    // Verify user has access to the chat room (only doctors can delete rooms)
    const chatRoom = await prisma.chatRoom.findFirst({
      where: {
        id: roomId,
        doctorId: session.user.id,
      },
    });

    if (!chatRoom) {
      return NextResponse.json(
        { error: "Chat room not found or unauthorized" },
        { status: 404 }
      );
    }

    // Delete all messages first (due to foreign key constraints)
    await prisma.chatMessage.deleteMany({
      where: { chatRoomId: roomId },
    });

    // Delete chat room
    await prisma.chatRoom.delete({
      where: { id: roomId },
    });

    return NextResponse.json({ message: "Chat room deleted successfully" });
  } catch (error) {
    ErrorLogger.log({
      error,
      context: "Error deleting chat room",
      action: "DELETE /api/chat/[roomId]",
      level: "error",
      userId: session?.user?.id
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
