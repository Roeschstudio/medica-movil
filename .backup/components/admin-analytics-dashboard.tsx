"use client";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  Download,
  FileText,
  LineChart,
  MessageSquare,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

interface AnalyticsData {
  overview: {
    totalSessions: number;
    totalMessages: number;
    totalUsers: number;
    averageSessionDuration: number;
    messageGrowth: number;
    userGrowth: number;
  };
  performance: {
    averageResponseTime: number;
    messageDeliveryRate: number;
    errorRate: number;
    uptime: number;
    peakConcurrentUsers: number;
    systemLatency: number;
  };
  usage: {
    dailyActiveUsers: number;
    messagesPerSession: number;
    fileUploadsPerSession: number;
    popularTimeSlots: Array<{ hour: number; count: number }>;
    topSpecialties: Array<{ specialty: string; sessions: number }>;
  };
  trends: {
    messageVolume: Array<{ date: string; count: number }>;
    userActivity: Array<{ date: string; users: number }>;
    errorRates: Array<{ date: string; rate: number }>;
    responseTime: Array<{ date: string; time: number }>;
  };
}

interface ReportConfig {
  type: "usage" | "performance" | "errors" | "custom";
  timeframe: "1h" | "24h" | "7d" | "30d" | "custom";
  startDate?: Date;
  endDate?: Date;
  includeCharts: boolean;
  includeDetails: boolean;
  format: "pdf" | "csv" | "json";
}

