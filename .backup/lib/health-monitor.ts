"use client";

import { useCallback, useEffect, useState } from "react";
import { chatService } from "./chat-service";
import { dbOptimizer } from "./db-optimization";
import { performanceMonitor } from "./performance-monitor";
import { createSupabaseBrowserClient } from "./supabase";

interface HealthCheck {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  latency: number;
  error?: string;
  timestamp: number;
}

interface SystemHealth {
  overall: "healthy" | "degraded" | "unhealthy";
  checks: HealthCheck[];
  uptime: number;
  lastCheck: number;
}

interface HealthMonitorConfig {
  checkInterval: number;
  timeout: number;
  retries: number;
  alertThresholds: {
    latency: number;
    errorRate: number;
    consecutiveFailures: number;
  };
}

class HealthMonitor {
  private config: HealthMonitorConfig;
  private supabase = createSupabaseBrowserClient();
  private healthHistory: Map<string, HealthCheck[]> = new Map();
  private alertCallbacks: Array<(health: SystemHealth) => void> = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private startTime = Date.now();
  private consecutiveFailures: Map<string, number> = new Map();

  constructor(config: Partial<HealthMonitorConfig> = {}) {
    this.config = {
      checkInterval: config.checkInterval || 30000, // 30 seconds
      timeout: config.timeout || 10000, // 10 seconds
      retries: config.retries || 3,
      alertThresholds: {
        latency: config.alertThresholds?.latency || 2000, // 2 seconds
        errorRate: config.alertThresholds?.errorRate || 0.05, // 5%
        consecutiveFailures: config.alertThresholds?.consecutiveFailures || 3,
        ...config.alertThresholds,
      },
    };

    this.startMonitoring();
  }

