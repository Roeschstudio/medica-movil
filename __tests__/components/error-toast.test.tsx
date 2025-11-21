/**
 * Test suite for ErrorToast components and hooks
 *
 * Tests:
 * - useErrorToast hook functionality
 * - Error message display and formatting
 * - Network error handling
 * - Success toast functionality
 * - ErrorDisplay component
 * - Accessibility features
 */

import { ErrorDisplay, useErrorToast } from "@/components/error-toast";
import { AppError } from "@/lib/error-handling";
import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the toast hook
const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  toast: mockToast,
}));

// Mock error handling utilities
vi.mock("@/lib/error-handling", () => ({
  AppError: class AppError extends Error {
    constructor(
      message: string,
      public code: string = "UNKNOWN_ERROR",
      public isRetryable: boolean = false
    ) {
      super(message);
      this.name = "AppError";
    }
  },
  getErrorMessage: (error: any) => {
    if (error instanceof Error) return error.message;
    return String(error);
  },
}));

describe("useErrorToast Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location.reload
    Object.defineProperty(window, "location", {
      value: { reload: vi.fn() },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("showErrorToast", () => {
    it("should show error toast with string message", () => {
      const { result } = renderHook(() => useErrorToast());

      act(() => {
        result.current.showErrorToast("Test error message");
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "Test error message",
        variant: "destructive",
        duration: 5000,
        action: undefined,
      });
    });

    it("should show error toast with Error object", () => {
      const { result } = renderHook(() => useErrorToast());
      const error = new Error("JavaScript error");

      act(() => {
        result.current.showErrorToast(error);
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "JavaScript error",
        variant: "destructive",
        duration: 5000,
        action: undefined,
      });
    });

    it("should show error toast with AppError", () => {
      const { result } = renderHook(() => useErrorToast());
      const appError = new AppError("App specific error", "APP_ERROR", true);

      act(() => {
        result.current.showErrorToast(appError);
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "App specific error",
        variant: "destructive",
        duration: 5000,
        action: expect.any(Object), // Should have retry action for retryable errors
      });
    });

    it("should use custom title and duration", () => {
      const { result } = renderHook(() => useErrorToast());

      act(() => {
        result.current.showErrorToast("Test error", {
          title: "Custom Title",
          duration: 10000,
        });
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Custom Title",
        description: "Test error",
        variant: "destructive",
        duration: 10000,
        action: undefined,
      });
    });

    it("should show persistent toast when persistent is true", () => {
      const { result } = renderHook(() => useErrorToast());

      act(() => {
        result.current.showErrorToast("Persistent error", {
          persistent: true,
        });
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "Persistent error",
        variant: "destructive",
        duration: Infinity,
        action: undefined,
      });
    });

    it("should show custom action when provided", () => {
      const { result } = renderHook(() => useErrorToast());
      const customAction = vi.fn();

      act(() => {
        result.current.showErrorToast("Error with action", {
          action: {
            label: "Custom Action",
            onClick: customAction,
          },
        });
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "Error with action",
        variant: "destructive",
        duration: 5000,
        action: expect.any(Object),
      });
    });

    it("should show retry action for retryable AppError", () => {
      const { result } = renderHook(() => useErrorToast());
      const retryableError = new AppError(
        "Retryable error",
        "NETWORK_ERROR",
        true
      );

      act(() => {
        result.current.showErrorToast(retryableError);
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "Retryable error",
        variant: "destructive",
        duration: 5000,
        action: expect.any(Object),
      });
    });
  });

  describe("showNetworkErrorToast", () => {
    it("should show network error toast with default message", () => {
      const { result } = renderHook(() => useErrorToast());

      act(() => {
        result.current.showNetworkErrorToast();
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Sin conexión",
        description: "Problema de conexión. Verifica tu internet.",
        variant: "destructive",
        duration: 5000,
        action: undefined,
      });
    });

    it("should show retry action when onRetry is provided", () => {
      const { result } = renderHook(() => useErrorToast());
      const onRetry = vi.fn();

      act(() => {
        result.current.showNetworkErrorToast(onRetry);
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Sin conexión",
        description: "Problema de conexión. Verifica tu internet.",
        variant: "destructive",
        duration: 5000,
        action: expect.objectContaining({
          label: "Reintentar",
          onClick: onRetry,
        }),
      });
    });

    it("should use custom options", () => {
      const { result } = renderHook(() => useErrorToast());

      act(() => {
        result.current.showNetworkErrorToast(undefined, {
          duration: 8000,
          persistent: true,
        });
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Sin conexión",
        description: "Problema de conexión. Verifica tu internet.",
        variant: "destructive",
        duration: Infinity, // persistent overrides duration
        action: undefined,
      });
    });
  });

  describe("showConnectionStatusToast", () => {
    it("should show online toast when connection is restored", () => {
      const { result } = renderHook(() => useErrorToast());

      act(() => {
        result.current.showConnectionStatusToast(true);
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Conexión restaurada",
        description: "Ya estás conectado nuevamente.",
        variant: "default",
        duration: 3000,
        action: expect.any(Object), // Wifi icon
      });
    });

    it("should show offline toast when connection is lost", () => {
      const { result } = renderHook(() => useErrorToast());

      act(() => {
        result.current.showConnectionStatusToast(false);
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Sin conexión",
        description: "Verifica tu conexión a internet.",
        variant: "destructive",
        duration: 5000,
        action: expect.any(Object), // WifiOff icon
      });
    });

    it("should show persistent offline toast when specified", () => {
      const { result } = renderHook(() => useErrorToast());

      act(() => {
        result.current.showConnectionStatusToast(false, { persistent: true });
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Sin conexión",
        description: "Verifica tu conexión a internet.",
        variant: "destructive",
        duration: Infinity,
        action: expect.any(Object),
      });
    });
  });

  describe("showSuccessToast", () => {
    it("should show success toast with default duration", () => {
      const { result } = renderHook(() => useErrorToast());

      act(() => {
        result.current.showSuccessToast("Operation successful");
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Éxito",
        description: "Operation successful",
        variant: "default",
        duration: 3000,
      });
    });

    it("should use custom duration", () => {
      const { result } = renderHook(() => useErrorToast());

      act(() => {
        result.current.showSuccessToast("Success message", { duration: 5000 });
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Éxito",
        description: "Success message",
        variant: "default",
        duration: 5000,
      });
    });
  });
});

describe("ErrorDisplay Component", () => {
  const defaultProps = {
    error: "Test error message",
    onRetry: vi.fn(),
    onDismiss: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderErrorDisplay = (props = {}) => {
    return render(<ErrorDisplay {...defaultProps} {...props} />);
  };

  describe("Basic Rendering", () => {
    it("should render error message", () => {
      renderErrorDisplay();

      expect(screen.getByText("Test error message")).toBeInTheDocument();
      expect(screen.getByTestId("alert-circle-icon")).toBeInTheDocument();
    });

    it("should render Error object message", () => {
      const error = new Error("JavaScript error");
      renderErrorDisplay({ error });

      expect(screen.getByText("JavaScript error")).toBeInTheDocument();
    });

    it("should render AppError message", () => {
      const appError = new AppError("App error", "APP_ERROR", true);
      renderErrorDisplay({ error: appError });

      expect(screen.getByText("App error")).toBeInTheDocument();
    });
  });

  describe("Action Buttons", () => {
    it("should show retry button for retryable AppError", () => {
      const retryableError = new AppError(
        "Retryable error",
        "NETWORK_ERROR",
        true
      );
      renderErrorDisplay({ error: retryableError });

      expect(screen.getByText("Reintentar")).toBeInTheDocument();
    });

    it("should not show retry button for non-retryable errors", () => {
      const nonRetryableError = new AppError(
        "Non-retryable error",
        "VALIDATION_ERROR",
        false
      );
      renderErrorDisplay({ error: nonRetryableError });

      expect(screen.queryByText("Reintentar")).not.toBeInTheDocument();
    });

    it("should not show retry button for regular Error objects", () => {
      const error = new Error("Regular error");
      renderErrorDisplay({ error });

      expect(screen.queryByText("Reintentar")).not.toBeInTheDocument();
    });

    it("should show dismiss button when onDismiss is provided", () => {
      renderErrorDisplay();

      expect(screen.getByText("✕")).toBeInTheDocument();
    });

    it("should not show dismiss button when onDismiss is not provided", () => {
      renderErrorDisplay({ onDismiss: undefined });

      expect(screen.queryByText("✕")).not.toBeInTheDocument();
    });

    it("should call onRetry when retry button is clicked", async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();
      const retryableError = new AppError(
        "Retryable error",
        "NETWORK_ERROR",
        true
      );

      renderErrorDisplay({ error: retryableError, onRetry });

      const retryButton = screen.getByText("Reintentar");
      await user.click(retryButton);

      expect(onRetry).toHaveBeenCalled();
    });

    it("should call onDismiss when dismiss button is clicked", async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();

      renderErrorDisplay({ onDismiss });

      const dismissButton = screen.getByText("✕");
      await user.click(dismissButton);

      expect(onDismiss).toHaveBeenCalled();
    });
  });

  describe("Styling", () => {
    it("should apply custom className", () => {
      renderErrorDisplay({ className: "custom-error-class" });

      const errorContainer = screen
        .getByText("Test error message")
        .closest(".custom-error-class");
      expect(errorContainer).toBeInTheDocument();
    });

    it("should have proper destructive styling", () => {
      renderErrorDisplay();

      const errorContainer = screen
        .getByText("Test error message")
        .closest("div");
      expect(errorContainer).toHaveClass(
        "bg-destructive/10",
        "border-destructive/20"
      );
    });
  });

  describe("Accessibility", () => {
    it("should have proper button roles", () => {
      const retryableError = new AppError(
        "Retryable error",
        "NETWORK_ERROR",
        true
      );
      renderErrorDisplay({ error: retryableError });

      const retryButton = screen.getByRole("button", { name: /reintentar/i });
      const dismissButton = screen.getByRole("button", { name: /✕/i });

      expect(retryButton).toBeInTheDocument();
      expect(dismissButton).toBeInTheDocument();
    });

    it("should support keyboard navigation", async () => {
      const user = userEvent.setup();
      const retryableError = new AppError(
        "Retryable error",
        "NETWORK_ERROR",
        true
      );
      renderErrorDisplay({ error: retryableError });

      // Tab through buttons
      await user.tab();
      expect(screen.getByText("Reintentar")).toHaveFocus();

      await user.tab();
      expect(screen.getByText("✕")).toHaveFocus();
    });

    it("should handle Enter key for button activation", async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();
      const retryableError = new AppError(
        "Retryable error",
        "NETWORK_ERROR",
        true
      );

      renderErrorDisplay({ error: retryableError, onRetry });

      const retryButton = screen.getByText("Reintentar");
      retryButton.focus();
      await user.keyboard("{Enter}");

      expect(onRetry).toHaveBeenCalled();
    });
  });

  describe("Error Message Truncation", () => {
    it("should handle long error messages", () => {
      const longError =
        "This is a very long error message that should be displayed properly without breaking the layout or causing any issues with the component rendering";
      renderErrorDisplay({ error: longError });

      expect(screen.getByText(longError)).toBeInTheDocument();
    });

    it("should handle empty error messages", () => {
      renderErrorDisplay({ error: "" });

      // Should still render the component structure
      expect(screen.getByTestId("alert-circle-icon")).toBeInTheDocument();
    });
  });

  describe("Icon Display", () => {
    it("should show alert circle icon", () => {
      renderErrorDisplay();

      const icon = screen.getByTestId("alert-circle-icon");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass("text-destructive");
    });

    it("should show refresh icon in retry button", () => {
      const retryableError = new AppError(
        "Retryable error",
        "NETWORK_ERROR",
        true
      );
      renderErrorDisplay({ error: retryableError });

      expect(screen.getByTestId("refresh-cw-icon")).toBeInTheDocument();
    });
  });

  describe("Layout and Responsiveness", () => {
    it("should have proper flex layout", () => {
      renderErrorDisplay();

      const container = screen.getByText("Test error message").closest("div");
      expect(container).toHaveClass("flex", "items-center", "gap-3");
    });

    it("should handle content overflow properly", () => {
      renderErrorDisplay();

      const messageContainer = screen
        .getByText("Test error message")
        .closest(".flex-1");
      expect(messageContainer).toHaveClass("min-w-0");
    });
  });
});
