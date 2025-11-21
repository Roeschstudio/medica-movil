/**
 * Integration tests for Chat and Appointment workflows
 *
 * Tests complete user journeys:
 * - Patient books appointment → Chat room created → Messages exchanged → Appointment completed
 * - Doctor manages chat rooms and appointments
 * - File sharing during consultations
 * - Video session integration
 * - Notification delivery
 */

import ChatRoom from "@/components/optimized-chat-room";
import ChatRoomList from "@/components/chat/chat-room-list";
import { NotificationProvider } from "@/lib/notification-service";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionProvider } from "next-auth/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock all dependencies
vi.mock("@/lib/supabase", () => ({
  createSupabaseBrowserClient: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/chat-service", () => ({
  createChatService: vi.fn(),
}));

vi.mock("@/lib/notification-service", () => ({
  notificationService: {
    createChatNotification: vi.fn(),
    markNotificationAsRead: vi.fn(),
    getUserNotifications: vi.fn(),
  },
  NotificationProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

vi.mock("@/hooks/use-notifications", () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  }),
}));

describe("Chat-Appointment Integration Workflows", () => {
  let mockSupabase: any;
  let mockChatService: any;
  let mockSession: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock session for different user types
    mockSession = {
      user: {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        role: "PATIENT",
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
        range: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
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
      uploadFile: vi.fn(),
      markMessagesAsRead: vi.fn(),
      destroy: vi.fn(),
    };

    const { createSupabaseBrowserClient } = require("@/lib/supabase");
    createSupabaseBrowserClient.mockReturnValue(mockSupabase);

    const { createChatService } = require("@/lib/chat-service");
    createChatService.mockReturnValue(mockChatService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Patient-Doctor Appointment Chat Flow", () => {
    it("should create chat room when appointment is accessed", async () => {
      const mockAppointment = {
        id: "appointment-123",
        patientId: "patient-123",
        doctorId: "doctor-123",
        scheduledAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        status: "CONFIRMED",
        type: "VIRTUAL",
      };

      const mockChatRoom = {
        id: "room-123",
        appointmentId: "appointment-123",
        patientId: "patient-123",
        doctorId: "doctor-123",
        isActive: true,
        startedAt: new Date().toISOString(),
      };

      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.getMessages.mockResolvedValue([]);
      mockChatService.subscribeToMessages.mockReturnValue({
        unsubscribe: vi.fn(),
      });

      render(
        <SessionProvider session={mockSession}>
          <NotificationProvider>
            <ChatRoom appointmentId="appointment-123" />
          </NotificationProvider>
        </SessionProvider>
      );

      // Should automatically create/get chat room for appointment
      await waitFor(() => {
        expect(mockChatService.getOrCreateChatRoom).toHaveBeenCalledWith(
          "appointment-123"
        );
      });

      // Should set up real-time subscription
      expect(mockChatService.subscribeToMessages).toHaveBeenCalledWith(
        "room-123",
        expect.objectContaining({
          onMessage: expect.any(Function),
          onMessageUpdate: expect.any(Function),
          onError: expect.any(Function),
          onConnectionChange: expect.any(Function),
        })
      );
    });

    it("should handle complete consultation workflow", async () => {
      const mockChatRoom = {
        id: "room-123",
        appointmentId: "appointment-123",
        patientId: "patient-123",
        doctorId: "doctor-123",
        isActive: true,
      };

      const consultationMessages = [
        {
          id: "msg-1",
          chatRoomId: "room-123",
          senderId: "doctor-123",
          content:
            "Hello! I see you have an appointment today. How are you feeling?",
          messageType: "TEXT",
          isRead: false,
          sentAt: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
          sender: { id: "doctor-123", name: "Dr. Smith", role: "DOCTOR" },
        },
        {
          id: "msg-2",
          chatRoomId: "room-123",
          senderId: "patient-123",
          content: "Hi Doctor, I have been experiencing some symptoms.",
          messageType: "TEXT",
          isRead: true,
          sentAt: new Date(Date.now() - 240000).toISOString(), // 4 minutes ago
          sender: { id: "patient-123", name: "John Doe", role: "PATIENT" },
        },
      ];

      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.getMessages.mockResolvedValue(consultationMessages);
      mockChatService.sendMessage.mockResolvedValue(true);

      let messageCallback: ((message: any) => void) | null = null;
      mockChatService.subscribeToMessages.mockImplementation(
        (roomId, callbacks) => {
          messageCallback = callbacks.onMessage;
          return { unsubscribe: vi.fn() };
        }
      );

      const user = userEvent.setup();

      render(
        <SessionProvider session={mockSession}>
          <NotificationProvider>
            <ChatRoom appointmentId="appointment-123" />
          </NotificationProvider>
        </SessionProvider>
      );

      // Wait for initial messages to load
      await waitFor(() => {
        expect(
          screen.getByText(
            "Hello! I see you have an appointment today. How are you feeling?"
          )
        ).toBeInTheDocument();
        expect(
          screen.getByText("Hi Doctor, I have been experiencing some symptoms.")
        ).toBeInTheDocument();
      });

      // Patient provides more details
      const messageInput = screen.getByPlaceholderText(/type.*message/i);
      await user.type(
        messageInput,
        "I have been having headaches for the past week."
      );

      const sendButton = screen.getByRole("button", { name: /send/i });
      await user.click(sendButton);

      expect(mockChatService.sendMessage).toHaveBeenCalledWith(
        "room-123",
        "user-123",
        "I have been having headaches for the past week."
      );

      // Doctor responds with follow-up questions
      const doctorResponse = {
        id: "msg-3",
        chatRoomId: "room-123",
        senderId: "doctor-123",
        content:
          "Can you describe the intensity and frequency of these headaches?",
        messageType: "TEXT",
        isRead: false,
        sentAt: new Date().toISOString(),
        sender: { id: "doctor-123", name: "Dr. Smith", role: "DOCTOR" },
      };

      if (messageCallback) {
        messageCallback(doctorResponse);
      }

      await waitFor(() => {
        expect(
          screen.getByText(
            "Can you describe the intensity and frequency of these headaches?"
          )
        ).toBeInTheDocument();
      });

      // Patient shares medical document
      const testFile = new File(["medical history"], "medical-history.pdf", {
        type: "application/pdf",
      });

      mockChatService.uploadFile.mockResolvedValue(
        "https://example.com/medical-history.pdf"
      );

      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) {
        await user.upload(fileInput, testFile);

        await waitFor(() => {
          expect(mockChatService.uploadFile).toHaveBeenCalledWith(
            testFile,
            "room-123"
          );
        });

        // Should send file message
        expect(mockChatService.sendMessage).toHaveBeenCalledWith(
          "room-123",
          "user-123",
          expect.stringContaining("medical-history.pdf"),
          "FILE",
          expect.objectContaining({
            url: "https://example.com/medical-history.pdf",
            name: "medical-history.pdf",
          })
        );
      }

      // Doctor provides diagnosis and recommendations
      const diagnosisMessage = {
        id: "msg-4",
        chatRoomId: "room-123",
        senderId: "doctor-123",
        content:
          "Based on your symptoms and medical history, I recommend some tests. I will send you a prescription.",
        messageType: "TEXT",
        isRead: false,
        sentAt: new Date().toISOString(),
        sender: { id: "doctor-123", name: "Dr. Smith", role: "DOCTOR" },
      };

      if (messageCallback) {
        messageCallback(diagnosisMessage);
      }

      await waitFor(() => {
        expect(
          screen.getByText(/Based on your symptoms.*prescription/)
        ).toBeInTheDocument();
      });
    });

    it("should handle video session integration during chat", async () => {
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
        expect(mockChatService.getOrCreateChatRoom).toHaveBeenCalled();
      });

      // Doctor initiates video call
      const videoCallMessage = {
        id: "msg-video",
        chatRoomId: "room-123",
        senderId: "doctor-123",
        content: "Starting video consultation",
        messageType: "SYSTEM",
        isRead: false,
        sentAt: new Date().toISOString(),
        sender: { id: "doctor-123", name: "Dr. Smith", role: "DOCTOR" },
      };

      if (messageCallback) {
        messageCallback(videoCallMessage);
      }

      await waitFor(() => {
        expect(
          screen.getByText("Starting video consultation")
        ).toBeInTheDocument();
      });

      // Should show video call controls or notification
      // This would depend on the actual video integration implementation
    });
  });

  describe("Doctor Chat Room Management", () => {
    it("should display all active chat rooms for doctor", async () => {
      // Mock doctor session
      const doctorSession = {
        user: {
          id: "doctor-123",
          email: "doctor@example.com",
          name: "Dr. Smith",
          role: "DOCTOR",
        },
      };

      const mockChatRooms = [
        {
          id: "room-1",
          appointmentId: "appointment-1",
          patientId: "patient-1",
          doctorId: "doctor-123",
          isActive: true,
          startedAt: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
          appointment: {
            id: "appointment-1",
            scheduledAt: new Date().toISOString(),
            patient: { name: "John Doe", id: "patient-1" },
          },
          _count: { messages: 5 },
          lastMessage: {
            content: "Thank you for the consultation",
            sentAt: new Date(Date.now() - 300000).toISOString(),
            sender: { name: "John Doe" },
          },
        },
        {
          id: "room-2",
          appointmentId: "appointment-2",
          patientId: "patient-2",
          doctorId: "doctor-123",
          isActive: true,
          startedAt: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
          appointment: {
            id: "appointment-2",
            scheduledAt: new Date().toISOString(),
            patient: { name: "Jane Smith", id: "patient-2" },
          },
          _count: { messages: 2 },
          lastMessage: {
            content: "I have some questions about my medication",
            sentAt: new Date(Date.now() - 60000).toISOString(),
            sender: { name: "Jane Smith" },
          },
        },
      ];

      // Mock the chat service to return doctor's chat rooms
      mockChatService.getActiveChatRooms = vi
        .fn()
        .mockResolvedValue(mockChatRooms);

      render(
        <SessionProvider session={doctorSession}>
          <NotificationProvider>
            <ChatRoomList />
          </NotificationProvider>
        </SessionProvider>
      );

      // Should load and display all active chat rooms
      await waitFor(() => {
        expect(mockChatService.getActiveChatRooms).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
        expect(screen.getByText("Jane Smith")).toBeInTheDocument();
        expect(
          screen.getByText("Thank you for the consultation")
        ).toBeInTheDocument();
        expect(
          screen.getByText("I have some questions about my medication")
        ).toBeInTheDocument();
      });

      // Should show unread message indicators
      expect(screen.getByText("5")).toBeInTheDocument(); // Message count for room 1
      expect(screen.getByText("2")).toBeInTheDocument(); // Message count for room 2
    });

    it("should allow doctor to switch between chat rooms", async () => {
      const doctorSession = {
        user: {
          id: "doctor-123",
          email: "doctor@example.com",
          name: "Dr. Smith",
          role: "DOCTOR",
        },
      };

      const mockChatRooms = [
        {
          id: "room-1",
          appointmentId: "appointment-1",
          patientId: "patient-1",
          doctorId: "doctor-123",
          isActive: true,
          appointment: {
            patient: { name: "John Doe", id: "patient-1" },
          },
          _count: { messages: 3 },
          lastMessage: {
            content: "Hello doctor",
            sentAt: new Date().toISOString(),
            sender: { name: "John Doe" },
          },
        },
        {
          id: "room-2",
          appointmentId: "appointment-2",
          patientId: "patient-2",
          doctorId: "doctor-123",
          isActive: true,
          appointment: {
            patient: { name: "Jane Smith", id: "patient-2" },
          },
          _count: { messages: 1 },
          lastMessage: {
            content: "Hi there",
            sentAt: new Date().toISOString(),
            sender: { name: "Jane Smith" },
          },
        },
      ];

      mockChatService.getActiveChatRooms = vi
        .fn()
        .mockResolvedValue(mockChatRooms);
      mockChatService.getMessages.mockResolvedValue([]);

      const user = userEvent.setup();

      render(
        <SessionProvider session={doctorSession}>
          <NotificationProvider>
            <ChatRoomList />
          </NotificationProvider>
        </SessionProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
        expect(screen.getByText("Jane Smith")).toBeInTheDocument();
      });

      // Click on first chat room
      const johnDoeRoom =
        screen.getByText("John Doe").closest("button") ||
        screen.getByText("John Doe").closest('[role="button"]');

      if (johnDoeRoom) {
        await user.click(johnDoeRoom);

        // Should navigate to or open the chat room
        // This would depend on the actual navigation implementation
      }

      // Click on second chat room
      const janeSmithRoom =
        screen.getByText("Jane Smith").closest("button") ||
        screen.getByText("Jane Smith").closest('[role="button"]');

      if (janeSmithRoom) {
        await user.click(janeSmithRoom);

        // Should switch to the new chat room
        // This would depend on the actual navigation implementation
      }
    });
  });

  describe("Notification Integration", () => {
    it("should create notifications for new messages", async () => {
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

      const { notificationService } = require("@/lib/notification-service");

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

      // Simulate receiving a message from doctor
      const newMessage = {
        id: "msg-notification",
        chatRoomId: "room-123",
        senderId: "doctor-123",
        content: "Please take your medication as prescribed",
        messageType: "TEXT",
        isRead: false,
        sentAt: new Date().toISOString(),
        sender: { id: "doctor-123", name: "Dr. Smith", role: "DOCTOR" },
      };

      if (messageCallback) {
        messageCallback(newMessage);
      }

      // Should create a notification for the new message
      await waitFor(() => {
        expect(notificationService.createChatNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: "user-123",
            title: expect.stringContaining("Dr. Smith"),
            message: "Please take your medication as prescribed",
            type: "CHAT_MESSAGE",
            relatedId: "room-123",
          })
        );
      });
    });

    it("should handle notification preferences", async () => {
      // Mock user with notification preferences
      const userWithPreferences = {
        ...mockSession.user,
        notificationPreferences: {
          chatMessages: true,
          emailNotifications: false,
          pushNotifications: true,
        },
      };

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
        <SessionProvider session={{ user: userWithPreferences }}>
          <NotificationProvider>
            <ChatRoom appointmentId="appointment-123" />
          </NotificationProvider>
        </SessionProvider>
      );

      await waitFor(() => {
        expect(mockChatService.subscribeToMessages).toHaveBeenCalled();
      });

      // Simulate receiving a message
      const newMessage = {
        id: "msg-pref",
        chatRoomId: "room-123",
        senderId: "doctor-123",
        content: "Your test results are ready",
        messageType: "TEXT",
        isRead: false,
        sentAt: new Date().toISOString(),
        sender: { id: "doctor-123", name: "Dr. Smith", role: "DOCTOR" },
      };

      if (messageCallback) {
        messageCallback(newMessage);
      }

      // Should respect notification preferences
      const { notificationService } = require("@/lib/notification-service");
      await waitFor(() => {
        expect(notificationService.createChatNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: userWithPreferences.id,
            message: "Your test results are ready",
            deliveryMethods: expect.arrayContaining(["push"]),
          })
        );
      });
    });
  });

  describe("Error Recovery in Appointment Context", () => {
    it("should handle appointment access errors gracefully", async () => {
      // Mock appointment access error
      mockChatService.getOrCreateChatRoom.mockRejectedValue(
        new Error("Appointment not found or access denied")
      );

      render(
        <SessionProvider session={mockSession}>
          <NotificationProvider>
            <ChatRoom appointmentId="invalid-appointment" />
          </NotificationProvider>
        </SessionProvider>
      );

      // Should show appropriate error message
      await waitFor(() => {
        expect(
          screen.getByText(/appointment.*not found|access.*denied/i)
        ).toBeInTheDocument();
      });

      // Should not attempt to set up real-time subscription
      expect(mockChatService.subscribeToMessages).not.toHaveBeenCalled();
    });

    it("should handle expired appointment sessions", async () => {
      const expiredChatRoom = {
        id: "room-expired",
        appointmentId: "appointment-expired",
        patientId: "patient-123",
        doctorId: "doctor-123",
        isActive: false, // Expired/inactive
        endedAt: new Date(Date.now() - 3600000).toISOString(), // Ended 1 hour ago
      };

      mockChatService.getOrCreateChatRoom.mockResolvedValue(expiredChatRoom);
      mockChatService.getMessages.mockResolvedValue([
        {
          id: "msg-final",
          chatRoomId: "room-expired",
          senderId: "doctor-123",
          content: "Thank you for the consultation. Take care!",
          messageType: "TEXT",
          isRead: true,
          sentAt: new Date(Date.now() - 3600000).toISOString(),
          sender: { id: "doctor-123", name: "Dr. Smith", role: "DOCTOR" },
        },
      ]);

      render(
        <SessionProvider session={mockSession}>
          <NotificationProvider>
            <ChatRoom appointmentId="appointment-expired" />
          </NotificationProvider>
        </SessionProvider>
      );

      // Should show chat history but disable new messages
      await waitFor(() => {
        expect(
          screen.getByText("Thank you for the consultation. Take care!")
        ).toBeInTheDocument();
      });

      // Should show session ended message
      expect(
        screen.getByText(/session.*ended|consultation.*completed/i)
      ).toBeInTheDocument();

      // Message input should be disabled
      const messageInput = screen.queryByPlaceholderText(/type.*message/i);
      if (messageInput) {
        expect(messageInput).toBeDisabled();
      }
    });
  });
});
