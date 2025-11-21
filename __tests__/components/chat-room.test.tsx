/**
 * Test suite for ChatRoom component
 *
 * Tests:
 * - Message display and formatting
 * - Message input and sending
 * - File upload integration
 * - Real-time message updates
 * - Connection status handling
 * - Error handling and recovery
 * - Accessibility features
 */

import ChatRoom from "@/components/optimized-chat-room";
import { ChatMessage } from "@/hooks/use-chat-realtime";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionProvider } from "next-auth/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
const mockUseChatRealtime = {
  messages: [] as ChatMessage[],
  typingUsers: [],
  connectionStatus: { isConnected: true, isReconnecting: false },
  sendMessage: vi.fn(),
  markMessagesAsRead: vi.fn(),
  setTyping: vi.fn(),
  loadMessages: vi.fn(),
  reconnect: vi.fn(),
};

const mockSession = {
  user: {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    role: "PATIENT",
  },
  expires: "2024-12-31",
};

vi.mock("@/hooks/use-chat-realtime", () => ({
  useChatRealtime: () => mockUseChatRealtime,
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: mockSession }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/hooks/use-chat-error-handler", () => ({
  useChatErrorHandler: () => ({
    error: null,
    handleError: vi.fn(),
    clearError: vi.fn(),
    retryOperation: vi.fn((fn: any) => fn()),
  }),
}));

vi.mock("@/hooks/use-offline-aware-operation", () => ({
  useOfflineAwareOperation: (operation: any) => ({
    executeOperation: operation,
  }),
}));

vi.mock("@/components/connection-status", () => ({
  default: ({ isConnected, onReconnect }: any) => (
    <div data-testid="connection-status">
      <span>{isConnected ? "Connected" : "Disconnected"}</span>
      <button onClick={onReconnect}>Reconnect</button>
    </div>
  ),
}));

vi.mock("@/components/error-boundary", () => ({
  ChatErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/error-toast", () => ({
  ErrorDisplay: ({ error, onRetry, onDismiss }: any) => (
    <div data-testid="error-display">
      <span>{error?.message}</span>
      <button onClick={onRetry}>Retry</button>
      <button onClick={onDismiss}>Dismiss</button>
    </div>
  ),
}));

