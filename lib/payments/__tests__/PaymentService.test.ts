import { MercadoPagoProvider } from "../mercadopago/MercadoPagoProvider";
import { PaymentService } from "../PaymentService";
import { PayPalProvider } from "../paypal/PayPalProvider";
import { StripeProvider } from "../stripe/StripeProvider";
import { PaymentProviderType, PaymentRequest, PaymentResult } from "../types";

// Mock the providers
jest.mock("../stripe/StripeProvider");
jest.mock("../paypal/PayPalProvider");
jest.mock("../mercadopago/MercadoPagoProvider");

describe("PaymentService", () => {
  let paymentService: PaymentService;
  let mockStripeProvider: jest.Mocked<StripeProvider>;
  let mockPayPalProvider: jest.Mocked<PayPalProvider>;
  let mockMercadoPagoProvider: jest.Mocked<MercadoPagoProvider>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock instances
    mockStripeProvider = new StripeProvider() as jest.Mocked<StripeProvider>;
    mockPayPalProvider = new PayPalProvider() as jest.Mocked<PayPalProvider>;
    mockMercadoPagoProvider =
      new MercadoPagoProvider() as jest.Mocked<MercadoPagoProvider>;

    // Mock the getId method
    mockStripeProvider.getId = jest.fn().mockReturnValue("stripe");
    mockPayPalProvider.getId = jest.fn().mockReturnValue("paypal");
    mockMercadoPagoProvider.getId = jest.fn().mockReturnValue("mercadopago");

    paymentService = new PaymentService();
  });

  describe("Provider Registration", () => {
    test("should initialize with all providers", () => {
      const availableProviders = paymentService.getAvailableProviders();

      expect(availableProviders).toHaveLength(3);
      expect(availableProviders.map((p) => p.id)).toContain("stripe");
      expect(availableProviders.map((p) => p.id)).toContain("paypal");
      expect(availableProviders.map((p) => p.id)).toContain("mercadopago");
    });

    test("should return provider by ID", () => {
      const stripeProvider = paymentService.getProvider("stripe");
      const paypalProvider = paymentService.getProvider("paypal");
      const mercadopagoProvider = paymentService.getProvider("mercadopago");

      expect(stripeProvider).toBeDefined();
      expect(paypalProvider).toBeDefined();
      expect(mercadopagoProvider).toBeDefined();
    });

    test("should return undefined for unknown provider", () => {
      const unknownProvider = paymentService.getProvider(
        "unknown" as PaymentProviderType
      );
      expect(unknownProvider).toBeUndefined();
    });

    test("should have correct provider information", () => {
      const providers = paymentService.getAvailableProviders();

      const stripeProvider = providers.find((p) => p.id === "stripe");
      expect(stripeProvider).toMatchObject({
        id: "stripe",
        displayName: "Tarjeta de Crédito/Débito",
        available: true,
      });

      const paypalProvider = providers.find((p) => p.id === "paypal");
      expect(paypalProvider).toMatchObject({
        id: "paypal",
        displayName: "PayPal",
        available: true,
      });

      const mercadopagoProvider = providers.find((p) => p.id === "mercadopago");
      expect(mercadopagoProvider).toMatchObject({
        id: "mercadopago",
        displayName: "MercadoPago",
        available: true,
      });
    });
  });

  describe("Payment Creation", () => {
    const mockPaymentRequest: PaymentRequest = {
      appointmentId: "test-appointment-id",
      amount: 1000,
      currency: "MXN",
      description: "Test payment",
      patientEmail: "test@example.com",
      patientName: "Test Patient",
      returnUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    };

    test("should create payment with Stripe provider", async () => {
      const mockResult: PaymentResult = {
        success: true,
        paymentId: "stripe-payment-id",
        checkoutUrl: "https://checkout.stripe.com/test",
        provider: "stripe",
      };

      mockStripeProvider.createPayment = jest
        .fn()
        .mockResolvedValue(mockResult);
      paymentService.registerProvider(mockStripeProvider);

      const result = await paymentService.createPayment(
        "stripe",
        mockPaymentRequest
      );

      expect(mockStripeProvider.createPayment).toHaveBeenCalledWith(
        mockPaymentRequest
      );
      expect(result).toEqual(mockResult);
    });

    test("should create payment with PayPal provider", async () => {
      const mockResult: PaymentResult = {
        success: true,
        paymentId: "paypal-order-id",
        checkoutUrl: "https://paypal.com/checkoutnow?token=test",
        provider: "paypal",
      };

      mockPayPalProvider.createPayment = jest
        .fn()
        .mockResolvedValue(mockResult);
      paymentService.registerProvider(mockPayPalProvider);

      const result = await paymentService.createPayment(
        "paypal",
        mockPaymentRequest
      );

      expect(mockPayPalProvider.createPayment).toHaveBeenCalledWith(
        mockPaymentRequest
      );
      expect(result).toEqual(mockResult);
    });

    test("should create payment with MercadoPago provider", async () => {
      const mockResult: PaymentResult = {
        success: true,
        paymentId: "mercadopago-preference-id",
        checkoutUrl:
          "https://mercadopago.com/checkout/v1/redirect?pref_id=test",
        provider: "mercadopago",
      };

      mockMercadoPagoProvider.createPayment = jest
        .fn()
        .mockResolvedValue(mockResult);
      paymentService.registerProvider(mockMercadoPagoProvider);

      const result = await paymentService.createPayment(
        "mercadopago",
        mockPaymentRequest
      );

      expect(mockMercadoPagoProvider.createPayment).toHaveBeenCalledWith(
        mockPaymentRequest
      );
      expect(result).toEqual(mockResult);
    });

    test("should handle provider not found error", async () => {
      const result = await paymentService.createPayment(
        "unknown" as PaymentProviderType,
        mockPaymentRequest
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Provider unknown not found");
    });

    test("should handle provider error", async () => {
      const error = new Error("Provider error");
      mockStripeProvider.createPayment = jest.fn().mockRejectedValue(error);
      paymentService.registerProvider(mockStripeProvider);

      const result = await paymentService.createPayment(
        "stripe",
        mockPaymentRequest
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Provider error");
    });
  });

  describe("Payment Capture", () => {
    test("should capture payment with correct provider", async () => {
      const mockResult: PaymentResult = {
        success: true,
        paymentId: "captured-payment-id",
        provider: "paypal",
      };

      mockPayPalProvider.capturePayment = jest
        .fn()
        .mockResolvedValue(mockResult);
      paymentService.registerProvider(mockPayPalProvider);

      const result = await paymentService.capturePayment(
        "paypal",
        "test-payment-id"
      );

      expect(mockPayPalProvider.capturePayment).toHaveBeenCalledWith(
        "test-payment-id"
      );
      expect(result).toEqual(mockResult);
    });

    test("should handle capture error", async () => {
      const error = new Error("Capture failed");
      mockPayPalProvider.capturePayment = jest.fn().mockRejectedValue(error);
      paymentService.registerProvider(mockPayPalProvider);

      const result = await paymentService.capturePayment(
        "paypal",
        "test-payment-id"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Capture failed");
    });
  });

  describe("Payment Status Check", () => {
    test("should check payment status with correct provider", async () => {
      const mockStatus = {
        id: "test-payment-id",
        status: "completed" as const,
        provider: "stripe" as PaymentProviderType,
        amount: 1000,
        currency: "MXN",
        paidAt: new Date(),
      };

      mockStripeProvider.getPaymentStatus = jest
        .fn()
        .mockResolvedValue(mockStatus);
      paymentService.registerProvider(mockStripeProvider);

      const result = await paymentService.getPaymentStatus(
        "stripe",
        "test-payment-id"
      );

      expect(mockStripeProvider.getPaymentStatus).toHaveBeenCalledWith(
        "test-payment-id"
      );
      expect(result).toEqual(mockStatus);
    });

    test("should return null for provider not found", async () => {
      const result = await paymentService.getPaymentStatus(
        "unknown" as PaymentProviderType,
        "test-payment-id"
      );
      expect(result).toBeNull();
    });

    test("should handle status check error", async () => {
      const error = new Error("Status check failed");
      mockStripeProvider.getPaymentStatus = jest.fn().mockRejectedValue(error);
      paymentService.registerProvider(mockStripeProvider);

      const result = await paymentService.getPaymentStatus(
        "stripe",
        "test-payment-id"
      );

      expect(result).toBeNull();
    });
  });

  describe("Webhook Processing", () => {
    test("should process webhook with correct provider", async () => {
      const mockPayload = {
        event: "payment.completed",
        data: { id: "test-payment" },
      };
      const mockSignature = "test-signature";

      mockStripeProvider.processWebhook = jest.fn().mockResolvedValue(true);
      paymentService.registerProvider(mockStripeProvider);

      const result = await paymentService.processWebhook(
        "stripe",
        mockPayload,
        mockSignature
      );

      expect(mockStripeProvider.processWebhook).toHaveBeenCalledWith(
        mockPayload,
        mockSignature
      );
      expect(result).toBe(true);
    });

    test("should return false for provider not found", async () => {
      const result = await paymentService.processWebhook(
        "unknown" as PaymentProviderType,
        {}
      );
      expect(result).toBe(false);
    });

    test("should handle webhook processing error", async () => {
      const error = new Error("Webhook processing failed");
      mockStripeProvider.processWebhook = jest.fn().mockRejectedValue(error);
      paymentService.registerProvider(mockStripeProvider);

      const result = await paymentService.processWebhook("stripe", {});

      expect(result).toBe(false);
    });
  });
});
