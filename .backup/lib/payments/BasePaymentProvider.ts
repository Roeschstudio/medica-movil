import {
  PaymentError,
  PaymentProviderType,
  PaymentRequest,
  PaymentResult,
  PaymentStatus,
} from "./types";

export abstract class BasePaymentProvider {
  protected abstract providerId: PaymentProviderType;

  abstract getId(): PaymentProviderType;
  abstract createPayment(request: PaymentRequest): Promise<PaymentResult>;
  abstract capturePayment(paymentId: string): Promise<PaymentResult>;
  abstract getPaymentStatus(paymentId: string): Promise<PaymentStatus | null>;
  abstract processWebhook(payload: any, signature?: string): Promise<boolean>;

  protected normalizeError(error: any, operation: string): PaymentError {
    const baseError: PaymentError = {
      code: "UNKNOWN_ERROR",
      message: "An unknown error occurred",
      provider: this.providerId,
      retryable: false,
      suggestedActions: [
        "Please try again later",
        "Contact support if the problem persists",
      ],
    };

    if (error instanceof Error) {
      baseError.message = error.message;
    }

    // Provider-specific error normalization will be implemented in subclasses
    return this.normalizeProviderError(error, operation, baseError);
  }

  protected abstract normalizeProviderError(
    error: any,
    operation: string,
    baseError: PaymentError
  ): PaymentError;

  protected log(
    level: "info" | "warn" | "error",
    message: string,
    metadata?: any
  ) {
    const logData = {
      provider: this.providerId,
      timestamp: new Date().toISOString(),
      message,
      metadata,
    };

    switch (level) {
      case "info":
        console.info(`[${this.providerId.toUpperCase()}]`, logData);
        break;
      case "warn":
        console.warn(`[${this.providerId.toUpperCase()}]`, logData);
        break;
      case "error":
        console.error(`[${this.providerId.toUpperCase()}]`, logData);
        break;
    }
  }

  protected validatePaymentRequest(request: PaymentRequest): void {
    if (!request.appointmentId) {
      throw new Error("Appointment ID is required");
    }
    if (!request.amount || request.amount <= 0) {
      throw new Error("Valid amount is required");
    }
    if (!request.currency) {
      throw new Error("Currency is required");
    }
    if (!request.patientEmail) {
      throw new Error("Patient email is required");
    }
    if (!request.patientName) {
      throw new Error("Patient name is required");
    }
    if (!request.returnUrl) {
      throw new Error("Return URL is required");
    }
    if (!request.cancelUrl) {
      throw new Error("Cancel URL is required");
    }
  }

  protected formatAmount(amount: number, currency: string): number {
    // Most providers expect amounts in cents/centavos
    // This can be overridden by specific providers if needed
    return Math.round(amount * 100);
  }

  protected parseAmount(amount: number, currency: string): number {
    // Convert from cents/centavos back to main currency unit
    return Math.round(amount) / 100;
  }
}
