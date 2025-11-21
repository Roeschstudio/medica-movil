import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  IntegrationValidationSuite,
  StripeValidator,
  SupabaseValidator,
  WebRTCValidator,
  WebSocketValidator,
} from "../lib/integration-validation-suite";

// Mock external dependencies
vi.mock("../lib/stripe");
vi.mock("../lib/supabase");
vi.mock("socket.io-client");

describe("Integration Validation Suite", () => {
  let validationSuite: IntegrationValidationSuite;

  beforeAll(() => {
    validationSuite = new IntegrationValidationSuite();
  });

  describe("StripeValidator", () => {
    let stripeValidator: StripeValidator;

    beforeAll(() => {
      stripeValidator = new StripeValidator();
    });

    it("should validate Stripe connection", async () => {
      // Mock successful Stripe connection
      const mockStripe = {
        accounts: {
          retrieve: vi.fn().mockResolvedValue({
            id: "acct_test123",
            country: "MX",
            default_currency: "mxn",
            charges_enabled: true,
            payouts_enabled: true,
          }),
        },
      };

      // Replace the stripe import with our mock
      vi.doMock("../lib/stripe", () => ({
        stripe: mockStripe,
      }));

      const result = await stripeValidator.validateStripeConnection();

      expect(result.success).toBe(true);
      expect(result.message).toContain("Stripe connection successful");
      expect(result.details).toHaveProperty("accountId");
      expect(result.details).toHaveProperty("country", "MX");
    });

    it("should handle Stripe connection failure", async () => {
      // Mock failed Stripe connection
      const mockStripe = {
        accounts: {
          retrieve: vi.fn().mockRejectedValue(new Error("Invalid API key")),
        },
      };

      vi.doMock("../lib/stripe", () => ({
        stripe: mockStripe,
      }));

      const result = await stripeValidator.validateStripeConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain("Stripe connection failed");
      expect(result.error).toContain("Invalid API key");
    });

    it("should validate payment intent creation and cancellation", async () => {
      const mockStripe = {
        paymentIntents: {
          create: vi.fn().mockResolvedValue({
            id: "pi_test123",
            status: "requires_payment_method",
            amount: 100,
            currency: "mxn",
          }),
          cancel: vi.fn().mockResolvedValue({
            id: "pi_test123",
            status: "canceled",
          }),
        },
      };

      vi.doMock("../lib/stripe", () => ({
        stripe: mockStripe,
      }));

      const result = await stripeValidator.validatePaymentIntentCreation();

      expect(result.success).toBe(true);
      expect(result.message).toContain(
        "Payment intent creation and cancellation successful"
      );
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 100,
        currency: "mxn",
        metadata: {
          test: "integration_validation",
          appointmentId: "test_appointment_id",
        },
      });
      expect(mockStripe.paymentIntents.cancel).toHaveBeenCalledWith(
        "pi_test123"
      );
    });

    it("should validate webhook endpoints", async () => {
      const mockStripe = {
        webhookEndpoints: {
          list: vi.fn().mockResolvedValue({
            data: [
              {
                id: "we_test123",
                url: "https://example.com/webhook",
                status: "enabled",
                enabled_events: [
                  "checkout.session.completed",
                  "payment_intent.succeeded",
                ],
              },
            ],
          }),
        },
      };

      vi.doMock("../lib/stripe", () => ({
        stripe: mockStripe,
      }));

      const result = await stripeValidator.validateWebhookEndpoint();

      expect(result.success).toBe(true);
      expect(result.message).toContain(
        "Webhook endpoints configured correctly"
      );
      expect(result.details.activeWebhooks).toBe(1);
    });

    it("should validate Mexican payment methods", async () => {
      const mockStripe = {
        checkout: {
          sessions: {
            create: vi.fn().mockResolvedValue({
              id: "cs_test123",
              payment_method_types: ["card", "oxxo"],
              currency: "mxn",
              mode: "payment",
            }),
            expire: vi.fn().mockResolvedValue({
              id: "cs_test123",
              status: "expired",
            }),
          },
        },
      };

      vi.doMock("../lib/stripe", () => ({
        stripe: mockStripe,
      }));

      const result = await stripeValidator.validatePaymentMethods();

      expect(result.success).toBe(true);
      expect(result.message).toContain(
        "Mexican payment methods validation successful"
      );
      expect(result.details.paymentMethodTypes).toContain("oxxo");
    });
  });

  describe("SupabaseValidator", () => {
    let supabaseValidator: SupabaseValidator;

    beforeAll(() => {
      supabaseValidator = new SupabaseValidator();
    });

    it("should validate database connection", async () => {
      // Mock successful database connection
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [{ count: 1 }],
              error: null,
            }),
          }),
        }),
      };

      vi.doMock("../lib/supabase", () => ({
        createSupabaseAdminClient: () => mockSupabase,
      }));

      const result = await supabaseValidator.validateDatabaseConnection();

      expect(result.success).toBe(true);
      expect(result.message).toContain("Database connection successful");
    });

    it("should validate authentication flow", async () => {
      const mockSupabase = {
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: null },
            error: null,
          }),
        },
      };

      vi.doMock("../lib/supabase", () => ({
        createSupabaseBrowserClient: () => mockSupabase,
      }));

      const result = await supabaseValidator.validateAuthenticationFlow();

      expect(result.success).toBe(true);
      expect(result.message).toContain(
        "Authentication flow validation successful"
      );
    });

    it("should handle authentication configuration errors", async () => {
      const mockSupabase = {
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: null },
            error: { message: "Invalid API key" },
          }),
        },
      };

      vi.doMock("../lib/supabase", () => ({
        createSupabaseBrowserClient: () => mockSupabase,
      }));

      const result = await supabaseValidator.validateAuthenticationFlow();

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid API key");
    });
  });

  describe("WebSocketValidator", () => {
    let websocketValidator: WebSocketValidator;

    beforeAll(() => {
      websocketValidator = new WebSocketValidator();
    });

    it("should validate WebSocket connection", async () => {
      // Mock successful WebSocket connection
      const mockSocket = {
        id: "socket123",
        io: {
          engine: {
            transport: { name: "websocket" },
          },
        },
        on: vi.fn((event, callback) => {
          if (event === "connect") {
            setTimeout(callback, 100); // Simulate connection after 100ms
          }
        }),
        disconnect: vi.fn(),
      };

      const mockIo = vi.fn().mockReturnValue(mockSocket);

      vi.doMock("socket.io-client", () => ({
        io: mockIo,
      }));

      const result = await websocketValidator.validateWebSocketConnection();

      expect(result.success).toBe(true);
      expect(result.message).toContain("WebSocket connection successful");
      expect(result.details.socketId).toBe("socket123");
    });

    it("should handle WebSocket connection timeout", async () => {
      // Mock WebSocket connection that never connects
      const mockSocket = {
        on: vi.fn(),
        disconnect: vi.fn(),
      };

      const mockIo = vi.fn().mockReturnValue(mockSocket);

      vi.doMock("socket.io-client", () => ({
        io: mockIo,
      }));

      const result = await websocketValidator.validateWebSocketConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain("WebSocket connection timeout");
    });

    it("should validate chat functionality authentication", async () => {
      // Mock WebSocket connection with authentication error
      const mockSocket = {
        on: vi.fn((event, callback) => {
          if (event === "connect_error") {
            setTimeout(
              () => callback({ message: "Authentication error" }),
              100
            );
          }
        }),
        disconnect: vi.fn(),
      };

      const mockIo = vi.fn().mockReturnValue(mockSocket);

      vi.doMock("socket.io-client", () => ({
        io: mockIo,
      }));

      const result = await websocketValidator.validateChatFunctionality();

      expect(result.success).toBe(true);
      expect(result.message).toContain(
        "Chat authentication validation working correctly"
      );
    });
  });

  describe("WebRTCValidator", () => {
    let webrtcValidator: WebRTCValidator;

    beforeAll(() => {
      webrtcValidator = new WebRTCValidator();
    });

    it("should validate WebRTC support", async () => {
      // Mock WebRTC APIs
      Object.defineProperty(global.navigator, "mediaDevices", {
        value: {
          getUserMedia: vi.fn(),
        },
        writable: true,
      });

      Object.defineProperty(global.window, "RTCPeerConnection", {
        value: vi.fn(),
        writable: true,
      });

      Object.defineProperty(global.window, "RTCSessionDescription", {
        value: vi.fn(),
        writable: true,
      });

      Object.defineProperty(global.window, "RTCIceCandidate", {
        value: vi.fn(),
        writable: true,
      });

      const result = await webrtcValidator.validateWebRTCSupport();

      expect(result.success).toBe(true);
      expect(result.message).toContain("WebRTC support validation successful");
      expect(result.details.getUserMedia).toBe(true);
      expect(result.details.RTCPeerConnection).toBe(true);
    });

    it("should validate media device access", async () => {
      // Mock media devices
      Object.defineProperty(global.navigator, "mediaDevices", {
        value: {
          enumerateDevices: vi.fn().mockResolvedValue([
            { kind: "videoinput", label: "Camera", deviceId: "camera1" },
            { kind: "audioinput", label: "Microphone", deviceId: "mic1" },
          ]),
        },
        writable: true,
      });

      const result = await webrtcValidator.validateMediaDeviceAccess();

      expect(result.success).toBe(true);
      expect(result.message).toContain("Media devices available");
      expect(result.details.videoDevices).toBe(1);
      expect(result.details.audioDevices).toBe(1);
    });

    it("should validate peer connection creation", async () => {
      // Mock RTCPeerConnection
      const mockPeerConnection = {
        createOffer: vi.fn().mockResolvedValue({
          type: "offer",
          sdp: "mock-sdp",
        }),
        setLocalDescription: vi.fn().mockResolvedValue(undefined),
        connectionState: "new",
        iceConnectionState: "new",
        signalingState: "stable",
        close: vi.fn(),
      };

      Object.defineProperty(global.window, "RTCPeerConnection", {
        value: vi.fn().mockImplementation(() => mockPeerConnection),
        writable: true,
      });

      const result = await webrtcValidator.validatePeerConnectionCreation();

      expect(result.success).toBe(true);
      expect(result.message).toContain("Peer connection creation successful");
      expect(result.details.offerCreated).toBe(true);
      expect(result.details.localDescriptionSet).toBe(true);
    });
  });

  describe("IntegrationValidationSuite", () => {
    it("should run full validation and generate report", async () => {
      // Mock all validators to return successful results
      vi.spyOn(
        validationSuite as any,
        "validateStripeIntegration"
      ).mockResolvedValue({
        success: true,
        message: "All Stripe integration tests passed",
        timestamp: new Date(),
      });

      vi.spyOn(
        validationSuite as any,
        "validateSupabaseIntegration"
      ).mockResolvedValue({
        success: true,
        message: "All Supabase integration tests passed",
        timestamp: new Date(),
      });

      vi.spyOn(
        validationSuite as any,
        "validateWebSocketIntegration"
      ).mockResolvedValue({
        success: true,
        message: "All WebSocket integration tests passed",
        timestamp: new Date(),
      });

      vi.spyOn(
        validationSuite as any,
        "validateWebRTCIntegration"
      ).mockResolvedValue({
        success: true,
        message: "All WebRTC integration tests passed",
        timestamp: new Date(),
      });

      const report = await validationSuite.runFullValidation();

      expect(report.overall.success).toBe(true);
      expect(report.overall.passedTests).toBe(4);
      expect(report.overall.totalTests).toBe(4);
      expect(report.overall.criticalFailures).toHaveLength(0);
    });

    it("should handle partial failures correctly", async () => {
      // Mock some validators to fail
      vi.spyOn(
        validationSuite as any,
        "validateStripeIntegration"
      ).mockResolvedValue({
        success: false,
        message: "Stripe integration failed",
        error: "API key invalid",
        timestamp: new Date(),
      });

      vi.spyOn(
        validationSuite as any,
        "validateSupabaseIntegration"
      ).mockResolvedValue({
        success: true,
        message: "All Supabase integration tests passed",
        timestamp: new Date(),
      });

      vi.spyOn(
        validationSuite as any,
        "validateWebSocketIntegration"
      ).mockResolvedValue({
        success: false,
        message: "WebSocket integration failed",
        error: "Connection timeout",
        timestamp: new Date(),
      });

      vi.spyOn(
        validationSuite as any,
        "validateWebRTCIntegration"
      ).mockResolvedValue({
        success: true,
        message: "All WebRTC integration tests passed",
        timestamp: new Date(),
      });

      const report = await validationSuite.runFullValidation();

      expect(report.overall.success).toBe(false);
      expect(report.overall.passedTests).toBe(2);
      expect(report.overall.totalTests).toBe(4);
      expect(report.overall.criticalFailures).toContain(
        "Stripe payment integration"
      );
      expect(report.overall.criticalFailures).toContain(
        "WebSocket real-time features"
      );
    });

    it("should generate detailed report correctly", () => {
      const mockReport = {
        stripe: {
          success: true,
          message: "Stripe tests passed",
          timestamp: new Date(),
        },
        supabase: {
          success: false,
          message: "Supabase tests failed",
          error: "Database connection error",
          timestamp: new Date(),
        },
        websocket: {
          success: true,
          message: "WebSocket tests passed",
          timestamp: new Date(),
        },
        webrtc: {
          success: true,
          message: "WebRTC tests passed",
          timestamp: new Date(),
        },
        overall: {
          success: false,
          passedTests: 3,
          totalTests: 4,
          criticalFailures: ["Supabase database integration"],
        },
      };

      const detailedReport = validationSuite.generateDetailedReport(mockReport);

      expect(detailedReport).toContain("INTEGRATION VALIDATION REPORT");
      expect(detailedReport).toContain("Overall Status: FAIL");
      expect(detailedReport).toContain("Tests Passed: 3/4");
      expect(detailedReport).toContain("CRITICAL FAILURES:");
      expect(detailedReport).toContain("Supabase database integration");
      expect(detailedReport).toContain("STRIPE PAYMENT INTEGRATION:");
      expect(detailedReport).toContain("Status: PASS");
      expect(detailedReport).toContain("SUPABASE DATABASE INTEGRATION:");
      expect(detailedReport).toContain("Status: FAIL");
      expect(detailedReport).toContain("Error: Database connection error");
    });
  });
});
