"use client";

import { Badge } from "@/components/ui/badge";
import { Clock, MessageCircle, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";

interface ChatStatusIndicatorProps {
  appointmentId: string;
  appointmentStatus: string;
  className?: string;
  showText?: boolean;
}

interface ChatStatus {
  hasChat: boolean;
  isActive: boolean;
  unreadCount: number;
  lastMessageAt?: string;
}

export function ChatStatusIndicator({
  appointmentId,
  appointmentStatus,
  className = "",
  showText = true,
}: ChatStatusIndicatorProps) {
  const [chatStatus, setChatStatus] = useState<ChatStatus>({
    hasChat: false,
    isActive: false,
    unreadCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchChatStatus = async () => {
      try {
        setIsLoading(true);

        // Only fetch chat status for confirmed appointments
        if (
          appointmentStatus !== "CONFIRMED" &&
          appointmentStatus !== "COMPLETED"
        ) {
          setChatStatus({
            hasChat: false,
            isActive: false,
            unreadCount: 0,
          });
          return;
        }

        const response = await fetch(`/api/chat/status/${appointmentId}`);

        if (response.ok) {
          const data = await response.json();
          setChatStatus(data);
        } else {
          // If no chat room exists yet, that's okay
          setChatStatus({
            hasChat: false,
            isActive: false,
            unreadCount: 0,
          });
        }
      } catch (error) {
        console.error("Error fetching chat status:", error);
        setChatStatus({
          hasChat: false,
          isActive: false,
          unreadCount: 0,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchChatStatus();
  }, [appointmentId, appointmentStatus]);

  // Don't show anything for non-confirmed appointments
  if (appointmentStatus !== "CONFIRMED" && appointmentStatus !== "COMPLETED") {
    return null;
  }

  if (isLoading) {
    return (
      <div className={`flex items-center space-x-1 ${className}`}>
        <Clock className="h-3 w-3 animate-spin text-muted-foreground" />
        {showText && (
          <span className="text-xs text-muted-foreground">Cargando...</span>
        )}
      </div>
    );
  }

  if (!chatStatus.hasChat) {
    return (
      <div className={`flex items-center space-x-1 ${className}`}>
        <MessageSquare className="h-3 w-3 text-muted-foreground" />
        {showText && (
          <span className="text-xs text-muted-foreground">Chat disponible</span>
        )}
      </div>
    );
  }

  const getStatusColor = () => {
    if (chatStatus.unreadCount > 0) {
      return "bg-red-100 text-red-800 border-red-200";
    }
    if (chatStatus.isActive) {
      return "bg-green-100 text-green-800 border-green-200";
    }
    return "bg-blue-100 text-blue-800 border-blue-200";
  };

  const getStatusText = () => {
    if (chatStatus.unreadCount > 0) {
      return `${chatStatus.unreadCount} nuevo${
        chatStatus.unreadCount > 1 ? "s" : ""
      }`;
    }
    if (chatStatus.isActive) {
      return "Chat activo";
    }
    return "Chat disponible";
  };

  const getIcon = () => {
    if (chatStatus.unreadCount > 0) {
      return <MessageCircle className="h-3 w-3 fill-current" />;
    }
    return <MessageSquare className="h-3 w-3" />;
  };

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {getIcon()}
      {showText && (
        <Badge variant="outline" className={`text-xs ${getStatusColor()}`}>
          {getStatusText()}
        </Badge>
      )}
      {!showText && chatStatus.unreadCount > 0 && (
        <Badge
          variant="destructive"
          className="text-xs px-1 py-0 min-w-[16px] h-4 flex items-center justify-center"
        >
          {chatStatus.unreadCount > 9 ? "9+" : chatStatus.unreadCount}
        </Badge>
      )}
    </div>
  );
}

export default ChatStatusIndicator;
