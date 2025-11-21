"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Activity,
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle,
  Clock,
  Settings,
} from "lucide-react";
import { useEffect, useState } from "react";

interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: "greater_than" | "less_than" | "equals";
  threshold: number;
  severity: "low" | "medium" | "high" | "critical";
  enabled: boolean;
  description: string;
}

interface SystemAlert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
  acknowledged: boolean;
  resolvedAt?: string;
}

const defaultAlertRules: AlertRule[] = [
  {
    id: "response_time_high",
    name: "High Response Time",
    metric: "database_response_time",
    condition: "greater_than",
    threshold: 1000,
    severity: "medium",
    enabled: true,
    description: "Database response time exceeds 1 second",
  },
  {
    id: "error_rate_high",
    name: "High Error Rate",
    metric: "error_rate",
    condition: "greater_than",
    threshold: 0.05,
    severity: "high",
    enabled: true,
    description: "Error rate exceeds 5%",
  },
  {
    id: "memory_usage_high",
    name: "High Memory Usage",
    metric: "memory_usage",
    condition: "greater_than",
    threshold: 1024 * 1024 * 1024, // 1GB
    severity: "medium",
    enabled: true,
    description: "Memory usage exceeds 1GB",
  },
  {
    id: "active_chats_low",
    name: "No Active Chats",
    metric: "active_chats",
    condition: "equals",
    threshold: 0,
    severity: "low",
    enabled: false,
    description: "No active chat sessions detected",
  },
  {
    id: "realtime_latency_high",
    name: "High Realtime Latency",
    metric: "realtime_latency",
    condition: "greater_than",
    threshold: 2000,
    severity: "medium",
    enabled: true,
    description: "Realtime connection latency exceeds 2 seconds",
  },
];

