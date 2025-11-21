import { beforeEach, describe, expect, it, vi } from "vitest";

// Simple integration test to verify ChatService can be imported and instantiated
describe("ChatService Integration", () => {
  beforeEach(() => {
    // Mock Supabase to prevent actual connections during testing
    vi.mock("@/lib/supabase", () => ({
      createSupabaseBrowserClient: () => ({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "test-user", email: "test@example.com" } },
          }),
        },
        from: vi.fn(() => ({
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
        })),
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
            on: vi.fn().mockReturnThis(),
            subscribe: vi.fn(),
          };
          return mockChannel;
        }),
        removeChannel: vi.fn(),
      }),
    }));
  });

  it("should be able to import and create ChatService", async () => {
    const { ChatService } = await import("@/lib/chat-service");

    expect(ChatService).toBeDefined();

    const chatService = new ChatService({
      maxReconnectAttempts: 3,
      reconnectDelay: 100,
      maxFileSize: 1024 * 1024,
      allowedFileTypes: ["image/*", "application/pdf"],
      messageRetryAttempts: 2,
    });

    expect(chatService).toBeDefined();
    expect(chatService.getConnectionStatus).toBeDefined();
    expect(chatService.getOrCreateChatRoom).toBeDefined();
    expect(chatService.sendMessage).toBeDefined();
    expect(chatService.subscribeToMessages).toBeDefined();
    expect(chatService.uploadFile).toBeDefined();

    // Test connection status
    const status = chatService.getConnectionStatus();
    expect(status).toHaveProperty("isConnected");
    expect(status).toHaveProperty("isReconnecting");
    expect(status).toHaveProperty("lastConnected");
    expect(status).toHaveProperty("reconnectAttempts");

    // Cleanup
    chatService.destroy();
  });

  it("should validate file upload constraints", async () => {
    const { ChatService } = await import("@/lib/chat-service");

    const chatService = new ChatService({
      maxFileSize: 1024, // 1KB for testing
      allowedFileTypes: ["image/jpeg"],
    });

    // Create test files
    const validFile = new File(["test"], "test.jpg", { type: "image/jpeg" });
    Object.defineProperty(validFile, "size", { value: 500 });

    const tooLargeFile = new File(["test"], "large.jpg", {
      type: "image/jpeg",
    });
    Object.defineProperty(tooLargeFile, "size", { value: 2000 });

    const invalidTypeFile = new File(["test"], "test.exe", {
      type: "application/x-executable",
    });
    Object.defineProperty(invalidTypeFile, "size", { value: 500 });

    // Test file size validation
    await expect(
      chatService.uploadFile(tooLargeFile, "room-123")
    ).rejects.toThrow("File size exceeds maximum");

    // Test file type validation
    await expect(
      chatService.uploadFile(invalidTypeFile, "room-123")
    ).rejects.toThrow("File type application/x-executable is not allowed");

    // Cleanup
    chatService.destroy();
  });

  it("should handle subscription management", async () => {
    const { ChatService } = await import("@/lib/chat-service");

    const chatService = new ChatService();

    const callbacks = {
      onMessage: vi.fn(),
      onMessageUpdate: vi.fn(),
      onError: vi.fn(),
      onConnectionChange: vi.fn(),
    };

    // Test subscription
    const channel = chatService.subscribeToMessages("room-123", callbacks);
    expect(channel).toBeDefined();

    // Test unsubscription
    expect(() => chatService.unsubscribeFromMessages("room-123")).not.toThrow();

    // Cleanup
    chatService.destroy();
  });
});
