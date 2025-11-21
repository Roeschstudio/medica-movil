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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  Bell,
  Clock,
  Mail,
  MessageSquare,
  Plus,
  Settings,
  Trash2,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  condition: "greater_than" | "less_than" | "equals" | "not_equals";
  threshold: number;
  severity: "low" | "medium" | "high" | "critical";
  enabled: boolean;
  notifications: {
    email: boolean;
    sms: boolean;
    webhook: boolean;
  };
  cooldown: number; // minutes
  lastTriggered?: string;
  createdAt: string;
  updatedAt: string;
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
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  metadata?: Record<string, any>;
}

interface AlertRuleForm {
  name: string;
  description: string;
  metric: string;
  condition: "greater_than" | "less_than" | "equals" | "not_equals";
  threshold: number;
  severity: "low" | "medium" | "high" | "critical";
  notifications: {
    email: boolean;
    sms: boolean;
    webhook: boolean;
  };
  cooldown: number;
}

const AVAILABLE_METRICS = [
  { value: "response_time", label: "Response Time (ms)", unit: "ms" },
  { value: "error_rate", label: "Error Rate (%)", unit: "%" },
  { value: "active_sessions", label: "Active Sessions", unit: "count" },
  { value: "message_volume", label: "Message Volume", unit: "count" },
  { value: "concurrent_users", label: "Concurrent Users", unit: "count" },
  { value: "system_latency", label: "System Latency (ms)", unit: "ms" },
  { value: "memory_usage", label: "Memory Usage (MB)", unit: "MB" },
  {
    value: "database_response_time",
    label: "Database Response Time (ms)",
    unit: "ms",
  },
  {
    value: "file_upload_failures",
    label: "File Upload Failures",
    unit: "count",
  },
  { value: "connection_failures", label: "Connection Failures", unit: "count" },
];

