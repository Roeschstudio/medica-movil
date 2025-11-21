import { authOptions } from "@/lib/unified-auth";
import { prisma } from "@/lib/db";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const startRecordingSchema = z.object({
  action: z.enum(["start", "stop"]),
  recordingData: z.string().optional(), // Base64 encoded recording data when stopping
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
    const { action, recordingData } = startRecordingSchema.parse(body);

    // Verify video session exists and user has access (only doctor can manage recordings)
    const videoSession = await prisma.videoSession.findFirst({
      where: {
        sessionId,
        chatRoom: {
          doctorId: session.user.id, // Only doctor can manage recordings
        },
      },
      include: {
        chatRoom: {
          include: {
            appointment: true,
          },
        },
      },
    });

    if (!videoSession) {
      return NextResponse.json(
        { error: "Video session not found or unauthorized" },
        { status: 404 }
      );
    }

    if (action === "start") {
      // Update session to indicate recording has started
      const updatedSession = await prisma.videoSession.update({
        where: { id: videoSession.id },
        data: {
          // You could add a recordingStarted field to track this
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Recording started",
        sessionId: updatedSession.sessionId,
      });
    } else if (action === "stop" && recordingData) {
      // Upload recording to Supabase Storage
      const supabase = createSupabaseAdminClient();
      const fileName = `recording_${sessionId}_${Date.now()}.webm`;
      const filePath = `video-recordings/${videoSession.chatRoom.appointmentId}/${fileName}`;

      // Convert base64 to buffer
      const buffer = Buffer.from(recordingData, "base64");

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("medical-files")
        .upload(filePath, buffer, {
          contentType: "video/webm",
          upsert: false,
        });

      if (uploadError) {
        console.error("Error uploading recording:", uploadError);
        return NextResponse.json(
          { error: "Failed to upload recording" },
          { status: 500 }
        );
      }

      // Get public URL for the recording
      const { data: urlData } = supabase.storage
        .from("medical-files")
        .getPublicUrl(filePath);

      // Update video session with recording URL
      const updatedSession = await prisma.videoSession.update({
        where: { id: videoSession.id },
        data: {
          recordingUrl: urlData.publicUrl,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Recording saved successfully",
        recordingUrl: urlData.publicUrl,
        sessionId: updatedSession.sessionId,
      });
    }

    return NextResponse.json(
      { error: "Invalid action or missing recording data" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error managing recording:", error);
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

    return NextResponse.json({
      sessionId: videoSession.sessionId,
      recordingUrl: videoSession.recordingUrl,
      hasRecording: !!videoSession.recordingUrl,
      duration: videoSession.duration,
    });
  } catch (error) {
    console.error("Error fetching recording info:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
