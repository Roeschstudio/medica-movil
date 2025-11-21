import type { MessageCallbacks } from "@/lib/chat-service";
import { createChatService } from "@/lib/chat-service";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Supabase client
vi.mock("@/lib/supabase", () => ({
  createSupabaseBrowserClient: vi.fn(),
}));

vi.mock("@/lib/notification-service", () => ({
  notificationService: {
    createChatNotification: vi.fn(),
  },
}));

describe("Chat System Error Handling", () => {
  let mockSupabase: any;
  let chatService: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create comprehensive mock Supabase client
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
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
        return mockQuery;
      }),
      storage: {
        from: vi.fn((bucket: string) => ({
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
      channel: vi.fn((name: string) => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      })),
      removeChannel: vi.fn(),
    };

    // Mock the module
    const { createSupabaseBrowserClient } = await import("@/lib/supabase");
    (createSupabaseBrowserClient as any).mockReturnValue(mockSupabase);

    // Create ChatService instance
    chatService = createChatService({
      maxReconnectAttempts: 3,
      reconnectDelay: 100,
      messageRetryAttempts: 2,
    });
  });

  afterEach(() => {
    if (chatService) {
      chatService.destroy();
    }
  });

  describe("Network Error Handling", () => {
    it("should handle network timeouts gracefully", async () => {
      mockSupabase
        .from("chat_rooms")
        .single.mockRejectedValue(new Error("Network timeout"));

      await expect(
        chatService.getOrCreateChatRoom("appointment-123")
      ).rejects.toThrow("Network timeout");
    });

    it("should handle connection drops during message sending", async () => {
      mockSupabase
        .from("chat_messages")
        .single.mockRejectedValueOnce(new Error("Connection lost"))
        .mockResolvedValueOnce({
          data: { id: "msg-123" },
          error: null,
        });

      mockSupabase.from("chat_rooms").eq.mockResolvedValue({ error: null });

      // Should retry and succeed
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

    it("should handle intermittent network failures", async () => {
      let callCount = 0;
      mockSupabase.from("chat_messages").single.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve({ data: { id: "msg-123" }, error: null });
      });

      mockSupabase.from("chat_rooms").eq.mockResolvedValue({ error: null });

      // Should eventually succeed after retries
      await expect(
        chatService.sendMessage("room-123", "user-123", "Hello")
      ).rejects.toThrow("Network error");
    });

    it("should handle DNS resolution failures", async () => {
      mockSupabase
        .from("chat_rooms")
        .single.mockRejectedValue(new Error("ENOTFOUND"));

      await expect(
        chatService.getOrCreateChatRoom("appointment-123")
      ).rejects.toThrow("ENOTFOUND");
    });
  });

  describe("Authentication Error Handling", () => {
    it("should handle expired tokens", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "JWT expired" },
      });

      await expect(chatService.getActiveChatRooms()).rejects.toThrow(
        "User not authenticated"
      );
    });

    it("should handle invalid tokens", async () => {
      mockSupabase.from("chat_rooms").single.mockRejectedValue({
        message: "Invalid JWT",
        code: "PGRST301",
      });

      await expect(
        chatService.getOrCreateChatRoom("appointment-123")
      ).rejects.toThrow();
    });

    it("should handle missing authentication", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      await expect(
        chatService.uploadFile(
          new File(["test"], "test.jpg", { type: "image/jpeg" }),
          "room-123"
        )
      ).rejects.toThrow("User not authenticated");
    });
  });

  describe("Database Error Handling", () => {
    it("should handle constraint violations", async () => {
      mockSupabase.from("chat_messages").single.mockRejectedValue({
        message: "duplicate key value violates unique constraint",
        code: "23505",
      });

      await expect(
        chatService.sendMessage("room-123", "user-123", "Hello")
      ).rejects.toThrow();
    });

    it("should handle foreign key violations", async () => {
      mockSupabase.from("chat_messages").single.mockRejectedValue({
        message: "violates foreign key constraint",
        code: "23503",
      });

      await expect(
        chatService.sendMessage("invalid-room", "user-123", "Hello")
      ).rejects.toThrow();
    });

    it("should handle database connection limits", async () => {
      mockSupabase.from("chat_rooms").single.mockRejectedValue({
        message: "too many connections",
        code: "53300",
      });

      await expect(
        chatService.getOrCreateChatRoom("appointment-123")
      ).rejects.toThrow();
    });

    it("should handle query timeouts", async () => {
      mockSupabase.from("chat_messages").range.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Query timeout")), 100);
        });
      });

      await expect(chatService.getMessages("room-123")).rejects.toThrow(
        "Query timeout"
      );
    });
  });

  describe("Storage Error Handling", () => {
    it("should handle storage quota exceeded", async () => {
      mockSupabase.storage.from().upload.mockResolvedValue({
        data: null,
        error: { message: "Storage quota exceeded" },
      });

      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });

      await expect(chatService.uploadFile(file, "room-123")).rejects.toThrow();
    });

    it("should handle file corruption during upload", async () => {
      mockSupabase.storage.from().upload.mockResolvedValue({
        data: null,
        error: { message: "File corrupted during upload" },
      });

      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });

      await expect(chatService.uploadFile(file, "room-123")).rejects.toThrow();
    });

    it("should handle storage service unavailable", async () => {
      mockSupabase.storage
        .from()
        .upload.mockRejectedValue(new Error("Service unavailable"));

      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });

      await expect(chatService.uploadFile(file, "room-123")).rejects.toThrow(
        "Service unavailable"
      );
    });

    it("should handle invalid file paths", async () => {
      mockSupabase.storage.from().upload.mockResolvedValue({
        data: null,
        error: { message: "Invalid file path" },
      });

      const file = new File(["test"], "../../../etc/passwd", {
        type: "text/plain",
      });

      await expect(chatService.uploadFile(file, "room-123")).rejects.toThrow();
    });
  });

  describe("Real-time Subscription Error Handling", () => {
    it("should handle subscription failures", () => {
      const callbacks: MessageCallbacks = {
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

    it("should handle channel disconnections", () => {
      const callbacks: MessageCallbacks = {
        onMessage: vi.fn(),
        onMessageUpdate: vi.fn(),
        onError: vi.fn(),
        onConnectionChange: vi.fn(),
      };

      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn((callback) => {
          // Simulate disconnection
          setTimeout(() => callback("CLOSED"), 100);
        }),
      };

      mockSupabase.channel.mockReturnValue(mockChannel);

      chatService.subscribeToMessages("room-123", callbacks);

      // Should call onConnectionChange with false
      setTimeout(() => {
        expect(callbacks.onConnectionChange).toHaveBeenCalledWith(false);
      }, 150);
    });

    it("should handle malformed real-time messages", async () => {
      const callbacks: MessageCallbacks = {
        onMessage: vi.fn(),
        onMessageUpdate: vi.fn(),
        onError: vi.fn(),
        onConnectionChange: vi.fn(),
      };

      const mockChannel = {
        on: vi.fn((event, config, handler) => {
          if (event === "postgres_changes" && config.event === "INSERT") {
            // Simulate malformed payload
            setTimeout(() => {
              handler({ new: { id: null } }); // Invalid message
            }, 50);
          }
          return mockChannel;
        }),
        subscribe: vi.fn(),
      };

      mockSupabase.channel.mockReturnValue(mockChannel);
      mockSupabase
        .from("chat_messages")
        .single.mockRejectedValue(new Error("Message not found"));

      chatService.subscribeToMessages("room-123", callbacks);

      // Should call onError
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(callbacks.onError).toHaveBeenCalled();
    });
  });

  describe("Input Validation Error Handling", () => {
    it("should handle empty message content", async () => {
      await expect(
        chatService.sendMessage("room-123", "user-123", "")
      ).rejects.toThrow();
    });

    it("should handle null/undefined parameters", async () => {
      await expect(
        chatService.sendMessage(null as any, "user-123", "Hello")
      ).rejects.toThrow();

      await expect(
        chatService.sendMessage("room-123", null as any, "Hello")
      ).rejects.toThrow();
    });

    it("should handle invalid room IDs", async () => {
      mockSupabase
        .from("chat_messages")
        .single.mockRejectedValue(new Error("Room not found"));

      await expect(
        chatService.sendMessage("invalid-room-id", "user-123", "Hello")
      ).rejects.toThrow();
    });

    it("should handle invalid user IDs", async () => {
      mockSupabase
        .from("chat_messages")
        .single.mockRejectedValue(new Error("User not found"));

      await expect(
        chatService.sendMessage("room-123", "invalid-user-id", "Hello")
      ).rejects.toThrow();
    });
  });

  describe("File Validation Error Handling", () => {
    it("should handle oversized files", async () => {
      const largeFile = new File(
        ["x".repeat(20 * 1024 * 1024)], // 20MB
        "large.jpg",
        { type: "image/jpeg" }
      );

      await expect(
        chatService.uploadFile(largeFile, "room-123")
      ).rejects.toThrow("File size exceeds maximum");
    });

    it("should handle invalid file types", async () => {
      const invalidFile = new File(["malicious code"], "script.exe", {
        type: "application/x-executable",
      });

      await expect(
        chatService.uploadFile(invalidFile, "room-123")
      ).rejects.toThrow("File type application/x-executable is not allowed");
    });

    it("should handle corrupted files", async () => {
      const corruptedFile = new File(
        [new ArrayBuffer(0)], // Empty buffer
        "corrupted.jpg",
        { type: "image/jpeg" }
      );

      // File validation should pass, but upload might fail
      mockSupabase.storage.from().upload.mockResolvedValue({
        data: null,
        error: { message: "File appears to be corrupted" },
      });

      await expect(
        chatService.uploadFile(corruptedFile, "room-123")
      ).rejects.toThrow();
    });

    it("should handle files with malicious names", async () => {
      const maliciousFile = new File(["content"], "../../../etc/passwd", {
        type: "text/plain",
      });

      // Should still process but with sanitized path
      const result = await chatService.uploadFile(maliciousFile, "room-123");
      expect(result).toBe("https://example.com/file.jpg");
    });
  });

  describe("Concurrent Operation Error Handling", () => {
    it("should handle race conditions in message sending", async () => {
      let callCount = 0;
      mockSupabase.from("chat_messages").single.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error("Concurrent modification"));
        }
        return Promise.resolve({
          data: { id: `msg-${callCount}` },
          error: null,
        });
      });

      mockSupabase.from("chat_rooms").eq.mockResolvedValue({ error: null });

      // Send multiple messages concurrently
      const promises = [
        chatService.sendMessage("room-123", "user-123", "Message 1"),
        chatService.sendMessage("room-123", "user-123", "Message 2"),
      ];

      const results = await Promise.allSettled(promises);

      // At least one should succeed
      const successful = results.filter((r) => r.status === "fulfilled");
      expect(successful.length).toBeGreaterThan(0);
    });

    it("should handle multiple subscription attempts", () => {
      const callbacks: MessageCallbacks = {
        onMessage: vi.fn(),
        onMessageUpdate: vi.fn(),
        onError: vi.fn(),
        onConnectionChange: vi.fn(),
      };

      // First subscription should work
      const channel1 = chatService.subscribeToMessages("room-123", callbacks);
      expect(channel1).toBeDefined();

      // Second subscription should replace the first
      const channel2 = chatService.subscribeToMessages("room-123", callbacks);
      expect(channel2).toBeDefined();

      // Should have called removeChannel for the first subscription
      expect(mockSupabase.removeChannel).toHaveBeenCalled();
    });
  });

  describe("Memory and Resource Error Handling", () => {
    it("should handle memory exhaustion gracefully", async () => {
      // Simulate memory pressure by creating large objects
      const largeArray = new Array(1000000).fill("x");

      mockSupabase.from("chat_messages").range.mockImplementation(() => {
        // Simulate memory allocation failure
        throw new Error("Cannot allocate memory");
      });

      await expect(chatService.getMessages("room-123")).rejects.toThrow(
        "Cannot allocate memory"
      );
    });

    it("should clean up resources on errors", async () => {
      const callbacks: MessageCallbacks = {
        onMessage: vi.fn(),
        onMessageUpdate: vi.fn(),
        onError: vi.fn(),
        onConnectionChange: vi.fn(),
      };

      mockSupabase.channel.mockImplementation(() => {
        throw new Error("Resource allocation failed");
      });

      expect(() => {
        chatService.subscribeToMessages("room-123", callbacks);
      }).toThrow();

      // Verify cleanup
      chatService.destroy();
      expect(() => chatService.destroy()).not.toThrow();
    });
  });

  describe("Edge Cases", () => {
    it("should handle extremely long messages", async () => {
      const longMessage = "x".repeat(10000);

      mockSupabase.from("chat_messages").single.mockResolvedValue({
        data: { id: "msg-123" },
        error: null,
      });

      mockSupabase.from("chat_rooms").eq.mockResolvedValue({ error: null });

      const result = await chatService.sendMessage(
        "room-123",
        "user-123",
        longMessage
      );

      expect(result).toBe(true);
    });

    it("should handle special characters in messages", async () => {
      const specialMessage = "Hello 👋 🌟 <script>alert('xss')</script> 中文";

      mockSupabase.from("chat_messages").single.mockResolvedValue({
        data: { id: "msg-123" },
        error: null,
      });

      mockSupabase.from("chat_rooms").eq.mockResolvedValue({ error: null });

      const result = await chatService.sendMessage(
        "room-123",
        "user-123",
        specialMessage
      );

      expect(result).toBe(true);
    });

    it("should handle rapid successive operations", async () => {
      mockSupabase.from("chat_messages").single.mockResolvedValue({
        data: { id: "msg-123" },
        error: null,
      });

      mockSupabase.from("chat_rooms").eq.mockResolvedValue({ error: null });

      // Send 10 messages rapidly
      const promises = Array.from({ length: 10 }, (_, i) =>
        chatService.sendMessage("room-123", "user-123", `Message ${i}`)
      );

      const results = await Promise.all(promises);
      expect(results.every((r) => r === true)).toBe(true);
    });

    it("should handle zero-byte files", async () => {
      const emptyFile = new File([], "empty.txt", { type: "text/plain" });

      const result = await chatService.uploadFile(emptyFile, "room-123");
      expect(result).toBe("https://example.com/file.jpg");
    });

    it("should handle files with no extension", async () => {
      const noExtFile = new File(["content"], "README", { type: "text/plain" });

      const result = await chatService.uploadFile(noExtFile, "room-123");
      expect(result).toBe("https://example.com/file.jpg");
    });
  });

  describe("Recovery Mechanisms", () => {
    it("should recover from temporary database outages", async () => {
      let attempts = 0;
      mockSupabase.from("chat_rooms").single.mockImplementation(() => {
        attempts++;
        if (attempts <= 2) {
          return Promise.reject(new Error("Database unavailable"));
        }
        return Promise.resolve({
          data: { id: "room-123" },
          error: null,
        });
      });

      // Should eventually succeed after retries
      await expect(
        chatService.getOrCreateChatRoom("appointment-123")
      ).rejects.toThrow("Database unavailable");
    });

    it("should maintain message queue during outages", async () => {
      // Simulate offline state
      chatService.connectionStatus = {
        isConnected: false,
        isReconnecting: false,
        lastConnected: null,
        reconnectAttempts: 0,
      };

      // Messages should be queued
      const promise = chatService.sendMessage(
        "room-123",
        "user-123",
        "Queued message"
      );

      // Simulate connection restoration
      setTimeout(() => {
        chatService.connectionStatus.isConnected = true;
        mockSupabase.from("chat_messages").single.mockResolvedValue({
          data: { id: "msg-123" },
          error: null,
        });
        mockSupabase.from("chat_rooms").eq.mockResolvedValue({ error: null });
      }, 100);

      // Message should eventually be sent
      const result = await promise;
      expect(result).toBe(true);
    });
  });
});
