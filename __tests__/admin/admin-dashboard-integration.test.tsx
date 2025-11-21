import AdminDashboardClient from "@/app/admin/admin-dashboard-client";
import { AdminGuard } from "@/components/admin/admin-guard";
import { createClient } from "@/lib/supabase/client";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// Mock Supabase client
jest.mock("@/lib/supabase/client");
const mockSupabase = createClient as jest.MockedFunction<typeof createClient>;

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

// Mock toast
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock the monitoring components
jest.mock("@/components/admin/lazy-monitoring-tabs", () => ({
  LazyChatMonitoring: () => (
    <div data-testid="chat-monitoring">Chat Monitoring</div>
  ),
  LazyVideoCallAnalytics: () => (
    <div data-testid="video-analytics">Video Analytics</div>
  ),
  LazyPaymentDashboard: () => (
    <div data-testid="payment-dashboard">Payment Dashboard</div>
  ),
}));

// Mock the notification bell
jest.mock("@/components/admin/notification-bell", () => ({
  NotificationBell: () => (
    <div data-testid="notification-bell">Notification Bell</div>
  ),
}));

describe("Admin Dashboard Integration", () => {
  let mockClient: any;
  let mockChannel: any;

  beforeEach(() => {
    mockChannel = {
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    mockClient = {
      auth: {
        getSession: jest.fn(),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
      channel: jest.fn().mockReturnValue(mockChannel),
    };

    mockSupabase.mockReturnValue(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should render admin dashboard with all tabs when user is admin", async () => {
    // Mock admin session
    mockClient.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "admin-user-id" },
        },
      },
      error: null,
    });

    // Mock admin user
    mockClient.single.mockResolvedValue({
      data: { role: "ADMIN" },
      error: null,
    });

    // Mock dashboard stats
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          totalUsers: 100,
          totalDoctors: 20,
          totalPatients: 80,
          totalAppointments: 50,
          pendingAppointments: 10,
          completedAppointments: 40,
          totalRevenue: 10000,
          monthlyRevenue: 2000,
          averageRating: 4.5,
          totalReviews: 200,
        }),
    });

    render(
      <AdminGuard>
        <AdminDashboardClient />
      </AdminGuard>
    );

    await waitFor(() => {
      expect(screen.getByText("Dashboard Administrativo")).toBeInTheDocument();
    });

    // Check that all tabs are present
    expect(screen.getByText("Resumen")).toBeInTheDocument();
    expect(screen.getByText("Usuarios")).toBeInTheDocument();
    expect(screen.getByText("Citas")).toBeInTheDocument();
    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(screen.getByText("Video")).toBeInTheDocument();
    expect(screen.getByText("Pagos")).toBeInTheDocument();
    expect(screen.getByText("Reportes")).toBeInTheDocument();

    // Check notification bell is present
    expect(screen.getByTestId("notification-bell")).toBeInTheDocument();
  });

  it("should switch between monitoring tabs correctly", async () => {
    // Mock admin session
    mockClient.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "admin-user-id" },
        },
      },
      error: null,
    });

    mockClient.single.mockResolvedValue({
      data: { role: "ADMIN" },
      error: null,
    });

    // Mock dashboard stats
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          totalUsers: 100,
          totalDoctors: 20,
          totalPatients: 80,
          totalAppointments: 50,
          pendingAppointments: 10,
          completedAppointments: 40,
          totalRevenue: 10000,
          monthlyRevenue: 2000,
          averageRating: 4.5,
          totalReviews: 200,
        }),
    });

    render(
      <AdminGuard>
        <AdminDashboardClient />
      </AdminGuard>
    );

    await waitFor(() => {
      expect(screen.getByText("Dashboard Administrativo")).toBeInTheDocument();
    });

    // Test Chat tab
    fireEvent.click(screen.getByText("Chat"));
    await waitFor(() => {
      expect(screen.getByTestId("chat-monitoring")).toBeInTheDocument();
    });

    // Test Video tab
    fireEvent.click(screen.getByText("Video"));
    await waitFor(() => {
      expect(screen.getByTestId("video-analytics")).toBeInTheDocument();
    });

    // Test Payments tab
    fireEvent.click(screen.getByText("Pagos"));
    await waitFor(() => {
      expect(screen.getByTestId("payment-dashboard")).toBeInTheDocument();
    });
  });

  it("should show access denied for non-admin users", async () => {
    // Mock non-admin session
    mockClient.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "regular-user-id" },
        },
      },
      error: null,
    });

    // Mock non-admin user
    mockClient.single.mockResolvedValue({
      data: { role: "PATIENT" },
      error: null,
    });

    render(
      <AdminGuard>
        <AdminDashboardClient />
      </AdminGuard>
    );

    await waitFor(() => {
      expect(screen.getByText("Acceso denegado")).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        "No tienes permisos de administrador para acceder a esta página."
      )
    ).toBeInTheDocument();
  });

  it("should show loading state initially", () => {
    // Mock pending session
    mockClient.auth.getSession.mockImplementation(() => new Promise(() => {}));

    render(
      <AdminGuard>
        <AdminDashboardClient />
      </AdminGuard>
    );

    expect(screen.getByText("Verificando acceso")).toBeInTheDocument();
    expect(
      screen.getByText("Validando permisos de administrador...")
    ).toBeInTheDocument();
  });

  it("should handle authentication errors gracefully", async () => {
    // Mock authentication error
    mockClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: new Error("Authentication failed"),
    });

    render(
      <AdminGuard>
        <AdminDashboardClient />
      </AdminGuard>
    );

    await waitFor(() => {
      expect(screen.getByText("Error de acceso")).toBeInTheDocument();
    });

    expect(screen.getByText("Error de sesión")).toBeInTheDocument();
  });

  it("should display statistics correctly", async () => {
    // Mock admin session
    mockClient.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "admin-user-id" },
        },
      },
      error: null,
    });

    mockClient.single.mockResolvedValue({
      data: { role: "ADMIN" },
      error: null,
    });

    // Mock dashboard stats
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          totalUsers: 150,
          totalDoctors: 30,
          totalPatients: 120,
          totalAppointments: 75,
          pendingAppointments: 15,
          completedAppointments: 60,
          totalRevenue: 15000,
          monthlyRevenue: 3000,
          averageRating: 4.7,
          totalReviews: 300,
        }),
    });

    render(
      <AdminGuard>
        <AdminDashboardClient />
      </AdminGuard>
    );

    await waitFor(() => {
      expect(screen.getByText("150")).toBeInTheDocument(); // Total users
      expect(screen.getByText("75")).toBeInTheDocument(); // Total appointments
      expect(screen.getByText("4.7/5")).toBeInTheDocument(); // Average rating
    });
  });

  it("should handle dashboard stats loading error", async () => {
    // Mock admin session
    mockClient.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "admin-user-id" },
        },
      },
      error: null,
    });

    mockClient.single.mockResolvedValue({
      data: { role: "ADMIN" },
      error: null,
    });

    // Mock stats loading error
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    render(
      <AdminGuard>
        <AdminDashboardClient />
      </AdminGuard>
    );

    await waitFor(() => {
      expect(
        screen.getByText("Error al cargar estadísticas")
      ).toBeInTheDocument();
    });
  });
});
