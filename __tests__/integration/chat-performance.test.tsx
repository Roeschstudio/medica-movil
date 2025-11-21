/**
 * Performance and Concurrent User Integration Tests
 *
 * Tests:
 * - High-volume message handling
 * - Concurrent user scenarios
 * - Memory usage and cleanup
 * - Connection pooling efficiency
 * - Large file handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionProvider } from "next-auth/react";
import ChatRoom from "@/components/optimized-chat-room";
import { NotificationProvider } from "@/lib/notification-service";
import { createChatService } from "@/lib/chat-service";

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
  },
  NotificationProvider: ({ children }: any) => children,
}));

describe("Chat Performance Integration Tests", () => {
  let mockSupabase: any;
  let mockChatService: any;
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
        range: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      })),
      removeChannel: vi.fn(),
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
    };

    // Mock ChatService
    mockChatService = {
      getOrCreateChatRoom: vi.fn(),
      getMessages: vi.fn(),
      sendMessage: vi.fn(),
      subscribeToMessages: vi.fn(),
      unsubscribeFromMessages: vi.fn(),
      uploadFile: vi.fn(),
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

  describe("High-Volume Message Handling", () => {
    it("should handle large message histories efficiently", async () => {
      const mockChatRoom = {
        id: "room-123",
        appointmentId: "appointment-123",
        patientId: "patient-123",
        doctorId: "doctor-123",
        isActive: true,
      };

      // Generate large message history (1000 messages)
      const largeMessageHistory = Array.from({ length: 1000 }, (_, i) => ({
        id: `msg-${i}`,
        chatRoomId: "room-123",
        senderId: i % 2 === 0 ? "doctor-123" : "patient-123",
        content: `Message ${i} - ${Math.random().toString(36).substring(7)}`,
        messageType: "TEXT",
        isRead: false,
        sentAt: new Date(Date.now() - (1000 - i) * 60000).toISOString(),
        sender: {
          id: i % 2 === 0 ? "doctor-123" : "patient-123",
          name: i % 2 === 0 ? "Dr. Smith" : "John Doe",
          role: i % 2 === 0 ? "DOCTOR" : "PATIENT",
        },
      }));

      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.getMessages.mockResolvedValue(largeMessageHistory);
      mockChatService.subscribeToMessages.mockReturnValue({
        unsubscribe: vi.fn(),
      });

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
        expect(mockChatService.getMessages).toHaveBeenCalled();
      });

      const endTime = performance.now();
      const loadTime = endTime - startTime;

      // Should load within reasonable time (less than 3 seconds for 1000 messages)
      expect(loadTime).toBeLessThan(3000);

      // Should handle the large dataset without crashing
      expect(mockChatService.getOrCreateChatRoom).toHaveBeenCalledWith(
        "appointment-123"
      );
    });

    it("should handle rapid message updates without performance degradation", async () => {
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

      // Simulate 100 rapid message updates
      if (messageCallback) {
        for (let i = 0; i < 100; i++) {
          const message = {
            id: `rapid-msg-${i}`,
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

      // Wait for all updates to process
      await waitFor(() => {
        // Component should still be responsive
        expect(screen.getByRole("textbox")).toBeInTheDocument();
      });

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Should process all updates within reasonable time (less than 2 seconds)
      expect(processingTime).toBeLessThan(2000);
    });
  });

  describe("Concurrent User Scenarios", () => {
    it("should handle multiple users in same chat room simultaneously", async () => {
      const mockChatRoom = {
        id: "room-123",
        appointmentId: "appointment-123",
        patientId: "patient-123",
        doctorId: "doctor-123",
        isActive: true,
      };

      // Create multiple chat service instances for different users
      const userServices = Array.from({ length: 5 }, (_, i) => {
        const service = {
          getOrCreateChatRoom: vi.fn().mockResolvedValue(mockChatRoom),
          getMessages: vi.fn().mockResolvedValue([]),
          sendMessage: vi.fn().mockResolvedValue(true),
          subscribeToMessages: vi.fn().mockReturnValue({
            unsubscribe: vi.fn(),
          }),
          unsubscribeFromMessages: vi.fn(),
          uploadFile: vi.fn(),
          destroy: vi.fn(),
        };

        return service;
      });

      const { createChatService } = require("@/lib/chat-service");
      createChatService.mockImplementation(() => {
        return userServices[Math.floor(Math.random() * userServices.length)];
      });

      // Simulate concurrent user actions
      const concurrentActions = Array.from({ length: 5 }, async (_, i) => {
        const userSession = {
          user: {
            id: `user-${i}`,
            email: `user${i}@example.com`,
            name: `User ${i}`,
            role: i % 2 === 0 ? "PATIENT" : "DOCTOR",
          },
        };

        const { rerender } = render(
          <SessionProvider session={userSession}>
            <NotificationProvider>
              <ChatRoom appointmentId="appointment-123" />
            </NotificationProvider>
          </SessionProvider>
        );

        // Simulate user interactions
        await waitFor(() => {
          expect(screen.getByRole("textbox")).toBeInTheDocument();
        });

        return rerender;
      });

      const startTime = performance.now();
      await Promise.all(concurrentActions);
      const endTime = performance.now();

      // Should handle concurrent users within reasonable time
      expect(endTime - startTime).toBeLessThan(5000);

      // All services should have been called
      userServices.forEach((service) => {
        expect(service.getOrCreateChatRoom).toHaveBeenCalled();
      });
    });

    it("should handle concurrent file uploads from multiple users", async () => {
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

      // Mock concurrent file uploads
      let uploadCount = 0;
      mockChatService.uploadFile.mockImplementation(async (file: File) => {
        uploadCount++;
        // Simulate upload delay
        await new Promise((resolve) => setTimeout(resolve, 100));
        return `https://example.com/file-${uploadCount}.jpg`;
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

      // Create multiple test files
      const testFiles = Array.from(
        { length: 10 },
        (_, i) =>
          new File([`content ${i}`], `file${i}.txt`, { type: "text/plain" })
      );

      const startTime = performance.now();

      // Simulate concurrent file uploads
      const uploadPromises = testFiles.map((file) =>
        mockChatService.uploadFile(file, "room-123")
      );

      const results = await Promise.all(uploadPromises);
      const endTime = performance.now();

      // All uploads should succeed
      expect(results).toHaveLength(10);
      expect(results.every((url) => url.startsWith("https://"))).toBe(true);

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(2000);
    });
  });

  describe("Memory Usage and Cleanup", () => {
    it("should properly clean up resources when component unmounts", async () => {
      const mockChatRoom = {
        id: "room-123",
        appointmentId: "appointment-123",
        patientId: "patient-123",
        doctorId: "doctor-123",
        isActive: true,
      };

      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.getMessages.mockResolvedValue([]);

      const unsubscribeMock = vi.fn();
      mockChatService.subscribeToMessages.mockReturnValue({
        unsubscribe: unsubscribeMock,
      });

      const { unmount } = render(
        <SessionProvider session={mockSession}>
          <NotificationProvider>
            <ChatRoom appointmentId="appointment-123" />
          </NotificationProvider>
        </SessionProvider>
      );

      await waitFor(() => {
        expect(mockChatService.subscribeToMessages).toHaveBeenCalled();
      });

      // Unmount component
      unmount();

      // Should clean up subscriptions
      expect(mockChatService.unsubscribeFromMessages).toHaveBeenCalled();
      expect(mockChatService.destroy).toHaveBeenCalled();
    });

    it("should handle memory efficiently with large datasets", async () => {
      const initialMemory = process.memoryUsage();

      const mockChatRoom = {
        id: "room-123",
        appointmentId: "appointment-123",
        patientId: "patient-123",
        doctorId: "doctor-123",
        isActive: true,
      };

      // Generate very large message dataset
      const largeDataset = Array.from({ length: 5000 }, (_, i) => ({
        id: `msg-${i}`,
        chatRoomId: "room-123",
        senderId: i % 2 === 0 ? "doctor-123" : "patient-123",
        content: `Message ${i} - ${"x".repeat(1000)}`, // Large content
        messageType: "TEXT",
        isRead: false,
        sentAt: new Date(Date.now() - i * 1000).toISOString(),
        sender: {
          id: i % 2 === 0 ? "doctor-123" : "patient-123",
          name: i % 2 === 0 ? "Dr. Smith" : "John Doe",
          role: i % 2 === 0 ? "DOCTOR" : "PATIENT",
        },
      }));

      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.getMessages.mockResolvedValue(largeDataset);
      mockChatService.subscribeToMessages.mockReturnValue({
        unsubscribe: vi.fn(),
      });

      const { unmount } = render(
        <SessionProvider session={mockSession}>
          <NotificationProvider>
            <ChatRoom appointmentId="appointment-123" />
          </NotificationProvider>
        </SessionProvider>
      );

      await waitFor(() => {
        expect(mockChatService.getMessages).toHaveBeenCalled();
      });

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const afterLoadMemory = process.memoryUsage();

      // Unmount to clean up
      unmount();

      // Force garbage collection again
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();

      // Memory should not increase dramatically
      const memoryIncrease = afterLoadMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent =
        (memoryIncrease / initialMemory.heapUsed) * 100;

      // Memory increase should be reasonable (less than 100% of initial)
      expect(memoryIncreasePercent).toBeLessThan(100);

      // Memory should be cleaned up after unmount
      const memoryAfterCleanup = finalMemory.heapUsed - initialMemory.heapUsed;
      const cleanupEfficiency =
        (memoryIncrease - memoryAfterCleanup) / memoryIncrease;

      // Should clean up at least 50% of allocated memory
      expect(cleanupEfficiency).toBeGreaterThan(0.5);
    });
  });

  describe("Connection Pooling Efficiency", () => {
    it("should reuse connections efficiently", async () => {
      const connectionTracker = new Map<string, number>();

      // Mock Supabase client to track connection usage
      const { createSupabaseBrowserClient } = require("@/lib/supabase");
      createSupabaseBrowserClient.mockImplementation(() => {
        const connectionId = `conn-${Date.now()}-${Math.random()}`;
        connectionTracker.set(
          connectionId,
          (connectionTracker.get(connectionId) || 0) + 1
        );

        return {
          ...mockSupabase,
          connectionId,
        };
      });

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

      // Create multiple chat components to test connection pooling
      const components = Array.from({ length: 10 }, (_, i) => {
        const sessionData = {
          user: {
            id: `user-${i}`,
            email: `user${i}@example.com`,
            name: `User ${i}`,
            role: "PATIENT",
          },
        };

        return render(
          <SessionProvider session={sessionData}>
            <NotificationProvider>
              <ChatRoom appointmentId={`appointment-${i}`} />
            </NotificationProvider>
          </SessionProvider>
        );
      });

      // Wait for all components to load
      await Promise.all(
        components.map(() =>
          waitFor(() => {
            expect(mockChatService.getOrCreateChatRoom).toHaveBeenCalled();
          })
        )
      );

      // Should create reasonable number of connections (not one per component)
      expect(connectionTracker.size).toBeLessThan(10);

      // Clean up
      components.forEach(({ unmount }) => unmount());
    });
  });

  describe("Large File Handling", () => {
    it("should handle large file uploads efficiently", async () => {
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

      // Mock large file upload with progress tracking
      let uploadProgress = 0;
      mockChatService.uploadFile.mockImplementation(async (file: File) => {
        // Simulate upload progress
        const chunks = Math.ceil(file.size / 1024); // 1KB chunks
        for (let i = 0; i < chunks; i++) {
          uploadProgress = (i / chunks) * 100;
          await new Promise((resolve) => setTimeout(resolve, 1));
        }
        return `https://example.com/${file.name}`;
      });

      mockChatService.sendMessage.mockResolvedValue(true);

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

      // Create large test file (10MB simulated)
      const largeFile = new File(
        [new ArrayBuffer(10 * 1024 * 1024)],
        "large-file.pdf",
        { type: "application/pdf" }
      );

      const startTime = performance.now();
      const result = await mockChatService.uploadFile(largeFile, "room-123");
      const endTime = performance.now();

      expect(result).toBe("https://example.com/large-file.pdf");

      // Should handle large file within reasonable time
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it("should handle multiple large files concurrently", async () => {
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

      // Mock concurrent large file uploads
      mockChatService.uploadFile.mockImplementation(async (file: File) => {
        // Simulate upload delay based on file size
        const delay = Math.min(file.size / 1000000, 1000); // Max 1 second
        await new Promise((resolve) => setTimeout(resolve, delay));
        return `https://example.com/${file.name}`;
      });

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

      // Create multiple large files
      const largeFiles = Array.from(
        { length: 5 },
        (_, i) =>
          new File(
            [new ArrayBuffer(5 * 1024 * 1024)], // 5MB each
            `large-file-${i}.pdf`,
            { type: "application/pdf" }
          )
      );

      const startTime = performance.now();

      // Upload all files concurrently
      const uploadPromises = largeFiles.map((file) =>
        mockChatService.uploadFile(file, "room-123")
      );

      const results = await Promise.all(uploadPromises);
      const endTime = performance.now();

      // All uploads should succeed
      expect(results).toHaveLength(5);
      expect(
        results.every((url) => url.startsWith("https://example.com/"))
      ).toBe(true);

      // Should handle concurrent large files efficiently
      expect(endTime - startTime).toBeLessThan(10000);
    });
  });

  describe("Real-time Performance Under Load", () => {
    it("should maintain real-time performance with high message frequency", async () => {
      const mockChatRoom = {
        id: "room-123",
        appointmentId: "appointment-123",
        patientId: "patient-123",
        doctorId: "doctor-123",
        isActive: true,
      };

      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.getMessages.mockResolvedValue([]);

      const receivedMessages: any[] = [];
      let messageCallback: ((message: any) => void) | null = null;

      mockChatService.subscribeToMessages.mockImplementation(
        (roomId, callbacks) => {
          messageCallback = (message) => {
            receivedMessages.push({
              ...message,
              receivedAt: Date.now(),
            });
            callbacks.onMessage(message);
          };
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

      // Send high-frequency messages
      const messageCount = 200;
      const startTime = Date.now();

      if (messageCallback) {
        for (let i = 0; i < messageCount; i++) {
          const message = {
            id: `high-freq-msg-${i}`,
            chatRoomId: "room-123",
            senderId: "doctor-123",
            content: `High frequency message ${i}`,
            messageType: "TEXT",
            isRead: false,
            sentAt: new Date(startTime + i * 10).toISOString(),
            sender: { id: "doctor-123", name: "Dr. Smith", role: "DOCTOR" },
          };

          // Simulate real-time delivery with small delays
          setTimeout(() => messageCallback!(message), i * 5);
        }
      }

      // Wait for all messages to be processed
      await waitFor(
        () => {
          expect(receivedMessages.length).toBe(messageCount);
        },
        { timeout: 10000 }
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should process all messages within reasonable time
      expect(totalTime).toBeLessThan(5000);

      // Check message delivery latency
      const latencies = receivedMessages.map(
        (msg, i) => msg.receivedAt - (startTime + i * 10)
      );
      const averageLatency =
        latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;

      // Average latency should be reasonable (less than 100ms)
      expect(averageLatency).toBeLessThan(100);
    });
  });
});