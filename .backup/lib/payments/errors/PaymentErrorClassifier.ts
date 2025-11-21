import { PaymentError, PaymentProviderType } from "../types";

export enum ErrorCategory {
  PROVIDER = "provider",
  NETWORK = "network",
  VALIDATION = "validation",
  SYSTEM = "system",
  USER = "user",
}

export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export interface ClassifiedError extends PaymentError {
  category: ErrorCategory;
  severity: ErrorSeverity;
  retryStrategy: RetryStrategy;
  userMessage: string;
  adminMessage: string;
  shouldNotifyAdmin: boolean;
}

export interface RetryStrategy {
  maxRetries: number;
  retryDelayMs: number;
  backoffMultiplier: number;
  retryableErrorCodes: string[];
}

export class PaymentErrorClassifier {
  private static readonly ERROR_PATTERNS = {
    // Provider-specific error patterns
    stripe: {
      card_declined: {
        category: ErrorCategory.USER,
        severity: ErrorSeverity.LOW,
        userMessage:
          "Tu tarjeta fue rechazada. Por favor, verifica los datos o usa otra tarjeta.",
        adminMessage: "Stripe card declined",
        retryable: true,
        maxRetries: 3,
      },
      insufficient_funds: {
        category: ErrorCategory.USER,
        severity: ErrorSeverity.LOW,
        userMessage:
          "Fondos insuficientes. Por favor, verifica tu saldo o usa otra tarjeta.",
        adminMessage: "Stripe insufficient funds",
        retryable: true,
        maxRetries: 2,
      },
      expired_card: {
        category: ErrorCategory.USER,
        severity: ErrorSeverity.LOW,
        userMessage:
          "Tu tarjeta ha expirado. Por favor, usa una tarjeta válida.",
        adminMessage: "Stripe expired card",
        retryable: true,
        maxRetries: 1,
      },
      processing_error: {
        category: ErrorCategory.PROVIDER,
        severity: ErrorSeverity.MEDIUM,
        userMessage:
          "Error temporal del procesador de pagos. Por favor, intenta nuevamente.",
        adminMessage: "Stripe processing error",
        retryable: true,
        maxRetries: 5,
      },
      api_connection_error: {
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.HIGH,
        userMessage:
          "Error de conexión. Por favor, verifica tu internet e intenta nuevamente.",
        adminMessage: "Stripe API connection error",
        retryable: true,
        maxRetries: 3,
      },
    },
    paypal: {
      INSTRUMENT_DECLINED: {
        category: ErrorCategory.USER,
        severity: ErrorSeverity.LOW,
        userMessage:
          "PayPal rechazó el método de pago. Por favor, verifica tu cuenta o usa otro método.",
        adminMessage: "PayPal instrument declined",
        retryable: true,
        maxRetries: 2,
      },
      PAYER_ACCOUNT_RESTRICTED: {
        category: ErrorCategory.USER,
        severity: ErrorSeverity.MEDIUM,
        userMessage:
          "Tu cuenta de PayPal tiene restricciones. Por favor, contacta a PayPal.",
        adminMessage: "PayPal account restricted",
        retryable: false,
        maxRetries: 0,
      },
      INTERNAL_SERVER_ERROR: {
        category: ErrorCategory.PROVIDER,
        severity: ErrorSeverity.HIGH,
        userMessage:
          "Error temporal de PayPal. Por favor, intenta nuevamente en unos minutos.",
        adminMessage: "PayPal internal server error",
        retryable: true,
        maxRetries: 3,
      },
    },
    mercadopago: {
      cc_rejected_insufficient_amount: {
        category: ErrorCategory.USER,
        severity: ErrorSeverity.LOW,
        userMessage: "Fondos insuficientes. Por favor, verifica tu saldo.",
        adminMessage: "MercadoPago insufficient funds",
        retryable: true,
        maxRetries: 2,
      },
      cc_rejected_bad_filled_card_number: {
        category: ErrorCategory.USER,
        severity: ErrorSeverity.LOW,
        userMessage:
          "Número de tarjeta inválido. Por favor, verifica los datos.",
        adminMessage: "MercadoPago invalid card number",
        retryable: true,
        maxRetries: 3,
      },
      internal_error: {
        category: ErrorCategory.PROVIDER,
        severity: ErrorSeverity.HIGH,
        userMessage:
          "Error temporal de MercadoPago. Por favor, intenta nuevamente.",
        adminMessage: "MercadoPago internal error",
        retryable: true,
        maxRetries: 3,
      },
    },
  };

