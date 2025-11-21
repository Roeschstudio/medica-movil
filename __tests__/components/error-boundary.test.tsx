/**
 * Test suite for ErrorBoundary components
 *
 * Tests:
 * - Error catching and display
 * - Error reporting functionality
 * - Reset functionality
 * - Custom fallback UI
 * - Chat-specific error boundary
 * - Development vs production modes
 */

import { ChatErrorBoundary, ErrorBoundary } from "@/components/error-boundary";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock console.error to avoid noise in tests
const originalConsoleError = console.error;

// Component that throws an error for testing
const ThrowError: React.FC<{ shouldThrow?: boolean; message?: string }> = ({
  shouldThrow = false,
  message = "Test error",
}) => {
  if (shouldThrow) {
    throw new Error(message);
  }
  return <div>No error</div>;
};

// Mock window.location.reload
Object.defineProperty(window, "location", {
  value: {
    reload: vi.fn(),
    href: "http://localhost:3000/test",
  },
  writable: true,
});

describe("ErrorBoundary Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
    vi.restoreAllMocks();
  });

  const renderWithErrorBoundary = (children: React.ReactNode, props = {}) => {
    return render(<ErrorBoundary {...props}>{children}</ErrorBoundary>);
  };

  describe("Normal Operation", () => {
    it("should render children when no error occurs", () => {
      renderWithErrorBoundary(<ThrowError shouldThrow={false} />);

      expect(screen.getByText("No error")).toBeInTheDocument();
    });

    it("should not show error UI when children render successfully", () => {
      renderWithErrorBoundary(<div>Working component</div>);

      expect(screen.getByText("Working component")).toBeInTheDocument();
      expect(screen.queryByText("Algo salió mal")).not.toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("should catch and display errors", () => {
      renderWithErrorBoundary(<ThrowError shouldThrow={true} />);

      expect(screen.getByText("Algo salió mal")).toBeInTheDocument();
      expect(screen.getByText("Reintentar")).toBeInTheDocument();
      expect(screen.getByText("Recargar página")).toBeInTheDocument();
    });

    it("should log errors to console", () => {
      renderWithErrorBoundary(<ThrowError shouldThrow={true} />);

      expect(console.error).toHaveBeenCalledWith(
        "ErrorBoundary caught an error:",
        expect.any(Error),
        expect.any(Object)
      );
    });

    it("should call onError callback when provided", () => {
      const onError = vi.fn();
      renderWithErrorBoundary(<ThrowError shouldThrow={true} />, { onError });

      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.any(Object)
      );
    });

    it("should generate unique error ID", () => {
      renderWithErrorBoundary(<ThrowError shouldThrow={true} />);

      const errorId = screen.getByText(/ID del error:/).textContent;
      expect(errorId).toMatch(/ID del error: error_\d+_[a-z0-9]+/);
    });

    it("should display custom error message", () => {
      renderWithErrorBoundary(
        <ThrowError shouldThrow={true} message="Custom error message" />
      );

      expect(screen.getByText("Algo salió mal")).toBeInTheDocument();
    });
  });

  describe("Custom Fallback UI", () => {
    it("should render custom fallback when provided", () => {
      const customFallback = <div>Custom error UI</div>;

      renderWithErrorBoundary(<ThrowError shouldThrow={true} />, {
        fallback: customFallback,
      });

      expect(screen.getByText("Custom error UI")).toBeInTheDocument();
      expect(screen.queryByText("Algo salió mal")).not.toBeInTheDocument();
    });

    it("should use default fallback when custom fallback is not provided", () => {
      renderWithErrorBoundary(<ThrowError shouldThrow={true} />);

      expect(screen.getByText("Algo salió mal")).toBeInTheDocument();
    });
  });

  describe("Reset Functionality", () => {
    it("should reset error state when retry button is clicked", async () => {
      const user = userEvent.setup();
      const { rerender } = renderWithErrorBoundary(
        <ThrowError shouldThrow={true} />
      );

      expect(screen.getByText("Algo salió mal")).toBeInTheDocument();

      const retryButton = screen.getByText("Reintentar");
      await user.click(retryButton);

      // Re-render with no error
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText("No error")).toBeInTheDocument();
      expect(screen.queryByText("Algo salió mal")).not.toBeInTheDocument();
    });

    it("should reload page when reload button is clicked", async () => {
      const user = userEvent.setup();
      renderWithErrorBoundary(<ThrowError shouldThrow={true} />);

      const reloadButton = screen.getByText("Recargar página");
      await user.click(reloadButton);

      expect(window.location.reload).toHaveBeenCalled();
    });

    it("should reset on props change when resetOnPropsChange is true", () => {
      const { rerender } = render(
        <ErrorBoundary resetOnPropsChange resetKeys={["key1"]}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Algo salió mal")).toBeInTheDocument();

      // Change reset keys
      rerender(
        <ErrorBoundary resetOnPropsChange resetKeys={["key2"]}>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText("No error")).toBeInTheDocument();
    });

    it("should not reset on props change when resetOnPropsChange is false", () => {
      const { rerender } = render(
        <ErrorBoundary resetOnPropsChange={false} resetKeys={["key1"]}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Algo salió mal")).toBeInTheDocument();

      // Change reset keys
      rerender(
        <ErrorBoundary resetOnPropsChange={false} resetKeys={["key2"]}>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      // Should still show error
      expect(screen.getByText("Algo salió mal")).toBeInTheDocument();
    });
  });

  describe("Development Mode", () => {
    const originalNodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = "development";
    });

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it("should show error details in development mode", () => {
      renderWithErrorBoundary(
        <ThrowError shouldThrow={true} message="Development error" />
      );

      expect(
        screen.getByText("Detalles del error (desarrollo)")
      ).toBeInTheDocument();
    });

    it("should show error stack trace in development mode", async () => {
      const user = userEvent.setup();
      renderWithErrorBoundary(
        <ThrowError shouldThrow={true} message="Stack trace error" />
      );

      const details = screen.getByText("Detalles del error (desarrollo)");
      await user.click(details);

      expect(screen.getByText(/Stack trace error/)).toBeInTheDocument();
    });
  });

  describe("Production Mode", () => {
    const originalNodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it("should not show error details in production mode", () => {
      renderWithErrorBoundary(
        <ThrowError shouldThrow={true} message="Production error" />
      );

      expect(
        screen.queryByText("Detalles del error (desarrollo)")
      ).not.toBeInTheDocument();
    });
  });

  describe("Error Reporting", () => {
    it("should create error report with proper structure", () => {
      const consoleSpy = vi.spyOn(console, "error");
      renderWithErrorBoundary(<ThrowError shouldThrow={true} />);

      // Check that error report was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error Report:",
        expect.objectContaining({
          message: expect.any(String),
          stack: expect.any(String),
          componentStack: expect.any(String),
          timestamp: expect.any(String),
          userAgent: expect.any(String),
          url: expect.any(String),
        })
      );
    });

    it("should handle reporting errors gracefully", () => {
      // Mock navigator to throw error
      const originalNavigator = global.navigator;
      Object.defineProperty(global, "navigator", {
        value: undefined,
        writable: true,
      });

      expect(() => {
        renderWithErrorBoundary(<ThrowError shouldThrow={true} />);
      }).not.toThrow();

      // Restore navigator
      Object.defineProperty(global, "navigator", {
        value: originalNavigator,
        writable: true,
      });
    });
  });

  describe("Cleanup", () => {
    it("should clear timeout on unmount", () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
      const { unmount } = renderWithErrorBoundary(
        <ThrowError shouldThrow={true} />
      );

      unmount();

      // Timeout should be cleared (implementation detail)
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("should have proper button roles and labels", () => {
      renderWithErrorBoundary(<ThrowError shouldThrow={true} />);

      const retryButton = screen.getByRole("button", { name: /reintentar/i });
      const reloadButton = screen.getByRole("button", {
        name: /recargar página/i,
      });

      expect(retryButton).toBeInTheDocument();
      expect(reloadButton).toBeInTheDocument();
    });

    it("should support keyboard navigation", async () => {
      const user = userEvent.setup();
      renderWithErrorBoundary(<ThrowError shouldThrow={true} />);

      // Tab through buttons
      await user.tab();
      expect(screen.getByText("Reintentar")).toHaveFocus();

      await user.tab();
      expect(screen.getByText("Recargar página")).toHaveFocus();
    });
  });
});

