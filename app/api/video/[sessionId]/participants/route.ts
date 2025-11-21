import { authOptions } from "@/lib/unified-auth";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const participantActionSchema = z.object({
  action: z.enum(["join", "leave"]),
});

export async function POST(
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
    const { action } = participantActionSchema.parse(body);

    // Verify video session exists and user has access
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

    // Find or create participant record
    let participant = await prisma.videoSessionParticipant.findFirst({
      where: {
        videoSessionId: videoSession.id,
        userId: session.user.id,
      },
    });

    if (!participant) {
      participant = await prisma.videoSessionParticipant.create({
        data: {
          videoSessionId: videoSession.id,
          userId: session.user.id,
        },
      });
    }

    // Update participant status based on action
    const updateData: any = {
      isConnected: action === "join",
    };

    if (action === "join") {
      updateData.joinedAt = new Date();
      updateData.leftAt = null;
    } else {
      updateData.leftAt = new Date();
    }

    const updatedParticipant = await prisma.videoSessionParticipant.update({
      where: { id: participant.id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // If this is the first participant joining, update session status to ACTIVE
    if (action === "join") {
      const activeParticipants = await prisma.videoSessionParticipant.count({
        where: {
          videoSessionId: videoSession.id,
          isConnected: true,
        },
      });

      if (activeParticipants === 1 && videoSession.status === "WAITING") {
        await prisma.videoSession.update({
          where: { id: videoSession.id },
          data: {
            status: "ACTIVE",
            startedAt: new Date(),
          },
        });
      }
    }

    return NextResponse.json(updatedParticipant);
  } catch (error) {
    console.error("Error updating participant:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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

    // Verify video session exists and user has access
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

    // Get all participants
    const participants = await prisma.videoSessionParticipant.findMany({
      where: {
        videoSessionId: videoSession.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    return NextResponse.json(participants);
  } catch (error) {
    console.error("Error fetching participants:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
