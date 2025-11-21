import { prisma } from "@/lib/db";
import { unifiedRealtime } from "@/lib/unified-realtime";
import { VideoCallNotificationIntegration } from "./payment-notifications";

// Video Call and Chat Integration Service
export class VideoChatIntegration {
  // Connect video call sessions with chat rooms
  static async linkVideoCallToChat(data: {
    chatRoomId: string;
    sessionId: string;
    initiatorId: string;
    type: "CONSULTATION" | "FOLLOW_UP" | "EMERGENCY";
  }) {
    try {
      // Create video session linked to chat room
      const videoSession = await prisma.videoSession.create({
        data: {
          chatRoomId: data.chatRoomId,
          sessionId: data.sessionId,
          initiatorId: data.initiatorId,
          type: data.type,
          status: "WAITING",
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
            },
          },
        },
      });

      // Send notification message to chat
      await prisma.chatMessage.create({
        data: {
          chatRoomId: data.chatRoomId,
          senderId: "system",
          content: `📹 Video call initiated. Click to join the call.`,
          messageType: "TEXT",
          senderType: "SYSTEM",
          isRead: false,
        },
      });

      // Notify participants
      const appointment = videoSession.chatRoom.appointment;
      if (appointment) {
        const recipientId =
          data.initiatorId === appointment.patientId
            ? appointment.doctor.userId
            : appointment.patientId;

        await VideoCallNotificationIntegration.notifyIncomingVideoCall({
          recipientId,
          initiatorName:
            data.initiatorId === appointment.patientId
              ? appointment.patient.name
              : appointment.doctor.user.name,
          chatRoomId: data.chatRoomId,
          sessionId: data.sessionId,
        });
      }

      return { success: true, videoSession };
    } catch (error) {
      console.error("Error linking video call to chat:", error);
      return { success: false, error: error.message };
    }
  }

  // Handle video call status updates in chat
  static async updateVideoCallStatus(
    sessionId: string,
    status: "ACTIVE" | "ENDED" | "CANCELLED"
  ) {
    try {
      const videoSession = await prisma.videoSession.update({
        where: { sessionId },
        data: {
          status,
          ...(status === "ACTIVE" && { startedAt: new Date() }),
          ...(status === "ENDED" && { endedAt: new Date() }),
        },
        include: {
          chatRoom: true,
        },
      });

      // Send status message to chat
      let message = "";
      switch (status) {
        case "ACTIVE":
          message = "🟢 Video call started. Participants are now connected.";
          break;
        case "ENDED":
          const duration =
            videoSession.endedAt && videoSession.startedAt
              ? Math.round(
                  (videoSession.endedAt.getTime() -
                    videoSession.startedAt.getTime()) /
                    1000 /
                    60
                )
              : 0;
          message = `🔴 Video call ended. Duration: ${duration} minutes.`;
          break;
        case "CANCELLED":
          message = "❌ Video call was cancelled.";
          break;
      }

      await prisma.chatMessage.create({
        data: {
          chatRoomId: videoSession.chatRoomId,
          senderId: "system",
          content: message,
          messageType: "TEXT",
          senderType: "SYSTEM",
          isRead: false,
        },
      });

      // Emit real-time update
      unifiedRealtime.emit("video_call_status_update", {
        sessionId,
        status,
        chatRoomId: videoSession.chatRoomId,
        message,
      });

      return { success: true };
    } catch (error) {
      console.error("Error updating video call status:", error);
      return { success: false, error: error.message };
    }
  }

  // Get video call history for chat room
  static async getChatVideoHistory(chatRoomId: string) {
    try {
      const videoSessions = await prisma.videoSession.findMany({
        where: { chatRoomId },
        orderBy: { createdAt: "desc" },
        include: {
          initiator: { select: { name: true } },
          participants: {
            include: {
              user: { select: { name: true } },
            },
          },
        },
      });

      return videoSessions.map((session) => ({
        id: session.id,
        sessionId: session.sessionId,
        type: session.type,
        status: session.status,
        initiator: session.initiator.name,
        participants: session.participants.map((p) => p.user.name),
        duration:
          session.startedAt && session.endedAt
            ? Math.round(
                (session.endedAt.getTime() - session.startedAt.getTime()) /
                  1000 /
                  60
              )
            : 0,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        createdAt: session.createdAt,
      }));
    } catch (error) {
      console.error("Error getting chat video history:", error);
      return [];
    }
  }

  // Connect video call recordings with chat history
  static async saveVideoCallRecording(data: {
    sessionId: string;
    recordingUrl: string;
    duration: number;
  }) {
    try {
      // Update video session with recording
      const videoSession = await prisma.videoSession.update({
        where: { sessionId: data.sessionId },
        data: {
          recordingUrl: data.recordingUrl,
          duration: data.duration,
        },
        include: { chatRoom: true },
      });

      // Send recording message to chat
      await prisma.chatMessage.create({
        data: {
          chatRoomId: videoSession.chatRoomId,
          senderId: "system",
          content: `📼 Video call recording is now available.`,
          messageType: "VIDEO",
          senderType: "SYSTEM",
          fileUrl: data.recordingUrl,
          fileName: `video-call-${data.sessionId}.mp4`,
          isRead: false,
        },
      });

      return { success: true };
    } catch (error) {
      console.error("Error saving video call recording:", error);
      return { success: false, error: error.message };
    }
  }
}

