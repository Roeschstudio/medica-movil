"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Bell, Check, Mail, MessageSquare, Phone, Trash2 } from "lucide-react";
import { useUnifiedAuth } from "@/lib/unified-auth-context";
import { useEffect, useState } from "react";

export function NotificationHistory() {
  const { user } = useUnifiedAuth();
  const router = useRouter();
  const {
    notifications: hookNotifications,
    stats: hookStats,
    loading: hookLoading,
    isConnected,
    fetchNotifications,
    markAsRead,
    deleteNotification,
  } = useNotifications();

  const [notifications, setNotifications] = useState(hookNotifications);
  const [stats, setStats] = useState(hookStats);
  const [loading, setLoading] = useState(hookLoading);
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>(
    []
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    type: "all",
    status: "all",
    search: "",
  });

  useEffect(() => {
    setNotifications(hookNotifications);
  }, [hookNotifications]);

  useEffect(() => {
    setStats(hookStats);
  }, [hookStats]);

  useEffect(() => {
    setLoading(hookLoading);
  }, [hookLoading]);

  useEffect(() => {
    if (user?.id) {
      fetchNotificationsWithFilters();
    }
  }, [user?.id, currentPage, filters]);

  const fetchNotificationsWithFilters = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
        ...(filters.type !== "all" && { type: filters.type.toUpperCase() }),
        ...(filters.status === "unread" && { unreadOnly: "true" }),
      });

      const response = await fetch(`/api/notifications?${params}`);
      if (response.ok) {
        const data = await response.json();
        let filteredNotifications = data.notifications || [];

        // Apply search filter on client side
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          filteredNotifications = filteredNotifications.filter(
            (notification: any) =>
              notification.title.toLowerCase().includes(searchLower) ||
              notification.message.toLowerCase().includes(searchLower)
          );
        }

        setNotifications(filteredNotifications);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const markNotificationsAsRead = async (notificationIds: string[]) => {
    try {
      // Use the hook's markAsRead for single notifications
      if (notificationIds.length === 1) {
        await markAsRead(notificationIds[0]);
      } else {
        // For bulk operations, use the API directly
        const response = await fetch("/api/notifications/bulk", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationIds, isRead: true }),
        });
        if (response.ok) {
          setNotifications((prev) =>
            prev.map((notification) =>
              notificationIds.includes(notification.id)
                ? { ...notification, isRead: true }
                : notification
            )
          );
        }
      }
      setSelectedNotifications([]);
    } catch (error) {
      console.error("Error marking notifications as read:", error);
    }
  };

  const deleteNotifications = async (notificationIds: string[]) => {
    try {
      // Use the hook's deleteNotification for single notifications
      if (notificationIds.length === 1) {
        await deleteNotification(notificationIds[0]);
      } else {
        // For bulk operations, use the API directly
        const response = await fetch("/api/notifications/bulk", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationIds }),
        });
        if (response.ok) {
          setNotifications((prev) =>
            prev.filter((n) => !notificationIds.includes(n.id))
          );
        }
      }
      setSelectedNotifications([]);
    } catch (error) {
      console.error("Error deleting notifications:", error);
    }
  };

  const handleNotificationClick = (notification: any) => {
    // Mark as read if not already read
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
  };

  const toggleNotificationSelection = (notificationId: string) => {
    setSelectedNotifications((prev) =>
      prev.includes(notificationId)
        ? prev.filter((id) => id !== notificationId)
        : [...prev, notificationId]
    );
  };

  const selectAllNotifications = () => {
    if (selectedNotifications.length === notifications.length) {
      setSelectedNotifications([]);
    } else {
      setSelectedNotifications(notifications.map((n) => n.id));
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "EMAIL":
        return <Mail className="h-4 w-4" />;
      case "SMS":
        return <Phone className="h-4 w-4" />;
      case "WHATSAPP":
        return <MessageSquare className="h-4 w-4" />;
      case "BROWSER":
        return <Bell className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "EMAIL":
        return "bg-blue-100 text-blue-800";
      case "SMS":
        return "bg-green-100 text-green-800";
      case "WHATSAPP":
        return "bg-emerald-100 text-emerald-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
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

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: es });
    } catch {
      return "Fecha inválida";
    }
  };

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">
          Debes iniciar sesión para ver tus notificaciones.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sin leer</CardTitle>
              <Badge
                variant="destructive"
                className="h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs"
              >
                {stats.unread}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.unread}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Hoy</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recent.today}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Esta semana</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recent.thisWeek}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Notificaciones</CardTitle>
              {isConnected ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedNotifications.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      markNotificationsAsRead(selectedNotifications)
                    }
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Marcar como leídas ({selectedNotifications.length})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteNotifications(selectedNotifications)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar ({selectedNotifications.length})
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar notificaciones..."
                value={filters.search}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value }))
                }
                className="max-w-sm"
              />
            </div>
            <div className="flex gap-2">
              <Select
                value={filters.type}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="browser">Navegador</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filters.status}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="unread">Sin leer</SelectItem>
                  <SelectItem value="read">Leídas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Cargando notificaciones...
              </p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No se encontraron notificaciones.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Select All */}
              <div className="flex items-center space-x-2 pb-2 border-b">
                <Checkbox
                  checked={
                    selectedNotifications.length === notifications.length
                  }
                  onCheckedChange={selectAllNotifications}
                />
                <span className="text-sm text-muted-foreground">
                  Seleccionar todas ({notifications.length})
                </span>
              </div>

              {/* Notifications List */}
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex items-start space-x-3 p-4 rounded-lg border transition-colors cursor-pointer ${
                    !notification.isRead
                      ? "bg-accent/20 border-accent"
                      : "hover:bg-accent/50"
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedNotifications.includes(notification.id)}
                      onCheckedChange={() =>
                        toggleNotificationSelection(notification.id)
                      }
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {getNotificationIcon(notification.type)}
                      <Badge className={getTypeColor(notification.type)}>
                        {notification.type}
                      </Badge>
                      <h3 className="font-medium truncate">
                        {notification.title}
                      </h3>
                      {!notification.isRead && (
                        <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{formatTimeAgo(notification.createdAt)}</span>
                      <span>{formatDate(notification.createdAt)}</span>
                    </div>
                  </div>
                  <div
                    className="flex gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!notification.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          markNotificationsAsRead([notification.id])
                        }
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteNotifications([notification.id])}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>
                  <span className="flex items-center px-3 text-sm">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    Siguiente
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
