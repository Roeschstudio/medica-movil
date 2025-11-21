import { PaymentService } from "@/lib/payments/PaymentService";
import { StripeProvider } from "@/lib/payments/stripe/StripeProvider";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

// Initialize payment service with Stripe provider
const paymentService = new PaymentService();
paymentService.registerProvider(new StripeProvider());

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = headers();
    const signature = headersList.get("stripe-signature");

    if (!signature) {
      console.error("No Stripe signature found");
      return NextResponse.json(
        { error: "No signature found" },
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
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json(
        { error: "Webhook signature verification failed" },
        { status: 400 }
      );
    }

    console.log("Stripe webhook received:", {
      eventType: event.type,
      objectId: event.data.object.id,
    });

    // Process webhook with Stripe provider
    const processed = await paymentService.processWebhook(
      "stripe",
      event,
      signature
    );

    if (!processed) {
      console.error("Failed to process Stripe webhook");
      return NextResponse.json(
        { error: "Failed to process webhook" },
        { status: 400 }
      );
    }

    // Handle specific webhook events
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      case "checkout.session.expired":
        await handleCheckoutSessionExpired(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent
        );
        break;
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(
          event.data.object as Stripe.PaymentIntent
        );
        break;
      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing Stripe webhook:", error);
    return NextResponse.json(
      { error: "Error processing webhook" },
      { status: 500 }
    );
  }
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
) {
  console.log("Checkout session completed:", session.id);

  try {
    // Find payment by session ID
    const payment = await prisma.payment.findFirst({
      where: { stripeSessionId: session.id },
      include: {
        appointment: {
          include: {
            doctor: true,
            patient: true,
          },
        },
      },
    });

    if (!payment) {
      console.error("Payment not found for session:", session.id);
      return;
    }

    // Update payment status to completed
    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "COMPLETED",
        provider: "STRIPE",
        paidAt: new Date(),
        stripePaymentId: session.payment_intent as string,
        paymentData: {
          ...(payment.paymentData as any),
          stripePaymentIntent: session.payment_intent,
          paymentCompletedAt: new Date().toISOString(),
          webhookProcessed: true,
        },
        updatedAt: new Date(),
      },
    });

    // Update appointment status to confirmed and create payment distribution
    if (payment.appointment) {
      await prisma.$transaction(async (tx) => {
        // Confirm the appointment
        await tx.appointment.update({
          where: { id: payment.appointment!.id },
          data: {
            status: "CONFIRMED",
            updatedAt: new Date(),
          },
        });

        // Activate the chat room associated with the appointment
        await tx.chatRoom.updateMany({
          where: { appointmentId: payment.appointment!.id },
          data: {
            isActive: true,
            startedAt: new Date(),
          },
        });

        // Create payment distribution if not exists
        const existingDistribution = await tx.paymentDistribution.findFirst({
          where: { paymentId: payment.id },
        });

        if (!existingDistribution) {
          const doctorPercentage = 0.85;
          const adminPercentage = 0.15;
          const doctorAmount = Math.round(payment.amount * doctorPercentage);
          const adminAmount = payment.amount - doctorAmount;

          await tx.paymentDistribution.create({
            data: {
              paymentId: payment.id,
              doctorId: payment.appointment!.doctorId,
              doctorAmount,
              adminAmount,
              doctorPercentage,
              adminPercentage,
              status: "PENDING",
            },
          });
        }
      });

      console.log(
        "Appointment confirmed and chat room activated:",
        payment.appointment.id
      );
    }
  } catch (error) {
    console.error("Error handling checkout session completed:", error);
  }
}

async function handleCheckoutSessionExpired(session: Stripe.Checkout.Session) {
  console.log("Checkout session expired:", session.id);

  try {
    // Find payment by session ID
    const payment = await prisma.payment.findFirst({
      where: { stripeSessionId: session.id },
      include: { appointment: true },
    });

    if (!payment) {
      console.error("Payment not found for expired session:", session.id);
      return;
    }

    // Update payment status to failed
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        failureReason: "Session expired",
        paymentData: {
          ...(payment.paymentData as any),
          failureReason: "session_expired",
          expiredAt: new Date().toISOString(),
          webhookProcessed: true,
        },
        updatedAt: new Date(),
      },
    });

    // Cancel the appointment
    if (payment.appointment) {
      await prisma.appointment.update({
        where: { id: payment.appointment.id },
        data: {
          status: "CANCELLED",
          cancellationReason: "Payment session expired",
          updatedAt: new Date(),
        },
      });
    }
  } catch (error) {
    console.error("Error handling checkout session expired:", error);
  }
}

async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent
) {
  console.log("Payment intent succeeded:", paymentIntent.id);

  try {
    // Find payment by payment intent ID
    const payment = await prisma.payment.findFirst({
      where: { stripePaymentId: paymentIntent.id },
    });

    if (payment && payment.status !== "COMPLETED") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "COMPLETED",
          paidAt: new Date(),
          paymentData: {
            ...(payment.paymentData as any),
            amountReceived: paymentIntent.amount_received,
            paymentIntentStatus: paymentIntent.status,
            webhookProcessed: true,
          },
          updatedAt: new Date(),
        },
      });
    }
  } catch (error) {
    console.error("Error handling payment intent succeeded:", error);
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log("Payment intent failed:", paymentIntent.id);

  try {
    // Find payment by payment intent ID
    const payment = await prisma.payment.findFirst({
      where: { stripePaymentId: paymentIntent.id },
      include: { appointment: true },
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          failureReason:
            paymentIntent.last_payment_error?.message || "Payment failed",
          paymentData: {
            ...(payment.paymentData as any),
            failureCode: paymentIntent.last_payment_error?.code,
            failureMessage: paymentIntent.last_payment_error?.message,
            failedAt: new Date().toISOString(),
            webhookProcessed: true,
          },
          updatedAt: new Date(),
        },
      });

      // Cancel the appointment if exists
      if (payment.appointment) {
        await prisma.appointment.update({
          where: { id: payment.appointment.id },
          data: {
            status: "CANCELLED",
            cancellationReason: "Payment failed",
            updatedAt: new Date(),
          },
        });
      }
    }
  } catch (error) {
    console.error("Error handling payment intent failed:", error);
  }
}
