import { PaymentService } from "@/lib/payments/PaymentService";
import { PayPalProvider } from "@/lib/payments/paypal/PayPalProvider";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Initialize payment service with PayPal provider
const paymentService = new PaymentService();
paymentService.registerProvider(new PayPalProvider());

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("paypal-transmission-sig");

    let webhookData;
    try {
      webhookData = JSON.parse(body);
    } catch (error) {
      console.error("Invalid JSON in PayPal webhook:", error);
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    console.log("PayPal webhook received:", {
      eventType: webhookData.event_type,
      resourceType: webhookData.resource_type,
      resourceId: webhookData.resource?.id,
    });

    // Process webhook with PayPal provider
    const processed = await paymentService.processWebhook(
      "paypal",
      webhookData,
      signature || undefined
    );

    if (!processed) {
      console.error("Failed to process PayPal webhook");
      return NextResponse.json(
        { error: "Failed to process webhook" },
        { status: 400 }
      );
    }

    // Handle specific webhook events
    switch (webhookData.event_type) {
      case "CHECKOUT.ORDER.APPROVED":
        await handleOrderApproved(webhookData);
        break;
      case "PAYMENT.CAPTURE.COMPLETED":
        await handlePaymentCompleted(webhookData);
        break;
      case "PAYMENT.CAPTURE.DENIED":
        await handlePaymentDenied(webhookData);
        break;
      default:
        console.log("Unhandled PayPal webhook event:", webhookData.event_type);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PayPal webhook processing error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function handleOrderApproved(webhookData: any) {
  const orderId = webhookData.resource?.id;

  if (!orderId) {
    console.error("PayPal order approved webhook missing order ID");
    return;
  }

  try {
    // Find payment by PayPal order ID
    const payment = await prisma.payment.findUnique({
      where: { paypalOrderId: orderId },
    });

    if (!payment) {
      console.error("Payment not found for PayPal order:", orderId);
      return;
    }

    // Update payment status if still pending
    if (payment.status === "PENDING") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "PENDING", // Keep as pending until captured
          paymentData: {
            ...(payment.paymentData as any),
            orderApproved: true,
            approvedAt: new Date().toISOString(),
          },
          updatedAt: new Date(),
        },
      });

      console.log("PayPal order approved:", { orderId, paymentId: payment.id });
    }
  } catch (error) {
    console.error("Error handling PayPal order approved:", error);
  }
}

async function handlePaymentCompleted(webhookData: any) {
  const captureId = webhookData.resource?.id;
  const orderId =
    webhookData.resource?.supplementary_data?.related_ids?.order_id;

  if (!orderId) {
    console.error("PayPal payment completed webhook missing order ID");
    return;
  }

  try {
    // Find payment by PayPal order ID
    const payment = await prisma.payment.findUnique({
      where: { paypalOrderId: orderId },
      include: {
        appointment: true,
      },
    });

    if (!payment) {
      console.error("Payment not found for PayPal order:", orderId);
      return;
    }

    // Update payment status to completed
    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "COMPLETED",
        paidAt: new Date(),
        paymentData: {
          ...(payment.paymentData as any),
          captureId,
          capturedAt: new Date().toISOString(),
          webhookProcessed: true,
        },
        updatedAt: new Date(),
      },
    });

    // Update appointment status to confirmed
    if (payment.appointment && payment.appointment.status !== "CONFIRMED") {
      await prisma.appointment.update({
        where: { id: payment.appointment.id },
        data: {
          status: "CONFIRMED",
          updatedAt: new Date(),
        },
      });
    }

    // Create payment distribution if not exists
    const existingDistribution = await prisma.paymentDistribution.findFirst({
      where: { paymentId: payment.id },
    });

    if (!existingDistribution && payment.appointment) {
      const doctorPercentage = 0.85;
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

    console.log("PayPal payment completed:", {
      orderId,
      captureId,
      paymentId: payment.id,
      appointmentId: payment.appointmentId,
    });
  } catch (error) {
    console.error("Error handling PayPal payment completed:", error);
  }
}

async function handlePaymentDenied(webhookData: any) {
  const captureId = webhookData.resource?.id;
  const orderId =
    webhookData.resource?.supplementary_data?.related_ids?.order_id;

  if (!orderId) {
    console.error("PayPal payment denied webhook missing order ID");
    return;
  }

  try {
    // Find payment by PayPal order ID
    const payment = await prisma.payment.findUnique({
      where: { paypalOrderId: orderId },
    });

    if (!payment) {
      console.error("Payment not found for PayPal order:", orderId);
      return;
    }

    // Update payment status to failed
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        failureReason: "Payment denied by PayPal",
        paymentData: {
          ...(payment.paymentData as any),
          captureId,
          deniedAt: new Date().toISOString(),
          webhookProcessed: true,
        },
        updatedAt: new Date(),
      },
    });

    console.log("PayPal payment denied:", {
      orderId,
      captureId,
      paymentId: payment.id,
    });
  } catch (error) {
    console.error("Error handling PayPal payment denied:", error);
  }
}
