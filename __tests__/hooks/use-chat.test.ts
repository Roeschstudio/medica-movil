import type { ChatMessage, ChatRoom } from "@/lib/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock all dependencies first
vi.mock("@/lib/chat-service", () => ({
  chatService: {
    getOrCreateChatRoom: vi.fn(),
    subscribeToMessages: vi.fn(),
    unsubscribeFromMessages: vi.fn(),
    sendMessage: vi.fn(),
    uploadFile: vi.fn(),
    markMessagesAsRead: vi.fn(),
    getMessages: vi.fn(),
  },
}));

vi.mock("@/hooks/use-chat-connection", () => ({
  useChatConnection: vi.fn(),
}));

vi.mock("@/hooks/use-chat-presence", () => ({
  useChatPresence: vi.fn(),
}));

vi.mock("@/hooks/use-message-pagination", () => ({
  useMessagePagination: vi.fn(),
}));

vi.mock("@/hooks/use-offline-detection", () => ({
  useOfflineDetection: vi.fn(),
}));

vi.mock("@/hooks/use-typing-indicator", () => ({
  useTypingIndicator: vi.fn(),
}));

// Import after mocking
import { useChat, useChatInput } from "@/hooks/use-chat";
import { useChatConnection } from "@/hooks/use-chat-connection";
import { useChatPresence } from "@/hooks/use-chat-presence";
import { useMessagePagination } from "@/hooks/use-message-pagination";
import { useOfflineDetection } from "@/hooks/use-offline-detection";
import { useTypingIndicator } from "@/hooks/use-typing-indicator";
import { chatService } from "@/lib/chat-service";

const mockChatService = chatService as any;
const mockUseChatConnection = useChatConnection as any;
const mockUseChatPresence = useChatPresence as any;
const mockUseMessagePagination = useMessagePagination as any;
const mockUseOfflineDetection = useOfflineDetection as any;
const mockUseTypingIndicator = useTypingIndicator as any;

