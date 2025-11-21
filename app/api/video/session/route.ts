import { authOptions } from "@/lib/unified-auth";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createSessionSchema = z.object({
  chatRoomId: z.string(),
  type: z
    .enum(["CONSULTATION", "FOLLOW_UP", "EMERGENCY"])
    .optional()
    .default("CONSULTATION"),
});

const updateSessionSchema = z.object({
  status: z.enum(["WAITING", "ACTIVE", "ENDED", "CANCELLED"]).optional(),
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
  recordingUrl: z.string().optional(),
  duration: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { chatRoomId, type } = createSessionSchema.parse(body);

    // Verify chat room exists and user has access
    const chatRoom = await prisma.chatRoom.findFirst({
      where: {
        id: chatRoomId,
        OR: [{ patientId: session.user.id }, { doctorId: session.user.id }],
      },
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
    });

    if (!chatRoom) {
      return NextResponse.json(
        { error: "Chat room not found or access denied" },
        { status: 404 }
      );
    }

    // Check if active video session already exists
    const existingSession = await prisma.videoSession.findFirst({
      where: {
        chatRoomId,
        status: { in: ["WAITING", "ACTIVE"] },
      },
    });

    if (existingSession) {
      return NextResponse.json(existingSession);
    }

    // Generate session ID and room name
    const sessionId = `video_${chatRoomId}_${Date.now()}`;
    const roomName = `room_${chatRoom.appointmentId}`;

    // Create new video session
    const videoSession = await prisma.videoSession.create({
      data: {
        chatRoomId,
        sessionId,
        roomName,
        type,
        status: "WAITING",
        initiatorId: session.user.id,
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

    // Create participant records for doctor and patient
    await prisma.videoSessionParticipant.createMany({
      data: [
        {
          videoSessionId: videoSession.id,
          userId: chatRoom.patientId,
        },
        {
          videoSessionId: videoSession.id,
          userId: chatRoom.doctor.userId,
        },
      ],
    });

    // Fetch the complete session with participants
    const completeSession = await prisma.videoSession.findUnique({
      where: { id: videoSession.id },
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

    return NextResponse.json(completeSession);
  } catch (error) {
    console.error("Error creating video session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const chatRoomId = searchParams.get("chatRoomId");
    const sessionId = searchParams.get("sessionId");

    const whereClause: any = {
      chatRoom: {
        OR: [{ patientId: session.user.id }, { doctorId: session.user.id }],
      },
    };

    if (chatRoomId) {
      whereClause.chatRoomId = chatRoomId;
    }

    if (sessionId) {
      whereClause.sessionId = sessionId;
    }

    const videoSessions = await prisma.videoSession.findMany({
      where: whereClause,
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
      orderBy: { createdAt: "desc" },
    });

    if (sessionId) {
      return NextResponse.json(videoSessions[0] || null);
    }

    return NextResponse.json(videoSessions);
  } catch (error) {
    console.error("Error fetching video sessions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
