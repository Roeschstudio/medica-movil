import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import AdminDashboard from "@/components/admin/main-dashboard";
import { useHealthMonitor } from "@/lib/health-monitor";
import { useChatAnalytics } from "@/lib/analytics";

// Mock the hooks
vi.mock("@/lib/health-monitor");
vi.mock("@/lib/analytics");

// Mock fetch
global.fetch = vi.fn();

const mockHealthMonitor = {
  systemHealth: {
    overall_status: "healthy",
    services: [
      {
        service: "database",
        status: "healthy",
        response_time: 150,
        timestamp: new Date().toISOString(),
      },
      {
        service: "realtime",
        status: "healthy",
        response_time: 200,
        timestamp: new Date().toISOString(),
      },
    ],
    last_updated: new Date().toISOString(),
  },
  isHealthy: true,
  unhealthyServices: [],
  checkHealth: vi.fn(),
};

const mockChatAnalytics = {
  trackActivity: vi.fn(),
  trackPerformance: vi.fn(),
  trackError: vi.fn(),
};

const mockStats = {
  totalUsers: 150,
  activeChats: 5,
  activeCalls: 2,
  totalRevenue: 50000,
  pendingPayments: 3,
  onlineDoctors: 12,
  onlinePatients: 25,
  today: {
    newUsers: 8,
    completedAppointments: 15,
    totalMessages: 45,
    revenue: 2500,
  },
  weekly: {
    newUsers: 35,
    completedAppointments: 78,
    revenue: 15000,
  },
  topSpecialties: [
    { specialty: "Cardiology", appointmentCount: 25 },
    { specialty: "Dermatology", appointmentCount: 20 },
    { specialty: "Pediatrics", appointmentCount: 18 },
  ],
};

describe("Admin Monitoring Dashboard", () => {
  beforeEach(() => {
    vi.mocked(useHealthMonitor).mockReturnValue(mockHealthMonitor);
    vi.mocked(useChatAnalytics).mockReturnValue(mockChatAnalytics);

    // Mock API responses
    vi.mocked(fetch).mockImplementation((url) => {
      if (url === "/api/admin/stats") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockStats),
        } as Response);
      }
      return Promise.reject(new Error("Unknown URL"));
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders admin dashboard with monitoring tabs", async () => {
    render(<AdminDashboard />);

    expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
    expect(
      screen.getByText("System monitoring and analytics")
    ).toBeInTheDocument();
  });

  it("tracks analytics events", async () => {
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(mockChatAnalytics.trackActivity).toHaveBeenCalledWith(
        "opened",
        "admin-dashboard",
        { section: "monitoring" }
      );
    });
  });

  it("handles API fetch errors gracefully", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

    render(<AdminDashboard />);

    expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
  });
});