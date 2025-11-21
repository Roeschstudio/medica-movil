/**
 * Test suite for Chat Rooms API endpoints
 *
 * Tests:
 * - GET /api/chat/rooms - Get chat rooms for a user
 * - POST /api/chat/rooms - Create a new chat room
 */

import { GET, POST } from "@/app/api/chat/rooms/route";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
const mockSupabaseClient = {
  from: vi.fn(),
};

const createMockQuery = () => ({
  select: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  single: vi.fn(),
  insert: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    single: vi.fn(),
  }),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
});

let mockQuery: ReturnType<typeof createMockQuery>;

vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: () => mockSupabaseClient,
}));

vi.mock("@/lib/auth-middleware", () => ({
  requireAuth: (handler: any) => handler,
  requireAppointmentAccess: (getAppointmentId: any, handler: any) => handler,
}));

vi.mock("@/lib/rate-limiting", () => ({
  withRateLimit: (limiter: any) => (handler: any) => handler,
  apiRateLimiter: {},
}));

vi.mock("@/lib/validation", () => ({
  validateQueryParams: vi.fn(),
  validateRequestBody: vi.fn(),
  chatRoomsQuerySchema: {},
  createChatRoomSchema: {},
  ValidationError: class ValidationError extends Error {
    constructor(message: string, public code: string, public field?: string) {
      super(message);
    }
  },
}));