  private static readonly DEFAULT_RETRY_STRATEGIES: Record<
    ErrorCategory,
    RetryStrategy
  > = {
    [ErrorCategory.PROVIDER]: {
      maxRetries: 3,
      retryDelayMs: 2000,
      backoffMultiplier: 2,
      retryableErrorCodes: [
        "processing_error",
        "internal_error",
        "INTERNAL_SERVER_ERROR",
      ],
    },
    [ErrorCategory.NETWORK]: {
      maxRetries: 5,
      retryDelayMs: 1000,
      backoffMultiplier: 1.5,
      retryableErrorCodes: ["api_connection_error", "timeout", "network_error"],
    },
    [ErrorCategory.VALIDATION]: {
      maxRetries: 0,
      retryDelayMs: 0,
      backoffMultiplier: 1,
      retryableErrorCodes: [],
    },
    [ErrorCategory.SYSTEM]: {
      maxRetries: 2,
      retryDelayMs: 5000,
      backoffMultiplier: 2,
      retryableErrorCodes: ["database_error", "service_unavailable"],
    },
    [ErrorCategory.USER]: {
      maxRetries: 2,
      retryDelayMs: 0,
      backoffMultiplier: 1,
      retryableErrorCodes: [
        "card_declined",
        "insufficient_funds",
        "INSTRUMENT_DECLINED",
      ],
    },
  };

  static classifyError(
    error: PaymentError,
    provider: PaymentProviderType,
    context?: Record<string, any>
  ): ClassifiedError {
    const providerPatterns = this.ERROR_PATTERNS[provider] || {};
    const errorPattern =
      providerPatterns[error.code] || this.getDefaultErrorPattern(error.code);

    const category =
      errorPattern.category || this.inferCategory(error.code, error.message);
    const severity =
      errorPattern.severity || this.inferSeverity(error.code, category);
    const retryStrategy = this.getRetryStrategy(category, errorPattern);

    return {
      ...error,
      category,
      severity,
      retryStrategy,
      userMessage:
        errorPattern.userMessage || this.generateUserMessage(error, category),
      adminMessage:
        errorPattern.adminMessage || `${provider}: ${error.message}`,
      shouldNotifyAdmin:
        severity === ErrorSeverity.HIGH || severity === ErrorSeverity.CRITICAL,
      retryable:
        errorPattern.retryable !== false && retryStrategy.maxRetries > 0,
    };
  }

  private static getDefaultErrorPattern(errorCode: string) {
    // Default patterns for common error codes
    const defaultPatterns: Record<string, any> = {
      timeout: {
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        userMessage:
          "La operación tardó demasiado. Por favor, intenta nuevamente.",
        adminMessage: "Request timeout",
        retryable: true,
        maxRetries: 3,
      },
      network_error: {
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        userMessage: "Error de conexión. Por favor, verifica tu internet.",
        adminMessage: "Network connectivity error",
        retryable: true,
        maxRetries: 3,
      },
      validation_error: {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        userMessage:
          "Los datos proporcionados no son válidos. Por favor, revísalos.",
        adminMessage: "Input validation failed",
        retryable: false,
        maxRetries: 0,
      },
      database_error: {
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.HIGH,
        userMessage:
          "Error temporal del sistema. Por favor, intenta nuevamente.",
        adminMessage: "Database operation failed",
        retryable: true,
        maxRetries: 2,
      },
    };

    return (
      defaultPatterns[errorCode] || {
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.MEDIUM,
        userMessage:
          "Ocurrió un error inesperado. Por favor, intenta nuevamente.",
        adminMessage: `Unknown error: ${errorCode}`,
        retryable: true,
        maxRetries: 1,
      }
    );
  }

