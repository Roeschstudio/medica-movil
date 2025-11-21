import { BasePaymentProvider } from "../BasePaymentProvider";
import {
  PaymentError,
  PaymentProviderType,
  PaymentRequest,
  PaymentResult,
  PaymentStatus,
} from "../types";
import { PayPalClient, PayPalError } from "./PayPalClient";
import { PayPalOrder, PayPalUtils } from "./PayPalUtils";

export class PayPalProvider extends BasePaymentProvider {
  protected providerId: PaymentProviderType = "paypal";
  private client: PayPalClient;

  constructor() {
    super();

    const config = {
      clientId: process.env.PAYPAL_CLIENT_ID!,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET!,
      mode: (process.env.PAYPAL_MODE as "sandbox" | "live") || "sandbox",
    };

    if (!config.clientId || !config.clientSecret) {
      throw new Error(
        "PayPal configuration is missing. Please check PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables."
      );
    }

    this.client = new PayPalClient(config);
  }

  getId(): PaymentProviderType {
    return this.providerId;
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      this.validatePaymentRequest(request);
      this.log("info", "Creating PayPal payment", {
        appointmentId: request.appointmentId,
        amount: request.amount,
      });

      const orderRequest = PayPalUtils.createOrderRequest(request);
      const order: PayPalOrder = await this.client.makeRequest(
        "/v2/checkout/orders",
        {
          method: "POST",
          body: JSON.stringify(orderRequest),
        }
      );

      this.log("info", "PayPal order created successfully", {
        orderId: order.id,
        status: order.status,
      });

      return PayPalUtils.transformOrderToPaymentResult(order, this.providerId);
    } catch (error) {
      this.log("error", "PayPal payment creation failed", {
        error: error instanceof Error ? error.message : error,
      });

      if (error instanceof PayPalError) {
        const normalizedError = PayPalUtils.normalizePayPalError(error.details);
        return {
          success: false,
          paymentId: "",
          error: normalizedError.message,
          provider: this.providerId,
          metadata: {
            errorCode: normalizedError.code,
            retryable: normalizedError.retryable,
          },
        };
      }

      return {
        success: false,
        paymentId: "",
        error: error instanceof Error ? error.message : "Unknown PayPal error",
        provider: this.providerId,
      };
    }
  }

  async capturePayment(paymentId: string): Promise<PaymentResult> {
    try {
      this.log("info", "Capturing PayPal payment", { paymentId });

      const captureResult = await this.client.makeRequest(
        `/v2/checkout/orders/${paymentId}/capture`,
        {
          method: "POST",
        }
      );

      this.log("info", "PayPal payment captured successfully", {
        paymentId,
        captureId:
          captureResult.purchase_units?.[0]?.payments?.captures?.[0]?.id,
      });

      return {
        success: true,
        paymentId,
        provider: this.providerId,
        metadata: {
          captureId:
            captureResult.purchase_units?.[0]?.payments?.captures?.[0]?.id,
          status: captureResult.status,
        },
      };
    } catch (error) {
      this.log("error", "PayPal payment capture failed", {
        paymentId,
        error: error instanceof Error ? error.message : error,
      });

      if (error instanceof PayPalError) {
        const normalizedError = PayPalUtils.normalizePayPalError(error.details);
        return {
          success: false,
          paymentId,
          error: normalizedError.message,
          provider: this.providerId,
          metadata: {
            errorCode: normalizedError.code,
            retryable: normalizedError.retryable,
          },
        };
      }

      return {
        success: false,
        paymentId,
        error:
          error instanceof Error
            ? error.message
            : "Unknown PayPal capture error",
        provider: this.providerId,
      };
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus | null> {
    try {
      this.log("info", "Checking PayPal payment status", { paymentId });

      const order: PayPalOrder = await this.client.makeRequest(
        `/v2/checkout/orders/${paymentId}`
      );

      return PayPalUtils.transformOrderToPaymentStatus(order, this.providerId);
    } catch (error) {
      this.log("error", "PayPal status check failed", {
        paymentId,
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }
  }

  async processWebhook(payload: any, signature?: string): Promise<boolean> {
    try {
      this.log("info", "Processing PayPal webhook", {
        eventType: payload.event_type,
      });

      // Verify webhook signature if provided
      if (signature && process.env.PAYPAL_WEBHOOK_ID) {
        const isValid = PayPalUtils.validateWebhookSignature(
          JSON.stringify(payload),
          signature,
          process.env.PAYPAL_WEBHOOK_ID
        );

        if (!isValid) {
          this.log("warn", "PayPal webhook signature verification failed");
          return false;
        }
      }

      // Process different webhook events
      switch (payload.event_type) {
        case "CHECKOUT.ORDER.APPROVED":
          await this.handleOrderApproved(payload);
          break;
        case "PAYMENT.CAPTURE.COMPLETED":
          await this.handlePaymentCompleted(payload);
          break;
        case "PAYMENT.CAPTURE.DENIED":
          await this.handlePaymentDenied(payload);
          break;
        default:
          this.log("info", "Unhandled PayPal webhook event", {
            eventType: payload.event_type,
          });
      }

      return true;
    } catch (error) {
      this.log("error", "PayPal webhook processing failed", {
        error: error instanceof Error ? error.message : error,
      });
      return false;
    }
  }

  private async handleOrderApproved(payload: any) {
    const orderId = payload.resource?.id;
    if (orderId) {
      this.log("info", "PayPal order approved", { orderId });
      // Update payment status in database would be handled by the calling service
    }
  }

  private async handlePaymentCompleted(payload: any) {
    const captureId = payload.resource?.id;
    const orderId = payload.resource?.supplementary_data?.related_ids?.order_id;

    if (orderId) {
      this.log("info", "PayPal payment completed", { orderId, captureId });
      // Update payment status in database would be handled by the calling service
    }
  }

  private async handlePaymentDenied(payload: any) {
    const captureId = payload.resource?.id;
    const orderId = payload.resource?.supplementary_data?.related_ids?.order_id;

    if (orderId) {
      this.log("warn", "PayPal payment denied", { orderId, captureId });
      // Update payment status in database would be handled by the calling service
    }
  }

  protected normalizeProviderError(
    error: any,
    operation: string,
    baseError: PaymentError
  ): PaymentError {
    if (error instanceof PayPalError) {
      const normalized = PayPalUtils.normalizePayPalError(error.details);
      return {
        ...baseError,
        code: normalized.code,
        message: normalized.message,
        retryable: normalized.retryable,
        suggestedActions: this.getSuggestedActions(normalized.code),
      };
    }

    return baseError;
  }

  private getSuggestedActions(errorCode: string): string[] {
    switch (errorCode) {
      case "PAYMENT_DECLINED":
        return [
          "Verifica que tu método de pago esté activo",
          "Intenta con otra tarjeta o método de pago",
          "Contacta a tu banco si el problema persiste",
        ];
      case "INSUFFICIENT_FUNDS":
        return [
          "Verifica el saldo de tu cuenta PayPal",
          "Agrega fondos a tu cuenta PayPal",
          "Usa otro método de pago",
        ];
      case "ACCOUNT_RESTRICTED":
        return [
          "Contacta a PayPal para resolver las restricciones de tu cuenta",
          "Usa otro método de pago mientras tanto",
        ];
      default:
        return [
          "Intenta nuevamente en unos minutos",
          "Usa otro método de pago",
          "Contacta soporte si el problema persiste",
        ];
    }
  }
}