export default function AdminAnalyticsDashboard() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("24h");
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    type: "usage",
    timeframe: "24h",
    includeCharts: true,
    includeDetails: true,
    format: "pdf",
  });
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Fetch analytics data
  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      // Simulate API calls - in real implementation, these would be actual API endpoints
      const [
        overviewResponse,
        performanceResponse,
        usageResponse,
        trendsResponse,
      ] = await Promise.all([
        fetch(`/api/admin/analytics/overview?timeframe=${timeframe}`),
        fetch(`/api/admin/analytics/performance?timeframe=${timeframe}`),
        fetch(`/api/admin/analytics/usage?timeframe=${timeframe}`),
        fetch(`/api/admin/analytics/trends?timeframe=${timeframe}`),
      ]);

      // For now, we'll use mock data since the endpoints don't exist yet
      const mockData: AnalyticsData = {
        overview: {
          totalSessions: 1247,
          totalMessages: 8934,
          totalUsers: 456,
          averageSessionDuration: 18.5,
          messageGrowth: 12.3,
          userGrowth: 8.7,
        },
        performance: {
          averageResponseTime: 1250,
          messageDeliveryRate: 99.2,
          errorRate: 0.8,
          uptime: 99.9,
          peakConcurrentUsers: 89,
          systemLatency: 45,
        },
        usage: {
          dailyActiveUsers: 234,
          messagesPerSession: 7.2,
          fileUploadsPerSession: 1.4,
          popularTimeSlots: [
            { hour: 9, count: 45 },
            { hour: 10, count: 67 },
            { hour: 11, count: 89 },
            { hour: 14, count: 78 },
            { hour: 15, count: 92 },
            { hour: 16, count: 85 },
          ],
          topSpecialties: [
            { specialty: "Medicina General", sessions: 234 },
            { specialty: "Cardiología", sessions: 189 },
            { specialty: "Dermatología", sessions: 156 },
            { specialty: "Pediatría", sessions: 134 },
            { specialty: "Ginecología", sessions: 98 },
          ],
        },
        trends: {
          messageVolume: Array.from({ length: 30 }, (_, i) => ({
            date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0],
            count: Math.floor(Math.random() * 200) + 100,
          })),
          userActivity: Array.from({ length: 30 }, (_, i) => ({
            date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0],
            users: Math.floor(Math.random() * 50) + 20,
          })),
          errorRates: Array.from({ length: 30 }, (_, i) => ({
            date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0],
            rate: Math.random() * 2,
          })),
          responseTime: Array.from({ length: 30 }, (_, i) => ({
            date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0],
            time: Math.floor(Math.random() * 500) + 800,
          })),
        },
      };

      setAnalyticsData(mockData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate report
  const generateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const response = await fetch("/api/admin/analytics/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reportConfig),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `chat-analytics-report-${
          new Date().toISOString().split("T")[0]
        }.${reportConfig.format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Failed to generate report:", error);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeframe]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchAnalytics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [timeframe]);

  if (isLoading && !analyticsData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading analytics dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics & Reporting</h1>
          <p className="text-muted-foreground">
            Comprehensive chat system analytics and performance metrics
          </p>
        </div>

        <div className="flex items-center gap-4">
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

          <Button
            variant="outline"
            size="sm"
            onClick={fetchAnalytics}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>

          <Button onClick={generateReport} disabled={isGeneratingReport}>
            {isGeneratingReport && (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            )}
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="usage">Usage Patterns</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Sessions
                </CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analyticsData?.overview.totalSessions}
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3 mr-1 text-green-600" />+
                  {analyticsData?.overview.messageGrowth}% from last period
                </div>
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
                  {analyticsData?.overview.totalMessages}
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3 mr-1 text-green-600" />+
                  {analyticsData?.overview.messageGrowth}% from last period
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Users
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analyticsData?.usage.dailyActiveUsers}
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3 mr-1 text-green-600" />+
                  {analyticsData?.overview.userGrowth}% from last period
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Avg Session Duration
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analyticsData?.overview.averageSessionDuration}m
                </div>
                <p className="text-xs text-muted-foreground">
                  Average time per session
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Messages per Session
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analyticsData?.usage.messagesPerSession}
                </div>
                <p className="text-xs text-muted-foreground">
                  Average messages exchanged
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Peak Concurrent Users
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analyticsData?.performance.peakConcurrentUsers}
                </div>
                <p className="text-xs text-muted-foreground">
                  Maximum simultaneous users
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Top Specialties */}
          <Card>
            <CardHeader>
              <CardTitle>Most Active Specialties</CardTitle>
              <CardDescription>
                Chat sessions by medical specialty
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData?.usage.topSpecialties.map((specialty, index) => (
                  <div
                    key={specialty.specialty}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <span className="font-medium">{specialty.specialty}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{
                            width: `${
                              (specialty.sessions /
                                (analyticsData?.usage.topSpecialties[0]
                                  ?.sessions || 1)) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-12 text-right">
                        {specialty.sessions}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Response Time
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analyticsData?.performance.averageResponseTime}ms
                </div>
                <p className="text-xs text-muted-foreground">
                  Average message response time
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Delivery Rate
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analyticsData?.performance.messageDeliveryRate}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Successful message delivery
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
                  {analyticsData?.performance.errorRate}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Connection and delivery errors
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  System Uptime
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analyticsData?.performance.uptime}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Service availability
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  System Latency
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analyticsData?.performance.systemLatency}ms
                </div>
                <p className="text-xs text-muted-foreground">
                  Real-time connection latency
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Performance Charts Placeholder */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Response Time Trends</CardTitle>
                <CardDescription>
                  Average response time over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <LineChart className="h-12 w-12 mx-auto mb-4" />
                  <p>Response time chart would be rendered here</p>
                  <p className="text-sm">Showing trends over {timeframe}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Error Rate Analysis</CardTitle>
                <CardDescription>Error patterns and frequency</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                  <p>Error analysis chart would be rendered here</p>
                  <p className="text-sm">Error types and frequency</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Usage Patterns Tab */}
        <TabsContent value="usage" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Peak Usage Hours</CardTitle>
                <CardDescription>Chat activity by hour of day</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analyticsData?.usage.popularTimeSlots.map((slot) => (
                    <div
                      key={slot.hour}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm font-medium">
                        {slot.hour}:00 - {slot.hour + 1}:00
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{
                              width: `${
                                (slot.count /
                                  Math.max(
                                    ...(analyticsData?.usage.popularTimeSlots.map(
                                      (s) => s.count
                                    ) || [1])
                                  )) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-8 text-right">
                          {slot.count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Usage Statistics</CardTitle>
                <CardDescription>Key usage metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Daily Active Users</span>
                  <span className="font-medium">
                    {analyticsData?.usage.dailyActiveUsers}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Messages per Session</span>
                  <span className="font-medium">
                    {analyticsData?.usage.messagesPerSession}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Files per Session</span>
                  <span className="font-medium">
                    {analyticsData?.usage.fileUploadsPerSession}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Peak Concurrent Users</span>
                  <span className="font-medium">
                    {analyticsData?.performance.peakConcurrentUsers}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Message Volume Trends</CardTitle>
                <CardDescription>
                  Daily message volume over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <LineChart className="h-12 w-12 mx-auto mb-4" />
                  <p>Message volume trend chart would be rendered here</p>
                  <p className="text-sm">
                    Showing {analyticsData?.trends.messageVolume.length} days of
                    data
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User Activity Trends</CardTitle>
                <CardDescription>Daily active users over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                  <p>User activity trend chart would be rendered here</p>
                  <p className="text-sm">Daily active user patterns</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Generate Custom Report</CardTitle>
              <CardDescription>
                Create detailed reports for specific time periods and metrics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium">Report Type</label>
                  <Select
                    value={reportConfig.type}
                    onValueChange={(value: any) =>
                      setReportConfig((prev) => ({ ...prev, type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usage">Usage Report</SelectItem>
                      <SelectItem value="performance">
                        Performance Report
                      </SelectItem>
                      <SelectItem value="errors">Error Analysis</SelectItem>
                      <SelectItem value="custom">Custom Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Timeframe</label>
                  <Select
                    value={reportConfig.timeframe}
                    onValueChange={(value: any) =>
                      setReportConfig((prev) => ({ ...prev, timeframe: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1h">Last Hour</SelectItem>
                      <SelectItem value="24h">Last 24 Hours</SelectItem>
                      <SelectItem value="7d">Last 7 Days</SelectItem>
                      <SelectItem value="30d">Last 30 Days</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Format</label>
                  <Select
                    value={reportConfig.format}
                    onValueChange={(value: any) =>
                      setReportConfig((prev) => ({ ...prev, format: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF Report</SelectItem>
                      <SelectItem value="csv">CSV Data</SelectItem>
                      <SelectItem value="json">JSON Export</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button
                    onClick={generateReport}
                    disabled={isGeneratingReport}
                    className="w-full"
                  >
                    {isGeneratingReport && (
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    )}
                    <Download className="h-4 w-4 mr-2" />
                    Generate
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={reportConfig.includeCharts}
                    onChange={(e) =>
                      setReportConfig((prev) => ({
                        ...prev,
                        includeCharts: e.target.checked,
                      }))
                    }
                  />
                  Include Charts
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={reportConfig.includeDetails}
                    onChange={(e) =>
                      setReportConfig((prev) => ({
                        ...prev,
                        includeDetails: e.target.checked,
                      }))
                    }
                  />
                  Include Detailed Data
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Recent Reports */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Reports</CardTitle>
              <CardDescription>
                Previously generated analytics reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  {
                    name: "Weekly Usage Report",
                    date: "2024-12-09",
                    type: "usage",
                    size: "2.3 MB",
                  },
                  {
                    name: "Performance Analysis",
                    date: "2024-12-08",
                    type: "performance",
                    size: "1.8 MB",
                  },
                  {
                    name: "Error Analysis Report",
                    date: "2024-12-07",
                    type: "errors",
                    size: "945 KB",
                  },
                ].map((report, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{report.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {report.date} • {report.size}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{report.type}</Badge>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
