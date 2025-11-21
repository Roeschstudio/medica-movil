/**
 * Performance and concurrent usage tests for Chat API
 *
 * Tests:
 * - Concurrent message sending
 * - High-frequency message delivery
 * - Database connection pooling under load
 * - Rate limiting behavior
 * - Memory usage during heavy chat activity
 */

import {
  GET as getMessages,
  POST as sendMessage,
} from "@/app/api/chat/messages/route";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
const mockSupabaseClient = {
  from: vi.fn(),
};

const mockQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
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
  withRateLimit: (limiter: any) => (handler: any) => {
    // Mock rate limiter that tracks calls
    return async (...args: any[]) => {
      mockRateLimiter.calls.push(Date.now());
      if (mockRateLimiter.shouldLimit) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
        });
      }
      return handler(...args);
    };
  },
  userChatRateLimiter: {},
}));

vi.mock("@/lib/validation", () => ({
  validateQueryParams: vi.fn(),
  validateRequestBody: vi.fn(),
  sanitizeContent: vi.fn((content: string) => content),
  chatMessagesQuerySchema: {},
  chatMessageSchema: {},
}));

const mockRateLimiter = {
  calls: [] as number[],
  shouldLimit: false,
  reset() {
    this.calls = [];
    this.shouldLimit = false;
  },
};

