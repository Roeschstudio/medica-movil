"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { chatService } from "@/lib/chat-service";
import type { ChatRoom } from "@/lib/types";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import {
  CheckCircle2,
  Clock,
  Filter,
  MessageCircle,
  MoreVertical,
  Phone,
  Search,
  Video,
  XCircle,
} from "lucide-react";
import { useUnifiedAuth } from "@/lib/unified-auth-context";
import React, { useCallback, useEffect, useState } from "react";

interface ChatRoomWithDetails extends ChatRoom {
  appointment?: {
    id: string;
    scheduledAt: Date;
    type: string;
    status: string;
  };
  patient?: {
    id: string;
    name: string;
    profileImage?: string;
  };
  doctor?: {
    id: string;
    name: string;
    specialty?: string;
    profileImage?: string;
  };
  lastMessage?: {
    id: string;
    content: string;
    messageType: string;
    sentAt: Date;
    senderName: string;
  };
  unreadCount: number;
}

interface ChatRoomListProps {
  onSelectChatRoom: (chatRoom: ChatRoomWithDetails) => void;
  selectedChatRoomId?: string;
  className?: string;
}

interface ChatRoomItemProps {
  chatRoom: ChatRoomWithDetails;
  isSelected: boolean;
  onClick: () => void;
  currentUserId: string;
  currentUserRole: string;
}

