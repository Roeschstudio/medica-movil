"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { chatService } from "@/lib/chat-service";
import { dbOptimizer } from "@/lib/db-optimization";
import {
  fileCache,
  messageCache,
  useEnhancedCache,
  userCache,
} from "@/lib/enhanced-cache";
import { usePerformanceMonitor } from "@/lib/performance-monitor";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  MessageSquare,
  RefreshCw,
  Wifi,
} from "lucide-react";
import { useEffect, useState } from "react";

interface SystemMetrics {
  connections: {
    active: number;
    total: number;
    errors: number;
  };
  messages: {
    sent: number;
    received: number;
    failed: number;
    queued: number;
  };
  performance: {
    averageLatency: number;
    p95Latency: number;
    errorRate: number;
    throughput: number;
  };
  cache: {
    hitRate: number;
    size: number;
    memoryUsage: number;
  };
  database: {
    queryCount: number;
    averageLatency: number;
    errorRate: number;
    cacheHitRate: number;
  };
}

interface AlertItem {
  id: string;
  type: "error" | "warning" | "info";
  message: string;
  timestamp: number;
  resolved: boolean;
}

export function ChatMonitoringDashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    connections: { active: 0, total: 0, errors: 0 },
    messages: { sent: 0, received: 0, failed: 0, queued: 0 },
    performance: {
      averageLatency: 0,
      p95Latency: 0,
      errorRate: 0,
      throughput: 0,
    },
    cache: { hitRate: 0, size: 0, memoryUsage: 0 },
    database: {
      queryCount: 0,
      averageLatency: 0,
      errorRate: 0,
      cacheHitRate: 0,
    },
  });

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const performanceMonitor = usePerformanceMonitor();
  const messageCacheHook = useEnhancedCache(messageCache);
  const userCacheHook = useEnhancedCache(userCache);
  const fileCacheHook = useEnhancedCache(fileCache);

  // Refresh metrics
  const refreshMetrics = async () => {
    setIsRefreshing(true);

    try {
      // Get system health
      const systemHealth = performanceMonitor.getSystemHealth();

      // Get database stats
      const dbStats = dbOptimizer.getStats();

      // Get cache stats
      const messageCacheStats = messageCacheHook.getStats();
      const userCacheStats = userCacheHook.getStats();
      const fileCacheStats = fileCacheHook.getStats();

      // Get connection status
      const connectionStatus = chatService.getConnectionStatus();

      // Calculate metrics
      const newMetrics: SystemMetrics = {
        connections: {
          active:
            performanceMonitor.getLatestMetric("chat.active_connections")
              ?.value || 0,
          total:
            performanceMonitor.getLatestMetric("chat.total_connections")
              ?.value || 0,
          errors:
            performanceMonitor.getLatestMetric("chat.connection_errors")
              ?.value || 0,
        },
        messages: {
          sent:
            performanceMonitor.getLatestMetric("chat.messages_sent")?.value ||
            0,
          received:
            performanceMonitor.getLatestMetric("chat.messages_received")
              ?.value || 0,
          failed:
            performanceMonitor.getLatestMetric("chat.messages_failed")?.value ||
            0,
          queued:
            performanceMonitor.getLatestMetric("chat.messages_queued")?.value ||
            0,
        },
        performance: {
          averageLatency: performanceMonitor.getAverage(
            "chat.message_latency",
            300000
          ), // 5 minutes
          p95Latency: performanceMonitor.getPercentile(
            "chat.message_latency",
            95,
            300000
          ),
          errorRate: calculateErrorRate(),
          throughput: calculateThroughput(),
        },
        cache: {
          hitRate:
            (messageCacheStats.hitRate +
              userCacheStats.hitRate +
              fileCacheStats.hitRate) /
            3,
          size:
            messageCacheStats.size + userCacheStats.size + fileCacheStats.size,
          memoryUsage:
            messageCacheStats.memoryUsage +
            userCacheStats.memoryUsage +
            fileCacheStats.memoryUsage,
        },
        database: {
          queryCount: dbStats.totalQueries,
          averageLatency: dbStats.averageLatency,
          errorRate:
            dbStats.totalQueries > 0
              ? dbStats.failedQueries / dbStats.totalQueries
              : 0,
          cacheHitRate: dbStats.hitRate,
        },
      };

      setMetrics(newMetrics);

      // Check for alerts
      checkAlerts(newMetrics);
    } catch (error) {
      console.error("Failed to refresh metrics:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Calculate error rate
  const calculateErrorRate = () => {
    const errors =
      performanceMonitor.getLatestMetric("chat.errors")?.value || 0;
    const total =
      performanceMonitor.getLatestMetric("chat.total_operations")?.value || 1;
    return (errors / total) * 100;
  };

  // Calculate throughput (messages per minute)
  const calculateThroughput = () => {
    const recentMessages = performanceMonitor.getMetrics(
      "chat.message_sent",
      60
    ); // Last 60 metrics
    return recentMessages.length;
  };

  // Check for alerts
  const checkAlerts = (currentMetrics: SystemMetrics) => {
    const newAlerts: AlertItem[] = [];

    // High error rate alert
    if (currentMetrics.performance.errorRate > 5) {
      newAlerts.push({
        id: "high-error-rate",
        type: "error",
        message: `High error rate: ${currentMetrics.performance.errorRate.toFixed(
          2
        )}%`,
        timestamp: Date.now(),
        resolved: false,
      });
    }

    // High latency alert
    if (currentMetrics.performance.averageLatency > 2000) {
      newAlerts.push({
        id: "high-latency",
        type: "warning",
        message: `High average latency: ${currentMetrics.performance.averageLatency.toFixed(
          0
        )}ms`,
        timestamp: Date.now(),
        resolved: false,
      });
    }

    // Low cache hit rate alert
    if (currentMetrics.cache.hitRate < 0.7) {
      newAlerts.push({
        id: "low-cache-hit-rate",
        type: "warning",
        message: `Low cache hit rate: ${(
          currentMetrics.cache.hitRate * 100
        ).toFixed(1)}%`,
        timestamp: Date.now(),
        resolved: false,
      });
    }

    // Connection issues alert
    if (currentMetrics.connections.errors > 10) {
      newAlerts.push({
        id: "connection-errors",
        type: "error",
        message: `Multiple connection errors: ${currentMetrics.connections.errors}`,
        timestamp: Date.now(),
        resolved: false,
      });
    }

    setAlerts((prev) => [...prev.filter((a) => a.resolved), ...newAlerts]);
  };

  // Auto-refresh effect
  useEffect(() => {
    refreshMetrics();

    if (autoRefresh) {
      const interval = setInterval(refreshMetrics, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // Resolve alert
  const resolveAlert = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === alertId ? { ...alert, resolved: true } : alert
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Chat System Monitoring</h2>
          <p className="text-muted-foreground">
            Real-time performance and health metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? "Disable Auto-refresh" : "Enable Auto-refresh"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshMetrics}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.filter((a) => !a.resolved).length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Active Alerts ({alerts.filter((a) => !a.resolved).length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts
                .filter((a) => !a.resolved)
                .map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          alert.type === "error" ? "destructive" : "secondary"
                        }
                      >
                        {alert.type}
                      </Badge>
                      <span>{alert.message}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => resolveAlert(alert.id)}
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Connections
            </CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.connections.active}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.connections.errors > 0 && (
                <span className="text-destructive">
                  {metrics.connections.errors} errors
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages/Min</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.performance.throughput}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.messages.failed > 0 && (
                <span className="text-destructive">
                  {metrics.messages.failed} failed
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.performance.averageLatency.toFixed(0)}ms
            </div>
            <p className="text-xs text-muted-foreground">
              P95: {metrics.performance.p95Latency.toFixed(0)}ms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Cache Hit Rate
            </CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(metrics.cache.hitRate * 100).toFixed(1)}%
            </div>
            <Progress value={metrics.cache.hitRate * 100} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="cache">Cache</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Message Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Messages Sent</span>
                  <span className="font-mono">{metrics.messages.sent}</span>
                </div>
                <div className="flex justify-between">
                  <span>Messages Received</span>
                  <span className="font-mono">{metrics.messages.received}</span>
                </div>
                <div className="flex justify-between">
                  <span>Messages Failed</span>
                  <span className="font-mono text-destructive">
                    {metrics.messages.failed}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Messages Queued</span>
                  <span className="font-mono">{metrics.messages.queued}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Error Rate</span>
                  <span
                    className={`font-mono ${
                      metrics.performance.errorRate > 5
                        ? "text-destructive"
                        : ""
                    }`}
                  >
                    {metrics.performance.errorRate.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Throughput</span>
                  <span className="font-mono">
                    {metrics.performance.throughput} msg/min
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Average Latency</span>
                  <span className="font-mono">
                    {metrics.performance.averageLatency.toFixed(0)}ms
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>P95 Latency</span>
                  <span className="font-mono">
                    {metrics.performance.p95Latency.toFixed(0)}ms
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="connections" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Connection Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span>Active Connections</span>
                <span className="font-mono">{metrics.connections.active}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Connections</span>
                <span className="font-mono">{metrics.connections.total}</span>
              </div>
              <div className="flex justify-between">
                <span>Connection Errors</span>
                <span className="font-mono text-destructive">
                  {metrics.connections.errors}
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Database Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span>Total Queries</span>
                <span className="font-mono">{metrics.database.queryCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Average Latency</span>
                <span className="font-mono">
                  {metrics.database.averageLatency.toFixed(0)}ms
                </span>
              </div>
              <div className="flex justify-between">
                <span>Error Rate</span>
                <span
                  className={`font-mono ${
                    metrics.database.errorRate > 0.05 ? "text-destructive" : ""
                  }`}
                >
                  {(metrics.database.errorRate * 100).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Cache Hit Rate</span>
                <span className="font-mono">
                  {(metrics.database.cacheHitRate * 100).toFixed(1)}%
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cache" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Message Cache</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>Hit Rate</span>
                  <span className="font-mono">
                    {(messageCacheHook.getStats().hitRate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Size</span>
                  <span className="font-mono">
                    {messageCacheHook.getStats().size}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Memory</span>
                  <span className="font-mono">
                    {(
                      messageCacheHook.getStats().memoryUsage /
                      1024 /
                      1024
                    ).toFixed(1)}
                    MB
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User Cache</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>Hit Rate</span>
                  <span className="font-mono">
                    {(userCacheHook.getStats().hitRate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Size</span>
                  <span className="font-mono">
                    {userCacheHook.getStats().size}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Memory</span>
                  <span className="font-mono">
                    {(
                      userCacheHook.getStats().memoryUsage /
                      1024 /
                      1024
                    ).toFixed(1)}
                    MB
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>File Cache</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>Hit Rate</span>
                  <span className="font-mono">
                    {(fileCacheHook.getStats().hitRate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Size</span>
                  <span className="font-mono">
                    {fileCacheHook.getStats().size}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Memory</span>
                  <span className="font-mono">
                    {(
                      fileCacheHook.getStats().memoryUsage /
                      1024 /
                      1024
                    ).toFixed(1)}
                    MB
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
