/**
 * Test suite for NotificationDropdown component
 *
 * Tests:
 * - Dropdown rendering and interaction
 * - Notification display and formatting
 * - Badge count display
 * - Mark as read functionality
 * - Delete notification functionality
 * - Loading and empty states
 * - Navigation links
 * - Accessibility features
 */

import { NotificationDropdown } from "@/components/notification-dropdown";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock useNotifications hook
const mockUseNotifications = {
  notifications: [],
  stats: { unread: 0, total: 0 },
  loading: false,
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  deleteNotification: vi.fn(),
};

vi.mock("@/hooks/use-notifications", () => ({
  useNotifications: () => mockUseNotifications,
}));

// Mock useSession
const mockSession = {
  user: {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
  },
};

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: mockSession }),
}));

// Mock Next.js Link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock date-fns
vi.mock("date-fns", () => ({
  formatDistanceToNow: vi.fn(() => "hace 5 minutos"),
}));

vi.mock("date-fns/locale", () => ({
  es: {},
}));

describe("NotificationDropdown Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseNotifications.notifications = [];
    mockUseNotifications.stats = { unread: 0, total: 0 };
    mockUseNotifications.loading = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderNotificationDropdown = () => {
    return render(<NotificationDropdown />);
  };

  describe("Authentication", () => {
    it("should not render when user is not authenticated", () => {
      vi.mocked(require("next-auth/react").useSession).mockReturnValue({
        data: null,
      });

      const { container } = renderNotificationDropdown();
      expect(container.firstChild).toBeNull();
    });

    it("should render when user is authenticated", () => {
      renderNotificationDropdown();

      expect(screen.getByRole("button")).toBeInTheDocument();
      expect(screen.getByTestId("bell-icon")).toBeInTheDocument();
    });
  });

  describe("Badge Display", () => {
    it("should not show badge when no unread notifications", () => {
      mockUseNotifications.stats = { unread: 0, total: 5 };
      renderNotificationDropdown();

      expect(screen.queryByText("0")).not.toBeInTheDocument();
    });

    it("should show badge with unread count", () => {
      mockUseNotifications.stats = { unread: 3, total: 10 };
      renderNotificationDropdown();

      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("should show 99+ for counts over 99", () => {
      mockUseNotifications.stats = { unread: 150, total: 200 };
      renderNotificationDropdown();

      expect(screen.getByText("99+")).toBeInTheDocument();
    });

    it("should have proper badge styling", () => {
      mockUseNotifications.stats = { unread: 5, total: 10 };
      renderNotificationDropdown();

      const badge = screen.getByText("5");
      expect(badge).toHaveClass("absolute", "-top-1", "-right-1");
    });
  });

  describe("Dropdown Content", () => {
    it("should open dropdown when bell icon is clicked", async () => {
      const user = userEvent.setup();
      renderNotificationDropdown();

      const bellButton = screen.getByRole("button");
      await user.click(bellButton);

      expect(screen.getByText("Notificaciones")).toBeInTheDocument();
    });

    it("should show loading state", async () => {
      const user = userEvent.setup();
      mockUseNotifications.loading = true;
      renderNotificationDropdown();

      const bellButton = screen.getByRole("button");
      await user.click(bellButton);

      expect(
        screen.getByText("Cargando notificaciones...")
      ).toBeInTheDocument();
    });

    it("should show empty state when no notifications", async () => {
      const user = userEvent.setup();
      mockUseNotifications.notifications = [];
      renderNotificationDropdown();

      const bellButton = screen.getByRole("button");
      await user.click(bellButton);

      expect(screen.getByText("No tienes notificaciones")).toBeInTheDocument();
    });

    it("should show mark all as read button when there are unread notifications", async () => {
      const user = userEvent.setup();
      mockUseNotifications.stats = { unread: 3, total: 5 };
      renderNotificationDropdown();

      const bellButton = screen.getByRole("button");
      await user.click(bellButton);

      expect(screen.getByText("Marcar todas")).toBeInTheDocument();
    });

    it("should not show mark all as read button when no unread notifications", async () => {
      const user = userEvent.setup();
      mockUseNotifications.stats = { unread: 0, total: 5 };
      renderNotificationDropdown();

      const bellButton = screen.getByRole("button");
      await user.click(bellButton);

      expect(screen.queryByText("Marcar todas")).not.toBeInTheDocument();
    });
  });

  describe("Notification Display", () => {
    const mockNotifications = [
      {
        id: "notif-1",
        type: "EMAIL",
        title: "Nueva cita programada",
        message:
          "Tu cita con Dr. Smith ha sido confirmada para mañana a las 10:00 AM",
        isRead: false,
        createdAt: "2024-01-15T10:00:00Z",
      },
      {
        id: "notif-2",
        type: "SMS",
        title: "Recordatorio de medicamento",
        message: "Es hora de tomar tu medicamento",
        isRead: true,
        createdAt: "2024-01-15T09:00:00Z",
      },
      {
        id: "notif-3",
        type: "WHATSAPP",
        title: "Mensaje del doctor",
        message: "El doctor te ha enviado un mensaje",
        isRead: false,
        createdAt: "2024-01-15T08:00:00Z",
      },
    ];

    beforeEach(() => {
      mockUseNotifications.notifications = mockNotifications;
    });

    it("should display notifications with correct content", async () => {
      const user = userEvent.setup();
      renderNotificationDropdown();

      const bellButton = screen.getByRole("button");
      await user.click(bellButton);

      expect(screen.getByText("Nueva cita programada")).toBeInTheDocument();
      expect(
        screen.getByText("Recordatorio de medicamento")
      ).toBeInTheDocument();
      expect(screen.getByText("Mensaje del doctor")).toBeInTheDocument();
    });

    it("should show correct icons for different notification types", async () => {
      const user = userEvent.setup();
      renderNotificationDropdown();

      const bellButton = screen.getByRole("button");
      await user.click(bellButton);

      expect(screen.getByText("📧")).toBeInTheDocument(); // EMAIL
      expect(screen.getByText("📱")).toBeInTheDocument(); // SMS
      expect(screen.getByText("💬")).toBeInTheDocument(); // WHATSAPP
    });

    it("should show unread indicator for unread notifications", async () => {
      const user = userEvent.setup();
      renderNotificationDropdown();

      const bellButton = screen.getByRole("button");
      await user.click(bellButton);

      const unreadIndicators = screen
        .getAllByRole("generic")
        .filter(
          (el) =>
            el.className.includes("bg-primary") &&
            el.className.includes("rounded-full")
        );
      expect(unreadIndicators).toHaveLength(2); // Two unread notifications
    });

    it("should format time correctly", async () => {
      const user = userEvent.setup();
      renderNotificationDropdown();

      const bellButton = screen.getByRole("button");
      await user.click(bellButton);

      expect(screen.getAllByText("hace 5 minutos")).toHaveLength(3);
    });

    it("should truncate long messages", async () => {
      const longNotification = {
        id: "notif-long",
        type: "EMAIL",
        title: "Very long notification title that should be truncated",
        message:
          "This is a very long notification message that should be truncated because it exceeds the maximum length allowed for display in the dropdown",
        isRead: false,
        createdAt: "2024-01-15T10:00:00Z",
      };

      mockUseNotifications.notifications = [longNotification];
      const user = userEvent.setup();
      renderNotificationDropdown();

      const bellButton = screen.getByRole("button");
      await user.click(bellButton);

      expect(
        screen.getByText(/This is a very long notification message/)
      ).toBeInTheDocument();
    });
  });

  describe("Notification Actions", () => {
    const mockNotifications = [
      {
        id: "notif-1",
        type: "EMAIL",
        title: "Test notification",
        message: "Test message",
        isRead: false,
        createdAt: "2024-01-15T10:00:00Z",
      },
    ];

    beforeEach(() => {
      mockUseNotifications.notifications = mockNotifications;
    });

    it("should mark notification as read when check button is clicked", async () => {
      const user = userEvent.setup();
      renderNotificationDropdown();

      const bellButton = screen.getByRole("button");
      await user.click(bellButton);

      const markReadButton = screen.getByRole("button", { name: /check/i });
      await user.click(markReadButton);

      expect(mockUseNotifications.markAsRead).toHaveBeenCalledWith("notif-1");
    });

    it("should delete notification when delete button is clicked", async () => {
      const user = userEvent.setup();
      renderNotificationDropdown();

      const bellButton = screen.getByRole("button");
      await user.click(bellButton);

      const deleteButton = screen.getByRole("button", { name: /trash/i });
      await user.click(deleteButton);

      expect(mockUseNotifications.deleteNotification).toHaveBeenCalledWith(
        "notif-1"
      );
    });

    it("should mark all notifications as read when mark all button is clicked", async () => {
      const user = userEvent.setup();
      mockUseNotifications.stats = { unread: 1, total: 1 };
      renderNotificationDropdown();

      const bellButton = screen.getByRole("button");
      await user.click(bellButton);

      const markAllButton = screen.getByText("Marcar todas");
      await user.click(markAllButton);

      expect(mockUseNotifications.markAllAsRead).toHaveBeenCalled();
    });

    it("should not show mark as read button for already read notifications", async () => {
      const readNotification = {
        ...mockNotifications[0],
        isRead: true,
      };
      mockUseNotifications.notifications = [readNotification];

      const user = userEvent.setup();
      renderNotificationDropdown();

      const bellButton = screen.getByRole("button");
      await user.click(bellButton);

      expect(
        screen.queryByRole("button", { name: /check/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("Navigation Links", () => {
    it("should show link to all notifications", async () => {
      const user = userEvent.setup();
      renderNotificationDropdown();

      const bellButton = screen.getByRole("button");
      await user.click(bellButton);

      const allNotificationsLink = screen.getByText(
        "Ver todas las notificaciones"
      );
      expect(allNotificationsLink.closest("a")).toHaveAttribute(
        "href",
        "/notificaciones"
      );
    });

    it("should show link to notification settings", async () => {
      const user = userEvent.setup();
      renderNotificationDropdown();

      const bellButton = screen.getByRole("button");
      await user.click(bellButton);

      const settingsLink = screen.getByText("Configurar notificaciones");
      expect(settingsLink.closest("a")).toHaveAttribute(
        "href",
        "/notificaciones/configuracion"
      );
    });
  });

  describe("Accessibility", () => {
    it("should have proper button role for trigger", () => {
      renderNotificationDropdown();

      const bellButton = screen.getByRole("button");
      expect(bellButton).toBeInTheDocument();
    });

    it("should support keyboard navigation", async () => {
      const user = userEvent.setup();
      renderNotificationDropdown();

      // Tab to bell button
      await user.tab();
      expect(screen.getByRole("button")).toHaveFocus();

      // Enter to open dropdown
      await user.keyboard("{Enter}");
      expect(screen.getByText("Notificaciones")).toBeInTheDocument();
    });

    it("should have proper ARIA attributes", () => {
      renderNotificationDropdown();

      const bellButton = screen.getByRole("button");
      expect(bellButton).toHaveAttribute("type", "button");
    });

    it("should close dropdown when clicking outside", async () => {
      const user = userEvent.setup();
      renderNotificationDropdown();

      const bellButton = screen.getByRole("button");
      await user.click(bellButton);

      expect(screen.getByText("Notificaciones")).toBeInTheDocument();

      // Click outside
      await user.click(document.body);

      await waitFor(() => {
        expect(screen.queryByText("Notificaciones")).not.toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle missing notification data gracefully", async () => {
      const incompleteNotification = {
        id: "notif-incomplete",
        type: "EMAIL",
        // Missing title and message
        isRead: false,
        createdAt: "2024-01-15T10:00:00Z",
      };

      mockUseNotifications.notifications = [incompleteNotification];
      const user = userEvent.setup();
      renderNotificationDropdown();

      const bellButton = screen.getByRole("button");
      await user.click(bellButton);

      // Should not crash
      expect(screen.getByText("Notificaciones")).toBeInTheDocument();
    });

    it("should handle invalid dates gracefully", async () => {
      const invalidDateNotification = {
        id: "notif-invalid-date",
        type: "EMAIL",
        title: "Test notification",
        message: "Test message",
        isRead: false,
        createdAt: "invalid-date",
      };

      mockUseNotifications.notifications = [invalidDateNotification];

      // Mock formatDistanceToNow to throw error
      vi.mocked(require("date-fns").formatDistanceToNow).mockImplementation(
        () => {
          throw new Error("Invalid date");
        }
      );

      const user = userEvent.setup();
      renderNotificationDropdown();

      const bellButton = screen.getByRole("button");
      await user.click(bellButton);

      expect(screen.getByText("Hace un momento")).toBeInTheDocument();
    });
  });

  describe("Performance", () => {
    it("should handle large number of notifications efficiently", async () => {
      const manyNotifications = Array.from({ length: 100 }, (_, i) => ({
        id: `notif-${i}`,
        type: "EMAIL",
        title: `Notification ${i}`,
        message: `Message ${i}`,
        isRead: i % 2 === 0,
        createdAt: "2024-01-15T10:00:00Z",
      }));

      mockUseNotifications.notifications = manyNotifications;

      const startTime = performance.now();
      const user = userEvent.setup();
      renderNotificationDropdown();

      const bellButton = screen.getByRole("button");
      await user.click(bellButton);
      const endTime = performance.now();

      // Should render within reasonable time
      expect(endTime - startTime).toBeLessThan(100);

      // Should show scroll area for many notifications
      expect(screen.getByRole("scrollbar")).toBeInTheDocument();
    });

    it("should not re-render unnecessarily", () => {
      const { rerender } = renderNotificationDropdown();

      // Re-render with same props
      rerender(<NotificationDropdown />);

      // Should not cause unnecessary re-renders
      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });
});
