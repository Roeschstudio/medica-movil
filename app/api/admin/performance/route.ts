import { authOptions } from "@/lib/unified-auth";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { ErrorLogger } from '@/lib/error-handling-utils';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();

    // Get time ranges
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get performance analytics data
    const { data: performanceData } = await supabase
      .from("chat_analytics")
      .select("*")
      .eq("eventType", "performance_metric")
      .gte("timestamp", last24Hours.toISOString())
      .order("timestamp", { ascending: false });

    // Initialize metrics
    let averageLoadTime = 0;
    let memoryUsage = 0;
    let cpuUsage = 0;
    let databaseResponseTime = 0;
    let realtimeLatency = 0;

    if (performanceData && performanceData.length > 0) {
      // Group metrics by type
      const metricsByType = performanceData.reduce((acc, metric) => {
        const metricName = metric.metadata?.metric_name;
        if (metricName) {
          if (!acc[metricName]) acc[metricName] = [];
          acc[metricName].push(metric.metadata.value);
        }
        return acc;
      }, {});

      // Calculate averages
      const calculateAverage = (values) =>
        values.length > 0
          ? values.reduce((sum, val) => sum + val, 0) / values.length
          : 0;

      averageLoadTime = calculateAverage(metricsByType["page_load_time"] || []);
      memoryUsage = calculateAverage(metricsByType["memory_used"] || []);
      cpuUsage = calculateAverage(metricsByType["cpu_usage"] || []);
      databaseResponseTime = calculateAverage(
        metricsByType["database_response_time"] || []
      );
      realtimeLatency = calculateAverage(
        metricsByType["realtime_latency"] || []
      );
    }

    // Test current database response time
    const dbStartTime = Date.now();
    await supabase.from("users").select("id").limit(1);
    const currentDbResponseTime = Date.now() - dbStartTime;

    // Test current realtime latency (simplified)
    const realtimeStartTime = Date.now();
    try {
      const testChannel = supabase.channel("performance_test");
      await new Promise((resolve) => {
        testChannel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            resolve(status);
          }
        });
        setTimeout(resolve, 1000); // Timeout after 1 second
      });
      testChannel.unsubscribe();
    } catch (error) {
      ErrorLogger.log({
        error: error,
        context: "Realtime latency test",
        action: "GET /api/admin/performance",
        level: "warn",
        userId: session?.user?.id
      });
    }
    const currentRealtimeLatency = Date.now() - realtimeStartTime;

    // Get system resource usage (if available)
    let systemMemory = 0;

    if (typeof process !== "undefined" && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      systemMemory = memUsage.heapUsed;
    }

    // Get performance trends (last 24 hours)
    const performanceTrends = performanceData?.reduce((acc, metric) => {
      const hour = new Date(metric.timestamp).getHours();
      const metricName = metric.metadata?.metric_name;

      if (!acc[hour]) acc[hour] = {};
      if (!acc[hour][metricName]) acc[hour][metricName] = [];

      acc[hour][metricName].push(metric.metadata.value);

      return acc;
    }, {});

    // Calculate hourly averages
    const hourlyAverages = {};
    Object.keys(performanceTrends || {}).forEach((hour) => {
      hourlyAverages[hour] = {};
      Object.keys(performanceTrends[hour]).forEach((metricName) => {
        const values = performanceTrends[hour][metricName];
        hourlyAverages[hour][metricName] =
          values.reduce((sum, val) => sum + val, 0) / values.length;
      });
    });

    // Get error rates from performance data
    const { data: errorData } = await supabase
      .from("chat_analytics")
      .select("*")
      .eq("eventType", "connection_error")
      .gte("timestamp", last24Hours.toISOString());

    const errorRate =
      performanceData?.length > 0
        ? (errorData?.length || 0) / performanceData.length
        : 0;

    // Calculate uptime (simplified - based on health checks)
    const { data: healthData } = await supabase
      .from("system_health")
      .select("*")
      .gte("timestamp", last24Hours.toISOString())
      .order("timestamp", { ascending: false });

    let uptime = 100;
    if (healthData && healthData.length > 0) {
      const unhealthyChecks = healthData.filter(
        (check) => check.overallStatus === "unhealthy"
      ).length;
      uptime =
        ((healthData.length - unhealthyChecks) / healthData.length) * 100;
    }

    const metrics = {
      averageLoadTime: Math.round(averageLoadTime),
      memoryUsage: systemMemory || Math.round(memoryUsage),
      cpuUsage: Math.round(cpuUsage),
      databaseResponseTime: Math.round(
        databaseResponseTime || currentDbResponseTime
      ),
      realtimeLatency: Math.round(realtimeLatency || currentRealtimeLatency),
      errorRate,
      uptime: Math.round(uptime * 100) / 100,
      current: {
        databaseResponseTime: currentDbResponseTime,
        realtimeLatency: currentRealtimeLatency,
        memoryUsage: systemMemory,
        timestamp: new Date().toISOString(),
      },
      trends: {
        hourlyAverages,
        last24Hours:
          performanceData?.map((metric) => ({
            timestamp: metric.timestamp,
            metricName: metric.metadata?.metric_name,
            value: metric.metadata?.value,
          })) || [],
      },
    };

    return NextResponse.json(metrics);
  } catch (error) {
    ErrorLogger.log({
      error: error,
      context: "Performance metrics",
      action: "GET /api/admin/performance",
      level: "error",
      userId: session?.user?.id
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Store performance metric
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { metricName, value, unit, context } = await request.json();
    const supabase = await createSupabaseServerClient();

    // Store the performance metric
    await supabase.from("chat_analytics").insert({
      eventType: "performance_metric",
      userId: session.user.id,
      sessionId: `admin_${Date.now()}`,
      metadata: {
        metric_name: metricName,
        value,
        unit,
        context,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    ErrorLogger.log({
      error: error,
      context: "Performance metric storage",
      action: "POST /api/admin/performance",
      level: "error",
      userId: session?.user?.id
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Get detailed performance report
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { timeRange = "24h" } = await request.json();
    const supabase = await createSupabaseServerClient();

    // Calculate time range
    const now = new Date();
    let startTime;

    switch (timeRange) {
      case "1h":
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case "24h":
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Get detailed performance data
    const { data: detailedData } = await supabase
      .from("chat_analytics")
      .select("*")
      .eq("eventType", "performance_metric")
      .gte("timestamp", startTime.toISOString())
      .order("timestamp", { ascending: true });

    // Get health data for the same period
    const { data: healthData } = await supabase
      .from("system_health")
      .select("*")
      .gte("timestamp", startTime.toISOString())
      .order("timestamp", { ascending: true });

    // Process data for detailed analysis
    const report = {
      timeRange,
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
      performanceData: detailedData || [],
      healthData: healthData || [],
      summary: {
        totalDataPoints: detailedData?.length || 0,
        healthChecks: healthData?.length || 0,
        avgResponseTime: 0,
        maxResponseTime: 0,
        minResponseTime: 0,
        uptimePercentage: 100,
      },
    };

    // Calculate summary statistics
    if (detailedData && detailedData.length > 0) {
      const responseTimes = detailedData
        .filter((d) => d.metadata?.metric_name === "database_response_time")
        .map((d) => d.metadata.value);

      if (responseTimes.length > 0) {
        report.summary.avgResponseTime =
          responseTimes.reduce((sum, val) => sum + val, 0) /
          responseTimes.length;
        report.summary.maxResponseTime = Math.max(...responseTimes);
        report.summary.minResponseTime = Math.min(...responseTimes);
      }
    }

    if (healthData && healthData.length > 0) {
      const healthyChecks = healthData.filter(
        (h) => h.overallStatus === "healthy"
      ).length;
      report.summary.uptimePercentage =
        (healthyChecks / healthData.length) * 100;
    }

    return NextResponse.json(report);
  } catch (error) {
    ErrorLogger.log({
      error: error,
      context: "Detailed performance report",
      action: "PUT /api/admin/performance",
      level: "error",
      userId: session?.user?.id
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
