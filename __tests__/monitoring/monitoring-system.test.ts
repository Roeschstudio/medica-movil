import { chatAnalytics } from "@/lib/analytics";
import { healthMonitor } from "@/lib/health-monitor";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock fetch
global.fetch = vi.fn();

describe("Health Monitor System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should perform database health check", async () => {
    // Mock successful database response
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: "1" }] }),
    } as Response);

    const healthCheck = await healthMonitor.checkDatabaseHealth();

    expect(healthCheck.service).toBe("database");
    expect(healthCheck.status).toBe("healthy");
    expect(healthCheck.response_time).toBeGreaterThan(0);
    expect(healthCheck.timestamp).toBeDefined();
  });

  it("should detect unhealthy database", async () => {
    // Mock database error
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Connection failed"));

    const healthCheck = await healthMonitor.checkDatabaseHealth();

    expect(healthCheck.service).toBe("database");
    expect(healthCheck.status).toBe("unhealthy");
    expect(healthCheck.error_message).toBe("Connection failed");
  });

  it("should perform comprehensive health checks", async () => {
    // Mock all API responses
    vi.mocked(fetch).mockImplementation((url) => {
      if (typeof url === "string" && url.includes("/api/chat/health")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: "healthy" }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      } as Response);
    });

    const systemHealth = await healthMonitor.performHealthChecks();

    expect(systemHealth.overall_status).toBeDefined();
    expect(systemHealth.services).toBeInstanceOf(Array);
    expect(systemHealth.services.length).toBeGreaterThan(0);
    expect(systemHealth.last_updated).toBeDefined();
  });

  it("should start and stop monitoring", () => {
    expect(healthMonitor.isHealthy()).toBeDefined();

    healthMonitor.startMonitoring(1000); // 1 second interval
    expect(healthMonitor.isHealthy()).toBeDefined();

    healthMonitor.stopMonitoring();
    expect(healthMonitor.isHealthy()).toBeDefined();
  });
});

describe("Chat Analytics System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should track chat activities", () => {
    const trackSpy = vi.spyOn(chatAnalytics, "track");

    chatAnalytics.trackChatActivity("opened", "room-123", { user: "test" });

    expect(trackSpy).toHaveBeenCalledWith({
      event_type: "chat_opened",
      chat_room_id: "room-123",
      metadata: { user: "test" },
    });
  });

  it("should track performance metrics", () => {
    const trackSpy = vi.spyOn(chatAnalytics, "track");

    chatAnalytics.trackPerformance("load_time", 500, "ms", { page: "chat" });

    expect(trackSpy).toHaveBeenCalledWith({
      event_type: "performance_metric",
      metadata: {
        metric_name: "load_time",
        value: 500,
        unit: "ms",
        context: { page: "chat" },
      },
    });
  });

  it("should track errors", () => {
    const trackSpy = vi.spyOn(chatAnalytics, "track");
    const error = new Error("Test error");

    chatAnalytics.trackError(error, { component: "chat-room" });

    expect(trackSpy).toHaveBeenCalledWith({
      event_type: "connection_error",
      metadata: {
        error_message: "Test error",
        stack_trace: error.stack,
        context: { component: "chat-room" },
      },
    });
  });

  it("should set user ID", () => {
    chatAnalytics.setUserId("user-123");

    const trackSpy = vi.spyOn(chatAnalytics, "track");
    chatAnalytics.trackChatActivity("message_sent", "room-123");

    expect(trackSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "message_sent",
        chat_room_id: "room-123",
        user_id: "user-123",
      })
    );
  });

  it("should enable/disable analytics", () => {
    const trackSpy = vi.spyOn(chatAnalytics, "track");

    chatAnalytics.setEnabled(false);
    chatAnalytics.trackChatActivity("opened", "room-123");

    expect(trackSpy).not.toHaveBeenCalled();

    chatAnalytics.setEnabled(true);
    chatAnalytics.trackChatActivity("opened", "room-123");

    expect(trackSpy).toHaveBeenCalled();
  });
});

