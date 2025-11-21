"use client";

import {
  useChatConnection,
  type ConnectionState,
} from "@/hooks/use-chat-connection";
import { useChatPresence, type PresenceUser } from "@/hooks/use-chat-presence";
import { useChatRealtime, type ChatMessage } from "@/hooks/use-chat-realtime";
import {
  useTypingIndicator,
  type TypingIndicator,
} from "@/hooks/use-typing-indicator";
import { chatService } from "@/lib/chat-service";
import type { ChatRoom } from "@/lib/types";
import { chatBroadcastService } from "@/lib/chat-broadcast";
import { useSession } from "next-auth/react";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface ChatContextValue {
  // Current chat room
  currentChatRoom: ChatRoom | null;
  isLoading: boolean;
  error: string | null;

  // Messages
  messages: ChatMessage[];
  sendMessage: (
    content: string,
    messageType?: ChatMessage["messageType"],
    fileData?: FileData
  ) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  markMessagesAsRead: (messageIds?: string[]) => Promise<void>;
  hasMoreMessages: boolean;

  // Real-time features
  connectionState: ConnectionState;
  onlineUsers: PresenceUser[];
  typingUsers: TypingIndicator[];
  isTyping: boolean;
  startTyping: () => void;
  stopTyping: () => void;

  // Chat room management
  joinChatRoom: (chatRoomId: string) => Promise<void>;
  leaveChatRoom: () => void;
  createChatRoom: (
    appointmentId: string,
    patientId: string,
    doctorId: string
  ) => Promise<ChatRoom>;
  deactivateChatRoom: () => Promise<void>;

  // Utilities
  reconnect: () => void;
  getTypingText: () => string;
  getTotalUnreadCount: () => Promise<number>;
}

interface FileData {
  url: string;
  name: string;
  size: number;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
};

