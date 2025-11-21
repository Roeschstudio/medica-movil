/**
 * Admin Monitoring and Chat System Integration Tests
 *
 * Tests:
 * - Real-time admin dashboard monitoring
 * - Chat system health monitoring
 * - User activity tracking
 * - Emergency intervention capabilities
 * - System performance metrics
 */

import AdminAnalyticsDashboard from "@/components/admin-analytics-dashboard";
import AdminChatMonitoring from "@/components/admin-chat-monitoring";
import { NotificationProvider } from "@/lib/notification-service";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionProvider } from "next-auth/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/lib/supabase", () => ({
  createSupabaseBrowserClient: vi.fn(),
}));

vi.mock("@/lib/chat-service", () => ({
  createChatService: vi.fn(),
}));

vi.mock("@/lib/admin-analytics", () => ({
  getSystemMetrics: vi.fn(),
  getChatRoomAnalytics: vi.fn(),
  getUserActivityMetrics: vi.fn(),
  getPerformanceMetrics: vi.fn(),
}));

vi.mock("@/lib/notification-service", () => ({
  notificationService: {
    createSystemAlert: vi.fn(),
    getSystemAlerts: vi.fn(),
    resolveSystemAlert: vi.fn(),
  },
  NotificationProvider: ({ children }: any) => children,
}));

