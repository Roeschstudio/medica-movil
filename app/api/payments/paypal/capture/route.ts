import { authOptions } from "@/lib/unified-auth";
import { PaymentService } from "@/lib/payments/PaymentService";
import { PayPalProvider } from "@/lib/payments/paypal/PayPalProvider";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

// Initialize payment service with PayPal provider
const paymentService = new PaymentService();
paymentService.registerProvider(new PayPalProvider());

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
    const { paypalOrderId } = body;

    // Validate required fields
    if (!paypalOrderId) {
      return NextResponse.json(
        { error: "PayPal Order ID is required" },
        { status: 400 }
      );
    }

    // Find payment record
    const payment = await prisma.payment.findUnique({
      where: { paypalOrderId },
      include: {
        appointment: {
          include: {
            patient: true,
            doctor: {
              include: { user: true },
            },
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Verify user owns the payment
    if (payment.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized access to payment" },
        { status: 403 }
      );
    }

    // Check if payment is already completed
    if (payment.status === "COMPLETED") {
      return NextResponse.json({
        success: true,
        message: "Payment already completed",
        paymentId: payment.id,
        status: payment.status,
      });
    }

    // Capture PayPal payment
    const result = await paymentService.capturePayment("paypal", paypalOrderId);

    if (!result.success) {
      // Update payment with failure reason
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          failureReason: result.error,
          updatedAt: new Date(),
        },
      });

      return NextResponse.json(
        { error: result.error || "Failed to capture PayPal payment" },
        { status: 400 }
      );
    }

    // Update payment status to completed
    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "COMPLETED",
        paidAt: new Date(),
        paymentData: {
          ...(payment.paymentData as any),
          ...result.metadata,
        },
        updatedAt: new Date(),
      },
    });

    // Update appointment status to confirmed
    if (payment.appointment) {
      await prisma.appointment.update({
        where: { id: payment.appointment.id },
        data: {
          status: "CONFIRMED",
          updatedAt: new Date(),
        },
      });

      // Create payment distribution record
      const doctorPercentage = 0.85; // 85% to doctor, 15% to platform
      const adminPercentage = 0.15;
      const doctorAmount = Math.round(payment.amount * doctorPercentage);
      const adminAmount = payment.amount - doctorAmount;

      await prisma.paymentDistribution.create({
        data: {
          paymentId: payment.id,
          doctorId: payment.appointment.doctorId,
          doctorAmount,
          adminAmount,
          doctorPercentage,
          adminPercentage,
          status: "PENDING",
        },
      });
    }

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      status: updatedPayment.status,
      paidAt: updatedPayment.paidAt,
      appointmentId: payment.appointmentId,
      metadata: result.metadata,
    });
  } catch (error) {
    console.error("PayPal capture error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
