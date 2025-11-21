import { BasePaymentProvider } from "../BasePaymentProvider";
import {
  PaymentError,
  PaymentProviderType,
  PaymentRequest,
  PaymentResult,
  PaymentStatus,
} from "../types";
import { MercadoPagoClient, MercadoPagoError } from "./MercadoPagoClient";
import {
  MercadoPagoPayment,
  MercadoPagoPreference,
  MercadoPagoUtils,
} from "./MercadoPagoUtils";

export class MercadoPagoProvider extends BasePaymentProvider {
  protected providerId: PaymentProviderType = "mercadopago";
  private client: MercadoPagoClient;

  constructor() {
    super();

    const config = {
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
      publicKey: process.env.MERCADOPAGO_PUBLIC_KEY!,
    };

    if (!config.accessToken || !config.publicKey) {
      throw new Error(
        "MercadoPago configuration is missing. Please check MERCADOPAGO_ACCESS_TOKEN and MERCADOPAGO_PUBLIC_KEY environment variables."
      );
    }

    this.client = new MercadoPagoClient(config);
  }

  getId(): PaymentProviderType {
    return this.providerId;
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      this.validatePaymentRequest(request);
      this.log("info", "Creating MercadoPago payment preference", {
        appointmentId: request.appointmentId,
        amount: request.amount,
      });

      const preferenceRequest =
        MercadoPagoUtils.createPreferenceRequest(request);
      const preference: MercadoPagoPreference = await this.client.makeRequest(
        "/checkout/preferences",
        {
          method: "POST",
          body: JSON.stringify(preferenceRequest),
        }
      );

      this.log("info", "MercadoPago preference created successfully", {
        preferenceId: preference.id,
        externalReference: preference.external_reference,
      });

      return MercadoPagoUtils.transformPreferenceToPaymentResult(
        preference,
        this.providerId
      );
    } catch (error) {
      this.log("error", "MercadoPago payment creation failed", {
        error: error instanceof Error ? error.message : error,
      });

      if (error instanceof MercadoPagoError) {
        const normalizedError = MercadoPagoUtils.normalizeError(error.details);
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
        error:
          error instanceof Error ? error.message : "Unknown MercadoPago error",
        provider: this.providerId,
      };
    }
  }

  async capturePayment(paymentId: string): Promise<PaymentResult> {
    // MercadoPago doesn't require explicit capture like PayPal
    // Payments are automatically processed when the user completes the payment
    // This method will check the payment status instead
    try {
      this.log("info", "Checking MercadoPago payment status for capture", {
        paymentId,
      });

      const payment: MercadoPagoPayment = await this.client.makeRequest(
        `/v1/payments/${paymentId}`
      );

      if (payment.status === "approved") {
        this.log("info", "MercadoPago payment already captured", {
          paymentId,
          status: payment.status,
        });
        return {
          success: true,
          paymentId,
          provider: this.providerId,
          metadata: {
            paymentId: payment.id,
            status: payment.status,
            paymentMethodId: payment.payment_method_id,
          },
        };
      } else {
        return {
          success: false,
          paymentId,
          error: `Payment not yet approved. Current status: ${payment.status}`,
          provider: this.providerId,
          metadata: {
            paymentId: payment.id,
            status: payment.status,
            statusDetail: payment.status_detail,
          },
        };
      }
    } catch (error) {
      this.log("error", "MercadoPago payment capture check failed", {
        paymentId,
        error: error instanceof Error ? error.message : error,
      });

      return {
        success: false,
        paymentId,
        error:
          error instanceof Error
            ? error.message
            : "Unknown MercadoPago capture error",
        provider: this.providerId,
      };
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus | null> {
    try {
      this.log("info", "Checking MercadoPago payment status", { paymentId });

      // Try to get payment by ID first
      try {
        const payment: MercadoPagoPayment = await this.client.makeRequest(
          `/v1/payments/${paymentId}`
        );
        return MercadoPagoUtils.transformPaymentToPaymentStatus(
          payment,
          this.providerId
        );
      } catch (error) {
        // If payment ID doesn't work, try to search by external reference (preference ID)
        this.log("info", "Payment not found by ID, searching by preference", {
          paymentId,
        });

        const searchResult = await this.client.makeRequest(
          `/v1/payments/search?external_reference=${paymentId}`
        );

        if (searchResult.results && searchResult.results.length > 0) {
          const payment: MercadoPagoPayment = searchResult.results[0];
          return MercadoPagoUtils.transformPaymentToPaymentStatus(
            payment,
            this.providerId
          );
        }

        return null;
      }
    } catch (error) {
      this.log("error", "MercadoPago status check failed", {
        paymentId,
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }
  }

  async processWebhook(payload: any, signature?: string): Promise<boolean> {
    try {
      this.log("info", "Processing MercadoPago webhook", {
        type: payload.type,
        action: payload.action,
      });

      // Verify webhook signature if provided
      if (signature && process.env.MERCADOPAGO_WEBHOOK_SECRET) {
        const isValid = MercadoPagoUtils.validateWebhookSignature(
          JSON.stringify(payload),
          signature,
          process.env.MERCADOPAGO_WEBHOOK_SECRET
        );

        if (!isValid) {
          this.log("warn", "MercadoPago webhook signature verification failed");
          return false;
        }
      }

      // Process different webhook events
      switch (payload.type) {
        case "payment":
          await this.handlePaymentWebhook(payload);
          break;
        default:
          this.log("info", "Unhandled MercadoPago webhook type", {
            type: payload.type,
            action: payload.action,
          });
      }

      return true;
    } catch (error) {
      this.log("error", "MercadoPago webhook processing failed", {
        error: error instanceof Error ? error.message : error,
      });
      return false;
    }
  }

  private async handlePaymentWebhook(payload: any) {
    const paymentId = payload.data?.id;

    if (!paymentId) {
      this.log("warn", "MercadoPago webhook missing payment ID");
      return;
    }

    try {
      // Get the full payment details
      const payment: MercadoPagoPayment = await this.client.makeRequest(
        `/v1/payments/${paymentId}`
      );

      this.log("info", "MercadoPago payment webhook processed", {
        paymentId: payment.id,
        status: payment.status,
        externalReference: payment.external_reference,
        paymentMethodId: payment.payment_method_id,
      });

      // The calling service will handle updating the database based on the webhook
      // This method just validates and processes the webhook data
    } catch (error) {
      this.log("error", "Failed to fetch payment details from webhook", {
        paymentId,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  protected normalizeProviderError(
    error: any,
    operation: string,
    baseError: PaymentError
  ): PaymentError {
    if (error instanceof MercadoPagoError) {
      const normalized = MercadoPagoUtils.normalizeError(error.details);
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
      case "INVALID_CARD":
        return [
          "Verifica que los datos de la tarjeta sean correctos",
          "Intenta con otra tarjeta",
          "Usa otro método de pago como OXXO o SPEI",
        ];
      case "INSUFFICIENT_FUNDS":
        return [
          "Verifica el saldo de tu tarjeta",
          "Usa otro método de pago",
          "Paga en OXXO si prefieres efectivo",
        ];
      case "AUTHORIZATION_REQUIRED":
        return [
          "Contacta a tu banco para autorizar el pago",
          "Intenta con otra tarjeta",
          "Usa SPEI para transferencia bancaria directa",
        ];
      case "INVALID_PARAMETER":
        return [
          "Verifica que todos los datos sean correctos",
          "Intenta nuevamente",
          "Contacta soporte si el problema persiste",
        ];
      default:
        return [
          "Intenta nuevamente en unos minutos",
          "Usa otro método de pago (OXXO, SPEI, otra tarjeta)",
          "Contacta soporte si el problema persiste",
        ];
    }
  }

  // Helper method to get available Mexican payment methods
  getAvailablePaymentMethods() {
    return MercadoPagoUtils.getMexicanPaymentMethods();
  }
}
