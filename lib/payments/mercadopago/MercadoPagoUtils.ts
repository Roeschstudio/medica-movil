import { PaymentRequest, PaymentResult, PaymentStatus } from "../types";

export interface MercadoPagoPreferenceRequest {
  items: Array<{
    id: string;
    title: string;
    description: string;
    quantity: number;
    currency_id: string;
    unit_price: number;
  }>;
  payer: {
    name: string;
    email: string;
  };
  payment_methods: {
    excluded_payment_methods: Array<{ id: string }>;
    excluded_payment_types: Array<{ id: string }>;
    installments: number;
  };
  back_urls: {
    success: string;
    failure: string;
    pending: string;
  };
  auto_return: "approved" | "all";
  external_reference: string;
  notification_url?: string;
  metadata?: Record<string, any>;
}

export interface MercadoPagoPreference {
  id: string;
  init_point: string;
  sandbox_init_point: string;
  date_created: string;
  items: Array<{
    id: string;
    title: string;
    description: string;
    quantity: number;
    currency_id: string;
    unit_price: number;
  }>;
  payer: {
    name: string;
    email: string;
  };
  back_urls: {
    success: string;
    failure: string;
    pending: string;
  };
  auto_return: string;
  external_reference: string;
}

export interface MercadoPagoPayment {
  id: number;
  status: string;
  status_detail: string;
  external_reference: string;
  preference_id: string;
  payment_method_id: string;
  payment_type_id: string;
  transaction_amount: number;
  currency_id: string;
  date_created: string;
  date_approved?: string;
  payer: {
    id: string;
    email: string;
    identification?: {
      type: string;
      number: string;
    };
  };
}

export class MercadoPagoUtils {
  static createPreferenceRequest(
    request: PaymentRequest
  ): MercadoPagoPreferenceRequest {
    return {
      items: [
        {
          id: request.appointmentId,
          title: "Consulta Médica",
          description: request.description,
          quantity: 1,
          currency_id: request.currency,
          unit_price: request.amount / 100, // Convert from cents to currency units
        },
      ],
      payer: {
        name: request.patientName,
        email: request.patientEmail,
      },
      payment_methods: {
        excluded_payment_methods: [], // Allow all payment methods
        excluded_payment_types: [], // Allow all payment types
        installments: 12, // Allow up to 12 installments
      },
      back_urls: {
        success: request.returnUrl,
        failure: request.cancelUrl,
        pending: request.returnUrl, // Use return URL for pending payments
      },
      auto_return: "approved",
      external_reference: request.appointmentId,
      metadata: request.metadata,
    };
  }

  static transformPreferenceToPaymentResult(
    preference: MercadoPagoPreference,
    providerId: "mercadopago"
  ): PaymentResult {
    // Use sandbox URL for test environment
    const checkoutUrl =
      process.env.NODE_ENV === "production"
        ? preference.init_point
        : preference.sandbox_init_point;

    return {
      success: true,
      paymentId: preference.id,
      checkoutUrl,
      provider: providerId,
      metadata: {
        preferenceId: preference.id,
        externalReference: preference.external_reference,
        initPoint: preference.init_point,
        sandboxInitPoint: preference.sandbox_init_point,
      },
    };
  }

  static transformPaymentToPaymentStatus(
    payment: MercadoPagoPayment,
    providerId: "mercadopago"
  ): PaymentStatus {
    let status: PaymentStatus["status"] = "pending";
    let paidAt: Date | undefined;

    switch (payment.status) {
      case "approved":
        status = "completed";
        paidAt = payment.date_approved
          ? new Date(payment.date_approved)
          : undefined;
        break;
      case "pending":
        status = "pending";
        break;
      case "cancelled":
      case "rejected":
        status = "failed";
        break;
      case "refunded":
        status = "refunded";
        break;
      default:
        status = "pending";
    }

    return {
      id: payment.id.toString(),
      status,
      provider: providerId,
      amount: Math.round(payment.transaction_amount * 100), // Convert to cents
      currency: payment.currency_id,
      paidAt,
      failureReason:
        payment.status === "rejected" ? payment.status_detail : undefined,
      metadata: {
        paymentId: payment.id,
        preferenceId: payment.preference_id,
        paymentMethodId: payment.payment_method_id,
        paymentTypeId: payment.payment_type_id,
        statusDetail: payment.status_detail,
        externalReference: payment.external_reference,
      },
    };
  }