export default function AutomatedAlerts() {
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<SystemAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [ruleForm, setRuleForm] = useState<AlertRuleForm>({
    name: "",
    description: "",
    metric: "response_time",
    condition: "greater_than",
    threshold: 1000,
    severity: "medium",
    notifications: {
      email: true,
      sms: false,
      webhook: false,
    },
    cooldown: 5,
  });

  // Load alert rules and active alerts
  const loadData = async () => {
    setIsLoading(true);
    try {
      // In a real implementation, these would be API calls
      const mockRules: AlertRule[] = [
        {
          id: "1",
          name: "High Response Time",
          description: "Alert when response time exceeds 2 seconds",
          metric: "response_time",
          condition: "greater_than",
          threshold: 2000,
          severity: "high",
          enabled: true,
          notifications: { email: true, sms: false, webhook: true },
          cooldown: 5,
          createdAt: "2024-12-09T10:00:00Z",
          updatedAt: "2024-12-09T10:00:00Z",
        },
        {
          id: "2",
          name: "High Error Rate",
          description: "Alert when error rate exceeds 5%",
          metric: "error_rate",
          condition: "greater_than",
          threshold: 5,
          severity: "critical",
          enabled: true,
          notifications: { email: true, sms: true, webhook: true },
          cooldown: 10,
          lastTriggered: "2024-12-09T14:30:00Z",
          createdAt: "2024-12-09T09:00:00Z",
          updatedAt: "2024-12-09T14:30:00Z",
        },
        {
          id: "3",
          name: "Low Active Sessions",
          description: "Alert when active sessions drop to zero",
          metric: "active_sessions",
          condition: "equals",
          threshold: 0,
          severity: "medium",
          enabled: false,
          notifications: { email: true, sms: false, webhook: false },
          cooldown: 15,
          createdAt: "2024-12-09T08:00:00Z",
          updatedAt: "2024-12-09T08:00:00Z",
        },
      ];

      const mockAlerts: SystemAlert[] = [
        {
          id: "alert-1",
          ruleId: "2",
          ruleName: "High Error Rate",
          severity: "critical",
          message: "Error rate has exceeded 5%. Current rate: 7.2%",
          value: 7.2,
          threshold: 5,
          timestamp: "2024-12-09T14:30:00Z",
          acknowledged: false,
        },
        {
          id: "alert-2",
          ruleId: "1",
          ruleName: "High Response Time",
          severity: "high",
          message: "Response time has exceeded 2000ms. Current time: 2450ms",
          value: 2450,
          threshold: 2000,
          timestamp: "2024-12-09T14:25:00Z",
          acknowledged: true,
          acknowledgedBy: "Admin User",
          acknowledgedAt: "2024-12-09T14:27:00Z",
        },
      ];

      setAlertRules(mockRules);
      setActiveAlerts(mockAlerts);
    } catch (error) {
      console.error("Failed to load alert data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Create or update alert rule
  const saveAlertRule = async () => {
    try {
      const rule: AlertRule = {
        id: editingRule?.id || `rule-${Date.now()}`,
        ...ruleForm,
        enabled: editingRule?.enabled ?? true,
        createdAt: editingRule?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (editingRule) {
        setAlertRules((prev) => prev.map((r) => (r.id === rule.id ? rule : r)));
      } else {
        setAlertRules((prev) => [...prev, rule]);
      }

      setShowCreateDialog(false);
      setEditingRule(null);
      resetForm();
    } catch (error) {
      console.error("Failed to save alert rule:", error);
    }
  };

  // Delete alert rule
  const deleteAlertRule = async (ruleId: string) => {
    try {
      setAlertRules((prev) => prev.filter((r) => r.id !== ruleId));
    } catch (error) {
      console.error("Failed to delete alert rule:", error);
    }
  };

  // Toggle alert rule
  const toggleAlertRule = async (ruleId: string) => {
    try {
      setAlertRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r))
      );
    } catch (error) {
      console.error("Failed to toggle alert rule:", error);
    }
  };

  // Acknowledge alert
  const acknowledgeAlert = async (alertId: string) => {
    try {
      setActiveAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId
            ? {
                ...a,
                acknowledged: true,
                acknowledgedBy: "Current Admin",
                acknowledgedAt: new Date().toISOString(),
              }
            : a
        )
      );
    } catch (error) {
      console.error("Failed to acknowledge alert:", error);
    }
  };

  // Reset form
  const resetForm = () => {
    setRuleForm({
      name: "",
      description: "",
      metric: "response_time",
      condition: "greater_than",
      threshold: 1000,
      severity: "medium",
      notifications: {
        email: true,
        sms: false,
        webhook: false,
      },
      cooldown: 5,
    });
  };

  // Open edit dialog
  const openEditDialog = (rule: AlertRule) => {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name,
      description: rule.description,
      metric: rule.metric,
      condition: rule.condition,
      threshold: rule.threshold,
      severity: rule.severity,
      notifications: rule.notifications,
      cooldown: rule.cooldown,
    });
    setShowCreateDialog(true);
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

  // Get severity badge variant
  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case "critical":
        return "destructive";
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "outline";
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Auto-refresh alerts every 30 seconds
  useEffect(() => {
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const unacknowledgedAlerts = activeAlerts.filter((a) => !a.acknowledged);
  const criticalAlerts = unacknowledgedAlerts.filter(
    (a) => a.severity === "critical"
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Automated Alerts</h1>
          <p className="text-muted-foreground">
            Configure and manage automated system alerts and notifications
          </p>
        </div>

        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Alert Rule
        </Button>
      </div>

      {/* Critical Alerts Banner */}
      {criticalAlerts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Critical Alerts Active</AlertTitle>
          <AlertDescription>
            {criticalAlerts.length} critical alert
            {criticalAlerts.length > 1 ? "s" : ""} require immediate attention.
          </AlertDescription>
        </Alert>
      )}

      {/* Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {unacknowledgedAlerts.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {criticalAlerts.length} critical
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
              {alertRules.filter((r) => r.enabled).length}
            </div>
            <p className="text-xs text-muted-foreground">
              of {alertRules.length} enabled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Last 24h Alerts
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAlerts.length}</div>
            <p className="text-xs text-muted-foreground">
              Total alerts triggered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.3m</div>
            <p className="text-xs text-muted-foreground">
              Average acknowledgment time
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      {unacknowledgedAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Active Alerts ({unacknowledgedAlerts.length})
            </CardTitle>
            <CardDescription>Alerts requiring attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {unacknowledgedAlerts.map((alert) => (
              <Alert
                key={alert.id}
                variant={
                  alert.severity === "critical" ? "destructive" : "default"
                }
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                    <div>
                      <AlertTitle className="flex items-center gap-2">
                        {alert.ruleName}
                        <Badge variant={getSeverityVariant(alert.severity)}>
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

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => acknowledgeAlert(alert.id)}
                  >
                    Acknowledge
                  </Button>
                </div>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Alert Rules */}
      <Card>
        <CardHeader>
          <CardTitle>Alert Rules</CardTitle>
          <CardDescription>
            Configure automated monitoring rules and thresholds
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {alertRules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={() => toggleAlertRule(rule.id)}
                  />

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{rule.name}</h4>
                      <Badge variant={getSeverityVariant(rule.severity)}>
                        {rule.severity}
                      </Badge>
                      {rule.lastTriggered && (
                        <Badge variant="outline" className="text-xs">
                          Last: {new Date(rule.lastTriggered).toLocaleString()}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {rule.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                      <span>
                        {
                          AVAILABLE_METRICS.find((m) => m.value === rule.metric)
                            ?.label
                        }{" "}
                        {rule.condition.replace("_", " ")} {rule.threshold}
                      </span>
                      <span>Cooldown: {rule.cooldown}m</span>
                      <div className="flex items-center gap-1">
                        {rule.notifications.email && (
                          <Mail className="h-3 w-3" />
                        )}
                        {rule.notifications.sms && (
                          <MessageSquare className="h-3 w-3" />
                        )}
                        {rule.notifications.webhook && (
                          <Zap className="h-3 w-3" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(rule)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteAlertRule(rule.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {alertRules.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No alert rules configured
                </h3>
                <p>
                  Create your first alert rule to start monitoring system
                  metrics
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Alert Rule Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Edit Alert Rule" : "Create Alert Rule"}
            </DialogTitle>
            <DialogDescription>
              Configure monitoring thresholds and notification preferences
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Rule Name</Label>
              <Input
                id="name"
                value={ruleForm.name}
                onChange={(e) =>
                  setRuleForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Enter rule name"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={ruleForm.description}
                onChange={(e) =>
                  setRuleForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Describe what this rule monitors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="metric">Metric</Label>
                <Select
                  value={ruleForm.metric}
                  onValueChange={(value) =>
                    setRuleForm((prev) => ({ ...prev, metric: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_METRICS.map((metric) => (
                      <SelectItem key={metric.value} value={metric.value}>
                        {metric.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="condition">Condition</Label>
                <Select
                  value={ruleForm.condition}
                  onValueChange={(value: any) =>
                    setRuleForm((prev) => ({ ...prev, condition: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="greater_than">Greater than</SelectItem>
                    <SelectItem value="less_than">Less than</SelectItem>
                    <SelectItem value="equals">Equals</SelectItem>
                    <SelectItem value="not_equals">Not equals</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="threshold">Threshold</Label>
                <Input
                  id="threshold"
                  type="number"
                  value={ruleForm.threshold}
                  onChange={(e) =>
                    setRuleForm((prev) => ({
                      ...prev,
                      threshold: parseFloat(e.target.value),
                    }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="severity">Severity</Label>
                <Select
                  value={ruleForm.severity}
                  onValueChange={(value: any) =>
                    setRuleForm((prev) => ({ ...prev, severity: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="cooldown">Cooldown (minutes)</Label>
              <Input
                id="cooldown"
                type="number"
                value={ruleForm.cooldown}
                onChange={(e) =>
                  setRuleForm((prev) => ({
                    ...prev,
                    cooldown: parseInt(e.target.value),
                  }))
                }
              />
            </div>

            <div>
              <Label>Notifications</Label>
              <div className="flex items-center gap-4 mt-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={ruleForm.notifications.email}
                    onChange={(e) =>
                      setRuleForm((prev) => ({
                        ...prev,
                        notifications: {
                          ...prev.notifications,
                          email: e.target.checked,
                        },
                      }))
                    }
                  />
                  Email
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={ruleForm.notifications.sms}
                    onChange={(e) =>
                      setRuleForm((prev) => ({
                        ...prev,
                        notifications: {
                          ...prev.notifications,
                          sms: e.target.checked,
                        },
                      }))
                    }
                  />
                  SMS
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={ruleForm.notifications.webhook}
                    onChange={(e) =>
                      setRuleForm((prev) => ({
                        ...prev,
                        notifications: {
                          ...prev.notifications,
                          webhook: e.target.checked,
                        },
                      }))
                    }
                  />
                  Webhook
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setEditingRule(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={saveAlertRule}
              disabled={!ruleForm.name || !ruleForm.description}
            >
              {editingRule ? "Update" : "Create"} Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
