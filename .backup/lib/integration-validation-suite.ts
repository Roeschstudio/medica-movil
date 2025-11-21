import { stripe } from "@/lib/stripe";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { io, Socket } from "socket.io-client";

// Types for validation results
export interface ValidationResult {
  success: boolean;
  message: string;
  details?: any;
  error?: string;
  timestamp: Date;
}

export interface IntegrationValidationReport {
  stripe: ValidationResult;
  supabase: ValidationResult;
  websocket: ValidationResult;
  webrtc: ValidationResult;
  overall: {
    success: boolean;
    passedTests: number;
    totalTests: number;
    criticalFailures: string[];
  };
}

// Stripe Payment Integration Validator
export class StripeValidator {
  constructor() {
    // Stripe validator implementation
  }

  async validateStripeConnection(): Promise<ValidationResult> {
    try {
      // Test basic Stripe connection
      const account = await stripe.accounts.retrieve();

      return {
        success: true,
        message: "Stripe connection successful",
        details: {
          accountId: account.id,
          country: account.country,
          defaultCurrency: account.default_currency,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: "Stripe connection failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };
    }
  }

  async validatePaymentIntentCreation(): Promise<ValidationResult> {
    try {
      // Create a test payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 100, // $1.00 MXN in centavos
        currency: "mxn",
        metadata: {
          test: "integration_validation",
          appointmentId: "test_appointment_id",
        },
      });

      // Immediately cancel the test payment intent
      await stripe.paymentIntents.cancel(paymentIntent.id);

      return {
        success: true,
        message: "Payment intent creation and cancellation successful",
        details: {
          paymentIntentId: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: "Payment intent creation failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };
    }
  }

  async validateWebhookEndpoint(): Promise<ValidationResult> {
    try {
      // List webhook endpoints to verify configuration
      const webhooks = await stripe.webhookEndpoints.list();

      const activeWebhooks = webhooks.data.filter(
        (webhook) => webhook.status === "enabled"
      );

      if (activeWebhooks.length === 0) {
        return {
          success: false,
          message: "No active webhook endpoints found",
          error: "Webhook configuration missing",
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        message: "Webhook endpoints configured correctly",
        details: {
          totalWebhooks: webhooks.data.length,
          activeWebhooks: activeWebhooks.length,
          endpoints: activeWebhooks.map((wh) => ({
            id: wh.id,
            url: wh.url,
            events: wh.enabled_events,
          })),
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: "Webhook validation failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };
    }
  }

  async validatePaymentMethods(): Promise<ValidationResult> {
    try {
      // Test Mexican payment methods configuration
      const testSession = await stripe.checkout.sessions.create({
        payment_method_types: ["card", "oxxo"],
        line_items: [
          {
            price_data: {
              currency: "mxn",
              product_data: {
                name: "Test Consultation",
              },
              unit_amount: 100,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: "https://example.com/success",
        cancel_url: "https://example.com/cancel",
        metadata: {
          test: "integration_validation",
        },
      });

      // Expire the test session immediately
      await stripe.checkout.sessions.expire(testSession.id);

      return {
        success: true,
        message: "Mexican payment methods validation successful",
        details: {
          sessionId: testSession.id,
          paymentMethodTypes: testSession.payment_method_types,
          currency: testSession.currency,
          mode: testSession.mode,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: "Payment methods validation failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };
    }
  }
}

// Supabase Database Integration Validator
export class SupabaseValidator {
  private adminClient: any;
  private browserClient: any;

  constructor() {
    this.adminClient = createSupabaseAdminClient();
    this.browserClient = createSupabaseBrowserClient();
  }

  async validateDatabaseConnection(): Promise<ValidationResult> {
    try {
      // Test basic database connection
      const { data, error } = await this.adminClient
        .from("users")
        .select("count")
        .limit(1);

      if (error) {
        throw error;
      }

      return {
        success: true,
        message: "Database connection successful",
        details: {
          connectionType: "admin",
          queryExecuted: true,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: "Database connection failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };
    }
  }

  async validateRLSPolicies(): Promise<ValidationResult> {
    try {
      const policies = [];

      // Test RLS policies for critical tables
      const criticalTables = [
        "users",
        "appointments",
        "payments",
        "chat_rooms",
        "chat_messages",
        "video_sessions",
        "medical_files",
      ];

      for (const table of criticalTables) {
        try {
          // Query pg_policies to check RLS policies
          const { data: policyData, error: policyError } =
            await this.adminClient.rpc("get_table_policies", {
              table_name: table,
            });

          if (policyError) {
            policies.push({
              table,
              status: "error",
              error: policyError.message,
            });
          } else {
            policies.push({
              table,
              status: "success",
              policyCount: policyData?.length || 0,
            });
          }
        } catch (error) {
          policies.push({
            table,
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      const failedPolicies = policies.filter((p) => p.status === "error");

      return {
        success: failedPolicies.length === 0,
        message:
          failedPolicies.length === 0
            ? "RLS policies validation successful"
            : `RLS policies validation failed for ${failedPolicies.length} tables`,
        details: {
          policies,
          totalTables: criticalTables.length,
          successfulTables: policies.filter((p) => p.status === "success")
            .length,
          failedTables: failedPolicies.length,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: "RLS policies validation failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };
    }
  }

  async validateRealtimeSubscriptions(): Promise<ValidationResult> {
    try {
      // Test realtime subscription setup
      const testChannel = this.browserClient.channel("integration_test").on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
        },
        (payload: any) => {
          console.log("Test realtime event received:", payload);
        }
      );

      await testChannel.subscribe();

      // Wait a moment to ensure subscription is established
      await new Promise((resolve) => {
        setTimeout(resolve, 1000);
      });

      const channelState = testChannel.state;

      // Unsubscribe from test channel
      await testChannel.unsubscribe();

      return {
        success: channelState === "SUBSCRIBED",
        message:
          channelState === "SUBSCRIBED"
            ? "Realtime subscriptions working correctly"
            : "Realtime subscription failed to establish",
        details: {
          channelState,
          subscriptionEstablished: channelState === "SUBSCRIBED",
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: "Realtime subscriptions validation failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };
    }
  }

  async validateAuthenticationFlow(): Promise<ValidationResult> {
    try {
      // Test authentication configuration
      const { data: session, error } =
        await this.browserClient.auth.getSession();

      // Test if auth is properly configured (should not error even without session)
      if (error && error.message.includes("Invalid API key")) {
        throw new Error("Supabase authentication not properly configured");
      }

      return {
        success: true,
        message: "Authentication flow validation successful",
        details: {
          hasActiveSession: !!session?.session,
          authConfigured: true,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: "Authentication flow validation failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };
    }
  }
}

// WebSocket Connection Validator
export class WebSocketValidator {
  private socket: Socket | null = null;
  private connectionTimeout = 10000; // 10 seconds

  async validateWebSocketConnection(): Promise<ValidationResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let resolved = false;

      try {
        // Create socket connection
        this.socket = io(process.env.NEXTAUTH_URL || "http://localhost:3000", {
          path: "/api/socketio",
          timeout: this.connectionTimeout,
          forceNew: true,
        });

        // Set up timeout
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            this.cleanup();
            resolve({
              success: false,
              message: "WebSocket connection timeout",
              error: `Connection timeout after ${this.connectionTimeout}ms`,
              timestamp: new Date(),
            });
          }
        }, this.connectionTimeout);

        // Handle successful connection
        this.socket.on("connect", () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            const connectionTime = Date.now() - startTime;

            resolve({
              success: true,
              message: "WebSocket connection successful",
              details: {
                socketId: this.socket?.id,
                connectionTime,
                transport: this.socket?.io.engine.transport.name,
              },
              timestamp: new Date(),
            });

            this.cleanup();
          }
        });

        // Handle connection errors
        this.socket.on("connect_error", (error) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            this.cleanup();

            resolve({
              success: false,
              message: "WebSocket connection failed",
              error: error.message || "Connection error",
              timestamp: new Date(),
            });
          }
        });
      } catch (error) {
        if (!resolved) {
          resolved = true;
          resolve({
            success: false,
            message: "WebSocket validation failed",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: new Date(),
          });
        }
      }
    });
  }

  async validateChatFunctionality(): Promise<ValidationResult> {
    return new Promise((resolve) => {
      let resolved = false;
      const testRoomId = "test_room_" + Date.now();

      try {
        this.socket = io(process.env.NEXTAUTH_URL || "http://localhost:3000", {
          path: "/api/socketio",
          forceNew: true,
          auth: {
            token: "test_token", // This will fail auth but test the flow
          },
        });

        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            this.cleanup();
            resolve({
              success: false,
              message: "Chat functionality test timeout",
              timestamp: new Date(),
            });
          }
        }, 5000);

        // Test authentication error handling (expected to fail)
        this.socket.on("connect_error", (error) => {
          if (!resolved && error.message.includes("Authentication")) {
            resolved = true;
            clearTimeout(timeout);
            this.cleanup();

            resolve({
              success: true,
              message: "Chat authentication validation working correctly",
              details: {
                authenticationRequired: true,
                errorHandling: "working",
              },
              timestamp: new Date(),
            });
          }
        });
      } catch (error) {
        if (!resolved) {
          resolved = true;
          resolve({
            success: false,
            message: "Chat functionality validation failed",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: new Date(),
          });
        }
      }
    });
  }

  private cleanup(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

// WebRTC Session Validator
export class WebRTCValidator {
  async validateWebRTCSupport(): Promise<ValidationResult> {
    try {
      // Check if WebRTC APIs are available
      const hasGetUserMedia = !!(
        navigator.mediaDevices && navigator.mediaDevices.getUserMedia
      );
      const hasRTCPeerConnection = !!window.RTCPeerConnection;
      const hasRTCSessionDescription = !!window.RTCSessionDescription;
      const hasRTCIceCandidate = !!window.RTCIceCandidate;

      const webrtcSupported =
        hasGetUserMedia &&
        hasRTCPeerConnection &&
        hasRTCSessionDescription &&
        hasRTCIceCandidate;

      return {
        success: webrtcSupported,
        message: webrtcSupported
          ? "WebRTC support validation successful"
          : "WebRTC APIs not fully supported",
        details: {
          getUserMedia: hasGetUserMedia,
          RTCPeerConnection: hasRTCPeerConnection,
          RTCSessionDescription: hasRTCSessionDescription,
          RTCIceCandidate: hasRTCIceCandidate,
          userAgent: navigator.userAgent,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: "WebRTC support validation failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };
    }
  }

  async validateMediaDeviceAccess(): Promise<ValidationResult> {
    try {
      // Test media device enumeration
      const devices = await navigator.mediaDevices.enumerateDevices();

      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput"
      );
      const audioDevices = devices.filter(
        (device) => device.kind === "audioinput"
      );

      return {
        success: videoDevices.length > 0 && audioDevices.length > 0,
        message:
          videoDevices.length > 0 && audioDevices.length > 0
            ? "Media devices available"
            : "Insufficient media devices available",
        details: {
          totalDevices: devices.length,
          videoDevices: videoDevices.length,
          audioDevices: audioDevices.length,
          devices: devices.map((device) => ({
            kind: device.kind,
            label: device.label || "Unknown device",
            deviceId: device.deviceId ? "present" : "missing",
          })),
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: "Media device access validation failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };
    }
  }

  async validatePeerConnectionCreation(): Promise<ValidationResult> {
    try {
      // Test RTCPeerConnection creation and configuration
      const configuration: RTCConfiguration = {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      };

      const peerConnection = new RTCPeerConnection(configuration);

      // Test basic peer connection functionality
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await peerConnection.setLocalDescription(offer);

      const connectionState = peerConnection.connectionState;
      const iceConnectionState = peerConnection.iceConnectionState;
      const signalingState = peerConnection.signalingState;

      // Clean up
      peerConnection.close();

      return {
        success: true,
        message: "Peer connection creation successful",
        details: {
          offerCreated: !!offer,
          localDescriptionSet: true,
          connectionState,
          iceConnectionState,
          signalingState,
          iceServers: configuration.iceServers?.length || 0,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: "Peer connection creation failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };
    }
  }

  async validateVideoSessionDatabase(): Promise<ValidationResult> {
    try {
      // Test video session database operations
      const testSessionId = "test_session_" + Date.now();

      // This would normally require a valid user and chat room
      // For validation, we'll just test the database connection
      const { data, error } = await createSupabaseAdminClient()
        .from("video_sessions")
        .select("count")
        .limit(1);

      if (error) {
        throw error;
      }

      return {
        success: true,
        message: "Video session database validation successful",
        details: {
          databaseAccessible: true,
          tableExists: true,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: "Video session database validation failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };
    }
  }
}

// Main Integration Validation Suite
export class IntegrationValidationSuite {
  private stripeValidator: StripeValidator;
  private supabaseValidator: SupabaseValidator;
  private websocketValidator: WebSocketValidator;
  private webrtcValidator: WebRTCValidator;

  constructor() {
    this.stripeValidator = new StripeValidator();
    this.supabaseValidator = new SupabaseValidator();
    this.websocketValidator = new WebSocketValidator();
    this.webrtcValidator = new WebRTCValidator();
  }

  async runFullValidation(): Promise<IntegrationValidationReport> {
    console.log("Starting integration validation suite...");

    // Run all validations in parallel where possible
    const [stripeResults, supabaseResults, websocketResults, webrtcResults] =
      await Promise.all([
        this.validateStripeIntegration(),
        this.validateSupabaseIntegration(),
        this.validateWebSocketIntegration(),
        this.validateWebRTCIntegration(),
      ]);

    // Calculate overall results
    const allResults = [
      stripeResults,
      supabaseResults,
      websocketResults,
      webrtcResults,
    ];
    const passedTests = allResults.filter((result) => result.success).length;
    const totalTests = allResults.length;

    const criticalFailures = [];
    if (!stripeResults.success)
      criticalFailures.push("Stripe payment integration");
    if (!supabaseResults.success)
      criticalFailures.push("Supabase database integration");
    if (!websocketResults.success)
      criticalFailures.push("WebSocket real-time features");
    if (!webrtcResults.success)
      criticalFailures.push("WebRTC video call functionality");

    return {
      stripe: stripeResults,
      supabase: supabaseResults,
      websocket: websocketResults,
      webrtc: webrtcResults,
      overall: {
        success: passedTests === totalTests,
        passedTests,
        totalTests,
        criticalFailures,
      },
    };
  }

  private async validateStripeIntegration(): Promise<ValidationResult> {
    try {
      const [connection, paymentIntent, webhook, paymentMethods] =
        await Promise.all([
          this.stripeValidator.validateStripeConnection(),
          this.stripeValidator.validatePaymentIntentCreation(),
          this.stripeValidator.validateWebhookEndpoint(),
          this.stripeValidator.validatePaymentMethods(),
        ]);

      const allPassed = [
        connection,
        paymentIntent,
        webhook,
        paymentMethods,
      ].every((result) => result.success);

      return {
        success: allPassed,
        message: allPassed
          ? "All Stripe integration tests passed"
          : "Some Stripe integration tests failed",
        details: {
          connection,
          paymentIntent,
          webhook,
          paymentMethods,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: "Stripe integration validation failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };
    }
  }

  private async validateSupabaseIntegration(): Promise<ValidationResult> {
    try {
      const [database, rls, realtime, auth] = await Promise.all([
        this.supabaseValidator.validateDatabaseConnection(),
        this.supabaseValidator.validateRLSPolicies(),
        this.supabaseValidator.validateRealtimeSubscriptions(),
        this.supabaseValidator.validateAuthenticationFlow(),
      ]);

      const allPassed = [database, rls, realtime, auth].every(
        (result) => result.success
      );

      return {
        success: allPassed,
        message: allPassed
          ? "All Supabase integration tests passed"
          : "Some Supabase integration tests failed",
        details: {
          database,
          rls,
          realtime,
          auth,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: "Supabase integration validation failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };
    }
  }

  private async validateWebSocketIntegration(): Promise<ValidationResult> {
    try {
      const [connection, chat] = await Promise.all([
        this.websocketValidator.validateWebSocketConnection(),
        this.websocketValidator.validateChatFunctionality(),
      ]);

      const allPassed = [connection, chat].every((result) => result.success);

      return {
        success: allPassed,
        message: allPassed
          ? "All WebSocket integration tests passed"
          : "Some WebSocket integration tests failed",
        details: {
          connection,
          chat,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: "WebSocket integration validation failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };
    }
  }

  private async validateWebRTCIntegration(): Promise<ValidationResult> {
    try {
      const [support, mediaDevices, peerConnection, database] =
        await Promise.all([
          this.webrtcValidator.validateWebRTCSupport(),
          this.webrtcValidator.validateMediaDeviceAccess(),
          this.webrtcValidator.validatePeerConnectionCreation(),
          this.webrtcValidator.validateVideoSessionDatabase(),
        ]);

      const allPassed = [support, mediaDevices, peerConnection, database].every(
        (result) => result.success
      );

      return {
        success: allPassed,
        message: allPassed
          ? "All WebRTC integration tests passed"
          : "Some WebRTC integration tests failed",
        details: {
          support,
          mediaDevices,
          peerConnection,
          database,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        message: "WebRTC integration validation failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };
    }
  }

  // Utility method to generate a detailed report
  generateDetailedReport(report: IntegrationValidationReport): string {
    const lines = [];
    lines.push("=".repeat(60));
    lines.push("INTEGRATION VALIDATION REPORT");
    lines.push("=".repeat(60));
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Overall Status: ${report.overall.success ? "PASS" : "FAIL"}`);
    lines.push(
      `Tests Passed: ${report.overall.passedTests}/${report.overall.totalTests}`
    );
    lines.push("");

    if (report.overall.criticalFailures.length > 0) {
      lines.push("CRITICAL FAILURES:");
      report.overall.criticalFailures.forEach((failure) => {
        lines.push(`  - ${failure}`);
      });
      lines.push("");
    }

    // Stripe Results
    lines.push("STRIPE PAYMENT INTEGRATION:");
    lines.push(`  Status: ${report.stripe.success ? "PASS" : "FAIL"}`);
    lines.push(`  Message: ${report.stripe.message}`);
    if (report.stripe.error) {
      lines.push(`  Error: ${report.stripe.error}`);
    }
    lines.push("");

    // Supabase Results
    lines.push("SUPABASE DATABASE INTEGRATION:");
    lines.push(`  Status: ${report.supabase.success ? "PASS" : "FAIL"}`);
    lines.push(`  Message: ${report.supabase.message}`);
    if (report.supabase.error) {
      lines.push(`  Error: ${report.supabase.error}`);
    }
    lines.push("");

    // WebSocket Results
    lines.push("WEBSOCKET REAL-TIME FEATURES:");
    lines.push(`  Status: ${report.websocket.success ? "PASS" : "FAIL"}`);
    lines.push(`  Message: ${report.websocket.message}`);
    if (report.websocket.error) {
      lines.push(`  Error: ${report.websocket.error}`);
    }
    lines.push("");

    // WebRTC Results
    lines.push("WEBRTC VIDEO CALL FUNCTIONALITY:");
    lines.push(`  Status: ${report.webrtc.success ? "PASS" : "FAIL"}`);
    lines.push(`  Message: ${report.webrtc.message}`);
    if (report.webrtc.error) {
      lines.push(`  Error: ${report.webrtc.error}`);
    }
    lines.push("");

    lines.push("=".repeat(60));

    return lines.join("\n");
  }
}

// Export singleton instance
export const integrationValidator = new IntegrationValidationSuite();
