import { ErrorSeverity } from "../errors/PaymentErrorClassifier";
import { PaymentErrorHandler } from "../errors/PaymentErrorHandler";
import { PaymentError } from "../types";

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    paymentErrorLog: {
      create: jest.fn(),
    },
    adminNotification: {
      create: jest.fn(),
    },
    paymentMetrics: {
      upsert: jest.fn(),
    },
  },
}));

describe("PaymentErrorHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Error Handling", () => {
    test("should handle and classify error correctly", async () => {
      const error: PaymentError = {
        code: "card_declined",
        message: "Your card was declined.",
        provider: "stripe",
        retryable: true,
        suggestedActions: [],
        metadata: {},
      };

      const classifiedError = await PaymentErrorHandler.handleError(
        error,
        "stripe",
        {
          appointmentId: "test-appointment",
          userId: "test-user",
        }
      );

      expect(classifiedError.code).toBe("card_declined");
      expect(classifiedError.provider).toBe("stripe");
      expect(classifiedError.userMessage).toBeTruthy();
      expect(classifiedError.adminMessage).toBeTruthy();
    });

    test("should log error to database", async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
      const { prisma } = require("@/lib/prisma");

      const error: PaymentError = {
        code: "processing_error",
        message: "Processing failed.",
        provider: "paypal",
        retryable: true,
        suggestedActions: [],
        metadata: {},
      };

      await PaymentErrorHandler.handleError(error, "paypal");

      expect(prisma.paymentErrorLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          errorCode: "processing_error",
          errorMessage: "Processing failed.",
          provider: "paypal",
          retryable: true,
          resolved: false,
        }),
      });
    });

    test("should send admin notification for high severity errors", async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
      const { prisma } = require("@/lib/prisma");

      const error: PaymentError = {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error.",
        provider: "paypal",
        retryable: true,
        suggestedActions: [],
        metadata: {},
      };

      await PaymentErrorHandler.handleError(error, "paypal");

      expect(prisma.adminNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "PAYMENT_ERROR",
          severity: "HIGH",
          read: false,
        }),
      });
    });

    test("should not send admin notification for low severity errors", async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
      const { prisma } = require("@/lib/prisma");

      const error: PaymentError = {
        code: "card_declined",
        message: "Card declined.",
        provider: "stripe",
        retryable: true,
        suggestedActions: [],
        metadata: {},
      };

      await PaymentErrorHandler.handleError(error, "stripe");

      expect(prisma.adminNotification.create).not.toHaveBeenCalled();
    });

    test("should record error metrics", async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
      const { prisma } = require("@/lib/prisma");

      const error: PaymentError = {
        code: "network_error",
        message: "Network error.",
        provider: "mercadopago",
        retryable: true,
        suggestedActions: [],
        metadata: {},
      };

      await PaymentErrorHandler.handleError(error, "mercadopago");

      expect(prisma.paymentMetrics.upsert).toHaveBeenCalled();
    });
  });

  describe("Retry with Backoff", () => {
    test("should retry operation with backoff", async () => {
      let attempts = 0;
      const operation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error("Operation failed");
        }
        return "success";
      });

      const error: PaymentError = {
        code: "processing_error",
        message: "Processing error.",
        provider: "stripe",
        retryable: true,
        suggestedActions: [],
        metadata: {},
      };

      const classifiedError = await PaymentErrorHandler.handleError(
        error,
        "stripe"
      );

      const result = await PaymentErrorHandler.retryWithBackoff(
        operation,
        classifiedError,
        3
      );

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(3);
    });

    test("should fail after max retries", async () => {
      const operation = jest.fn().mockRejectedValue(new Error("Always fails"));

      const error: PaymentError = {
        code: "processing_error",
        message: "Processing error.",
        provider: "stripe",
        retryable: true,
        suggestedActions: [],
        metadata: {},
      };

      const classifiedError = await PaymentErrorHandler.handleError(
        error,
        "stripe"
      );

      await expect(
        PaymentErrorHandler.retryWithBackoff(operation, classifiedError, 2)
      ).rejects.toThrow("Always fails");

      expect(operation).toHaveBeenCalledTimes(2);
    });

    test("should not retry non-retryable errors", async () => {
      const operation = jest.fn().mockRejectedValue(new Error("Non-retryable"));

      const error: PaymentError = {
        code: "validation_error",
        message: "Validation error.",
        provider: "stripe",
        retryable: false,
        suggestedActions: [],
        metadata: {},
      };

      const classifiedError = await PaymentErrorHandler.handleError(
        error,
        "stripe"
      );

      await expect(
        PaymentErrorHandler.retryWithBackoff(operation, classifiedError)
      ).rejects.toThrow("Non-retryable");

      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe("Error Analysis", () => {
    test("should track recent errors", () => {
      const recentErrors = PaymentErrorHandler.getRecentErrors(10);
      expect(Array.isArray(recentErrors)).toBe(true);
    });

    test("should filter errors by provider", () => {
      const stripeErrors = PaymentErrorHandler.getErrorsByProvider("stripe");
      expect(Array.isArray(stripeErrors)).toBe(true);
    });

    test("should filter errors by category", () => {
      const userErrors = PaymentErrorHandler.getErrorsByCategory("user");
      expect(Array.isArray(userErrors)).toBe(true);
    });

    test("should filter errors by severity", () => {
      const highSeverityErrors = PaymentErrorHandler.getErrorsBySeverity(
        ErrorSeverity.HIGH
      );
      expect(Array.isArray(highSeverityErrors)).toBe(true);
    });
  });

  describe("Database Error Handling", () => {
    test("should handle database errors gracefully", async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
      const { prisma } = require("@/lib/prisma");
      prisma.paymentErrorLog.create.mockRejectedValue(
        new Error("Database error")
      );

      const error: PaymentError = {
        code: "test_error",
        message: "Test error.",
        provider: "stripe",
        retryable: true,
        suggestedActions: [],
        metadata: {},
      };

      // Should not throw even if database operation fails
      const classifiedError = await PaymentErrorHandler.handleError(
        error,
        "stripe"
      );
      expect(classifiedError).toBeTruthy();
    });

    test("should handle metrics update errors gracefully", async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
      const { prisma } = require("@/lib/prisma");
      prisma.paymentMetrics.upsert.mockRejectedValue(
        new Error("Metrics error")
      );

      const error: PaymentError = {
        code: "test_error",
        message: "Test error.",
        provider: "stripe",
        retryable: true,
        suggestedActions: [],
        metadata: {},
      };

      // Should not throw even if metrics update fails
      const classifiedError = await PaymentErrorHandler.handleError(
        error,
        "stripe"
      );
      expect(classifiedError).toBeTruthy();
    });
  });
});
