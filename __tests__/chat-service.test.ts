import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";
import type { ChatService } from "@/lib/chat-service";
import { mockSupabaseClient, mockUser } from "@tests/__mocks__/supabase";

// Mock the chat-service module completely
vi.mock("@/lib/chat-service", () => {
  return {
    createChatService: vi.fn(),
    chatService: undefined,
  };
});

// Mock file for testing
const createMockFile = (name: string, size: number, type: string): File => {
  const file = new File(["test content"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

describe("ChatService", () => {
  let chatService: ChatService;
  let mockSupabase: any;
  let createChatService: any;

  // Helper function to create ChatService instance
  const createChatServiceInstance = () => {
    return createChatService({
      maxReconnectAttempts: 3,
      reconnectDelay: 1000,
      maxFileSize: 1024 * 1024,
      allowedFileTypes: ["image/*", "application/pdf"],
      messageRetryAttempts: 2,
      messageRetryDelay: 500,
      disableConnectionMonitoring: true, // Disable for tests
    });
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Use the global mockSupabaseClient
    mockSupabase = mockSupabaseClient;

    // Reset channel mock to default behavior
    mockSupabaseClient.channel.mockImplementation((channelName: string) => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockResolvedValue({ status: 'SUBSCRIBED' }),
      unsubscribe: vi.fn().mockResolvedValue({ status: 'CLOSED' }),
      send: vi.fn().mockResolvedValue({ status: 'ok' }),
    }));

    // Import the actual ChatService implementation
    const actualChatService = await vi.importActual("@/lib/chat-service") as any;
    
    // Create a wrapper that uses our mocked Supabase client
    createChatService = (config?: any) => {
      const { ChatService } = actualChatService;
      return new ChatService(mockSupabaseClient, config);
    };

    // Create ChatService instance with test configuration
    // Note: We'll create it in each test to avoid initialization issues
    chatService = null as any;
  });

  afterEach(() => {
    if (chatService) {
      chatService.destroy();
    }
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should create ChatService instance", () => {
      chatService = createChatServiceInstance();
      
      expect(chatService).toBeDefined();
      expect(chatService.getConnectionStatus).toBeDefined();
    });

    it("should have default connection status", () => {
      chatService = createChatServiceInstance();
      
      const status = chatService.getConnectionStatus();
      expect(status).toHaveProperty("isConnected");
      expect(status).toHaveProperty("isReconnecting");
      expect(status).toHaveProperty("lastConnected");
      expect(status).toHaveProperty("reconnectAttempts");
    });
  });

  describe("getOrCreateChatRoom", () => {
    it("should return existing chat room if found", async () => {
      chatService = createChatServiceInstance();
      
      const mockRoom = {
        id: "room-123",
        appointmentId: "appointment-123",
        patientId: mockUser.id,
        doctorId: "doctor-123",
        isActive: true,
        startedAt: "2024-01-01T00:00:00Z",
        endedAt: null,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      // Mock successful room fetch
      mockSupabase.from("chat_rooms").single.mockResolvedValueOnce({
        data: mockRoom,
        error: null,
      });

      const result = await chatService.getOrCreateChatRoom("appointment-123");

      expect(result).toEqual({
        id: "room-123",
        appointmentId: "appointment-123",
        patientId: mockUser.id,
        doctorId: "doctor-123",
        isActive: true,
        startedAt: new Date("2024-01-01T00:00:00Z"),
        endedAt: undefined,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-01T00:00:00Z"),
      });
    });

    it("should handle errors gracefully", async () => {
      chatService = createChatServiceInstance();
      
      mockSupabase
        .from("chat_rooms")
        .single.mockRejectedValueOnce(new Error("Database error"));

      await expect(
        chatService.getOrCreateChatRoom("appointment-123")
      ).rejects.toThrow();
    });
  });

  describe("getActiveChatRooms", () => {
    it("should return active chat rooms for authenticated user", async () => {
      chatService = createChatServiceInstance();
      
      const mockRooms = [
        {
          id: "room-1",
          appointmentId: "appointment-1",
          patientId: mockUser.id,
          doctorId: "doctor-1",
          isActive: true,
          startedAt: "2024-01-01T00:00:00Z",
          endedAt: null,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];

      // Mock the query chain
      const mockOrderResult = { data: mockRooms, error: null };
      mockSupabase
        .from("chat_rooms")
        .order.mockResolvedValueOnce(mockOrderResult);

      const result = await chatService.getActiveChatRooms();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("room-1");
    });

    it("should throw error if user not authenticated", async () => {
      chatService = createChatServiceInstance();
      
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
      });

      await expect(chatService.getActiveChatRooms()).rejects.toThrow(
        "User not authenticated"
      );
    });
  });

  describe("getMessages", () => {
    it("should return messages for a chat room", async () => {
      chatService = createChatServiceInstance();
      
      const mockMessages = [
        {
          id: "msg-1",
          chatRoomId: "room-123",
          senderId: "user-123",
          content: "Hello",
          messageType: "TEXT",
          isRead: false,
          sentAt: "2024-01-01T10:00:00Z",
          sender: { id: "user-123", name: "Test User", role: "PATIENT" },
        },
      ];

      mockSupabase.from("chat_messages").range.mockResolvedValueOnce({
        data: mockMessages,
        error: null,
      });

      const result = await chatService.getMessages("room-123");

      expect(result).toEqual(mockMessages);
    });

    it("should handle pagination correctly", async () => {
      chatService = createChatServiceInstance();
      
      mockSupabase.from("chat_messages").range.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      await chatService.getMessages("room-123", 20, 10);

      expect(mockSupabase.from("chat_messages").range).toHaveBeenCalledWith(
        10,
        29
      );
    });
  });

  describe("sendMessage", () => {
    it("should send a text message successfully", async () => {
      chatService = createChatServiceInstance();
      
      const mockMessage = {
        id: "msg-123",
        chatRoomId: "room-123",
        senderId: "user-123",
        content: "Hello world",
        messageType: "TEXT",
        isRead: false,
        sentAt: "2024-01-01T10:00:00Z",
      };

      mockSupabase.from("chat_messages").single.mockResolvedValueOnce({
        data: mockMessage,
        error: null,
      });

      mockSupabase.from("chat_rooms").eq.mockResolvedValueOnce({ error: null });

      const result = await chatService.sendMessage(
        "room-123",
        "user-123",
        "Hello world"
      );

      expect(result).toBe(true);
    });

    it("should handle send errors", async () => {
      chatService = createChatServiceInstance();
      
      mockSupabase
        .from("chat_messages")
        .single.mockRejectedValueOnce(new Error("Send failed"));

      await expect(
        chatService.sendMessage("room-123", "user-123", "Hello")
      ).rejects.toThrow();
    });
  });

  describe("markMessagesAsRead", () => {
    it("should mark messages as read", async () => {
      chatService = createChatServiceInstance();
      
      mockSupabase
        .from("chat_messages")
        .eq.mockResolvedValueOnce({ error: null });

      await expect(
        chatService.markMessagesAsRead("room-123", "user-123")
      ).resolves.not.toThrow();
    });

    it("should handle mark as read errors", async () => {
      mockSupabase
        .from("chat_messages")
        .eq.mockRejectedValueOnce(new Error("Update failed"));

      await expect(
        chatService.markMessagesAsRead("room-123", "user-123")
      ).rejects.toThrow();
    });
  });

  describe("subscribeToMessages", () => {
    it("should create subscription for message updates", () => {
      chatService = createChatServiceInstance();
      
      const callbacks = {
        onMessage: vi.fn(),
        onMessageUpdate: vi.fn(),
        onError: vi.fn(),
        onConnectionChange: vi.fn(),
      };

      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      };

      mockSupabase.channel.mockReturnValue(mockChannel);

      const result = chatService.subscribeToMessages("room-123", callbacks);

      expect(mockSupabase.channel).toHaveBeenCalledWith("chat_room_room-123");
      expect(mockChannel.on).toHaveBeenCalledTimes(2); // INSERT and UPDATE events
      expect(result).toBe(mockChannel);
    });
  });

  describe("uploadFile", () => {
    it("should upload file successfully", async () => {
      chatService = createChatServiceInstance();
      
      const mockFile = createMockFile("test.jpg", 500000, "image/jpeg");

      const result = await chatService.uploadFile(mockFile, "room-123");

      expect(result).toBe("https://example.com/file.jpg");
      expect(mockSupabase.storage.from).toHaveBeenCalledWith("chat-files");
    });

    it("should reject files that are too large", async () => {
      chatService = createChatServiceInstance();
      
      const mockFile = createMockFile(
        "large.jpg",
        2 * 1024 * 1024,
        "image/jpeg"
      ); // 2MB

      await expect(
        chatService.uploadFile(mockFile, "room-123")
      ).rejects.toThrow("File size exceeds maximum");
    });

    it("should reject files with invalid types", async () => {
      chatService = createChatServiceInstance();
      
      const mockFile = createMockFile(
        "script.exe",
        1000,
        "application/x-executable"
      );

      await expect(
        chatService.uploadFile(mockFile, "room-123")
      ).rejects.toThrow("File type application/x-executable is not allowed");
    });

    it("should throw error if user not authenticated", async () => {
      chatService = createChatServiceInstance();
      
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
      });

      const mockFile = createMockFile("test.jpg", 1000, "image/jpeg");

      await expect(
        chatService.uploadFile(mockFile, "room-123")
      ).rejects.toThrow("User not authenticated");
    });
  });

  describe("connection management", () => {
    it("should return connection status", () => {
      chatService = createChatServiceInstance();
      
      const status = chatService.getConnectionStatus();

      expect(status).toHaveProperty("isConnected");
      expect(status).toHaveProperty("isReconnecting");
      expect(status).toHaveProperty("lastConnected");
      expect(status).toHaveProperty("reconnectAttempts");
    });

    it("should handle reconnection", async () => {
      chatService = createChatServiceInstance();
      
      // Test that reconnect method exists and can be called
      expect(() => chatService.reconnect()).not.toThrow();
    });
  });

  describe("unsubscribeFromMessages", () => {
    it("should unsubscribe from messages", () => {
      chatService = createChatServiceInstance();
      
      const callbacks = {
        onMessage: vi.fn(),
        onMessageUpdate: vi.fn(),
        onError: vi.fn(),
        onConnectionChange: vi.fn(),
      };

      // First subscribe
      chatService.subscribeToMessages("room-123", callbacks);

      // Then unsubscribe
      expect(() =>
        chatService.unsubscribeFromMessages("room-123")
      ).not.toThrow();
    });
  });

  describe("cleanup", () => {
    it("should cleanup resources on destroy", () => {
      chatService = createChatServiceInstance();
      
      const callbacks = {
        onMessage: vi.fn(),
        onMessageUpdate: vi.fn(),
        onError: vi.fn(),
        onConnectionChange: vi.fn(),
      };

      // Add a subscription first
      chatService.subscribeToMessages("room-123", callbacks);

      // Destroy should not throw
      expect(() => chatService.destroy()).not.toThrow();
    });
  });

  describe("error handling and edge cases", () => {
    it("should handle network errors gracefully", async () => {
      chatService = createChatServiceInstance();
      
      mockSupabase
        .from("chat_rooms")
        .single.mockRejectedValueOnce(new Error("Network error"));

      await expect(
        chatService.getOrCreateChatRoom("appointment-123")
      ).rejects.toThrow("Network error");
    });

    it("should handle empty message content", async () => {
      chatService = createChatServiceInstance();
      
      await expect(
        chatService.sendMessage("room-123", "user-123", "")
      ).rejects.toThrow();
    });

    it("should handle invalid room ID", async () => {
      chatService = createChatServiceInstance();
      
      mockSupabase
        .from("chat_messages")
        .single.mockRejectedValueOnce(new Error("Room not found"));

      await expect(
        chatService.sendMessage("invalid-room", "user-123", "Hello")
      ).rejects.toThrow();
    });

    it("should handle subscription errors", () => {
      chatService = createChatServiceInstance();
      
      const callbacks = {
        onMessage: vi.fn(),
        onMessageUpdate: vi.fn(),
        onError: vi.fn(),
        onConnectionChange: vi.fn(),
      };

      mockSupabase.channel.mockImplementation(() => {
        throw new Error("Subscription failed");
      });

      expect(() => {
        chatService.subscribeToMessages("room-123", callbacks);
      }).toThrow("Subscription failed");
    });

    it("should handle file upload without authentication", async () => {
      chatService = createChatServiceInstance();
      
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
      });

      const mockFile = createMockFile("test.jpg", 1000, "image/jpeg");

      await expect(
        chatService.uploadFile(mockFile, "room-123")
      ).rejects.toThrow("User not authenticated");
    });

    it("should handle storage upload errors", async () => {
      chatService = createChatServiceInstance();
      
      mockSupabase.storage.from().upload.mockResolvedValueOnce({
        data: null,
        error: new Error("Storage error"),
      });

      const mockFile = createMockFile("test.jpg", 1000, "image/jpeg");

      await expect(
        chatService.uploadFile(mockFile, "room-123")
      ).rejects.toThrow();
    });
  });

  describe("message retry logic", () => {
    it("should retry failed messages", async () => {
      chatService = createChatServiceInstance();
      
      // First attempt fails, second succeeds
      mockSupabase
        .from("chat_messages")
        .single.mockRejectedValueOnce(new Error("Temporary error"))
        .mockResolvedValueOnce({
          data: { id: "msg-123" },
          error: null,
        });

      mockSupabase.from("chat_rooms").eq.mockResolvedValue({ error: null });

      const result = await chatService.sendMessage(
        "room-123",
        "user-123",
        "Hello"
      );

      expect(result).toBe(true);
      expect(mockSupabase.from("chat_messages").insert).toHaveBeenCalledTimes(
        2
      );
    });

    it("should fail after max retry attempts", async () => {
      chatService = createChatServiceInstance();
      
      mockSupabase
        .from("chat_messages")
        .single.mockRejectedValue(new Error("Persistent error"));

      await expect(
        chatService.sendMessage("room-123", "user-123", "Hello")
      ).rejects.toThrow("Persistent error");
    });
  });

  describe("connection status management", () => {
    it("should update connection status correctly", () => {
      chatService = createChatServiceInstance();
      
      const initialStatus = chatService.getConnectionStatus();
      expect(initialStatus.isConnected).toBe(false);
      expect(initialStatus.reconnectAttempts).toBe(0);
    });

    it("should handle reconnection attempts", async () => {
      chatService = createChatServiceInstance();
      
      // Simulate connection loss and recovery
      const callbacks = {
        onMessage: vi.fn(),
        onMessageUpdate: vi.fn(),
        onError: vi.fn(),
        onConnectionChange: vi.fn(),
      };

      chatService.subscribeToMessages("room-123", callbacks);

      // Trigger reconnection
      await chatService.reconnect();

      expect(callbacks.onConnectionChange).toHaveBeenCalled();
    });
  });

  describe("file validation", () => {
    it("should validate file types correctly", async () => {
      chatService = createChatServiceInstance();
      
      const invalidFile = createMockFile(
        "script.js",
        1000,
        "application/javascript"
      );

      await expect(
        chatService.uploadFile(invalidFile, "room-123")
      ).rejects.toThrow("File type application/javascript is not allowed");
    });

    it("should validate file sizes correctly", async () => {
      chatService = createChatServiceInstance();
      
      const largeFile = createMockFile(
        "large.jpg",
        2 * 1024 * 1024, // 2MB
        "image/jpeg"
      );

      await expect(
        chatService.uploadFile(largeFile, "room-123")
      ).rejects.toThrow("File size exceeds maximum");
    });

    it("should accept valid files", async () => {
      chatService = createChatServiceInstance();
      
      const validFile = createMockFile("test.jpg", 500000, "image/jpeg");

      const result = await chatService.uploadFile(validFile, "room-123");

      expect(result).toBe("https://example.com/file.jpg");
    });
  });
});
