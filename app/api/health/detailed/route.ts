import { createPublicRoute } from "@/lib/api-route-wrapper";
import { connectionHealthMonitor } from "@/lib/connection-health-monitor";
import { NextRequest, NextResponse } from "next/server";

/**
 * Detailed health check endpoint
 * GET /api/health/detailed
 */
export const GET = createPublicRoute(async (_request: NextRequest) => {
  try {
    // Get comprehensive system health
    const healthReport = await connectionHealthMonitor.getSystemHealth();

    // Get health metrics for monitoring systems
    const metrics = connectionHealthMonitor.getHealthMetrics();

    // Determine HTTP status based on overall health
    let status = 200;
    if (healthReport.overall === "degraded") {
      status = 200; // Still OK, but with warnings
    } else if (healthReport.overall === "unhealthy") {
      status = 503; // Service unavailable
    }

    return NextResponse.json(
      {
        status: healthReport.overall,
        timestamp: healthReport.timestamp,
        uptime: healthReport.uptime,
        services: healthReport.services,
        metrics,
        version: process.env.npm_package_version || "unknown",
        environment: process.env.NODE_ENV || "unknown",
      },
      { status }
    );
  } catch (error) {
    console.error("Health check failed:", error);

    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date(),
        error: "Health check system failure",
        services: [],
        metrics: {},
      },
      { status: 503 }
    );
  }
});

/**
 * Simple health check endpoint for load balancers
 * HEAD /api/health/detailed
 */
export const HEAD = createPublicRoute(async () => {
  try {
    const healthReport = await connectionHealthMonitor.getSystemHealth();

    const status = healthReport.overall === "unhealthy" ? 503 : 200;

    return new NextResponse(null, {
      status,
      headers: {
        "X-Health-Status": healthReport.overall,
        "X-Uptime": healthReport.uptime.toString(),
      },
    });
  } catch (_error) {
    return new NextResponse(null, { status: 503 });
  }
});
