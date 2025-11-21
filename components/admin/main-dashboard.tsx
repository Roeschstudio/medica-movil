"use client";

import AdminChatMonitoring from "@/components/admin-chat-monitoring";
import AdminAnalyticsDashboard from "@/components/admin-analytics-dashboard";
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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChatAnalytics } from "@/lib/analytics";
import { useHealthMonitor } from "@/lib/health-monitor";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Clock,
  Database,
  LineChart,
  MessageSquare,
  PieChart,
  RefreshCw,
  TrendingUp,
  Users,
  Video,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useState } from "react";

interface AdminStats {
  totalUsers: number;
  activeChats: number;
  activeCalls: number;
  totalRevenue: number;
  pendingPayments: number;
  onlineDoctors: number;
  onlinePatients: number;
  today: {
    newUsers: number;
    completedAppointments: number;
    totalMessages: number;
    revenue: number;
  };
  weekly: {
    newUsers: number;
    completedAppointments: number;
    revenue: number;
  };
  topSpecialties: Array<{
    specialty: string;
    appointmentCount: number;
  }>;
}

interface ChatMetrics {
  totalMessages: number;
  activeRooms: number;
  averageResponseTime: number;
  errorRate: number;
  peakConcurrentUsers: number;
}

interface PerformanceMetrics {
  averageLoadTime: number;
  memoryUsage: number;
  cpuUsage: number;
  databaseResponseTime: number;
  realtimeLatency: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [chatMetrics, setChatMetrics] = useState<ChatMetrics | null>(null);
  const [performanceMetrics, setPerformanceMetrics] =
    useState<PerformanceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { systemHealth, isHealthy, unhealthyServices, checkHealth } =
    useHealthMonitor();
  const { trackActivity } = useChatAnalytics();

  // Fetch admin statistics
  const fetchStats = async () => {
    try {
      const response = await fetch("/api/admin/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch admin stats:", error);
    }
  };

  // Fetch chat metrics
  const fetchChatMetrics = async () => {
    try {
      const response = await fetch("/api/admin/chat/metrics");
      if (response.ok) {
        const data = await response.json();
        setChatMetrics(data);
      }
    } catch (error) {
      console.error("Failed to fetch chat metrics:", error);
    }
  };

  // Fetch performance metrics
  const fetchPerformanceMetrics = async () => {
    try {
      const response = await fetch("/api/admin/performance");
      if (response.ok) {
        const data = await response.json();
        setPerformanceMetrics(data);
      }
    } catch (error) {
      console.error("Failed to fetch performance metrics:", error);
    }
  };

