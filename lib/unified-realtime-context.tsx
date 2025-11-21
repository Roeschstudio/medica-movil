"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useUnifiedAuth } from "./unified-auth-context";
import {
  ConnectionStatus,
  UnifiedMessage,
  UnifiedPresence,
  unifiedRealtime,
  UnifiedRealtimeService,
} from "./unified-realtime";

interface UnifiedRealtimeContextType {
  service: UnifiedRealtimeService;
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  isReconnecting: boolean;

  // Chat room management
  subscribeToChatRoom: (
    chatRoomId: string,
    callbacks?: {
      onMessage?: (message: UnifiedMessage) => void;
      onMessageUpdate?: (message: UnifiedMessage) => void;
      onPresenceUpdate?: (presence: UnifiedPresence[]) => void;
      onTyping?: (data: {
        userId: string;
        userName: string;
        isTyping: boolean;
      }) => void;
    }
  ) => Promise<{ unsubscribe: () => void } | null>;

  unsubscribeFromChatRoom: (chatRoomId: string) => Promise<void>;

  // Message operations
  sendMessage: (
    chatRoomId: string,
    content: string,
    messageType?: "TEXT" | "FILE" | "IMAGE" | "VIDEO" | "AUDIO",
    fileData?: { url: string; name: string; size: number }
  ) => Promise<UnifiedMessage | null>;

  // Typing indicators
  setTyping: (chatRoomId: string, isTyping: boolean) => Promise<void>;

  // Video call signaling
  startVideoCall: (chatRoomId: string, sessionId: string) => void;
  endVideoCall: (chatRoomId: string, sessionId: string) => void;
  sendVideoSignal: (signal: any, to: string, chatRoomId: string) => void;

  // Admin monitoring
  subscribeToAdminEvents: (callbacks: {
    onChatActivity?: (data: any) => void;
    onVideoCallActivity?: (data: any) => void;
    onPaymentActivity?: (data: any) => void;
    onSystemAlert?: (data: any) => void;
  }) => void;

  // Connection management
  reconnect: () => Promise<void>;
}

const UnifiedRealtimeContext = createContext<
  UnifiedRealtimeContextType | undefined
>(undefined);

export function UnifiedRealtimeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useUnifiedAuth();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    unifiedRealtime.getConnectionStatus()
  );
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize the realtime service when user is available
  useEffect(() => {
    if (user && !isInitialized) {
      const initializeRealtime = async () => {
        try {
          const success = await unifiedRealtime.initialize({
            id: user.id,
            name: user.name,
            role: user.role,
            email: user.email,
          });

          if (success) {
            setIsInitialized(true);
          }
        } catch (error) {
          console.error("Failed to initialize unified realtime:", error);
        }
      };

      initializeRealtime();
    }
  }, [user, isInitialized]);

  // Listen for connection status changes
  useEffect(() => {
    const handleConnectionChange = (status: ConnectionStatus) => {
      setConnectionStatus(status);
    };

    unifiedRealtime.on("connection_change", handleConnectionChange);

    return () => {
      unifiedRealtime.off("connection_change", handleConnectionChange);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isInitialized) {
        unifiedRealtime.cleanup();
      }
    };
  }, [isInitialized]);

  // Wrapper functions that include user context
  const subscribeToChatRoom = async (
    chatRoomId: string,
    callbacks?: {
      onMessage?: (message: UnifiedMessage) => void;
      onMessageUpdate?: (message: UnifiedMessage) => void;
      onPresenceUpdate?: (presence: UnifiedPresence[]) => void;
      onTyping?: (data: {
        userId: string;
        userName: string;
        isTyping: boolean;
      }) => void;
    }
  ) => {
    if (!user || !isInitialized) return null;

    return unifiedRealtime.subscribeToChatRoom(
      chatRoomId,
      user.id,
      user.name,
      callbacks
    );
  };

  const sendMessage = async (
    chatRoomId: string,
    content: string,
    messageType: "TEXT" | "FILE" | "IMAGE" | "VIDEO" | "AUDIO" = "TEXT",
    fileData?: { url: string; name: string; size: number }
  ) => {
    if (!user || !isInitialized) return null;

    return unifiedRealtime.sendMessage(
      chatRoomId,
      user.id,
      content,
      messageType,
      fileData
    );
  };

  const setTyping = async (chatRoomId: string, isTyping: boolean) => {
    if (!user || !isInitialized) return;

    await unifiedRealtime.setTyping(chatRoomId, user.id, user.name, isTyping);
  };

  const sendVideoSignal = (signal: any, to: string, chatRoomId: string) => {
    if (!user || !isInitialized) return;

    unifiedRealtime.sendVideoSignal(signal, to, chatRoomId, user.id);
  };

  const value: UnifiedRealtimeContextType = {
    service: unifiedRealtime,
    connectionStatus,
    isConnected: connectionStatus.isConnected,
    isReconnecting: connectionStatus.isReconnecting,

    // Chat room management
    subscribeToChatRoom,
    unsubscribeFromChatRoom:
      unifiedRealtime.unsubscribeFromChatRoom.bind(unifiedRealtime),

    // Message operations
    sendMessage,

    // Typing indicators
    setTyping,

    // Video call signaling
    startVideoCall: unifiedRealtime.startVideoCall.bind(unifiedRealtime),
    endVideoCall: unifiedRealtime.endVideoCall.bind(unifiedRealtime),
    sendVideoSignal,

    // Admin monitoring
    subscribeToAdminEvents:
      unifiedRealtime.subscribeToAdminEvents.bind(unifiedRealtime),

    // Connection management
    reconnect: unifiedRealtime.reconnect.bind(unifiedRealtime),
  };

  return (
    <UnifiedRealtimeContext.Provider value={value}>
      {children}
    </UnifiedRealtimeContext.Provider>
  );
}

