
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/unified-auth';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { reason } = body;

    // Obtener la cita con información completa
    const appointment = await prisma.appointment.findUnique({
      where: { id: params.id },
      include: {
        patient: true,
        doctor: {
          include: {
            user: true
          }
        },
        payment: true
      }
    });

    if (!appointment) {
      return NextResponse.json(
        { error: 'Cita no encontrada' },
        { status: 404 }
      );
    }

    // Verificar autorización
    if (appointment.patientId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No autorizado para cancelar esta cita' },
        { status: 403 }
      );
    }

    // Verificar que la cita se puede cancelar
    if (appointment.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Esta cita ya está cancelada' },
        { status: 400 }
      );
    }

    if (appointment.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'No se puede cancelar una cita completada' },
        { status: 400 }
      );
    }

    const appointmentDate = new Date(appointment.scheduledAt);
    const now = new Date();
    const hoursUntilAppointment = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Calcular reembolso según políticas de cancelación
    let refundPercentage = 0;
    let refundReason = '';

    if (hoursUntilAppointment >= 24) {
      refundPercentage = 100;
      refundReason = 'Cancelación con más de 24 horas de anticipación';
    } else if (hoursUntilAppointment >= 2) {
      refundPercentage = 50;
      refundReason = 'Cancelación entre 2-24 horas de anticipación';
    } else {
      refundPercentage = 0;
      refundReason = 'Cancelación con menos de 2 horas de anticipación';
    }

    // Procesar reembolso si aplica y hay pago
    let refundAmount = 0;
    if (appointment.payment && appointment.payment.status === 'COMPLETED' && refundPercentage > 0) {
      refundAmount = Math.round((appointment.payment.amount * refundPercentage) / 100);

      try {
        // Crear reembolso en Stripe
        const refund = await stripe.refunds.create({
          payment_intent: appointment.payment.stripePaymentId!,
          amount: refundAmount,
          reason: 'requested_by_customer',
          metadata: {
            appointment_id: appointment.id,
            cancellation_reason: reason || 'Cancelado por el paciente',
            refund_percentage: refundPercentage.toString(),
            hours_until_appointment: hoursUntilAppointment.toString()
          }
        });

        // Actualizar el pago en la base de datos
        await prisma.payment.update({
          where: { id: appointment.payment.id },
          data: {
            status: refundPercentage === 100 ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
            refundAmount,
            refundReason,
            refundedAt: new Date(),
            metadata: {
              ...appointment.payment.metadata as any,
              stripe_refund_id: refund.id,
              refund_percentage: refundPercentage,
              refund_processed_at: new Date().toISOString()
            }
          }
        });

      } catch (stripeError) {
        console.error('Error processing refund:', stripeError);
        // Continuar con la cancelación aunque falle el reembolso
      }
    }

    // Cancelar la cita
    const cancelledAppointment = await prisma.appointment.update({
      where: { id: params.id },
      data: {
        status: 'CANCELLED',
        cancellationReason: reason || 'Cancelado por el paciente',
        cancelledAt: new Date()
      }
    });

    // TODO: Enviar notificaciones de cancelación

    return NextResponse.json({
      id: cancelledAppointment.id,
      status: cancelledAppointment.status,
      cancellationReason: cancelledAppointment.cancellationReason,
      cancelledAt: cancelledAppointment.cancelledAt,
      refund: refundAmount > 0 ? {
        amount: refundAmount,
        percentage: refundPercentage,
        reason: refundReason
      } : null
    });

  } catch (error) {
    console.error('Error cancelling appointment:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