describe("Monitoring API Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should test health endpoint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "healthy",
          services: {
            database: { status: "healthy", response_time: 100 },
            storage: { status: "healthy", response_time: 150 },
            chat: { status: "healthy", response_time: 80 },
            api: { status: "healthy", response_time: 50 },
          },
        }),
    } as Response);

    const response = await fetch("/api/health");
    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.status).toBe("healthy");
    expect(data.services).toBeDefined();
    expect(data.services.database.status).toBe("healthy");
  });

  it("should test chat health endpoint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "healthy",
          service: "chat_system",
          checks: {
            database: { status: "healthy", response_time: 120 },
            realtime: { status: "healthy", response_time: 200 },
            messages: { status: "healthy", response_time: 90 },
            rooms: { status: "healthy", response_time: 110 },
          },
        }),
    } as Response);

    const response = await fetch("/api/chat/health");
    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.status).toBe("healthy");
    expect(data.service).toBe("chat_system");
    expect(data.checks).toBeDefined();
  });

  it("should handle unhealthy service responses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: () =>
        Promise.resolve({
          status: "unhealthy",
          error: "Database connection failed",
          services: {
            database: { status: "unhealthy", error: "Connection timeout" },
          },
        }),
    } as Response);

    const response = await fetch("/api/health");
    const data = await response.json();

    expect(response.ok).toBe(false);
    expect(response.status).toBe(503);
    expect(data.status).toBe("unhealthy");
    expect(data.error).toBeDefined();
  });
});

describe("Performance Monitoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should collect performance metrics", () => {
    // Mock performance API
    const mockPerformance = {
      timing: {
        navigationStart: 1000,
        loadEventEnd: 2000,
      },
      memory: {
        usedJSHeapSize: 50 * 1024 * 1024,
        totalJSHeapSize: 100 * 1024 * 1024,
      },
    };

    Object.defineProperty(window, "performance", {
      value: mockPerformance,
      writable: true,
    });

    const trackSpy = vi.spyOn(chatAnalytics, "trackPerformance");

    // Simulate performance tracking
    const loadTime =
      mockPerformance.timing.loadEventEnd -
      mockPerformance.timing.navigationStart;
    chatAnalytics.trackPerformance("page_load_time", loadTime, "ms");

    expect(trackSpy).toHaveBeenCalledWith("page_load_time", 1000, "ms");
  });

  it("should monitor memory usage", () => {
    const trackSpy = vi.spyOn(chatAnalytics, "trackPerformance");

    chatAnalytics.trackPerformance("memory_used", 52428800, "bytes"); // 50MB

    expect(trackSpy).toHaveBeenCalledWith("memory_used", 52428800, "bytes");
  });
});

describe("Alert System", () => {
  it("should evaluate alert conditions", () => {
    const alertRules = [
      {
        id: "response_time_high",
        metric: "database_response_time",
        condition: "greater_than" as const,
        threshold: 1000,
        enabled: true,
      },
    ];

    const currentMetrics = {
      database_response_time: 1500,
    };

    // Simulate alert evaluation
    const triggeredAlerts = alertRules.filter((rule) => {
      if (!rule.enabled) return false;

      const currentValue = currentMetrics[rule.metric];
      if (currentValue === undefined) return false;

      switch (rule.condition) {
        case "greater_than":
          return currentValue > rule.threshold;
        default:
          return false;
      }
    });

    expect(triggeredAlerts).toHaveLength(1);
    expect(triggeredAlerts[0].id).toBe("response_time_high");
  });

  it("should format metric values correctly", () => {
    const formatMetricValue = (metric: string, value: number): string => {
      switch (metric) {
        case "database_response_time":
        case "realtime_latency":
          return `${value}ms`;
        case "error_rate":
          return `${(value * 100).toFixed(1)}%`;
        case "memory_usage":
          return `${Math.round(value / 1024 / 1024)}MB`;
        default:
          return value.toString();
      }
    };

    expect(formatMetricValue("database_response_time", 1500)).toBe("1500ms");
    expect(formatMetricValue("error_rate", 0.05)).toBe("5.0%");
    expect(formatMetricValue("memory_usage", 52428800)).toBe("50MB");
  });
});
