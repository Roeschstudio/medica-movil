import { createSupabaseServerClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();

    // Verify admin access
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role, name")
      .eq("id", user.id)
      .single();

    if (userError || userData?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      type,
      timeframe,
      startDate,
      endDate,
      includeCharts,
      includeDetails,
      format,
    } = body;

    // Calculate time range
    const now = new Date();
    let reportStartTime: Date;
    let reportEndTime: Date = now;

    if (timeframe === "custom" && startDate && endDate) {
      reportStartTime = new Date(startDate);
      reportEndTime = new Date(endDate);
    } else {
      switch (timeframe) {
        case "1h":
          reportStartTime = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case "24h":
          reportStartTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          reportStartTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          reportStartTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          reportStartTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }
    }

    // Fetch data based on report type
    const reportData: any = {};

    if (type === "usage" || type === "custom") {
      // Get usage metrics
      const [sessionsResult, messagesResult, usersResult] = await Promise.all([
        supabase
          .from("chat_rooms")
          .select("*")
          .gte("created_at", reportStartTime.toISOString())
          .lte("created_at", reportEndTime.toISOString()),

        supabase
          .from("chat_messages")
          .select("*")
          .gte("sent_at", reportStartTime.toISOString())
          .lte("sent_at", reportEndTime.toISOString()),

        supabase
          .from("chat_analytics")
          .select("*")
          .in("event_type", ["chat_opened", "message_sent"])
          .gte("timestamp", reportStartTime.toISOString())
          .lte("timestamp", reportEndTime.toISOString()),
      ]);

      reportData.usage = {
        totalSessions: sessionsResult.data?.length || 0,
        totalMessages: messagesResult.data?.length || 0,
        uniqueUsers: new Set(messagesResult.data?.map((m) => m.sender_id) || [])
          .size,
        fileUploads:
          messagesResult.data?.filter((m) =>
            ["FILE", "IMAGE"].includes(m.message_type)
          ).length || 0,
      };
    }

    if (type === "performance" || type === "custom") {
      // Get performance metrics
      const [performanceResult, errorsResult] = await Promise.all([
        supabase
          .from("chat_analytics")
          .select("*")
          .eq("event_type", "performance_metric")
          .gte("timestamp", reportStartTime.toISOString())
          .lte("timestamp", reportEndTime.toISOString()),

        supabase
          .from("chat_analytics")
          .select("*")
          .eq("event_type", "connection_error")
          .gte("timestamp", reportStartTime.toISOString())
          .lte("timestamp", reportEndTime.toISOString()),
      ]);

      const performanceMetrics = (performanceResult.data || []).reduce(
        (acc, record) => {
          const metadata = record.metadata as any;
          if (metadata?.metric_name && metadata?.value) {
            if (!acc[metadata.metric_name]) acc[metadata.metric_name] = [];
            acc[metadata.metric_name].push(metadata.value);
          }
          return acc;
        },
        {} as Record<string, number[]>
      );

      const avgMetrics = Object.entries(performanceMetrics).reduce(
        (acc, [key, values]) => {
          acc[key] = values.reduce((a, b) => a + b, 0) / values.length;
          return acc;
        },
        {} as Record<string, number>
      );

      reportData.performance = {
        averageResponseTime: avgMetrics.response_time || 0,
        systemLatency: avgMetrics.realtime_latency || 0,
        errorCount: errorsResult.data?.length || 0,
        errorRate:
          ((errorsResult.data?.length || 0) /
            Math.max(
              (performanceResult.data?.length || 0) +
                (errorsResult.data?.length || 0),
              1
            )) *
          100,
      };
    }

    if (type === "errors" || type === "custom") {
      // Get error analysis
      const { data: errorData } = await supabase
        .from("chat_analytics")
        .select("*")
        .eq("event_type", "connection_error")
        .gte("timestamp", reportStartTime.toISOString())
        .lte("timestamp", reportEndTime.toISOString());

      const errorsByType = (errorData || []).reduce((acc, error) => {
        const metadata = error.metadata as any;
        const errorType = metadata?.error_type || "Unknown";
        acc[errorType] = (acc[errorType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      reportData.errors = {
        totalErrors: errorData?.length || 0,
        errorsByType,
        errorTimeline:
          errorData?.map((e) => ({
            timestamp: e.timestamp,
            message: (e.metadata as any)?.error_message || "Unknown error",
          })) || [],
      };
    }

    // Generate report based on format
    if (format === "json") {
      const jsonReport = {
        reportType: type,
        timeframe: {
          start: reportStartTime.toISOString(),
          end: reportEndTime.toISOString(),
        },
        generatedAt: now.toISOString(),
        generatedBy: userData.name,
        data: reportData,
      };

      return NextResponse.json(jsonReport, {
        headers: {
          "Content-Disposition": `attachment; filename="chat-analytics-${type}-${
            now.toISOString().split("T")[0]
          }.json"`,
        },
      });
    }

    if (format === "csv") {
      // Generate CSV based on report type
      let csvContent = "";

      if (type === "usage" && reportData.usage) {
        csvContent = "Metric,Value\n";
        csvContent += `Total Sessions,${reportData.usage.totalSessions}\n`;
        csvContent += `Total Messages,${reportData.usage.totalMessages}\n`;
        csvContent += `Unique Users,${reportData.usage.uniqueUsers}\n`;
        csvContent += `File Uploads,${reportData.usage.fileUploads}\n`;
      } else if (type === "performance" && reportData.performance) {
        csvContent = "Metric,Value\n";
        csvContent += `Average Response Time (ms),${reportData.performance.averageResponseTime}\n`;
        csvContent += `System Latency (ms),${reportData.performance.systemLatency}\n`;
        csvContent += `Error Count,${reportData.performance.errorCount}\n`;
        csvContent += `Error Rate (%),${reportData.performance.errorRate}\n`;
      } else if (type === "errors" && reportData.errors) {
        csvContent = "Timestamp,Error Message\n";
        reportData.errors.errorTimeline.forEach((error: any) => {
          csvContent += `${error.timestamp},"${error.message}"\n`;
        });
      }

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="chat-analytics-${type}-${
            now.toISOString().split("T")[0]
          }.csv"`,
        },
      });
    }

    if (format === "pdf") {
      // For PDF generation, we would typically use a library like puppeteer or jsPDF
      // For now, return a simple text-based report
      const textReport = `
CHAT ANALYTICS REPORT
=====================

Report Type: ${type.toUpperCase()}
Generated: ${now.toLocaleString()}
Generated By: ${userData.name}
Time Period: ${reportStartTime.toLocaleString()} - ${reportEndTime.toLocaleString()}

${
  reportData.usage
    ? `
USAGE METRICS
-------------
Total Sessions: ${reportData.usage.totalSessions}
Total Messages: ${reportData.usage.totalMessages}
Unique Users: ${reportData.usage.uniqueUsers}
File Uploads: ${reportData.usage.fileUploads}
`
    : ""
}

${
  reportData.performance
    ? `
PERFORMANCE METRICS
-------------------
Average Response Time: ${reportData.performance.averageResponseTime}ms
System Latency: ${reportData.performance.systemLatency}ms
Error Count: ${reportData.performance.errorCount}
Error Rate: ${reportData.performance.errorRate}%
`
    : ""
}

${
  reportData.errors
    ? `
ERROR ANALYSIS
--------------
Total Errors: ${reportData.errors.totalErrors}
Error Types: ${Object.entries(reportData.errors.errorsByType)
        .map(([type, count]) => `${type}: ${count}`)
        .join(", ")}
`
    : ""
}

Generated by Medica Movil Admin System
      `.trim();

      return new NextResponse(textReport, {
        headers: {
          "Content-Type": "text/plain",
          "Content-Disposition": `attachment; filename="chat-analytics-${type}-${
            now.toISOString().split("T")[0]
          }.txt"`,
        },
      });
    }

    return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