  // Start health monitoring
  startMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.checkInterval);

    // Perform initial check
    this.performHealthCheck();
  }

  // Stop health monitoring
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  // Perform comprehensive health check
  async performHealthCheck(): Promise<SystemHealth> {
    const checks: HealthCheck[] = [];
    const timestamp = Date.now();

    // Database connectivity check
    checks.push(await this.checkDatabase());

    // Supabase Realtime check
    checks.push(await this.checkRealtimeConnection());

    // Chat service check
    checks.push(await this.checkChatService());

    // Storage service check
    checks.push(await this.checkStorageService());

    // Performance metrics check
    checks.push(await this.checkPerformanceMetrics());

    // Cache health check
    checks.push(await this.checkCacheHealth());

    // Determine overall health
    const overall = this.determineOverallHealth(checks);

    const systemHealth: SystemHealth = {
      overall,
      checks,
      uptime: timestamp - this.startTime,
      lastCheck: timestamp,
    };

    // Store health history
    this.storeHealthHistory(checks);

    // Check for alerts
    this.checkAlerts(systemHealth);

    // Record metrics
    this.recordHealthMetrics(systemHealth);

    return systemHealth;
  }

  // Check database connectivity
  private async checkDatabase(): Promise<HealthCheck> {
    const startTime = performance.now();

    try {
      const { error } = await Promise.race([
        this.supabase.from("users").select("id").limit(1),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error("Database timeout")),
            this.config.timeout
          );
        }),
      ]);

      const latency = performance.now() - startTime;

      if (error) {
        throw error;
      }

      return {
        name: "database",
        status:
          latency > this.config.alertThresholds.latency
            ? "degraded"
            : "healthy",
        latency,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        name: "database",
        status: "unhealthy",
        latency: performance.now() - startTime,
        error: error instanceof Error ? error.message : "Database check failed",
        timestamp: Date.now(),
      };
    }
  }

  // Check Supabase Realtime connection
  private async checkRealtimeConnection(): Promise<HealthCheck> {
    const startTime = performance.now();

    try {
      // Test realtime connection by creating a temporary channel
      const testChannel = this.supabase.channel("health-check");

      const connectionPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Realtime connection timeout"));
        }, this.config.timeout);

        testChannel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            clearTimeout(timeout);
            resolve();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            clearTimeout(timeout);
            reject(new Error(`Realtime connection failed: ${status}`));
          }
        });
      });

      await connectionPromise;

      // Clean up test channel
      this.supabase.removeChannel(testChannel);

      const latency = performance.now() - startTime;

      return {
        name: "realtime",
        status:
          latency > this.config.alertThresholds.latency
            ? "degraded"
            : "healthy",
        latency,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        name: "realtime",
        status: "unhealthy",
        latency: performance.now() - startTime,
        error: error instanceof Error ? error.message : "Realtime check failed",
        timestamp: Date.now(),
      };
    }
  }

  // Check chat service health
  private async checkChatService(): Promise<HealthCheck> {
    const startTime = performance.now();

    try {
      const connectionStatus = chatService.getConnectionStatus();
      const latency = performance.now() - startTime;

      let status: "healthy" | "degraded" | "unhealthy" = "healthy";
      let error: string | undefined;

      if (!connectionStatus.isConnected) {
        status = "unhealthy";
        error = "Chat service not connected";
      } else if (connectionStatus.reconnectAttempts > 0) {
        status = "degraded";
        error = `Recent reconnection attempts: ${connectionStatus.reconnectAttempts}`;
      }

      return {
        name: "chat_service",
        status,
        latency,
        error,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        name: "chat_service",
        status: "unhealthy",
        latency: performance.now() - startTime,
        error:
          error instanceof Error ? error.message : "Chat service check failed",
        timestamp: Date.now(),
      };
    }
  }

  // Check storage service
  private async checkStorageService(): Promise<HealthCheck> {
    const startTime = performance.now();

    try {
      // Test storage by listing buckets
      const { error } = await Promise.race([
        this.supabase.storage.listBuckets(),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error("Storage timeout")),
            this.config.timeout
          );
        }),
      ]);

      const latency = performance.now() - startTime;

      if (error) {
        throw error;
      }

      return {
        name: "storage",
        status:
          latency > this.config.alertThresholds.latency
            ? "degraded"
            : "healthy",
        latency,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        name: "storage",
        status: "unhealthy",
        latency: performance.now() - startTime,
        error: error instanceof Error ? error.message : "Storage check failed",
        timestamp: Date.now(),
      };
    }
  }

  // Check performance metrics
  private async checkPerformanceMetrics(): Promise<HealthCheck> {
    const startTime = performance.now();

    try {
      const systemHealth = performanceMonitor.getSystemHealth();
      const latency = performance.now() - startTime;

      let status: "healthy" | "degraded" | "unhealthy" = "healthy";
      let error: string | undefined;

      // Check memory usage
      if (systemHealth.memory > 90) {
        status = "unhealthy";
        error = `High memory usage: ${systemHealth.memory.toFixed(1)}%`;
      } else if (systemHealth.memory > 80) {
        status = "degraded";
        error = `Elevated memory usage: ${systemHealth.memory.toFixed(1)}%`;
      }

      // Check error rate
      const errorRate =
        performanceMonitor.getLatestMetric("system.error_rate")?.value || 0;
      if (errorRate > this.config.alertThresholds.errorRate) {
        status = "unhealthy";
        error = `High error rate: ${(errorRate * 100).toFixed(2)}%`;
      }

      return {
        name: "performance",
        status,
        latency,
        error,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        name: "performance",
        status: "unhealthy",
        latency: performance.now() - startTime,
        error:
          error instanceof Error ? error.message : "Performance check failed",
        timestamp: Date.now(),
      };
    }
  }

  // Check cache health
  private async checkCacheHealth(): Promise<HealthCheck> {
    const startTime = performance.now();

    try {
      const dbStats = dbOptimizer.getStats();
      const latency = performance.now() - startTime;

      let status: "healthy" | "degraded" | "unhealthy" = "healthy";
      let error: string | undefined;

      // Check cache hit rate
      if (dbStats.hitRate < 0.5) {
        status = "unhealthy";
        error = `Low cache hit rate: ${(dbStats.hitRate * 100).toFixed(1)}%`;
      } else if (dbStats.hitRate < 0.7) {
        status = "degraded";
        error = `Suboptimal cache hit rate: ${(dbStats.hitRate * 100).toFixed(
          1
        )}%`;
      }

      return {
        name: "cache",
        status,
        latency,
        error,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        name: "cache",
        status: "unhealthy",
        latency: performance.now() - startTime,
        error: error instanceof Error ? error.message : "Cache check failed",
        timestamp: Date.now(),
      };
    }
  }

  // Determine overall system health
  private determineOverallHealth(
    checks: HealthCheck[]
  ): "healthy" | "degraded" | "unhealthy" {
    const unhealthyCount = checks.filter(
      (c) => c.status === "unhealthy"
    ).length;
    const degradedCount = checks.filter((c) => c.status === "degraded").length;

    if (unhealthyCount > 0) {
      return "unhealthy";
    } else if (degradedCount > 0) {
      return "degraded";
    } else {
      return "healthy";
    }
  }

  // Store health history
  private storeHealthHistory(checks: HealthCheck[]): void {
    checks.forEach((check) => {
      if (!this.healthHistory.has(check.name)) {
        this.healthHistory.set(check.name, []);
      }

      const history = this.healthHistory.get(check.name)!;
      history.push(check);

      // Keep only last 100 checks per service
      if (history.length > 100) {
        history.splice(0, history.length - 100);
      }
    });
  }

  // Check for alerts
  private checkAlerts(systemHealth: SystemHealth): void {
    systemHealth.checks.forEach((check) => {
      const failures = this.consecutiveFailures.get(check.name) || 0;

      if (check.status === "unhealthy") {
        this.consecutiveFailures.set(check.name, failures + 1);

        if (failures + 1 >= this.config.alertThresholds.consecutiveFailures) {
          this.triggerAlert(check);
        }
      } else {
        this.consecutiveFailures.set(check.name, 0);
      }
    });

    // Trigger overall system alert if needed
    if (systemHealth.overall === "unhealthy") {
      this.alertCallbacks.forEach((callback) => callback(systemHealth));
    }
  }

  // Trigger alert for specific check
  private triggerAlert(check: HealthCheck): void {
    console.error(
      `Health check alert: ${check.name} is ${check.status}`,
      check.error
    );

    // Record alert metric
    performanceMonitor.incrementCounter("health.alert", {
      service: check.name,
      status: check.status,
    });
  }

  // Record health metrics
  private recordHealthMetrics(systemHealth: SystemHealth): void {
    // Record overall health
    performanceMonitor.recordGauge(
      "health.overall",
      systemHealth.overall === "healthy"
        ? 1
        : systemHealth.overall === "degraded"
        ? 0.5
        : 0
    );

    // Record individual check metrics
    systemHealth.checks.forEach((check) => {
      performanceMonitor.recordGauge(
        `health.${check.name}`,
        check.status === "healthy" ? 1 : check.status === "degraded" ? 0.5 : 0
      );

      performanceMonitor.recordGauge(
        `health.${check.name}.latency`,
        check.latency
      );
    });

    // Record uptime
    performanceMonitor.recordGauge("health.uptime", systemHealth.uptime);
  }

  // Add alert callback
  onAlert(callback: (health: SystemHealth) => void): void {
    this.alertCallbacks.push(callback);
  }

  // Remove alert callback
  removeAlert(callback: (health: SystemHealth) => void): void {
    const index = this.alertCallbacks.indexOf(callback);
    if (index > -1) {
      this.alertCallbacks.splice(index, 1);
    }
  }

  // Get health history for a service
  getHealthHistory(serviceName: string, limit?: number): HealthCheck[] {
    const history = this.healthHistory.get(serviceName) || [];
    return limit ? history.slice(-limit) : history;
  }

  // Get current system health
  async getCurrentHealth(): Promise<SystemHealth> {
    return this.performHealthCheck();
  }

  // Get health summary
  getHealthSummary(): {
    services: string[];
    healthy: number;
    degraded: number;
    unhealthy: number;
    uptime: number;
  } {
    const services = Array.from(this.healthHistory.keys());
    const latestChecks = services
      .map((service) => {
        const history = this.healthHistory.get(service) || [];
        return history[history.length - 1];
      })
      .filter(Boolean);

    return {
      services,
      healthy: latestChecks.filter((c) => c.status === "healthy").length,
      degraded: latestChecks.filter((c) => c.status === "degraded").length,
      unhealthy: latestChecks.filter((c) => c.status === "unhealthy").length,
      uptime: Date.now() - this.startTime,
    };
  }

  // Destroy health monitor
  destroy(): void {
    this.stopMonitoring();
    this.healthHistory.clear();
    this.alertCallbacks = [];
    this.consecutiveFailures.clear();
  }
}

// Global health monitor instance
export const healthMonitor = new HealthMonitor();

// React hook for health monitoring
export function useHealthMonitor() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const updateHealth = async () => {
      try {
        const currentHealth = await healthMonitor.getCurrentHealth();
        if (mounted) {
          setHealth(currentHealth);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Failed to get health status:", error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    // Initial load
    updateHealth();

    // Set up periodic updates
    const interval = setInterval(updateHealth, 30000); // Update every 30 seconds

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const refreshHealth = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentHealth = await healthMonitor.getCurrentHealth();
      setHealth(currentHealth);
    } catch (error) {
      console.error("Failed to refresh health status:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    health,
    isLoading,
    refreshHealth,
    summary: healthMonitor.getHealthSummary(),
  };
}