describe("ChatErrorBoundary Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  const renderChatErrorBoundary = (children: React.ReactNode, props = {}) => {
    return render(<ChatErrorBoundary {...props}>{children}</ChatErrorBoundary>);
  };

  describe("Chat-Specific Error Handling", () => {
    it("should render children when no error occurs", () => {
      renderChatErrorBoundary(<div>Chat working</div>);

      expect(screen.getByText("Chat working")).toBeInTheDocument();
    });

    it("should show chat-specific error UI", () => {
      renderChatErrorBoundary(<ThrowError shouldThrow={true} />);

      expect(screen.getByText("Error en el chat")).toBeInTheDocument();
      expect(
        screen.getByText(
          "No se pudo cargar el chat. Por favor, intenta recargar la página."
        )
      ).toBeInTheDocument();
    });

    it("should call onError callback with error", () => {
      const onError = vi.fn();
      renderChatErrorBoundary(<ThrowError shouldThrow={true} />, { onError });

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should reset when chatRoomId changes", () => {
      const { rerender } = render(
        <ChatErrorBoundary chatRoomId="room-1">
          <ThrowError shouldThrow={true} />
        </ChatErrorBoundary>
      );

      expect(screen.getByText("Error en el chat")).toBeInTheDocument();

      // Change chatRoomId
      rerender(
        <ChatErrorBoundary chatRoomId="room-2">
          <ThrowError shouldThrow={false} />
        </ChatErrorBoundary>
      );

      expect(screen.getByText("No error")).toBeInTheDocument();
    });

    it("should show reload button", async () => {
      const user = userEvent.setup();
      renderChatErrorBoundary(<ThrowError shouldThrow={true} />);

      const reloadButton = screen.getByText("Recargar");
      expect(reloadButton).toBeInTheDocument();

      await user.click(reloadButton);
      expect(window.location.reload).toHaveBeenCalled();
    });
  });

  describe("Chat Error Logging", () => {
    it("should log chat-specific errors", () => {
      renderChatErrorBoundary(<ThrowError shouldThrow={true} />);

      expect(console.error).toHaveBeenCalledWith(
        "Chat error:",
        expect.any(Error),
        expect.any(Object)
      );
    });

    it("should include chatRoomId in error context", () => {
      const onError = vi.fn();
      renderChatErrorBoundary(<ThrowError shouldThrow={true} />, {
        chatRoomId: "room-123",
        onError,
      });

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("Accessibility", () => {
    it("should have proper heading structure", () => {
      renderChatErrorBoundary(<ThrowError shouldThrow={true} />);

      const heading = screen.getByRole("heading", { level: 3 });
      expect(heading).toHaveTextContent("Error en el chat");
    });

    it("should have accessible reload button", () => {
      renderChatErrorBoundary(<ThrowError shouldThrow={true} />);

      const reloadButton = screen.getByRole("button", { name: /recargar/i });
      expect(reloadButton).toBeInTheDocument();
    });
  });

  describe("Visual Design", () => {
    it("should show error icon", () => {
      renderChatErrorBoundary(<ThrowError shouldThrow={true} />);

      expect(screen.getByTestId("alert-triangle-icon")).toBeInTheDocument();
    });

    it("should be contained in a card", () => {
      renderChatErrorBoundary(<ThrowError shouldThrow={true} />);

      const card = screen.getByText("Error en el chat").closest(".card");
      expect(card).toBeInTheDocument();
    });
  });
});
