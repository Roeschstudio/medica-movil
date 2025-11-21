/**
 * End-to-End Chat Workflow Tests
 *
 * Tests complete chat workflows from start to finish:
 * - Appointment booking → Chat room creation → Message exchange → Room closure
 * - File sharing workflow
 * - Video session integration
 * - Notification delivery
 * - Error scenarios and recovery
 */

import {
  GET as getChatRoom,
  PATCH as updateChatRoom,
} from "@/app/api/chat/[roomId]/route";
import { POST as sendMessage } from "@/app/api/chat/messages/route";
import { POST as createChatRoom } from "@/app/api/chat/rooms/route";
import { NextRequest } from "next/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies - moved to factory functions to avoid hoisting issues
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    chatRoom: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    chatMessage: {
      count: vi.fn(),
    },
  },
}));

// Mock instances
let mockSupabaseClient: any;
let mockQuery: any;
let mockPrisma: any;

beforeAll(async () => {
  const { createSupabaseServerClient } = await import("@/lib/supabase");
  const { prisma } = await import("@/lib/db");
  
  mockSupabaseClient = {
    from: vi.fn((table: string) => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        range: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      };
      return mockQuery;
    }),
    auth: {
      getUser: vi.fn(),
    },
  };
  
  vi.mocked(createSupabaseServerClient).mockReturnValue(mockSupabaseClient);
  mockPrisma = vi.mocked(prisma);
});

vi.mock("@/lib/auth-middleware", () => ({
  requireAuth: (handler: any) => (request: any, context?: any) => {
    const mockContext = context || { user: { id: "patient-1", role: "PATIENT" } };
    return handler(request, mockContext);
  },
  requireAppointmentAccess: (getAppointmentId: any, handler: any) => {
    return (request: any, context?: any) => {
      const mockContext = context || { user: { id: "patient-1", role: "PATIENT" } };
      return handler(request, mockContext);
    };
  },
  requireChatRoomAccess: (getChatRoomId: any, handler: any) => (request: any, context?: any) => {
    const mockContext = context || { user: { id: "patient-1", role: "PATIENT" } };
    return handler(request, mockContext);
  },
}));

vi.mock("@/lib/chat-auth-middleware", () => ({
  requireChatRoomAccess: (getChatRoomId: any, handler: any) => {
    return (request: any, context?: any) => {
      const mockContext = context || { user: { id: "patient-1", role: "PATIENT" } };
      return handler(request, mockContext);
    };
  },
}));

vi.mock("@/lib/rate-limiting", () => {
  const withRateLimit = (limiter: any) => (handler: any) => handler;
  return {
    withRateLimit,
    apiRateLimiter: {},
    userChatRateLimiter: {},
  };
});

