import { authOptions } from "@/lib/unified-auth";
import { prisma as db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { ErrorLogger } from "@/lib/error-logger";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const appointmentId = params.id;

    // Get appointment details
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

    // Check if user has permission to activate chat
    const canActivate =
      (session.user.role === "DOCTOR" &&
        appointment.doctorId === session.user.id) ||
      (session.user.role === "PATIENT" &&
        appointment.patientId === session.user.id) ||
      session.user.role === "ADMIN";

    if (!canActivate) {
      return NextResponse.json(
        { error: "No tienes permisos para activar el chat" },
        { status: 403 }
      );
    }

    // Only activate chat for confirmed appointments
    if (appointment.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: "Solo se puede activar el chat para citas confirmadas" },
        { status: 400 }
      );
    }

    // Check if chat room already exists
    let chatRoom = await db.chatRoom.findUnique({
      where: { appointmentId },
    });

    if (chatRoom) {
      // If chat room exists but is inactive, reactivate it
      if (!chatRoom.isActive) {
        chatRoom = await db.chatRoom.update({
          where: { id: chatRoom.id },
          data: {
            isActive: true,
            updatedAt: new Date(),
          },
        });
      }
    } else {
      // Create new chat room
      chatRoom = await db.chatRoom.create({
        data: {
          appointmentId,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          isActive: true,
        },
      });
    }

    return NextResponse.json({
      chatRoomId: chatRoom.id,
      isActive: chatRoom.isActive,
      message: "Chat activado correctamente",
    });
  } catch (error) {
    ErrorLogger.log({
      error,
      context: "Error activating chat",
      action: "POST /api/chat/activate/[id]",
      level: "error",
      userId: session?.user?.id
    });
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const appointmentId = params.id;

    // Get appointment details
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

    // Only doctors and admins can deactivate chat
    const canDeactivate =
      (session.user.role === "DOCTOR" &&
        appointment.doctorId === session.user.id) ||
      session.user.role === "ADMIN";

    if (!canDeactivate) {
      return NextResponse.json(
        { error: "No tienes permisos para desactivar el chat" },
        { status: 403 }
      );
    }

    // Find and deactivate chat room
    const chatRoom = await db.chatRoom.findUnique({
      where: { appointmentId },
    });

    if (!chatRoom) {
      return NextResponse.json(
        { error: "Chat no encontrado" },
        { status: 404 }
      );
    }

    // Deactivate chat room (preserve history)
    await db.chatRoom.update({
      where: { id: chatRoom.id },
      data: {
        isActive: false,
        endedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "Chat desactivado correctamente",
    });
  } catch (error) {
    ErrorLogger.log({
      error,
      context: "Error deactivating chat",
      action: "DELETE /api/chat/activate/[id]",
      level: "error",
      userId: session?.user?.id
    });
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
