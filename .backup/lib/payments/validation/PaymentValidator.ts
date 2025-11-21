import { PaymentProviderType, PaymentRequest } from "../types";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PaymentValidationRules {
  minAmount: number;
  maxAmount: number;
  allowedCurrencies: string[];
  requiredFields: string[];
  emailRegex: RegExp;
  phoneRegex?: RegExp;
}

export class PaymentValidator {
  private static readonly DEFAULT_RULES: PaymentValidationRules = {
    minAmount: 100, // $1.00 MXN minimum
    maxAmount: 1000000, // $10,000 MXN maximum
    allowedCurrencies: ["MXN", "USD"],
    requiredFields: [
      "appointmentId",
      "amount",
      "currency",
      "description",
      "patientEmail",
      "patientName",
    ],
    emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phoneRegex: /^(\+52|52)?[\s\-]?(\d{2})[\s\-]?(\d{4})[\s\-]?(\d{4})$/, // Mexican phone format
  };

  private static readonly PROVIDER_RULES: Record<
    PaymentProviderType,
    Partial<PaymentValidationRules>
  > = {
    stripe: {
      minAmount: 50, // Stripe minimum
      maxAmount: 999999, // Stripe maximum for MXN
    },
    paypal: {
      minAmount: 100,
      maxAmount: 1000000,
      allowedCurrencies: ["MXN", "USD", "EUR"],
    },
    mercadopago: {
      minAmount: 100,
      maxAmount: 500000, // MercadoPago limit for Mexico
      allowedCurrencies: ["MXN"],
    },
  };

