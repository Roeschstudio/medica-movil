import { PaymentRequest, PaymentResult, PaymentStatus } from "../types";

export interface PayPalOrderRequest {
  intent: "CAPTURE";
  purchase_units: Array<{
    reference_id: string;
    amount: {
      currency_code: string;
      value: string;
    };
    description: string;
    custom_id: string;
  }>;
  application_context: {
    brand_name: string;
    landing_page: "LOGIN" | "BILLING" | "NO_PREFERENCE";
    user_action: "PAY_NOW" | "CONTINUE";
    return_url: string;
    cancel_url: string;
  };
}

export interface PayPalOrder {
  id: string;
  status: string;
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
  purchase_units?: Array<{
    reference_id: string;
    amount: {
      currency_code: string;
      value: string;
    };
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        amount: {
          currency_code: string;
          value: string;
        };
      }>;
    };
  }>;
}

export class PayPalUtils {
  static createOrderRequest(request: PaymentRequest): PayPalOrderRequest {
    return {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: request.appointmentId,
          amount: {
            currency_code: request.currency,
            value: (request.amount / 100).toFixed(2), // Convert from cents to currency units
          },
          description: request.description,
          custom_id: request.appointmentId,
        },
      ],
      application_context: {
        brand_name: "Médica Móvil",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
        return_url: request.returnUrl,
        cancel_url: request.cancelUrl,
      },
    };
  }

  static transformOrderToPaymentResult(
    order: PayPalOrder,
    providerId: "paypal"
  ): PaymentResult {
    const approvalLink = order.links.find((link) => link.rel === "approve");

    return {
      success: true,
      paymentId: order.id,
      checkoutUrl: approvalLink?.href,
      provider: providerId,
      metadata: {
        orderId: order.id,
        status: order.status,
        links: order.links,
      },
    };
  }

  static transformOrderToPaymentStatus(
    order: PayPalOrder,
    providerId: "paypal"
  ): PaymentStatus {
    const purchaseUnit = order.purchase_units?.[0];
    const capture = purchaseUnit?.payments?.captures?.[0];

    let status: PaymentStatus["status"] = "pending";
    let paidAt: Date | undefined;

    switch (order.status) {
      case "COMPLETED":
        status = "completed";
        paidAt = new Date();
        break;
      case "APPROVED":
        status = "pending";
        break;
      case "CANCELLED":
        status = "cancelled";
        break;
      case "FAILED":
        status = "failed";
        break;
      default:
        status = "pending";
    }

    return {
      id: order.id,
      status,
      provider: providerId,
      amount: purchaseUnit ? parseFloat(purchaseUnit.amount.value) * 100 : 0, // Convert to cents
      currency: purchaseUnit?.amount.currency_code || "MXN",
      paidAt,
      metadata: {
        orderId: order.id,
        orderStatus: order.status,
        captureId: capture?.id,
        captureStatus: capture?.status,
      },
    };
  }

  static normalizePayPalError(error: any): {
    code: string;
    message: string;
    retryable: boolean;
  } {
    if (error.details) {
      const detail = Array.isArray(error.details)
        ? error.details[0]
        : error.details;

      switch (detail.issue) {
        case "INSTRUMENT_DECLINED":
          return {
            code: "PAYMENT_DECLINED",
            message:
              "El método de pago fue rechazado. Por favor, intenta con otro método.",
            retryable: true,
          };
        case "INSUFFICIENT_FUNDS":
          return {
            code: "INSUFFICIENT_FUNDS",
            message:
              "Fondos insuficientes. Por favor, verifica tu saldo o usa otro método de pago.",
            retryable: true,
          };
        case "PAYER_ACCOUNT_RESTRICTED":
          return {
            code: "ACCOUNT_RESTRICTED",
            message:
              "Tu cuenta PayPal tiene restricciones. Contacta a PayPal para más información.",
            retryable: false,
          };
        case "PAYEE_ACCOUNT_RESTRICTED":
          return {
            code: "MERCHANT_ERROR",
            message:
              "Error en la configuración del comercio. Por favor, contacta soporte.",
            retryable: false,
          };
        default:
          return {
            code: "PAYPAL_ERROR",
            message: detail.description || "Error de PayPal",
            retryable: true,
          };
      }
    }

    return {
      code: "UNKNOWN_ERROR",
      message: error.message || "Error desconocido de PayPal",
      retryable: true,
    };
  }

  static validateWebhookSignature(
    payload: string,
    signature: string,
    webhookId: string
  ): boolean {
    // PayPal webhook signature verification would be implemented here
    // For now, we'll return true for development
    // In production, this should verify the signature using PayPal's verification API
    console.warn(
      "PayPal webhook signature verification not implemented - accepting all webhooks"
    );
    return true;
  }
}
