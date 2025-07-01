
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    console.error('No Stripe signature found');
    return NextResponse.json(
      { error: 'No signature found' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      
      case 'checkout.session.expired':
        await handleCheckoutSessionExpired(event.data.object as Stripe.Checkout.Session);
        break;
      
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Error processing webhook' },
      { status: 500 }
    );
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('Checkout session completed:', session.id);

  try {
    // Encontrar el pago por session ID
    const payment = await prisma.payment.findFirst({
      where: { stripeSessionId: session.id },
      include: {
        appointment: {
          include: {
            doctor: true,
            patient: true
          }
        }
      }
    });

    if (!payment) {
      console.error('Payment not found for session:', session.id);
      return;
    }

    // Actualizar el pago
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        stripePaymentId: session.payment_intent as string,
        metadata: {
          ...payment.metadata as any,
          stripe_payment_intent: session.payment_intent,
          payment_completed_at: new Date().toISOString()
        }
      }
    });

    // Actualizar el estado de la cita
    if (payment.appointment) {
      await prisma.appointment.update({
        where: { id: payment.appointment.id },
        data: { status: 'CONFIRMED' }
      });

      // TODO: Enviar notificaciones de confirmación
      console.log('Appointment confirmed:', payment.appointment.id);
    }

  } catch (error) {
    console.error('Error handling checkout session completed:', error);
  }
}

async function handleCheckoutSessionExpired(session: Stripe.Checkout.Session) {
  console.log('Checkout session expired:', session.id);

  try {
    // Encontrar el pago por session ID
    const payment = await prisma.payment.findFirst({
      where: { stripeSessionId: session.id },
      include: { appointment: true }
    });

    if (!payment) {
      console.error('Payment not found for expired session:', session.id);
      return;
    }

    // Marcar el pago como fallido
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        metadata: {
          ...payment.metadata as any,
          failure_reason: 'session_expired',
          expired_at: new Date().toISOString()
        }
      }
    });

    // Cancelar la cita
    if (payment.appointment) {
      await prisma.appointment.update({
        where: { id: payment.appointment.id },
        data: { 
          status: 'CANCELLED',
          cancellationReason: 'Pago no completado - sesión expirada'
        }
      });
    }

  } catch (error) {
    console.error('Error handling checkout session expired:', error);
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment intent succeeded:', paymentIntent.id);
  
  try {
    // Buscar el pago por payment intent ID
    const payment = await prisma.payment.findFirst({
      where: { stripePaymentId: paymentIntent.id }
    });

    if (payment && payment.status !== 'COMPLETED') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          metadata: {
            ...payment.metadata as any,
            amount_received: paymentIntent.amount_received,
            payment_intent_status: paymentIntent.status
          }
        }
      });
    }

  } catch (error) {
    console.error('Error handling payment intent succeeded:', error);
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment intent failed:', paymentIntent.id);
  
  try {
    // Buscar el pago por payment intent ID
    const payment = await prisma.payment.findFirst({
      where: { stripePaymentId: paymentIntent.id },
      include: { appointment: true }
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          metadata: {
            ...payment.metadata as any,
            failure_code: paymentIntent.last_payment_error?.code,
            failure_message: paymentIntent.last_payment_error?.message,
            failed_at: new Date().toISOString()
          }
        }
      });

      // Cancelar la cita si existe
      if (payment.appointment) {
        await prisma.appointment.update({
          where: { id: payment.appointment.id },
          data: { 
            status: 'CANCELLED',
            cancellationReason: 'Pago fallido'
          }
        });
      }
    }

  } catch (error) {
    console.error('Error handling payment intent failed:', error);
  }
}
