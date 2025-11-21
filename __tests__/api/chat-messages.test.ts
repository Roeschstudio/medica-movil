/**
 * Test suite for Chat Messages API endpoints
 *
 * Tests:
 * - GET /api/chat/messages - Get messages for a chat room
 * - POST /api/chat/messages - Send a new message
 */

import { GET, POST } from "@/app/api/chat/messages/route";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
const mockSupabaseClient = {
  from: vi.fn(),
};

const mockQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
};

vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: () => mockSupabaseClient,
}));

vi.mock("@/lib/auth-middleware", () => ({
  requireChatRoomAccess: (getChatRoomId: any, handler: any) => handler,
}));

vi.mock("@/lib/rate-limiting", () => ({
  withRateLimit: (limiter: any) => (handler: any) => handler,
  userChatRateLimiter: {},
}));

vi.mock("@/lib/validation", () => ({
  validateQueryParams: vi.fn(),
  validateRequestBody: vi.fn(),
  sanitizeContent: vi.fn((content: string) => content),
  chatMessagesQuerySchema: {},
  chatMessageSchema: {},
  ValidationError: class ValidationError extends Error {
    constructor(message: string, public code: string, public field?: string) {
      super(message);
    }
  },
}));

describe("Chat Messages API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient.from.mockReturnValue(mockQuery);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/chat/messages", () => {
    const mockContext = {
      user: { id: "user-1", role: "PATIENT" },
    };

    it("should return messages for a chat room", async () => {
      const mockMessages = [
        {
          id: "msg-2",
          chatRoomId: "room-1",
          senderId: "user-2",
          content: "Hello there!",
          messageType: "TEXT",
          sentAt: "2024-01-01T10:01:00Z",
          isRead: false,
          sender: {
            id: "user-2",
            name: "Dr. Test",
            role: "DOCTOR",
          },
        },
        {
          id: "msg-1",
          chatRoomId: "room-1",
          senderId: "user-1",
          content: "Hello!",
          messageType: "TEXT",
          sentAt: "2024-01-01T10:00:00Z",
          isRead: true,
          sender: {
            id: "user-1",
            name: "Test Patient",
            role: "PATIENT",
          },
        },
      ];

      mockQuery.select.mockResolvedValue({
        data: mockMessages,
        error: null,
        count: 2,
      });

      const { validateQueryParams } = await import("@/lib/validation");
      vi.mocked(validateQueryParams).mockReturnValue({
        chatRoomId: "room-1",
        page: 1,
        limit: 10,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/chat/messages?chatRoomId=room-1"
      );
      const response = await GET(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.messages).toHaveLength(2);
      // Messages should be reversed to show oldest first
      expect(data.messages[0].id).toBe("msg-1");
      expect(data.messages[1].id).toBe("msg-2");
      expect(data.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        hasMore: false,
      });
    });

    it("should apply message type filter", async () => {
      mockQuery.select.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      const { validateQueryParams } = await import("@/lib/validation");
      vi.mocked(validateQueryParams).mockReturnValue({
        chatRoomId: "room-1",
        page: 1,
        limit: 10,
        messageType: "FILE",
      });

      const request = new NextRequest(
        "http://localhost:3000/api/chat/messages?chatRoomId=room-1&messageType=FILE"
      );
      await GET(request, mockContext);

      expect(mockQuery.eq).toHaveBeenCalledWith("messageType", "FILE");
    });

    it("should apply sender filter", async () => {
      mockQuery.select.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      const { validateQueryParams } = await import("@/lib/validation");
      vi.mocked(validateQueryParams).mockReturnValue({
        chatRoomId: "room-1",
        page: 1,
        limit: 10,
        senderId: "user-2",
      });

      const request = new NextRequest(
        "http://localhost:3000/api/chat/messages?chatRoomId=room-1&senderId=user-2"
      );
      await GET(request, mockContext);

      expect(mockQuery.eq).toHaveBeenCalledWith("senderId", "user-2");
    });

    it("should apply read status filter", async () => {
      mockQuery.select.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      const { validateQueryParams } = await import("@/lib/validation");
      vi.mocked(validateQueryParams).mockReturnValue({
        chatRoomId: "room-1",
        page: 1,
        limit: 10,
        isRead: false,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/chat/messages?chatRoomId=room-1&isRead=false"
      );
      await GET(request, mockContext);

      expect(mockQuery.eq).toHaveBeenCalledWith("isRead", false);
    });

    it("should apply date range filters", async () => {
      mockQuery.select.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      const { validateQueryParams } = await import("@/lib/validation");
      vi.mocked(validateQueryParams).mockReturnValue({
        chatRoomId: "room-1",
        page: 1,
        limit: 10,
        dateFrom: "2024-01-01T00:00:00Z",
        dateTo: "2024-01-02T00:00:00Z",
      });

      const request = new NextRequest(
        "http://localhost:3000/api/chat/messages?chatRoomId=room-1&dateFrom=2024-01-01T00:00:00Z&dateTo=2024-01-02T00:00:00Z"
      );
      await GET(request, mockContext);

      expect(mockQuery.gte).toHaveBeenCalledWith(
        "sentAt",
        "2024-01-01T00:00:00Z"
      );
      expect(mockQuery.lte).toHaveBeenCalledWith(
        "sentAt",
        "2024-01-02T00:00:00Z"
      );
    });

    it("should handle database errors", async () => {
      mockQuery.select.mockResolvedValue({
        data: null,
        error: new Error("Database connection failed"),
        count: null,
      });

      const { validateQueryParams } = await import("@/lib/validation");
      vi.mocked(validateQueryParams).mockReturnValue({
        chatRoomId: "room-1",
        page: 1,
        limit: 10,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/chat/messages?chatRoomId=room-1"
      );
      const response = await GET(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch messages");
      expect(data.code).toBe("FETCH_MESSAGES_ERROR");
    });

    it("should handle validation errors", async () => {
      const { validateQueryParams, ValidationError } = await import(
        "@/lib/validation"
      );
      vi.mocked(validateQueryParams).mockImplementation(() => {
        throw new ValidationError(
          "Invalid chatRoomId",
          "INVALID_CHAT_ROOM_ID",
          "chatRoomId"
        );
      });

      const request = new NextRequest(
        "http://localhost:3000/api/chat/messages?chatRoomId=invalid"
      );
      const response = await GET(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid chatRoomId");
      expect(data.code).toBe("INVALID_CHAT_ROOM_ID");
      expect(data.field).toBe("chatRoomId");
    });
  });

  describe("POST /api/chat/messages", () => {
    const mockContext = {
      user: { id: "user-1", role: "PATIENT" },
    };

    const mockMessageData = {
      chatRoomId: "room-1",
      senderId: "user-1",
      content: "Hello world!",
      messageType: "TEXT",
    };

    it("should send a message successfully", async () => {
      const mockCreatedMessage = {
        id: "msg-1",
        chatRoomId: "room-1",
        senderId: "user-1",
        content: "Hello world!",
        messageType: "TEXT",
        sentAt: "2024-01-01T10:00:00Z",
        isRead: false,
        sender: {
          id: "user-1",
          name: "Test Patient",
          role: "PATIENT",
        },
      };

      // Mock chat room active check
      mockQuery.single.mockResolvedValueOnce({
        data: { isActive: true },
        error: null,
      });

      // Mock message insertion
      mockQuery.single.mockResolvedValueOnce({
        data: mockCreatedMessage,
        error: null,
      });

      // Mock chat room update
      mockQuery.eq.mockResolvedValueOnce({
        error: null,
      });

      const { validateRequestBody, sanitizeContent } = await import(
        "@/lib/validation"
      );
      vi.mocked(validateRequestBody).mockResolvedValue(mockMessageData);
      vi.mocked(sanitizeContent).mockReturnValue("Hello world!");

      const request = new NextRequest(
        "http://localhost:3000/api/chat/messages",
        {
          method: "POST",
          body: JSON.stringify(mockMessageData),
        }
      );

      const response = await POST(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe("msg-1");
      expect(data.content).toBe("Hello world!");
      expect(data.sender.name).toBe("Test Patient");
    });

    it("should sanitize message content", async () => {
      // Mock chat room active check
      mockQuery.single.mockResolvedValueOnce({
        data: { isActive: true },
        error: null,
      });

      // Mock message insertion
      mockQuery.single.mockResolvedValueOnce({
        data: { id: "msg-1", content: "Clean content" },
        error: null,
      });

      // Mock chat room update
      mockQuery.eq.mockResolvedValueOnce({
        error: null,
      });

      const { validateRequestBody, sanitizeContent } = await import(
        "@/lib/validation"
      );
      const maliciousContent = '<script>alert("xss")</script>Hello';
      vi.mocked(validateRequestBody).mockResolvedValue({
        ...mockMessageData,
        content: maliciousContent,
      });
      vi.mocked(sanitizeContent).mockReturnValue("Hello");

      const request = new NextRequest(
        "http://localhost:3000/api/chat/messages",
        {
          method: "POST",
          body: JSON.stringify({
            ...mockMessageData,
            content: maliciousContent,
          }),
        }
      );

      await POST(request, mockContext);

      expect(sanitizeContent).toHaveBeenCalledWith(maliciousContent);
    });

    it("should reject message from different user", async () => {
      const { validateRequestBody } = await import("@/lib/validation");
      vi.mocked(validateRequestBody).mockResolvedValue({
        ...mockMessageData,
        senderId: "other-user",
      });

      const request = new NextRequest(
        "http://localhost:3000/api/chat/messages",
        {
          method: "POST",
          body: JSON.stringify({
            ...mockMessageData,
            senderId: "other-user",
          }),
        }
      );

      const response = await POST(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Cannot send message as another user");
      expect(data.code).toBe("INVALID_SENDER");
    });

    it("should reject message to inactive chat room", async () => {
      // Mock chat room inactive check
      mockQuery.single.mockResolvedValueOnce({
        data: { isActive: false },
        error: null,
      });

      const { validateRequestBody } = await import("@/lib/validation");
      vi.mocked(validateRequestBody).mockResolvedValue(mockMessageData);

      const request = new NextRequest(
        "http://localhost:3000/api/chat/messages",
        {
          method: "POST",
          body: JSON.stringify(mockMessageData),
        }
      );

      const response = await POST(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Cannot send message to inactive chat room");
      expect(data.code).toBe("CHAT_ROOM_INACTIVE");
    });

    it("should handle chat room not found", async () => {
      // Mock chat room not found
      mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: new Error("Not found"),
      });

      const { validateRequestBody } = await import("@/lib/validation");
      vi.mocked(validateRequestBody).mockResolvedValue(mockMessageData);

      const request = new NextRequest(
        "http://localhost:3000/api/chat/messages",
        {
          method: "POST",
          body: JSON.stringify(mockMessageData),
        }
      );

      const response = await POST(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Chat room not found");
      expect(data.code).toBe("CHAT_ROOM_NOT_FOUND");
    });

    it("should handle file message with metadata", async () => {
      const fileMessageData = {
        chatRoomId: "room-1",
        senderId: "user-1",
        content: "Shared a file",
        messageType: "FILE",
        fileUrl: "https://example.com/file.pdf",
        fileName: "document.pdf",
        fileSize: 1024000,
      };

      const mockCreatedMessage = {
        id: "msg-1",
        ...fileMessageData,
        sentAt: "2024-01-01T10:00:00Z",
        isRead: false,
        sender: {
          id: "user-1",
          name: "Test Patient",
          role: "PATIENT",
        },
      };

      // Mock chat room active check
      mockQuery.single.mockResolvedValueOnce({
        data: { isActive: true },
        error: null,
      });

      // Mock message insertion
      mockQuery.single.mockResolvedValueOnce({
        data: mockCreatedMessage,
        error: null,
      });

      // Mock chat room update
      mockQuery.eq.mockResolvedValueOnce({
        error: null,
      });

      const { validateRequestBody } = await import("@/lib/validation");
      vi.mocked(validateRequestBody).mockResolvedValue(fileMessageData);

      const request = new NextRequest(
        "http://localhost:3000/api/chat/messages",
        {
          method: "POST",
          body: JSON.stringify(fileMessageData),
        }
      );

      const response = await POST(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.messageType).toBe("FILE");
      expect(data.fileUrl).toBe("https://example.com/file.pdf");
      expect(data.fileName).toBe("document.pdf");
      expect(data.fileSize).toBe(1024000);
    });

    it("should handle database errors during message creation", async () => {
      // Mock chat room active check
      mockQuery.single.mockResolvedValueOnce({
        data: { isActive: true },
        error: null,
      });

      // Mock message insertion failure
      mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: new Error("Database error"),
      });

      const { validateRequestBody } = await import("@/lib/validation");
      vi.mocked(validateRequestBody).mockResolvedValue(mockMessageData);

      const request = new NextRequest(
        "http://localhost:3000/api/chat/messages",
        {
          method: "POST",
          body: JSON.stringify(mockMessageData),
        }
      );

      const response = await POST(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to send message");
      expect(data.code).toBe("SEND_MESSAGE_ERROR");
    });

    it("should handle validation errors", async () => {
      const { validateRequestBody, ValidationError } = await import(
        "@/lib/validation"
      );
      vi.mocked(validateRequestBody).mockImplementation(() => {
        throw new ValidationError(
          "Missing content",
          "MISSING_CONTENT",
          "content"
        );
      });

      const request = new NextRequest(
        "http://localhost:3000/api/chat/messages",
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      const response = await POST(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Missing content");
      expect(data.code).toBe("MISSING_CONTENT");
      expect(data.field).toBe("content");
    });

    it("should update chat room timestamp after sending message", async () => {
      // Mock chat room active check
      mockQuery.single.mockResolvedValueOnce({
        data: { isActive: true },
        error: null,
      });

      // Mock message insertion
      mockQuery.single.mockResolvedValueOnce({
        data: { id: "msg-1" },
        error: null,
      });

      // Mock chat room update
      const mockUpdate = vi.fn().mockResolvedValue({ error: null });
      mockQuery.eq.mockReturnValue(mockUpdate);

      const { validateRequestBody } = await import("@/lib/validation");
      vi.mocked(validateRequestBody).mockResolvedValue(mockMessageData);

      const request = new NextRequest(
        "http://localhost:3000/api/chat/messages",
        {
          method: "POST",
          body: JSON.stringify(mockMessageData),
        }
      );

      await POST(request, mockContext);

      // Verify chat room updatedAt was updated
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("chat_rooms");
      expect(mockQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          updatedAt: expect.any(String),
        })
      );
      expect(mockQuery.eq).toHaveBeenCalledWith("id", "room-1");
    });
  });
});