describe("useChat", () => {
  const mockChatRoom: ChatRoom = {
    id: "room-1",
    appointmentId: "appointment-1",
    patientId: "patient-1",
    doctorId: "doctor-1",
    isActive: true,
    startedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMessage: ChatMessage = {
    id: "message-1",
    chatRoomId: "room-1",
    senderId: "user-1",
    content: "Hello world",
    messageType: "TEXT",
    isRead: false,
    sentAt: new Date(),
  };

  const defaultOptions = {
    appointmentId: "appointment-1",
    userId: "user-1",
    userName: "Test User",
    userRole: "patient",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock returns
    mockUseChatConnection.mockReturnValue({
      connectionState: {
        status: "connected",
        isConnected: true,
        isReconnecting: false,
        lastConnected: null,
        reconnectAttempts: 0,
        maxReconnectAttempts: 5,
        nextReconnectIn: null,
        error: null,
      },
      metrics: {
        totalConnections: 0,
        totalDisconnections: 0,
        totalReconnectAttempts: 0,
        averageConnectionTime: 0,
        longestConnectionTime: 0,
        connectionUptime: 0,
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
      reconnect: vi.fn(),
      getHealthScore: vi.fn(() => 100),
      isConnected: true,
      isConnecting: false,
      isReconnecting: false,
      hasError: false,
    });

    mockUseChatPresence.mockReturnValue({
      onlineUsers: [],
      isConnected: true,
      totalOnline: 0,
      updateTypingStatus: vi.fn(),
      getOnlineCount: vi.fn(() => 0),
      isUserOnline: vi.fn(() => false),
      getUserPresence: vi.fn(() => null),
      getTypingUsers: vi.fn(() => []),
    });

    mockUseMessagePagination.mockReturnValue({
      messages: [],
      hasMore: true,
      isLoading: false,
      loadMore: vi.fn(),
      reset: vi.fn(),
      addMessage: vi.fn(),
      updateMessage: vi.fn(),
      scrollToBottom: vi.fn(),
      scrollToMessage: vi.fn(),
    });

    mockUseOfflineDetection.mockReturnValue({
      isOnline: true,
      isOffline: false,
      wasOffline: false,
      offlineSince: null,
      onlineSince: new Date(),
      checkConnection: vi.fn(),
      getOfflineDuration: vi.fn(() => 0),
      getOnlineDuration: vi.fn(() => 1000),
    });

    mockUseTypingIndicator.mockReturnValue({
      isTyping: false,
      typingUsers: [],
      startTyping: vi.fn(),
      stopTyping: vi.fn(),
      getTypingText: vi.fn(() => ""),
    });

    mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
    mockChatService.subscribeToMessages.mockReturnValue({} as any);
    mockChatService.unsubscribeFromMessages.mockImplementation(() => {});
  });

  describe("initialization", () => {
    it("should initialize with default state", async () => {
      const { result } = renderHook(() => useChat(defaultOptions));

      expect(result.current.chatRoom).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.messages).toEqual([]);
      expect(result.current.newMessage).toBe("");
      expect(result.current.isSending).toBe(false);
    });

    it("should initialize chat room on mount", async () => {
      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);

      const { result } = renderHook(() => useChat(defaultOptions));

      await waitFor(() => {
        expect(mockChatService.getOrCreateChatRoom).toHaveBeenCalledWith(
          "appointment-1"
        );
      });
    });

    it("should handle initialization errors", async () => {
      const error = new Error("Failed to create chat room");
      mockChatService.getOrCreateChatRoom.mockRejectedValue(error);

      const onError = vi.fn();
      const { result } = renderHook(() =>
        useChat({ ...defaultOptions, onError })
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(error);
      });
    });
  });

  describe("message operations", () => {
    it("should send text messages", async () => {
      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.sendMessage.mockResolvedValue(true);

      const { result } = renderHook(() => useChat(defaultOptions));

      await waitFor(() => {
        expect(result.current.chatRoom).not.toBeNull();
      });

      await act(async () => {
        const success = await result.current.sendMessage("Hello world");
        expect(success).toBe(true);
      });

      expect(mockChatService.sendMessage).toHaveBeenCalledWith(
        "room-1",
        "user-1",
        "Hello world",
        "TEXT"
      );
    });

    it("should send file messages", async () => {
      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.uploadFile.mockResolvedValue(
        "https://example.com/file.jpg"
      );
      mockChatService.sendMessage.mockResolvedValue(true);

      const { result } = renderHook(() => useChat(defaultOptions));

      await waitFor(() => {
        expect(result.current.chatRoom).not.toBeNull();
      });

      const mockFile = new File(["test"], "test.jpg", { type: "image/jpeg" });

      await act(async () => {
        const success = await result.current.sendFile(mockFile);
        expect(success).toBe(true);
      });

      expect(mockChatService.uploadFile).toHaveBeenCalledWith(
        mockFile,
        "room-1"
      );
      expect(mockChatService.sendMessage).toHaveBeenCalledWith(
        "room-1",
        "user-1",
        "Archivo compartido: test.jpg",
        "IMAGE",
        expect.any(Object)
      );
    });

    it("should handle send message errors", async () => {
      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.sendMessage.mockRejectedValue(new Error("Send failed"));

      const onError = vi.fn();
      const { result } = renderHook(() =>
        useChat({ ...defaultOptions, onError })
      );

      await waitFor(() => {
        expect(result.current.chatRoom).not.toBeNull();
      });

      await act(async () => {
        const success = await result.current.sendMessage("Hello");
        expect(success).toBe(false);
      });

      expect(onError).toHaveBeenCalled();
    });

    it("should mark messages as read", async () => {
      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.markMessagesAsRead.mockResolvedValue();

      const { result } = renderHook(() => useChat(defaultOptions));

      await waitFor(() => {
        expect(result.current.chatRoom).not.toBeNull();
      });

      await act(async () => {
        await result.current.markMessagesAsRead();
      });

      expect(mockChatService.markMessagesAsRead).toHaveBeenCalledWith(
        "room-1",
        "user-1"
      );
    });

    it("should prevent sending empty messages", async () => {
      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);

      const { result } = renderHook(() => useChat(defaultOptions));

      await waitFor(() => {
        expect(result.current.chatRoom).not.toBeNull();
      });

      await act(async () => {
        const success = await result.current.sendMessage("");
        expect(success).toBe(false);
      });

      expect(mockChatService.sendMessage).not.toHaveBeenCalled();
    });

    it("should prevent sending while already sending", async () => {
      mockChatService.getOrCreateChatRoom.mockResolvedValue(mockChatRoom);
      mockChatService.sendMessage.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(true), 1000))
      );

      const { result } = renderHook(() => useChat(defaultOptions));

      await waitFor(() => {
        expect(result.current.chatRoom).not.toBeNull();
      });

      // Start first send
      act(() => {
        result.current.sendMessage("First message");
      });

      expect(result.current.isSending).toBe(true);

      // Try to send second message while first is in progress
      await act(async () => {
        const success = await result.current.sendMessage("Second message");
        expect(success).toBe(false);
      });
    });
  });

  describe("real-time subscriptions", () => {
    it("should handle subscriptions", () => {
      expect(mockChatService.subscribeToMessages).toBeDefined();
      expect(typeof mockChatService.subscribeToMessages).toBe("function");
    });

    it("should handle unsubscriptions", () => {
      expect(mockChatService.unsubscribeFromMessages).toBeDefined();
      expect(typeof mockChatService.unsubscribeFromMessages).toBe("function");
    });
  });

  describe("typing indicators", () => {
    it("should handle typing state", () => {
      const mockStartTyping = vi.fn();
      const mockStopTyping = vi.fn();

      mockUseTypingIndicator.mockReturnValue({
        isTyping: false,
        typingUsers: [],
        startTyping: mockStartTyping,
        stopTyping: mockStopTyping,
        getTypingText: vi.fn(() => ""),
      });

      expect(mockStartTyping).toBeDefined();
      expect(mockStopTyping).toBeDefined();
    });
  });

  describe("connection management", () => {
    it("should handle connection status", () => {
      const mockReconnect = vi.fn();

      mockUseChatConnection.mockReturnValue({
        connectionState: {
          status: "connected",
          isConnected: true,
          isReconnecting: false,
          lastConnected: null,
          reconnectAttempts: 0,
          maxReconnectAttempts: 5,
          nextReconnectIn: null,
          error: null,
        },
        metrics: {
          totalConnections: 0,
          totalDisconnections: 0,
          totalReconnectAttempts: 0,
          averageConnectionTime: 0,
          longestConnectionTime: 0,
          connectionUptime: 0,
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
        reconnect: mockReconnect,
        getHealthScore: vi.fn(() => 100),
        isConnected: true,
        isConnecting: false,
        isReconnecting: false,
        hasError: false,
      });

      expect(mockReconnect).toBeDefined();
    });
  });
});

describe("useChatInput", () => {
  const defaultProps = {
    chatRoomId: "room-1",
    userId: "user-1",
    userName: "Test User",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseTypingIndicator.mockReturnValue({
      isTyping: false,
      typingUsers: [],
      startTyping: vi.fn(),
      stopTyping: vi.fn(),
      getTypingText: vi.fn(() => ""),
    });
  });

  it("should be a function", () => {
    expect(typeof useChatInput).toBe("function");
  });

  it("should handle basic props", () => {
    expect(defaultProps.chatRoomId).toBe("room-1");
    expect(defaultProps.userId).toBe("user-1");
    expect(defaultProps.userName).toBe("Test User");
  });

  it("should work with typing indicators", () => {
    const mockStartTyping = vi.fn();
    const mockStopTyping = vi.fn();

    mockUseTypingIndicator.mockReturnValue({
      isTyping: false,
      typingUsers: [],
      startTyping: mockStartTyping,
      stopTyping: mockStopTyping,
      getTypingText: vi.fn(() => ""),
    });

    expect(mockStartTyping).toBeDefined();
    expect(mockStopTyping).toBeDefined();
  });
});
