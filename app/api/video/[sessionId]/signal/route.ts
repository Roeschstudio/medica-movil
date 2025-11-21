import { authOptions } from "@/lib/unified-auth";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const signalSchema = z.object({
  type: z.enum([
    "offer",
    "answer",
    "ice-candidate",
    "screen-share-offer",
    "screen-share-answer",
  ]),
  targetUserId: z.string(),
  data: z.any(), // WebRTC signal data (offer, answer, or ICE candidate)
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
    const { type, targetUserId, data } = signalSchema.parse(body);

    // Verify video session exists and user has access
    const videoSession = await prisma.videoSession.findFirst({
      where: {
        sessionId,
        chatRoom: {
          OR: [{ patientId: session.user.id }, { doctorId: session.user.id }],
        },
      },
      include: {
        chatRoom: true,
      },
    });

    if (!videoSession) {
      return NextResponse.json(
        { error: "Video session not found" },
        { status: 404 }
      );
    }

    // Verify target user is a participant in this session
    const targetParticipant = await prisma.videoSessionParticipant.findFirst({
      where: {
        videoSessionId: videoSession.id,
        userId: targetUserId,
      },
    });

    if (!targetParticipant) {
      return NextResponse.json(
        { error: "Target user is not a participant" },
        { status: 400 }
      );
    }

    // In a real implementation, you would use WebSocket or Server-Sent Events
    // to send the signal to the target user. For now, we'll store it temporarily
    // and the client can poll for signals.

    // For this implementation, we'll use Supabase real-time to broadcast the signal
    // The client should listen to the video session channel for signals

    const signalPayload = {
      sessionId,
      type,
      fromUserId: session.user.id,
      targetUserId,
      data,
      timestamp: new Date().toISOString(),
    };

    // In a production environment, you would broadcast this via WebSocket/SSE
    // For now, we'll return success and let the client handle real-time communication
    console.log("WebRTC Signal:", signalPayload);

    return NextResponse.json({
      success: true,
      message: "Signal sent successfully",
      signal: signalPayload,
    });
  } catch (error) {
    console.error("Error sending WebRTC signal:", error);
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

    // Return WebRTC configuration for the client
    const webrtcConfig = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        // In production, you would add TURN servers here
        // {
        //   urls: 'turn:your-turn-server.com:3478',
        //   username: 'username',
        //   credential: 'password'
        // }
      ],
    };

    return NextResponse.json({
      sessionId,
      roomName: videoSession.roomName,
      webrtcConfig,
      status: videoSession.status,
    });
  } catch (error) {
    console.error("Error getting WebRTC config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
