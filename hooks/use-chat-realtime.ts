import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import { RealtimeChannel, RealtimePresenceState } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

export interface ChatMessage {
  id: string;
  chatRoomId: string;
  senderId: string;
  content: string | null;
  messageType: "TEXT" | "FILE" | "IMAGE" | "VIDEO" | "AUDIO";
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  isRead: boolean;
  sentAt: string;
  sender?: {
    id: string;
    name: string;
    role: string;
  };
}

export interface TypingUser {
  userId: string;
  userName: string;
  timestamp: number;
}

export interface ConnectionStatus {
  isConnected: boolean;
  isReconnecting: boolean;
  lastConnected: Date | null;
  reconnectAttempts: number;
}

interface UseChatRealtimeProps {
  chatRoomId: string;
  userId: string;
  userName: string;
  onNewMessage?: (message: ChatMessage) => void;
  onMessageUpdate?: (message: ChatMessage) => void;
  onTypingUpdate?: (typingUsers: TypingUser[]) => void;
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
  onError?: (error: unknown) => void;
}

export const useChatRealtime = ({
  chatRoomId,
  userId,
  userName,
  onNewMessage,
  onMessageUpdate,
  onTypingUpdate,
  onConnectionStatusChange,
  onError,
}: UseChatRealtimeProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    isReconnecting: false,
    lastConnected: null,
    reconnectAttempts: 0,
  });

  const supabase = createSupabaseBrowserClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 1000; // Start with 1 second

  // Update connection status and notify parent
  const updateConnectionStatus = useCallback(
    (updates: Partial<ConnectionStatus>) => {
      setConnectionStatus((prev) => {
        const newStatus = { ...prev, ...updates };
        onConnectionStatusChange?.(newStatus);
        return newStatus;
      });
    },
    [onConnectionStatusChange]
  );

  // Exponential backoff for reconnection
  const getReconnectDelay = (attempt: number) => {
    return Math.min(reconnectDelay * Math.pow(2, attempt), 30000); // Max 30 seconds
  };

  // Subscribe to chat messages
  const subscribeToMessages = useCallback(() => {
    if (!chatRoomId || channelRef.current) return;

    const channel = supabase
      .channel(`chat_room_${chatRoomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `chatRoomId=eq.${chatRoomId}`,
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          setMessages((prev) => [...prev, newMessage]);
          onNewMessage?.(newMessage);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_messages",
          filter: `chatRoomId=eq.${chatRoomId}`,
        },
        (payload) => {
          const updatedMessage = payload.new as ChatMessage;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === updatedMessage.id ? updatedMessage : msg
            )
          );
          onMessageUpdate?.(updatedMessage);
        }
      )
      .on("presence", { event: "sync" }, () => {
        const presenceState = channel.presenceState() as RealtimePresenceState;
        const typing = Object.values(presenceState)
          .flat()
          .filter(
            (presence: any) => presence.typing && presence.user_id !== userId
          )
          .map((presence: any) => ({
            userId: presence.user_id,
            userName: presence.user_name,
            timestamp: presence.timestamp,
          }));

        setTypingUsers(typing);
        onTypingUpdate?.(typing);
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        // Handle user joining
        updateConnectionStatus({
          isConnected: true,
          lastConnected: new Date(),
        });
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        // Handle user leaving - remove from typing if they were typing
        const leftUserIds = leftPresences.map((p: any) => p.user_id);
        setTypingUsers((prev) =>
          prev.filter((user) => !leftUserIds.includes(user.userId))
        );
      });

    // Subscribe and track connection status
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        updateConnectionStatus({
          isConnected: true,
          isReconnecting: false,
          lastConnected: new Date(),
          reconnectAttempts: 0,
        });

        // Track presence
        await channel.track({
          user_id: userId,
          user_name: userName,
          typing: false,
          timestamp: Date.now(),
        });
      } else if (status === "CHANNEL_ERROR") {
        updateConnectionStatus({ isConnected: false });
        onError?.(new Error("Channel connection error"));
        attemptReconnect();
      } else if (status === "TIMED_OUT") {
        updateConnectionStatus({ isConnected: false });
        onError?.(new Error("Connection timed out"));
        attemptReconnect();
      }
    });

    channelRef.current = channel;
  }, [
    chatRoomId,
    userId,
    userName,
    onNewMessage,
    onMessageUpdate,
    onTypingUpdate,
  ]);

  // Attempt to reconnect with exponential backoff
  const attemptReconnect = useCallback(() => {
    if (connectionStatus.reconnectAttempts >= maxReconnectAttempts) {
      updateConnectionStatus({ isReconnecting: false });
      return;
    }

    updateConnectionStatus({
      isReconnecting: true,
      reconnectAttempts: connectionStatus.reconnectAttempts + 1,
    });

    const delay = getReconnectDelay(connectionStatus.reconnectAttempts);

    reconnectTimeoutRef.current = setTimeout(() => {
      // Cleanup existing channel
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }

      // Attempt to reconnect
      subscribeToMessages();
    }, delay);
  }, [connectionStatus.reconnectAttempts, subscribeToMessages]);

  // Send a message
  const sendMessage = useCallback(
    async (
      content: string,
      messageType: ChatMessage["messageType"] = "TEXT",
      fileUrl?: string,
      fileName?: string,
      fileSize?: number
    ) => {
      try {
        const { data, error } = await supabase
          .from("chat_messages")
          .insert({
            chatRoomId,
            senderId: userId,
            content,
            messageType,
            fileUrl,
            fileName,
            fileSize,
            isRead: false,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      } catch (error) {
        console.error("Error sending message:", error);
        onError?.(error);
        throw error;
      }
    },
    [chatRoomId, userId, supabase]
  );

  // Mark messages as read
  const markMessagesAsRead = useCallback(
    async (messageIds: string[]) => {
      try {
        const { error } = await supabase
          .from("chat_messages")
          .update({ isRead: true })
          .in("id", messageIds)
          .eq("chatRoomId", chatRoomId);

        if (error) throw error;
      } catch (error) {
        console.error("Error marking messages as read:", error);
        onError?.(error);
        throw error;
      }
    },
    [chatRoomId, supabase]
  );

  // Set typing status
  const setTyping = useCallback(
    async (isTyping: boolean) => {
      if (!channelRef.current) return;

      try {
        await channelRef.current.track({
          user_id: userId,
          user_name: userName,
          typing: isTyping,
          timestamp: Date.now(),
        });

        // Auto-clear typing after 3 seconds
        if (isTyping) {
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }

          typingTimeoutRef.current = setTimeout(() => {
            setTyping(false);
          }, 3000);
        }
      } catch (error) {
        console.error("Error setting typing status:", error);
      }
    },
    [userId, userName]
  );

  // Load initial messages
  const loadMessages = useCallback(
    async (limit = 50, offset = 0) => {
      try {
        const { data, error } = await supabase
          .from("chat_messages")
          .select(
            `
          *,
          sender:senderId (
            id,
            name,
            role
          )
        `
          )
          .eq("chatRoomId", chatRoomId)
          .order("sentAt", { ascending: true })
          .range(offset, offset + limit - 1);

        if (error) throw error;

        if (offset === 0) {
          setMessages(data || []);
        } else {
          setMessages((prev) => [...(data || []), ...prev]);
        }

        return data || [];
      } catch (error) {
        console.error("Error loading messages:", error);
        onError?.(error);
        throw error;
      }
    },
    [chatRoomId, supabase]
  );

  // Initialize subscription
  useEffect(() => {
    subscribeToMessages();
    loadMessages();

    return () => {
      // Cleanup
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [subscribeToMessages, loadMessages]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    updateConnectionStatus({ reconnectAttempts: 0 });

    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }

    subscribeToMessages();
  }, [subscribeToMessages]);

  return {
    messages,
    typingUsers,
    connectionStatus,
    sendMessage,
    markMessagesAsRead,
    setTyping,
    loadMessages,
    reconnect,
  };
};
