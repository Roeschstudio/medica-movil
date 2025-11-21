"use client";

import { chatService } from "@/lib/chat-service";
import type { ChatMessage, ChatRoom } from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useChatConnection } from "./use-chat-connection";
import { useChatPresence } from "./use-chat-presence";
import { useMessagePagination } from "./use-message-pagination";
import { useOfflineDetection } from "./use-offline-detection";
import { useTypingIndicator } from "./use-typing-indicator";

export interface UseChatOptions {
  appointmentId: string;
  userId: string;
  userName: string;
  userRole: string;
  autoConnect?: boolean;
  enableTypingIndicators?: boolean;
  enablePresence?: boolean;
  messagePageSize?: number;
  maxReconnectAttempts?: number;
  onError?: (error: Error) => void;
  onConnectionChange?: (connected: boolean) => void;
  onNewMessage?: (message: ChatMessage) => void;
  onMessageUpdate?: (message: ChatMessage) => void;
}

export interface UseChatReturn {
  // Chat room state
  chatRoom: ChatRoom | null;
  isLoading: boolean;
  error: string | null;

  // Messages
  messages: ChatMessage[];
  hasMoreMessages: boolean;
  isLoadingMessages: boolean;
  loadMoreMessages: () => Promise<void>;
  unreadCount: number;

  // Message operations
  sendMessage: (content: string) => Promise<boolean>;
  sendFile: (file: File) => Promise<boolean>;
  markMessagesAsRead: () => Promise<void>;

  // Input state
  newMessage: string;
  setNewMessage: (message: string) => void;
  isSending: boolean;

  // Connection state
  isConnected: boolean;
  isReconnecting: boolean;
  connectionStatus: string;
  reconnect: () => void;

  // Offline state
  isOnline: boolean;
  queuedMessagesCount: number;

  // Typing indicators
  isTyping: boolean;
  typingUsers: Array<{ userId: string; userName: string }>;
  startTyping: () => void;
  stopTyping: () => void;
  getTypingText: () => string;

  // Presence
  onlineUsers: Array<{ userId: string; userName: string; userRole: string }>;
  totalOnlineUsers: number;
  isUserOnline: (userId: string) => boolean;

  // Cleanup
  cleanup: () => void;
}

