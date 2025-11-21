import { BasePaymentProvider } from "./BasePaymentProvider";
import {
  PaymentProvider,
  PaymentProviderType,
  PaymentRequest,
  PaymentResult,
  PaymentStatus,
} from "./types";

export class PaymentService {
  private providers: Map<PaymentProviderType, BasePaymentProvider> = new Map();
  private availableProviders: PaymentProvider[] = [];

  constructor() {
    this.initializeProviders();
    this.registerProviders();
  }

  private initializeProviders() {
    this.availableProviders = [
      {
        id: "stripe",
        name: "stripe",
        displayName: "Tarjeta de Crédito/Débito",
        icon: "/icons/stripe.svg",
        description: "Pago seguro con tarjeta de crédito o débito",
        fees: "3.6% + $3 MXN",
        available: true,
        supportedMethods: ["Visa", "Mastercard", "American Express"],
      },
      {
        id: "paypal",
        name: "paypal",
        displayName: "PayPal",
        icon: "/icons/paypal.svg",
        description: "Paga con tu cuenta PayPal o tarjeta a través de PayPal",
        fees: "4.4% + $3 MXN",
        available: true,
        supportedMethods: [
          "PayPal Balance",
          "Tarjetas",
          "Transferencia bancaria",
        ],
      },
      {
        id: "mercadopago",
        name: "mercadopago",
        displayName: "MercadoPago",
        icon: "/icons/mercadopago.svg",
        description:
          "Opciones de pago mexicanas: OXXO, SPEI, tarjetas y meses sin intereses",
        fees: "3.99% + IVA",
        available: true,
        supportedMethods: ["OXXO", "SPEI", "Tarjetas", "Meses sin intereses"],
      },
    ];
  }

  private registerProviders() {
    try {
      // Register Stripe provider
      this.registerProvider(new StripeProvider());

      // Register PayPal provider
      this.registerProvider(new PayPalProvider());

      // Register MercadoPago provider
      this.registerProvider(new MercadoPagoProvider());

      console.log("Payment providers registered successfully");
    } catch (error) {
      console.error("Error registering payment providers:", error);
    }
  }

  registerProvider(provider: BasePaymentProvider) {
    this.providers.set(provider.getId(), provider);
  }

  async getAvailableProviders(context?: {
    userId?: string;
    email?: string;
    country?: string;
  }): Promise<PaymentProvider[]> {
    // Import FeatureFlags here to avoid circular dependency
    const { FeatureFlags } = await import("./features/FeatureFlags");

    return this.availableProviders.filter((provider) => {
      // Check if provider is available and enabled via feature flags
      return (
        provider.available &&
        FeatureFlags.isPaymentProviderEnabled(provider.id, context)
      );
    });
  }

  getProvider(
    providerId: PaymentProviderType
  ): BasePaymentProvider | undefined {
    return this.providers.get(providerId);
  }

  async createPayment(
    providerId: PaymentProviderType,
    request: PaymentRequest
  ): Promise<PaymentResult> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      return {
        success: false,
        paymentId: "",
        error: `Provider ${providerId} not found or not configured`,
        provider: providerId,
      };
    }

    try {
      return await provider.createPayment(request);
    } catch (error) {
      console.error(
        `Payment creation failed for provider ${providerId}:`,
        error
      );
      return {
        success: false,
        paymentId: "",
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        provider: providerId,
      };
    }
  }

  async capturePayment(
    providerId: PaymentProviderType,
    paymentId: string
  ): Promise<PaymentResult> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      return {
        success: false,
        paymentId,
        error: `Provider ${providerId} not found or not configured`,
        provider: providerId,
      };
    }

    try {
      return await provider.capturePayment(paymentId);
    } catch (error) {
      console.error(
        `Payment capture failed for provider ${providerId}:`,
        error
      );
      return {
        success: false,
        paymentId,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        provider: providerId,
      };
    }
  }

  async getPaymentStatus(
    providerId: PaymentProviderType,
    paymentId: string
  ): Promise<PaymentStatus | null> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      return null;
    }

    try {
      return await provider.getPaymentStatus(paymentId);
    } catch (error) {
      console.error(
        `Payment status check failed for provider ${providerId}:`,
        error
      );
      return null;
    }
  }

  async processWebhook(
    providerId: PaymentProviderType,
    payload: any,
    signature?: string
  ): Promise<boolean> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      return false;
    }

    try {
      return await provider.processWebhook(payload, signature);
    } catch (error) {
      console.error(
        `Webhook processing failed for provider ${providerId}:`,
        error
      );
      return false;
    }
  }
}
