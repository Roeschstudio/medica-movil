/**
 * Video Session and Chat Integration Tests
 *
 * Tests:
 * - Video session initiation from chat
 * - Chat during video sessions
 * - Video session state synchronization
 * - Recording and playback integration
 */

import ChatRoom from "@/components/optimized-chat-room";
import { VideoCallInterface } from "@/components/video-call-interface";
import { NotificationProvider } from "@/lib/notification-service";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionProvider } from "next-auth/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/lib/supabase", () => ({
  createSupabaseBrowserClient: vi.fn(),
}));

vi.mock("@/lib/chat-service", () => ({
  createChatService: vi.fn(),
}));

vi.mock("@/hooks/use-video-session", () => ({
  useVideoSession: vi.fn(),
}));

vi.mock("@/lib/notification-service", () => ({
  notificationService: {
    createChatNotification: vi.fn(),
  },
  NotificationProvider: ({ children }: any) => children,
}));

describe("Video-Chat Integration Tests", () => {
  let mockSupabase: any;
  let mockChatService: any;
  let mockVideoSession: any;
  let mockSession: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSession = {
      user: {
        id: "doctor-123",
        email: "doctor@example.com",
        name: "Dr. Smith",
        role: "DOCTOR",
      },
    };

    // Mock Supabase client
    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockSession.user },
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      })),
      removeChannel: vi.fn(),
    };

    // Mock ChatService
    mockChatService = {
      getOrCreateChatRoom: vi.fn(),
      getMessages: vi.fn(),
      sendMessage: vi.fn(),
      subscribeToMessages: vi.fn(),
      unsubscribeFromMessages: vi.fn(),
      destroy: vi.fn(),
    };

    // Mock VideoSession
    mockVideoSession = {
      isConnected: false,
      isVideoEnabled: false,
      isAudioEnabled: false,
      participants: [],
      startSession: vi.fn(),
      endSession: vi.fn(),
      toggleVideo: vi.fn(),
      toggleAudio: vi.fn(),
      shareScreen: vi.fn(),
    };

    const { createSupabaseBrowserClient } = require("@/lib/supabase");
    createSupabaseBrowserClient.mockReturnValue(mockSupabase);

    const { createChatService } = require("@/lib/chat-service");
    createChatService.mockReturnValue(mockChatService);

    const { useVideoSession } = require("@/hooks/use-video-session");
    useVideoSession.mockReturnValue(mockVideoSession);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Video Session Initiation from Chat", () => {
    it("should start video session from chat interface", async () => {
      const mockChatRoom = {
        id: "room-123",
        appointmentId: "appointment-123",
        patientId: "patient-123",
        doctorId: "doctor-123",
        isActive: true,
      };

      const mockMessages = [
        {
          id: "msg-1",
          chatRoomId: "room-123",
          senderId: "patient-123",
          content: "I'm ready for the video consultation",
          messageType: "TEXT",
          isRead: false,
          sentAt: new Date().toISOString(),
          sender: { id: "patient-123", name: "John Doe", role: "PATIENT" },
        },
      ];

      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.getMessages.mockResolvedValue(mockMessages);
      mockChatService.subscribeToMessages.mockReturnValue({
        unsubscribe: vi.fn(),
      });
      mockChatService.sendMessage.mockResolvedValue(true);

      const user = userEvent.setup();

      render(
        <SessionProvider session={mockSession}>
          <NotificationProvider>
            <ChatRoom appointmentId="appointment-123" />
          </NotificationProvider>
        </SessionProvider>
      );

      await waitFor(() => {
        expect(mockChatService.getOrCreateChatRoom).toHaveBeenCalled();
      });

      // Look for video call button
      const videoCallButton = screen.getByRole("button", {
        name: /start.*video|video.*call/i,
      });
      expect(videoCallButton).toBeInTheDocument();

      // Click to start video session
      await user.click(videoCallButton);

      // Should initiate video session
      expect(mockVideoSession.startSession).toHaveBeenCalledWith({
        appointmentId: "appointment-123",
        participants: ["doctor-123", "patient-123"],
      });

      // Should send system message about video session
      expect(mockChatService.sendMessage).toHaveBeenCalledWith(
        "room-123",
        "doctor-123",
        expect.stringContaining("video"),
        "SYSTEM"
      );
    });

    it("should handle video session invitation workflow", async () => {
      const mockChatRoom = {
        id: "room-123",
        appointmentId: "appointment-123",
        patientId: "patient-123",
        doctorId: "doctor-123",
        isActive: true,
      };

      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.getMessages.mockResolvedValue([]);

      let messageCallback: ((message: any) => void) | null = null;
      mockChatService.subscribeToMessages.mockImplementation(
        (roomId, callbacks) => {
          messageCallback = callbacks.onMessage;
          return { unsubscribe: vi.fn() };
        }
      );

      mockChatService.sendMessage.mockResolvedValue(true);

      const user = userEvent.setup();

      render(
        <SessionProvider session={mockSession}>
          <NotificationProvider>
            <ChatRoom appointmentId="appointment-123" />
          </NotificationProvider>
        </SessionProvider>
      );

      await waitFor(() => {
        expect(mockChatService.subscribeToMessages).toHaveBeenCalled();
      });

      // Doctor sends video invitation
      const videoInviteButton = screen.getByRole("button", {
        name: /invite.*video|send.*video.*invitation/i,
      });
      await user.click(videoInviteButton);

      // Should send video invitation message
      expect(mockChatService.sendMessage).toHaveBeenCalledWith(
        "room-123",
        "doctor-123",
        expect.stringContaining("video consultation invitation"),
        "VIDEO_INVITE"
      );

      // Simulate patient accepting invitation
      const acceptMessage = {
        id: "msg-accept",
        chatRoomId: "room-123",
        senderId: "patient-123",
        content: "Video invitation accepted",
        messageType: "VIDEO_ACCEPT",
        isRead: false,
        sentAt: new Date().toISOString(),
        sender: { id: "patient-123", name: "John Doe", role: "PATIENT" },
      };

      if (messageCallback) {
        messageCallback(acceptMessage);
      }

      // Should automatically start video session
      await waitFor(() => {
        expect(mockVideoSession.startSession).toHaveBeenCalled();
      });
    });
  });

  describe("Chat During Video Sessions", () => {
    it("should maintain chat functionality during video session", async () => {
      const mockChatRoom = {
        id: "room-123",
        appointmentId: "appointment-123",
        patientId: "patient-123",
        doctorId: "doctor-123",
        isActive: true,
      };

      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.getMessages.mockResolvedValue([]);
      mockChatService.subscribeToMessages.mockReturnValue({
        unsubscribe: vi.fn(),
      });
      mockChatService.sendMessage.mockResolvedValue(true);

      // Mock active video session
      mockVideoSession.isConnected = true;
      mockVideoSession.participants = [
        { id: "doctor-123", name: "Dr. Smith", role: "DOCTOR" },
        { id: "patient-123", name: "John Doe", role: "PATIENT" },
      ];

      const user = userEvent.setup();

      render(
        <SessionProvider session={mockSession}>
          <NotificationProvider>
            <div>
              <ChatRoom appointmentId="appointment-123" />
              <VideoCallInterface appointmentId="appointment-123" />
            </div>
          </NotificationProvider>
        </SessionProvider>
      );

      await waitFor(() => {
        expect(mockChatService.getOrCreateChatRoom).toHaveBeenCalled();
      });

      // Should show both chat and video interfaces
      expect(screen.getByRole("textbox")).toBeInTheDocument(); // Chat input
      expect(
        screen.getByText(/video.*session|call.*active/i)
      ).toBeInTheDocument(); // Video indicator

      // Send message during video session
      const messageInput = screen.getByRole("textbox");
      await user.type(messageInput, "Can you see the document I'm showing?");

      const sendButton = screen.getByRole("button", { name: /send/i });
      await user.click(sendButton);

      // Should send message normally
      expect(mockChatService.sendMessage).toHaveBeenCalledWith(
        "room-123",
        "doctor-123",
        "Can you see the document I'm showing?"
      );
    });

    it("should handle video session state changes in chat", async () => {
      const mockChatRoom = {
        id: "room-123",
        appointmentId: "appointment-123",
        patientId: "patient-123",
        doctorId: "doctor-123",
        isActive: true,
      };

      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.getMessages.mockResolvedValue([]);

      let messageCallback: ((message: any) => void) | null = null;
      mockChatService.subscribeToMessages.mockImplementation(
        (roomId, callbacks) => {
          messageCallback = callbacks.onMessage;
          return { unsubscribe: vi.fn() };
        }
      );

      render(
        <SessionProvider session={mockSession}>
          <NotificationProvider>
            <ChatRoom appointmentId="appointment-123" />
          </NotificationProvider>
        </SessionProvider>
      );

      await waitFor(() => {
        expect(mockChatService.subscribeToMessages).toHaveBeenCalled();
      });

      // Simulate video session started message
      const sessionStartMessage = {
        id: "msg-video-start",
        chatRoomId: "room-123",
        senderId: "system",
        content: "Video consultation started",
        messageType: "VIDEO_SESSION_START",
        isRead: false,
        sentAt: new Date().toISOString(),
        sender: { id: "system", name: "System", role: "SYSTEM" },
      };

      if (messageCallback) {
        messageCallback(sessionStartMessage);
      }

      // Should show video session indicator in chat
      await waitFor(() => {
        expect(
          screen.getByText("Video consultation started")
        ).toBeInTheDocument();
      });

      // Simulate video session ended message
      const sessionEndMessage = {
        id: "msg-video-end",
        chatRoomId: "room-123",
        senderId: "system",
        content: "Video consultation ended",
        messageType: "VIDEO_SESSION_END",
        isRead: false,
        sentAt: new Date().toISOString(),
        sender: { id: "system", name: "System", role: "SYSTEM" },
      };

      if (messageCallback) {
        messageCallback(sessionEndMessage);
      }

      // Should show session ended indicator
      await waitFor(() => {
        expect(
          screen.getByText("Video consultation ended")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Video Session State Synchronization", () => {
    it("should synchronize video session state across participants", async () => {
      const mockChatRoom = {
        id: "room-123",
        appointmentId: "appointment-123",
        patientId: "patient-123",
        doctorId: "doctor-123",
        isActive: true,
      };

      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.getMessages.mockResolvedValue([]);

      let messageCallback: ((message: any) => void) | null = null;
      mockChatService.subscribeToMessages.mockImplementation(
        (roomId, callbacks) => {
          messageCallback = callbacks.onMessage;
          return { unsubscribe: vi.fn() };
        }
      );

      render(
        <SessionProvider session={mockSession}>
          <NotificationProvider>
            <ChatRoom appointmentId="appointment-123" />
          </NotificationProvider>
        </SessionProvider>
      );

      await waitFor(() => {
        expect(mockChatService.subscribeToMessages).toHaveBeenCalled();
      });

      // Simulate participant joining video session
      const participantJoinMessage = {
        id: "msg-participant-join",
        chatRoomId: "room-123",
        senderId: "system",
        content: "John Doe joined the video session",
        messageType: "VIDEO_PARTICIPANT_JOIN",
        isRead: false,
        sentAt: new Date().toISOString(),
        sender: { id: "system", name: "System", role: "SYSTEM" },
        metadata: {
          participantId: "patient-123",
          participantName: "John Doe",
        },
      };

      if (messageCallback) {
        messageCallback(participantJoinMessage);
      }

      // Should show participant join notification
      await waitFor(() => {
        expect(
          screen.getByText("John Doe joined the video session")
        ).toBeInTheDocument();
      });

      // Simulate participant leaving
      const participantLeaveMessage = {
        id: "msg-participant-leave",
        chatRoomId: "room-123",
        senderId: "system",
        content: "John Doe left the video session",
        messageType: "VIDEO_PARTICIPANT_LEAVE",
        isRead: false,
        sentAt: new Date().toISOString(),
        sender: { id: "system", name: "System", role: "SYSTEM" },
        metadata: {
          participantId: "patient-123",
          participantName: "John Doe",
        },
      };

      if (messageCallback) {
        messageCallback(participantLeaveMessage);
      }

      // Should show participant leave notification
      await waitFor(() => {
        expect(
          screen.getByText("John Doe left the video session")
        ).toBeInTheDocument();
      });
    });

    it("should handle video session reconnection scenarios", async () => {
      const mockChatRoom = {
        id: "room-123",
        appointmentId: "appointment-123",
        patientId: "patient-123",
        doctorId: "doctor-123",
        isActive: true,
      };

      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.getMessages.mockResolvedValue([]);

      let messageCallback: ((message: any) => void) | null = null;
      let connectionCallback: ((connected: boolean) => void) | null = null;

      mockChatService.subscribeToMessages.mockImplementation(
        (roomId, callbacks) => {
          messageCallback = callbacks.onMessage;
          connectionCallback = callbacks.onConnectionChange;
          return { unsubscribe: vi.fn() };
        }
      );

      render(
        <SessionProvider session={mockSession}>
          <NotificationProvider>
            <ChatRoom appointmentId="appointment-123" />
          </NotificationProvider>
        </SessionProvider>
      );

      await waitFor(() => {
        expect(mockChatService.subscribeToMessages).toHaveBeenCalled();
      });

      // Simulate connection loss during video session
      if (connectionCallback) {
        connectionCallback(false);
      }

      // Should show connection lost indicator
      await waitFor(() => {
        expect(
          screen.getByText(/disconnected|connection.*lost/i)
        ).toBeInTheDocument();
      });

      // Simulate reconnection
      if (connectionCallback) {
        connectionCallback(true);
      }

      // Should show reconnected indicator
      await waitFor(() => {
        expect(screen.getByText(/connected|reconnected/i)).toBeInTheDocument();
      });

      // Should send reconnection message
      const reconnectionMessage = {
        id: "msg-reconnect",
        chatRoomId: "room-123",
        senderId: "system",
        content: "Video session reconnected",
        messageType: "VIDEO_SESSION_RECONNECT",
        isRead: false,
        sentAt: new Date().toISOString(),
        sender: { id: "system", name: "System", role: "SYSTEM" },
      };

      if (messageCallback) {
        messageCallback(reconnectionMessage);
      }

      await waitFor(() => {
        expect(
          screen.getByText("Video session reconnected")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Recording and Playback Integration", () => {
    it("should handle session recording notifications in chat", async () => {
      const mockChatRoom = {
        id: "room-123",
        appointmentId: "appointment-123",
        patientId: "patient-123",
        doctorId: "doctor-123",
        isActive: true,
      };

      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.getMessages.mockResolvedValue([]);

      let messageCallback: ((message: any) => void) | null = null;
      mockChatService.subscribeToMessages.mockImplementation(
        (roomId, callbacks) => {
          messageCallback = callbacks.onMessage;
          return { unsubscribe: vi.fn() };
        }
      );

      render(
        <SessionProvider session={mockSession}>
          <NotificationProvider>
            <ChatRoom appointmentId="appointment-123" />
          </NotificationProvider>
        </SessionProvider>
      );

      await waitFor(() => {
        expect(mockChatService.subscribeToMessages).toHaveBeenCalled();
      });

      // Simulate recording started message
      const recordingStartMessage = {
        id: "msg-recording-start",
        chatRoomId: "room-123",
        senderId: "system",
        content: "Session recording started",
        messageType: "RECORDING_START",
        isRead: false,
        sentAt: new Date().toISOString(),
        sender: { id: "system", name: "System", role: "SYSTEM" },
      };

      if (messageCallback) {
        messageCallback(recordingStartMessage);
      }

      // Should show recording indicator
      await waitFor(() => {
        expect(
          screen.getByText("Session recording started")
        ).toBeInTheDocument();
      });

      // Simulate recording stopped message
      const recordingStopMessage = {
        id: "msg-recording-stop",
        chatRoomId: "room-123",
        senderId: "system",
        content:
          "Session recording stopped. Recording will be available shortly.",
        messageType: "RECORDING_STOP",
        isRead: false,
        sentAt: new Date().toISOString(),
        sender: { id: "system", name: "System", role: "SYSTEM" },
        metadata: {
          recordingId: "rec-123",
          duration: "00:15:30",
        },
      };

      if (messageCallback) {
        messageCallback(recordingStopMessage);
      }

      // Should show recording completion message
      await waitFor(() => {
        expect(
          screen.getByText(/recording.*stopped.*available/i)
        ).toBeInTheDocument();
      });
    });

    it("should provide access to session recordings through chat", async () => {
      const mockChatRoom = {
        id: "room-123",
        appointmentId: "appointment-123",
        patientId: "patient-123",
        doctorId: "doctor-123",
        isActive: false, // Completed session
      };

      const mockMessages = [
        {
          id: "msg-recording-available",
          chatRoomId: "room-123",
          senderId: "system",
          content: "Session recording is now available for viewing",
          messageType: "RECORDING_AVAILABLE",
          isRead: false,
          sentAt: new Date().toISOString(),
          sender: { id: "system", name: "System", role: "SYSTEM" },
          metadata: {
            recordingId: "rec-123",
            recordingUrl: "https://example.com/recordings/rec-123",
            duration: "00:15:30",
            fileSize: "125MB",
          },
        },
      ];

      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.getMessages.mockResolvedValue(mockMessages);
      mockChatService.subscribeToMessages.mockReturnValue({
        unsubscribe: vi.fn(),
      });

      const user = userEvent.setup();

      render(
        <SessionProvider session={mockSession}>
          <NotificationProvider>
            <ChatRoom appointmentId="appointment-123" />
          </NotificationProvider>
        </SessionProvider>
      );

      await waitFor(() => {
        expect(mockChatService.getMessages).toHaveBeenCalled();
      });

      // Should show recording available message
      expect(
        screen.getByText("Session recording is now available for viewing")
      ).toBeInTheDocument();

      // Should show recording details
      expect(screen.getByText("00:15:30")).toBeInTheDocument(); // Duration
      expect(screen.getByText("125MB")).toBeInTheDocument(); // File size

      // Should have link to view recording
      const viewRecordingButton = screen.getByRole("button", {
        name: /view.*recording|play.*recording/i,
      });
      expect(viewRecordingButton).toBeInTheDocument();

      // Click to view recording
      await user.click(viewRecordingButton);

      // Should open recording (this would typically open in a new window/modal)
      // The exact behavior depends on implementation
    });
  });

  describe("Error Handling in Video-Chat Integration", () => {
    it("should handle video session failures gracefully", async () => {
      const mockChatRoom = {
        id: "room-123",
        appointmentId: "appointment-123",
        patientId: "patient-123",
        doctorId: "doctor-123",
        isActive: true,
      };

      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.getMessages.mockResolvedValue([]);
      mockChatService.subscribeToMessages.mockReturnValue({
        unsubscribe: vi.fn(),
      });

      // Mock video session failure
      mockVideoSession.startSession.mockRejectedValue(
        new Error("Camera access denied")
      );

      const user = userEvent.setup();

      render(
        <SessionProvider session={mockSession}>
          <NotificationProvider>
            <ChatRoom appointmentId="appointment-123" />
          </NotificationProvider>
        </SessionProvider>
      );

      await waitFor(() => {
        expect(mockChatService.getOrCreateChatRoom).toHaveBeenCalled();
      });

      // Try to start video session
      const videoCallButton = screen.getByRole("button", {
        name: /start.*video|video.*call/i,
      });
      await user.click(videoCallButton);

      // Should show error message
      await waitFor(() => {
        expect(
          screen.getByText(/camera.*access.*denied|video.*error/i)
        ).toBeInTheDocument();
      });

      // Chat should still be functional
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("should handle video session interruptions", async () => {
      const mockChatRoom = {
        id: "room-123",
        appointmentId: "appointment-123",
        patientId: "patient-123",
        doctorId: "doctor-123",
        isActive: true,
      };

      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.getMessages.mockResolvedValue([]);

      let messageCallback: ((message: any) => void) | null = null;
      mockChatService.subscribeToMessages.mockImplementation(
        (roomId, callbacks) => {
          messageCallback = callbacks.onMessage;
          return { unsubscribe: vi.fn() };
        }
      );

      // Start with active video session
      mockVideoSession.isConnected = true;

      render(
        <SessionProvider session={mockSession}>
          <NotificationProvider>
            <ChatRoom appointmentId="appointment-123" />
          </NotificationProvider>
        </SessionProvider>
      );

      await waitFor(() => {
        expect(mockChatService.subscribeToMessages).toHaveBeenCalled();
      });

      // Simulate video session interruption
      const interruptionMessage = {
        id: "msg-interruption",
        chatRoomId: "room-123",
        senderId: "system",
        content: "Video session interrupted due to network issues",
        messageType: "VIDEO_SESSION_ERROR",
        isRead: false,
        sentAt: new Date().toISOString(),
        sender: { id: "system", name: "System", role: "SYSTEM" },
        metadata: {
          errorType: "NETWORK_ERROR",
          errorMessage: "Connection lost",
        },
      };

      if (messageCallback) {
        messageCallback(interruptionMessage);
      }

      // Should show interruption message
      await waitFor(() => {
        expect(
          screen.getByText(/video.*interrupted.*network/i)
        ).toBeInTheDocument();
      });

      // Should offer retry option
      const retryButton = screen.getByRole("button", {
        name: /retry.*video|reconnect.*video/i,
      });
      expect(retryButton).toBeInTheDocument();
    });
  });
});