  // Refresh all data
  const refreshData = async () => {
    setIsLoading(true);
    await Promise.all([
      fetchStats(),
      fetchChatMetrics(),
      fetchPerformanceMetrics(),
      checkHealth(),
    ]);
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
  }, [autoRefresh]);

  // Track dashboard usage
  useEffect(() => {
    trackActivity("opened", "admin-dashboard", { section: "monitoring" });

    return () => {
      trackActivity("closed", "admin-dashboard", { section: "monitoring" });
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-green-600";
      case "degraded":
        return "text-yellow-600";
      case "unhealthy":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "degraded":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case "unhealthy":
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  if (isLoading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            System monitoring and analytics
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
              <Wifi className="h-4 w-4" />
            ) : (
              <WifiOff className="h-4 w-4" />
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

      {/* System Health Alert */}
      {!isHealthy && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>System Health Issues Detected</AlertTitle>
          <AlertDescription>
            The following services are experiencing issues:{" "}
            {unhealthyServices.join(", ")}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="health">System Health</TabsTrigger>
          <TabsTrigger value="chat">Chat Analytics</TabsTrigger>
          <TabsTrigger value="monitoring">Chat Monitoring</TabsTrigger>
          <TabsTrigger value="analytics">Analytics & Reports</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Users
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.totalUsers || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  +{stats?.today.newUsers || 0} today
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Chats
                </CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.activeChats || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats?.today.totalMessages || 0} messages today
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Calls
                </CardTitle>
                <Video className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.activeCalls || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Video consultations
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${((stats?.totalRevenue || 0) / 100).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  +${((stats?.today.revenue || 0) / 100).toFixed(2)} today
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Online Users */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Online Users</CardTitle>
                <CardDescription>Currently active users</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Doctors</span>
                  <Badge variant="secondary">{stats?.onlineDoctors || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Patients</span>
                  <Badge variant="secondary">
                    {stats?.onlinePatients || 0}
                  </Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between font-medium">
                  <span>Total Online</span>
                  <Badge>
                    {(stats?.onlineDoctors || 0) + (stats?.onlinePatients || 0)}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Specialties</CardTitle>
                <CardDescription>Most booked specialties</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats?.topSpecialties
                    ?.slice(0, 5)
                    .map((specialty, index) => (
                      <div
                        key={specialty.specialty}
                        className="flex items-center justify-between"
                      >
                        <span className="text-sm">{specialty.specialty}</span>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={
                              (specialty.appointmentCount /
                                (stats.topSpecialties[0]?.appointmentCount ||
                                  1)) *
                              100
                            }
                            className="w-20 h-2"
                          />
                          <span className="text-sm text-muted-foreground">
                            {specialty.appointmentCount}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* System Health Tab */}
        <TabsContent value="health" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {systemHealth?.services.map((service) => (
              <Card key={service.service}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium capitalize">
                    {service.service.replace("_", " ")}
                  </CardTitle>
                  {getStatusIcon(service.status)}
                </CardHeader>
                <CardContent>
                  <div
                    className={`text-lg font-semibold ${getStatusColor(
                      service.status
                    )}`}
                  >
                    {service.status.toUpperCase()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Response: {service.response_time}ms
                  </p>
                  {service.error_message && (
                    <p className="text-xs text-red-600 mt-1">
                      {service.error_message}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* System Health History */}
          <Card>
            <CardHeader>
              <CardTitle>System Health History</CardTitle>
              <CardDescription>
                Health status over the last 24 hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                <p>Health history chart would be implemented here</p>
                <p className="text-sm">
                  Showing uptime, response times, and error rates
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chat Monitoring Tab */}
        <TabsContent value="monitoring" className="space-y-6">
          <AdminChatMonitoring />
        </TabsContent>

        {/* Analytics & Reports Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <AdminAnalyticsDashboard />
        </TabsContent>

        {/* Chat Analytics Tab */}
        <TabsContent value="chat" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Messages
                </CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {chatMetrics?.totalMessages || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  All time messages
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Rooms
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {chatMetrics?.activeRooms || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Currently active
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
                  {chatMetrics?.averageResponseTime
                    ? `${Math.round(chatMetrics.averageResponseTime / 1000)}s`
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
                  {chatMetrics?.errorRate
                    ? `${(chatMetrics.errorRate * 100).toFixed(1)}%`
                    : "0%"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Connection errors
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Chat Usage Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Chat Usage Trends</CardTitle>
              <CardDescription>
                Message volume and user activity over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <LineChart className="h-12 w-12 mx-auto mb-4" />
                <p>Chat usage chart would be implemented here</p>
                <p className="text-sm">
                  Showing message volume, active users, and peak times
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Load Time</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {performanceMetrics?.averageLoadTime
                    ? `${performanceMetrics.averageLoadTime}ms`
                    : "0ms"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Average page load
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Memory Usage
                </CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {performanceMetrics?.memoryUsage
                    ? `${Math.round(
                        performanceMetrics.memoryUsage / 1024 / 1024
                      )}MB`
                    : "0MB"}
                </div>
                <p className="text-xs text-muted-foreground">Current usage</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  DB Response
                </CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {performanceMetrics?.databaseResponseTime
                    ? `${performanceMetrics.databaseResponseTime}ms`
                    : "0ms"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Query response time
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Realtime Latency
                </CardTitle>
                <Wifi className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {performanceMetrics?.realtimeLatency
                    ? `${performanceMetrics.realtimeLatency}ms`
                    : "0ms"}
                </div>
                <p className="text-xs text-muted-foreground">
                  WebSocket latency
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Performance Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Response Time Trends</CardTitle>
                <CardDescription>
                  API and database response times
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <LineChart className="h-12 w-12 mx-auto mb-4" />
                  <p>Response time chart would be implemented here</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resource Usage</CardTitle>
                <CardDescription>Memory and CPU utilization</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <PieChart className="h-12 w-12 mx-auto mb-4" />
                  <p>Resource usage chart would be implemented here</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          <MonitoringAlerts />
        </TabsContent>
      </Tabs>
    </div>
  );
}