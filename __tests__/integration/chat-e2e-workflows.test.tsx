import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionProvider } from "next-auth/react";
import ChatRoom from "@/components/optimized-chat-room";
import ChatRoomList from "@/components/chat/chat-room-list";
import { NotificationProvider } from "@/lib/notification-service";
import { createChatService } from "@/lib/chat-service";

// Mock dependencies
vi.mock("@/lib/supabase", () => ({
  createSupabaseBrowserClient: vi.fn(),
}));

vi.mock("@/lib/notification-service", () => ({
  notificationService: {
    createChatNotification: vi.fn(),
    markNotificationAsRead: vi.fn(),
    getUserNotifications: vi.fn(),
  },
  NotificationProvider: ({ children }: any) => children,
}));

vi.mock("@/lib/chat-service", () => ({
  createChatService: vi.fn(),
}));

describe("End-to-End Chat Workflows", () => {
  let mockSupabase: any;
  let mockChatService: any;
  let mockSession: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock session
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

  describe("Complete Chat Session Workflow", () => {
    it("should complete full patient-doctor chat session", async () => {
      // Mock chat room data
      const mockChatRoom = {
        id: "room-123",
        appointmentId: "appointment-123",
        patientId: "patient-123",
        doctorId: "doctor-123",
        isActive: true,
        startedAt: new Date().toISOString(),
      };

      const mockMessages = [
        {
          id: "msg-1",
          chatRoomId: "room-123",
          senderId: "doctor-123",
          content: "Hello, how can I help you today?",
          messageType: "TEXT",
          isRead: false,
          sentAt: new Date(Date.now() - 60000).toISOString(),
          sender: {
            id: "doctor-123",
            name: "Dr. Smith",
            role: "DOCTOR",
          },
        },
      ];

      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.getMessages.mockResolvedValue(mockMessages);
      mockChatService.sendMessage.mockResolvedValue(true);
      mockChatService.subscribeToMessages.mockReturnValue({
        unsubscribe: vi.fn(),
      });

      const user = userEvent.setup();

      // Render chat room component
      render(
        <SessionProvider session={mockSession}>
          <NotificationProvider>
            <ChatRoom appointmentId="appointment-123" />
          </NotificationProvider>
        </SessionProvider>
      );

      // Wait for chat room to load
      await waitFor(() => {
        expect(mockChatService.getOrCreateChatRoom).toHaveBeenCalledWith(
          "appointment-123"
        );
      });

      // Verify initial message is displayed
      await waitFor(() => {
        expect(
          screen.getByText("Hello, how can I help you today?")
        ).toBeInTheDocument();
      });

      // Patient types and sends a response
      const messageInput = screen.getByPlaceholderText(/type.*message/i);
      await user.type(messageInput, "I have been experiencing headaches");

      const sendButton = screen.getByRole("button", { name: /send/i });
      await user.click(sendButton);

      // Verify message was sent
      expect(mockChatService.sendMessage).toHaveBeenCalledWith(
        "room-123",
        "user-123",
        "I have been experiencing headaches"
      );

      // Simulate receiving doctor's response
      const newMessage = {
        id: "msg-2",
        chatRoomId: "room-123",
        senderId: "doctor-123",
        content: "How long have you been experiencing these headaches?",
        messageType: "TEXT",
        isRead: false,
        sentAt: new Date().toISOString(),
        sender: {
          id: "doctor-123",
          name: "Dr. Smith",
          role: "DOCTOR",
        },
      };

      // Simulate real-time message reception
      const subscribeCall = mockChatService.subscribeToMessages.mock.calls[0];
      if (subscribeCall && subscribeCall[1]?.onMessage) {
        subscribeCall[1].onMessage(newMessage);
      }

      // Verify new message appears
      await waitFor(() => {
        expect(
          screen.getByText(
            "How long have you been experiencing these headaches?"
          )
        ).toBeInTheDocument();
      });
    });

    it("should handle file sharing workflow", async () => {
      const mockChatRoom = {
        id: "room-123",
        appointmentId: "appointment-123",
        patientId: "patient-123",
        doctorId: "doctor-123",
        isActive: true,
      };

      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.getMessages.mockResolvedValue([]);
      mockChatService.uploadFile.mockResolvedValue(
        "https://example.com/file.jpg"
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
        expect(mockChatService.getOrCreateChatRoom).toHaveBeenCalled();
      });

      // Create a test file
      const testFile = new File(["test content"], "medical-report.pdf", {
        type: "application/pdf",
      });

      // Find file input (might be hidden)
      const fileInput =
        screen.getByLabelText(/upload.*file/i) ||
        document.querySelector('input[type="file"]');

      if (fileInput) {
        await user.upload(fileInput, testFile);

        // Wait for file upload to complete
        await waitFor(() => {
          expect(mockChatService.uploadFile).toHaveBeenCalledWith(
            testFile,
            "room-123"
          );
        });

        // Verify file message was sent
        await waitFor(() => {
          expect(mockChatService.sendMessage).toHaveBeenCalledWith(
            "room-123",
            "user-123",
            expect.stringContaining("medical-report.pdf"),
            "FILE",
            expect.objectContaining({
              url: "https://example.com/file.jpg",
              name: "medical-report.pdf",
            })
          );
        });
      }
    });

    it("should handle connection loss and recovery", async () => {
      const mockChatRoom = {
        id: "room-123",
        appointmentId: "appointment-123",
        patientId: "patient-123",
        doctorId: "doctor-123",
        isActive: true,
      };

      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.getMessages.mockResolvedValue([]);

      let connectionCallback: ((connected: boolean) => void) | null = null;
      mockChatService.subscribeToMessages.mockImplementation(
        (roomId, callbacks) => {
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

      // Simulate connection loss
      if (connectionCallback) {
        connectionCallback(false);
      }

      // Should show connection status
      await waitFor(() => {
        expect(screen.getByText(/disconnected|offline/i)).toBeInTheDocument();
      });

      // Simulate connection recovery
      if (connectionCallback) {
        connectionCallback(true);
      }

      // Should show connected status
      await waitFor(() => {
        expect(screen.getByText(/connected|online/i)).toBeInTheDocument();
      });
    });
  });

  describe("Multi-User Chat Scenarios", () => {
    it("should handle multiple users in same chat room", async () => {
      const mockChatRoom = {
        id: "room-123",
        appointmentId: "appointment-123",
        patientId: "patient-123",
        doctorId: "doctor-123",
        isActive: true,
      };

      const initialMessages = [
        {
          id: "msg-1",
          chatRoomId: "room-123",
          senderId: "doctor-123",
          content: "Hello patient",
          messageType: "TEXT",
          isRead: false,
          sentAt: new Date(Date.now() - 120000).toISOString(),
          sender: { id: "doctor-123", name: "Dr. Smith", role: "DOCTOR" },
        },
        {
          id: "msg-2",
          chatRoomId: "room-123",
          senderId: "patient-123",
          content: "Hello doctor",
          messageType: "TEXT",
          isRead: false,
          sentAt: new Date(Date.now() - 60000).toISOString(),
          sender: { id: "patient-123", name: "John Doe", role: "PATIENT" },
        },
      ];

      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.getMessages.mockResolvedValue(initialMessages);

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

      // Wait for initial messages to load
      await waitFor(() => {
        expect(screen.getByText("Hello patient")).toBeInTheDocument();
        expect(screen.getByText("Hello doctor")).toBeInTheDocument();
      });

      // Simulate new message from doctor
      const newDoctorMessage = {
        id: "msg-3",
        chatRoomId: "room-123",
        senderId: "doctor-123",
        content: "How are you feeling today?",
        messageType: "TEXT",
        isRead: false,
        sentAt: new Date().toISOString(),
        sender: { id: "doctor-123", name: "Dr. Smith", role: "DOCTOR" },
      };

      if (messageCallback) {
        messageCallback(newDoctorMessage);
      }

      // Verify new message appears
      await waitFor(() => {
        expect(
          screen.getByText("How are you feeling today?")
        ).toBeInTheDocument();
      });

      // Simulate new message from patient
      const newPatientMessage = {
        id: "msg-4",
        chatRoomId: "room-123",
        senderId: "patient-123",
        content: "I'm feeling better, thank you",
        messageType: "TEXT",
        isRead: false,
        sentAt: new Date().toISOString(),
        sender: { id: "patient-123", name: "John Doe", role: "PATIENT" },
      };

      if (messageCallback) {
        messageCallback(newPatientMessage);
      }

      // Verify patient message appears
      await waitFor(() => {
        expect(
          screen.getByText("I'm feeling better, thank you")
        ).toBeInTheDocument();
      });
    });

    it("should handle typing indicators between users", async () => {
      const mockChatRoom = {
        id: "room-123",
        appointmentId: "appointment-123",
        patientId: "patient-123",
        doctorId: "doctor-123",
        isActive: true,
      };

      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.getMessages.mockResolvedValue([]);

      let typingCallback: ((userId: string, isTyping: boolean) => void) | null =
        null;
      mockChatService.subscribeToMessages.mockImplementation(
        (roomId, callbacks) => {
          typingCallback = callbacks.onTypingChange;
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

      // Simulate doctor typing
      if (typingCallback) {
        typingCallback("doctor-123", true);
      }

      // Should show typing indicator
      await waitFor(() => {
        expect(screen.getByText(/typing/i)).toBeInTheDocument();
      });

      // Simulate doctor stops typing
      if (typingCallback) {
        typingCallback("doctor-123", false);
      }

      // Typing indicator should disappear
      await waitFor(() => {
        expect(screen.queryByText(/typing/i)).not.toBeInTheDocument();
      });
    });
  });

  describe("Error Handling Workflows", () => {
    it("should handle message send failures gracefully", async () => {
      const mockChatRoom = {
        id: "room-123",
        appointmentId: "appointment-123",
        patientId: "patient-123",
        doctorId: "doctor-123",
        isActive: true,
      };

      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.getMessages.mockResolvedValue([]);
      mockChatService.sendMessage.mockRejectedValue(new Error("Network error"));

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

      // Try to send a message
      const messageInput = screen.getByPlaceholderText(/type.*message/i);
      await user.type(messageInput, "Test message");

      const sendButton = screen.getByRole("button", { name: /send/i });
      await user.click(sendButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/failed.*send|error/i)).toBeInTheDocument();
      });

      // Should show retry option
      const retryButton = screen.getByRole("button", { name: /retry/i });
      expect(retryButton).toBeInTheDocument();

      // Mock successful retry
      mockChatService.sendMessage.mockResolvedValueOnce(true);
      await user.click(retryButton);

      // Error should disappear
      await waitFor(() => {
        expect(
          screen.queryByText(/failed.*send|error/i)
        ).not.toBeInTheDocument();
      });
    });

    it("should handle file upload failures", async () => {
      const mockChatRoom = {
        id: "room-123",
        appointmentId: "appointment-123",
        patientId: "patient-123",
        doctorId: "doctor-123",
        isActive: true,
      };

      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.getMessages.mockResolvedValue([]);
      mockChatService.uploadFile.mockRejectedValue(new Error("Upload failed"));

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

      // Try to upload a file
      const testFile = new File(["test"], "test.txt", { type: "text/plain" });
      const fileInput = document.querySelector('input[type="file"]');

      if (fileInput) {
        await user.upload(fileInput, testFile);

        // Should show upload error
        await waitFor(() => {
          expect(
            screen.getByText(/upload.*failed|error.*upload/i)
          ).toBeInTheDocument();
        });
      }
    });
  });

  describe("Performance Workflows", () => {
    it("should handle large message history efficiently", async () => {
      const mockChatRoom = {
        id: "room-123",
        appointmentId: "appointment-123",
        patientId: "patient-123",
        doctorId: "doctor-123",
        isActive: true,
      };

      // Generate large message history
      const largeMessageHistory = Array.from({ length: 100 }, (_, i) => ({
        id: `msg-${i}`,
        chatRoomId: "room-123",
        senderId: i % 2 === 0 ? "doctor-123" : "patient-123",
        content: `Message ${i}`,
        messageType: "TEXT",
        isRead: false,
        sentAt: new Date(Date.now() - (100 - i) * 60000).toISOString(),
        sender: {
          id: i % 2 === 0 ? "doctor-123" : "patient-123",
          name: i % 2 === 0 ? "Dr. Smith" : "John Doe",
          role: i % 2 === 0 ? "DOCTOR" : "PATIENT",
        },
      }));

      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.getMessages.mockResolvedValue(largeMessageHistory);

      const startTime = performance.now();

      render(
        <SessionProvider session={mockSession}>
          <NotificationProvider>
            <ChatRoom appointmentId="appointment-123" />
          </NotificationProvider>
        </SessionProvider>
      );

      // Wait for messages to load
      await waitFor(() => {
        expect(screen.getByText("Message 0")).toBeInTheDocument();
      });

      const endTime = performance.now();
      const loadTime = endTime - startTime;

      // Should load within reasonable time (less than 2 seconds)
      expect(loadTime).toBeLessThan(2000);

      // Should show most recent messages
      expect(screen.getByText("Message 99")).toBeInTheDocument();
    });

    it("should handle rapid message updates", async () => {
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

      // Simulate rapid message updates
      if (messageCallback) {
        for (let i = 0; i < 10; i++) {
          const message = {
            id: `rapid-msg-${i}`,
            chatRoomId: "room-123",
            senderId: "doctor-123",
            content: `Rapid message ${i}`,
            messageType: "TEXT",
            isRead: false,
            sentAt: new Date(Date.now() + i * 100).toISOString(),
            sender: { id: "doctor-123", name: "Dr. Smith", role: "DOCTOR" },
          };

          messageCallback(message);
        }
      }

      // Should handle all messages without crashing
      await waitFor(() => {
        expect(screen.getByText("Rapid message 0")).toBeInTheDocument();
        expect(screen.getByText("Rapid message 9")).toBeInTheDocument();
      });
    });
  });
});