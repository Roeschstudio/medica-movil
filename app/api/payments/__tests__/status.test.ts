import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { GET, POST } from "../status/route";

// Mock dependencies
jest.mock("next-auth");
jest.mock("@/lib/prisma", () => ({
  prisma: {
    payment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    appointment: {
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/payments/PaymentService");

const mockGetServerSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;

describe("/api/payments/status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET - Single Payment Status", () => {
    test("should return payment status by payment ID", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-123" },
      } as any);

      const mockPayment = {
        id: "payment-123",
        userId: "user-123",
        status: "COMPLETED",
        paymentMethod: "stripe",
        amount: 1000,
        currency: "MXN",
        paidAt: new Date(),
        appointment: {
          id: "appointment-123",
          doctor: { name: "Dr. Test" },
        },
      };

      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);

      const request = new NextRequest(
        "http://localhost/api/payments/status?payment_id=payment-123"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe("payment-123");
      expect(data.status).toBe("completed");
      expect(data.provider).toBe("stripe");
    });

    test("should return payment status by appointment ID", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-123" },
      } as any);

      const mockPayment = {
        id: "payment-123",
        userId: "user-123",
        appointmentId: "appointment-123",
        status: "PENDING",
        paymentMethod: "paypal",
        amount: 1000,
        currency: "MXN",
        appointment: {
          id: "appointment-123",
          doctor: { name: "Dr. Test" },
        },
      };

      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);

      const request = new NextRequest(
        "http://localhost/api/payments/status?appointment_id=appointment-123"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe("payment-123");
      expect(data.status).toBe("pending");
      expect(data.provider).toBe("paypal");
    });

    test("should check with provider for pending payments", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-123" },
      } as any);

      const mockPayment = {
        id: "payment-123",
        userId: "user-123",
        status: "PENDING",
        paymentMethod: "stripe",
        stripePaymentId: "stripe-payment-123",
        amount: 1000,
        currency: "MXN",
        appointmentId: "appointment-123",
        appointment: {
          id: "appointment-123",
          doctor: { name: "Dr. Test" },
        },
      };

      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);
      (prisma.payment.update as jest.Mock).mockResolvedValue({
        ...mockPayment,
        status: "COMPLETED",
        paidAt: new Date(),
      });

      // Mock PaymentService
      const { PaymentService } = require("@/lib/payments/PaymentService");
      const mockPaymentService = {
        getPaymentStatus: jest.fn().mockResolvedValue({
          id: "stripe-payment-123",
          status: "completed",
          paidAt: new Date(),
        }),
      };
      PaymentService.mockImplementation(() => mockPaymentService);

      const request = new NextRequest(
        "http://localhost/api/payments/status?payment_id=payment-123"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe("completed");
      expect(prisma.payment.update).toHaveBeenCalled();
      expect(prisma.appointment.update).toHaveBeenCalled();
    });

    test("should return 401 for unauthenticated user", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = new NextRequest(
        "http://localhost/api/payments/status?payment_id=payment-123"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("No autorizado");
    });

    test("should return 400 for missing parameters", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-123" },
      } as any);

      const request = new NextRequest("http://localhost/api/payments/status");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Se requiere payment_id o appointment_id");
    });

    test("should return 404 for non-existent payment", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-123" },
      } as any);

      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest(
        "http://localhost/api/payments/status?payment_id=non-existent"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Pago no encontrado");
    });

    test("should return 403 for unauthorized payment access", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-123" },
      } as any);

      const mockPayment = {
        id: "payment-123",
        userId: "different-user", // Different user
        status: "COMPLETED",
      };

      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);

      const request = new NextRequest(
        "http://localhost/api/payments/status?payment_id=payment-123"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("No autorizado");
    });
  });

  describe("POST - Batch Payment Status", () => {
    test("should return status for multiple payments", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-123" },
      } as any);

      const mockPayments = [
        {
          id: "payment-1",
          userId: "user-123",
          status: "COMPLETED",
          paymentMethod: "stripe",
          amount: 1000,
          currency: "MXN",
          paidAt: new Date(),
          appointment: { id: "appointment-1", doctor: { name: "Dr. Test 1" } },
        },
        {
          id: "payment-2",
          userId: "user-123",
          status: "PENDING",
          paymentMethod: "paypal",
          amount: 1500,
          currency: "MXN",
          appointment: { id: "appointment-2", doctor: { name: "Dr. Test 2" } },
        },
      ];

      (prisma.payment.findMany as jest.Mock).mockResolvedValue(mockPayments);

      const request = new NextRequest("http://localhost/api/payments/status", {
        method: "POST",
        body: JSON.stringify({
          paymentIds: ["payment-1", "payment-2"],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.payments).toHaveLength(2);
      expect(data.payments[0].id).toBe("payment-1");
      expect(data.payments[1].id).toBe("payment-2");
    });

    test("should return 400 for invalid request body", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-123" },
      } as any);

      const request = new NextRequest("http://localhost/api/payments/status", {
        method: "POST",
        body: JSON.stringify({
          invalidField: "invalid",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Se requiere un array de payment IDs");
    });

    test("should handle empty payment IDs array", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-123" },
      } as any);

      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest("http://localhost/api/payments/status", {
        method: "POST",
        body: JSON.stringify({
          paymentIds: [],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.payments).toHaveLength(0);
    });
  });

  describe("Error Handling", () => {
    test("should handle database errors gracefully", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-123" },
      } as any);

      (prisma.payment.findUnique as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      const request = new NextRequest(
        "http://localhost/api/payments/status?payment_id=payment-123"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Error interno del servidor");
    });

    test("should handle payment service errors gracefully", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-123" },
      } as any);

      const mockPayment = {
        id: "payment-123",
        userId: "user-123",
        status: "PENDING",
        paymentMethod: "stripe",
        stripePaymentId: "stripe-payment-123",
        amount: 1000,
        currency: "MXN",
        appointment: { id: "appointment-123", doctor: { name: "Dr. Test" } },
      };

      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);

      // Mock PaymentService error
      const { PaymentService } = require("@/lib/payments/PaymentService");
      const mockPaymentService = {
        getPaymentStatus: jest
          .fn()
          .mockRejectedValue(new Error("Provider error")),
      };
      PaymentService.mockImplementation(() => mockPaymentService);

      const request = new NextRequest(
        "http://localhost/api/payments/status?payment_id=payment-123"
      );
      const response = await GET(request);
      const data = await response.json();

      // Should still return the database status even if provider check fails
      expect(response.status).toBe(200);
      expect(data.status).toBe("pending");
    });
  });
});
