"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useNotifications } from "@/hooks/use-notifications";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Bell,
  Check,
  CheckCheck,
  Mail,
  MessageSquare,
  Phone,
  Settings,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useUnifiedAuth } from "@/lib/unified-auth-context";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { NotificationBadge } from "./notification-badge";

interface NotificationCenterProps {
  trigger?: React.ReactNode;
  maxNotifications?: number;
}

export function NotificationCenter({
  trigger,
  maxNotifications = 10,
}: NotificationCenterProps) {
  const { user } = useUnifiedAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const {
    notifications,
    stats,
    loading,
    isConnected,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "EMAIL":
        return <Mail className="h-4 w-4 text-blue-500" />;
      case "SMS":
        return <Phone className="h-4 w-4 text-green-500" />;
      case "WHATSAPP":
        return <MessageSquare className="h-4 w-4 text-emerald-500" />;
      case "BROWSER":
        return <Bell className="h-4 w-4 text-purple-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const getNotificationTypeLabel = (notification: any) => {
    if (notification.metadata?.chatRoomId) {
      return "Mensaje de Chat";
    } else if (notification.metadata?.appointmentId) {
      return "Cita Médica";
    }
    return "Notificación";
  };

  const handleNotificationClick = (notification: any) => {
    // Mark as read
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    // Navigate to appropriate page
    if (notification.metadata?.chatRoomId) {
      router.push(`/chat/${notification.metadata.chatRoomId}`);
    } else if (notification.metadata?.appointmentId) {
      router.push(`/appointments/${notification.metadata.appointmentId}`);
    } else if (notification.metadata?.actionUrl) {
      router.push(notification.metadata.actionUrl);
    }

    setIsOpen(false);
  };

  const formatTimeAgo = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: es,
      });
    } catch {
      return "Hace un momento";
    }
  };

  if (!user) {
    return null;
  }

  const displayNotifications = notifications.slice(0, maxNotifications);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="relative">
            <NotificationBadge />
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>Centro de Notificaciones</span>
              {isConnected ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
            </div>
            <div className="flex items-center gap-2">
              {stats.unread > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={markAllAsRead}
                  className="h-8 px-3 text-xs"
                >
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Marcar todas
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  router.push("/notificaciones/configuracion");
                  setIsOpen(false);
                }}
                className="h-8 px-3 text-xs"
              >
                <Settings className="h-3 w-3" />
              </Button>
            </div>
          </SheetTitle>
          <SheetDescription>
            {stats.unread > 0
              ? `Tienes ${stats.unread} notificaciones sin leer`
              : "No tienes notificaciones sin leer"}
          </SheetDescription>
        </SheetHeader>

        <Separator className="my-4" />

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">
              Cargando notificaciones...
            </div>
          </div>
        ) : displayNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Bell className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No hay notificaciones</h3>
            <p className="text-sm text-muted-foreground">
              Te notificaremos cuando tengas nuevos mensajes o actualizaciones.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="space-y-3">
              {displayNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                    !notification.isRead
                      ? "bg-accent/20 border-accent hover:bg-accent/30"
                      : "hover:bg-accent/50"
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-muted-foreground font-medium">
                          {getNotificationTypeLabel(notification)}
                        </span>
                        {!notification.isRead && (
                          <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                        )}
                      </div>
                      <h4 className="text-sm font-medium mb-1 line-clamp-1">
                        {notification.title}
                      </h4>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(notification.createdAt)}
                        </span>
                        <div
                          className="flex gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {!notification.isRead && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markAsRead(notification.id)}
                              className="h-6 w-6 p-0"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteNotification(notification.id)}
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <Separator className="my-4" />

        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={() => {
              router.push("/notificaciones");
              setIsOpen(false);
            }}
          >
            Ver todas las notificaciones
          </Button>
          <div className="text-xs text-muted-foreground">
            {displayNotifications.length} de {stats.total}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default NotificationCenter;