  private static inferCategory(
    errorCode: string,
    message: string
  ): ErrorCategory {
    const lowerCode = errorCode.toLowerCase();
    const lowerMessage = message.toLowerCase();

    if (
      lowerCode.includes("network") ||
      lowerCode.includes("connection") ||
      lowerCode.includes("timeout")
    ) {
      return ErrorCategory.NETWORK;
    }
    if (
      lowerCode.includes("validation") ||
      lowerCode.includes("invalid") ||
      lowerCode.includes("required")
    ) {
      return ErrorCategory.VALIDATION;
    }
    if (
      lowerCode.includes("declined") ||
      lowerCode.includes("insufficient") ||
      lowerCode.includes("expired")
    ) {
      return ErrorCategory.USER;
    }
    if (
      lowerCode.includes("internal") ||
      lowerCode.includes("server") ||
      lowerMessage.includes("api")
    ) {
      return ErrorCategory.PROVIDER;
    }

    return ErrorCategory.SYSTEM;
  }

  private static inferSeverity(
    errorCode: string,
    category: ErrorCategory
  ): ErrorSeverity {
    const lowerCode = errorCode.toLowerCase();

    if (
      category === ErrorCategory.USER ||
      category === ErrorCategory.VALIDATION
    ) {
      return ErrorSeverity.LOW;
    }
    if (lowerCode.includes("critical") || lowerCode.includes("fatal")) {
      return ErrorSeverity.CRITICAL;
    }
    if (
      lowerCode.includes("internal") ||
      lowerCode.includes("server") ||
      category === ErrorCategory.SYSTEM
    ) {
      return ErrorSeverity.HIGH;
    }

    return ErrorSeverity.MEDIUM;
  }

  private static getRetryStrategy(
    category: ErrorCategory,
    errorPattern: any
  ): RetryStrategy {
    const defaultStrategy = this.DEFAULT_RETRY_STRATEGIES[category];

    return {
      maxRetries: errorPattern.maxRetries ?? defaultStrategy.maxRetries,
      retryDelayMs: defaultStrategy.retryDelayMs,
      backoffMultiplier: defaultStrategy.backoffMultiplier,
      retryableErrorCodes: defaultStrategy.retryableErrorCodes,
    };
  }

  private static generateUserMessage(
    error: PaymentError,
    category: ErrorCategory
  ): string {
    const messages = {
      [ErrorCategory.USER]:
        "Por favor, verifica tus datos de pago e intenta nuevamente.",
      [ErrorCategory.PROVIDER]:
        "Error temporal del procesador de pagos. Por favor, intenta nuevamente.",
      [ErrorCategory.NETWORK]:
        "Error de conexión. Por favor, verifica tu internet e intenta nuevamente.",
      [ErrorCategory.VALIDATION]:
        "Los datos proporcionados no son válidos. Por favor, revísalos.",
      [ErrorCategory.SYSTEM]:
        "Error temporal del sistema. Por favor, intenta nuevamente en unos minutos.",
    };

    return (
      messages[category] ||
      "Ocurrió un error inesperado. Por favor, intenta nuevamente."
    );
  }

  static shouldRetry(
    classifiedError: ClassifiedError,
    attemptNumber: number
  ): boolean {
    return (
      classifiedError.retryable &&
      attemptNumber < classifiedError.retryStrategy.maxRetries &&
      classifiedError.retryStrategy.retryableErrorCodes.includes(
        classifiedError.code
      )
    );
  }

  static getRetryDelay(
    classifiedError: ClassifiedError,
    attemptNumber: number
  ): number {
    const { retryDelayMs, backoffMultiplier } = classifiedError.retryStrategy;
    return retryDelayMs * Math.pow(backoffMultiplier, attemptNumber);
  }
}