export default function MonitoringAlerts() {
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>(defaultAlertRules);
  const [isLoading, setIsLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Check for browser notification permission
  useEffect(() => {
    if ("Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }
  }, []);

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === "granted");
    }
  };

  // Show browser notification
  const showNotification = (alert: SystemAlert) => {
    if (!notificationsEnabled) return;

    const notification = new Notification(
      `${alert.severity.toUpperCase()}: ${alert.ruleName}`,
      {
        body: alert.message,
        icon: "/favicon.ico",
        tag: alert.id,
        requireInteraction: alert.severity === "critical",
      }
    );

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Auto-close after 10 seconds for non-critical alerts
    if (alert.severity !== "critical") {
      setTimeout(() => notification.close(), 10000);
    }
  };

  // Evaluate alert rules against current metrics
  const evaluateAlerts = async () => {
    try {
      // Fetch current metrics
      const [statsResponse, performanceResponse, chatResponse] =
        await Promise.all([
          fetch("/api/admin/stats"),
          fetch("/api/admin/performance"),
          fetch("/api/admin/chat/metrics"),
        ]);

      if (!statsResponse.ok || !performanceResponse.ok || !chatResponse.ok) {
        throw new Error("Failed to fetch metrics");
      }

      const stats = await statsResponse.json();
      const performance = await performanceResponse.json();
      const chat = await chatResponse.json();

      const currentMetrics = {
        database_response_time: performance.databaseResponseTime,
        error_rate: chat.errorRate,
        memory_usage: performance.memoryUsage,
        active_chats: stats.activeChats,
        realtime_latency: performance.realtimeLatency,
        load_time: performance.averageLoadTime,
        uptime: performance.uptime,
      };

      const newAlerts: SystemAlert[] = [];

      // Evaluate each enabled rule
      alertRules
        .filter((rule) => rule.enabled)
        .forEach((rule) => {
          const currentValue = currentMetrics[rule.metric];
          if (currentValue === undefined) return;

          let triggered = false;
          switch (rule.condition) {
            case "greater_than":
              triggered = currentValue > rule.threshold;
              break;
            case "less_than":
              triggered = currentValue < rule.threshold;
              break;
            case "equals":
              triggered = currentValue === rule.threshold;
              break;
          }

          if (triggered) {
            const existingAlert = alerts.find(
              (a) => a.ruleId === rule.id && !a.resolvedAt
            );

            if (!existingAlert) {
              const newAlert: SystemAlert = {
                id: `alert_${Date.now()}_${rule.id}`,
                ruleId: rule.id,
                ruleName: rule.name,
                severity: rule.severity,
                message: `${
                  rule.description
                }. Current value: ${formatMetricValue(
                  rule.metric,
                  currentValue
                )}`,
                value: currentValue,
                threshold: rule.threshold,
                timestamp: new Date().toISOString(),
                acknowledged: false,
              };

              newAlerts.push(newAlert);
              showNotification(newAlert);
            }
          } else {
            // Resolve existing alerts for this rule
            setAlerts((prev) =>
              prev.map((alert) =>
                alert.ruleId === rule.id && !alert.resolvedAt
                  ? { ...alert, resolvedAt: new Date().toISOString() }
                  : alert
              )
            );
          }
        });

      if (newAlerts.length > 0) {
        setAlerts((prev) => [...newAlerts, ...prev]);
      }
    } catch (error) {
      console.error("Failed to evaluate alerts:", error);
    }
  };

  // Format metric values for display
  const formatMetricValue = (metric: string, value: number): string => {
    switch (metric) {
      case "database_response_time":
      case "realtime_latency":
      case "load_time":
        return `${value}ms`;
      case "error_rate":
        return `${(value * 100).toFixed(1)}%`;
      case "memory_usage":
        return `${Math.round(value / 1024 / 1024)}MB`;
      case "uptime":
        return `${value.toFixed(1)}%`;
      default:
        return value.toString();
    }
  };

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "low":
        return "text-blue-600";
      case "medium":
        return "text-yellow-600";
      case "high":
        return "text-orange-600";
      case "critical":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  // Get severity icon
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "low":
        return <Clock className="h-4 w-4 text-blue-600" />;
      case "medium":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case "high":
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case "critical":
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Bell className="h-4 w-4 text-gray-600" />;
    }
  };

  // Acknowledge alert
  const acknowledgeAlert = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      )
    );
  };

  // Toggle alert rule
  const toggleAlertRule = (ruleId: string) => {
    setAlertRules((prev) =>
      prev.map((rule) =>
        rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
      )
    );
  };

  // Auto-evaluate alerts every 30 seconds
  useEffect(() => {
    evaluateAlerts();
    const interval = setInterval(evaluateAlerts, 30000);
    return () => clearInterval(interval);
  }, [alertRules, alerts]);

  // Get active (unresolved) alerts
  const activeAlerts = alerts.filter((alert) => !alert.resolvedAt);
  const criticalAlerts = activeAlerts.filter(
    (alert) => alert.severity === "critical"
  );
  const highAlerts = activeAlerts.filter((alert) => alert.severity === "high");

  return (
    <div className="space-y-6">
      {/* Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAlerts.length}</div>
            <p className="text-xs text-muted-foreground">
              {criticalAlerts.length} critical, {highAlerts.length} high
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alert Rules</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {alertRules.filter((rule) => rule.enabled).length}
            </div>
            <p className="text-xs text-muted-foreground">
              of {alertRules.length} enabled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Notifications</CardTitle>
            {notificationsEnabled ? (
              <Bell className="h-4 w-4 text-green-600" />
            ) : (
              <BellOff className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {notificationsEnabled ? "ON" : "OFF"}
            </div>
            {!notificationsEnabled && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={requestNotificationPermission}
              >
                Enable
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Check</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {new Date().toLocaleTimeString()}
            </div>
            <p className="text-xs text-muted-foreground">Auto-refresh: 30s</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Active Alerts ({activeAlerts.length})
            </CardTitle>
            <CardDescription>Alerts that require attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeAlerts.map((alert) => (
              <Alert
                key={alert.id}
                variant={
                  alert.severity === "critical" ? "destructive" : "default"
                }
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(alert.severity)}
                    <div>
                      <AlertTitle className="flex items-center gap-2">
                        {alert.ruleName}
                        <Badge
                          variant={
                            alert.severity === "critical"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {alert.severity.toUpperCase()}
                        </Badge>
                      </AlertTitle>
                      <AlertDescription className="mt-1">
                        {alert.message}
                      </AlertDescription>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {!alert.acknowledged && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => acknowledgeAlert(alert.id)}
                    >
                      Acknowledge
                    </Button>
                  )}
                </div>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Alert Rules Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Alert Rules
          </CardTitle>
          <CardDescription>
            Configure monitoring thresholds and notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {alertRules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      rule.enabled ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                  <div>
                    <h4 className="font-medium">{rule.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {rule.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Threshold:{" "}
                      {formatMetricValue(rule.metric, rule.threshold)} |
                      Severity:{" "}
                      <span className={getSeverityColor(rule.severity)}>
                        {rule.severity}
                      </span>
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleAlertRule(rule.id)}
                >
                  {rule.enabled ? "Disable" : "Enable"}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Resolved Alerts */}
      {alerts.filter((alert) => alert.resolvedAt).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Recently Resolved
            </CardTitle>
            <CardDescription>
              Alerts that have been resolved in the last 24 hours
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts
                .filter((alert) => alert.resolvedAt)
                .slice(0, 5)
                .map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between p-3 bg-green-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <div>
                        <p className="font-medium text-sm">{alert.ruleName}</p>
                        <p className="text-xs text-muted-foreground">
                          Resolved:{" "}
                          {new Date(alert.resolvedAt!).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-green-600">
                      Resolved
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