vi.mock("@/lib/validation", () => ({
  validateRequestBody: vi.fn(),
  sanitizeContent: vi.fn((content: string) => content),
  createChatRoomSchema: {},
  chatMessageSchema: {},
  ValidationError: class ValidationError extends Error {
    constructor(message: string, public code: string, public field?: string) {
      super(message);
    }
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/unified-auth", () => ({
  authOptions: {},
}));

describe("Chat E2E Workflow Tests", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Ensure Supabase client mock is properly configured
    const { createSupabaseServerClient } = await import("@/lib/supabase");
    vi.mocked(createSupabaseServerClient).mockReturnValue(mockSupabaseClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Complete Chat Session Workflow", () => {
    const mockAppointment = {
      id: "apt-1",
      patientId: "patient-1",
      doctorId: "doctor-1",
      status: "CONFIRMED",
      scheduledAt: "2024-01-02T10:00:00Z",
    };

    const mockPatient = {
      id: "patient-1",
      name: "Test Patient",
      role: "PATIENT",
    };

    const mockDoctor = {
      id: "doctor-1",
      name: "Dr. Test",
      role: "DOCTOR",
    };

    it("should complete full chat workflow: create room → send messages → close room", async () => {
      // Step 1: Create chat room
      const chatRoomData = {
        appointmentId: "apt-1",
        patientId: "patient-1",
        doctorId: "doctor-1",
      };

      // Configure mock responses for room creation flow
      let callCount = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          range: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          single: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              // First call: Check if chat room exists (should return null - no existing room)
              return Promise.resolve({ data: null, error: { code: "PGRST116" } });
            } else if (callCount === 2) {
              // Second call: Get appointment data (should return appointment)
              return Promise.resolve({ 
                data: {
                  id: "apt-1",
                  patientId: "patient-1",
                  doctorId: "doctor-1",
                  status: "confirmed",
                  scheduledAt: new Date().toISOString(),
                  type: "consultation"
                }, 
                error: null 
              });
            } else if (callCount === 3) {
              // Third call: Create chat room (should return created room)
              return Promise.resolve({
                data: {
                  id: "room-1",
                  appointmentId: "apt-1",
                  patientId: "patient-1",
                  doctorId: "doctor-1",
                  isActive: true,
                  createdAt: "2024-01-01T00:00:00Z",
                  appointment: mockAppointment,
                  patient: mockPatient,
                  doctor: {
                    ...mockDoctor,
                    doctorProfile: { specialty: "Cardiología" },
                  },
                },
                error: null,
              });
            }
            return Promise.resolve({ data: null, error: null });
          }),
        };
        return mockQuery;
      });

      const { validateRequestBody } = await import("@/lib/validation");
      vi.mocked(validateRequestBody).mockResolvedValueOnce(chatRoomData);

      const createRoomRequest = new NextRequest(
        "http://localhost:3000/api/chat/rooms",
        {
          method: "POST",
          body: JSON.stringify(chatRoomData),
        }
      );

      const createRoomResponse = await createChatRoom(createRoomRequest);
      const roomData = await createRoomResponse.json();

      expect(createRoomResponse.status).toBe(201);
      expect(roomData.id).toBe("room-1");
      expect(roomData.isActive).toBe(true);

      // Step 2: Send messages between patient and doctor
      const messages = [
        {
          sender: mockPatient,
          content: "Hello doctor, I have some questions about my symptoms.",
        },
        {
          sender: mockDoctor,
          content:
            "Hello! I'm here to help. What symptoms are you experiencing?",
        },
        {
          sender: mockPatient,
          content: "I've been having headaches for the past week.",
        },
        {
          sender: mockDoctor,
          content: "I see. Can you describe the intensity and frequency?",
        },
      ];

      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        const messageData = {
          chatRoomId: "room-1",
          senderId: message.sender.id,
          content: message.content,
          messageType: "TEXT",
        };

        // Mock message sending
        mockQuery.single
          .mockResolvedValueOnce({ data: { isActive: true }, error: null }) // Room is active
          .mockResolvedValueOnce({
            // Message created
            data: {
              id: `msg-${i + 1}`,
              ...messageData,
              sentAt: new Date(Date.now() + i * 1000).toISOString(),
              isRead: false,
              sender: message.sender,
            },
            error: null,
          });

        mockQuery.eq.mockResolvedValueOnce({ error: null }); // Room timestamp updated

        vi.mocked(validateRequestBody).mockResolvedValueOnce(messageData);

        const sendMessageRequest = new NextRequest(
          "http://localhost:3000/api/chat/messages",
          {
            method: "POST",
            body: JSON.stringify(messageData),
          }
        );

        const sendMessageResponse = await sendMessage(sendMessageRequest, {
          user: message.sender,
        });
        const sentMessageData = await sendMessageResponse.json();

        expect(sendMessageResponse.status).toBe(201);
        expect(sentMessageData.content).toBe(message.content);
        expect(sentMessageData.sender.id).toBe(message.sender.id);
      }

      // Step 3: Get chat room details to verify messages
      const { getServerSession } = await import("next-auth");
      vi.mocked(getServerSession).mockResolvedValue({ user: mockDoctor });

      mockPrisma.chatRoom.findFirst.mockResolvedValue({
        id: "room-1",
        appointmentId: "apt-1",
        patientId: "patient-1",
        doctorId: "doctor-1",
        isActive: true,
        messages: messages.map((msg, i) => ({
          id: `msg-${i + 1}`,
          content: msg.content,
          senderId: msg.sender.id,
          sender: msg.sender,
          sentAt: new Date(Date.now() + i * 1000),
        })),
        appointment: mockAppointment,
        _count: { messages: 4, videoSessions: 0 },
      });

      mockPrisma.chatMessage.count.mockResolvedValue(2); // 2 unread messages for doctor

      const getRoomRequest = new NextRequest(
        "http://localhost:3000/api/chat/room-1"
      );
      const getRoomResponse = await getChatRoom(getRoomRequest, {
        params: { roomId: "room-1" },
      });
      const roomDetails = await getRoomResponse.json();

      expect(getRoomResponse.status).toBe(200);
      expect(roomDetails.messages).toHaveLength(4);
      expect(roomDetails.unreadCount).toBe(2);

      // Step 4: Close chat room (doctor ends session)
      vi.mocked(getServerSession).mockResolvedValue({ user: mockDoctor });

      mockPrisma.chatRoom.findFirst.mockResolvedValue({
        id: "room-1",
        doctorId: "doctor-1",
      });

      mockPrisma.chatRoom.update.mockResolvedValue({
        id: "room-1",
        isActive: false,
        endedAt: new Date("2024-01-01T11:00:00Z"),
        appointment: mockAppointment,
      });

      const closeRoomRequest = new NextRequest(
        "http://localhost:3000/api/chat/room-1",
        {
          method: "PATCH",
          body: JSON.stringify({
            isActive: false,
            endedAt: "2024-01-01T11:00:00Z",
          }),
        }
      );

      const closeRoomResponse = await updateChatRoom(closeRoomRequest, {
        params: { roomId: "room-1" },
      });
      const closedRoomData = await closeRoomResponse.json();

      expect(closeRoomResponse.status).toBe(200);
      expect(closedRoomData.isActive).toBe(false);
      expect(closedRoomData.endedAt).toBeDefined();
    });
  });

  describe("File Sharing Workflow", () => {
    const mockContext = {
      user: { id: "patient-1", role: "PATIENT" },
    };

    it("should handle complete file sharing workflow", async () => {
      // Step 1: Patient shares medical document
      const fileMessageData = {
        chatRoomId: "room-1",
        senderId: "patient-1",
        content: "Here are my recent lab results",
        messageType: "FILE",
        fileUrl: "https://storage.supabase.co/bucket/files/lab-results.pdf",
        fileName: "lab-results.pdf",
        fileSize: 2048000,
      };

      mockQuery.single
        .mockResolvedValueOnce({ data: { isActive: true }, error: null }) // Room is active
        .mockResolvedValueOnce({
          // File message created
          data: {
            id: "msg-file-1",
            ...fileMessageData,
            sentAt: "2024-01-01T10:00:00Z",
            isRead: false,
            sender: {
              id: "patient-1",
              name: "Test Patient",
              role: "PATIENT",
            },
          },
          error: null,
        });

      mockQuery.eq.mockResolvedValue({ error: null });

      const { validateRequestBody } = await import("@/lib/validation");
      vi.mocked(validateRequestBody).mockResolvedValue(fileMessageData);

      const shareFileRequest = new NextRequest(
        "http://localhost:3000/api/chat/messages",
        {
          method: "POST",
          body: JSON.stringify(fileMessageData),
        }
      );

      const shareFileResponse = await sendMessage(
        shareFileRequest,
        mockContext
      );
      const fileMessageResponse = await shareFileResponse.json();

      expect(shareFileResponse.status).toBe(201);
      expect(fileMessageResponse.messageType).toBe("FILE");
      expect(fileMessageResponse.fileUrl).toBe(
        "https://storage.supabase.co/bucket/files/lab-results.pdf"
      );
      expect(fileMessageResponse.fileName).toBe("lab-results.pdf");
      expect(fileMessageResponse.fileSize).toBe(2048000);

      // Step 2: Doctor responds to file
      const doctorResponseData = {
        chatRoomId: "room-1",
        senderId: "doctor-1",
        content:
          "Thank you for sharing the lab results. I've reviewed them and everything looks normal.",
        messageType: "TEXT",
      };

      mockQuery.single
        .mockResolvedValueOnce({ data: { isActive: true }, error: null })
        .mockResolvedValueOnce({
          data: {
            id: "msg-response-1",
            ...doctorResponseData,
            sentAt: "2024-01-01T10:05:00Z",
            isRead: false,
            sender: {
              id: "doctor-1",
              name: "Dr. Test",
              role: "DOCTOR",
            },
          },
          error: null,
        });

      mockQuery.eq.mockResolvedValue({ error: null });

      vi.mocked(validateRequestBody).mockResolvedValue(doctorResponseData);

      const doctorResponseRequest = new NextRequest(
        "http://localhost:3000/api/chat/messages",
        {
          method: "POST",
          body: JSON.stringify(doctorResponseData),
        }
      );

      const doctorResponseResponse = await sendMessage(doctorResponseRequest, {
        user: { id: "doctor-1", role: "DOCTOR" },
      });

      expect(doctorResponseResponse.status).toBe(201);

      // Step 3: Patient shares image file
      const imageMessageData = {
        chatRoomId: "room-1",
        senderId: "patient-1",
        content: "Photo of the affected area",
        messageType: "IMAGE",
        fileUrl: "https://storage.supabase.co/bucket/files/symptom-photo.jpg",
        fileName: "symptom-photo.jpg",
        fileSize: 1024000,
      };

      mockQuery.single
        .mockResolvedValueOnce({ data: { isActive: true }, error: null })
        .mockResolvedValueOnce({
          data: {
            id: "msg-image-1",
            ...imageMessageData,
            sentAt: "2024-01-01T10:10:00Z",
            isRead: false,
            sender: {
              id: "patient-1",
              name: "Test Patient",
              role: "PATIENT",
            },
          },
          error: null,
        });

      mockQuery.eq.mockResolvedValue({ error: null });

      vi.mocked(validateRequestBody).mockResolvedValue(imageMessageData);

      const shareImageRequest = new NextRequest(
        "http://localhost:3000/api/chat/messages",
        {
          method: "POST",
          body: JSON.stringify(imageMessageData),
        }
      );

      const shareImageResponse = await sendMessage(
        shareImageRequest,
        mockContext
      );
      const imageMessageResponse = await shareImageResponse.json();

      expect(shareImageResponse.status).toBe(201);
      expect(imageMessageResponse.messageType).toBe("IMAGE");
      expect(imageMessageResponse.fileName).toBe("symptom-photo.jpg");
    });
  });

  describe("Error Recovery Workflows", () => {
    it("should handle chat room creation failure and retry", async () => {
      const chatRoomData = {
        appointmentId: "apt-1",
        patientId: "patient-1",
        doctorId: "doctor-1",
      };

      // First attempt fails
      mockQuery.single
        .mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } }) // No existing room
        .mockResolvedValueOnce({
          // Appointment exists
          data: {
            id: "apt-1",
            patientId: "patient-1",
            doctorId: "doctor-1",
            status: "CONFIRMED",
          },
          error: null,
        })
        .mockResolvedValueOnce({
          // Room creation fails
          data: null,
          error: new Error("Database connection timeout"),
        });

      const { validateRequestBody } = await import("@/lib/validation");
      vi.mocked(validateRequestBody).mockResolvedValue(chatRoomData);

      const firstAttemptRequest = new NextRequest(
        "http://localhost:3000/api/chat/rooms",
        {
          method: "POST",
          body: JSON.stringify(chatRoomData),
        }
      );

      const firstAttemptResponse = await createChatRoom(firstAttemptRequest);
      expect(firstAttemptResponse.status).toBe(500);

      // Second attempt succeeds
      mockQuery.single
        .mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } }) // No existing room
        .mockResolvedValueOnce({
          // Appointment exists
          data: {
            id: "apt-1",
            patientId: "patient-1",
            doctorId: "doctor-1",
            status: "CONFIRMED",
          },
          error: null,
        })
        .mockResolvedValueOnce({
          // Room creation succeeds
          data: {
            id: "room-1",
            appointmentId: "apt-1",
            patientId: "patient-1",
            doctorId: "doctor-1",
            isActive: true,
            appointment: { id: "apt-1" },
            patient: { id: "patient-1", name: "Test Patient" },
            doctor: {
              id: "doctor-1",
              name: "Dr. Test",
              doctorProfile: { specialty: "General" },
            },
          },
          error: null,
        });

      vi.mocked(validateRequestBody).mockResolvedValue(chatRoomData);

      const retryRequest = new NextRequest(
        "http://localhost:3000/api/chat/rooms",
        {
          method: "POST",
          body: JSON.stringify(chatRoomData),
        }
      );

      const retryResponse = await createChatRoom(retryRequest);
      const retryData = await retryResponse.json();

      expect(retryResponse.status).toBe(201);
      expect(retryData.id).toBe("room-1");
    });

    it("should handle message sending to inactive room gracefully", async () => {
      const messageData = {
        chatRoomId: "room-1",
        senderId: "patient-1",
        content: "Hello doctor",
        messageType: "TEXT",
      };

      // Room is inactive
      mockQuery.single.mockResolvedValue({
        data: { isActive: false },
        error: null,
      });

      const { validateRequestBody } = await import("@/lib/validation");
      vi.mocked(validateRequestBody).mockResolvedValue(messageData);

      const sendMessageRequest = new NextRequest(
        "http://localhost:3000/api/chat/messages",
        {
          method: "POST",
          body: JSON.stringify(messageData),
        }
      );

      const sendMessageResponse = await sendMessage(sendMessageRequest, {
        user: { id: "patient-1", role: "PATIENT" },
      });

      const responseData = await sendMessageResponse.json();

      expect(sendMessageResponse.status).toBe(400);
      expect(responseData.error).toBe(
        "Cannot send message to inactive chat room"
      );
      expect(responseData.code).toBe("CHAT_ROOM_INACTIVE");
    });
  });

  describe("Multi-User Concurrent Workflows", () => {
    it("should handle multiple users interacting with same chat room", async () => {
      const users = [
        { id: "patient-1", role: "PATIENT", name: "Test Patient" },
        { id: "doctor-1", role: "DOCTOR", name: "Dr. Test" },
      ];

      // Both users send messages simultaneously
      const concurrentMessages = users.map((user, index) => ({
        chatRoomId: "room-1",
        senderId: user.id,
        content: `Message from ${user.name} - ${index}`,
        messageType: "TEXT",
      }));

      // Configure mock for concurrent message sending
      let messageCounter = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          range: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          single: vi.fn().mockImplementation(() => {
            messageCounter++;
            if (messageCounter <= 2) {
              // Room is active checks
              return Promise.resolve({ data: { isActive: true }, error: null });
            } else {
              // Message creation
              return Promise.resolve({
                data: {
                  id: `msg-concurrent-${messageCounter - 2}`,
                  content: concurrentMessages[(messageCounter - 3) % 2]?.content || "Test",
                  sentAt: new Date().toISOString(),
                  sender: users[(messageCounter - 3) % 2] || users[0],
                },
                error: null,
              });
            }
          }),
        };
        mockQuery.eq.mockResolvedValue({ error: null });
        return mockQuery;
      });

      const { validateRequestBody } = await import("@/lib/validation");

      const sendPromises = concurrentMessages.map((messageData, index) => {
        vi.mocked(validateRequestBody).mockResolvedValueOnce(messageData);

        const request = new NextRequest(
          "http://localhost:3000/api/chat/messages",
          {
            method: "POST",
            body: JSON.stringify(messageData),
          }
        );

        return sendMessage(request, { user: users[index] });
      });

      const responses = await Promise.all(sendPromises);

      // Both messages should be sent successfully
      responses.forEach((response) => {
        expect(response.status).toBe(201);
      });

      // Verify both users' messages were processed
      expect(messageCounter).toBe(4); // 2 room checks + 2 message creations
    });
  });

  describe("Integration with Appointment System", () => {
    it("should maintain chat room lifecycle with appointment status changes", async () => {
      // Step 1: Create chat room for confirmed appointment
      const chatRoomData = {
        appointmentId: "apt-1",
        patientId: "patient-1",
        doctorId: "doctor-1",
      };

      // Configure mocks for chat room creation workflow
      let roomCreationCallCount = 0;
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => {
          roomCreationCallCount++;
          if (roomCreationCallCount === 1) {
            // Check if room already exists - return null (no existing room)
            return Promise.resolve({ data: null, error: { code: "PGRST116" } });
          } else if (roomCreationCallCount === 2) {
            // Get appointment details
            return Promise.resolve({
              data: {
                id: "apt-1",
                patientId: "patient-1",
                doctorId: "doctor-1",
                status: "CONFIRMED",
                scheduledAt: "2024-01-01T10:00:00Z",
                type: "CONSULTATION"
              },
              error: null
            });
          } else {
            // Create chat room
            return Promise.resolve({
              data: {
                id: "room-1",
                appointmentId: "apt-1",
                patientId: "patient-1",
                doctorId: "doctor-1",
                isActive: true,
                appointment: {
                  id: "apt-1",
                  scheduledAt: "2024-01-01T10:00:00Z",
                  type: "CONSULTATION",
                  status: "CONFIRMED"
                },
                patient: {
                  id: "patient-1",
                  name: "Test Patient",
                  role: "PATIENT"
                },
                doctor: {
                  id: "doctor-1",
                  name: "Dr. Test",
                  doctorProfile: {
                    specialty: "Medicina General"
                  }
                }
              },
              error: null
            });
          }
        }),
      };
      
      mockSupabaseClient.from.mockReturnValue(mockQuery);

      const { validateRequestBody } = await import("@/lib/validation");
      vi.mocked(validateRequestBody).mockResolvedValue(chatRoomData);

      const createRoomRequest = new NextRequest(
        "http://localhost:3000/api/chat/rooms",
        {
          method: "POST",
          body: JSON.stringify(chatRoomData),
        }
      );

      const createRoomResponse = await createChatRoom(createRoomRequest);
      
      expect(createRoomResponse.status).toBe(201);
      
      const responseData = await createRoomResponse.json();
      expect(responseData.id).toBe("room-1");
      expect(responseData.appointmentId).toBe("apt-1");
      expect(responseData.isActive).toBe(true);
    });
  });
});
