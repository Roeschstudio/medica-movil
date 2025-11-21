import { authOptions } from "@/lib/unified-auth";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateStatusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().optional(),
});

// PATCH /api/chat/rooms/[roomId]/status - Update chat room status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const roomId = params.roomId;
    const body = await request.json();
    const validatedData = updateStatusSchema.parse(body);

    // Check if user has access to this chat room
    const chatRoom = await prisma.chatRoom.findFirst({
      where: {
        id: roomId,
        OR: [
          { patientId: session.user.id },
          {
            doctor: {
              userId: session.user.id,
            },
          },
        ],
      },
      include: {
        appointment: {
          select: {
            id: true,
            status: true,
            scheduledAt: true,
          },
        },
      },
    });

    if (!chatRoom) {
      return NextResponse.json(
        { error: "Chat room no encontrado o sin acceso" },
        { status: 404 }
      );
    }

    // Only allow activation if appointment is confirmed
    if (validatedData.isActive && chatRoom.appointment.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: "Solo se puede activar el chat para citas confirmadas" },
        { status: 400 }
      );
    }

    // Update chat room status
    const updatedChatRoom = await prisma.chatRoom.update({
      where: { id: roomId },
      data: {
        isActive: validatedData.isActive,
        ...(validatedData.isActive
          ? { startedAt: new Date() }
          : { endedAt: new Date() }),
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedChatRoom,
      message: `Chat ${validatedData.isActive ? "activado" : "desactivado"} correctamente`,
    });
  } catch (error) {
    console.error("Error updating chat room status:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
