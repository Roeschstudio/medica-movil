import { authOptions } from "@/lib/unified-auth";
import { PaymentService } from "@/lib/payments/PaymentService";
import { MercadoPagoProvider } from "@/lib/payments/mercadopago/MercadoPagoProvider";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

// Initialize payment service with MercadoPago provider
const paymentService = new PaymentService();
paymentService.registerProvider(new MercadoPagoProvider());

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

    if (!returnUrl || !cancelUrl) {
      return NextResponse.json(
        { error: "Return URL and Cancel URL are required" },
        { status: 400 }
      );
    }

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
      returnUrl,
      cancelUrl,
      metadata: {
        appointmentId: appointment.id,
        doctorId: appointment.doctorId,
        patientId: appointment.patientId,
        consultationType: appointment.type,
      },
    };

    // Create MercadoPago preference
    const result = await paymentService.createPayment(
      "mercadopago",
      paymentRequest
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to create MercadoPago preference" },
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
        method: "MERCADOPAGO_CARD", // Default, will be updated based on actual payment method
        provider: "MERCADOPAGO",
        status: "PENDING",
        mercadopagoId: result.paymentId,
        paymentData: result.metadata,
      },
    });

    // Update appointment with payment ID
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { paymentId: payment.id },
    });

    // Get available payment methods for Mexican users
    const mercadoPagoProvider = paymentService.getProvider(
      "mercadopago"
    ) as MercadoPagoProvider;
    const availablePaymentMethods =
      mercadoPagoProvider?.getAvailablePaymentMethods();

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      preferenceId: result.paymentId,
      checkoutUrl: result.checkoutUrl,
      availablePaymentMethods,
      metadata: result.metadata,
    });
  } catch (error) {
    console.error("MercadoPago preference creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
