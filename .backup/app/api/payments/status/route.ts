import { authOptions } from "@/lib/unified-auth";
import { PaymentService } from "@/lib/payments/PaymentService";
import { PaymentProviderType } from "@/lib/payments/types";
import { prisma } from "@/lib/prisma";
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
    const appointmentId = searchParams.get("appointment_id");

    if (!paymentId && !appointmentId) {
      return NextResponse.json(
        { error: "Se requiere payment_id o appointment_id" },
        { status: 400 }
      );
    }

    let payment;

    if (paymentId) {
      // Find payment by ID
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
                },
              },
            },
          },
        },
      });
    } else if (appointmentId) {
      // Find payment by appointment ID
      payment = await prisma.payment.findUnique({
        where: { appointmentId },
        include: {
          appointment: {
            include: {
              doctor: {
                select: {
                  name: true,
                  specialty: true,
                  city: true,
                  state: true,
                },
              },
            },
          },
        },
      });
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

    // If payment is already completed, return current status
    if (payment.status === "COMPLETED") {
      return NextResponse.json({
        id: payment.id,
        status: "completed",
        provider: payment.paymentMethod as PaymentProviderType,
        amount: payment.amount,
        currency: payment.currency,
        paidAt: payment.paidAt,
        appointment: payment.appointment,
      });
    }

    // If payment is pending, check with provider for updates
    if (payment.status === "PENDING") {
      const paymentService = new PaymentService();
      const provider = payment.paymentMethod as PaymentProviderType;

      let providerPaymentId: string | null = null;

      // Get the provider-specific payment ID
      switch (provider) {
        case "stripe":
          providerPaymentId =
            payment.stripePaymentId || payment.stripeSessionId;
          break;
        case "paypal":
          providerPaymentId = payment.paypalOrderId || payment.paypalPaymentId;
          break;
        case "mercadopago":
          providerPaymentId = payment.mercadopagoId;
          break;
      }

      if (providerPaymentId) {
        try {
          const providerStatus = await paymentService.getPaymentStatus(
            provider,
            providerPaymentId
          );

          if (providerStatus) {
            // Update payment status in database if it changed
            if (providerStatus.status !== payment.status.toLowerCase()) {
              const updatedPayment = await prisma.payment.update({
                where: { id: payment.id },
                data: {
                  status: providerStatus.status.toUpperCase() as any,
                  paidAt: providerStatus.paidAt || undefined,
                  paymentData: providerStatus.metadata || undefined,
                },
                include: {
                  appointment: {
                    include: {
                      doctor: {
                        select: {
                          name: true,
                          specialty: true,
                          city: true,
                          state: true,
                        },
                      },
                    },
                  },
                },
              });

              // If payment is now completed, update appointment status
              if (providerStatus.status === "completed") {
                await prisma.appointment.update({
                  where: { id: payment.appointmentId! },
                  data: { paymentStatus: "PAID" },
                });
              }

              return NextResponse.json({
                id: updatedPayment.id,
                status: providerStatus.status,
                provider: provider,
                amount: updatedPayment.amount,
                currency: updatedPayment.currency,
                paidAt: updatedPayment.paidAt,
                appointment: updatedPayment.appointment,
                metadata: providerStatus.metadata,
              });
            }

            return NextResponse.json({
              id: payment.id,
              status: providerStatus.status,
              provider: provider,
              amount: payment.amount,
              currency: payment.currency,
              paidAt: providerStatus.paidAt,
              appointment: payment.appointment,
              metadata: providerStatus.metadata,
            });
          }
        } catch (error) {
          console.error("Error checking payment status with provider:", error);
          // Continue with database status if provider check fails
        }
      }
    }

    // Return current database status
    return NextResponse.json({
      id: payment.id,
      status: payment.status.toLowerCase(),
      provider: payment.paymentMethod as PaymentProviderType,
      amount: payment.amount,
      currency: payment.currency,
      paidAt: payment.paidAt,
      failureReason: payment.failureReason,
      appointment: payment.appointment,
    });
  } catch (error) {
    console.error("Error checking payment status:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { paymentIds } = body;

    if (!paymentIds || !Array.isArray(paymentIds)) {
      return NextResponse.json(
        { error: "Se requiere un array de payment IDs" },
        { status: 400 }
      );
    }

    // Batch status check for multiple payments
    const payments = await prisma.payment.findMany({
      where: {
        id: { in: paymentIds },
        userId: session.user.id,
      },
      include: {
        appointment: {
          include: {
            doctor: {
              select: {
                name: true,
                specialty: true,
                city: true,
                state: true,
              },
            },
          },
        },
      },
    });

    const paymentService = new PaymentService();
    const statusResults = [];

    for (const payment of payments) {
      const status = {
        id: payment.id,
        status: payment.status.toLowerCase(),
        provider: payment.paymentMethod as PaymentProviderType,
        amount: payment.amount,
        currency: payment.currency,
        paidAt: payment.paidAt,
        appointment: payment.appointment,
      };

      // Check with provider if payment is pending
      if (payment.status === "PENDING") {
        const provider = payment.paymentMethod as PaymentProviderType;
        let providerPaymentId: string | null = null;

        switch (provider) {
          case "stripe":
            providerPaymentId =
              payment.stripePaymentId || payment.stripeSessionId;
            break;
          case "paypal":
            providerPaymentId =
              payment.paypalOrderId || payment.paypalPaymentId;
            break;
          case "mercadopago":
            providerPaymentId = payment.mercadopagoId;
            break;
        }

        if (providerPaymentId) {
          try {
            const providerStatus = await paymentService.getPaymentStatus(
              provider,
              providerPaymentId
            );

            if (
              providerStatus &&
              providerStatus.status !== payment.status.toLowerCase()
            ) {
              // Update in database
              await prisma.payment.update({
                where: { id: payment.id },
                data: {
                  status: providerStatus.status.toUpperCase() as any,
                  paidAt: providerStatus.paidAt || undefined,
                },
              });

              status.status = providerStatus.status;
              status.paidAt = providerStatus.paidAt;

              // Update appointment if payment completed
              if (providerStatus.status === "completed") {
                await prisma.appointment.update({
                  where: { id: payment.appointmentId! },
                  data: { paymentStatus: "PAID" },
                });
              }
            }
          } catch (error) {
            console.error(
              `Error checking status for payment ${payment.id}:`,
              error
            );
          }
        }
      }

      statusResults.push(status);
    }

    return NextResponse.json({ payments: statusResults });
  } catch (error) {
    console.error("Error in batch payment status check:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