  /**
   * Validate payment request data
   */
  static validatePaymentRequest(
    request: PaymentRequest,
    provider: PaymentProviderType
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    const rules = this.getProviderRules(provider);

    // Validate required fields
    this.validateRequiredFields(request, rules, result);

    // Validate amount
    this.validateAmount(request.amount, rules, result);

    // Validate currency
    this.validateCurrency(request.currency, rules, result);

    // Validate email
    this.validateEmail(request.patientEmail, rules, result);

    // Validate appointment ID format
    this.validateAppointmentId(request.appointmentId, result);

    // Validate URLs
    this.validateUrls(request, result);

    // Provider-specific validations
    this.validateProviderSpecific(request, provider, result);

    // Security validations
    this.validateSecurity(request, result);

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate payment amount and currency
   */
  static validatePaymentAmount(
    amount: number,
    currency: string,
    provider: PaymentProviderType
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    const rules = this.getProviderRules(provider);

    this.validateAmount(amount, rules, result);
    this.validateCurrency(currency, rules, result);

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate user authorization for payment operations
   */
  static validateUserAuthorization(
    userId: string,
    appointmentId: string,
    operation: "create" | "capture" | "refund" | "status"
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
      result.errors.push("User ID is required");
    }

    if (
      !appointmentId ||
      typeof appointmentId !== "string" ||
      appointmentId.trim().length === 0
    ) {
      result.errors.push("Appointment ID is required");
    }

    // Validate operation type
    const validOperations = ["create", "capture", "refund", "status"];
    if (!validOperations.includes(operation)) {
      result.errors.push(`Invalid operation: ${operation}`);
    }

    // Additional security checks based on operation
    switch (operation) {
      case "refund":
        result.warnings.push(
          "Refund operation requires additional verification"
        );
        break;
      case "capture":
        result.warnings.push(
          "Capture operation should be performed within 7 days"
        );
        break;
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Sanitize payment data to remove potentially harmful content
   */
  static sanitizePaymentData(data: any): any {
    if (typeof data !== "object" || data === null) {
      return data;
    }

    const sanitized: any = {};

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string") {
        // Remove potentially harmful characters and trim
        sanitized[key] = value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // Remove script tags
          .replace(/javascript:/gi, "") // Remove javascript: protocol
          .replace(/on\w+\s*=/gi, "") // Remove event handlers
          .trim();
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = this.sanitizePaymentData(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private static getProviderRules(
    provider: PaymentProviderType
  ): PaymentValidationRules {
    return {
      ...this.DEFAULT_RULES,
      ...this.PROVIDER_RULES[provider],
    };
  }

  private static validateRequiredFields(
    request: PaymentRequest,
    rules: PaymentValidationRules,
    result: ValidationResult
  ): void {
    for (const field of rules.requiredFields) {
      if (
        !(field in request) ||
        request[field as keyof PaymentRequest] === undefined ||
        request[field as keyof PaymentRequest] === null
      ) {
        result.errors.push(`Required field missing: ${field}`);
      } else if (
        typeof request[field as keyof PaymentRequest] === "string" &&
        (request[field as keyof PaymentRequest] as string).trim().length === 0
      ) {
        result.errors.push(`Required field is empty: ${field}`);
      }
    }
  }

  private static validateAmount(
    amount: number,
    rules: PaymentValidationRules,
    result: ValidationResult
  ): void {
    if (typeof amount !== "number" || isNaN(amount)) {
      result.errors.push("Amount must be a valid number");
      return;
    }

    if (amount < rules.minAmount) {
      result.errors.push(
        `Amount must be at least ${rules.minAmount / 100} ${
          rules.allowedCurrencies[0]
        }`
      );
    }

    if (amount > rules.maxAmount) {
      result.errors.push(
        `Amount cannot exceed ${rules.maxAmount / 100} ${
          rules.allowedCurrencies[0]
        }`
      );
    }

    if (amount % 1 !== 0) {
      result.errors.push("Amount must be in cents (whole number)");
    }

    if (amount <= 0) {
      result.errors.push("Amount must be positive");
    }
  }

  private static validateCurrency(
    currency: string,
    rules: PaymentValidationRules,
    result: ValidationResult
  ): void {
    if (!currency || typeof currency !== "string") {
      result.errors.push("Currency is required");
      return;
    }

    const upperCurrency = currency.toUpperCase();
    if (!rules.allowedCurrencies.includes(upperCurrency)) {
      result.errors.push(
        `Currency ${currency} is not supported. Allowed: ${rules.allowedCurrencies.join(
          ", "
        )}`
      );
    }

    if (currency !== upperCurrency) {
      result.warnings.push("Currency should be uppercase");
    }
  }

  private static validateEmail(
    email: string,
    rules: PaymentValidationRules,
    result: ValidationResult
  ): void {
    if (!email || typeof email !== "string") {
      result.errors.push("Patient email is required");
      return;
    }

    if (!rules.emailRegex.test(email)) {
      result.errors.push("Invalid email format");
    }

    if (email.length > 254) {
      result.errors.push("Email is too long");
    }

    // Check for suspicious patterns
    if (email.includes("..") || email.startsWith(".") || email.endsWith(".")) {
      result.errors.push("Invalid email format");
    }
  }

  private static validateAppointmentId(
    appointmentId: string,
    result: ValidationResult
  ): void {
    if (!appointmentId || typeof appointmentId !== "string") {
      result.errors.push("Appointment ID is required");
      return;
    }

    // Basic format validation (assuming CUID format)
    if (appointmentId.length < 10 || appointmentId.length > 50) {
      result.errors.push("Invalid appointment ID format");
    }

    // Check for suspicious characters
    if (!/^[a-zA-Z0-9_-]+$/.test(appointmentId)) {
      result.errors.push("Appointment ID contains invalid characters");
    }
  }

  private static validateUrls(
    request: PaymentRequest,
    result: ValidationResult
  ): void {
    const urls = [
      { name: "returnUrl", value: request.returnUrl },
      { name: "cancelUrl", value: request.cancelUrl },
    ];

    for (const { name, value } of urls) {
      if (value) {
        try {
          const url = new URL(value);

          // Only allow HTTPS in production
          if (
            process.env.NODE_ENV === "production" &&
            url.protocol !== "https:"
          ) {
            result.errors.push(`${name} must use HTTPS in production`);
          }

          // Validate domain (should be same domain or allowed domains)
          const allowedDomains =
            process.env.ALLOWED_REDIRECT_DOMAINS?.split(",") || [];
          const currentDomain = process.env.NEXTAUTH_URL
            ? new URL(process.env.NEXTAUTH_URL).hostname
            : "localhost";

          if (
            !allowedDomains.includes(url.hostname) &&
            url.hostname !== currentDomain
          ) {
            result.warnings.push(
              `${name} uses external domain: ${url.hostname}`
            );
          }
        } catch (error) {
          result.errors.push(`Invalid ${name} format`);
        }
      }
    }
  }

  private static validateProviderSpecific(
    request: PaymentRequest,
    provider: PaymentProviderType,
    result: ValidationResult
  ): void {
    switch (provider) {
      case "stripe":
        this.validateStripeSpecific(request, result);
        break;
      case "paypal":
        this.validatePayPalSpecific(request, result);
        break;
      case "mercadopago":
        this.validateMercadoPagoSpecific(request, result);
        break;
    }
  }

  private static validateStripeSpecific(
    request: PaymentRequest,
    result: ValidationResult
  ): void {
    // Stripe-specific validations
    if (request.description && request.description.length > 1000) {
      result.errors.push(
        "Description too long for Stripe (max 1000 characters)"
      );
    }

    // Validate metadata size
    if (request.metadata) {
      const metadataSize = JSON.stringify(request.metadata).length;
      if (metadataSize > 65536) {
        // 64KB limit
        result.errors.push("Metadata too large for Stripe");
      }
    }
  }

  private static validatePayPalSpecific(
    request: PaymentRequest,
    result: ValidationResult
  ): void {
    // PayPal-specific validations
    if (request.description && request.description.length > 127) {
      result.warnings.push(
        "Description may be truncated by PayPal (max 127 characters recommended)"
      );
    }

    // PayPal has specific currency requirements
    if (request.currency === "MXN" && request.amount < 1000) {
      // $10 MXN minimum for PayPal
      result.warnings.push("PayPal may have higher minimum amounts for MXN");
    }
  }

  private static validateMercadoPagoSpecific(
    request: PaymentRequest,
    result: ValidationResult
  ): void {
    // MercadoPago-specific validations
    if (request.currency !== "MXN") {
      result.errors.push("MercadoPago only supports MXN currency in Mexico");
    }

    if (request.description && request.description.length > 600) {
      result.errors.push(
        "Description too long for MercadoPago (max 600 characters)"
      );
    }
  }

  private static validateSecurity(
    request: PaymentRequest,
    result: ValidationResult
  ): void {
    // Check for suspicious patterns in description
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(request.description)) {
        result.errors.push("Description contains potentially harmful content");
        break;
      }
    }

    // Validate patient name for suspicious content
    if (request.patientName) {
      if (request.patientName.length > 100) {
        result.errors.push("Patient name is too long");
      }

      if (!/^[a-zA-ZÀ-ÿ\u00f1\u00d1\s\-'\.]+$/.test(request.patientName)) {
        result.errors.push("Patient name contains invalid characters");
      }
    }

    // Check for excessively long fields that might indicate an attack
    const maxLengths = {
      appointmentId: 50,
      description: 1000,
      patientEmail: 254,
      patientName: 100,
      returnUrl: 2048,
      cancelUrl: 2048,
    };

    for (const [field, maxLength] of Object.entries(maxLengths)) {
      const value = request[field as keyof PaymentRequest];
      if (typeof value === "string" && value.length > maxLength) {
        result.errors.push(
          `${field} exceeds maximum length of ${maxLength} characters`
        );
      }
    }
  }
}
