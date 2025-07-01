
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { stripe, getPaymentMethodConfig, createAppointmentMetadata, MexicanPaymentMethod } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      appointmentId,
      paymentMethod = 'card'
    } = body;

    if (!appointmentId) {
      return NextResponse.json(
        { error: 'ID de cita requerido' },
        { status: 400 }
      );
    }

    // Verificar que la cita existe y pertenece al usuario
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: {
          include: {
            user: true
          }
        },
        patient: true
      }
    });

    if (!appointment) {
      return NextResponse.json(
        { error: 'Cita no encontrada' },
        { status: 404 }
      );
    }

    if (appointment.patientId !== session.user.id) {
      return NextResponse.json(
        { error: 'No autorizado para esta cita' },
        { status: 403 }
      );
    }

    if (appointment.paymentId) {
      return NextResponse.json(
        { error: 'Esta cita ya tiene un pago asociado' },
        { status: 400 }
      );
    }

    // Configurar método de pago
    const paymentConfig = getPaymentMethodConfig(paymentMethod as MexicanPaymentMethod);

    // Crear sesión de Stripe
    const stripeSession = await stripe.checkout.sessions.create({
      ...paymentConfig,
      mode: 'payment',
      currency: 'mxn',
      customer_email: appointment.patient.email,
      line_items: [
        {
          price_data: {
            currency: 'mxn',
            product_data: {
              name: `Consulta médica - ${appointment.doctor.user.name}`,
              description: `${appointment.doctor.specialty} - ${new Date(appointment.scheduledAt).toLocaleDateString('es-MX', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}`,
              images: appointment.doctor.profileImage ? [appointment.doctor.profileImage] : undefined,
              metadata: {
                doctor_name: appointment.doctor.user.name,
                specialty: appointment.doctor.specialty,
                consultation_type: appointment.type
              }
            },
            unit_amount: appointment.price,
          },
          quantity: 1,
        },
      ],
      metadata: createAppointmentMetadata({
        appointmentId: appointment.id,
        doctorId: appointment.doctorId,
        patientId: appointment.patientId,
        consultationType: appointment.type,
        scheduledAt: appointment.scheduledAt.toISOString()
      }),
      success_url: `${process.env.NEXTAUTH_URL}/paciente/citas?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/paciente/citas?payment=cancelled`,
      expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutos
      locale: 'es',
      billing_address_collection: 'required',
      phone_number_collection: {
        enabled: true
      }
    });

    // Crear registro de pago en la base de datos
    const payment = await prisma.payment.create({
      data: {
        userId: session.user.id,
        appointmentId,
        amount: appointment.price,
        currency: 'MXN',
        method: paymentMethod === 'oxxo' ? 'OXXO' : paymentMethod === 'customer_balance' ? 'SPEI' : 'CARD',
        status: 'PENDING',
        stripeSessionId: stripeSession.id,
        metadata: {
          stripe_session_id: stripeSession.id,
          payment_method_selected: paymentMethod
        }
      }
    });

    // Actualizar la cita con el ID del pago
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { paymentId: payment.id }
    });

    return NextResponse.json({
      sessionId: stripeSession.id,
      sessionUrl: stripeSession.url,
      paymentId: payment.id
    });

  } catch (error) {
    console.error('Error creating payment session:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
