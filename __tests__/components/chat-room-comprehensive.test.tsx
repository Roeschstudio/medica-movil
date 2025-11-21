import ChatRoom from "@/components/optimized-chat-room";
import type { ChatMessage } from "@/lib/types";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}));

vi.mock("@/hooks/use-chat-realtime", () => ({
  useChatRealtime: vi.fn(),
}));

vi.mock("@/hooks/use-chat-error-recovery", () => ({
  useChatErrorHandler: vi.fn(),
}));

vi.mock("@/hooks/use-offline-detection", () => ({
  useOfflineAwareOperation: vi.fn(),
}));

vi.mock("@/components/connection-status", () => ({
  default: ({ isConnected, onReconnect }: any) => (
    <div data-testid="connection-status">
      Status: {isConnected ? "Connected" : "Disconnected"}
      <button onClick={onReconnect} data-testid="reconnect-btn">
        Reconnect
      </button>
    </div>
  ),
}));

vi.mock("@/components/error-boundary", () => ({
  ChatErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/error-toast", () => ({
  ErrorDisplay: ({ error, onRetry, onDismiss }: any) => (
    <div data-testid="error-display">
      Error: {error?.message}
      <button onClick={onRetry} data-testid="retry-btn">
        Retry
      </button>
      <button onClick={onDismiss} data-testid="dismiss-btn">
        Dismiss
      </button>
    </div>
  ),
}));

vi.mock("@/components/file-preview", () => ({
  default: ({ fileName, fileUrl }: any) => (
    <div data-testid="file-preview">
      File: {fileName} - URL: {fileUrl}
    </div>
  ),
}));

vi.mock("@/components/file-upload", () => ({
  default: ({ onFileUpload, onError }: any) => (
    <div data-testid="file-upload">
      <button
        onClick={() =>
          onFileUpload({
            name: "test.jpg",
            type: "image/jpeg",
            size: 1000,
            url: "https://example.com/test.jpg",
          })
        }
        data-testid="upload-file-btn"
      >
        Upload File
      </button>
      <button
        onClick={() => onError(new Error("Upload failed"))}
        data-testid="upload-error-btn"
      >
        Trigger Error
      </button>
    </div>
  ),
}));

import { useChatErrorHandler } from "@/hooks/use-chat-error-recovery";
import { useChatRealtime } from "@/hooks/use-chat-realtime";
import { useOfflineAwareOperation } from "@/hooks/use-offline-detection";
import { useSession } from "next-auth/react";

const mockUseSession = useSession as any;
const mockUseChatRealtime = useChatRealtime as any;
const mockUseChatErrorHandler = useChatErrorHandler as any;
const mockUseOfflineAwareOperation = useOfflineAwareOperation as any;

