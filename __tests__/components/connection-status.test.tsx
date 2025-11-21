/**
 * Test suite for ConnectionStatus components
 *
 * Tests:
 * - Connection status display and states
 * - Offline detection integration
 * - Reconnection functionality
 * - Duration formatting
 * - Different component variants
 * - Accessibility features
 */

import {
  ConnectionIndicator,
  ConnectionStatus,
  NetworkStatusBanner,
} from "@/components/connection-status";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock offline detection hook
const mockUseOfflineDetection = {
  isOnline: true,
  wasOffline: false,
  getOfflineDuration: vi.fn(() => 0),
  checkConnection: vi.fn(),
};

vi.mock("@/hooks/use-offline-detection", () => ({
  useOfflineDetection: () => mockUseOfflineDetection,
}));

describe("ConnectionStatus Component", () => {
  const defaultProps = {
    isConnected: true,
    isReconnecting: false,
    onReconnect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOfflineDetection.isOnline = true;
    mockUseOfflineDetection.wasOffline = false;
    mockUseOfflineDetection.getOfflineDuration.mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderConnectionStatus = (props = {}) => {
    return render(<ConnectionStatus {...defaultProps} {...props} />);
  };

  describe("Basic Badge Display", () => {
    it("should render connected status by default", () => {
      renderConnectionStatus();

      expect(screen.getByText("Conectado")).toBeInTheDocument();
      expect(screen.getByTestId("wifi-icon")).toBeInTheDocument();
    });

    it("should show disconnected status when not connected", () => {
      renderConnectionStatus({ isConnected: false });

      expect(screen.getByText("Desconectado")).toBeInTheDocument();
      expect(screen.getByTestId("alert-triangle-icon")).toBeInTheDocument();
    });

    it("should show reconnecting status", () => {
      renderConnectionStatus({ isReconnecting: true });

      expect(screen.getByText("Reconectando")).toBeInTheDocument();
      expect(screen.getByTestId("refresh-cw-icon")).toBeInTheDocument();
    });

    it("should show offline status when no internet", () => {
      mockUseOfflineDetection.isOnline = false;
      renderConnectionStatus();

      expect(screen.getByText("Sin internet")).toBeInTheDocument();
      expect(screen.getByTestId("wifi-off-icon")).toBeInTheDocument();
    });

    it("should show reconnected status after being offline", () => {
      mockUseOfflineDetection.wasOffline = true;
      renderConnectionStatus();

      expect(screen.getByText("Reconectado")).toBeInTheDocument();
    });
  });

  describe("Detailed Display", () => {
    it("should render detailed view with descriptions", () => {
      renderConnectionStatus({ showDetails: true });

      expect(screen.getByText("Conectado")).toBeInTheDocument();
      expect(screen.getByText("Conexión estable")).toBeInTheDocument();
    });

    it("should show reconnect button when disconnected", () => {
      renderConnectionStatus({
        showDetails: true,
        isConnected: false,
      });

      expect(screen.getByText("Reconectar")).toBeInTheDocument();
    });

    it("should show reconnecting button state", () => {
      renderConnectionStatus({
        showDetails: true,
        isConnected: false,
        isReconnecting: true,
      });

      expect(screen.getByText("Reconectando...")).toBeInTheDocument();
      expect(screen.getByRole("button")).toBeDisabled();
    });

    it("should call onReconnect when button is clicked", async () => {
      const user = userEvent.setup();
      const onReconnect = vi.fn();

      renderConnectionStatus({
        showDetails: true,
        isConnected: false,
        onReconnect,
      });

      const reconnectButton = screen.getByText("Reconectar");
      await user.click(reconnectButton);

      expect(onReconnect).toHaveBeenCalled();
    });

    it("should show offline duration when offline", () => {
      mockUseOfflineDetection.isOnline = false;
      mockUseOfflineDetection.getOfflineDuration.mockReturnValue(65000); // 1m 5s

      renderConnectionStatus({ showDetails: true });

      expect(screen.getByText("Desconectado por 1m 5s")).toBeInTheDocument();
    });
  });

  describe("Duration Formatting", () => {
    it("should format seconds correctly", () => {
      mockUseOfflineDetection.isOnline = false;
      mockUseOfflineDetection.getOfflineDuration.mockReturnValue(30000); // 30s

      renderConnectionStatus({ showDetails: true });

      expect(screen.getByText("Desconectado por 30s")).toBeInTheDocument();
    });

    it("should format minutes and seconds correctly", () => {
      mockUseOfflineDetection.isOnline = false;
      mockUseOfflineDetection.getOfflineDuration.mockReturnValue(125000); // 2m 5s

      renderConnectionStatus({ showDetails: true });

      expect(screen.getByText("Desconectado por 2m 5s")).toBeInTheDocument();
    });

    it("should format hours and minutes correctly", () => {
      mockUseOfflineDetection.isOnline = false;
      mockUseOfflineDetection.getOfflineDuration.mockReturnValue(3665000); // 1h 1m

      renderConnectionStatus({ showDetails: true });

      expect(screen.getByText("Desconectado por 1h 1m")).toBeInTheDocument();
    });
  });

  describe("Offline Duration Updates", () => {
    it("should update offline duration every second", async () => {
      vi.useFakeTimers();
      mockUseOfflineDetection.isOnline = false;
      mockUseOfflineDetection.getOfflineDuration
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(2000)
        .mockReturnValueOnce(3000);

      renderConnectionStatus({ showDetails: true });

      // Initial state
      expect(screen.getByText("Desconectado por 1s")).toBeInTheDocument();

      // After 1 second
      vi.advanceTimersByTime(1000);
      await waitFor(() => {
        expect(screen.getByText("Desconectado por 2s")).toBeInTheDocument();
      });

      // After another second
      vi.advanceTimersByTime(1000);
      await waitFor(() => {
        expect(screen.getByText("Desconectado por 3s")).toBeInTheDocument();
      });

      vi.useRealTimers();
    });

    it("should clear interval when coming back online", () => {
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");

      mockUseOfflineDetection.isOnline = false;
      const { rerender } = renderConnectionStatus({ showDetails: true });

      // Go back online
      mockUseOfflineDetection.isOnline = true;
      rerender(<ConnectionStatus {...defaultProps} showDetails={true} />);

      expect(clearIntervalSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe("Styling and Classes", () => {
    it("should apply custom className", () => {
      renderConnectionStatus({ className: "custom-class" });

      const badge = screen.getByText("Conectado").closest(".custom-class");
      expect(badge).toBeInTheDocument();
    });

    it("should apply correct variant classes", () => {
      renderConnectionStatus({ isConnected: false });

      const badge = screen.getByText("Desconectado");
      expect(badge.closest('[data-variant="destructive"]')).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA attributes", () => {
      renderConnectionStatus({ showDetails: true, isConnected: false });

      const reconnectButton = screen.getByRole("button", {
        name: /reconectar/i,
      });
      expect(reconnectButton).toBeInTheDocument();
    });

    it("should support keyboard navigation", async () => {
      const user = userEvent.setup();
      renderConnectionStatus({ showDetails: true, isConnected: false });

      const reconnectButton = screen.getByRole("button");
      await user.tab();
      expect(reconnectButton).toHaveFocus();
    });
  });
});

describe("ConnectionIndicator Component", () => {
  const renderConnectionIndicator = (props = {}) => {
    return render(<ConnectionIndicator {...props} />);
  };

  beforeEach(() => {
    mockUseOfflineDetection.isOnline = true;
  });

  describe("Visual Indicator", () => {
    it("should show green indicator when connected", () => {
      renderConnectionIndicator({ isConnected: true });

      const indicator = screen.getByTitle("Conectado");
      expect(indicator.firstChild).toHaveClass("bg-green-500");
    });

    it("should show red indicator when disconnected", () => {
      renderConnectionIndicator({ isConnected: false });

      const indicator = screen.getByTitle("Desconectado del servidor");
      expect(indicator.firstChild).toHaveClass("bg-red-500");
    });

    it("should show yellow indicator when reconnecting", () => {
      renderConnectionIndicator({ isReconnecting: true });

      const indicator = screen.getByTitle("Reconectando...");
      expect(indicator.firstChild).toHaveClass("bg-yellow-500");
    });

    it("should show red indicator when offline", () => {
      mockUseOfflineDetection.isOnline = false;
      renderConnectionIndicator();

      const indicator = screen.getByTitle("Sin conexión a internet");
      expect(indicator.firstChild).toHaveClass("bg-red-500");
    });
  });

  describe("Tooltip Text", () => {
    it("should show correct tooltip for each state", () => {
      const { rerender } = renderConnectionIndicator({ isConnected: true });
      expect(screen.getByTitle("Conectado")).toBeInTheDocument();

      rerender(<ConnectionIndicator isConnected={false} />);
      expect(
        screen.getByTitle("Desconectado del servidor")
      ).toBeInTheDocument();

      rerender(<ConnectionIndicator isReconnecting={true} />);
      expect(screen.getByTitle("Reconectando...")).toBeInTheDocument();
    });
  });

  describe("Animation", () => {
    it("should show pulse animation when reconnecting", () => {
      renderConnectionIndicator({ isReconnecting: true });

      const pulseElement = screen
        .getByTitle("Reconectando...")
        .querySelector(".animate-pulse");
      expect(pulseElement).toBeInTheDocument();
    });
  });
});

describe("NetworkStatusBanner Component", () => {
  const renderNetworkStatusBanner = (props = {}) => {
    return render(<NetworkStatusBanner {...props} />);
  };

  beforeEach(() => {
    mockUseOfflineDetection.isOnline = true;
    mockUseOfflineDetection.checkConnection.mockResolvedValue(undefined);
  });

  describe("Visibility", () => {
    it("should not render when online", () => {
      renderNetworkStatusBanner();

      expect(
        screen.queryByText("Sin conexión a internet")
      ).not.toBeInTheDocument();
    });

    it("should render when offline", () => {
      mockUseOfflineDetection.isOnline = false;
      renderNetworkStatusBanner();

      expect(screen.getByText("Sin conexión a internet")).toBeInTheDocument();
    });
  });

  describe("Retry Functionality", () => {
    it("should show retry button when offline", () => {
      mockUseOfflineDetection.isOnline = false;
      renderNetworkStatusBanner();

      expect(screen.getByText("Reintentar")).toBeInTheDocument();
    });

    it("should call checkConnection when retry is clicked", async () => {
      const user = userEvent.setup();
      mockUseOfflineDetection.isOnline = false;
      renderNetworkStatusBanner();

      const retryButton = screen.getByText("Reintentar");
      await user.click(retryButton);

      expect(mockUseOfflineDetection.checkConnection).toHaveBeenCalled();
    });

    it("should show loading state while retrying", async () => {
      const user = userEvent.setup();
      mockUseOfflineDetection.isOnline = false;
      mockUseOfflineDetection.checkConnection.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      renderNetworkStatusBanner();

      const retryButton = screen.getByText("Reintentar");
      await user.click(retryButton);

      expect(screen.getByText("Verificando...")).toBeInTheDocument();
      expect(retryButton).toBeDisabled();
    });

    it("should handle retry errors gracefully", async () => {
      const user = userEvent.setup();
      mockUseOfflineDetection.isOnline = false;
      mockUseOfflineDetection.checkConnection.mockRejectedValue(
        new Error("Network error")
      );

      renderNetworkStatusBanner();

      const retryButton = screen.getByText("Reintentar");
      await user.click(retryButton);

      // Should not crash and button should be re-enabled
      await waitFor(() => {
        expect(screen.getByText("Reintentar")).not.toBeDisabled();
      });
    });
  });

  describe("Styling", () => {
    it("should apply custom className", () => {
      mockUseOfflineDetection.isOnline = false;
      renderNetworkStatusBanner({ className: "custom-banner" });

      const banner = screen
        .getByText("Sin conexión a internet")
        .closest(".custom-banner");
      expect(banner).toBeInTheDocument();
    });

    it("should have fixed positioning", () => {
      mockUseOfflineDetection.isOnline = false;
      renderNetworkStatusBanner();

      const banner = screen
        .getByText("Sin conexión a internet")
        .closest(".fixed");
      expect(banner).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper button roles", () => {
      mockUseOfflineDetection.isOnline = false;
      renderNetworkStatusBanner();

      const retryButton = screen.getByRole("button", { name: /reintentar/i });
      expect(retryButton).toBeInTheDocument();
    });

    it("should support keyboard navigation", async () => {
      const user = userEvent.setup();
      mockUseOfflineDetection.isOnline = false;
      renderNetworkStatusBanner();

      const retryButton = screen.getByRole("button");
      await user.tab();
      expect(retryButton).toHaveFocus();
    });
  });
});
