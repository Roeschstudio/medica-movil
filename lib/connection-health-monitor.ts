import { prisma } from "./db";
import { ErrorLogger } from "./error-handling-utils";
import { createSupabaseAdminClient } from "./supabase";

// Health check interfaces
export interface HealthCheckResult {
  service: string;
  status: "healthy" | "degraded" | "unhealthy";
  responseTime: number;
  error?: string;
  details?: Record<string, any>;
}

export interface SystemHealthReport {
  timestamp: Date;
  overall: "healthy" | "degraded" | "unhealthy";
  services: HealthCheckResult[];
  uptime: number;
}

// Connection pool monitoring
export interface ConnectionPoolStats {
  active: number;
  idle: number;
  total: number;
  waiting: number;
  maxConnections: number;
}

/**
 * Connection Health Monitor
 * Monitors database connections, Supabase, and other external services
 */
export class ConnectionHealthMonitor {
  private static instance: ConnectionHealthMonitor;
  private healthChecks: Map<string, () => Promise<HealthCheckResult>> =
    new Map();
  private lastHealthCheck: SystemHealthReport | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private startTime = Date.now();

  private constructor() {
    this.registerDefaultHealthChecks();
  }

  static getInstance(): ConnectionHealthMonitor {
    if (!ConnectionHealthMonitor.instance) {
      ConnectionHealthMonitor.instance = new ConnectionHealthMonitor();
    }
    return ConnectionHealthMonitor.instance;
  }

  /**
   * Register default health checks
   */
  private registerDefaultHealthChecks() {
    this.registerHealthCheck("database", this.checkDatabaseHealth.bind(this));
    this.registerHealthCheck("supabase", this.checkSupabaseHealth.bind(this));
    this.registerHealthCheck("redis", this.checkRedisHealth.bind(this));
    this.registerHealthCheck(
      "external_apis",
      this.checkExternalAPIsHealth.bind(this)
    );
  }

  /**
   * Register a custom health check
   */
  registerHealthCheck(
    serviceName: string,
    healthCheckFn: () => Promise<HealthCheckResult>
  ) {
    this.healthChecks.set(serviceName, healthCheckFn);
  }