const ChatRoomItem: React.FC<ChatRoomItemProps> = ({
  chatRoom,
  isSelected,
  onClick,
  currentUserId,
  currentUserRole,
}) => {
  const isDoctor = currentUserRole === "DOCTOR";
  const otherUser = isDoctor ? chatRoom.patient : chatRoom.doctor;

  const formatLastMessageTime = (date: Date) => {
    if (isToday(date)) {
      return format(date, "HH:mm", { locale: es });
    } else if (isYesterday(date)) {
      return "Ayer";
    } else {
      return format(date, "dd/MM", { locale: es });
    }
  };

  const getStatusIcon = () => {
    if (!chatRoom.appointment) return null;

    switch (chatRoom.appointment.status) {
      case "CONFIRMED":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "PENDING":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "CANCELLED":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "COMPLETED":
        return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getConsultationTypeIcon = () => {
    if (!chatRoom.appointment) return <MessageCircle className="h-4 w-4" />;

    switch (chatRoom.appointment.type) {
      case "VIRTUAL":
        return <Video className="h-4 w-4" />;
      case "IN_PERSON":
        return <MessageCircle className="h-4 w-4" />;
      case "HOME_VISIT":
        return <Phone className="h-4 w-4" />;
      default:
        return <MessageCircle className="h-4 w-4" />;
    }
  };

  const truncateMessage = (content: string, maxLength: number = 50) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + "...";
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 cursor-pointer transition-colors hover:bg-muted/50",
        isSelected && "bg-muted border-l-4 border-l-primary"
      )}
      onClick={onClick}
    >
      <div className="relative">
        <Avatar className="h-12 w-12">
          <AvatarImage src={otherUser?.profileImage} />
          <AvatarFallback>{otherUser?.name?.charAt(0) || "U"}</AvatarFallback>
        </Avatar>

        {chatRoom.isActive && (
          <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 border-2 border-background rounded-full" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm truncate">
              {otherUser?.name || "Usuario"}
            </h3>
            {isDoctor && chatRoom.doctor?.specialty && (
              <Badge variant="outline" className="text-xs px-1 py-0">
                {chatRoom.doctor.specialty}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {getStatusIcon()}
            {getConsultationTypeIcon()}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            {chatRoom.lastMessage ? (
              <p className="text-sm text-muted-foreground truncate">
                {chatRoom.lastMessage.messageType === "TEXT"
                  ? truncateMessage(chatRoom.lastMessage.content)
                  : chatRoom.lastMessage.messageType === "IMAGE"
                    ? "📷 Imagen"
                    : chatRoom.lastMessage.messageType === "FILE"
                      ? "📎 Archivo"
                      : "Mensaje"}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No hay mensajes
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {chatRoom.lastMessage && (
              <span className="text-xs text-muted-foreground">
                {formatLastMessageTime(chatRoom.lastMessage.sentAt)}
              </span>
            )}

            {chatRoom.unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="text-xs min-w-[20px] h-5 flex items-center justify-center px-1"
              >
                {chatRoom.unreadCount > 99 ? "99+" : chatRoom.unreadCount}
              </Badge>
            )}
          </div>
        </div>

        {chatRoom.appointment && (
          <div className="mt-1">
            <p className="text-xs text-muted-foreground">
              Cita:{" "}
              {format(chatRoom.appointment.scheduledAt, "dd/MM/yyyy HH:mm", {
                locale: es,
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

interface FilterOptions {
  status: "all" | "active" | "ended";
  type: "all" | "VIRTUAL" | "IN_PERSON" | "HOME_VISIT";
  unreadOnly: boolean;
}

export const ChatRoomList: React.FC<ChatRoomListProps> = ({
  onSelectChatRoom,
  selectedChatRoomId,
  className,
}) => {
  const { user } = useUnifiedAuth();
  const [chatRooms, setChatRooms] = useState<ChatRoomWithDetails[]>([]);
  const [filteredChatRooms, setFilteredChatRooms] = useState<
    ChatRoomWithDetails[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterOptions>({
    status: "all",
    type: "all",
    unreadOnly: false,
  });
  const [showFilters, setShowFilters] = useState(false);

  const userId = user?.id || "";
  const userRole = user?.role || "PATIENT";

  const loadChatRooms = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Call the actual API
      const chatRooms = await chatService.getActiveChatRooms(userId);
      setChatRooms(chatRooms as ChatRoomWithDetails[]);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error loading chat rooms";
      setError(errorMessage);
      console.error("Error loading chat rooms:", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Filter and search chat rooms
  useEffect(() => {
    let filtered = [...chatRooms];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((room) => {
        const isDoctor = userRole === "DOCTOR";
        const otherUser = isDoctor ? room.patient : room.doctor;
        const userName = otherUser?.name?.toLowerCase() || "";
        const lastMessageContent =
          room.lastMessage?.content?.toLowerCase() || "";

        return userName.includes(query) || lastMessageContent.includes(query);
      });
    }

    // Apply status filter
    if (filters.status !== "all") {
      filtered = filtered.filter((room) => {
        if (filters.status === "active") return room.isActive;
        if (filters.status === "ended") return !room.isActive;
        return true;
      });
    }

    // Apply type filter
    if (filters.type !== "all") {
      filtered = filtered.filter(
        (room) => room.appointment?.type === filters.type
      );
    }

    // Apply unread filter
    if (filters.unreadOnly) {
      filtered = filtered.filter((room) => room.unreadCount > 0);
    }

    // Sort by last message time (most recent first)
    filtered.sort((a, b) => {
      const aTime = a.lastMessage?.sentAt || a.updatedAt;
      const bTime = b.lastMessage?.sentAt || b.updatedAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    setFilteredChatRooms(filtered);
  }, [chatRooms, searchQuery, filters, userRole]);

  // Load chat rooms on mount
  useEffect(() => {
    loadChatRooms();
  }, [loadChatRooms]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(loadChatRooms, 30000);
    return () => clearInterval(interval);
  }, [loadChatRooms]);

  const handleFilterChange = (key: keyof FilterOptions, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const getTotalUnreadCount = () => {
    return chatRooms.reduce((total, room) => total + room.unreadCount, 0);
  };

  if (isLoading) {
    return (
      <Card className={cn("flex flex-col h-full", className)}>
        <CardHeader>
          <CardTitle className="text-lg">Chats</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin h-8 w-8 border-2 border-current border-t-transparent rounded-full" />
            <p className="text-sm text-muted-foreground">Cargando chats...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("flex flex-col h-full", className)}>
        <CardHeader>
          <CardTitle className="text-lg">Chats</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-destructive mb-2">{error}</p>
            <Button variant="outline" size="sm" onClick={loadChatRooms}>
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Chats</CardTitle>
            {getTotalUnreadCount() > 0 && (
              <Badge variant="destructive" className="text-xs">
                {getTotalUnreadCount()}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(showFilters && "bg-muted")}
            >
              <Filter className="h-4 w-4" />
            </Button>

            <Button variant="ghost" size="sm" onClick={loadChatRooms}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {showFilters && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Estado
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) =>
                      handleFilterChange("status", e.target.value)
                    }
                    className="w-full mt-1 text-sm border rounded px-2 py-1"
                  >
                    <option value="all">Todos</option>
                    <option value="active">Activos</option>
                    <option value="ended">Finalizados</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Tipo
                  </label>
                  <select
                    value={filters.type}
                    onChange={(e) => handleFilterChange("type", e.target.value)}
                    className="w-full mt-1 text-sm border rounded px-2 py-1"
                  >
                    <option value="all">Todos</option>
                    <option value="VIRTUAL">Virtual</option>
                    <option value="IN_PERSON">Presencial</option>
                    <option value="HOME_VISIT">Domicilio</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.unreadOnly}
                  onChange={(e) =>
                    handleFilterChange("unreadOnly", e.target.checked)
                  }
                  className="rounded"
                />
                Solo no leídos
              </label>
            </div>
          )}
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="flex-1 p-0 min-h-0">
        <ScrollArea className="h-full">
          {filteredChatRooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center p-4">
              <MessageCircle className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ||
                filters.status !== "all" ||
                filters.type !== "all" ||
                filters.unreadOnly
                  ? "No se encontraron chats con los filtros aplicados"
                  : "No tienes chats activos"}
              </p>
              {(searchQuery ||
                filters.status !== "all" ||
                filters.type !== "all" ||
                filters.unreadOnly) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setSearchQuery("");
                    setFilters({
                      status: "all",
                      type: "all",
                      unreadOnly: false,
                    });
                  }}
                >
                  Limpiar filtros
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {filteredChatRooms.map((chatRoom) => (
                <ChatRoomItem
                  key={chatRoom.id}
                  chatRoom={chatRoom}
                  isSelected={chatRoom.id === selectedChatRoomId}
                  onClick={() => onSelectChatRoom(chatRoom)}
                  currentUserId={userId}
                  currentUserRole={userRole}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default ChatRoomList;
