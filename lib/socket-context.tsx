"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  type: "TEXT" | "FILE" | "IMAGE" | "VIDEO" | "AUDIO";
  fileUrl?: string;
  fileName?: string;
  createdAt: Date;
  sender: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
}

interface NotificationData {
  type: "MESSAGE" | "VIDEO_CALL" | "APPOINTMENT" | "PAYMENT";
  title: string;
  message: string;
  userId: string;
  data?: any;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinChatRoom: (roomId: string) => void;
  leaveChatRoom: (roomId: string) => void;
  sendMessage: (
    messageData: Omit<ChatMessage, "id" | "createdAt" | "sender">
  ) => void;
  startTyping: (roomId: string) => void;
  stopTyping: (roomId: string) => void;
  startVideoCall: (roomId: string, sessionId: string) => void;
  endVideoCall: (roomId: string, sessionId: string) => void;
  sendVideoSignal: (signal: any, to: string, roomId: string) => void;
  onNewMessage: (callback: (message: ChatMessage) => void) => void;
  onNotification: (callback: (notification: NotificationData) => void) => void;
  onUserJoined: (
    callback: (data: { userId: string; userName: string }) => void
  ) => void;
  onUserLeft: (
    callback: (data: { userId: string; userName: string }) => void
  ) => void;
  onUserTyping: (
    callback: (data: { userId: string; userName: string }) => void
  ) => void;
  onUserStoppedTyping: (callback: (data: { userId: string }) => void) => void;
  onVideoCallStarted: (
    callback: (data: { sessionId: string; initiator: string }) => void
  ) => void;
  onVideoCallEnded: (
    callback: (data: { sessionId: string; endedBy: string }) => void
  ) => void;
  onVideoSignal: (
    callback: (data: { signal: any; from: string; roomId: string }) => void
  ) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

interface SocketProviderProps {
  children: React.ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useUnifiedAuth();

  useEffect(() => {
    if (user) {
      const socketInstance = io(
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
        {
          path: "/api/socketio",
          addTrailingSlash: false,
          auth: {
            token: "temp-token", // Will be replaced with actual token from unified auth
            userId: user.id,
            userRole: user.role,
            userName: user.name,
          },
        }
      );

      socketInstance.on("connect", () => {
        console.log("Connected to Socket.IO server");
        setIsConnected(true);
      });

      socketInstance.on("disconnect", () => {
        console.log("Disconnected from Socket.IO server");
        setIsConnected(false);
      });

      socketInstance.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
        toast.error("Connection error. Please refresh the page.");
      });

      // Handle notifications
      socketInstance.on("notification", (notification: NotificationData) => {
        toast.info(notification.title, {
          description: notification.message,
        });
      });

      setSocket(socketInstance);

      return () => {
        socketInstance.disconnect();
      };
    }
  }, [user]);

  const joinChatRoom = (roomId: string) => {
    if (socket) {
      socket.emit("join_chat_room", roomId);
    }
  };

  const leaveChatRoom = (roomId: string) => {
    if (socket) {
      socket.emit("leave_chat_room", roomId);
    }
  };

  const sendMessage = (
    messageData: Omit<ChatMessage, "id" | "createdAt" | "sender">
  ) => {
    if (socket) {
      socket.emit("send_message", messageData);
    }
  };

  const startTyping = (roomId: string) => {
    if (socket) {
      socket.emit("typing_start", { roomId });
    }
  };

  const stopTyping = (roomId: string) => {
    if (socket) {
      socket.emit("typing_stop", { roomId });
    }
  };

  const startVideoCall = (roomId: string, sessionId: string) => {
    if (socket) {
      socket.emit("start_video_call", { roomId, sessionId });
    }
  };

  const endVideoCall = (roomId: string, sessionId: string) => {
    if (socket) {
      socket.emit("end_video_call", { roomId, sessionId });
    }
  };

  const sendVideoSignal = (signal: any, to: string, roomId: string) => {
    if (socket) {
      socket.emit("video_signal", {
        signal,
        to,
        roomId,
        from: user?.id,
      });
    }
  };

  const onNewMessage = (callback: (message: ChatMessage) => void) => {
    if (socket) {
      socket.on("new_message", callback);
    }
  };

  const onNotification = (
    callback: (notification: NotificationData) => void
  ) => {
    if (socket) {
      socket.on("notification", callback);
    }
  };

  const onUserJoined = (
    callback: (data: { userId: string; userName: string }) => void
  ) => {
    if (socket) {
      socket.on("user_joined", callback);
    }
  };

  const onUserLeft = (
    callback: (data: { userId: string; userName: string }) => void
  ) => {
    if (socket) {
      socket.on("user_left", callback);
    }
  };

  const onUserTyping = (
    callback: (data: { userId: string; userName: string }) => void
  ) => {
    if (socket) {
      socket.on("user_typing", callback);
    }
  };

  const onUserStoppedTyping = (
    callback: (data: { userId: string }) => void
  ) => {
    if (socket) {
      socket.on("user_stopped_typing", callback);
    }
  };

  const onVideoCallStarted = (
    callback: (data: { sessionId: string; initiator: string }) => void
  ) => {
    if (socket) {
      socket.on("video_call_started", callback);
    }
  };

  const onVideoCallEnded = (
    callback: (data: { sessionId: string; endedBy: string }) => void
  ) => {
    if (socket) {
      socket.on("video_call_ended", callback);
    }
  };

  const onVideoSignal = (
    callback: (data: { signal: any; from: string; roomId: string }) => void
  ) => {
    if (socket) {
      socket.on("video_signal", callback);
    }
  };

  const value: SocketContextType = {
    socket,
    isConnected,
    joinChatRoom,
    leaveChatRoom,
    sendMessage,
    startTyping,
    stopTyping,
    startVideoCall,
    endVideoCall,
    sendVideoSignal,
    onNewMessage,
    onNotification,
    onUserJoined,
    onUserLeft,
    onUserTyping,
    onUserStoppedTyping,
    onVideoCallStarted,
    onVideoCallEnded,
    onVideoSignal,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};
