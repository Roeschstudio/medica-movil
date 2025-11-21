import crypto from "crypto";
import { PaymentProviderType } from "../types";

export interface WebhookValidationResult {
  isValid: boolean;
  error?: string;
  providerId?: string;
  eventId?: string;
}

export class WebhookValidator {
  private static readonly REPLAY_TOLERANCE_SECONDS = 300; // 5 minutes

  /**
   * Validate webhook signature and prevent replay attacks
   */
  static validateWebhook(
    provider: PaymentProviderType,
    payload: string | Buffer,
    signature: string,
    secret: string,
    timestamp?: string
  ): WebhookValidationResult {
    try {
      switch (provider) {
        case "stripe":
          return this.validateStripeWebhook(
            payload,
            signature,
            secret,
            timestamp
          );
        case "paypal":
          return this.validatePayPalWebhook(payload, signature, secret);
        case "mercadopago":
          return this.validateMercadoPagoWebhook(payload, signature, secret);
        default:
          return { isValid: false, error: `Unsupported provider: ${provider}` };
      }
    } catch (error) {
      return {
        isValid: false,
        error: `Webhook validation error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * Validate Stripe webhook signature
   */
  private static validateStripeWebhook(
    payload: string | Buffer,
    signature: string,
    secret: string,
    timestamp?: string
  ): WebhookValidationResult {
    const elements = signature.split(",");
    let timestampElement: string | undefined;
    let signatureElement: string | undefined;

    for (const element of elements) {
      const [key, value] = element.split("=");
      if (key === "t") {
        timestampElement = value;
      } else if (key === "v1") {
        signatureElement = value;
      }
    }

    if (!timestampElement || !signatureElement) {
      return { isValid: false, error: "Invalid Stripe signature format" };
    }

    // Check timestamp to prevent replay attacks
    const webhookTimestamp = parseInt(timestampElement, 10);
    const currentTimestamp = Math.floor(Date.now() / 1000);

    if (currentTimestamp - webhookTimestamp > this.REPLAY_TOLERANCE_SECONDS) {
      return { isValid: false, error: "Webhook timestamp too old" };
    }

    // Verify signature
    const payloadString =
      typeof payload === "string" ? payload : payload.toString("utf8");
    const signedPayload = `${timestampElement}.${payloadString}`;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(signedPayload, "utf8")
      .digest("hex");

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(signatureElement, "hex")
    );

    return {
      isValid,
      error: isValid ? undefined : "Invalid Stripe signature",
      providerId: "stripe",
    };
  }

  /**
   * Validate PayPal webhook signature
   */
  private static validatePayPalWebhook(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): WebhookValidationResult {
    // PayPal uses different signature validation
    // This is a simplified version - in production, you'd use PayPal's SDK
    const payloadString =
      typeof payload === "string" ? payload : payload.toString("utf8");

    try {
      const parsedPayload = JSON.parse(payloadString);
      const eventId = parsedPayload.id;

      // For PayPal, we typically validate using their API
      // This is a basic HMAC validation for demonstration
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(payloadString, "utf8")
        .digest("base64");

      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature)
      );

      return {
        isValid,
        error: isValid ? undefined : "Invalid PayPal signature",
        providerId: "paypal",
        eventId,
      };
    } catch (error) {
      return { isValid: false, error: "Invalid PayPal webhook payload" };
    }
  }

  /**
   * Validate MercadoPago webhook signature
   */
  private static validateMercadoPagoWebhook(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): WebhookValidationResult {
    const payloadString =
      typeof payload === "string" ? payload : payload.toString("utf8");

    try {
      const parsedPayload = JSON.parse(payloadString);
      const eventId = parsedPayload.id;

      // MercadoPago signature validation
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(payloadString, "utf8")
        .digest("hex");

      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, "hex"),
        Buffer.from(signature, "hex")
      );

      return {
        isValid,
        error: isValid ? undefined : "Invalid MercadoPago signature",
        providerId: "mercadopago",
        eventId,
      };
    } catch (error) {
      return { isValid: false, error: "Invalid MercadoPago webhook payload" };
    }
  }

  /**
   * Prevent webhook replay attacks by tracking processed events
   */
  private static processedEvents = new Set<string>();
  private static readonly MAX_PROCESSED_EVENTS = 10000;

  static isEventProcessed(eventId: string): boolean {
    return this.processedEvents.has(eventId);
  }

  static markEventAsProcessed(eventId: string): void {
    // Prevent memory leaks by limiting the size of the set
    if (this.processedEvents.size >= this.MAX_PROCESSED_EVENTS) {
      // Remove oldest half of events (simple cleanup strategy)
      const eventsArray = Array.from(this.processedEvents);
      const toRemove = eventsArray.slice(0, Math.floor(eventsArray.length / 2));
      toRemove.forEach((event) => this.processedEvents.delete(event));
    }

    this.processedEvents.add(eventId);
  }

  /**
   * Validate webhook payload structure
   */
  static validatePayloadStructure(
    provider: PaymentProviderType,
    payload: any
  ): { isValid: boolean; error?: string } {
    try {
      switch (provider) {
        case "stripe":
          return this.validateStripePayloadStructure(payload);
        case "paypal":
          return this.validatePayPalPayloadStructure(payload);
        case "mercadopago":
          return this.validateMercadoPagoPayloadStructure(payload);
        default:
          return { isValid: false, error: `Unsupported provider: ${provider}` };
      }
    } catch (error) {
      return {
        isValid: false,
        error: `Payload validation error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  private static validateStripePayloadStructure(payload: any): {
    isValid: boolean;
    error?: string;
  } {
    if (!payload || typeof payload !== "object") {
      return { isValid: false, error: "Invalid payload format" };
    }

    const requiredFields = ["id", "type", "data", "created"];
    for (const field of requiredFields) {
      if (!(field in payload)) {
        return { isValid: false, error: `Missing required field: ${field}` };
      }
    }

    if (!payload.data || !payload.data.object) {
      return { isValid: false, error: "Missing data object" };
    }

    return { isValid: true };
  }

  private static validatePayPalPayloadStructure(payload: any): {
    isValid: boolean;
    error?: string;
  } {
    if (!payload || typeof payload !== "object") {
      return { isValid: false, error: "Invalid payload format" };
    }

    const requiredFields = ["id", "event_type", "resource"];
    for (const field of requiredFields) {
      if (!(field in payload)) {
        return { isValid: false, error: `Missing required field: ${field}` };
      }
    }

    return { isValid: true };
  }

  private static validateMercadoPagoPayloadStructure(payload: any): {
    isValid: boolean;
    error?: string;
  } {
    if (!payload || typeof payload !== "object") {
      return { isValid: false, error: "Invalid payload format" };
    }

    const requiredFields = ["id", "type", "data"];
    for (const field of requiredFields) {
      if (!(field in payload)) {
        return { isValid: false, error: `Missing required field: ${field}` };
      }
    }

    return { isValid: true };
  }

  /**
   * Rate limiting for webhook endpoints
   */
  private static webhookAttempts = new Map<
    string,
    { count: number; resetTime: number }
  >();
  private static readonly MAX_WEBHOOK_ATTEMPTS = 100; // per hour
  private static readonly RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

  static checkRateLimit(identifier: string): {
    allowed: boolean;
    resetTime?: number;
  } {
    const now = Date.now();
    const attempts = this.webhookAttempts.get(identifier);

    if (!attempts || now > attempts.resetTime) {
      // Reset or initialize
      this.webhookAttempts.set(identifier, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW,
      });
      return { allowed: true };
    }

    if (attempts.count >= this.MAX_WEBHOOK_ATTEMPTS) {
      return { allowed: false, resetTime: attempts.resetTime };
    }

    attempts.count++;
    return { allowed: true };
  }

  /**
   * Clean up old rate limit entries
   */
  static cleanupRateLimits(): void {
    const now = Date.now();
    for (const [identifier, attempts] of this.webhookAttempts.entries()) {
      if (now > attempts.resetTime) {
        this.webhookAttempts.delete(identifier);
      }
    }
  }
}