  /**
   * Start continuous health monitoring
   */
  startMonitoring(intervalMs: number = 30000) {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        const report = await this.getSystemHealth();
        this.lastHealthCheck = report;

        // Log unhealthy services
        const unhealthyServices = report.services.filter(
          (s) => s.status === "unhealthy"
        );

        if (unhealthyServices.length > 0) {
          ErrorLogger.log(new Error("Unhealthy services detected"), {
            unhealthyServices: unhealthyServices.map((s) => ({
              service: s.service,
              error: s.error,
            })),
          });
        }
      } catch (error) {
        ErrorLogger.log(error as Error, { context: "health_monitoring" });
      }
    }, intervalMs);

    console.log(`Health monitoring started with ${intervalMs}ms interval`);
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Get current system health
   */
  async getSystemHealth(): Promise<SystemHealthReport> {
    const services: HealthCheckResult[] = [];

    // Run all health checks in parallel
    const healthCheckPromises = Array.from(this.healthChecks.entries()).map(
      async ([serviceName, healthCheckFn]) => {
        try {
          return await this.executeHealthCheckWithTimeout(
            serviceName,
            healthCheckFn,
            5000 // 5 second timeout
          );
        } catch (error) {
          return {
            service: serviceName,
            status: "unhealthy" as const,
            responseTime: 5000,
            error: (error as Error).message,
          };
        }
      }
    );

    const results = await Promise.allSettled(healthCheckPromises);

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        services.push(result.value);
      } else {
        services.push({
          service: "unknown",
          status: "unhealthy",
          responseTime: 0,
          error: result.reason?.message || "Health check failed",
        });
      }
    });

    // Determine overall health
    const unhealthyCount = services.filter(
      (s) => s.status === "unhealthy"
    ).length;
    const degradedCount = services.filter(
      (s) => s.status === "degraded"
    ).length;

    let overall: "healthy" | "degraded" | "unhealthy";
    if (unhealthyCount > 0) {
      overall = "unhealthy";
    } else if (degradedCount > 0) {
      overall = "degraded";
    } else {
      overall = "healthy";
    }

    return {
      timestamp: new Date(),
      overall,
      services,
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Execute health check with timeout
   */
  private async executeHealthCheckWithTimeout(
    serviceName: string,
    healthCheckFn: () => Promise<HealthCheckResult>,
    timeoutMs: number
  ): Promise<HealthCheckResult> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Health check timeout")), timeoutMs);
    });

    return Promise.race([healthCheckFn(), timeoutPromise]);
  }

  /**
   * Check database health (Prisma)
   */
  private async checkDatabaseHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Test basic connectivity
      await prisma.$queryRaw`SELECT 1`;

      // Get connection pool stats if available
      const poolStats = await this.getDatabasePoolStats();

      const responseTime = Date.now() - startTime;

      // Determine status based on response time and pool usage
      let status: "healthy" | "degraded" | "unhealthy" = "healthy";

      if (responseTime > 2000) {
        status = "degraded";
      }

      if (poolStats && poolStats.active / poolStats.maxConnections > 0.8) {
        status = "degraded";
      }

      return {
        service: "database",
        status,
        responseTime,
        details: {
          poolStats,
          connectionString: process.env.DATABASE_URL ? "configured" : "missing",
        },
      };
    } catch (error) {
      return {
        service: "database",
        status: "unhealthy",
        responseTime: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Check Supabase health
   */
  private async checkSupabaseHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const supabase = createSupabaseAdminClient();

      // Test auth service
      const { error: authError } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1,
      });

      if (authError) {
        throw new Error(`Supabase auth error: ${authError.message}`);
      }

      // Test database connection
      const { error: dbError } = await supabase
        .from("users")
        .select("id")
        .limit(1);

      if (dbError) {
        throw new Error(`Supabase database error: ${dbError.message}`);
      }

      const responseTime = Date.now() - startTime;

      return {
        service: "supabase",
        status: responseTime > 2000 ? "degraded" : "healthy",
        responseTime,
        details: {
          url: process.env.NEXT_PUBLIC_SUPABASE_URL ? "configured" : "missing",
          serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY
            ? "configured"
            : "missing",
        },
      };
    } catch (error) {
      return {
        service: "supabase",
        status: "unhealthy",
        responseTime: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Check Redis health (if configured)
   */
  private async checkRedisHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    // Skip if Redis is not configured
    if (!process.env.REDIS_URL) {
      return {
        service: "redis",
        status: "healthy",
        responseTime: 0,
        details: { configured: false },
      };
    }

    try {
      // If you have Redis configured, add the actual health check here
      // For now, we'll just return a placeholder
      return {
        service: "redis",
        status: "healthy",
        responseTime: Date.now() - startTime,
        details: { configured: true, placeholder: true },
      };
    } catch (error) {
      return {
        service: "redis",
        status: "unhealthy",
        responseTime: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Check external APIs health
   */
  private async checkExternalAPIsHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const results: Record<string, boolean> = {};

    try {
      // Check Stripe API
      if (process.env.STRIPE_SECRET_KEY) {
        try {
          const response = await fetch("https://api.stripe.com/v1/account", {
            headers: {
              Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
            },
          });
          results.stripe = response.ok;
        } catch {
          results.stripe = false;
        }
      }

      // Check other external services as needed
      // Add more external service checks here

      const responseTime = Date.now() - startTime;
      const failedServices = Object.entries(results).filter(
        ([_, success]) => !success
      );

      let status: "healthy" | "degraded" | "unhealthy" = "healthy";
      if (failedServices.length > 0) {
        status =
          failedServices.length === Object.keys(results).length
            ? "unhealthy"
            : "degraded";
      }

      return {
        service: "external_apis",
        status,
        responseTime,
        details: {
          services: results,
          failedServices: failedServices.map(([name]) => name),
        },
      };
    } catch (error) {
      return {
        service: "external_apis",
        status: "unhealthy",
        responseTime: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Get database connection pool statistics
   */
  private async getDatabasePoolStats(): Promise<ConnectionPoolStats | null> {
    try {
      // This is a simplified version - actual implementation depends on your database setup
      // For Prisma with PostgreSQL, you might query pg_stat_activity
      const result = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*) as count FROM pg_stat_activity WHERE state = 'active'
      `;

      return {
        active: Number(result[0]?.count || 0),
        idle: 0, // Would need additional queries to get this
        total: 0, // Would need additional queries to get this
        waiting: 0, // Would need additional queries to get this
        maxConnections: 100, // Default, should be configurable
      };
    } catch (error) {
      console.warn("Could not get database pool stats:", error);
      return null;
    }
  }

  /**
   * Get last health check result
   */
  getLastHealthCheck(): SystemHealthReport | null {
    return this.lastHealthCheck;
  }

  /**
   * Check if a specific service is healthy
   */
  isServiceHealthy(serviceName: string): boolean {
    if (!this.lastHealthCheck) {
      return false;
    }

    const service = this.lastHealthCheck.services.find(
      (s) => s.service === serviceName
    );

    return service?.status === "healthy";
  }

  /**
   * Get service response times
   */
  getServiceResponseTimes(): Record<string, number> {
    if (!this.lastHealthCheck) {
      return {};
    }

    return this.lastHealthCheck.services.reduce((acc, service) => {
      acc[service.service] = service.responseTime;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Force a health check for a specific service
   */
  async checkServiceHealth(serviceName: string): Promise<HealthCheckResult> {
    const healthCheckFn = this.healthChecks.get(serviceName);

    if (!healthCheckFn) {
      throw new Error(`No health check registered for service: ${serviceName}`);
    }

    return this.executeHealthCheckWithTimeout(
      serviceName,
      healthCheckFn,
      10000
    );
  }

  /**
   * Get health metrics for monitoring systems
   */
  getHealthMetrics(): Record<string, number> {
    if (!this.lastHealthCheck) {
      return {};
    }

    const metrics: Record<string, number> = {
      system_health_overall: this.lastHealthCheck.overall === "healthy" ? 1 : 0,
      system_uptime_seconds: Math.floor(this.lastHealthCheck.uptime / 1000),
    };

    // Add per-service metrics
    this.lastHealthCheck.services.forEach((service) => {
      const serviceName = service.service.replace(/[^a-zA-Z0-9_]/g, "_");
      metrics[`service_health_${serviceName}`] =
        service.status === "healthy" ? 1 : 0;
      metrics[`service_response_time_${serviceName}_ms`] = service.responseTime;
    });

    return metrics;
  }
}

// Export singleton instance
export const connectionHealthMonitor = ConnectionHealthMonitor.getInstance();

// Auto-start monitoring in production
if (process.env.NODE_ENV === "production") {
  connectionHealthMonitor.startMonitoring(60000); // Check every minute in production
} else if (process.env.NODE_ENV === "development") {
  connectionHealthMonitor.startMonitoring(120000); // Check every 2 minutes in development
}
