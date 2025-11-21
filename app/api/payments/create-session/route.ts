import { authOptions } from "@/lib/unified-auth";
import { PaymentService } from "@/lib/payments/PaymentService";
import { StripeProvider } from "@/lib/payments/stripe/StripeProvider";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

// Initialize payment service with Stripe provider
const paymentService = new PaymentService();
paymentService.registerProvider(new StripeProvider());

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { appointmentId, returnUrl, cancelUrl } = body;

    // Validate required fields
    if (!appointmentId) {
      return NextResponse.json(
        { error: "Appointment ID is required" },
        { status: 400 }
      );
    }

    // Use default URLs if not provided
    const successUrl =
      returnUrl || `${process.env.NEXTAUTH_URL}/paciente/citas?payment=success`;
    const cancelledUrl =
      cancelUrl ||
      `${process.env.NEXTAUTH_URL}/paciente/citas?payment=cancelled`;

    // Get appointment details
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        doctor: {
          include: { user: true },
        },
      },
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    // Verify user owns the appointment
    if (appointment.patientId !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized access to appointment" },
        { status: 403 }
      );
    }

    // Check if appointment already has a payment
    if (appointment.paymentId) {
      const existingPayment = await prisma.payment.findUnique({
        where: { id: appointment.paymentId },
      });

      if (existingPayment && existingPayment.status === "COMPLETED") {
        return NextResponse.json(
          { error: "Appointment is already paid" },
          { status: 400 }
        );
      }
    }

    // Create payment request
    const paymentRequest = {
      appointmentId: appointment.id,
      amount: appointment.price,
      currency: "MXN",
      description: `Consulta médica con Dr. ${appointment.doctor.user.name}`,
      patientEmail: appointment.patient.email,
      patientName: appointment.patient.name,
      returnUrl: successUrl,
      cancelUrl: cancelledUrl,
      metadata: {
        appointmentId: appointment.id,
        doctorId: appointment.doctorId,
        patientId: appointment.patientId,
        consultationType: appointment.type,
      },
    };

    // Create Stripe session
    const result = await paymentService.createPayment("stripe", paymentRequest);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to create Stripe session" },
        { status: 400 }
      );
    }

    // Create payment record in database
    const payment = await prisma.payment.create({
      data: {
        userId: session.user.id,
        appointmentId: appointment.id,
        amount: appointment.price,
        currency: "MXN",
        method: "CARD",
        provider: "STRIPE",
        status: "PENDING",
        stripeSessionId: result.paymentId,
        paymentData: result.metadata,
      },
    });

    // Update appointment with payment ID
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { paymentId: payment.id },
    });

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      sessionId: result.paymentId,
      sessionUrl: result.checkoutUrl,
      metadata: result.metadata,
    });
  } catch (error) {
    console.error("Stripe session creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
