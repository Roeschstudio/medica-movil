import {
  ErrorCategory,
  ErrorSeverity,
  PaymentErrorClassifier,
} from "../errors/PaymentErrorClassifier";
import { PaymentError, PaymentProviderType } from "../types";

describe("PaymentErrorClassifier", () => {
  describe("Error Classification", () => {
    test("should classify Stripe card declined error correctly", () => {
      const error: PaymentError = {
        code: "card_declined",
        message: "Your card was declined.",
        provider: "stripe",
        retryable: true,
        suggestedActions: [],
        metadata: {},
      };

      const classified = PaymentErrorClassifier.classifyError(error, "stripe");

      expect(classified.category).toBe(ErrorCategory.USER);
      expect(classified.severity).toBe(ErrorSeverity.LOW);
      expect(classified.retryable).toBe(true);
      expect(classified.userMessage).toContain("tarjeta fue rechazada");
      expect(classified.retryStrategy.maxRetries).toBe(3);
    });

    test("should classify PayPal internal server error correctly", () => {
      const error: PaymentError = {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error occurred.",
        provider: "paypal",
        retryable: true,
        suggestedActions: [],
        metadata: {},
      };

      const classified = PaymentErrorClassifier.classifyError(error, "paypal");

      expect(classified.category).toBe(ErrorCategory.PROVIDER);
      expect(classified.severity).toBe(ErrorSeverity.HIGH);
      expect(classified.shouldNotifyAdmin).toBe(true);
      expect(classified.userMessage).toContain("Error temporal de PayPal");
    });

    test("should classify MercadoPago insufficient funds error correctly", () => {
      const error: PaymentError = {
        code: "cc_rejected_insufficient_amount",
        message: "Insufficient funds.",
        provider: "mercadopago",
        retryable: true,
        suggestedActions: [],
        metadata: {},
      };

      const classified = PaymentErrorClassifier.classifyError(
        error,
        "mercadopago"
      );

      expect(classified.category).toBe(ErrorCategory.USER);
      expect(classified.severity).toBe(ErrorSeverity.LOW);
      expect(classified.userMessage).toContain("Fondos insuficientes");
      expect(classified.retryStrategy.maxRetries).toBe(2);
    });

    test("should handle unknown error codes with defaults", () => {
      const error: PaymentError = {
        code: "unknown_error_code",
        message: "Unknown error occurred.",
        provider: "stripe",
        retryable: true,
        suggestedActions: [],
        metadata: {},
      };

      const classified = PaymentErrorClassifier.classifyError(error, "stripe");

      expect(classified.category).toBe(ErrorCategory.SYSTEM);
      expect(classified.severity).toBe(ErrorSeverity.MEDIUM);
      expect(classified.userMessage).toContain("error inesperado");
      expect(classified.retryStrategy.maxRetries).toBe(1);
    });

    test("should infer category from error code patterns", () => {
      const networkError: PaymentError = {
        code: "network_timeout",
        message: "Network timeout occurred.",
        provider: "stripe",
        retryable: true,
        suggestedActions: [],
        metadata: {},
      };

      const classified = PaymentErrorClassifier.classifyError(
        networkError,
        "stripe"
      );
      expect(classified.category).toBe(ErrorCategory.NETWORK);

      const validationError: PaymentError = {
        code: "invalid_card_number",
        message: "Invalid card number.",
        provider: "stripe",
        retryable: false,
        suggestedActions: [],
        metadata: {},
      };

      const classifiedValidation = PaymentErrorClassifier.classifyError(
        validationError,
        "stripe"
      );
      expect(classifiedValidation.category).toBe(ErrorCategory.VALIDATION);
    });
  });

  describe("Retry Logic", () => {
    test("should determine if error should be retried", () => {
      const retryableError: PaymentError = {
        code: "card_declined",
        message: "Card declined.",
        provider: "stripe",
        retryable: true,
        suggestedActions: [],
        metadata: {},
      };

      const classified = PaymentErrorClassifier.classifyError(
        retryableError,
        "stripe"
      );

      expect(PaymentErrorClassifier.shouldRetry(classified, 1)).toBe(true);
      expect(PaymentErrorClassifier.shouldRetry(classified, 3)).toBe(false); // Exceeds max retries
    });

    test("should calculate retry delay with backoff", () => {
      const error: PaymentError = {
        code: "processing_error",
        message: "Processing error.",
        provider: "stripe",
        retryable: true,
        suggestedActions: [],
        metadata: {},
      };

      const classified = PaymentErrorClassifier.classifyError(error, "stripe");

      const delay1 = PaymentErrorClassifier.getRetryDelay(classified, 0);
      const delay2 = PaymentErrorClassifier.getRetryDelay(classified, 1);
      const delay3 = PaymentErrorClassifier.getRetryDelay(classified, 2);

      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    test("should not retry non-retryable errors", () => {
      const nonRetryableError: PaymentError = {
        code: "validation_error",
        message: "Validation failed.",
        provider: "stripe",
        retryable: false,
        suggestedActions: [],
        metadata: {},
      };

      const classified = PaymentErrorClassifier.classifyError(
        nonRetryableError,
        "stripe"
      );

      expect(classified.retryable).toBe(false);
      expect(PaymentErrorClassifier.shouldRetry(classified, 0)).toBe(false);
    });
  });

  describe("Error Severity", () => {
    test("should assign correct severity levels", () => {
      const criticalError: PaymentError = {
        code: "critical_system_failure",
        message: "Critical system failure.",
        provider: "stripe",
        retryable: false,
        suggestedActions: [],
        metadata: {},
      };

      const classified = PaymentErrorClassifier.classifyError(
        criticalError,
        "stripe"
      );
      expect(classified.severity).toBe(ErrorSeverity.CRITICAL);

      const userError: PaymentError = {
        code: "expired_card",
        message: "Card expired.",
        provider: "stripe",
        retryable: true,
        suggestedActions: [],
        metadata: {},
      };

      const classifiedUser = PaymentErrorClassifier.classifyError(
        userError,
        "stripe"
      );
      expect(classifiedUser.severity).toBe(ErrorSeverity.LOW);
    });

    test("should require admin notification for high severity errors", () => {
      const highSeverityError: PaymentError = {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error.",
        provider: "paypal",
        retryable: true,
        suggestedActions: [],
        metadata: {},
      };

      const classified = PaymentErrorClassifier.classifyError(
        highSeverityError,
        "paypal"
      );
      expect(classified.shouldNotifyAdmin).toBe(true);

      const lowSeverityError: PaymentError = {
        code: "card_declined",
        message: "Card declined.",
        provider: "stripe",
        retryable: true,
        suggestedActions: [],
        metadata: {},
      };

      const classifiedLow = PaymentErrorClassifier.classifyError(
        lowSeverityError,
        "stripe"
      );
      expect(classifiedLow.shouldNotifyAdmin).toBe(false);
    });
  });

  describe("Provider-Specific Handling", () => {
    test("should handle provider-specific error patterns", () => {
      const providers: PaymentProviderType[] = [
        "stripe",
        "paypal",
        "mercadopago",
      ];

      providers.forEach((provider) => {
        const error: PaymentError = {
          code: "generic_error",
          message: "Generic error.",
          provider,
          retryable: true,
          suggestedActions: [],
          metadata: {},
        };

        const classified = PaymentErrorClassifier.classifyError(
          error,
          provider
        );
        expect(classified.provider).toBe(provider);
        expect(classified.adminMessage).toContain(provider);
      });
    });

    test("should generate appropriate user messages for different providers", () => {
      const error: PaymentError = {
        code: "unknown_error",
        message: "Unknown error.",
        provider: "stripe",
        retryable: true,
        suggestedActions: [],
        metadata: {},
      };

      const classified = PaymentErrorClassifier.classifyError(error, "stripe");
      expect(classified.userMessage).toBeTruthy();
      expect(classified.userMessage.length).toBeGreaterThan(0);
      expect(classified.userMessage).toMatch(
        /[Pp]or favor|[Ii]ntenta|[Vv]erifica/
      );
    });
  });
});