// Chat and Video Call Notification Integration
export class ChatVideoNotificationIntegration {
  // Integrate video call notifications with unified notification system
  static async setupVideoCallNotifications(chatRoomId: string) {
    try {
      // Listen for video call events in this chat room
      unifiedRealtime.on("video_call_start", (data) => {
        if (data.chatRoomId === chatRoomId) {
          this.handleVideoCallStartNotification(data);
        }
      });

      unifiedRealtime.on("video_call_end", (data) => {
        if (data.chatRoomId === chatRoomId) {
          this.handleVideoCallEndNotification(data);
        }
      });

      return { success: true };
    } catch (error) {
      console.error("Error setting up video call notifications:", error);
      return { success: false, error: error.message };
    }
  }

  // Handle video call start notification
  private static async handleVideoCallStartNotification(data: any) {
    // This would integrate with the unified notification system
    // to show video call notifications in the chat interface
    console.log("Video call started in chat room:", data.chatRoomId);
  }

  // Handle video call end notification
  private static async handleVideoCallEndNotification(data: any) {
    // This would integrate with the unified notification system
    // to show video call end notifications in the chat interface
    console.log("Video call ended in chat room:", data.chatRoomId);
  }

  // Connect chat notifications with video call status
  static async notifyVideoCallInChat(data: {
    chatRoomId: string;
    type: "incoming" | "started" | "ended";
    sessionId: string;
    initiatorName?: string;
    duration?: number;
  }) {
    try {
      let message = "";
      let messageType: "TEXT" | "VIDEO" = "TEXT";

      switch (data.type) {
        case "incoming":
          message = `📞 ${data.initiatorName} is calling. Join the video call now!`;
          break;
        case "started":
          message = `🎥 Video call with ${data.initiatorName} has started.`;
          break;
        case "ended":
          message = `📴 Video call ended${
            data.duration ? ` after ${data.duration} minutes` : ""
          }.`;
          messageType = "VIDEO";
          break;
      }

      // Send notification message to chat
      await prisma.chatMessage.create({
        data: {
          chatRoomId: data.chatRoomId,
          senderId: "system",
          content: message,
          messageType,
          senderType: "SYSTEM",
          isRead: false,
        },
      });

      // Emit real-time update
      unifiedRealtime.emit("chat_video_notification", {
        chatRoomId: data.chatRoomId,
        type: data.type,
        message,
        sessionId: data.sessionId,
      });

      return { success: true };
    } catch (error) {
      console.error("Error notifying video call in chat:", error);
      return { success: false, error: error.message };
    }
  }
}

// Export integration services
export { ChatVideoNotificationIntegration, VideoChatIntegration };
