import { authOptions } from "@/lib/unified-auth";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get("payment_id");
    const sessionId = searchParams.get("session_id"); // Stripe
    const orderId = searchParams.get("order_id"); // PayPal
    const preferenceId = searchParams.get("preference_id"); // MercadoPago

    let payment;

    if (paymentId) {
      payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          appointment: {
            include: {
              doctor: {
                select: {
                  name: true,
                  specialty: true,
                  city: true,
                  state: true,
                  profileImage: true,
                },
              },
            },
          },
        },
      });
    } else if (sessionId) {
      // Stripe session ID
      payment = await prisma.payment.findFirst({
        where: { stripeSessionId: sessionId },
        include: {
          appointment: {
            include: {
              doctor: {
                select: {
                  name: true,
                  specialty: true,
                  city: true,
                  state: true,
                  profileImage: true,
                },
              },
            },
          },
        },
      });
    } else if (orderId) {
      // PayPal order ID
      payment = await prisma.payment.findFirst({
        where: { paypalOrderId: orderId },
        include: {
          appointment: {
            include: {
              doctor: {
                select: {
                  name: true,
                  specialty: true,
                  city: true,
                  state: true,
                  profileImage: true,
                },
              },
            },
          },
        },
      });
    } else if (preferenceId) {
      // MercadoPago preference ID
      payment = await prisma.payment.findFirst({
        where: { mercadopagoId: preferenceId },
        include: {
          appointment: {
            include: {
              doctor: {
                select: {
                  name: true,
                  specialty: true,
                  city: true,
                  state: true,
                  profileImage: true,
                },
              },
            },
          },
        },
      });
    } else {
      return NextResponse.json(
        {
          error: "Se requiere payment_id, session_id, order_id o preference_id",
        },
        { status: 400 }
      );
    }

    if (!payment) {
      return NextResponse.json(
        { error: "Pago no encontrado" },
        { status: 404 }
      );
    }

    // Verify user owns this payment
    if (payment.userId !== session.user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Only return success data for completed payments
    if (payment.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "El pago no ha sido completado" },
        { status: 400 }
      );
    }

    if (!payment.appointment) {
      return NextResponse.json(
        { error: "Cita no encontrada" },
        { status: 404 }
      );
    }

    // Return success data
    return NextResponse.json({
      appointment: {
        id: payment.appointment.id,
        scheduledAt: payment.appointment.scheduledAt.toISOString(),
        type: payment.appointment.type,
        notes: payment.appointment.notes,
        doctor: payment.appointment.doctor,
      },
      payment: {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        provider: payment.paymentMethod,
        paidAt: payment.paidAt?.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching payment success data:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