describe("Admin Monitoring Integration Tests", () => {
  let mockSupabase: any;
  let mockChatService: any;
  let mockAdminAnalytics: any;
  let mockAdminSession: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAdminSession = {
      user: {
        id: "admin-123",
        email: "admin@example.com",
        name: "Admin User",
        role: "ADMIN",
      },
    };

    // Mock Supabase client
    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockAdminSession.user },
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      })),
      removeChannel: vi.fn(),
    };

    // Mock ChatService
    mockChatService = {
      getActiveChatRooms: vi.fn(),
      getSystemHealth: vi.fn(),
      getConnectionMetrics: vi.fn(),
      subscribeToSystemEvents: vi.fn(),
      unsubscribeFromSystemEvents: vi.fn(),
      destroy: vi.fn(),
    };

    // Mock Admin Analytics
    mockAdminAnalytics = {
      getSystemMetrics: vi.fn(),
      getChatRoomAnalytics: vi.fn(),
      getUserActivityMetrics: vi.fn(),
      getPerformanceMetrics: vi.fn(),
    };

    const { createSupabaseBrowserClient } = require("@/lib/supabase");
    createSupabaseBrowserClient.mockReturnValue(mockSupabase);

    const { createChatService } = require("@/lib/chat-service");
    createChatService.mockReturnValue(mockChatService);

    const adminAnalytics = require("@/lib/admin-analytics");
    Object.assign(adminAnalytics, mockAdminAnalytics);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Real-time Admin Dashboard Monitoring", () => {
    it("should display real-time chat system overview", async () => {
      const mockSystemMetrics = {
        activeChatRooms: 15,
        totalUsers: 45,
        messagesPerMinute: 23,
        averageResponseTime: 2.3,
        systemHealth: "healthy",
        uptime: "99.9%",
        lastUpdated: new Date().toISOString(),
      };

      const mockActiveChatRooms = [
        {
          id: "room-1",
          appointmentId: "apt-1",
          patientName: "John Doe",
          doctorName: "Dr. Smith",
          startedAt: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
          messageCount: 12,
          lastActivity: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
          status: "active",
        },
        {
          id: "room-2",
          appointmentId: "apt-2",
          patientName: "Jane Smith",
          doctorName: "Dr. Johnson",
          startedAt: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
          messageCount: 8,
          lastActivity: new Date(Date.now() - 30000).toISOString(), // 30 seconds ago
          status: "active",
        },
      ];

      mockAdminAnalytics.getSystemMetrics.mockResolvedValue(mockSystemMetrics);
      mockChatService.getActiveChatRooms.mockResolvedValue(mockActiveChatRooms);

      let systemEventCallback: ((event: any) => void) | null = null;
      mockChatService.subscribeToSystemEvents.mockImplementation((callback) => {
        systemEventCallback = callback;
        return { unsubscribe: vi.fn() };
      });

      render(
        <SessionProvider session={mockAdminSession}>
          <NotificationProvider>
            <AdminChatMonitoring />
          </NotificationProvider>
        </SessionProvider>
      );

      // Should load system metrics
      await waitFor(() => {
        expect(mockAdminAnalytics.getSystemMetrics).toHaveBeenCalled();
        expect(mockChatService.getActiveChatRooms).toHaveBeenCalled();
      });

      // Should display system overview
      expect(screen.getByText("15")).toBeInTheDocument(); // Active chat rooms
      expect(screen.getByText("45")).toBeInTheDocument(); // Total users
      expect(screen.getByText("23")).toBeInTheDocument(); // Messages per minute
      expect(screen.getByText("2.3")).toBeInTheDocument(); // Average response time
      expect(screen.getByText("99.9%")).toBeInTheDocument(); // Uptime

      // Should display active chat rooms
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
      expect(screen.getByText("Dr. Johnson")).toBeInTheDocument();

      // Simulate real-time update
      if (systemEventCallback) {
        systemEventCallback({
          type: "CHAT_ROOM_CREATED",
          data: {
            id: "room-3",
            appointmentId: "apt-3",
            patientName: "Bob Wilson",
            doctorName: "Dr. Brown",
            startedAt: new Date().toISOString(),
          },
        });
      }

      // Should update active rooms count
      await waitFor(() => {
        expect(screen.getByText("Bob Wilson")).toBeInTheDocument();
      });
    });

    it("should monitor chat system health in real-time", async () => {
      const mockHealthMetrics = {
        systemStatus: "healthy",
        databaseConnections: {
          active: 8,
          idle: 2,
          total: 10,
          maxConnections: 20,
        },
        realtimeConnections: {
          active: 45,
          maxConcurrent: 100,
        },
        messageDeliveryRate: 99.8,
        averageLatency: 150,
        errorRate: 0.2,
        lastHealthCheck: new Date().toISOString(),
      };

      mockChatService.getSystemHealth.mockResolvedValue(mockHealthMetrics);

      let healthUpdateCallback: ((health: any) => void) | null = null;
      mockChatService.subscribeToSystemEvents.mockImplementation((callback) => {
        healthUpdateCallback = callback;
        return { unsubscribe: vi.fn() };
      });

      render(
        <SessionProvider session={mockAdminSession}>
          <NotificationProvider>
            <AdminChatMonitoring />
          </NotificationProvider>
        </SessionProvider>
      );

      await waitFor(() => {
        expect(mockChatService.getSystemHealth).toHaveBeenCalled();
      });

      // Should display health metrics
      expect(screen.getByText("healthy")).toBeInTheDocument();
      expect(screen.getByText("8")).toBeInTheDocument(); // Active DB connections
      expect(screen.getByText("45")).toBeInTheDocument(); // Active realtime connections
      expect(screen.getByText("99.8%")).toBeInTheDocument(); // Message delivery rate
      expect(screen.getByText("150ms")).toBeInTheDocument(); // Average latency
      expect(screen.getByText("0.2%")).toBeInTheDocument(); // Error rate

      // Simulate health degradation
      if (healthUpdateCallback) {
        healthUpdateCallback({
          type: "SYSTEM_HEALTH_UPDATE",
          data: {
            systemStatus: "degraded",
            errorRate: 2.5,
            averageLatency: 500,
            messageDeliveryRate: 95.2,
          },
        });
      }

      // Should update health status
      await waitFor(() => {
        expect(screen.getByText("degraded")).toBeInTheDocument();
        expect(screen.getByText("2.5%")).toBeInTheDocument();
        expect(screen.getByText("500ms")).toBeInTheDocument();
        expect(screen.getByText("95.2%")).toBeInTheDocument();
      });
    });
  });

  describe("User Activity Tracking", () => {
    it("should track and display user activity metrics", async () => {
      const mockUserActivity = {
        totalActiveUsers: 45,
        newUsersToday: 8,
        peakConcurrentUsers: 67,
        averageSessionDuration: "00:15:30",
        topActiveUsers: [
          {
            id: "user-1",
            name: "Dr. Smith",
            role: "DOCTOR",
            activeSessions: 3,
            totalMessages: 45,
            lastActivity: new Date(Date.now() - 300000).toISOString(),
          },
          {
            id: "user-2",
            name: "Dr. Johnson",
            role: "DOCTOR",
            activeSessions: 2,
            totalMessages: 32,
            lastActivity: new Date(Date.now() - 600000).toISOString(),
          },
        ],
        usersByRole: {
          DOCTOR: 15,
          PATIENT: 28,
          ADMIN: 2,
        },
      };

      mockAdminAnalytics.getUserActivityMetrics.mockResolvedValue(
        mockUserActivity
      );

      render(
        <SessionProvider session={mockAdminSession}>
          <NotificationProvider>
            <AdminAnalyticsDashboard />
          </NotificationProvider>
        </SessionProvider>
      );

      await waitFor(() => {
        expect(mockAdminAnalytics.getUserActivityMetrics).toHaveBeenCalled();
      });

      // Should display user activity metrics
      expect(screen.getByText("45")).toBeInTheDocument(); // Total active users
      expect(screen.getByText("8")).toBeInTheDocument(); // New users today
      expect(screen.getByText("67")).toBeInTheDocument(); // Peak concurrent users
      expect(screen.getByText("00:15:30")).toBeInTheDocument(); // Average session duration

      // Should display top active users
      expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
      expect(screen.getByText("Dr. Johnson")).toBeInTheDocument();
      expect(screen.getByText("45")).toBeInTheDocument(); // Dr. Smith's messages
      expect(screen.getByText("32")).toBeInTheDocument(); // Dr. Johnson's messages

      // Should display user distribution by role
      expect(screen.getByText("15")).toBeInTheDocument(); // Doctors
      expect(screen.getByText("28")).toBeInTheDocument(); // Patients
      expect(screen.getByText("2")).toBeInTheDocument(); // Admins
    });

    it("should track chat room analytics", async () => {
      const mockChatRoomAnalytics = {
        totalChatRooms: 156,
        activeChatRooms: 15,
        completedToday: 23,
        averageSessionDuration: "00:18:45",
        messagesPerSession: 28,
        mostActiveChatRooms: [
          {
            id: "room-1",
            appointmentId: "apt-1",
            patientName: "John Doe",
            doctorName: "Dr. Smith",
            messageCount: 67,
            duration: "00:45:30",
            status: "active",
          },
          {
            id: "room-2",
            appointmentId: "apt-2",
            patientName: "Jane Smith",
            doctorName: "Dr. Johnson",
            messageCount: 54,
            duration: "00:32:15",
            status: "completed",
          },
        ],
        peakHours: [
          { hour: "09:00", count: 12 },
          { hour: "14:00", count: 18 },
          { hour: "16:00", count: 15 },
        ],
      };

      mockAdminAnalytics.getChatRoomAnalytics.mockResolvedValue(
        mockChatRoomAnalytics
      );

      render(
        <SessionProvider session={mockAdminSession}>
          <NotificationProvider>
            <AdminAnalyticsDashboard />
          </NotificationProvider>
        </SessionProvider>
      );

      await waitFor(() => {
        expect(mockAdminAnalytics.getChatRoomAnalytics).toHaveBeenCalled();
      });

      // Should display chat room analytics
      expect(screen.getByText("156")).toBeInTheDocument(); // Total chat rooms
      expect(screen.getByText("15")).toBeInTheDocument(); // Active chat rooms
      expect(screen.getByText("23")).toBeInTheDocument(); // Completed today
      expect(screen.getByText("00:18:45")).toBeInTheDocument(); // Average duration
      expect(screen.getByText("28")).toBeInTheDocument(); // Messages per session

      // Should display most active chat rooms
      expect(screen.getByText("67")).toBeInTheDocument(); // Message count for room 1
      expect(screen.getByText("54")).toBeInTheDocument(); // Message count for room 2
      expect(screen.getByText("00:45:30")).toBeInTheDocument(); // Duration for room 1

      // Should display peak hours
      expect(screen.getByText("09:00")).toBeInTheDocument();
      expect(screen.getByText("14:00")).toBeInTheDocument();
      expect(screen.getByText("16:00")).toBeInTheDocument();
    });
  });

  describe("Emergency Intervention Capabilities", () => {
    it("should allow admin to intervene in chat sessions", async () => {
      const mockActiveChatRooms = [
        {
          id: "room-1",
          appointmentId: "apt-1",
          patientName: "John Doe",
          doctorName: "Dr. Smith",
          startedAt: new Date(Date.now() - 1800000).toISOString(),
          messageCount: 12,
          lastActivity: new Date(Date.now() - 60000).toISOString(),
          status: "active",
          flags: ["URGENT", "TECHNICAL_ISSUE"],
        },
      ];

      mockChatService.getActiveChatRooms.mockResolvedValue(mockActiveChatRooms);
      mockChatService.sendSystemMessage = vi.fn().mockResolvedValue(true);
      mockChatService.escalateToAdmin = vi.fn().mockResolvedValue(true);

      const user = userEvent.setup();

      render(
        <SessionProvider session={mockAdminSession}>
          <NotificationProvider>
            <AdminChatMonitoring />
          </NotificationProvider>
        </SessionProvider>
      );

      await waitFor(() => {
        expect(mockChatService.getActiveChatRooms).toHaveBeenCalled();
      });

      // Should show flagged chat room
      expect(screen.getByText("URGENT")).toBeInTheDocument();
      expect(screen.getByText("TECHNICAL_ISSUE")).toBeInTheDocument();

      // Should have intervention options
      const interventionButton = screen.getByRole("button", {
        name: /intervene|join.*chat/i,
      });
      expect(interventionButton).toBeInTheDocument();

      // Click to intervene
      await user.click(interventionButton);

      // Should show intervention modal/options
      await waitFor(() => {
        expect(
          screen.getByText(/intervention.*options|admin.*actions/i)
        ).toBeInTheDocument();
      });

      // Should have options to send system message
      const sendMessageButton = screen.getByRole("button", {
        name: /send.*system.*message/i,
      });
      await user.click(sendMessageButton);

      // Should show message input
      const messageInput = screen.getByRole("textbox", {
        name: /system.*message/i,
      });
      await user.type(
        messageInput,
        "Admin is monitoring this session to assist with technical issues."
      );

      const sendButton = screen.getByRole("button", { name: /send/i });
      await user.click(sendButton);

      // Should send system message
      expect(mockChatService.sendSystemMessage).toHaveBeenCalledWith(
        "room-1",
        "Admin is monitoring this session to assist with technical issues.",
        "admin-123"
      );
    });

    it("should handle emergency chat room closure", async () => {
      const mockActiveChatRooms = [
        {
          id: "room-emergency",
          appointmentId: "apt-emergency",
          patientName: "Emergency Patient",
          doctorName: "Dr. Emergency",
          startedAt: new Date(Date.now() - 3600000).toISOString(),
          messageCount: 45,
          lastActivity: new Date(Date.now() - 60000).toISOString(),
          status: "active",
          flags: ["EMERGENCY", "INAPPROPRIATE_CONTENT"],
        },
      ];

      mockChatService.getActiveChatRooms.mockResolvedValue(mockActiveChatRooms);
      mockChatService.emergencyCloseChatRoom = vi.fn().mockResolvedValue(true);

      const user = userEvent.setup();

      render(
        <SessionProvider session={mockAdminSession}>
          <NotificationProvider>
            <AdminChatMonitoring />
          </NotificationProvider>
        </SessionProvider>
      );

      await waitFor(() => {
        expect(mockChatService.getActiveChatRooms).toHaveBeenCalled();
      });

      // Should show emergency flags
      expect(screen.getByText("EMERGENCY")).toBeInTheDocument();
      expect(screen.getByText("INAPPROPRIATE_CONTENT")).toBeInTheDocument();

      // Should have emergency closure option
      const emergencyCloseButton = screen.getByRole("button", {
        name: /emergency.*close|force.*close/i,
      });
      expect(emergencyCloseButton).toBeInTheDocument();

      // Click emergency close
      await user.click(emergencyCloseButton);

      // Should show confirmation dialog
      await waitFor(() => {
        expect(
          screen.getByText(/confirm.*emergency.*closure/i)
        ).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole("button", {
        name: /confirm.*close/i,
      });
      await user.click(confirmButton);

      // Should close chat room
      expect(mockChatService.emergencyCloseChatRoom).toHaveBeenCalledWith(
        "room-emergency",
        "admin-123",
        "Emergency closure due to inappropriate content"
      );
    });
  });

  describe("System Performance Metrics", () => {
    it("should display real-time performance metrics", async () => {
      const mockPerformanceMetrics = {
        cpuUsage: 45.2,
        memoryUsage: 67.8,
        diskUsage: 23.4,
        networkLatency: 125,
        databaseResponseTime: 89,
        realtimeConnectionLatency: 45,
        messageDeliveryLatency: 67,
        errorRates: {
          chatService: 0.1,
          database: 0.05,
          realtime: 0.2,
          fileUpload: 0.3,
        },
        throughput: {
          messagesPerSecond: 15.6,
          fileUploadsPerMinute: 8.2,
          apiRequestsPerMinute: 234,
        },
        lastUpdated: new Date().toISOString(),
      };

      mockAdminAnalytics.getPerformanceMetrics.mockResolvedValue(
        mockPerformanceMetrics
      );

      render(
        <SessionProvider session={mockAdminSession}>
          <NotificationProvider>
            <AdminAnalyticsDashboard />
          </NotificationProvider>
        </SessionProvider>
      );

      await waitFor(() => {
        expect(mockAdminAnalytics.getPerformanceMetrics).toHaveBeenCalled();
      });

      // Should display system resource usage
      expect(screen.getByText("45.2%")).toBeInTheDocument(); // CPU usage
      expect(screen.getByText("67.8%")).toBeInTheDocument(); // Memory usage
      expect(screen.getByText("23.4%")).toBeInTheDocument(); // Disk usage

      // Should display latency metrics
      expect(screen.getByText("125ms")).toBeInTheDocument(); // Network latency
      expect(screen.getByText("89ms")).toBeInTheDocument(); // Database response time
      expect(screen.getByText("45ms")).toBeInTheDocument(); // Realtime latency
      expect(screen.getByText("67ms")).toBeInTheDocument(); // Message delivery latency

      // Should display error rates
      expect(screen.getByText("0.1%")).toBeInTheDocument(); // Chat service error rate
      expect(screen.getByText("0.05%")).toBeInTheDocument(); // Database error rate
      expect(screen.getByText("0.2%")).toBeInTheDocument(); // Realtime error rate
      expect(screen.getByText("0.3%")).toBeInTheDocument(); // File upload error rate

      // Should display throughput metrics
      expect(screen.getByText("15.6")).toBeInTheDocument(); // Messages per second
      expect(screen.getByText("8.2")).toBeInTheDocument(); // File uploads per minute
      expect(screen.getByText("234")).toBeInTheDocument(); // API requests per minute
    });

    it("should alert on performance threshold breaches", async () => {
      const mockPerformanceMetrics = {
        cpuUsage: 85.5, // High CPU usage
        memoryUsage: 92.3, // High memory usage
        networkLatency: 2500, // High latency
        errorRates: {
          chatService: 5.2, // High error rate
        },
      };

      mockAdminAnalytics.getPerformanceMetrics.mockResolvedValue(
        mockPerformanceMetrics
      );

      const { notificationService } = require("@/lib/notification-service");

      render(
        <SessionProvider session={mockAdminSession}>
          <NotificationProvider>
            <AdminAnalyticsDashboard />
          </NotificationProvider>
        </SessionProvider>
      );

      await waitFor(() => {
        expect(mockAdminAnalytics.getPerformanceMetrics).toHaveBeenCalled();
      });

      // Should display high usage warnings
      expect(screen.getByText("85.5%")).toBeInTheDocument();
      expect(screen.getByText("92.3%")).toBeInTheDocument();
      expect(screen.getByText("2500ms")).toBeInTheDocument();
      expect(screen.getByText("5.2%")).toBeInTheDocument();

      // Should show warning indicators
      expect(screen.getByText(/high.*cpu|cpu.*warning/i)).toBeInTheDocument();
      expect(
        screen.getByText(/high.*memory|memory.*warning/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/high.*latency|latency.*warning/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/high.*error.*rate/i)).toBeInTheDocument();

      // Should create system alerts
      await waitFor(() => {
        expect(notificationService.createSystemAlert).toHaveBeenCalledWith({
          type: "PERFORMANCE_WARNING",
          severity: "HIGH",
          message: expect.stringContaining("CPU usage"),
          metrics: expect.objectContaining({
            cpuUsage: 85.5,
          }),
        });
      });
    });
  });

  describe("System Alert Management", () => {
    it("should display and manage system alerts", async () => {
      const mockSystemAlerts = [
        {
          id: "alert-1",
          type: "PERFORMANCE_WARNING",
          severity: "HIGH",
          message: "High CPU usage detected: 85.5%",
          createdAt: new Date(Date.now() - 300000).toISOString(),
          isResolved: false,
          metadata: {
            cpuUsage: 85.5,
            threshold: 80,
          },
        },
        {
          id: "alert-2",
          type: "CHAT_ROOM_ERROR",
          severity: "MEDIUM",
          message: "Multiple connection failures in room-123",
          createdAt: new Date(Date.now() - 600000).toISOString(),
          isResolved: false,
          metadata: {
            roomId: "room-123",
            errorCount: 5,
          },
        },
      ];

      const { notificationService } = require("@/lib/notification-service");
      notificationService.getSystemAlerts.mockResolvedValue(mockSystemAlerts);

      const user = userEvent.setup();

      render(
        <SessionProvider session={mockAdminSession}>
          <NotificationProvider>
            <AdminChatMonitoring />
          </NotificationProvider>
        </SessionProvider>
      );

      await waitFor(() => {
        expect(notificationService.getSystemAlerts).toHaveBeenCalled();
      });

      // Should display system alerts
      expect(
        screen.getByText("High CPU usage detected: 85.5%")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Multiple connection failures in room-123")
      ).toBeInTheDocument();

      // Should show severity indicators
      expect(screen.getByText("HIGH")).toBeInTheDocument();
      expect(screen.getByText("MEDIUM")).toBeInTheDocument();

      // Should have resolve options
      const resolveButtons = screen.getAllByRole("button", {
        name: /resolve.*alert/i,
      });
      expect(resolveButtons).toHaveLength(2);

      // Resolve first alert
      await user.click(resolveButtons[0]);

      // Should mark alert as resolved
      expect(notificationService.resolveSystemAlert).toHaveBeenCalledWith(
        "alert-1",
        "admin-123"
      );
    });
  });
});