  static getMexicanPaymentMethods() {
    return {
      // Credit and Debit Cards
      cards: [
        { id: "visa", name: "Visa", type: "credit_card" },
        { id: "master", name: "Mastercard", type: "credit_card" },
        { id: "amex", name: "American Express", type: "credit_card" },
        { id: "carnet", name: "Carnet", type: "credit_card" },
      ],
      // Cash Payment Methods
      cash: [
        { id: "oxxo", name: "OXXO", type: "ticket" },
        { id: "paycash", name: "PayCash", type: "ticket" },
        { id: "seven_eleven", name: "7-Eleven", type: "ticket" },
      ],
      // Bank Transfer Methods
      bank_transfer: [{ id: "spei", name: "SPEI", type: "bank_transfer" }],
      // Digital Wallets
      digital_wallet: [
        { id: "paypal", name: "PayPal", type: "digital_wallet" },
      ],
    };
  }

  static normalizeError(error: any): {
    code: string;
    message: string;
    retryable: boolean;
  } {
    if (error.cause && Array.isArray(error.cause)) {
      const cause = error.cause[0];

      switch (cause.code) {
        case "invalid_parameter":
          return {
            code: "INVALID_PARAMETER",
            message: `Parámetro inválido: ${cause.description}`,
            retryable: false,
          };
        case "insufficient_amount":
          return {
            code: "INSUFFICIENT_FUNDS",
            message: "El monto es insuficiente para procesar el pago.",
            retryable: false,
          };
        case "cc_rejected_insufficient_amount":
          return {
            code: "INSUFFICIENT_FUNDS",
            message: "Fondos insuficientes en la tarjeta.",
            retryable: true,
          };
        case "cc_rejected_bad_filled_card_number":
          return {
            code: "INVALID_CARD",
            message: "Número de tarjeta inválido.",
            retryable: true,
          };
        case "cc_rejected_bad_filled_date":
          return {
            code: "INVALID_CARD",
            message: "Fecha de vencimiento inválida.",
            retryable: true,
          };
        case "cc_rejected_bad_filled_security_code":
          return {
            code: "INVALID_CARD",
            message: "Código de seguridad inválido.",
            retryable: true,
          };
        case "cc_rejected_call_for_authorize":
          return {
            code: "AUTHORIZATION_REQUIRED",
            message: "Debes autorizar el pago con tu banco.",
            retryable: true,
          };
        default:
          return {
            code: "MERCADOPAGO_ERROR",
            message: cause.description || "Error de MercadoPago",
            retryable: true,
          };
      }
    }

    return {
      code: "UNKNOWN_ERROR",
      message: error.message || "Error desconocido de MercadoPago",
      retryable: true,
    };
  }

  static validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    // MercadoPago webhook signature verification would be implemented here
    // For now, we'll return true for development
    // In production, this should verify the signature using the webhook secret
    console.warn(
      "MercadoPago webhook signature verification not implemented - accepting all webhooks"
    );
    return true;
  }

  static getPaymentMethodInfo(paymentMethodId: string) {
    const allMethods = this.getMexicanPaymentMethods();

    for (const category of Object.values(allMethods)) {
      const method = category.find((m) => m.id === paymentMethodId);
      if (method) {
        return method;
      }
    }

    return { id: paymentMethodId, name: paymentMethodId, type: "unknown" };
  }
}
