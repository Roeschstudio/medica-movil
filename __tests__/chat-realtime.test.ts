/**
 * Test suite for real-time chat functionality
 *
 * This file contains tests for:
 * - Real-time message subscription
 * - Connection management and reconnection
 * - Typing indicators
 * - Presence tracking
 * - Message broadcasting
 */

import { useChatConnection } from "@/hooks/use-chat-connection";
import { useChatRealtime } from "@/hooks/use-chat-realtime";
import { useTypingIndicator } from "@/hooks/use-typing-indicator";
import { chatService } from "@/lib/chat-service";
import { chatBroadcastService } from "@/lib/chat-broadcast";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Supabase client
const mockSupabaseClient = {
  channel: vi.fn(),
  from: vi.fn(),
};

const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  track: vi.fn(),
  send: vi.fn(),
  presenceState: vi.fn(),
  state: "joined",
};

vi.mock("@/lib/supabase", () => ({
  createSupabaseBrowserClient: () => mockSupabaseClient,
  createSupabaseAdminClient: () => mockSupabaseClient,
}));

describe("Real-time Chat Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient.channel.mockReturnValue(mockChannel);
    mockChannel.subscribe.mockImplementation((callback) => {
      // Simulate successful subscription
      setTimeout(() => callback("SUBSCRIBED"), 0);
      return Promise.resolve();
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("useChatRealtime Hook", () => {
    const defaultProps = {
      chatRoomId: "test-room-1",
      userId: "user-1",
      userName: "Test User",
    };

    it("should initialize with empty messages and disconnected state", () => {
      const { result } = renderHook(() => useChatRealtime(defaultProps));

      expect(result.current.messages).toEqual([]);
      expect(result.current.connectionStatus.isConnected).toBe(false);
    });

    it("should subscribe to chat messages on mount", async () => {
      renderHook(() => useChatRealtime(defaultProps));

      await waitFor(() => {
        expect(mockSupabaseClient.channel).toHaveBeenCalledWith(
          `chat_room_${defaultProps.chatRoomId}`
        );
        expect(mockChannel.on).toHaveBeenCalledWith(
          "postgres_changes",
          expect.objectContaining({
            event: "INSERT",
            table: "chat_messages",
            filter: `chatRoomId=eq.${defaultProps.chatRoomId}`,
          }),
          expect.any(Function)
        );
      });
    });

    it("should handle new message events", async () => {
      const onNewMessage = vi.fn();
      const { result } = renderHook(() =>
        useChatRealtime({ ...defaultProps, onNewMessage })
      );

      // Simulate receiving a new message
      const newMessage = {
        id: "msg-1",
        chatRoomId: defaultProps.chatRoomId,
        senderId: "user-2",
        content: "Hello!",
        messageType: "TEXT",
        sentAt: new Date().toISOString(),
      };

      // Get the INSERT event handler
      const insertHandler = mockChannel.on.mock.calls.find(
        (call) => call[1].event === "INSERT"
      )?.[2];

      act(() => {
        insertHandler?.({ new: newMessage });
      });

      await waitFor(() => {
        expect(result.current.messages).toContainEqual(newMessage);
        expect(onNewMessage).toHaveBeenCalledWith(newMessage);
      });
    });

    it("should send messages correctly", async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "msg-1", content: "Test message" },
            error: null,
          }),
        }),
      });

      mockSupabaseClient.from.mockReturnValue({
        insert: mockInsert,
      });

      const { result } = renderHook(() => useChatRealtime(defaultProps));

      await act(async () => {
        await result.current.sendMessage("Test message");
      });

      expect(mockInsert).toHaveBeenCalledWith({
        chatRoomId: defaultProps.chatRoomId,
        senderId: defaultProps.userId,
        content: "Test message",
        messageType: "TEXT",
        fileUrl: undefined,
        fileName: undefined,
        fileSize: undefined,
        isRead: false,
      });
    });

    it("should handle connection errors and attempt reconnection", async () => {
      const onConnectionStatusChange = vi.fn();

      renderHook(() =>
        useChatRealtime({ ...defaultProps, onConnectionStatusChange })
      );

      // Simulate connection error
      const subscribeCallback = mockChannel.subscribe.mock.calls[0][0];

      act(() => {
        subscribeCallback("CHANNEL_ERROR");
      });

      await waitFor(() => {
        expect(onConnectionStatusChange).toHaveBeenCalledWith(
          expect.objectContaining({
            isConnected: false,
            isReconnecting: true,
          })
        );
      });
    });
  });

  describe("useChatConnection Hook", () => {
    const defaultProps = {
      chatRoomId: "test-room-1",
      userId: "user-1",
    };

    it("should start in disconnected state", () => {
      const { result } = renderHook(() => useChatConnection(defaultProps));

      expect(result.current.connectionState.status).toBe("disconnected");
      expect(result.current.isConnected).toBe(false);
    });

    it("should attempt to connect on mount", async () => {
      renderHook(() => useChatConnection(defaultProps));

      await waitFor(() => {
        expect(mockSupabaseClient.channel).toHaveBeenCalled();
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });
    });

    it("should handle successful connection", async () => {
      const onConnectionChange = vi.fn();

      renderHook(() =>
        useChatConnection({ ...defaultProps, onConnectionChange })
      );

      // Simulate successful subscription
      const subscribeCallback = mockChannel.subscribe.mock.calls[0][0];

      act(() => {
        subscribeCallback("SUBSCRIBED");
      });

      await waitFor(() => {
        expect(onConnectionChange).toHaveBeenCalledWith(
          expect.objectContaining({
            status: "connected",
            isOnline: true,
          })
        );
      });
    });

    it("should implement exponential backoff for reconnection", async () => {
      vi.useFakeTimers();

      const { result } = renderHook(() =>
        useChatConnection({ ...defaultProps, maxReconnectAttempts: 3 })
      );

      // Simulate connection error
      const subscribeCallback = mockChannel.subscribe.mock.calls[0][0];

      act(() => {
        subscribeCallback("CHANNEL_ERROR");
      });

      // First reconnect attempt should be after ~1 second
      expect(result.current.connectionState.reconnectAttempts).toBe(1);

      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalledTimes(2);
      });

      vi.useRealTimers();
    });
  });

  describe("useTypingIndicator Hook", () => {
    const defaultProps = {
      chatRoomId: "test-room-1",
      userId: "user-1",
      userName: "Test User",
    };

    it("should start with no typing users", () => {
      const { result } = renderHook(() => useTypingIndicator(defaultProps));

      expect(result.current.isTyping).toBe(false);
      expect(result.current.typingUsers).toEqual([]);
    });

    it("should broadcast typing status when starting to type", async () => {
      const mockBroadcastTyping = vi
        .spyOn(chatBroadcastService, "broadcastTyping")
        .mockResolvedValue();

      const { result } = renderHook(() => useTypingIndicator(defaultProps));

      await act(async () => {
        result.current.startTyping();
      });

      expect(mockBroadcastTyping).toHaveBeenCalledWith(
        defaultProps.chatRoomId,
        defaultProps.userId,
        defaultProps.userName,
        true
      );
      expect(result.current.isTyping).toBe(true);
    });

    it("should auto-stop typing after timeout", async () => {
      vi.useFakeTimers();

      const mockBroadcastTyping = vi
        .spyOn(chatBroadcastService, "broadcastTyping")
        .mockResolvedValue();

      const { result } = renderHook(() =>
        useTypingIndicator({ ...defaultProps, typingTimeout: 3000 })
      );

      await act(async () => {
        result.current.startTyping();
      });

      expect(result.current.isTyping).toBe(true);

      // Fast-forward past the typing timeout
      act(() => {
        vi.advanceTimersByTime(3500);
      });

      await waitFor(() => {
        expect(mockBroadcastTyping).toHaveBeenCalledWith(
          defaultProps.chatRoomId,
          defaultProps.userId,
          defaultProps.userName,
          false
        );
        expect(result.current.isTyping).toBe(false);
      });

      vi.useRealTimers();
    });

    it("should generate correct typing text for multiple users", () => {
      const { result } = renderHook(() => useTypingIndicator(defaultProps));

      // Simulate typing users
      act(() => {
        result.current.typingUsers.push(
          {
            userId: "user-2",
            userName: "User 2",
            isTyping: true,
            timestamp: Date.now(),
          },
          {
            userId: "user-3",
            userName: "User 3",
            isTyping: true,
            timestamp: Date.now(),
          }
        );
      });

      const typingText = result.current.getTypingText();
      expect(typingText).toContain("User 2 y User 3 están escribiendo");
    });
  });

  describe("Chat Broadcast Service", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should create channels for chat rooms", async () => {
      await chatBroadcastService.subscribeToBroadcast(
        "test-room-1",
        vi.fn(),
        vi.fn()
      );

      expect(mockSupabaseClient.channel).toHaveBeenCalledWith(
        "broadcast_test-room-1",
        expect.objectContaining({
          config: {
            broadcast: { self: true },
            presence: { key: "test-room-1" },
          },
        })
      );
    });

    it("should broadcast messages correctly", async () => {
      await chatBroadcastService.broadcastMessage(
        "test-room-1",
        "user-1",
        "Test User",
        "Hello world!"
      );

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: "broadcast",
        event: "message",
        payload: expect.objectContaining({
          type: "message",
          chatRoomId: "test-room-1",
          senderId: "user-1",
          senderName: "Test User",
          content: "Hello world!",
        }),
      });
    });

    it("should handle broadcast failures with retry logic", async () => {
      mockChannel.send
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(undefined);

      vi.useFakeTimers();

      const broadcastPromise = chatBroadcastService.broadcastMessage(
        "test-room-1",
        "user-1",
        "Test User",
        "Hello world!"
      );

      // First attempt should fail
      await waitFor(() => {
        expect(mockChannel.send).toHaveBeenCalledTimes(1);
      });

      // Fast-forward to trigger retry
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      await broadcastPromise;

      // Should have retried
      expect(mockChannel.send).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it("should cleanup channels when unsubscribing", async () => {
      await chatBroadcastService.subscribeToBroadcast("test-room-1", vi.fn());

      await chatBroadcastService.unsubscribeFromRoom("test-room-1");

      expect(mockChannel.unsubscribe).toHaveBeenCalled();
    });
  });

  describe("Chat API Service", () => {
    beforeEach(() => {
      mockSupabaseClient.from = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "room-1" },
              error: null,
            }),
          }),
        }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "room-1", isActive: true },
                error: null,
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });
    });

    it("should create chat rooms correctly", async () => {
      const chatRoom = await chatService.createChatRoom({
        appointmentId: "apt-1",
        patientId: "patient-1",
        doctorId: "doctor-1",
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("chat_rooms");
      expect(chatRoom).toEqual(
        expect.objectContaining({
          id: "room-1",
        })
      );
    });

    it("should verify chat room access", async () => {
      const chatRoom = await chatService.getChatRoom("room-1");

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("chat_rooms");
      expect(chatRoom).toEqual(
        expect.objectContaining({
          id: "room-1",
          isActive: true,
        })
      );
    });

    it("should send messages and broadcast them", async () => {
      const mockBroadcastMessage = vi
        .spyOn(chatBroadcastService, "broadcastMessage")
        .mockResolvedValue();

      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: "msg-1",
                content: "Test message",
                chatRoomId: "room-1",
                senderId: "user-1",
              },
              error: null,
            }),
          }),
        }),
      });

      await chatService.sendMessage(
        "room-1",
        "user-1",
        "Test message",
        "TEXT"
      );

      expect(mockBroadcastMessage).toHaveBeenCalledWith(
        "room-1",
        "user-1",
        "Test User",
        "Test message",
        expect.any(Object)
      );
    });
  });

  describe("Integration Tests", () => {
    it("should handle complete message flow from send to receive", async () => {
      const onNewMessage = vi.fn();

      // Set up real-time hook
      const { result: realtimeResult } = renderHook(() =>
        useChatRealtime({
          chatRoomId: "test-room-1",
          userId: "user-1",
          userName: "User 1",
          onNewMessage,
        })
      );

      // Mock successful message send
      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: "msg-1",
                content: "Integration test message",
                chatRoomId: "test-room-1",
                senderId: "user-1",
              },
              error: null,
            }),
          }),
        }),
      });

      // Send message
      await act(async () => {
        await realtimeResult.current.sendMessage("Integration test message");
      });

      // Simulate receiving the message via real-time subscription
      const insertHandler = mockChannel.on.mock.calls.find(
        (call) => call[1].event === "INSERT"
      )?.[2];

      const receivedMessage = {
        id: "msg-1",
        chatRoomId: "test-room-1",
        senderId: "user-2", // Different sender
        content: "Integration test message",
        messageType: "TEXT",
        sentAt: new Date().toISOString(),
      };

      act(() => {
        insertHandler?.({ new: receivedMessage });
      });

      await waitFor(() => {
        expect(onNewMessage).toHaveBeenCalledWith(receivedMessage);
        expect(realtimeResult.current.messages).toContainEqual(receivedMessage);
      });
    });
  });
});