describe("Chat API Performance Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient.from.mockReturnValue(mockQuery);
    mockRateLimiter.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Concurrent Message Sending", () => {
    const mockContext = {
      user: { id: "user-1", role: "PATIENT" },
    };

    it("should handle multiple concurrent message sends", async () => {
      // Mock successful responses for all requests
      mockQuery.single.mockResolvedValue({
        data: { isActive: true },
        error: null,
      });

      let messageCounter = 0;
      mockQuery.single.mockImplementation(() => {
        messageCounter++;
        return Promise.resolve({
          data: {
            id: `msg-${messageCounter}`,
            content: `Message ${messageCounter}`,
            sentAt: new Date().toISOString(),
          },
          error: null,
        });
      });

      mockQuery.eq.mockResolvedValue({ error: null });

      const { validateRequestBody } = await import("@/lib/validation");
      vi.mocked(validateRequestBody).mockImplementation(async () => ({
        chatRoomId: "room-1",
        senderId: "user-1",
        content: `Concurrent message ${Math.random()}`,
        messageType: "TEXT",
      }));

      // Send 10 concurrent messages
      const concurrentRequests = Array.from({ length: 10 }, (_, i) => {
        const request = new NextRequest(
          "http://localhost:3000/api/chat/messages",
          {
            method: "POST",
            body: JSON.stringify({
              chatRoomId: "room-1",
              senderId: "user-1",
              content: `Concurrent message ${i}`,
              messageType: "TEXT",
            }),
          }
        );
        return sendMessage(request, mockContext);
      });

      const startTime = Date.now();
      const responses = await Promise.all(concurrentRequests);
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(201);
      });

      // Should complete within reasonable time (less than 2 seconds)
      expect(endTime - startTime).toBeLessThan(2000);

      // Verify all messages were processed
      expect(messageCounter).toBe(20); // 10 for room check + 10 for message creation
    });

    it("should handle concurrent requests from different users", async () => {
      const users = [
        { id: "user-1", role: "PATIENT" },
        { id: "user-2", role: "DOCTOR" },
        { id: "user-3", role: "PATIENT" },
      ];

      mockQuery.single.mockResolvedValue({
        data: { isActive: true },
        error: null,
      });

      let messageCounter = 0;
      mockQuery.single.mockImplementation(() => {
        messageCounter++;
        return Promise.resolve({
          data: {
            id: `msg-${messageCounter}`,
            content: `Message ${messageCounter}`,
            sentAt: new Date().toISOString(),
          },
          error: null,
        });
      });

      mockQuery.eq.mockResolvedValue({ error: null });

      const { validateRequestBody } = await import("@/lib/validation");

      // Create concurrent requests from different users
      const concurrentRequests = users.flatMap((user) =>
        Array.from({ length: 5 }, (_, i) => {
          vi.mocked(validateRequestBody).mockResolvedValueOnce({
            chatRoomId: "room-1",
            senderId: user.id,
            content: `Message from ${user.id} - ${i}`,
            messageType: "TEXT",
          });

          const request = new NextRequest(
            "http://localhost:3000/api/chat/messages",
            {
              method: "POST",
              body: JSON.stringify({
                chatRoomId: "room-1",
                senderId: user.id,
                content: `Message from ${user.id} - ${i}`,
                messageType: "TEXT",
              }),
            }
          );
          return sendMessage(request, { user });
        })
      );

      const responses = await Promise.all(concurrentRequests);

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(201);
      });

      // Verify correct number of database operations
      expect(messageCounter).toBe(30); // 15 for room checks + 15 for message creation
    });
  });

  describe("High-Frequency Message Retrieval", () => {
    const mockContext = {
      user: { id: "user-1", role: "PATIENT" },
    };

    it("should handle rapid message fetching requests", async () => {
      const mockMessages = Array.from({ length: 50 }, (_, i) => ({
        id: `msg-${i}`,
        content: `Message ${i}`,
        sentAt: new Date(Date.now() - i * 1000).toISOString(),
        sender: { id: "user-1", name: "Test User", role: "PATIENT" },
      }));

      mockQuery.select.mockResolvedValue({
        data: mockMessages,
        error: null,
        count: 50,
      });

      const { validateQueryParams } = await import("@/lib/validation");
      vi.mocked(validateQueryParams).mockReturnValue({
        chatRoomId: "room-1",
        page: 1,
        limit: 50,
      });

      // Make 20 rapid requests
      const rapidRequests = Array.from({ length: 20 }, () => {
        const request = new NextRequest(
          "http://localhost:3000/api/chat/messages?chatRoomId=room-1&limit=50"
        );
        return getMessages(request, mockContext);
      });

      const startTime = Date.now();
      const responses = await Promise.all(rapidRequests);
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(3000);

      // Verify response consistency
      const firstResponseData = await responses[0].json();
      for (let i = 1; i < responses.length; i++) {
        const responseData = await responses[i].json();
        expect(responseData.messages.length).toBe(
          firstResponseData.messages.length
        );
      }
    });

    it("should handle pagination under load", async () => {
      const mockMessages = Array.from({ length: 10 }, (_, i) => ({
        id: `msg-${i}`,
        content: `Message ${i}`,
        sentAt: new Date(Date.now() - i * 1000).toISOString(),
        sender: { id: "user-1", name: "Test User", role: "PATIENT" },
      }));

      mockQuery.select.mockResolvedValue({
        data: mockMessages,
        error: null,
        count: 100,
      });

      const { validateQueryParams } = await import("@/lib/validation");

      // Create requests for different pages
      const paginationRequests = Array.from({ length: 10 }, (_, page) => {
        vi.mocked(validateQueryParams).mockReturnValueOnce({
          chatRoomId: "room-1",
          page: page + 1,
          limit: 10,
        });

        const request = new NextRequest(
          `http://localhost:3000/api/chat/messages?chatRoomId=room-1&page=${
            page + 1
          }&limit=10`
        );
        return getMessages(request, mockContext);
      });

      const responses = await Promise.all(paginationRequests);

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // Verify pagination data
      for (let i = 0; i < responses.length; i++) {
        const data = await responses[i].json();
        expect(data.pagination.page).toBe(i + 1);
        expect(data.pagination.limit).toBe(10);
        expect(data.pagination.total).toBe(100);
      }
    });
  });

  describe("Rate Limiting Behavior", () => {
    const mockContext = {
      user: { id: "user-1", role: "PATIENT" },
    };

    it("should enforce rate limits under heavy load", async () => {
      mockQuery.single.mockResolvedValue({
        data: { isActive: true },
        error: null,
      });

      mockQuery.single.mockResolvedValue({
        data: { id: "msg-1", content: "Test" },
        error: null,
      });

      mockQuery.eq.mockResolvedValue({ error: null });

      const { validateRequestBody } = await import("@/lib/validation");
      vi.mocked(validateRequestBody).mockResolvedValue({
        chatRoomId: "room-1",
        senderId: "user-1",
        content: "Test message",
        messageType: "TEXT",
      });

      // Enable rate limiting after 5 requests
      let requestCount = 0;
      const originalWithRateLimit = (await import("@/lib/rate-limiting"))
        .withRateLimit;
      vi.mocked(originalWithRateLimit).mockImplementation(
        (limiter: any) => (handler: any) => {
          return async (...args: any[]) => {
            requestCount++;
            if (requestCount > 5) {
              return new Response(
                JSON.stringify({ error: "Rate limit exceeded" }),
                { status: 429 }
              );
            }
            return handler(...args);
          };
        }
      );

      // Send 10 requests rapidly
      const rapidRequests = Array.from({ length: 10 }, () => {
        const request = new NextRequest(
          "http://localhost:3000/api/chat/messages",
          {
            method: "POST",
            body: JSON.stringify({
              chatRoomId: "room-1",
              senderId: "user-1",
              content: "Test message",
              messageType: "TEXT",
            }),
          }
        );
        return sendMessage(request, mockContext);
      });

      const responses = await Promise.all(rapidRequests);

      // First 5 should succeed, rest should be rate limited
      const successfulResponses = responses.filter((r) => r.status === 201);
      const rateLimitedResponses = responses.filter((r) => r.status === 429);

      expect(successfulResponses.length).toBe(5);
      expect(rateLimitedResponses.length).toBe(5);
    });

    it("should track rate limit windows correctly", async () => {
      vi.useFakeTimers();

      mockRateLimiter.shouldLimit = false;
      let callCount = 0;

      const { validateRequestBody } = await import("@/lib/validation");
      vi.mocked(validateRequestBody).mockResolvedValue({
        chatRoomId: "room-1",
        senderId: "user-1",
        content: "Test message",
        messageType: "TEXT",
      });

      mockQuery.single.mockResolvedValue({
        data: { isActive: true },
        error: null,
      });

      mockQuery.single.mockResolvedValue({
        data: { id: "msg-1" },
        error: null,
      });

      mockQuery.eq.mockResolvedValue({ error: null });

      // Send requests in first window
      for (let i = 0; i < 3; i++) {
        const request = new NextRequest(
          "http://localhost:3000/api/chat/messages",
          {
            method: "POST",
            body: JSON.stringify({
              chatRoomId: "room-1",
              senderId: "user-1",
              content: `Message ${i}`,
              messageType: "TEXT",
            }),
          }
        );
        await sendMessage(request, mockContext);
        callCount++;
      }

      expect(mockRateLimiter.calls.length).toBe(3);

      // Advance time to next window
      vi.advanceTimersByTime(60000); // 1 minute

      // Send more requests in new window
      for (let i = 0; i < 2; i++) {
        const request = new NextRequest(
          "http://localhost:3000/api/chat/messages",
          {
            method: "POST",
            body: JSON.stringify({
              chatRoomId: "room-1",
              senderId: "user-1",
              content: `Message ${i + 3}`,
              messageType: "TEXT",
            }),
          }
        );
        await sendMessage(request, mockContext);
        callCount++;
      }

      expect(mockRateLimiter.calls.length).toBe(5);

      vi.useRealTimers();
    });
  });

  describe("Database Connection Pooling", () => {
    it("should handle multiple simultaneous database connections", async () => {
      const connectionCounts = new Map<string, number>();

      // Mock Supabase client creation to track connections
      const originalCreateClient = mockSupabaseClient;
      vi.mocked(mockSupabaseClient).from.mockImplementation((table: string) => {
        const connectionId = `conn-${Math.random()}`;
        connectionCounts.set(
          connectionId,
          (connectionCounts.get(connectionId) || 0) + 1
        );
        return mockQuery;
      });

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
      });

      const mockContext = {
        user: { id: "user-1", role: "PATIENT" },
      };

      // Create 50 simultaneous requests to test connection pooling
      const simultaneousRequests = Array.from({ length: 50 }, () => {
        const request = new NextRequest(
          "http://localhost:3000/api/chat/messages?chatRoomId=room-1"
        );
        return getMessages(request, mockContext);
      });

      const startTime = Date.now();
      const responses = await Promise.all(simultaneousRequests);
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // Should complete within reasonable time even with many connections
      expect(endTime - startTime).toBeLessThan(5000);

      // Verify database was accessed for each request
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(50);
    });
  });

  describe("Memory Usage Under Load", () => {
    it("should not leak memory during heavy chat activity", async () => {
      const initialMemory = process.memoryUsage();

      mockQuery.select.mockResolvedValue({
        data: Array.from({ length: 100 }, (_, i) => ({
          id: `msg-${i}`,
          content: `Message ${i}`,
          sentAt: new Date().toISOString(),
        })),
        error: null,
        count: 100,
      });

      const { validateQueryParams } = await import("@/lib/validation");
      vi.mocked(validateQueryParams).mockReturnValue({
        chatRoomId: "room-1",
        page: 1,
        limit: 100,
      });

      const mockContext = {
        user: { id: "user-1", role: "PATIENT" },
      };

      // Simulate heavy chat activity
      for (let batch = 0; batch < 10; batch++) {
        const batchRequests = Array.from({ length: 20 }, () => {
          const request = new NextRequest(
            "http://localhost:3000/api/chat/messages?chatRoomId=room-1&limit=100"
          );
          return getMessages(request, mockContext);
        });

        const responses = await Promise.all(batchRequests);

        // Verify all requests succeeded
        responses.forEach((response) => {
          expect(response.status).toBe(200);
        });

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();

      // Memory usage should not increase dramatically (allow for some variance)
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent =
        (memoryIncrease / initialMemory.heapUsed) * 100;

      // Memory increase should be less than 50% of initial usage
      expect(memoryIncreasePercent).toBeLessThan(50);
    });
  });

  describe("Error Recovery Under Load", () => {
    const mockContext = {
      user: { id: "user-1", role: "PATIENT" },
    };

    it("should handle partial failures gracefully", async () => {
      let requestCount = 0;

      // Mock intermittent failures
      mockQuery.select.mockImplementation(() => {
        requestCount++;
        if (requestCount % 3 === 0) {
          return Promise.resolve({
            data: null,
            error: new Error("Temporary database error"),
            count: null,
          });
        }
        return Promise.resolve({
          data: [{ id: "msg-1", content: "Test" }],
          error: null,
          count: 1,
        });
      });

      const { validateQueryParams } = await import("@/lib/validation");
      vi.mocked(validateQueryParams).mockReturnValue({
        chatRoomId: "room-1",
        page: 1,
        limit: 10,
      });

      // Send 15 requests (every 3rd will fail)
      const requests = Array.from({ length: 15 }, () => {
        const request = new NextRequest(
          "http://localhost:3000/api/chat/messages?chatRoomId=room-1"
        );
        return getMessages(request, mockContext);
      });

      const responses = await Promise.all(requests);

      const successfulResponses = responses.filter((r) => r.status === 200);
      const failedResponses = responses.filter((r) => r.status === 500);

      // Should have 10 successful and 5 failed responses
      expect(successfulResponses.length).toBe(10);
      expect(failedResponses.length).toBe(5);

      // Failed responses should have proper error messages
      for (const failedResponse of failedResponses) {
        const data = await failedResponse.json();
        expect(data.error).toBe("Failed to fetch messages");
        expect(data.code).toBe("FETCH_MESSAGES_ERROR");
      }
    });
  });
});
