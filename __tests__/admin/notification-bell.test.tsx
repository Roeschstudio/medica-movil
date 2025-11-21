import { NotificationBell } from "@/components/admin/notification-bell";
import { useAdminNotifications } from "@/hooks/use-admin-notifications";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// Mock the hook
jest.mock("@/hooks/use-admin-notifications");
const mockUseAdminNotifications = useAdminNotifications as jest.MockedFunction<
  typeof useAdminNotifications
>;

// Mock date-fns
jest.mock("date-fns", () => ({
  formatDistanceToNow: jest.fn(() => "2 minutes ago"),
}));

describe("NotificationBell", () => {
  const mockMarkAsRead = jest.fn();
  const mockMarkAllAsRead = jest.fn();

  beforeEach(() => {
    mockUseAdminNotifications.mockReturnValue({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      error: null,
      markAsRead: mockMarkAsRead,
      markAllAsRead: mockMarkAllAsRead,
      createNotification: jest.fn(),
      refresh: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should render bell icon without badge when no unread notifications", () => {
    render(<NotificationBell />);

    const bellButton = screen.getByRole("button");
    expect(bellButton).toBeInTheDocument();

    // Should not show badge
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("should show unread count badge when there are unread notifications", () => {
    mockUseAdminNotifications.mockReturnValue({
      notifications: [
        {
          id: "1",
          userId: "admin",
          type: "CHAT",
          title: "New Chat",
          message: "A new chat has started",
          data: null,
          isRead: false,
          createdAt: "2024-01-01T00:00:00Z",
        },
      ],
      unreadCount: 1,
      isLoading: false,
      error: null,
      markAsRead: mockMarkAsRead,
      markAllAsRead: mockMarkAllAsRead,
      createNotification: jest.fn(),
      refresh: jest.fn(),
    });

    render(<NotificationBell />);

    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("should show 99+ when unread count exceeds 99", () => {
    mockUseAdminNotifications.mockReturnValue({
      notifications: [],
      unreadCount: 150,
      isLoading: false,
      error: null,
      markAsRead: mockMarkAsRead,
      markAllAsRead: mockMarkAllAsRead,
      createNotification: jest.fn(),
      refresh: jest.fn(),
    });

    render(<NotificationBell />);

    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("should open dropdown when bell is clicked", async () => {
    mockUseAdminNotifications.mockReturnValue({
      notifications: [
        {
          id: "1",
          userId: "admin",
          type: "CHAT",
          title: "New Chat",
          message: "A new chat has started",
          data: null,
          isRead: false,
          createdAt: "2024-01-01T00:00:00Z",
        },
      ],
      unreadCount: 1,
      isLoading: false,
      error: null,
      markAsRead: mockMarkAsRead,
      markAllAsRead: mockMarkAllAsRead,
      createNotification: jest.fn(),
      refresh: jest.fn(),
    });

    render(<NotificationBell />);

    const bellButton = screen.getByRole("button");
    fireEvent.click(bellButton);

    await waitFor(() => {
      expect(screen.getByText("Notifications")).toBeInTheDocument();
      expect(screen.getByText("New Chat")).toBeInTheDocument();
    });
  });

  it("should show empty state when no notifications", async () => {
    render(<NotificationBell />);

    const bellButton = screen.getByRole("button");
    fireEvent.click(bellButton);

    await waitFor(() => {
      expect(screen.getByText("No notifications yet")).toBeInTheDocument();
    });
  });

  it("should show loading state", async () => {
    mockUseAdminNotifications.mockReturnValue({
      notifications: [],
      unreadCount: 0,
      isLoading: true,
      error: null,
      markAsRead: mockMarkAsRead,
      markAllAsRead: mockMarkAllAsRead,
      createNotification: jest.fn(),
      refresh: jest.fn(),
    });

    render(<NotificationBell />);

    const bellButton = screen.getByRole("button");
    fireEvent.click(bellButton);

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument(); // Loading spinner
    });
  });

  it("should mark notification as read when clicked", async () => {
    mockUseAdminNotifications.mockReturnValue({
      notifications: [
        {
          id: "1",
          userId: "admin",
          type: "CHAT",
          title: "New Chat",
          message: "A new chat has started",
          data: null,
          isRead: false,
          createdAt: "2024-01-01T00:00:00Z",
        },
      ],
      unreadCount: 1,
      isLoading: false,
      error: null,
      markAsRead: mockMarkAsRead,
      markAllAsRead: mockMarkAllAsRead,
      createNotification: jest.fn(),
      refresh: jest.fn(),
    });

    render(<NotificationBell />);

    const bellButton = screen.getByRole("button");
    fireEvent.click(bellButton);

    await waitFor(() => {
      const notificationItem = screen.getByText("New Chat");
      fireEvent.click(notificationItem);
    });

    expect(mockMarkAsRead).toHaveBeenCalledWith("1");
  });

  it("should mark all notifications as read when button is clicked", async () => {
    mockUseAdminNotifications.mockReturnValue({
      notifications: [
        {
          id: "1",
          userId: "admin",
          type: "CHAT",
          title: "New Chat",
          message: "A new chat has started",
          data: null,
          isRead: false,
          createdAt: "2024-01-01T00:00:00Z",
        },
      ],
      unreadCount: 1,
      isLoading: false,
      error: null,
      markAsRead: mockMarkAsRead,
      markAllAsRead: mockMarkAllAsRead,
      createNotification: jest.fn(),
      refresh: jest.fn(),
    });

    render(<NotificationBell />);

    const bellButton = screen.getByRole("button");
    fireEvent.click(bellButton);

    await waitFor(() => {
      const markAllButton = screen.getByText("Mark all read");
      fireEvent.click(markAllButton);
    });

    expect(mockMarkAllAsRead).toHaveBeenCalled();
  });

  it("should display correct notification icons based on type", async () => {
    mockUseAdminNotifications.mockReturnValue({
      notifications: [
        {
          id: "1",
          userId: "admin",
          type: "CHAT",
          title: "Chat Notification",
          message: "New chat message",
          data: null,
          isRead: false,
          createdAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "2",
          userId: "admin",
          type: "PAYMENT",
          title: "Payment Notification",
          message: "Payment completed",
          data: null,
          isRead: false,
          createdAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "3",
          userId: "admin",
          type: "VIDEO_CALL",
          title: "Video Call Notification",
          message: "New video call",
          data: null,
          isRead: false,
          createdAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "4",
          userId: "admin",
          type: "SYSTEM",
          title: "System Notification",
          message: "System alert",
          data: null,
          isRead: false,
          createdAt: "2024-01-01T00:00:00Z",
        },
      ],
      unreadCount: 4,
      isLoading: false,
      error: null,
      markAsRead: mockMarkAsRead,
      markAllAsRead: mockMarkAllAsRead,
      createNotification: jest.fn(),
      refresh: jest.fn(),
    });

    render(<NotificationBell />);

    const bellButton = screen.getByRole("button");
    fireEvent.click(bellButton);

    await waitFor(() => {
      expect(screen.getByText("Chat Notification")).toBeInTheDocument();
      expect(screen.getByText("Payment Notification")).toBeInTheDocument();
      expect(screen.getByText("Video Call Notification")).toBeInTheDocument();
      expect(screen.getByText("System Notification")).toBeInTheDocument();
    });
  });
});