interface ChatProviderProps {
  children: React.ReactNode;
  initialChatRoomId?: string;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({
  children,
  initialChatRoomId,
}) => {
  const { data: session } = useSession();
  const [currentChatRoom, setCurrentChatRoom] = useState<ChatRoom | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const userId = session?.user?.id;
  const userName = session?.user?.name || "Usuario";
  const userRole = session?.user?.role || "PATIENT";

  // Real-time hooks
  const {
    messages,
    sendMessage: realtimeSendMessage,
    markMessagesAsRead: realtimeMarkAsRead,
    loadMessages,
    reconnect: realtimeReconnect,
  } = useChatRealtime({
    chatRoomId: currentChatRoom?.id || "",
    userId: userId || "",
    userName,
    onNewMessage: handleNewMessage,
    onMessageUpdate: handleMessageUpdate,
    onConnectionStatusChange: handleConnectionStatusChange,
  });

  const { onlineUsers, updateTypingStatus } = useChatPresence({
    chatRoomId: currentChatRoom?.id || "",
    userId: userId || "",
    userName,
    userRole,
    onPresenceUpdate: handlePresenceUpdate,
  });

  const { connectionState, reconnect: connectionReconnect } = useChatConnection(
    {
      chatRoomId: currentChatRoom?.id || "",
      userId: userId || "",
      onConnectionChange: handleConnectionChange,
      onError: handleConnectionError,
    }
  );

  const { isTyping, typingUsers, startTyping, stopTyping, getTypingText } =
    useTypingIndicator({
      chatRoomId: currentChatRoom?.id || "",
      userId: userId || "",
      userName,
      onTypingChange: handleTypingChange,
    });

  // Event handlers
  function handleNewMessage(message: ChatMessage) {
    // Auto-mark messages as read if chat is active
    if (document.hasFocus() && currentChatRoom?.id === message.chatRoomId) {
      setTimeout(() => {
        realtimeMarkAsRead([message.id]);
      }, 1000);
    }
  }

  function handleMessageUpdate(message: ChatMessage) {
    // Handle message updates (e.g., read status changes)
    console.log("Message updated:", message);
  }

  function handleConnectionStatusChange(status: ConnectionState) {
    if (status.error) {
      setError(status.error);
    } else if (error && status.status === "connected") {
      setError(null);
    }
  }

  function handlePresenceUpdate(presence: any) {
    // Presence updates are handled by the hook
    console.log("Presence updated:", presence);
  }

  function handleConnectionChange(state: ConnectionState) {
    // Connection state changes are handled by the hook
    console.log("Connection state changed:", state);
  }

  function handleConnectionError(error: string) {
    setError(error);
  }

  function handleTypingChange(typing: TypingIndicator[]) {
    // Typing changes are handled by the hook
    console.log("Typing changed:", typing);
  }

  // Chat room management
  const joinChatRoom = useCallback(
    async (chatRoomId: string) => {
      if (!userId) {
        setError("Usuario no autenticado");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const chatRoom = await chatService.getChatRoom(chatRoomId, userId);
        if (!chatRoom) {
          throw new Error("Chat room not found or access denied");
        }

        setCurrentChatRoom(chatRoom);
        setCurrentPage(1);
        setHasMoreMessages(true);

        // Load initial messages
        await loadMessages(50, 0);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Error joining chat room";
        setError(errorMessage);
        console.error("Error joining chat room:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [userId, loadMessages]
  );

  const leaveChatRoom = useCallback(() => {
    if (currentChatRoom) {
      // Stop typing if currently typing
      if (isTyping) {
        stopTyping();
      }

      // Unsubscribe from broadcasts
      chatBroadcastService.unsubscribeFromRoom(currentChatRoom.id);
    }

    setCurrentChatRoom(null);
    setError(null);
    setCurrentPage(1);
    setHasMoreMessages(true);
  }, [currentChatRoom, isTyping, stopTyping]);

  const createChatRoom = useCallback(
    async (
      appointmentId: string,
      patientId: string,
      doctorId: string
    ): Promise<ChatRoom> => {
      if (!userId) {
        throw new Error("Usuario no autenticado");
      }

      setIsLoading(true);
      setError(null);

      try {
        const chatRoom = await chatService.createChatRoom({
          appointmentId,
          patientId,
          doctorId,
        });

        return chatRoom;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Error creating chat room";
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [userId]
  );

  const deactivateChatRoom = useCallback(async () => {
    if (!currentChatRoom || !userId) {
      throw new Error("No active chat room or user not authenticated");
    }

    setIsLoading(true);
    setError(null);

    try {
      await chatService.deactivateChatRoom(currentChatRoom.id, userId);

      // Update local state
      setCurrentChatRoom((prev) =>
        prev ? { ...prev, isActive: false } : null
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error deactivating chat room";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentChatRoom, userId]);

  // Message management
  const sendMessage = useCallback(
    async (
      content: string,
      messageType: ChatMessage["messageType"] = "TEXT",
      fileData?: FileData
    ) => {
      if (!currentChatRoom || !userId) {
        throw new Error("No active chat room or user not authenticated");
      }

      try {
          await chatService.sendMessage(
            currentChatRoom.id,
            userId,
            content,
            messageType,
            fileData
          );

        // Stop typing after sending message
        if (isTyping) {
          stopTyping();
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Error sending message";
        setError(errorMessage);
        throw err;
      }
    },
    [currentChatRoom, userId, userName, isTyping, stopTyping]
  );

  const loadMoreMessages = useCallback(async () => {
    if (!currentChatRoom || !userId || !hasMoreMessages || isLoading) {
      return;
    }

    setIsLoading(true);

    try {
      const nextPage = currentPage + 1;
      const result = await loadMessages(50, (nextPage - 1) * 50);

      setCurrentPage(nextPage);
      setHasMoreMessages(result.length === 50);
    } catch (err) {
      console.error("Error loading more messages:", err);
      setError("Error loading more messages");
    } finally {
      setIsLoading(false);
    }
  }, [
    currentChatRoom,
    userId,
    hasMoreMessages,
    isLoading,
    currentPage,
    loadMessages,
  ]);

  const markMessagesAsRead = useCallback(
    async (messageIds?: string[]) => {
      if (!currentChatRoom || !userId) return;

      try {
        await chatService.markMessagesAsRead(
          currentChatRoom.id,
          userId,
          messageIds
        );
      } catch (err) {
        console.error("Error marking messages as read:", err);
      }
    },
    [currentChatRoom, userId]
  );

  // Utilities
  const reconnect = useCallback(() => {
    realtimeReconnect();
    connectionReconnect();
  }, [realtimeReconnect, connectionReconnect]);

  const getTotalUnreadCount = useCallback(async (): Promise<number> => {
    if (!userId) return 0;

    try {
      return await chatService.getUnreadMessageCount(userId);
    } catch (err) {
      console.error("Error getting unread count:", err);
      return 0;
    }
  }, [userId]);

  // Initialize with initial chat room
  useEffect(() => {
    if (initialChatRoomId && userId) {
      joinChatRoom(initialChatRoomId);
    }
  }, [initialChatRoomId, userId, joinChatRoom]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leaveChatRoom();
    };
  }, []);

  const contextValue: ChatContextValue = {
    // Current chat room
    currentChatRoom,
    isLoading,
    error,

    // Messages
    messages,
    sendMessage,
    loadMoreMessages,
    markMessagesAsRead,
    hasMoreMessages,

    // Real-time features
    connectionState,
    onlineUsers,
    typingUsers,
    isTyping,
    startTyping,
    stopTyping,

    // Chat room management
    joinChatRoom,
    leaveChatRoom,
    createChatRoom,
    deactivateChatRoom,

    // Utilities
    reconnect,
    getTypingText,
    getTotalUnreadCount,
  };

  return (
    <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
  );
};

// Hook for easy access to chat functionality in components
export const useChat = () => {
  return useChatContext();
};