describe("ChatRoom Component", () => {
  const mockMessages: ChatMessage[] = [
    {
      id: "msg-1",
      chatRoomId: "room-1",
      senderId: "user-1",
      content: "Hello world",
      messageType: "TEXT",
      isRead: false,
      sentAt: new Date("2024-01-01T10:00:00Z"),
      sender: {
        id: "user-1",
        name: "John Doe",
        role: "PATIENT",
      },
    },
    {
      id: "msg-2",
      chatRoomId: "room-1",
      senderId: "user-2",
      content: "Hi there!",
      messageType: "TEXT",
      isRead: true,
      sentAt: new Date("2024-01-01T10:01:00Z"),
      sender: {
        id: "user-2",
        name: "Dr. Smith",
        role: "DOCTOR",
      },
    },
  ];

  const defaultProps = {
    chatRoomId: "room-1",
    appointmentId: "appointment-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock session
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: "user-1",
          name: "John Doe",
          role: "PATIENT",
        },
      },
    });

    // Mock chat realtime hook
    mockUseChatRealtime.mockReturnValue({
      messages: mockMessages,
      typingUsers: [],
      connectionStatus: {
        isConnected: true,
        isReconnecting: false,
      },
      sendMessage: vi.fn().mockResolvedValue(true),
      markMessagesAsRead: vi.fn(),
      setTyping: vi.fn(),
      loadMessages: vi.fn().mockResolvedValue([]),
      reconnect: vi.fn(),
    });

    // Mock error handler
    mockUseChatErrorHandler.mockReturnValue({
      error: null,
      handleError: vi.fn(),
      clearError: vi.fn(),
      retryOperation: vi.fn((fn) => fn()),
    });

    // Mock offline aware operation
    mockUseOfflineAwareOperation.mockReturnValue({
      executeOperation: vi.fn((fn) => fn),
    });
  });

  describe("rendering", () => {
    it("should render chat room with messages", () => {
      render(<ChatRoom {...defaultProps} />);

      expect(screen.getByText("Chat de Consulta")).toBeInTheDocument();
      expect(screen.getByText("Hello world")).toBeInTheDocument();
      expect(screen.getByText("Hi there!")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
    });

    it("should render empty state when no messages", () => {
      mockUseChatRealtime.mockReturnValue({
        messages: [],
        typingUsers: [],
        connectionStatus: { isConnected: true, isReconnecting: false },
        sendMessage: vi.fn(),
        markMessagesAsRead: vi.fn(),
        setTyping: vi.fn(),
        loadMessages: vi.fn(),
        reconnect: vi.fn(),
      });

      render(<ChatRoom {...defaultProps} />);

      expect(
        screen.getByText("No hay mensajes aún. ¡Inicia la conversación!")
      ).toBeInTheDocument();
    });

    it("should show typing indicators", () => {
      mockUseChatRealtime.mockReturnValue({
        messages: mockMessages,
        typingUsers: [{ userId: "user-2", userName: "Dr. Smith" }],
        connectionStatus: { isConnected: true, isReconnecting: false },
        sendMessage: vi.fn(),
        markMessagesAsRead: vi.fn(),
        setTyping: vi.fn(),
        loadMessages: vi.fn(),
        reconnect: vi.fn(),
      });

      render(<ChatRoom {...defaultProps} />);

      expect(
        screen.getByText("Dr. Smith está escribiendo...")
      ).toBeInTheDocument();
    });

    it("should show connection status", () => {
      render(<ChatRoom {...defaultProps} />);

      expect(screen.getByTestId("connection-status")).toBeInTheDocument();
      expect(screen.getByText("Status: Connected")).toBeInTheDocument();
    });

    it("should show error display when error exists", () => {
      mockUseChatErrorHandler.mockReturnValue({
        error: { message: "Connection failed" },
        handleError: vi.fn(),
        clearError: vi.fn(),
        retryOperation: vi.fn(),
      });

      render(<ChatRoom {...defaultProps} />);

      expect(screen.getByTestId("error-display")).toBeInTheDocument();
      expect(screen.getByText("Error: Connection failed")).toBeInTheDocument();
    });
  });

  describe("message display", () => {
    it("should display message bubbles correctly", () => {
      render(<ChatRoom {...defaultProps} />);

      const messages = screen.getAllByText(/Hello world|Hi there!/);
      expect(messages).toHaveLength(2);
    });

    it("should show read receipts for own messages", () => {
      render(<ChatRoom {...defaultProps} />);

      // Check for read receipt indicators (✓ or ✓✓)
      const readReceipts = screen.getAllByText(/✓/);
      expect(readReceipts.length).toBeGreaterThan(0);
    });

    it("should display doctor badge for doctor messages", () => {
      render(<ChatRoom {...defaultProps} />);

      expect(screen.getByText("Doctor")).toBeInTheDocument();
    });

    it("should format message timestamps correctly", () => {
      render(<ChatRoom {...defaultProps} />);

      // Should show time format for today's messages
      expect(screen.getByText("10:00")).toBeInTheDocument();
      expect(screen.getByText("10:01")).toBeInTheDocument();
    });
  });

  describe("message input", () => {
    it("should allow typing and sending messages", async () => {
      const user = userEvent.setup();
      const mockSendMessage = vi.fn().mockResolvedValue(true);

      mockUseChatRealtime.mockReturnValue({
        messages: mockMessages,
        typingUsers: [],
        connectionStatus: { isConnected: true, isReconnecting: false },
        sendMessage: mockSendMessage,
        markMessagesAsRead: vi.fn(),
        setTyping: vi.fn(),
        loadMessages: vi.fn(),
        reconnect: vi.fn(),
      });

      render(<ChatRoom {...defaultProps} />);

      const input = screen.getByPlaceholderText("Escribe un mensaje...");
      const sendButton = screen.getByRole("button", { name: /send/i });

      await user.type(input, "New message");
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith("New message");
      });
    });

    it("should send message on Enter key press", async () => {
      const user = userEvent.setup();
      const mockSendMessage = vi.fn().mockResolvedValue(true);

      mockUseChatRealtime.mockReturnValue({
        messages: mockMessages,
        typingUsers: [],
        connectionStatus: { isConnected: true, isReconnecting: false },
        sendMessage: mockSendMessage,
        markMessagesAsRead: vi.fn(),
        setTyping: vi.fn(),
        loadMessages: vi.fn(),
        reconnect: vi.fn(),
      });

      render(<ChatRoom {...defaultProps} />);

      const input = screen.getByPlaceholderText("Escribe un mensaje...");

      await user.type(input, "New message{enter}");

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith("New message");
      });
    });

    it("should not send empty messages", async () => {
      const user = userEvent.setup();
      const mockSendMessage = vi.fn();

      mockUseChatRealtime.mockReturnValue({
        messages: mockMessages,
        typingUsers: [],
        connectionStatus: { isConnected: true, isReconnecting: false },
        sendMessage: mockSendMessage,
        markMessagesAsRead: vi.fn(),
        setTyping: vi.fn(),
        loadMessages: vi.fn(),
        reconnect: vi.fn(),
      });

      render(<ChatRoom {...defaultProps} />);

      const sendButton = screen.getByRole("button", { name: /send/i });
      await user.click(sendButton);

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("should disable input when disconnected", () => {
      mockUseChatRealtime.mockReturnValue({
        messages: mockMessages,
        typingUsers: [],
        connectionStatus: { isConnected: false, isReconnecting: true },
        sendMessage: vi.fn(),
        markMessagesAsRead: vi.fn(),
        setTyping: vi.fn(),
        loadMessages: vi.fn(),
        reconnect: vi.fn(),
      });

      render(<ChatRoom {...defaultProps} />);

      const input = screen.getByPlaceholderText("Conectando...");
      expect(input).toBeDisabled();
    });
  });

  describe("file upload", () => {
    it("should show file upload interface", async () => {
      const user = userEvent.setup();
      render(<ChatRoom {...defaultProps} />);

      const attachButton = screen.getByRole("button", { name: /paperclip/i });
      await user.click(attachButton);

      expect(screen.getByTestId("file-upload")).toBeInTheDocument();
    });

    it("should handle file upload", async () => {
      const user = userEvent.setup();
      const mockSendMessage = vi.fn().mockResolvedValue(true);

      mockUseChatRealtime.mockReturnValue({
        messages: mockMessages,
        typingUsers: [],
        connectionStatus: { isConnected: true, isReconnecting: false },
        sendMessage: mockSendMessage,
        markMessagesAsRead: vi.fn(),
        setTyping: vi.fn(),
        loadMessages: vi.fn(),
        reconnect: vi.fn(),
      });

      render(<ChatRoom {...defaultProps} />);

      const attachButton = screen.getByRole("button", { name: /paperclip/i });
      await user.click(attachButton);

      const uploadButton = screen.getByTestId("upload-file-btn");
      await user.click(uploadButton);

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith(
          "",
          "IMAGE",
          expect.objectContaining({
            name: "test.jpg",
            type: "image/jpeg",
          })
        );
      });
    });

    it("should handle file upload errors", async () => {
      const user = userEvent.setup();
      const mockHandleError = vi.fn();

      mockUseChatErrorHandler.mockReturnValue({
        error: null,
        handleError: mockHandleError,
        clearError: vi.fn(),
        retryOperation: vi.fn(),
      });

      render(<ChatRoom {...defaultProps} />);

      const attachButton = screen.getByRole("button", { name: /paperclip/i });
      await user.click(attachButton);

      const errorButton = screen.getByTestId("upload-error-btn");
      await user.click(errorButton);

      expect(mockHandleError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Upload failed" })
      );
    });

    it("should close file upload interface", async () => {
      const user = userEvent.setup();
      render(<ChatRoom {...defaultProps} />);

      const attachButton = screen.getByRole("button", { name: /paperclip/i });
      await user.click(attachButton);

      expect(screen.getByTestId("file-upload")).toBeInTheDocument();

      const closeButton = screen.getByRole("button", { name: /x/i });
      await user.click(closeButton);

      expect(screen.queryByTestId("file-upload")).not.toBeInTheDocument();
    });
  });

  describe("error handling", () => {
    it("should display error messages", () => {
      mockUseChatErrorHandler.mockReturnValue({
        error: { message: "Network error" },
        handleError: vi.fn(),
        clearError: vi.fn(),
        retryOperation: vi.fn(),
      });

      render(<ChatRoom {...defaultProps} />);

      expect(screen.getByText("Error: Network error")).toBeInTheDocument();
    });

    it("should handle retry operations", async () => {
      const user = userEvent.setup();
      const mockClearError = vi.fn();
      const mockReconnect = vi.fn();

      mockUseChatErrorHandler.mockReturnValue({
        error: { message: "Connection failed" },
        handleError: vi.fn(),
        clearError: mockClearError,
        retryOperation: vi.fn(),
      });

      mockUseChatRealtime.mockReturnValue({
        messages: mockMessages,
        typingUsers: [],
        connectionStatus: { isConnected: false, isReconnecting: false },
        sendMessage: vi.fn(),
        markMessagesAsRead: vi.fn(),
        setTyping: vi.fn(),
        loadMessages: vi.fn(),
        reconnect: mockReconnect,
      });

      render(<ChatRoom {...defaultProps} />);

      const retryButton = screen.getByTestId("retry-btn");
      await user.click(retryButton);

      expect(mockClearError).toHaveBeenCalled();
      expect(mockReconnect).toHaveBeenCalled();
    });

    it("should dismiss error messages", async () => {
      const user = userEvent.setup();
      const mockClearError = vi.fn();

      mockUseChatErrorHandler.mockReturnValue({
        error: { message: "Connection failed" },
        handleError: vi.fn(),
        clearError: mockClearError,
        retryOperation: vi.fn(),
      });

      render(<ChatRoom {...defaultProps} />);

      const dismissButton = screen.getByTestId("dismiss-btn");
      await user.click(dismissButton);

      expect(mockClearError).toHaveBeenCalled();
    });
  });

  describe("connection management", () => {
    it("should handle reconnection", async () => {
      const user = userEvent.setup();
      const mockReconnect = vi.fn();

      mockUseChatRealtime.mockReturnValue({
        messages: mockMessages,
        typingUsers: [],
        connectionStatus: { isConnected: false, isReconnecting: false },
        sendMessage: vi.fn(),
        markMessagesAsRead: vi.fn(),
        setTyping: vi.fn(),
        loadMessages: vi.fn(),
        reconnect: mockReconnect,
      });

      render(<ChatRoom {...defaultProps} />);

      const reconnectButton = screen.getByTestId("reconnect-btn");
      await user.click(reconnectButton);

      expect(mockReconnect).toHaveBeenCalled();
    });

    it("should show disconnected status", () => {
      mockUseChatRealtime.mockReturnValue({
        messages: mockMessages,
        typingUsers: [],
        connectionStatus: { isConnected: false, isReconnecting: false },
        sendMessage: vi.fn(),
        markMessagesAsRead: vi.fn(),
        setTyping: vi.fn(),
        loadMessages: vi.fn(),
        reconnect: vi.fn(),
      });

      render(<ChatRoom {...defaultProps} />);

      expect(screen.getByText("Status: Disconnected")).toBeInTheDocument();
    });
  });

  describe("message types", () => {
    it("should render image messages", () => {
      const imageMessage: ChatMessage = {
        id: "msg-img",
        chatRoomId: "room-1",
        senderId: "user-1",
        content: "Check this image",
        messageType: "IMAGE",
        fileUrl: "https://example.com/image.jpg",
        fileName: "image.jpg",
        isRead: false,
        sentAt: new Date(),
        sender: { id: "user-1", name: "John", role: "PATIENT" },
      };

      mockUseChatRealtime.mockReturnValue({
        messages: [imageMessage],
        typingUsers: [],
        connectionStatus: { isConnected: true, isReconnecting: false },
        sendMessage: vi.fn(),
        markMessagesAsRead: vi.fn(),
        setTyping: vi.fn(),
        loadMessages: vi.fn(),
        reconnect: vi.fn(),
      });

      render(<ChatRoom {...defaultProps} />);

      expect(screen.getByText("Check this image")).toBeInTheDocument();
      expect(screen.getByTestId("file-preview")).toBeInTheDocument();
    });

    it("should render file messages", () => {
      const fileMessage: ChatMessage = {
        id: "msg-file",
        chatRoomId: "room-1",
        senderId: "user-1",
        content: "Document attached",
        messageType: "FILE",
        fileUrl: "https://example.com/document.pdf",
        fileName: "document.pdf",
        isRead: false,
        sentAt: new Date(),
        sender: { id: "user-1", name: "John", role: "PATIENT" },
      };

      mockUseChatRealtime.mockReturnValue({
        messages: [fileMessage],
        typingUsers: [],
        connectionStatus: { isConnected: true, isReconnecting: false },
        sendMessage: vi.fn(),
        markMessagesAsRead: vi.fn(),
        setTyping: vi.fn(),
        loadMessages: vi.fn(),
        reconnect: vi.fn(),
      });

      render(<ChatRoom {...defaultProps} />);

      expect(screen.getByText("Document attached")).toBeInTheDocument();
      expect(screen.getByTestId("file-preview")).toBeInTheDocument();
    });

    it("should handle unsupported message types", () => {
      const unsupportedMessage: ChatMessage = {
        id: "msg-unsupported",
        chatRoomId: "room-1",
        senderId: "user-1",
        content: "Unsupported content",
        messageType: "UNKNOWN" as any,
        isRead: false,
        sentAt: new Date(),
        sender: { id: "user-1", name: "John", role: "PATIENT" },
      };

      mockUseChatRealtime.mockReturnValue({
        messages: [unsupportedMessage],
        typingUsers: [],
        connectionStatus: { isConnected: true, isReconnecting: false },
        sendMessage: vi.fn(),
        markMessagesAsRead: vi.fn(),
        setTyping: vi.fn(),
        loadMessages: vi.fn(),
        reconnect: vi.fn(),
      });

      render(<ChatRoom {...defaultProps} />);

      expect(
        screen.getByText("Tipo de mensaje no soportado")
      ).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("should have proper ARIA labels", () => {
      render(<ChatRoom {...defaultProps} />);

      const input = screen.getByPlaceholderText("Escribe un mensaje...");
      expect(input).toHaveAttribute("type", "text");
    });

    it("should support keyboard navigation", async () => {
      const user = userEvent.setup();
      render(<ChatRoom {...defaultProps} />);

      const input = screen.getByPlaceholderText("Escribe un mensaje...");

      await user.tab();
      expect(input).toHaveFocus();
    });
  });

  describe("cleanup", () => {
    it("should handle component unmount", () => {
      const { unmount } = render(<ChatRoom {...defaultProps} />);

      expect(() => unmount()).not.toThrow();
    });
  });
});
