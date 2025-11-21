import { authOptions } from "@/lib/unified-auth";
import { PaymentService } from "@/lib/payments/PaymentService";
import { StripeProvider } from "@/lib/payments/stripe/StripeProvider";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

// Initialize payment service with Stripe provider
const paymentService = new PaymentService();
paymentService.registerProvider(new StripeProvider());

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { appointmentId } = body;

    if (!appointmentId) {
      return NextResponse.json(
        { error: "Se requiere el ID de la cita" },
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
        { error: "Cita no encontrada" },
        { status: 404 }
      );
    }

    // Verify user owns the appointment
    if (appointment.patientId !== session.user.id) {
      return NextResponse.json(
        { error: "No autorizado para esta cita" },
        { status: 403 }
      );
    }

    // Check if appointment already has a completed payment
    const existingPayment = await prisma.payment.findUnique({
      where: { appointmentId: appointment.id },
    });

    if (existingPayment && existingPayment.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Esta cita ya ha sido pagada" },
        { status: 400 }
      );
    }

    // Create payment request
    const paymentRequest = {
      appointmentId: appointment.id,
      amount: appointment.price,
      currency: "MXN",
      description: `Consulta médica con Dr. ${appointment.doctor.user.name}`,
      patientEmail: appointment.patient.email,
      patientName: appointment.patient.name,
      returnUrl: `${process.env.NEXTAUTH_URL}/pago/exito?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.NEXTAUTH_URL}/pago/cancelado?error=cancelled&appointment_id=${appointmentId}&provider=stripe`,
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
        { error: result.error || "Error al crear la sesión de Stripe" },
        { status: 400 }
      );
    }

    // Create or update payment record in database
    let payment;
    if (existingPayment) {
      payment = await prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          status: "PENDING",
          paymentMethod: "stripe",
          stripeSessionId: result.paymentId,
          paymentData: result.metadata,
          updatedAt: new Date(),
        },
      });
    } else {
      payment = await prisma.payment.create({
        data: {
          userId: session.user.id,
          appointmentId: appointment.id,
          amount: appointment.price,
          currency: "MXN",
          paymentMethod: "stripe",
          status: "PENDING",
          stripeSessionId: result.paymentId,
          paymentData: result.metadata,
        },
      });
    }

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      sessionId: result.paymentId,
      checkoutUrl: result.checkoutUrl,
      provider: "stripe",
    });
  } catch (error) {
    console.error("Error creating Stripe session:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
