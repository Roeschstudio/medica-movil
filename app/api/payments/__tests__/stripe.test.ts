import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { POST } from "../stripe/create-session/route";

// Mock dependencies
jest.mock("next-auth");
jest.mock("@/lib/prisma", () => ({
  prisma: {
    appointment: {
      findUnique: jest.fn(),
    },
    payment: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/payments/PaymentService");
jest.mock("@/lib/payments/stripe/StripeProvider");

const mockGetServerSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;

describe("/api/payments/stripe/create-session", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should create Stripe session successfully", async () => {
    // Mock authenticated user
    mockGetServerSession.mockResolvedValue({
      user: { id: "user-123", email: "test@example.com" },
    } as any);

    // Mock appointment data
    const mockAppointment = {
      id: "appointment-123",
      patientId: "user-123",
      price: 1000,
      doctor: {
        user: { name: "Dr. Test" },
      },
      patient: {
        email: "test@example.com",
        name: "Test Patient",
      },
    };

    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
      mockAppointment
    );
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.payment.create as jest.Mock).mockResolvedValue({
      id: "payment-123",
      status: "PENDING",
    });

    // Mock PaymentService
    const { PaymentService } = require("@/lib/payments/PaymentService");
    const mockPaymentService = {
      createPayment: jest.fn().mockResolvedValue({
        success: true,
        paymentId: "stripe-session-123",
        checkoutUrl: "https://checkout.stripe.com/test",
      }),
    };
    PaymentService.mockImplementation(() => mockPaymentService);

    const request = new NextRequest(
      "http://localhost/api/payments/stripe/create-session",
      {
        method: "POST",
        body: JSON.stringify({
          appointmentId: "appointment-123",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.checkoutUrl).toBe("https://checkout.stripe.com/test");
    expect(prisma.payment.create).toHaveBeenCalled();
  });

  test("should return 401 for unauthenticated user", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost/api/payments/stripe/create-session",
      {
        method: "POST",
        body: JSON.stringify({
          appointmentId: "appointment-123",
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autorizado");
  });

  test("should return 400 for missing appointmentId", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "user-123" },
    } as any);

    const request = new NextRequest(
      "http://localhost/api/payments/stripe/create-session",
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Se requiere el ID de la cita");
  });

  test("should return 404 for non-existent appointment", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "user-123" },
    } as any);

    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost/api/payments/stripe/create-session",
      {
        method: "POST",
        body: JSON.stringify({
          appointmentId: "non-existent",
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Cita no encontrada");
  });

  test("should return 403 for unauthorized appointment access", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "user-123" },
    } as any);

    const mockAppointment = {
      id: "appointment-123",
      patientId: "different-user", // Different user
      price: 1000,
    };

    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
      mockAppointment
    );

    const request = new NextRequest(
      "http://localhost/api/payments/stripe/create-session",
      {
        method: "POST",
        body: JSON.stringify({
          appointmentId: "appointment-123",
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("No autorizado para esta cita");
  });

  test("should return 400 for already paid appointment", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "user-123" },
    } as any);

    const mockAppointment = {
      id: "appointment-123",
      patientId: "user-123",
      price: 1000,
      doctor: { user: { name: "Dr. Test" } },
      patient: { email: "test@example.com", name: "Test Patient" },
    };

    const mockExistingPayment = {
      id: "payment-123",
      status: "COMPLETED",
    };

    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
      mockAppointment
    );
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue(
      mockExistingPayment
    );

    const request = new NextRequest(
      "http://localhost/api/payments/stripe/create-session",
      {
        method: "POST",
        body: JSON.stringify({
          appointmentId: "appointment-123",
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Esta cita ya ha sido pagada");
  });

  test("should handle payment service errors", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "user-123" },
    } as any);

    const mockAppointment = {
      id: "appointment-123",
      patientId: "user-123",
      price: 1000,
      doctor: { user: { name: "Dr. Test" } },
      patient: { email: "test@example.com", name: "Test Patient" },
    };

    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
      mockAppointment
    );
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue(null);

    // Mock PaymentService error
    const { PaymentService } = require("@/lib/payments/PaymentService");
    const mockPaymentService = {
      createPayment: jest.fn().mockResolvedValue({
        success: false,
        error: "Stripe API error",
      }),
    };
    PaymentService.mockImplementation(() => mockPaymentService);

    const request = new NextRequest(
      "http://localhost/api/payments/stripe/create-session",
      {
        method: "POST",
        body: JSON.stringify({
          appointmentId: "appointment-123",
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Stripe API error");
  });
});