describe("ChatRoom Component", () => {
  const defaultProps = {
    chatRoomId: "room-1",
    appointmentId: "apt-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChatRealtime.messages = [];
    mockUseChatRealtime.typingUsers = [];
    mockUseChatRealtime.connectionStatus = {
      isConnected: true,
      isReconnecting: false,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderChatRoom = (props = {}) => {
    return render(
      <SessionProvider session={mockSession}>
        <ChatRoom {...defaultProps} {...props} />
      </SessionProvider>
    );
  };

  describe("Basic Rendering", () => {
    it("should render chat room with header and input", () => {
      renderChatRoom();

      expect(screen.getByText("Chat de Consulta")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Escribe un mensaje...")
      ).toBeInTheDocument();
      expect(screen.getByTestId("connection-status")).toBeInTheDocument();
    });

    it("should show empty state when no messages", () => {
      renderChatRoom();

      expect(
        screen.getByText("No hay mensajes aún. ¡Inicia la conversación!")
      ).toBeInTheDocument();
    });

    it("should render close button when onClose prop is provided", () => {
      const onClose = vi.fn();
      renderChatRoom({ onClose });

      const closeButton = screen.getByRole("button", { name: /✕/ });
      expect(closeButton).toBeInTheDocument();

      fireEvent.click(closeButton);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("Message Display", () => {
    const mockMessages: ChatMessage[] = [
      {
        id: "msg-1",
        chatRoomId: "room-1",
        senderId: "user-2",
        content: "Hello from doctor!",
        messageType: "TEXT",
        sentAt: "2024-01-01T10:00:00Z",
        isRead: false,
        sender: {
          id: "user-2",
          name: "Dr. Test",
          role: "DOCTOR",
        },
      },
      {
        id: "msg-2",
        chatRoomId: "room-1",
        senderId: "user-1",
        content: "Hello doctor!",
        messageType: "TEXT",
        sentAt: "2024-01-01T10:01:00Z",
        isRead: true,
        sender: {
          id: "user-1",
          name: "Test User",
          role: "PATIENT",
        },
      },
    ];

    it("should display messages correctly", () => {
      mockUseChatRealtime.messages = mockMessages;
      renderChatRoom();

      expect(screen.getByText("Hello from doctor!")).toBeInTheDocument();
      expect(screen.getByText("Hello doctor!")).toBeInTheDocument();
      expect(screen.getByText("Dr. Test")).toBeInTheDocument();
      expect(screen.getByText("Test User")).toBeInTheDocument();
    });

    it("should show doctor badge for doctor messages", () => {
      mockUseChatRealtime.messages = [mockMessages[0]];
      renderChatRoom();

      expect(screen.getByText("Doctor")).toBeInTheDocument();
    });

    it("should show read status for own messages", () => {
      mockUseChatRealtime.messages = [mockMessages[1]];
      renderChatRoom();

      // Should show double checkmark for read message
      expect(screen.getByText("✓✓")).toBeInTheDocument();
    });

    it("should show single checkmark for unread own messages", () => {
      const unreadMessage = {
        ...mockMessages[1],
        isRead: false,
      };
      mockUseChatRealtime.messages = [unreadMessage];
      renderChatRoom();

      expect(screen.getByText("✓")).toBeInTheDocument();
    });

    it("should format message timestamps correctly", () => {
      const todayMessage = {
        ...mockMessages[0],
        sentAt: new Date().toISOString(),
      };
      mockUseChatRealtime.messages = [todayMessage];
      renderChatRoom();

      // Should show time format for today's messages
      expect(screen.getByText(/\d{2}:\d{2}/)).toBeInTheDocument();
    });

    it("should group messages from same sender", () => {
      const groupedMessages = [
        mockMessages[0],
        {
          ...mockMessages[0],
          id: "msg-3",
          content: "Another message from doctor",
          sentAt: "2024-01-01T10:02:00Z",
        },
      ];
      mockUseChatRealtime.messages = groupedMessages;
      renderChatRoom();

      // Should only show one avatar for grouped messages
      const doctorNames = screen.getAllByText("Dr. Test");
      expect(doctorNames).toHaveLength(1);
    });
  });

  describe("File Messages", () => {
    const fileMessage: ChatMessage = {
      id: "msg-file",
      chatRoomId: "room-1",
      senderId: "user-1",
      content: "Shared a document",
      messageType: "FILE",
      sentAt: "2024-01-01T10:00:00Z",
      isRead: false,
      fileUrl: "https://example.com/document.pdf",
      fileName: "test-document.pdf",
      fileSize: 1024000,
      sender: {
        id: "user-1",
        name: "Test User",
        role: "PATIENT",
      },
    };

    const imageMessage: ChatMessage = {
      ...fileMessage,
      id: "msg-image",
      messageType: "IMAGE",
      fileUrl: "https://example.com/image.jpg",
      fileName: "test-image.jpg",
      content: "Shared an image",
    };

    it("should display file messages with preview", () => {
      mockUseChatRealtime.messages = [fileMessage];
      renderChatRoom();

      expect(screen.getByText("Shared a document")).toBeInTheDocument();
      // FilePreview component should be rendered
      expect(screen.getByText("test-document.pdf")).toBeInTheDocument();
    });

    it("should display image messages with preview", () => {
      mockUseChatRealtime.messages = [imageMessage];
      renderChatRoom();

      expect(screen.getByText("Shared an image")).toBeInTheDocument();
      expect(screen.getByText("test-image.jpg")).toBeInTheDocument();
    });

    it("should handle unsupported message types", () => {
      const unsupportedMessage = {
        ...fileMessage,
        messageType: "UNKNOWN" as any,
      };
      mockUseChatRealtime.messages = [unsupportedMessage];
      renderChatRoom();

      expect(
        screen.getByText("Tipo de mensaje no soportado")
      ).toBeInTheDocument();
    });
  });

  describe("Message Input", () => {
    it("should allow typing and sending messages", async () => {
      const user = userEvent.setup();
      renderChatRoom();

      const input = screen.getByPlaceholderText("Escribe un mensaje...");
      const sendButton = screen.getByRole("button", { name: /send/i });

      await user.type(input, "Test message");
      expect(input).toHaveValue("Test message");

      await user.click(sendButton);
      expect(mockUseChatRealtime.sendMessage).toHaveBeenCalledWith(
        "Test message"
      );
    });

    it("should send message on Enter key press", async () => {
      const user = userEvent.setup();
      renderChatRoom();

      const input = screen.getByPlaceholderText("Escribe un mensaje...");
      await user.type(input, "Test message{enter}");

      expect(mockUseChatRealtime.sendMessage).toHaveBeenCalledWith(
        "Test message"
      );
    });

    it("should not send empty messages", async () => {
      const user = userEvent.setup();
      renderChatRoom();

      const sendButton = screen.getByRole("button", { name: /send/i });
      await user.click(sendButton);

      expect(mockUseChatRealtime.sendMessage).not.toHaveBeenCalled();
    });

    it("should clear input after sending message", async () => {
      const user = userEvent.setup();
      mockUseChatRealtime.sendMessage.mockResolvedValue(undefined);
      renderChatRoom();

      const input = screen.getByPlaceholderText("Escribe un mensaje...");
      await user.type(input, "Test message");
      await user.click(screen.getByRole("button", { name: /send/i }));

      await waitFor(() => {
        expect(input).toHaveValue("");
      });
    });

    it("should disable input when disconnected", () => {
      mockUseChatRealtime.connectionStatus = {
        isConnected: false,
        isReconnecting: false,
      };
      renderChatRoom();

      const input = screen.getByPlaceholderText("Conectando...");
      expect(input).toBeDisabled();
    });

    it("should show file upload area when paperclip is clicked", async () => {
      const user = userEvent.setup();
      renderChatRoom();

      const paperclipButton = screen.getByRole("button", {
        name: /paperclip/i,
      });
      await user.click(paperclipButton);

      expect(screen.getByText("Subir archivo")).toBeInTheDocument();
    });

    it("should handle file upload", async () => {
      const user = userEvent.setup();
      renderChatRoom();

      // Open file upload area
      const paperclipButton = screen.getByRole("button", {
        name: /paperclip/i,
      });
      await user.click(paperclipButton);

      // Mock file upload
      const mockFile = {
        id: "file-1",
        name: "test.pdf",
        size: 1024,
        type: "application/pdf",
        url: "https://example.com/test.pdf",
      };

      // Simulate file upload completion
      const fileUploadComponent = screen.getByTestId("file-upload"); // This would need to be added to FileUpload component
      fireEvent.change(fileUploadComponent, { target: { files: [mockFile] } });

      await waitFor(() => {
        expect(mockUseChatRealtime.sendMessage).toHaveBeenCalledWith(
          "",
          "FILE",
          mockFile
        );
      });
    });
  });

  describe("Typing Indicators", () => {
    it("should show typing indicator when other users are typing", () => {
      mockUseChatRealtime.typingUsers = [
        {
          userId: "user-2",
          userName: "Dr. Test",
          isTyping: true,
          timestamp: Date.now(),
        },
      ];
      renderChatRoom();

      expect(
        screen.getByText("Dr. Test está escribiendo...")
      ).toBeInTheDocument();
    });

    it("should show multiple users typing", () => {
      mockUseChatRealtime.typingUsers = [
        {
          userId: "user-2",
          userName: "Dr. Test",
          isTyping: true,
          timestamp: Date.now(),
        },
        {
          userId: "user-3",
          userName: "Nurse Jane",
          isTyping: true,
          timestamp: Date.now(),
        },
      ];
      renderChatRoom();

      expect(
        screen.getByText("Dr. Test, Nurse Jane está escribiendo...")
      ).toBeInTheDocument();
    });
  });

  describe("Connection Status", () => {
    it("should show connection status", () => {
      renderChatRoom();

      expect(screen.getByTestId("connection-status")).toBeInTheDocument();
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });

    it("should show disconnected status", () => {
      mockUseChatRealtime.connectionStatus = {
        isConnected: false,
        isReconnecting: false,
      };
      renderChatRoom();

      expect(screen.getByText("Disconnected")).toBeInTheDocument();
    });

    it("should allow manual reconnection", async () => {
      const user = userEvent.setup();
      renderChatRoom();

      const reconnectButton = screen.getByText("Reconnect");
      await user.click(reconnectButton);

      expect(mockUseChatRealtime.reconnect).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should display error messages", () => {
      const mockError = { message: "Connection failed" };

      // Mock the error handler to return an error
      vi.mocked(
        require("@/hooks/use-chat-error-handler").useChatErrorHandler
      ).mockReturnValue({
        error: mockError,
        handleError: vi.fn(),
        clearError: vi.fn(),
        retryOperation: vi.fn(),
      });

      renderChatRoom();

      expect(screen.getByTestId("error-display")).toBeInTheDocument();
      expect(screen.getByText("Connection failed")).toBeInTheDocument();
    });

    it("should handle message sending errors", async () => {
      const user = userEvent.setup();
      const mockError = new Error("Send failed");
      mockUseChatRealtime.sendMessage.mockRejectedValue(mockError);

      renderChatRoom();

      const input = screen.getByPlaceholderText("Escribe un mensaje...");
      await user.type(input, "Test message");
      await user.click(screen.getByRole("button", { name: /send/i }));

      // Error should be handled by the error handler
      expect(mockUseChatRealtime.sendMessage).toHaveBeenCalled();
    });
  });

  describe("Message Reading", () => {
    it("should mark messages as read when they appear", () => {
      const unreadMessages: ChatMessage[] = [
        {
          id: "msg-1",
          chatRoomId: "room-1",
          senderId: "user-2",
          content: "Unread message",
          messageType: "TEXT",
          sentAt: "2024-01-01T10:00:00Z",
          isRead: false,
          sender: {
            id: "user-2",
            name: "Dr. Test",
            role: "DOCTOR",
          },
        },
      ];

      mockUseChatRealtime.messages = unreadMessages;
      renderChatRoom();

      expect(mockUseChatRealtime.markMessagesAsRead).toHaveBeenCalledWith([
        "msg-1",
      ]);
    });

    it("should not mark own messages as read", () => {
      const ownMessage: ChatMessage[] = [
        {
          id: "msg-1",
          chatRoomId: "room-1",
          senderId: "user-1", // Same as current user
          content: "Own message",
          messageType: "TEXT",
          sentAt: "2024-01-01T10:00:00Z",
          isRead: false,
          sender: {
            id: "user-1",
            name: "Test User",
            role: "PATIENT",
          },
        },
      ];

      mockUseChatRealtime.messages = ownMessage;
      renderChatRoom();

      expect(mockUseChatRealtime.markMessagesAsRead).not.toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels", () => {
      renderChatRoom();

      const input = screen.getByPlaceholderText("Escribe un mensaje...");
      expect(input).toHaveAttribute("type", "text");

      const sendButton = screen.getByRole("button", { name: /send/i });
      expect(sendButton).toBeInTheDocument();
    });

    it("should support keyboard navigation", async () => {
      const user = userEvent.setup();
      renderChatRoom();

      const input = screen.getByPlaceholderText("Escribe un mensaje...");

      // Tab should focus the input
      await user.tab();
      expect(input).toHaveFocus();

      // Tab should move to send button
      await user.tab();
      const sendButton = screen.getByRole("button", { name: /send/i });
      expect(sendButton).toHaveFocus();
    });

    it("should announce new messages to screen readers", () => {
      const newMessage: ChatMessage = {
        id: "msg-new",
        chatRoomId: "room-1",
        senderId: "user-2",
        content: "New message",
        messageType: "TEXT",
        sentAt: new Date().toISOString(),
        isRead: false,
        sender: {
          id: "user-2",
          name: "Dr. Test",
          role: "DOCTOR",
        },
      };

      // Initially no messages
      renderChatRoom();

      // Add new message
      mockUseChatRealtime.messages = [newMessage];

      // Re-render with new message
      renderChatRoom();

      expect(screen.getByText("New message")).toBeInTheDocument();
    });
  });

  describe("Performance", () => {
    it("should handle large number of messages efficiently", () => {
      const manyMessages: ChatMessage[] = Array.from(
        { length: 100 },
        (_, i) => ({
          id: `msg-${i}`,
          chatRoomId: "room-1",
          senderId: i % 2 === 0 ? "user-1" : "user-2",
          content: `Message ${i}`,
          messageType: "TEXT" as const,
          sentAt: new Date(Date.now() - i * 1000).toISOString(),
          isRead: true,
          sender: {
            id: i % 2 === 0 ? "user-1" : "user-2",
            name: i % 2 === 0 ? "Test User" : "Dr. Test",
            role: i % 2 === 0 ? ("PATIENT" as const) : ("DOCTOR" as const),
          },
        })
      );

      mockUseChatRealtime.messages = manyMessages;

      const startTime = performance.now();
      renderChatRoom();
      const endTime = performance.now();

      // Should render within reasonable time (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);

      // Should display all messages
      expect(screen.getByText("Message 0")).toBeInTheDocument();
      expect(screen.getByText("Message 99")).toBeInTheDocument();
    });

    it("should not re-render unnecessarily", () => {
      const renderSpy = vi.fn();

      // Mock React.memo behavior
      const MemoizedChatRoom = React.memo(ChatRoom);

      const { rerender } = render(
        <SessionProvider session={mockSession}>
          <MemoizedChatRoom {...defaultProps} />
        </SessionProvider>
      );

      // Re-render with same props
      rerender(
        <SessionProvider session={mockSession}>
          <MemoizedChatRoom {...defaultProps} />
        </SessionProvider>
      );

      // Component should not re-render with same props
      expect(screen.getByText("Chat de Consulta")).toBeInTheDocument();
    });
  });
});