export const useChat = (options: UseChatOptions): UseChatReturn => {
  const {
    appointmentId,
    userId,
    userName,
    userRole,
    autoConnect = true,
    enableTypingIndicators = true,
    enablePresence = true,
    messagePageSize = 50,
    maxReconnectAttempts = 5,
    onError,
    onConnectionChange,
    onNewMessage,
    onMessageUpdate,
  } = options;

  // Core state
  const [chatRoom, setChatRoom] = useState<ChatRoom | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Refs for cleanup
  const subscriptionRef = useRef<any>(null);
  const isInitializedRef = useRef(false);

  // Offline detection
  const { isOnline } = useOfflineDetection({
    showToasts: true,
    onOnline: () => {
      // Reconnect when coming back online
      if (chatRoom?.id) {
        connectionHook.reconnect();
      }
    },
  });

  // Connection management
  const connectionHook = useChatConnection({
    chatRoomId: chatRoom?.id || "",
    userId,
    maxReconnectAttempts,
    onConnectionChange: (state) => {
      onConnectionChange?.(state.isConnected);
    },
    onError: (errorMsg) => {
      setError(errorMsg);
      onError?.(new Error(errorMsg));
    },
  });

  // Message pagination
  const messagePagination = useMessagePagination<ChatMessage>(
    useCallback(
      async (limit: number, offset: number) => {
        if (!chatRoom?.id) return [];
        return await chatService.getMessages(chatRoom.id, limit, offset);
      },
      [chatRoom?.id]
    ),
    { pageSize: messagePageSize }
  );

  // Typing indicators
  const typingHook = useTypingIndicator({
    chatRoomId: chatRoom?.id || "",
    userId,
    userName,
    onTypingChange: (typingUsers) => {
      // Handle typing updates if needed
    },
  });

  // Presence management
  const presenceHook = useChatPresence({
    chatRoomId: chatRoom?.id || "",
    userId,
    userName,
    userRole,
    onPresenceUpdate: (presence) => {
      // Handle presence updates if needed
    },
  });

  // Initialize chat room
  const initializeChatRoom = useCallback(async () => {
    if (isInitializedRef.current || !appointmentId) return;

    setIsLoading(true);
    setError(null);

    try {
      const room = await chatService.getOrCreateChatRoom(appointmentId);
      if (room) {
        setChatRoom(room);
        isInitializedRef.current = true;
      } else {
        throw new Error("Failed to create or get chat room");
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to initialize chat";
      setError(errorMsg);
      onError?.(new Error(errorMsg));
    } finally {
      setIsLoading(false);
    }
  }, [appointmentId, onError]);

  // Subscribe to real-time messages
  const subscribeToMessages = useCallback(() => {
    if (!chatRoom?.id || subscriptionRef.current) return;

    const subscription = chatService.subscribeToMessages(chatRoom.id, {
      onMessage: (message: ChatMessage) => {
        messagePagination.addMessage(message);

        // Update unread count if message is from another user
        if (message.senderId !== userId && !message.isRead) {
          setUnreadCount((prev) => prev + 1);
        }

        onNewMessage?.(message);
      },
      onMessageUpdate: (message: ChatMessage) => {
        messagePagination.updateMessage(message.id, message);
        onMessageUpdate?.(message);
      },
      onError: (err: Error) => {
        setError(err.message);
        onError?.(err);
      },
      onConnectionChange: (connected: boolean) => {
        onConnectionChange?.(connected);
      },
    });

    subscriptionRef.current = subscription;
  }, [
    chatRoom?.id,
    userId,
    messagePagination,
    onNewMessage,
    onMessageUpdate,
    onError,
    onConnectionChange,
  ]);

  // Send message
  const sendMessage = useCallback(
    async (content: string): Promise<boolean> => {
      if (!chatRoom?.id || !content.trim() || isSending) return false;

      setIsSending(true);
      setError(null);

      try {
        const success = await chatService.sendMessage(
          chatRoom.id,
          userId,
          content.trim(),
          "TEXT"
        );

        if (success) {
          setNewMessage("");
          // Stop typing when message is sent
          if (enableTypingIndicators) {
            typingHook.stopTyping();
          }
        }

        return success;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to send message";
        setError(errorMsg);
        onError?.(new Error(errorMsg));
        return false;
      } finally {
        setIsSending(false);
      }
    },
    [
      chatRoom?.id,
      userId,
      isSending,
      enableTypingIndicators,
      typingHook,
      onError,
    ]
  );

  // Send file
  const sendFile = useCallback(
    async (file: File): Promise<boolean> => {
      if (!chatRoom?.id || isSending) return false;

      setIsSending(true);
      setError(null);

      try {
        // Upload file first
        const fileUrl = await chatService.uploadFile(file, chatRoom.id);
        if (!fileUrl) {
          throw new Error("Failed to upload file");
        }

        // Determine message type based on file type
        let messageType: "FILE" | "IMAGE" | "VIDEO" | "AUDIO" = "FILE";
        if (file.type.startsWith("image/")) messageType = "IMAGE";
        else if (file.type.startsWith("video/")) messageType = "VIDEO";
        else if (file.type.startsWith("audio/")) messageType = "AUDIO";

        // Send message with file
        const success = await chatService.sendMessage(
          chatRoom.id,
          userId,
          `Archivo compartido: ${file.name}`,
          messageType,
          {
            url: fileUrl,
            name: file.name,
            size: file.size,
            type: file.type,
          }
        );

        return success;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to send file";
        setError(errorMsg);
        onError?.(new Error(errorMsg));
        return false;
      } finally {
        setIsSending(false);
      }
    },
    [chatRoom?.id, userId, isSending, onError]
  );

  // Mark messages as read
  const markMessagesAsRead = useCallback(async () => {
    if (!chatRoom?.id) return;

    try {
      await chatService.markMessagesAsRead(chatRoom.id, userId);
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark messages as read:", err);
    }
  }, [chatRoom?.id, userId]);

  // Handle typing input changes
  const handleMessageChange = useCallback(
    (value: string) => {
      setNewMessage(value);

      if (enableTypingIndicators && chatRoom?.id) {
        if (value.trim() && !typingHook.isTyping) {
          typingHook.startTyping();
        } else if (!value.trim() && typingHook.isTyping) {
          typingHook.stopTyping();
        }
      }
    },
    [enableTypingIndicators, chatRoom?.id, typingHook]
  );

  // Cleanup function
  const cleanup = useCallback(() => {
    // Unsubscribe from messages
    if (subscriptionRef.current && chatRoom?.id) {
      chatService.unsubscribeFromMessages(chatRoom.id);
      subscriptionRef.current = null;
    }

    // Stop typing
    if (enableTypingIndicators && typingHook.isTyping) {
      typingHook.stopTyping();
    }

    // Reset pagination
    messagePagination.reset();

    // Reset state
    setChatRoom(null);
    setError(null);
    setNewMessage("");
    setUnreadCount(0);
    isInitializedRef.current = false;
  }, [chatRoom?.id, enableTypingIndicators, typingHook, messagePagination]);

  // Initialize chat room on mount or when appointmentId changes
  useEffect(() => {
    if (autoConnect && appointmentId) {
      initializeChatRoom();
    }

    return () => {
      cleanup();
    };
  }, [appointmentId, autoConnect, initializeChatRoom]);

  // Subscribe to messages when chat room is ready
  useEffect(() => {
    if (chatRoom?.id && autoConnect) {
      subscribeToMessages();
    }

    return () => {
      if (subscriptionRef.current && chatRoom?.id) {
        chatService.unsubscribeFromMessages(chatRoom.id);
        subscriptionRef.current = null;
      }
    };
  }, [chatRoom?.id, autoConnect, subscribeToMessages]);

  // Calculate queued messages count
  const queuedMessagesCount = isOnline ? 0 : 1; // Simplified for now

  return {
    // Chat room state
    chatRoom,
    isLoading,
    error,

    // Messages
    messages: messagePagination.messages,
    hasMoreMessages: messagePagination.hasMore,
    isLoadingMessages: messagePagination.isLoading,
    loadMoreMessages: messagePagination.loadMore,
    unreadCount,

    // Message operations
    sendMessage,
    sendFile,
    markMessagesAsRead,

    // Input state
    newMessage,
    setNewMessage: handleMessageChange,
    isSending,

    // Connection state
    isConnected: connectionHook.isConnected,
    isReconnecting: connectionHook.isReconnecting,
    connectionStatus: connectionHook.connectionState.status,
    reconnect: connectionHook.reconnect,

    // Offline state
    isOnline,
    queuedMessagesCount,

    // Typing indicators
    isTyping: enableTypingIndicators ? typingHook.isTyping : false,
    typingUsers: enableTypingIndicators ? typingHook.typingUsers : [],
    startTyping: enableTypingIndicators ? typingHook.startTyping : () => {},
    stopTyping: enableTypingIndicators ? typingHook.stopTyping : () => {},
    getTypingText: enableTypingIndicators ? typingHook.getTypingText : () => "",

    // Presence
    onlineUsers: enablePresence ? presenceHook.onlineUsers : [],
    totalOnlineUsers: enablePresence ? presenceHook.totalOnline : 0,
    isUserOnline: enablePresence ? presenceHook.isUserOnline : () => false,

    // Cleanup
    cleanup,
  };
};

// Hook for input field integration with typing indicators
export const useChatInput = (
  chatRoomId: string,
  userId: string,
  userName: string,
  options?: {
    debounceMs?: number;
    typingTimeout?: number;
  }
) => {
  const [value, setValue] = useState("");
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { startTyping, stopTyping } = useTypingIndicator({
    chatRoomId,
    userId,
    userName,
    typingTimeout: options?.typingTimeout,
  });

  const handleChange = useCallback(
    (newValue: string) => {
      setValue(newValue);

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Start typing if there's content
      if (newValue.trim()) {
        startTyping();

        // Set timeout to stop typing
        typingTimeoutRef.current = setTimeout(() => {
          stopTyping();
        }, options?.debounceMs || 1000);
      } else {
        stopTyping();
      }
    },
    [startTyping, stopTyping, options?.debounceMs]
  );

  const handleSubmit = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    stopTyping();
    setValue("");
  }, [stopTyping]);

  const handleBlur = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    stopTyping();
  }, [stopTyping]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return {
    value,
    setValue,
    handleChange,
    handleSubmit,
    handleBlur,
  };
};
