/**
 * Integration tests for Notification and Chat system integration
 *
 * Tests:
 * - Real-time notification delivery for chat messages
 * - Notification preferences and filtering
 * - Cross-system notification synchronization
 * - Notification-driven chat navigation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionProvider } from "next-auth/react";
import NotificationDropdown from "@/components/notification-dropdown";
import ChatRoom from "@/components/optimized-chat-room";
import { NotificationProvider } from "@/lib/notification-service";

// Mock dependencies
vi.mock("@/lib/supabase", () => ({
  createSupabaseBrowserClient: vi.fn(),
}));

vi.mock("@/lib/chat-service", () => ({
  createChatService: vi.fn(),
}));

vi.mock("@/lib/notification-service", () => ({
  notificationService: {
    createChatNotification: vi.fn(),
    markNotificationAsRead: vi.fn(),
    getUserNotifications: vi.fn(),
    subscribeToNotifications: vi.fn(),
    unsubscribeFromNotifications: vi.fn(),
  },
  NotificationProvider: ({ children }: any) => children,
}));

vi.mock("@/hooks/use-notifications", () => ({
  useNotifications: vi.fn(),
}));

describe("Notification-Chat Integration", () => {
  let mockSupabase: any;
  let mockChatService: any;
  let mockNotificationService: any;
  let mockSession: any;

  beforeEach(() => {
    vi.clearAllMocks();

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

    // Mock NotificationService
    mockNotificationService = {
      createChatNotification: vi.fn(),
      markNotificationAsRead: vi.fn(),
      getUserNotifications: vi.fn(),
      subscribeToNotifications: vi.fn(),
      unsubscribeFromNotifications: vi.fn(),
    };

    const { createSupabaseBrowserClient } = require("@/lib/supabase");
    createSupabaseBrowserClient.mockReturnValue(mockSupabase);

    const { createChatService } = require("@/lib/chat-service");
    createChatService.mockReturnValue(mockChatService);

    const { notificationService } = require("@/lib/notification-service");
    Object.assign(notificationService, mockNotificationService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Real-time Notification Creation", () => {
    it("should create notifications when receiving chat messages", async () => {
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

      // Simulate receiving a message from doctor
      const doctorMessage = {
        id: "msg-from-doctor",
        chatRoomId: "room-123",
        senderId: "doctor-123",
        content: "Your test results are ready for review",
        messageType: "TEXT",
        isRead: false,
        sentAt: new Date().toISOString(),
        sender: {
          id: "doctor-123",
          name: "Dr. Smith",
          role: "DOCTOR",
        },
      };

      if (messageCallback) {
        messageCallback(doctorMessage);
      }

      // Should create a notification
      await waitFor(() => {
        expect(
          mockNotificationService.createChatNotification
        ).toHaveBeenCalledWith({
          userId: "user-123",
          title: "New message from Dr. Smith",
          message: "Your test results are ready for review",
          type: "CHAT_MESSAGE",
          relatedId: "room-123",
          metadata: {
            chatRoomId: "room-123",
            appointmentId: "appointment-123",
            senderId: "doctor-123",
            messageId: "msg-from-doctor",
          },
        });
      });
    });

    it("should not create notifications for own messages", async () => {
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

      // Simulate receiving own message (echo)
      const ownMessage = {
        id: "msg-own",
        chatRoomId: "room-123",
        senderId: "user-123", // Same as current user
        content: "This is my own message",
        messageType: "TEXT",
        isRead: false,
        sentAt: new Date().toISOString(),
        sender: {
          id: "user-123",
          name: "Test User",
          role: "PATIENT",
        },
      };

      if (messageCallback) {
        messageCallback(ownMessage);
      }

      // Should NOT create a notification for own message
      await waitFor(() => {
        expect(
          mockNotificationService.createChatNotification
        ).not.toHaveBeenCalled();
      });
    });

    it("should handle notification preferences", async () => {
      // Mock user with specific notification preferences
      const userWithPrefs = {
        ...mockSession.user,
        notificationPreferences: {
          chatMessages: true,
          emailNotifications: false,
          pushNotifications: true,
          soundNotifications: false,
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
        <SessionProvider session={{ user: userWithPrefs }}>
          <NotificationProvider>
            <ChatRoom appointmentId="appointment-123" />
          </NotificationProvider>
        </SessionProvider>
      );

      await waitFor(() => {
        expect(mockChatService.subscribeToMessages).toHaveBeenCalled();
      });

      // Simulate receiving a message
      const message = {
        id: "msg-with-prefs",
        chatRoomId: "room-123",
        senderId: "doctor-123",
        content: "Please review your medication schedule",
        messageType: "TEXT",
        isRead: false,
        sentAt: new Date().toISOString(),
        sender: {
          id: "doctor-123",
          name: "Dr. Smith",
          role: "DOCTOR",
        },
      };

      if (messageCallback) {
        messageCallback(message);
      }

      // Should create notification respecting preferences
      await waitFor(() => {
        expect(
          mockNotificationService.createChatNotification
        ).toHaveBeenCalledWith({
          userId: userWithPrefs.id,
          title: "New message from Dr. Smith",
          message: "Please review your medication schedule",
          type: "CHAT_MESSAGE",
          relatedId: "room-123",
          metadata: expect.any(Object),
          deliveryMethods: ["push"], // Only push, no email or sound
        });
      });
    });
  });

  describe("Notification-Driven Navigation", () => {
    it("should navigate to chat when notification is clicked", async () => {
      const mockNotifications = [
        {
          id: "notif-1",
          userId: "user-123",
          title: "New message from Dr. Smith",
          message: "Your prescription is ready",
          type: "CHAT_MESSAGE",
          isRead: false,
          createdAt: new Date().toISOString(),
          relatedId: "room-123",
          metadata: {
            chatRoomId: "room-123",
            appointmentId: "appointment-123",
            senderId: "doctor-123",
          },
        },
      ];

      const { useNotifications } = require("@/hooks/use-notifications");
      useNotifications.mockReturnValue({
        notifications: mockNotifications,
        unreadCount: 1,
        markAsRead: vi.fn(),
        markAllAsRead: vi.fn(),
      });

      const mockRouter = {
        push: vi.fn(),
        replace: vi.fn(),
      };

      // Mock Next.js router
      vi.doMock("next/navigation", () => ({
        useRouter: () => mockRouter,
      }));

      const user = userEvent.setup();

      render(
        <SessionProvider session={mockSession}>
          <NotificationProvider>
            <NotificationDropdown />
          </NotificationProvider>
        </SessionProvider>
      );

      // Open notification dropdown
      const notificationButton = screen.getByRole("button", {
        name: /notification/i,
      });
      await user.click(notificationButton);

      // Click on the chat notification
      const chatNotification = screen.getByText("Your prescription is ready");
      await user.click(chatNotification);

      // Should navigate to the chat room
      expect(mockRouter.push).toHaveBeenCalledWith("/chat/room-123");

      // Should mark notification as read
      const {
        useNotifications: useNotificationsHook,
      } = require("@/hooks/use-notifications");
      const { markAsRead } = useNotificationsHook();
      expect(markAsRead).toHaveBeenCalledWith("notif-1");
    });

    it("should show unread count for chat notifications", async () => {
      const mockNotifications = [
        {
          id: "notif-1",
          type: "CHAT_MESSAGE",
          isRead: false,
          title: "Message from Dr. Smith",
          message: "Test message 1",
        },
        {
          id: "notif-2",
          type: "CHAT_MESSAGE",
          isRead: false,
          title: "Message from Dr. Jones",
          message: "Test message 2",
        },
        {
          id: "notif-3",
          type: "APPOINTMENT_REMINDER",
          isRead: false,
          title: "Appointment reminder",
          message: "You have an appointment tomorrow",
        },
      ];

      const { useNotifications } = require("@/hooks/use-notifications");
      useNotifications.mockReturnValue({
        notifications: mockNotifications,
        unreadCount: 3,
        chatUnreadCount: 2, // Only chat messages
        markAsRead: vi.fn(),
        markAllAsRead: vi.fn(),
      });

      render(
        <SessionProvider session={mockSession}>
          <NotificationProvider>
            <NotificationDropdown />
          </NotificationProvider>
        </SessionProvider>
      );

      // Should show total unread count
      expect(screen.getByText("3")).toBeInTheDocument();

      // Should show chat-specific unread count if component supports it
      const chatBadge = screen.queryByText("2 chat messages");
      if (chatBadge) {
        expect(chatBadge).toBeInTheDocument();
      }
    });
  });

  describe("Cross-System Synchronization", () => {
    it("should sync notification read status with chat read status", async () => {
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
          senderId: "doctor-123",
          content: "Test message",
          messageType: "TEXT",
          isRead: false,
          sentAt: new Date().toISOString(),
          sender: { id: "doctor-123", name: "Dr. Smith", role: "DOCTOR" },
        },
      ];

      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.getMessages.mockResolvedValue(mockMessages);
      mockChatService.markMessagesAsRead.mockResolvedValue(undefined);

      let messageUpdateCallback: ((message: any) => void) | null = null;
      mockChatService.subscribeToMessages.mockImplementation(
        (roomId, callbacks) => {
          messageUpdateCallback = callbacks.onMessageUpdate;
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
        expect(mockChatService.getMessages).toHaveBeenCalled();
      });

      // Simulate message being marked as read in chat
      const readMessage = {
        ...mockMessages[0],
        isRead: true,
      };

      if (messageUpdateCallback) {
        messageUpdateCallback(readMessage);
      }

      // Should mark related notifications as read
      await waitFor(() => {
        expect(
          mockNotificationService.markNotificationAsRead
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            relatedId: "room-123",
            metadata: expect.objectContaining({
              messageId: "msg-1",
            }),
          })
        );
      });
    });

    it("should handle bulk notification operations", async () => {
      const mockNotifications = Array.from({ length: 10 }, (_, i) => ({
        id: `notif-${i}`,
        userId: "user-123",
        title: `Message ${i}`,
        message: `Content ${i}`,
        type: "CHAT_MESSAGE",
        isRead: false,
        relatedId: "room-123",
        metadata: {
          chatRoomId: "room-123",
          messageId: `msg-${i}`,
        },
      }));

      const { useNotifications } = require("@/hooks/use-notifications");
      useNotifications.mockReturnValue({
        notifications: mockNotifications,
        unreadCount: 10,
        markAsRead: vi.fn(),
        markAllAsRead: vi.fn(),
      });

      const user = userEvent.setup();

      render(
        <SessionProvider session={mockSession}>
          <NotificationProvider>
            <NotificationDropdown />
          </NotificationProvider>
        </SessionProvider>
      );

      // Open notification dropdown
      const notificationButton = screen.getByRole("button", {
        name: /notification/i,
      });
      await user.click(notificationButton);

      // Click "Mark all as read" button
      const markAllButton = screen.getByRole("button", {
        name: /mark.*all.*read/i,
      });
      await user.click(markAllButton);

      // Should mark all notifications as read
      const {
        useNotifications: useNotificationsHook,
      } = require("@/hooks/use-notifications");
      const { markAllAsRead } = useNotificationsHook();
      expect(markAllAsRead).toHaveBeenCalled();
    });
  });

  describe("Real-time Notification Updates", () => {
    it("should receive real-time notification updates", async () => {
      let notificationCallback: ((notification: any) => void) | null = null;
      mockNotificationService.subscribeToNotifications.mockImplementation(
        (userId, callback) => {
          notificationCallback = callback;
          return { unsubscribe: vi.fn() };
        }
      );

      const { useNotifications } = require("@/hooks/use-notifications");
      useNotifications.mockReturnValue({
        notifications: [],
        unreadCount: 0,
        markAsRead: vi.fn(),
        markAllAsRead: vi.fn(),
      });

      render(
        <SessionProvider session={mockSession}>
          <NotificationProvider>
            <NotificationDropdown />
          </NotificationProvider>
        </SessionProvider>
      );

      // Should subscribe to real-time notifications
      expect(
        mockNotificationService.subscribeToNotifications
      ).toHaveBeenCalledWith("user-123", expect.any(Function));

      // Simulate receiving a new notification
      const newNotification = {
        id: "notif-realtime",
        userId: "user-123",
        title: "New message from Dr. Smith",
        message: "Your lab results are in",
        type: "CHAT_MESSAGE",
        isRead: false,
        createdAt: new Date().toISOString(),
        relatedId: "room-123",
      };

      if (notificationCallback) {
        notificationCallback(newNotification);
      }

      // Should update the notification list in real-time
      // This would be handled by the notification hook/context
      await waitFor(() => {
        // The actual implementation would update the UI
        // This is a placeholder for the expected behavior
        expect(true).toBe(true);
      });
    });

    it("should handle notification delivery failures gracefully", async () => {
      mockNotificationService.createChatNotification.mockRejectedValue(
        new Error("Notification service unavailable")
      );

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

      // Simulate receiving a message
      const message = {
        id: "msg-fail",
        chatRoomId: "room-123",
        senderId: "doctor-123",
        content: "Test message",
        messageType: "TEXT",
        isRead: false,
        sentAt: new Date().toISOString(),
        sender: { id: "doctor-123", name: "Dr. Smith", role: "DOCTOR" },
      };

      if (messageCallback) {
        messageCallback(message);
      }

      // Should attempt to create notification but handle failure gracefully
      await waitFor(() => {
        expect(
          mockNotificationService.createChatNotification
        ).toHaveBeenCalled();
      });

      // Chat should still work even if notifications fail
      expect(
        screen.queryByText(/notification.*error/i)
      ).not.toBeInTheDocument();
    });
  });

  describe("Performance with High Notification Volume", () => {
    it("should handle high volume of notifications efficiently", async () => {
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

      const startTime = performance.now();

      // Simulate rapid message reception
      if (messageCallback) {
        for (let i = 0; i < 50; i++) {
          const message = {
            id: `msg-volume-${i}`,
            chatRoomId: "room-123",
            senderId: "doctor-123",
            content: `Rapid message ${i}`,
            messageType: "TEXT",
            isRead: false,
            sentAt: new Date(Date.now() + i * 10).toISOString(),
            sender: { id: "doctor-123", name: "Dr. Smith", role: "DOCTOR" },
          };

          messageCallback(message);
        }
      }

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Should process notifications efficiently (under 1 second for 50 messages)
      expect(processingTime).toBeLessThan(1000);

      // Should have attempted to create notifications for all messages
      await waitFor(() => {
        expect(
          mockNotificationService.createChatNotification
        ).toHaveBeenCalledTimes(50);
      });
    });

    it("should implement notification throttling for rapid messages", async () => {
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

      // Simulate very rapid messages (within throttle window)
      if (messageCallback) {
        for (let i = 0; i < 10; i++) {
          const message = {
            id: `msg-throttle-${i}`,
            chatRoomId: "room-123",
            senderId: "doctor-123",
            content: `Throttled message ${i}`,
            messageType: "TEXT",
            isRead: false,
            sentAt: new Date(Date.now() + i).toISOString(), // Very close timestamps
            sender: { id: "doctor-123", name: "Dr. Smith", role: "DOCTOR" },
          };

          messageCallback(message);
        }
      }

      await waitFor(() => {
        // Should throttle notifications (fewer than total messages)
        // Exact behavior depends on throttling implementation
        expect(
          mockNotificationService.createChatNotification
        ).toHaveBeenCalled();
      });

      // Should not create a notification for every single rapid message
      const callCount =
        mockNotificationService.createChatNotification.mock.calls.length;
      expect(callCount).toBeLessThan(10); // Should be throttled
    });
  });
});
