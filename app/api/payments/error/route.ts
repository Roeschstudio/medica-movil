import { authOptions } from "@/lib/unified-auth";
import { PaymentProviderType } from "@/lib/payments/types";
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
    const appointmentId = searchParams.get("appointment_id");
    const error = searchParams.get("error");
    const provider = searchParams.get("provider") as PaymentProviderType;

    if (!appointmentId) {
      return NextResponse.json(
        { error: "Se requiere appointment_id" },
        { status: 400 }
      );
    }

    // Find the appointment and associated payment
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: {
          select: {
            name: true,
            specialty: true,
            city: true,
            state: true,
          },
        },
        payment: true,
      },
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Cita no encontrada" },
        { status: 404 }
      );
    }

    // Verify user owns this appointment
    if (appointment.patientId !== session.user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Map error codes to user-friendly messages and suggested actions
    const getErrorDetails = (
      errorCode: string,
      provider: PaymentProviderType
    ) => {
      const errorMap: Record<
        string,
        {
          message: string;
          retryable: boolean;
          suggestedActions: string[];
        }
      > = {
        cancelled: {
          message:
            "Has cancelado el proceso de pago. Tu cita no ha sido confirmada.",
          retryable: true,
          suggestedActions: [
            "Puedes intentar nuevamente con el mismo método de pago",
            "Prueba con un método de pago diferente",
            "Verifica que tengas fondos suficientes",
          ],
        },
        user_cancelled: {
          message:
            "Has cancelado el proceso de pago. Tu cita no ha sido confirmada.",
          retryable: true,
          suggestedActions: [
            "Puedes intentar nuevamente cuando estés listo",
            "Considera usar un método de pago diferente",
          ],
        },
        payment_failed: {
          message:
            "No se pudo procesar tu pago. Por favor, verifica tus datos e intenta nuevamente.",
          retryable: true,
          suggestedActions: [
            "Verifica que los datos de tu tarjeta sean correctos",
            "Asegúrate de tener fondos suficientes",
            "Contacta a tu banco si el problema persiste",
            "Prueba con otro método de pago",
          ],
        },
        insufficient_funds: {
          message:
            "Fondos insuficientes. Por favor, verifica tu saldo o usa otro método de pago.",
          retryable: true,
          suggestedActions: [
            "Verifica el saldo de tu cuenta",
            "Usa una tarjeta diferente",
            "Contacta a tu banco para verificar límites",
          ],
        },
        card_declined: {
          message:
            "Tu tarjeta fue rechazada. Por favor, contacta a tu banco o usa otro método de pago.",
          retryable: true,
          suggestedActions: [
            "Contacta a tu banco para verificar el estado de tu tarjeta",
            "Verifica que tu tarjeta esté habilitada para compras en línea",
            "Prueba con una tarjeta diferente",
            "Usa otro método de pago como PayPal o MercadoPago",
          ],
        },
        expired_card: {
          message: "Tu tarjeta ha expirado. Por favor, usa una tarjeta válida.",
          retryable: true,
          suggestedActions: [
            "Usa una tarjeta que no haya expirado",
            "Contacta a tu banco para obtener una nueva tarjeta",
            "Prueba con otro método de pago",
          ],
        },
        invalid_card: {
          message:
            "Los datos de la tarjeta son inválidos. Verifica la información e intenta nuevamente.",
          retryable: true,
          suggestedActions: [
            "Verifica el número de tarjeta",
            "Confirma la fecha de expiración",
            "Revisa el código de seguridad (CVV)",
            "Asegúrate de que el nombre coincida con el de la tarjeta",
          ],
        },
        network_error: {
          message:
            "Error de conexión. Por favor, verifica tu internet e intenta nuevamente.",
          retryable: true,
          suggestedActions: [
            "Verifica tu conexión a internet",
            "Intenta nuevamente en unos minutos",
            "Usa una conexión más estable",
          ],
        },
        provider_error: {
          message: `Error en el sistema de ${provider}. Por favor, intenta nuevamente o usa otro método de pago.`,
          retryable: true,
          suggestedActions: [
            "Intenta nuevamente en unos minutos",
            "Usa un método de pago diferente",
            "Contacta nuestro soporte si el problema persiste",
          ],
        },
        session_expired: {
          message:
            "La sesión de pago ha expirado. Por favor, inicia el proceso nuevamente.",
          retryable: true,
          suggestedActions: [
            "Inicia el proceso de pago nuevamente",
            "Completa el pago más rápidamente",
            "Verifica tu conexión a internet",
          ],
        },
        authentication_failed: {
          message:
            "Falló la autenticación del pago. Verifica tus datos e intenta nuevamente.",
          retryable: true,
          suggestedActions: [
            "Verifica que los datos sean correctos",
            "Contacta a tu banco si tienes autenticación 3D Secure",
            "Prueba con una tarjeta diferente",
          ],
        },
        unknown_error: {
          message: "Ocurrió un error inesperado durante el proceso de pago.",
          retryable: true,
          suggestedActions: [
            "Intenta nuevamente en unos minutos",
            "Usa un método de pago diferente",
            "Contacta nuestro soporte técnico",
          ],
        },
      };

      return errorMap[errorCode] || errorMap["unknown_error"];
    };

    const errorDetails = getErrorDetails(
      error || "unknown_error",
      provider || "stripe"
    );

    // Update payment record with failure information if it exists
    if (appointment.payment) {
      await prisma.payment.update({
        where: { id: appointment.payment.id },
        data: {
          status: "FAILED",
          failureReason: errorDetails.message,
          paymentData: {
            error: error,
            provider: provider,
            timestamp: new Date().toISOString(),
          },
        },
      });
    }

    return NextResponse.json({
      appointment: {
        id: appointment.id,
        scheduledAt: appointment.scheduledAt.toISOString(),
        type: appointment.type,
        doctor: appointment.doctor,
      },
      error: {
        code: error || "unknown_error",
        message: errorDetails.message,
        provider: provider || "unknown",
        retryable: errorDetails.retryable,
        suggestedActions: errorDetails.suggestedActions,
      },
    });
  } catch (error) {
    console.error("Error fetching payment error data:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
