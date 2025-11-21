import {
  createAppointmentMetadata,
  getPaymentMethodConfig,
  MexicanPaymentMethod,
  stripe,
} from "@/lib/stripe";
import Stripe from "stripe";
import { BasePaymentProvider } from "../BasePaymentProvider";
import {
  PaymentError,
  PaymentProviderType,
  PaymentRequest,
  PaymentResult,
  PaymentStatus,
} from "../types";

export class StripeProvider extends BasePaymentProvider {
  protected providerId: PaymentProviderType = "stripe";

  constructor() {
    super();
  }

  getId(): PaymentProviderType {
    return this.providerId;
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      this.validatePaymentRequest(request);
      this.log("info", "Creating Stripe payment session", {
        appointmentId: request.appointmentId,
        amount: request.amount,
      });

      // Default to card payment method, can be enhanced to support method selection
      const paymentMethod: MexicanPaymentMethod = "card";
      const paymentConfig = getPaymentMethodConfig(paymentMethod);

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        ...paymentConfig,
        mode: "payment",
        currency: request.currency.toLowerCase(),
        customer_email: request.patientEmail,
        line_items: [
          {
            price_data: {
              currency: request.currency.toLowerCase(),
              product_data: {
                name: "Consulta Médica",
                description: request.description,
                metadata: {
                  appointment_id: request.appointmentId,
                },
              },
              unit_amount: request.amount, // Amount is already in cents
            },
            quantity: 1,
          },
        ],
        metadata: {
          ...createAppointmentMetadata({
            appointmentId: request.appointmentId,
            doctorId: request.metadata?.doctorId || "",
            patientId: request.metadata?.patientId || "",
            consultationType: request.metadata?.consultationType || "",
            scheduledAt: new Date().toISOString(),
          }),
          provider: "stripe",
        },
        success_url: request.returnUrl,
        cancel_url: request.cancelUrl,
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
        locale: "es",
        billing_address_collection: "required",
        phone_number_collection: {
          enabled: true,
        },
      });

      this.log("info", "Stripe session created successfully", {
        sessionId: session.id,
      });

      return {
        success: true,
        paymentId: session.id,
        checkoutUrl: session.url || undefined,
        provider: this.providerId,
        metadata: {
          sessionId: session.id,
          paymentMethod,
          expiresAt: session.expires_at,
        },
      };
    } catch (error) {
      this.log("error", "Stripe payment creation failed", {
        error: error instanceof Error ? error.message : error,
      });

      if (error instanceof Stripe.errors.StripeError) {
        const normalizedError = this.normalizeStripeError(error);
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
        error: error instanceof Error ? error.message : "Unknown Stripe error",
        provider: this.providerId,
      };
    }
  }

  async capturePayment(paymentId: string): Promise<PaymentResult> {
    // Stripe checkout sessions are automatically captured when completed
    // This method will check the session status instead
    try {
      this.log("info", "Checking Stripe session status for capture", {
        paymentId,
      });

      const session = await stripe.checkout.sessions.retrieve(paymentId);

      if (session.payment_status === "paid") {
        this.log("info", "Stripe payment already captured", {
          paymentId,
          status: session.payment_status,
        });
        return {
          success: true,
          paymentId,
          provider: this.providerId,
          metadata: {
            sessionId: session.id,
            paymentIntentId: session.payment_intent,
            paymentStatus: session.payment_status,
          },
        };
      } else {
        return {
          success: false,
          paymentId,
          error: `Payment not yet completed. Current status: ${session.payment_status}`,
          provider: this.providerId,
          metadata: {
            sessionId: session.id,
            paymentStatus: session.payment_status,
            status: session.status,
          },
        };
      }
    } catch (error) {
      this.log("error", "Stripe payment capture check failed", {
        paymentId,
        error: error instanceof Error ? error.message : error,
      });

      return {
        success: false,
        paymentId,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Stripe capture error",
        provider: this.providerId,
      };
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus | null> {
    try {
      this.log("info", "Checking Stripe payment status", { paymentId });

      const session = await stripe.checkout.sessions.retrieve(paymentId, {
        expand: ["payment_intent"],
      });

      let status: PaymentStatus["status"] = "pending";
      let paidAt: Date | undefined;
      let failureReason: string | undefined;

      switch (session.payment_status) {
        case "paid":
          status = "completed";
          paidAt = new Date();
          break;
        case "unpaid":
          if (session.status === "expired") {
            status = "failed";
            failureReason = "Session expired";
          } else {
            status = "pending";
          }
          break;
        case "no_payment_required":
          status = "completed";
          break;
        default:
          status = "pending";
      }

      return {
        id: session.id,
        status,
        provider: this.providerId,
        amount: session.amount_total || 0,
        currency: (session.currency || "mxn").toUpperCase(),
        paidAt,
        failureReason,
        metadata: {
          sessionId: session.id,
          paymentIntentId: session.payment_intent,
          paymentStatus: session.payment_status,
          sessionStatus: session.status,
          customerEmail: session.customer_email,
        },
      };
    } catch (error) {
      this.log("error", "Stripe status check failed", {
        paymentId,
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }
  }

  async processWebhook(payload: any, signature?: string): Promise<boolean> {
    try {
      if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
        this.log(
          "warn",
          "Stripe webhook signature verification skipped - no signature or secret"
        );
        return false;
      }

      // Verify webhook signature
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          JSON.stringify(payload),
          signature,
          process.env.STRIPE_WEBHOOK_SECRET
        );
      } catch (err) {
        this.log("error", "Stripe webhook signature verification failed", {
          error: err instanceof Error ? err.message : err,
        });
        return false;
      }

      this.log("info", "Processing Stripe webhook", { eventType: event.type });

      // Process different webhook events
      switch (event.type) {
        case "checkout.session.completed":
          await this.handleSessionCompleted(
            event.data.object as Stripe.Checkout.Session
          );
          break;
        case "checkout.session.expired":
          await this.handleSessionExpired(
            event.data.object as Stripe.Checkout.Session
          );
          break;
        case "payment_intent.succeeded":
          await this.handlePaymentSucceeded(
            event.data.object as Stripe.PaymentIntent
          );
          break;
        case "payment_intent.payment_failed":
          await this.handlePaymentFailed(
            event.data.object as Stripe.PaymentIntent
          );
          break;
        default:
          this.log("info", "Unhandled Stripe webhook event", {
            eventType: event.type,
          });
      }

      return true;
    } catch (error) {
      this.log("error", "Stripe webhook processing failed", {
        error: error instanceof Error ? error.message : error,
      });
      return false;
    }
  }

  private async handleSessionCompleted(session: Stripe.Checkout.Session) {
    this.log("info", "Stripe session completed", { sessionId: session.id });
    // The calling service will handle updating the database
  }

  private async handleSessionExpired(session: Stripe.Checkout.Session) {
    this.log("info", "Stripe session expired", { sessionId: session.id });
    // The calling service will handle updating the database
  }

  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    this.log("info", "Stripe payment succeeded", {
      paymentIntentId: paymentIntent.id,
    });
    // The calling service will handle updating the database
  }

  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
    this.log("info", "Stripe payment failed", {
      paymentIntentId: paymentIntent.id,
      failureCode: paymentIntent.last_payment_error?.code,
      failureMessage: paymentIntent.last_payment_error?.message,
    });
    // The calling service will handle updating the database
  }

  protected normalizeProviderError(
    error: any,
    operation: string,
    baseError: PaymentError
  ): PaymentError {
    if (error instanceof Stripe.errors.StripeError) {
      const normalized = this.normalizeStripeError(error);
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

  private normalizeStripeError(error: Stripe.errors.StripeError): {
    code: string;
    message: string;
    retryable: boolean;
  } {
    switch (error.code) {
      case "card_declined":
        return {
          code: "CARD_DECLINED",
          message:
            "Tu tarjeta fue rechazada. Por favor, intenta con otra tarjeta.",
          retryable: true,
        };
      case "insufficient_funds":
        return {
          code: "INSUFFICIENT_FUNDS",
          message: "Fondos insuficientes. Verifica el saldo de tu tarjeta.",
          retryable: true,
        };
      case "expired_card":
        return {
          code: "EXPIRED_CARD",
          message: "Tu tarjeta ha expirado. Por favor, usa otra tarjeta.",
          retryable: true,
        };
      case "incorrect_cvc":
        return {
          code: "INCORRECT_CVC",
          message: "El código de seguridad es incorrecto.",
          retryable: true,
        };
      case "processing_error":
        return {
          code: "PROCESSING_ERROR",
          message: "Error procesando el pago. Por favor, intenta nuevamente.",
          retryable: true,
        };
      case "rate_limit":
        return {
          code: "RATE_LIMIT",
          message:
            "Demasiados intentos. Por favor, espera un momento e intenta nuevamente.",
          retryable: true,
        };
      default:
        return {
          code: "STRIPE_ERROR",
          message: error.message || "Error de Stripe",
          retryable: true,
        };
    }
  }

  private getSuggestedActions(errorCode: string): string[] {
    switch (errorCode) {
      case "CARD_DECLINED":
        return [
          "Verifica que tu tarjeta esté activa",
          "Intenta con otra tarjeta",
          "Contacta a tu banco si el problema persiste",
          "Usa PayPal o MercadoPago como alternativa",
        ];
      case "INSUFFICIENT_FUNDS":
        return [
          "Verifica el saldo de tu tarjeta",
          "Usa otra tarjeta con fondos suficientes",
          "Considera usar OXXO o SPEI a través de MercadoPago",
        ];
      case "EXPIRED_CARD":
        return [
          "Usa una tarjeta vigente",
          "Actualiza los datos de tu tarjeta",
          "Intenta con otro método de pago",
        ];
      case "INCORRECT_CVC":
        return [
          "Verifica el código de seguridad de tu tarjeta",
          "Asegúrate de escribir los 3 dígitos correctos",
          "Intenta nuevamente con cuidado",
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