export function useUnifiedRealtime() {
  const context = useContext(UnifiedRealtimeContext);
  if (context === undefined) {
    throw new Error(
      "useUnifiedRealtime must be used within a UnifiedRealtimeProvider"
    );
  }
  return context;
}

// Specialized hooks for different features

// Hook for chat functionality
export function useUnifiedChat(chatRoomId: string) {
  const realtime = useUnifiedRealtime();
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<
    { userId: string; userName: string }[]
  >([]);
  const [onlineUsers, setOnlineUsers] = useState<UnifiedPresence[]>([]);

  useEffect(() => {
    if (!chatRoomId) return;

    const subscription = realtime.subscribeToChatRoom(chatRoomId, {
      onMessage: (message) => {
        setMessages((prev) => [...prev, message]);
      },
      onMessageUpdate: (message) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === message.id ? message : m))
        );
      },
      onPresenceUpdate: (presence) => {
        setOnlineUsers(presence);
      },
      onTyping: (data) => {
        if (data.isTyping) {
          setTypingUsers((prev) => {
            const exists = prev.find((u) => u.userId === data.userId);
            if (!exists) {
              return [
                ...prev,
                { userId: data.userId, userName: data.userName },
              ];
            }
            return prev;
          });
        } else {
          setTypingUsers((prev) =>
            prev.filter((u) => u.userId !== data.userId)
          );
        }
      },
    });

    return () => {
      subscription.then((sub) => sub?.unsubscribe());
    };
  }, [chatRoomId, realtime]);

  return {
    messages,
    typingUsers,
    onlineUsers,
    sendMessage: (
      content: string,
      messageType?: "TEXT" | "FILE" | "IMAGE" | "VIDEO" | "AUDIO",
      fileData?: { url: string; name: string; size: number }
    ) => realtime.sendMessage(chatRoomId, content, messageType, fileData),
    setTyping: (isTyping: boolean) => realtime.setTyping(chatRoomId, isTyping),
    isConnected: realtime.isConnected,
  };
}

// Hook for video call functionality
export function useUnifiedVideoCall(chatRoomId: string) {
  const realtime = useUnifiedRealtime();
  const [callStatus, setCallStatus] = useState<
    "idle" | "calling" | "in-call" | "ended"
  >("idle");
  const [incomingCall, setIncomingCall] = useState<{
    sessionId: string;
    initiator: string;
  } | null>(null);

  useEffect(() => {
    const handleVideoCallStart = (data: {
      sessionId: string;
      initiator: string;
    }) => {
      setIncomingCall(data);
      setCallStatus("calling");
    };

    const handleVideoCallEnd = (data: {
      sessionId: string;
      endedBy: string;
    }) => {
      setCallStatus("ended");
      setIncomingCall(null);
    };

    realtime.service.on("video_call_start", handleVideoCallStart);
    realtime.service.on("video_call_end", handleVideoCallEnd);

    return () => {
      realtime.service.off("video_call_start", handleVideoCallStart);
      realtime.service.off("video_call_end", handleVideoCallEnd);
    };
  }, [realtime]);

  return {
    callStatus,
    incomingCall,
    startCall: (sessionId: string) => {
      realtime.startVideoCall(chatRoomId, sessionId);
      setCallStatus("calling");
    },
    endCall: (sessionId: string) => {
      realtime.endVideoCall(chatRoomId, sessionId);
      setCallStatus("ended");
    },
    sendSignal: (signal: any, to: string) =>
      realtime.sendVideoSignal(signal, to, chatRoomId),
    isConnected: realtime.isConnected,
  };
}

// Hook for admin monitoring
export function useUnifiedAdminMonitoring() {
  const realtime = useUnifiedRealtime();
  const [chatActivity, setChatActivity] = useState<any[]>([]);
  const [videoActivity, setVideoActivity] = useState<any[]>([]);
  const [paymentActivity, setPaymentActivity] = useState<any[]>([]);
  const [systemAlerts, setSystemAlerts] = useState<any[]>([]);

  useEffect(() => {
    realtime.subscribeToAdminEvents({
      onChatActivity: (data) =>
        setChatActivity((prev) => [data, ...prev.slice(0, 99)]),
      onVideoCallActivity: (data) =>
        setVideoActivity((prev) => [data, ...prev.slice(0, 99)]),
      onPaymentActivity: (data) =>
        setPaymentActivity((prev) => [data, ...prev.slice(0, 99)]),
      onSystemAlert: (data) =>
        setSystemAlerts((prev) => [data, ...prev.slice(0, 99)]),
    });
  }, [realtime]);

  return {
    chatActivity,
    videoActivity,
    paymentActivity,
    systemAlerts,
    isConnected: realtime.isConnected,
  };
}
