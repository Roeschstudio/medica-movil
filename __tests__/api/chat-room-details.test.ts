/**
 * Test suite for Chat Room Details API endpoints
 *
 * Tests:
 * - GET /api/chat/[roomId] - Get specific chat room details
 * - PATCH /api/chat/[roomId] - Update chat room status
 * - DELETE /api/chat/[roomId] - Delete chat room
 */

import { DELETE, GET, PATCH } from "@/app/api/chat/[roomId]/route";
import { NextRequest } from "next/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies - moved to factory functions to avoid hoisting issues
vi.mock("@/lib/db", () => ({
  prisma: {
    chatRoom: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    chatMessage: {
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(() => Promise.resolve({
    user: {
      id: "user-1",
      role: "PATIENT",
    },
  })),
}));

vi.mock("@/lib/unified-auth", () => ({
  authOptions: {},
}));

// Mock session data
const mockSession = {
  user: {
    id: "user-1",
    role: "PATIENT",
  },
};

// Get mocked prisma instance
let mockPrisma: any;
beforeAll(async () => {
  const { prisma } = await import("@/lib/db");
  mockPrisma = vi.mocked(prisma);
});

describe("Chat Room Details API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/chat/[roomId]", () => {
    const mockChatRoom = {
      id: "room-1",
      appointmentId: "apt-1",
      patientId: "user-1",
      doctorId: "doctor-1",
      isActive: true,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
      appointment: {
        id: "apt-1",
        scheduledAt: new Date("2024-01-02T10:00:00Z"),
        type: "CONSULTATION",
        status: "CONFIRMED",
        patient: {
          id: "user-1",
          name: "Test Patient",
          email: "patient@test.com",
          role: "PATIENT",
        },
        doctor: {
          id: "doctor-1",
          user: {
            id: "doctor-1",
            name: "Dr. Test",
            email: "doctor@test.com",
            role: "DOCTOR",
          },
        },
      },
      messages: [
        {
          id: "msg-1",
          content: "Hello!",
          sentAt: new Date("2024-01-01T10:00:00Z"),
          sender: {
            id: "user-1",
            name: "Test Patient",
            email: "patient@test.com",
            role: "PATIENT",
          },
        },
      ],
      _count: {
        messages: 5,
        videoSessions: 1,
      },
    };

    it("should return chat room details for authorized user", async () => {
      mockPrisma.chatRoom.findFirst.mockResolvedValue(mockChatRoom);
      mockPrisma.chatMessage.count.mockResolvedValue(2);

      const request = new NextRequest("http://localhost:3000/api/chat/room-1");
      const response = await GET(request, { params: { roomId: "room-1" } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe("room-1");
      expect(data.appointment.patient.name).toBe("Test Patient");
      expect(data.messages).toHaveLength(1);
      expect(data._count.messages).toBe(5);
      expect(data.unreadCount).toBe(2);

      expect(mockPrisma.chatRoom.findFirst).toHaveBeenCalledWith({
        where: {
          id: "room-1",
          OR: [{ patientId: "user-1" }, { doctorId: "user-1" }],
        },
        include: expect.objectContaining({
          appointment: expect.any(Object),
          messages: expect.any(Object),
          _count: expect.any(Object),
        }),
      });

      expect(mockPrisma.chatMessage.count).toHaveBeenCalledWith({
        where: {
          chatRoomId: "room-1",
          senderId: { not: "user-1" },
          isRead: false,
        },
      });
    });

    it("should return 404 for non-existent chat room", async () => {
      mockPrisma.chatRoom.findFirst.mockResolvedValue(null);

      const request = new NextRequest(
        "http://localhost:3000/api/chat/nonexistent"
      );
      const response = await GET(request, {
        params: { roomId: "nonexistent" },
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Chat room not found or access denied");
    });

    it("should return 401 for unauthenticated user", async () => {
      const { getServerSession } = await import("next-auth");
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new NextRequest("http://localhost:3000/api/chat/room-1");
      const response = await GET(request, { params: { roomId: "room-1" } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should handle database errors", async () => {
      mockPrisma.chatRoom.findFirst.mockRejectedValue(
        new Error("Database error")
      );

      const request = new NextRequest("http://localhost:3000/api/chat/room-1");
      const response = await GET(request, { params: { roomId: "room-1" } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("should work for doctor accessing patient chat room", async () => {
      const doctorSession = {
        user: { id: "doctor-1", role: "DOCTOR" },
      };

      const { getServerSession } = await import("next-auth");
      vi.mocked(getServerSession).mockResolvedValueOnce(doctorSession);

      mockPrisma.chatRoom.findFirst.mockResolvedValue(mockChatRoom);
      mockPrisma.chatMessage.count.mockResolvedValue(0);

      const request = new NextRequest("http://localhost:3000/api/chat/room-1");
      const response = await GET(request, { params: { roomId: "room-1" } });

      expect(response.status).toBe(200);
      expect(mockPrisma.chatRoom.findFirst).toHaveBeenCalledWith({
        where: {
          id: "room-1",
          OR: [{ patientId: "doctor-1" }, { doctorId: "doctor-1" }],
        },
        include: expect.any(Object),
      });
    });
  });

  describe("PATCH /api/chat/[roomId]", () => {
    const mockChatRoom = {
      id: "room-1",
      doctorId: "user-1",
      isActive: true,
    };

    it("should update chat room status successfully", async () => {
      const doctorSession = {
        user: { id: "user-1", role: "DOCTOR" },
      };

      const { getServerSession } = await import("next-auth");
      vi.mocked(getServerSession).mockResolvedValueOnce(doctorSession);

      mockPrisma.chatRoom.findFirst.mockResolvedValue(mockChatRoom);
      mockPrisma.chatRoom.update.mockResolvedValue({
        ...mockChatRoom,
        isActive: false,
        endedAt: new Date("2024-01-01T12:00:00Z"),
      });

      const updateData = {
        isActive: false,
        endedAt: "2024-01-01T12:00:00Z",
      };

      const request = new NextRequest("http://localhost:3000/api/chat/room-1", {
        method: "PATCH",
        body: JSON.stringify(updateData),
      });

      const response = await PATCH(request, { params: { roomId: "room-1" } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isActive).toBe(false);

      expect(mockPrisma.chatRoom.update).toHaveBeenCalledWith({
        where: { id: "room-1" },
        data: {
          isActive: false,
          endedAt: new Date("2024-01-01T12:00:00Z"),
        },
        include: expect.any(Object),
      });
    });

    it("should reject update from non-doctor user", async () => {
      const patientSession = {
        user: { id: "patient-1", role: "PATIENT" },
      };

      const { getServerSession } = await import("next-auth");
      vi.mocked(getServerSession).mockResolvedValueOnce(patientSession);

      mockPrisma.chatRoom.findFirst.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/chat/room-1", {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      });

      const response = await PATCH(request, { params: { roomId: "room-1" } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Chat room not found or unauthorized");
    });

    it("should validate request data", async () => {
      const doctorSession = {
        user: { id: "user-1", role: "DOCTOR" },
      };

      const { getServerSession } = await import("next-auth");
      vi.mocked(getServerSession).mockResolvedValueOnce(doctorSession);

      const invalidData = {
        isActive: "invalid", // Should be boolean
        endedAt: "invalid-date",
      };

      const request = new NextRequest("http://localhost:3000/api/chat/room-1", {
        method: "PATCH",
        body: JSON.stringify(invalidData),
      });

      const response = await PATCH(request, { params: { roomId: "room-1" } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid request data");
      expect(data.details).toBeDefined();
    });

    it("should return 401 for unauthenticated user", async () => {
      const { getServerSession } = await import("next-auth");
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new NextRequest("http://localhost:3000/api/chat/room-1", {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      });

      const response = await PATCH(request, { params: { roomId: "room-1" } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should handle database errors", async () => {
      const doctorSession = {
        user: { id: "user-1", role: "DOCTOR" },
      };

      const { getServerSession } = await import("next-auth");
      vi.mocked(getServerSession).mockResolvedValueOnce(doctorSession);

      mockPrisma.chatRoom.findFirst.mockRejectedValue(
        new Error("Database error")
      );

      const request = new NextRequest("http://localhost:3000/api/chat/room-1", {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      });

      const response = await PATCH(request, { params: { roomId: "room-1" } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });

  describe("DELETE /api/chat/[roomId]", () => {
    const mockChatRoom = {
      id: "room-1",
      doctorId: "user-1",
    };

    it("should delete chat room successfully", async () => {
      const doctorSession = {
        user: { id: "user-1", role: "DOCTOR" },
      };

      const { getServerSession } = await import("next-auth");
      vi.mocked(getServerSession).mockResolvedValueOnce(doctorSession);

      mockPrisma.chatRoom.findFirst.mockResolvedValue(mockChatRoom);
      mockPrisma.chatMessage.deleteMany.mockResolvedValue({ count: 5 });
      mockPrisma.chatRoom.delete.mockResolvedValue(mockChatRoom);

      const request = new NextRequest("http://localhost:3000/api/chat/room-1", {
        method: "DELETE",
      });

      const response = await DELETE(request, { params: { roomId: "room-1" } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Chat room deleted successfully");

      // Verify messages are deleted first
      expect(mockPrisma.chatMessage.deleteMany).toHaveBeenCalledWith({
        where: { chatRoomId: "room-1" },
      });

      // Then chat room is deleted
      expect(mockPrisma.chatRoom.delete).toHaveBeenCalledWith({
        where: { id: "room-1" },
      });
    });

    it("should reject deletion from non-doctor user", async () => {
      const patientSession = {
        user: { id: "patient-1", role: "PATIENT" },
      };

      const { getServerSession } = await import("next-auth");
      vi.mocked(getServerSession).mockResolvedValueOnce(patientSession);

      mockPrisma.chatRoom.findFirst.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/chat/room-1", {
        method: "DELETE",
      });

      const response = await DELETE(request, { params: { roomId: "room-1" } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Chat room not found or unauthorized");
    });

    it("should return 401 for unauthenticated user", async () => {
      const { getServerSession } = await import("next-auth");
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new NextRequest("http://localhost:3000/api/chat/room-1", {
        method: "DELETE",
      });

      const response = await DELETE(request, { params: { roomId: "room-1" } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should handle database errors during deletion", async () => {
      const doctorSession = {
        user: { id: "user-1", role: "DOCTOR" },
      };

      const { getServerSession } = await import("next-auth");
      vi.mocked(getServerSession).mockResolvedValueOnce(doctorSession);

      mockPrisma.chatRoom.findFirst.mockResolvedValue(mockChatRoom);
      mockPrisma.chatMessage.deleteMany.mockRejectedValue(
        new Error("Database error")
      );

      const request = new NextRequest("http://localhost:3000/api/chat/room-1", {
        method: "DELETE",
      });

      const response = await DELETE(request, { params: { roomId: "room-1" } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("should handle foreign key constraint by deleting messages first", async () => {
      const doctorSession = {
        user: { id: "user-1", role: "DOCTOR" },
      };

      const { getServerSession } = await import("next-auth");
      vi.mocked(getServerSession).mockResolvedValueOnce(doctorSession);

      mockPrisma.chatRoom.findFirst.mockResolvedValue(mockChatRoom);
      mockPrisma.chatMessage.deleteMany.mockResolvedValue({ count: 10 });
      mockPrisma.chatRoom.delete.mockResolvedValue(mockChatRoom);

      const request = new NextRequest("http://localhost:3000/api/chat/room-1", {
        method: "DELETE",
      });

      await DELETE(request, { params: { roomId: "room-1" } });

      // Verify order of operations
      expect(mockPrisma.chatMessage.deleteMany).toHaveBeenCalledBefore(
        mockPrisma.chatRoom.delete as any
      );
    });
  });
});
