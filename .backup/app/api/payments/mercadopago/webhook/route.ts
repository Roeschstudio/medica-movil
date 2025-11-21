import { PaymentService } from "@/lib/payments/PaymentService";
import { MercadoPagoProvider } from "@/lib/payments/mercadopago/MercadoPagoProvider";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// Initialize payment service with MercadoPago provider
const paymentService = new PaymentService();
paymentService.registerProvider(new MercadoPagoProvider());

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-signature");

    let webhookData;
    try {
      webhookData = JSON.parse(body);
    } catch (error) {
      console.error("Invalid JSON in MercadoPago webhook:", error);
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    console.log("MercadoPago webhook received:", {
      type: webhookData.type,
      action: webhookData.action,
      dataId: webhookData.data?.id,
    });

    // Process webhook with MercadoPago provider
    const processed = await paymentService.processWebhook(
      "mercadopago",
      webhookData,
      signature || undefined
    );

    if (!processed) {
      console.error("Failed to process MercadoPago webhook");
      return NextResponse.json(
        { error: "Failed to process webhook" },
        { status: 400 }
      );
    }

    // Handle specific webhook events
    switch (webhookData.type) {
      case "payment":
        await handlePaymentWebhook(webhookData);
        break;
      default:
        console.log("Unhandled MercadoPago webhook type:", webhookData.type);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("MercadoPago webhook processing error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function handlePaymentWebhook(webhookData: any) {
  const paymentId = webhookData.data?.id;

  if (!paymentId) {
    console.error("MercadoPago payment webhook missing payment ID");
    return;
  }

  try {
    // Get payment status from MercadoPago
    const paymentStatus = await paymentService.getPaymentStatus(
      "mercadopago",
      paymentId.toString()
    );

    if (!paymentStatus) {
      console.error(
        "Could not retrieve payment status from MercadoPago:",
        paymentId
      );
      return;
    }

    // Find payment record by external reference (appointment ID) or preference ID
    const payment = await prisma.payment.findFirst({
      where: {
        OR: [
          { mercadopagoId: paymentStatus.metadata?.preferenceId },
          { appointmentId: paymentStatus.metadata?.externalReference },
        ],
      },
      include: {
        appointment: true,
      },
    });

    if (!payment) {
      console.error("Payment not found for MercadoPago payment:", paymentId);
      return;
    }

    // Update payment method based on MercadoPago payment method
    let paymentMethod = payment.method;
    const mpPaymentMethodId = paymentStatus.metadata?.paymentMethodId;

    if (mpPaymentMethodId) {
      switch (mpPaymentMethodId) {
        case "oxxo":
          paymentMethod = "OXXO";
          break;
        case "spei":
          paymentMethod = "SPEI";
          break;
        case "visa":
        case "master":
        case "amex":
        case "carnet":
          // Check if it's installments
          if (paymentStatus.metadata?.paymentTypeId === "credit_card") {
            paymentMethod = "MERCADOPAGO_INSTALLMENTS";
          } else {
            paymentMethod = "MERCADOPAGO_CARD";
          }
          break;
        default:
          paymentMethod = "MERCADOPAGO_CARD";
      }
    }

    // Update payment based on status
    switch (paymentStatus.status) {
      case "completed":
        await handlePaymentCompleted(payment, paymentStatus, paymentMethod);
        break;
      case "pending":
        await handlePaymentPending(payment, paymentStatus, paymentMethod);
        break;
      case "failed":
        await handlePaymentFailed(payment, paymentStatus, paymentMethod);
        break;
      case "cancelled":
        await handlePaymentCancelled(payment, paymentStatus, paymentMethod);
        break;
      default:
        console.log(
          "Unhandled MercadoPago payment status:",
          paymentStatus.status
        );
    }

    console.log("MercadoPago payment webhook processed:", {
      paymentId,
      status: paymentStatus.status,
      paymentMethod,
      appointmentId: payment.appointmentId,
    });
  } catch (error) {
    console.error("Error handling MercadoPago payment webhook:", error);
  }
}

async function handlePaymentCompleted(
  payment: any,
  paymentStatus: any,
  paymentMethod: string
) {
  // Update payment status to completed
  const updatedPayment = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "COMPLETED",
      method: paymentMethod as any,
      paidAt: paymentStatus.paidAt || new Date(),
      paymentData: {
        ...(payment.paymentData as any),
        ...paymentStatus.metadata,
        webhookProcessed: true,
        completedAt: new Date().toISOString(),
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
}

async function handlePaymentPending(
  payment: any,
  paymentStatus: any,
  paymentMethod: string
) {
  // Update payment with pending status and method
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "PENDING",
      method: paymentMethod as any,
      paymentData: {
        ...(payment.paymentData as any),
        ...paymentStatus.metadata,
        webhookProcessed: true,
        pendingAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    },
  });
}

async function handlePaymentFailed(
  payment: any,
  paymentStatus: any,
  paymentMethod: string
) {
  // Update payment status to failed
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "FAILED",
      method: paymentMethod as any,
      failureReason: paymentStatus.failureReason || "Payment failed",
      paymentData: {
        ...(payment.paymentData as any),
        ...paymentStatus.metadata,
        webhookProcessed: true,
        failedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    },
  });
}

async function handlePaymentCancelled(
  payment: any,
  paymentStatus: any,
  paymentMethod: string
) {
  // Update payment status to failed (cancelled is treated as failed)
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "FAILED",
      method: paymentMethod as any,
      failureReason: "Payment cancelled by user",
      paymentData: {
        ...(payment.paymentData as any),
        ...paymentStatus.metadata,
        webhookProcessed: true,
        cancelledAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    },
  });
}
