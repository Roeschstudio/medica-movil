"use client";

import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/use-notifications";
import { useToast } from "@/hooks/use-toast";
import { Bell, Calendar, Info, MessageSquare, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function NotificationToastProvider() {
  const { toast } = useToast();
  const { notifications } = useNotifications();
  const router = useRouter();

  useEffect(() => {
    // Listen for new notifications and show toasts
    const latestNotification = notifications[0];

    if (latestNotification && !latestNotification.isRead) {
      showNotificationToast(latestNotification);
    }
  }, [notifications]);

  const showNotificationToast = (notification: any) => {
    const getIcon = () => {
      if (notification.metadata?.chatRoomId) {
        return <MessageSquare className="h-4 w-4" />;
      } else if (notification.metadata?.appointmentId) {
        return <Calendar className="h-4 w-4" />;
      }
      return <Bell className="h-4 w-4" />;
    };

    const handleClick = () => {
      if (notification.metadata?.chatRoomId) {
        router.push(`/chat/${notification.metadata.chatRoomId}`);
      } else if (notification.metadata?.appointmentId) {
        router.push(`/appointments/${notification.metadata.appointmentId}`);
      } else if (notification.metadata?.actionUrl) {
        router.push(notification.metadata.actionUrl);
      }
    };

    toast({
      title: (
        <div className="flex items-center gap-2">
          {getIcon()}
          <span>{notification.title}</span>
        </div>
      ),
      description: notification.message,
      action:
        notification.metadata?.chatRoomId ||
        notification.metadata?.appointmentId ? (
          <Button variant="outline" size="sm" onClick={handleClick}>
            Ver
          </Button>
        ) : undefined,
      duration: 5000,
    });
  };

  return null; // This component doesn't render anything visible
}

interface NotificationToastProps {
  notification: {
    id: string;
    title: string;
    message: string;
    type: string;
    metadata?: {
      chatRoomId?: string;
      appointmentId?: string;
      actionUrl?: string;
    };
  };
  onDismiss: () => void;
  onAction?: () => void;
}

export function NotificationToast({
  notification,
  onDismiss,
  onAction,
}: NotificationToastProps) {
  const getIcon = () => {
    if (notification.metadata?.chatRoomId) {
      return <MessageSquare className="h-5 w-5 text-blue-500" />;
    } else if (notification.metadata?.appointmentId) {
      return <Calendar className="h-5 w-5 text-green-500" />;
    }
    return <Info className="h-5 w-5 text-gray-500" />;
  };

  const getActionText = () => {
    if (notification.metadata?.chatRoomId) {
      return "Ver Chat";
    } else if (notification.metadata?.appointmentId) {
      return "Ver Cita";
    }
    return "Ver";
  };

  return (
    <div className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-lg shadow-lg max-w-sm">
      {getIcon()}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-gray-900 truncate">
          {notification.title}
        </h4>
        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
          {notification.message}
        </p>
        {onAction && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAction}
            className="mt-2 h-7 text-xs"
          >
            {getActionText()}
          </Button>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onDismiss}
        className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface NotificationFloatingProps {
  notifications: any[];
  maxVisible?: number;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  onNotificationClick?: (notification: any) => void;
  onNotificationDismiss?: (notificationId: string) => void;
}

export function NotificationFloating({
  notifications,
  maxVisible = 3,
  position = "top-right",
  onNotificationClick,
  onNotificationDismiss,
}: NotificationFloatingProps) {
  const positionClasses = {
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
  };

  const visibleNotifications = notifications
    .filter((n) => !n.isRead)
    .slice(0, maxVisible);

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <div className={`fixed ${positionClasses[position]} z-50 space-y-2`}>
      {visibleNotifications.map((notification, index) => (
        <div
          key={notification.id}
          className="animate-in slide-in-from-right-full duration-300"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <NotificationToast
            notification={notification}
            onDismiss={() => onNotificationDismiss?.(notification.id)}
            onAction={() => onNotificationClick?.(notification)}
          />
        </div>
      ))}
    </div>
  );
}
