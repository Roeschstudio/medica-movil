import { useAdminNotifications } from "@/hooks/use-admin-notifications";
import { createClient } from "@/lib/supabase/client";
import { act, renderHook, waitFor } from "@testing-library/react";

// Mock Supabase client
jest.mock("@/lib/supabase/client");
const mockSupabase = createClient as jest.MockedFunction<typeof createClient>;

// Mock toast
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe("useAdminNotifications", () => {
  let mockClient: any;
  let mockChannel: any;

  beforeEach(() => {
    mockChannel = {
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    mockClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      single: jest.fn(),
      channel: jest.fn().mockReturnValue(mockChannel),
    };

    mockSupabase.mockReturnValue(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should initialize with loading state", () => {
    const { result } = renderHook(() => useAdminNotifications());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it("should load notifications on mount", async () => {
    const mockNotifications = [
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
      {
        id: "2",
        userId: "admin",
        type: "PAYMENT",
        title: "Payment Completed",
        message: "Payment of $100 completed",
        data: null,
        isRead: true,
        createdAt: "2024-01-01T01:00:00Z",
      },
    ];

    mockClient.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({
        data: mockNotifications,
        error: null,
      }),
    });

    const { result } = renderHook(() => useAdminNotifications());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.notifications).toEqual(mockNotifications);
    expect(result.current.unreadCount).toBe(1);
  });

  it("should handle loading error", async () => {
    const mockError = new Error("Database error");

    mockClient.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({
        data: null,
        error: mockError,
      }),
    });

    const { result } = renderHook(() => useAdminNotifications());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Database error");
    expect(result.current.notifications).toEqual([]);
  });

  it("should mark notification as read", async () => {
    const mockNotifications = [
      {
        id: "1",
        userId: "admin",
        type: "CHAT" as const,
        title: "New Chat",
        message: "A new chat has started",
        data: null,
        isRead: false,
        createdAt: "2024-01-01T00:00:00Z",
      },
    ];

    // Mock initial load
    mockClient.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({
        data: mockNotifications,
        error: null,
      }),
      update: jest.fn().mockReturnThis(),
    });

    const { result } = renderHook(() => useAdminNotifications());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Mock update operation
    mockClient.from.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    });

    await act(async () => {
      await result.current.markAsRead("1");
    });

    expect(result.current.notifications[0].isRead).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  it("should mark all notifications as read", async () => {
    const mockNotifications = [
      {
        id: "1",
        userId: "admin",
        type: "CHAT" as const,
        title: "New Chat 1",
        message: "A new chat has started",
        data: null,
        isRead: false,
        createdAt: "2024-01-01T00:00:00Z",
      },
      {
        id: "2",
        userId: "admin",
        type: "PAYMENT" as const,
        title: "Payment Completed",
        message: "Payment completed",
        data: null,
        isRead: false,
        createdAt: "2024-01-01T01:00:00Z",
      },
    ];

    // Mock initial load
    mockClient.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({
        data: mockNotifications,
        error: null,
      }),
    });

    const { result } = renderHook(() => useAdminNotifications());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Mock update operation
    mockClient.from.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    });

    mockClient.from().update().eq().eq.mockResolvedValue({
      data: null,
      error: null,
    });

    await act(async () => {
      await result.current.markAllAsRead();
    });

    expect(result.current.notifications.every((n) => n.isRead)).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  it("should create new notification", async () => {
    // Mock initial empty state
    mockClient.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    });

    const { result } = renderHook(() => useAdminNotifications());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const newNotification = {
      id: "1",
      userId: "admin",
      type: "SYSTEM" as const,
      title: "System Alert",
      message: "System maintenance scheduled",
      data: null,
      isRead: false,
      createdAt: "2024-01-01T00:00:00Z",
    };

    // Mock insert operation
    mockClient.from.mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: newNotification,
        error: null,
      }),
    });

    let createdNotification: any;
    await act(async () => {
      createdNotification = await result.current.createNotification(
        "SYSTEM",
        "System Alert",
        "System maintenance scheduled"
      );
    });

    expect(createdNotification).toEqual(newNotification);
  });

  it("should set up real-time subscriptions", () => {
    renderHook(() => useAdminNotifications());

    expect(mockClient.channel).toHaveBeenCalledWith("admin-notifications");
    expect(mockChannel.on).toHaveBeenCalledTimes(6); // 2 for notifications + 4 for other tables
    expect(mockChannel.subscribe).toHaveBeenCalled();
  });

  it("should cleanup subscriptions on unmount", () => {
    const { unmount } = renderHook(() => useAdminNotifications());

    unmount();

    expect(mockChannel.unsubscribe).toHaveBeenCalledTimes(4); // 4 channels
  });
});
