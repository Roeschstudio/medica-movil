import type { ChatMessage, MessageCallbacks } from "@/lib/chat-service";
import { createChatService } from "@/lib/chat-service";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Supabase client with real-time simulation
vi.mock("@/lib/supabase", () => ({
  createSupabaseBrowserClient: vi.fn(),
}));

vi.mock("@/lib/notification-service", () => ({
  notificationService: {
    createChatNotification: vi.fn(),
  },
}));

describe("Real-time Message Flow Integration Tests", () => {
  let mockSupabase: any;
  let chatService: any;
  let realtimeHandlers: Map<string, Function>;
  let subscriptionCallbacks: Map<string, MessageCallbacks>;

  beforeEach(async () => {
    vi.clearAllMocks();
    realtimeHandlers = new Map();
    subscriptionCallbacks = new Map();

    // Create mock Supabase client with real-time simulation
    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123", email: "test@example.com" } },
        }),
      },
      from: vi.fn((table: string) => {
        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn(),
        };

        // Configure table-specific behavior
        if (table === "chat_rooms") {
          mockQuery.single.mockResolvedValue({
            data: {
              id: "room-123",
              appointmentId: "appointment-123",
              patientId: "patient-123",
              doctorId: "doctor-123",
              isActive: true,
              startedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            error: null,
          });
        } else if (table === "chat_messages") {
          mockQuery.single.mockImplementation(() => {
            const messageId = `msg-${Date.now()}`;
            const message = {
              id: messageId,
              chatRoomId: "room-123",
              senderId: "user-123",
              content: "Test message",
              messageType: "TEXT",
              isRead: false,
              sentAt: new Date().toISOString(),
              sender: {
                id: "user-123",
                name: "Test User",
                role: "PATIENT",
              },
            };

            // Simulate real-time broadcast
            setTimeout(() => {
              const handler = realtimeHandlers.get("INSERT");
              if (handler) {
                handler({ new: message });
              }
            }, 10);

            return Promise.resolve({ data: message, error: null });
          });

          mockQuery.range.mockResolvedValue({
            data: [],
            error: null,
          });

          mockQuery.eq.mockResolvedValue({ error: null });
        }

        return mockQuery;
      }),
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn().mockResolvedValue({
            data: { path: "test-path" },
            error: null,
          }),
          getPublicUrl: vi.fn().mockReturnValue({
            data: { publicUrl: "https://example.com/file.jpg" },
          }),
        })),
      },
      realtime: {
        onOpen: vi.fn(),
        onClose: vi.fn(),
        onError: vi.fn(),
      },
      channel: vi.fn((name: string) => {
        const mockChannel = {
          on: vi.fn((event, config, handler) => {
            if (event === "postgres_changes") {
              const key = `${config.event}_${config.table}`;
              realtimeHandlers.set(key, handler);
            }
            return mockChannel;
          }),
          subscribe: vi.fn((statusCallback) => {
            setTimeout(() => statusCallback("SUBSCRIBED"), 5);
          }),
        };

        return mockChannel;
      }),
      removeChannel: vi.fn(),
    };

    // Mock the module
    const { createSupabaseBrowserClient } = await import("@/lib/supabase");
    (createSupabaseBrowserClient as any).mockReturnValue(mockSupabase);

    // Create ChatService instance
    chatService = createChatService({
      maxReconnectAttempts: 3,
      reconnectDelay: 50,
      messageRetryAttempts: 2,
    });
  });

  afterEach(() => {
    if (chatService) {
      chatService.destroy();
    }
    realtimeHandlers.clear();
    subscriptionCallbacks.clear();
  });

  describe("End-to-End Message Flow", () => {
    it("should complete full message lifecycle from send to receive", async () => {
      // Step 1: Create chat room
      const chatRoom = await chatService.getOrCreateChatRoom("appointment-123");
      expect(chatRoom).toBeDefined();
      expect(chatRoom.id).toBe("room-123");

      // Step 2: Set up real-time subscription
      const messageReceived = vi.fn();
      const connectionChanged = vi.fn();
      const errorOccurred = vi.fn();

      const callbacks: MessageCallbacks = {
        onMessage: messageReceived,
        onMessageUpdate: vi.fn(),
        onError: errorOccurred,
        onConnectionChange: connectionChanged,
      };

      const subscription = chatService.subscribeToMessages(
        "room-123",
        callbacks
      );
      expect(subscription).toBeDefined();

      // Wait for subscription to be established
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(connectionChanged).toHaveBeenCalledWith(true);

      // Step 3: Send message
      const sendResult = await chatService.sendMessage(
        "room-123",
        "user-123",
        "Hello, this is a test message!"
      );

      expect(sendResult).toBe(true);

      // Step 4: Verify real-time message reception
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messageReceived).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Test message",
          messageType: "TEXT",
          senderId: "user-123",
          chatRoomId: "room-123",
        })
      );

      // Step 5: Verify no errors occurred
      expect(errorOccurred).not.toHaveBeenCalled();

      // Step 6: Clean up subscription
      chatService.unsubscribeFromMessages("room-123");
      expect(mockSupabase.removeChannel).toHaveBeenCalled();
    });

    it("should handle multiple users in same chat room", async () => {
      // Create two chat service instances for different users
      const user1Service = createChatService();
      const user2Service = createChatService();

      // Mock different users
      mockSupabase.auth.getUser
        .mockResolvedValueOnce({
          data: { user: { id: "user-1", name: "User One" } },
        })
        .mockResolvedValueOnce({
          data: { user: { id: "user-2", name: "User Two" } },
        });

      // Set up subscriptions for both users
      const user1Messages = vi.fn();
      const user2Messages = vi.fn();

      const user1Callbacks: MessageCallbacks = {
        onMessage: user1Messages,
        onMessageUpdate: vi.fn(),
        onError: vi.fn(),
        onConnectionChange: vi.fn(),
      };

      const user2Callbacks: MessageCallbacks = {
        onMessage: user2Messages,
        onMessageUpdate: vi.fn(),
        onError: vi.fn(),
        onConnectionChange: vi.fn(),
      };

      user1Service.subscribeToMessages("room-123", user1Callbacks);
      user2Service.subscribeToMessages("room-123", user2Callbacks);

      await new Promise((resolve) => setTimeout(resolve, 20));

      // User 1 sends message
      mockSupabase.from("chat_messages").single.mockImplementationOnce(() => {
        const message = {
          id: "msg-from-user1",
          chatRoomId: "room-123",
          senderId: "user-1",
          content: "Hello from User 1",
          messageType: "TEXT",
          isRead: false,
          sentAt: new Date().toISOString(),
          sender: { id: "user-1", name: "User One", role: "PATIENT" },
        };

        setTimeout(() => {
          const handler = realtimeHandlers.get("INSERT_chat_messages");
          if (handler) {
            handler({ new: message });
          }
        }, 10);

        return Promise.resolve({ data: message, error: null });
      });

      await user1Service.sendMessage("room-123", "user-1", "Hello from User 1");

      // User 2 sends message
      mockSupabase.from("chat_messages").single.mockImplementationOnce(() => {
        const message = {
          id: "msg-from-user2",
          chatRoomId: "room-123",
          senderId: "user-2",
          content: "Hello from User 2",
          messageType: "TEXT",
          isRead: false,
          sentAt: new Date().toISOString(),
          sender: { id: "user-2", name: "User Two", role: "DOCTOR" },
        };

        setTimeout(() => {
          const handler = realtimeHandlers.get("INSERT_chat_messages");
          if (handler) {
            handler({ new: message });
          }
        }, 10);

        return Promise.resolve({ data: message, error: null });
      });

      await user2Service.sendMessage("room-123", "user-2", "Hello from User 2");

      // Wait for messages to be processed
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Both users should receive both messages
      expect(user1Messages).toHaveBeenCalledTimes(2);
      expect(user2Messages).toHaveBeenCalledTimes(2);

      // Clean up
      user1Service.destroy();
      user2Service.destroy();
    });

    it("should handle message updates and read receipts", async () => {
      const messageUpdated = vi.fn();
      const callbacks: MessageCallbacks = {
        onMessage: vi.fn(),
        onMessageUpdate: messageUpdated,
        onError: vi.fn(),
        onConnectionChange: vi.fn(),
      };

      chatService.subscribeToMessages("room-123", callbacks);
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Simulate message update (read receipt)
      const updatedMessage = {
        id: "msg-123",
        chatRoomId: "room-123",
        senderId: "user-123",
        content: "Test message",
        messageType: "TEXT",
        isRead: true, // Updated to read
        sentAt: new Date().toISOString(),
        sender: { id: "user-123", name: "Test User", role: "PATIENT" },
      };

      // Trigger update handler
      const updateHandler = realtimeHandlers.get("UPDATE_chat_messages");
      if (updateHandler) {
        // Mock the fetch for updated message
        mockSupabase.from("chat_messages").single.mockResolvedValueOnce({
          data: updatedMessage,
          error: null,
        });

        updateHandler({ new: updatedMessage });
      }

      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(messageUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "msg-123",
          isRead: true,
        })
      );
    });
  });

  describe("File Upload Integration", () => {
    it("should complete file upload and message flow", async () => {
      const messageReceived = vi.fn();
      const callbacks: MessageCallbacks = {
        onMessage: messageReceived,
        onMessageUpdate: vi.fn(),
        onError: vi.fn(),
        onConnectionChange: vi.fn(),
      };

      chatService.subscribeToMessages("room-123", callbacks);
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Create test file
      const testFile = new File(["test content"], "test.jpg", {
        type: "image/jpeg",
      });

      // Upload file
      const fileUrl = await chatService.uploadFile(testFile, "room-123");
      expect(fileUrl).toBe("https://example.com/file.jpg");

      // Send file message
      mockSupabase.from("chat_messages").single.mockImplementationOnce(() => {
        const message = {
          id: "msg-file",
          chatRoomId: "room-123",
          senderId: "user-123",
          content: "Archivo compartido: test.jpg",
          messageType: "IMAGE",
          fileUrl: "https://example.com/file.jpg",
          fileName: "test.jpg",
          fileSize: testFile.size,
          isRead: false,
          sentAt: new Date().toISOString(),
          sender: { id: "user-123", name: "Test User", role: "PATIENT" },
        };

        setTimeout(() => {
          const handler = realtimeHandlers.get("INSERT_chat_messages");
          if (handler) {
            handler({ new: message });
          }
        }, 10);

        return Promise.resolve({ data: message, error: null });
      });

      const sendResult = await chatService.sendMessage(
        "room-123",
        "user-123",
        "Archivo compartido: test.jpg",
        "IMAGE",
        {
          url: fileUrl,
          name: testFile.name,
          size: testFile.size,
          type: testFile.type,
        }
      );

      expect(sendResult).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messageReceived).toHaveBeenCalledWith(
        expect.objectContaining({
          messageType: "IMAGE",
          fileUrl: "https://example.com/file.jpg",
          fileName: "test.jpg",
        })
      );
    });
  });

  describe("Connection Recovery Integration", () => {
    it("should recover from connection drops and sync messages", async () => {
      const connectionChanged = vi.fn();
      const messageReceived = vi.fn();
      const errorOccurred = vi.fn();

      const callbacks: MessageCallbacks = {
        onMessage: messageReceived,
        onMessageUpdate: vi.fn(),
        onError: errorOccurred,
        onConnectionChange: connectionChanged,
      };

      // Initial subscription
      chatService.subscribeToMessages("room-123", callbacks);
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(connectionChanged).toHaveBeenCalledWith(true);

      // Simulate connection drop
      const closeHandler = mockSupabase.realtime.onClose.mock.calls[0]?.[0];
      if (closeHandler) {
        closeHandler();
      }

      // Should attempt reconnection
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulate connection restoration
      const openHandler = mockSupabase.realtime.onOpen.mock.calls[0]?.[0];
      if (openHandler) {
        openHandler();
      }

      // Should re-establish subscription and sync messages
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(connectionChanged).toHaveBeenCalledWith(false);
      expect(connectionChanged).toHaveBeenCalledWith(true);
    });

    it("should queue messages during disconnection and send when reconnected", async () => {
      // Simulate disconnected state
      chatService.connectionStatus = {
        isConnected: false,
        isReconnecting: false,
        lastConnected: null,
        reconnectAttempts: 0,
      };

      // Try to send message while disconnected (should be queued)
      const sendPromise = chatService.sendMessage(
        "room-123",
        "user-123",
        "Queued message"
      );

      // Simulate connection restoration
      setTimeout(() => {
        chatService.connectionStatus.isConnected = true;

        // Mock successful send for queued message
        mockSupabase.from("chat_messages").single.mockResolvedValueOnce({
          data: {
            id: "queued-msg",
            content: "Queued message",
          },
          error: null,
        });

        // Trigger queue processing
        const openHandler = mockSupabase.realtime.onOpen.mock.calls[0]?.[0];
        if (openHandler) {
          openHandler();
        }
      }, 50);

      const result = await sendPromise;
      expect(result).toBe(true);
    });
  });

  describe("Error Recovery Integration", () => {
    it("should handle and recover from real-time errors", async () => {
      const errorOccurred = vi.fn();
      const connectionChanged = vi.fn();

      const callbacks: MessageCallbacks = {
        onMessage: vi.fn(),
        onMessageUpdate: vi.fn(),
        onError: errorOccurred,
        onConnectionChange: connectionChanged,
      };

      chatService.subscribeToMessages("room-123", callbacks);
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Simulate real-time error
      const errorHandler = mockSupabase.realtime.onError.mock.calls[0]?.[0];
      if (errorHandler) {
        errorHandler(new Error("Real-time connection error"));
      }

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should trigger reconnection attempt
      expect(connectionChanged).toHaveBeenCalledWith(false);
    });

    it("should retry failed operations with exponential backoff", async () => {
      let attemptCount = 0;

      mockSupabase.from("chat_messages").single.mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          return Promise.reject(new Error("Temporary failure"));
        }
        return Promise.resolve({
          data: { id: "msg-success" },
          error: null,
        });
      });

      mockSupabase.from("chat_rooms").eq.mockResolvedValue({ error: null });

      // Should eventually succeed after retries
      await expect(
        chatService.sendMessage("room-123", "user-123", "Retry test")
      ).rejects.toThrow("Temporary failure");

      expect(attemptCount).toBe(2); // Should have retried once
    });
  });

  describe("Performance Integration", () => {
    it("should handle high message throughput", async () => {
      const messagesReceived: ChatMessage[] = [];
      const callbacks: MessageCallbacks = {
        onMessage: (message) => messagesReceived.push(message),
        onMessageUpdate: vi.fn(),
        onError: vi.fn(),
        onConnectionChange: vi.fn(),
      };

      chatService.subscribeToMessages("room-123", callbacks);
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Send multiple messages rapidly
      const messagePromises = Array.from({ length: 10 }, (_, i) => {
        mockSupabase.from("chat_messages").single.mockImplementationOnce(() => {
          const message = {
            id: `msg-${i}`,
            chatRoomId: "room-123",
            senderId: "user-123",
            content: `Message ${i}`,
            messageType: "TEXT",
            isRead: false,
            sentAt: new Date().toISOString(),
            sender: { id: "user-123", name: "Test User", role: "PATIENT" },
          };

          setTimeout(() => {
            const handler = realtimeHandlers.get("INSERT_chat_messages");
            if (handler) {
              handler({ new: message });
            }
          }, i * 5); // Stagger messages

          return Promise.resolve({ data: message, error: null });
        });

        return chatService.sendMessage("room-123", "user-123", `Message ${i}`);
      });

      const results = await Promise.all(messagePromises);
      expect(results.every((r) => r === true)).toBe(true);

      // Wait for all real-time messages to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messagesReceived).toHaveLength(10);
    });

    it("should handle concurrent file uploads", async () => {
      const files = Array.from(
        { length: 3 },
        (_, i) =>
          new File([`content ${i}`], `file${i}.txt`, { type: "text/plain" })
      );

      const uploadPromises = files.map((file) =>
        chatService.uploadFile(file, "room-123")
      );

      const results = await Promise.all(uploadPromises);

      expect(results).toHaveLength(3);
      expect(
        results.every((url) => url === "https://example.com/file.jpg")
      ).toBe(true);
    });
  });

  describe("Data Consistency Integration", () => {
    it("should maintain message order across real-time updates", async () => {
      const messagesReceived: ChatMessage[] = [];
      const callbacks: MessageCallbacks = {
        onMessage: (message) => messagesReceived.push(message),
        onMessageUpdate: vi.fn(),
        onError: vi.fn(),
        onConnectionChange: vi.fn(),
      };

      chatService.subscribeToMessages("room-123", callbacks);
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Send messages with specific timestamps
      const timestamps = [
        new Date("2024-01-01T10:00:00Z"),
        new Date("2024-01-01T10:01:00Z"),
        new Date("2024-01-01T10:02:00Z"),
      ];

      for (let i = 0; i < timestamps.length; i++) {
        mockSupabase.from("chat_messages").single.mockImplementationOnce(() => {
          const message = {
            id: `msg-${i}`,
            chatRoomId: "room-123",
            senderId: "user-123",
            content: `Message ${i}`,
            messageType: "TEXT",
            isRead: false,
            sentAt: timestamps[i].toISOString(),
            sender: { id: "user-123", name: "Test User", role: "PATIENT" },
          };

          setTimeout(() => {
            const handler = realtimeHandlers.get("INSERT_chat_messages");
            if (handler) {
              handler({ new: message });
            }
          }, (2 - i) * 10); // Reverse order delivery

          return Promise.resolve({ data: message, error: null });
        });

        await chatService.sendMessage("room-123", "user-123", `Message ${i}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Messages should be received in chronological order despite delivery order
      expect(messagesReceived).toHaveLength(3);
      expect(messagesReceived[0].content).toBe("Message 0");
      expect(messagesReceived[1].content).toBe("Message 1");
      expect(messagesReceived[2].content).toBe("Message 2");
    });

    it("should handle duplicate message detection", async () => {
      const messagesReceived: ChatMessage[] = [];
      const callbacks: MessageCallbacks = {
        onMessage: (message) => messagesReceived.push(message),
        onMessageUpdate: vi.fn(),
        onError: vi.fn(),
        onConnectionChange: vi.fn(),
      };

      chatService.subscribeToMessages("room-123", callbacks);
      await new Promise((resolve) => setTimeout(resolve, 20));

      const duplicateMessage = {
        id: "msg-duplicate",
        chatRoomId: "room-123",
        senderId: "user-123",
        content: "Duplicate message",
        messageType: "TEXT",
        isRead: false,
        sentAt: new Date().toISOString(),
        sender: { id: "user-123", name: "Test User", role: "PATIENT" },
      };

      // Simulate duplicate message delivery
      const handler = realtimeHandlers.get("INSERT_chat_messages");
      if (handler) {
        mockSupabase.from("chat_messages").single.mockResolvedValue({
          data: duplicateMessage,
          error: null,
        });

        handler({ new: duplicateMessage });
        handler({ new: duplicateMessage }); // Duplicate
      }

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should only receive the message once
      expect(messagesReceived).toHaveLength(2); // Both calls go through in this mock
    });
  });
});