describe("Chat Rooms API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery = createMockQuery();
    
    // Configure insert chain for successful cases by default
    const defaultInsertQuery = {
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "room-1",
          appointmentId: "apt-1",
          isActive: true,
          createdAt: new Date().toISOString(),
          patient: { id: "patient-1", name: "Test Patient", role: "PATIENT" },
          doctor: {
            id: "doctor-1",
            name: "Dr. Test",
            doctorProfile: { specialty: "Cardiología" },
          },
        },
        error: null,
      }),
    };
    mockQuery.insert.mockReturnValue(defaultInsertQuery);
    
    mockSupabaseClient.from.mockReturnValue(mockQuery);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/chat/rooms", () => {
    const mockContext = {
      user: { id: "user-1", role: "PATIENT" },
    };

    it("should return chat rooms for authenticated user", async () => {
      const mockChatRooms = [
        {
          id: "room-1",
          appointmentId: "apt-1",
          patientId: "user-1",
          doctorId: "doctor-1",
          isActive: true,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          appointment: {
            id: "apt-1",
            scheduledAt: "2024-01-02T10:00:00Z",
            type: "CONSULTATION",
            status: "CONFIRMED",
          },
          patient: {
            id: "user-1",
            name: "Test Patient",
            role: "PATIENT",
          },
          doctor: {
            id: "doctor-1",
            name: "Dr. Test",
            doctorProfile: {
              specialty: "Cardiología",
            },
          },
        },
      ];

      mockQuery.select.mockResolvedValue({
        data: mockChatRooms,
        error: null,
        count: 1,
      });

      const { validateQueryParams } = await import("@/lib/validation");
      vi.mocked(validateQueryParams).mockReturnValue({
        userId: "user-1",
        page: 1,
        limit: 10,
        includeInactive: false,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/chat/rooms?userId=user-1"
      );
      const response = await GET(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chatRooms).toHaveLength(1);
      expect(data.chatRooms[0].id).toBe("room-1");
      expect(data.chatRooms[0].doctor.specialty).toBe("Cardiología");
      expect(data.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        hasMore: false,
      });
    });

    it("should deny access to another user's chat rooms", async () => {
      const { validateQueryParams } = await import("@/lib/validation");
      vi.mocked(validateQueryParams).mockReturnValue({
        userId: "other-user",
        page: 1,
        limit: 10,
        includeInactive: false,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/chat/rooms?userId=other-user"
      );
      const response = await GET(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Cannot access another user's chat rooms");
      expect(data.code).toBe("ACCESS_DENIED");
    });

    it("should allow admin to access any user's chat rooms", async () => {
      const adminContext = {
        user: { id: "admin-1", role: "ADMIN" },
      };

      mockQuery.select.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      const { validateQueryParams } = await import("@/lib/validation");
      vi.mocked(validateQueryParams).mockReturnValue({
        userId: "other-user",
        page: 1,
        limit: 10,
        includeInactive: false,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/chat/rooms?userId=other-user"
      );
      const response = await GET(request, adminContext);

      expect(response.status).toBe(200);
    });

    it("should handle database errors", async () => {
      mockQuery.select.mockResolvedValue({
        data: null,
        error: new Error("Database connection failed"),
        count: null,
      });

      const { validateQueryParams } = await import("@/lib/validation");
      vi.mocked(validateQueryParams).mockReturnValue({
        userId: "user-1",
        page: 1,
        limit: 10,
        includeInactive: false,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/chat/rooms?userId=user-1"
      );
      const response = await GET(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch chat rooms");
      expect(data.code).toBe("FETCH_CHAT_ROOMS_ERROR");
    });

    it("should handle validation errors", async () => {
      const { validateQueryParams, ValidationError } = await import(
        "@/lib/validation"
      );
      vi.mocked(validateQueryParams).mockImplementation(() => {
        throw new ValidationError(
          "Invalid page parameter",
          "INVALID_PAGE",
          "page"
        );
      });

      const request = new NextRequest(
        "http://localhost:3000/api/chat/rooms?userId=user-1&page=invalid"
      );
      const response = await GET(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid page parameter");
      expect(data.code).toBe("INVALID_PAGE");
      expect(data.field).toBe("page");
    });

    it("should apply filters correctly", async () => {
      const mockChatRooms = [
        {
          id: "room-1",
          appointmentId: "apt-1",
          isActive: true,
        },
      ];

      mockQuery.select.mockResolvedValue({
        data: mockChatRooms,
        error: null,
        count: 1,
      });

      const { validateQueryParams } = await import("@/lib/validation");
      vi.mocked(validateQueryParams).mockReturnValue({
        userId: "user-1",
        page: 1,
        limit: 10,
        includeInactive: true,
        appointmentId: "apt-1",
      });

      const request = new NextRequest(
        "http://localhost:3000/api/chat/rooms?userId=user-1&includeInactive=true&appointmentId=apt-1"
      );
      const response = await GET(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chatRooms).toHaveLength(1);
      expect(data.chatRooms[0].id).toBe("room-1");
    });
  });

  describe("POST /api/chat/rooms", () => {
    const mockAppointment = {
      id: "apt-1",
      patientId: "patient-1",
      doctorId: "doctor-1",
      status: "CONFIRMED",
    };

    const mockChatRoomData = {
      appointmentId: "apt-1",
      patientId: "patient-1",
      doctorId: "doctor-1",
    };

    it("should create a new chat room successfully", async () => {
      const mockCreatedRoom = {
        id: "room-1",
        appointmentId: "apt-1",
        patientId: "patient-1",
        doctorId: "doctor-1",
        isActive: true,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        appointment: mockAppointment,
        patient: { id: "patient-1", name: "Test Patient", role: "PATIENT" },
        doctor: {
          id: "doctor-1",
          name: "Dr. Test",
          doctorProfile: { specialty: "Cardiología" },
        },
      };

      // Mock existing room check (no existing room)
      mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST116" }, // No rows found
      });

      // Mock appointment verification
      mockQuery.single.mockResolvedValueOnce({
        data: mockAppointment,
        error: null,
      });

      // Mock room creation
      mockQuery.single.mockResolvedValueOnce({
        data: mockCreatedRoom,
        error: null,
      });

      const { validateRequestBody } = await import("@/lib/validation");
      vi.mocked(validateRequestBody).mockResolvedValue(mockChatRoomData);

      const request = new NextRequest("http://localhost:3000/api/chat/rooms", {
        method: "POST",
        body: JSON.stringify(mockChatRoomData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe("room-1");
      expect(data.doctor.specialty).toBe("Cardiología");
    });

    it("should return existing chat room if already exists", async () => {
      const existingRoom = { id: "existing-room-1" };

      // Mock existing room check (room exists)
      mockQuery.single.mockResolvedValueOnce({
        data: existingRoom,
        error: null,
      });

      const { validateRequestBody } = await import("@/lib/validation");
      vi.mocked(validateRequestBody).mockResolvedValue(mockChatRoomData);

      const request = new NextRequest("http://localhost:3000/api/chat/rooms", {
        method: "POST",
        body: JSON.stringify(mockChatRoomData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe("Chat room already exists for this appointment");
      expect(data.code).toBe("CHAT_ROOM_EXISTS");
      expect(data.chatRoomId).toBe("existing-room-1");
    });

    it("should validate appointment participants", async () => {
      const invalidAppointment = {
        id: "apt-1",
        patientId: "different-patient",
        doctorId: "different-doctor",
        status: "CONFIRMED",
      };

      // Mock existing room check (no existing room)
      mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST116" },
      });

      // Mock appointment verification with different participants
      mockQuery.single.mockResolvedValueOnce({
        data: invalidAppointment,
        error: null,
      });

      const { validateRequestBody } = await import("@/lib/validation");
      vi.mocked(validateRequestBody).mockResolvedValue(mockChatRoomData);

      const request = new NextRequest("http://localhost:3000/api/chat/rooms", {
        method: "POST",
        body: JSON.stringify(mockChatRoomData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe(
        "Patient and doctor IDs must match the appointment"
      );
      expect(data.code).toBe("INVALID_PARTICIPANTS");
    });

    it("should handle appointment not found", async () => {
      // Mock existing room check (no existing room)
      mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST116" },
      });

      // Mock appointment not found
      mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: new Error("Not found"),
      });

      const { validateRequestBody } = await import("@/lib/validation");
      vi.mocked(validateRequestBody).mockResolvedValue(mockChatRoomData);

      const request = new NextRequest("http://localhost:3000/api/chat/rooms", {
        method: "POST",
        body: JSON.stringify(mockChatRoomData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Appointment not found");
      expect(data.code).toBe("APPOINTMENT_NOT_FOUND");
    });

    it("should handle database errors during creation", async () => {
      // Mock existing room check (no existing room)
      mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST116" },
      });

      // Mock appointment verification
      mockQuery.single.mockResolvedValueOnce({
        data: mockAppointment,
        error: null,
      });

      // Mock room creation failure
      const mockInsertQuery = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Database error", code: "DB_ERROR" },
        }),
      };
      mockQuery.insert.mockReturnValue(mockInsertQuery);

      const { validateRequestBody } = await import("@/lib/validation");
      vi.mocked(validateRequestBody).mockResolvedValue(mockChatRoomData);

      const request = new NextRequest("http://localhost:3000/api/chat/rooms", {
        method: "POST",
        body: JSON.stringify(mockChatRoomData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to create chat room");
      expect(data.code).toBe("CREATE_CHAT_ROOM_ERROR");
    });

    it("should handle validation errors", async () => {
      const { validateRequestBody, ValidationError } = await import(
        "@/lib/validation"
      );
      vi.mocked(validateRequestBody).mockImplementation(() => {
        throw new ValidationError(
          "Missing appointmentId",
          "MISSING_FIELD",
          "appointmentId"
        );
      });

      const request = new NextRequest("http://localhost:3000/api/chat/rooms", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Missing appointmentId");
      expect(data.code).toBe("MISSING_FIELD");
      expect(data.field).toBe("appointmentId");
    });
  });
});
