import { authOptions } from "@/lib/unified-auth";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateSessionSchema = z.object({
  status: z.enum(["WAITING", "ACTIVE", "ENDED", "CANCELLED"]).optional(),
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
  recordingUrl: z.string().optional(),
  duration: z.number().optional(),
});

const joinSessionSchema = z.object({
  action: z.enum(["join", "leave"]),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = params;

    // Get video session
    const videoSession = await prisma.videoSession.findFirst({
      where: {
        sessionId,
        chatRoom: {
          OR: [{ patientId: session.user.id }, { doctorId: session.user.id }],
        },
      },
      include: {
        chatRoom: {
          include: {
            appointment: {
              include: {
                patient: true,
                doctor: { include: { user: true } },
              },
            },
            patient: true,
            doctor: { include: { user: true } },
          },
        },
        initiator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!videoSession) {
      return NextResponse.json(
        { error: "Video session not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(videoSession);
  } catch (error) {
    console.error("Error fetching video session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = params;
    const body = await request.json();
    const updateData = updateSessionSchema.parse(body);

    // Verify user has access to the video session
    const videoSession = await prisma.videoSession.findFirst({
      where: {
        sessionId,
        chatRoom: {
          OR: [{ patientId: session.user.id }, { doctorId: session.user.id }],
        },
      },
    });

    if (!videoSession) {
      return NextResponse.json(
        { error: "Video session not found" },
        { status: 404 }
      );
    }

    // Prepare update data
    const updatePayload: any = {};

    if (updateData.status) {
      updatePayload.status = updateData.status;

      // Auto-calculate duration when session ends
      if (updateData.status === "ENDED" && videoSession.startedAt) {
        const duration = Math.floor(
          (new Date().getTime() - videoSession.startedAt.getTime()) / 1000
        );
        updatePayload.duration = duration;
        updatePayload.endedAt = new Date();
      }
    }

    if (updateData.startedAt) {
      updatePayload.startedAt = new Date(updateData.startedAt);
    }

    if (updateData.endedAt) {
      updatePayload.endedAt = new Date(updateData.endedAt);
    }

    if (updateData.recordingUrl) {
      updatePayload.recordingUrl = updateData.recordingUrl;
    }

    if (updateData.duration !== undefined) {
      updatePayload.duration = updateData.duration;
    }

    // Update video session
    const updatedSession = await prisma.videoSession.update({
      where: { id: videoSession.id },
      data: updatePayload,
      include: {
        chatRoom: {
          include: {
            appointment: {
              include: {
                patient: true,
                doctor: { include: { user: true } },
              },
            },
            patient: true,
            doctor: { include: { user: true } },
          },
        },
        initiator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error("Error updating video session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = params;

    // Verify user has access to the video session (only initiator or doctor can delete)
    const videoSession = await prisma.videoSession.findFirst({
      where: {
        sessionId,
        OR: [
          { initiatorId: session.user.id },
          { chatRoom: { doctorId: session.user.id } },
        ],
      },
    });

    if (!videoSession) {
      return NextResponse.json(
        { error: "Video session not found or unauthorized" },
        { status: 404 }
      );
    }

    // Delete video session (participants will be deleted due to cascade)
    await prisma.videoSession.delete({
      where: { id: videoSession.id },
    });

    return NextResponse.json({ message: "Video session deleted successfully" });
  } catch (error) {
    console.error("Error deleting video session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
