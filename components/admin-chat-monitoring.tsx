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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Activity,
  AlertTriangle,
  Clock,
  FileText,
  MessageSquare,
  Pause,
  Play,
  RefreshCw,
  Search,
  Shield,
  StopCircle,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

interface ChatSession {
  id: string;
  appointmentId: string;
  isActive: boolean;
  startedAt: string;
  endedAt?: string;
  messageCount: number;
  unreadCount: number;
  appointment: {
    id: string;
    scheduledAt: string;
    type: string;
    status: string;
  };
  patient: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  doctor: {
    id: string;
    specialty: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
  };
  presence: {
    hasRecentActivity: boolean;
    lastActivity: string;
    activeUsers: number;
  };
}

interface ChatMetrics {
  totalMessages: number;
  activeRooms: number;
  averageResponseTime: number;
  errorRate: number;
  peakConcurrentUsers: number;
  fileUploads: number;
  performance: {
    averageLoadTime: number;
    memoryUsage: number;
    realtimeLatency: number;
    databaseResponseTime: number;
  };
  timeframe: string;
  generatedAt: string;
}

interface InterventionAction {
  action:
    | "send_message"
    | "pause_chat"
    | "resume_chat"
    | "end_chat"
    | "escalate";
  chatRoomId: string;
  message?: string;
  reason?: string;
}

export default function AdminChatMonitoring() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [metrics, setMetrics] = useState<ChatMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(
    null
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [timeframe, setTimeframe] = useState("24h");
  const [interventionDialog, setInterventionDialog] = useState(false);
  const [interventionAction, setInterventionAction] =
    useState<InterventionAction>({
      action: "send_message",
      chatRoomId: "",
    });
  const [isPerformingIntervention, setIsPerformingIntervention] =
    useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch chat sessions
  const fetchSessions = async () => {
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        limit: "100",
        offset: "0",
      });

      const response = await fetch(`/api/admin/chat/sessions?${params}`);
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error("Failed to fetch chat sessions:", error);
    }
  };

  // Fetch chat metrics
  const fetchMetrics = async () => {
    try {
      const params = new URLSearchParams({ timeframe });
      const response = await fetch(`/api/admin/chat/metrics?${params}`);
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error("Failed to fetch chat metrics:", error);
    }
  };

  // Refresh all data
  const refreshData = async () => {
    setIsLoading(true);
    await Promise.all([fetchSessions(), fetchMetrics()]);
    setLastUpdated(new Date());
    setIsLoading(false);
  };

  // Auto-refresh effect
  useEffect(() => {
    refreshData();

    if (autoRefresh) {
      const interval = setInterval(refreshData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [statusFilter, timeframe, autoRefresh]);

  // Filter sessions based on search term
  const filteredSessions = sessions.filter((session) => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      session.patient.name.toLowerCase().includes(searchLower) ||
      session.doctor.user.name.toLowerCase().includes(searchLower) ||
      session.doctor.specialty.toLowerCase().includes(searchLower) ||
      session.appointmentId.toLowerCase().includes(searchLower)
    );
  });

  // Perform intervention
  const performIntervention = async () => {
    if (!interventionAction.chatRoomId) return;

    setIsPerformingIntervention(true);
    try {
      const response = await fetch("/api/admin/chat/intervention", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(interventionAction),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Intervention successful:", result);

        // Refresh sessions to reflect changes
        await fetchSessions();

        // Close dialog and reset form
        setInterventionDialog(false);
        setInterventionAction({
          action: "send_message",
          chatRoomId: "",
        });
      } else {
        const error = await response.json();
        console.error("Intervention failed:", error);
        alert(`Intervention failed: ${error.error}`);
      }
    } catch (error) {
      console.error("Error performing intervention:", error);
      alert("Failed to perform intervention");
    } finally {
      setIsPerformingIntervention(false);
    }
  };

  // Open intervention dialog
  const openInterventionDialog = (
    session: ChatSession,
    action: InterventionAction["action"]
  ) => {
    setInterventionAction({
      action,
      chatRoomId: session.id,
      message: "",
      reason: "",
    });
    setSelectedSession(session);
    setInterventionDialog(true);
  };

  // Get status color
  const getStatusColor = (isActive: boolean, hasRecentActivity: boolean) => {
    if (!isActive) return "text-gray-500";
    if (hasRecentActivity) return "text-green-500";
    return "text-yellow-500";
  };

  // Get status badge
  const getStatusBadge = (isActive: boolean, hasRecentActivity: boolean) => {
    if (!isActive) return <Badge variant="secondary">Inactive</Badge>;
    if (hasRecentActivity)
      return (
        <Badge variant="default" className="bg-green-600">
          Active
        </Badge>
      );
    return <Badge variant="outline">Idle</Badge>;
  };

  // Format duration
  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const duration = end.getTime() - start.getTime();

    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (isLoading && !sessions.length) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading chat monitoring dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Chat Monitoring</h1>
          <p className="text-muted-foreground">
            Real-time monitoring and management of chat sessions
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? (
              <Activity className="h-4 w-4" />
            ) : (
              <Pause className="h-4 w-4" />
            )}
            {autoRefresh ? "Auto" : "Manual"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sessions">Active Sessions</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="interventions">Interventions</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Sessions
                </CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {sessions.filter((s) => s.isActive).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  {sessions.filter((s) => s.presence.hasRecentActivity).length}{" "}
                  with recent activity
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Messages
                </CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.totalMessages || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Last {timeframe}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Avg Response Time
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.averageResponseTime
                    ? `${Math.round(metrics.averageResponseTime / 1000)}s`
                    : "0s"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Between messages
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Error Rate
                </CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.errorRate ? `${metrics.errorRate}%` : "0%"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Connection errors
                </p>
              </CardContent>
            </Card>
          </div>

          {/* System Health Overview */}
          <Card>
            <CardHeader>
              <CardTitle>System Health Overview</CardTitle>
              <CardDescription>
                Real-time chat system performance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {metrics?.performance.realtimeLatency
                      ? `${metrics.performance.realtimeLatency}ms`
                      : "0ms"}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Realtime Latency
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {metrics?.performance.databaseResponseTime
                      ? `${metrics.performance.databaseResponseTime}ms`
                      : "0ms"}
                  </div>
                  <p className="text-sm text-muted-foreground">DB Response</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {metrics?.performance.memoryUsage
                      ? `${Math.round(
                          metrics.performance.memoryUsage / 1024 / 1024
                        )}MB`
                      : "0MB"}
                  </div>
                  <p className="text-sm text-muted-foreground">Memory Usage</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {metrics?.peakConcurrentUsers || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Peak Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Active Sessions Tab */}
        <TabsContent value="sessions" className="space-y-6">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by patient, doctor, or appointment..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sessions</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sessions List */}
          <div className="space-y-4">
            {filteredSessions.map((session) => (
              <Card key={session.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            session.isActive
                              ? session.presence.hasRecentActivity
                                ? "bg-green-500"
                                : "bg-yellow-500"
                              : "bg-gray-400"
                          }`}
                        />
                        {getStatusBadge(
                          session.isActive,
                          session.presence.hasRecentActivity
                        )}
                      </div>

                      <div>
                        <h3 className="font-semibold">
                          {session.patient.name} ↔ Dr.{" "}
                          {session.doctor.user.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {session.doctor.specialty} •{" "}
                          {session.appointment.type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Started:{" "}
                          {new Date(session.startedAt).toLocaleString()} •
                          Duration:{" "}
                          {formatDuration(session.startedAt, session.endedAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="flex items-center gap-2 text-sm">
                          <MessageSquare className="h-4 w-4" />
                          {session.messageCount}
                          {session.unreadCount > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {session.unreadCount} unread
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          {session.presence.activeUsers} active
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            openInterventionDialog(session, "send_message")
                          }
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>

                        {session.isActive ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              openInterventionDialog(session, "pause_chat")
                            }
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              openInterventionDialog(session, "resume_chat")
                            }
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            openInterventionDialog(session, "escalate")
                          }
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            openInterventionDialog(session, "end_chat")
                          }
                        >
                          <StopCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredSessions.length === 0 && (
              <Card>
                <CardContent className="p-12 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">
                    No chat sessions found
                  </h3>
                  <p className="text-muted-foreground">
                    {searchTerm
                      ? "Try adjusting your search criteria"
                      : "No active chat sessions at the moment"}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics" className="space-y-6">
          <div className="flex items-center gap-4">
            <Label>Timeframe:</Label>
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Message Volume
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {metrics?.totalMessages || 0}
                </div>
                <p className="text-sm text-muted-foreground">
                  Total messages in {timeframe}
                </p>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span>File uploads</span>
                    <span>{metrics?.fileUploads || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Load Time</span>
                  <span className="font-medium">
                    {metrics?.performance.averageLoadTime
                      ? `${metrics.performance.averageLoadTime}ms`
                      : "0ms"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">DB Response</span>
                  <span className="font-medium">
                    {metrics?.performance.databaseResponseTime
                      ? `${metrics.performance.databaseResponseTime}ms`
                      : "0ms"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Realtime Latency</span>
                  <span className="font-medium">
                    {metrics?.performance.realtimeLatency
                      ? `${metrics.performance.realtimeLatency}ms`
                      : "0ms"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Reliability
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Error Rate</span>
                  <span
                    className={`font-medium ${
                      (metrics?.errorRate || 0) > 5
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    {metrics?.errorRate ? `${metrics.errorRate}%` : "0%"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Peak Users</span>
                  <span className="font-medium">
                    {metrics?.peakConcurrentUsers || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Active Rooms</span>
                  <span className="font-medium">
                    {metrics?.activeRooms || 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Interventions Tab */}
        <TabsContent value="interventions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Emergency Intervention Tools</CardTitle>
              <CardDescription>
                Administrative tools for managing chat sessions and resolving
                issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>Admin Access Required</AlertTitle>
                <AlertDescription>
                  These tools allow direct intervention in chat sessions. Use
                  responsibly and document all actions.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Intervention Dialog */}
      <Dialog open={interventionDialog} onOpenChange={setInterventionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {interventionAction.action === "send_message" &&
                "Send Admin Message"}
              {interventionAction.action === "pause_chat" &&
                "Pause Chat Session"}
              {interventionAction.action === "resume_chat" &&
                "Resume Chat Session"}
              {interventionAction.action === "end_chat" && "End Chat Session"}
              {interventionAction.action === "escalate" &&
                "Escalate Chat Session"}
            </DialogTitle>
            <DialogDescription>
              {selectedSession && (
                <>
                  Session: {selectedSession.patient.name} ↔ Dr.{" "}
                  {selectedSession.doctor.user.name}
                  <br />
                  Appointment: {selectedSession.appointmentId}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {interventionAction.action === "send_message" && (
              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Enter admin message..."
                  value={interventionAction.message || ""}
                  onChange={(e) =>
                    setInterventionAction((prev) => ({
                      ...prev,
                      message: e.target.value,
                    }))
                  }
                />
              </div>
            )}

            <div>
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Input
                id="reason"
                placeholder="Reason for intervention..."
                value={interventionAction.reason || ""}
                onChange={(e) =>
                  setInterventionAction((prev) => ({
                    ...prev,
                    reason: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInterventionDialog(false)}
              disabled={isPerformingIntervention}
            >
              Cancel
            </Button>
            <Button
              onClick={performIntervention}
              disabled={
                isPerformingIntervention ||
                (interventionAction.action === "send_message" &&
                  !interventionAction.message)
              }
            >
              {isPerformingIntervention && (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              )}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
