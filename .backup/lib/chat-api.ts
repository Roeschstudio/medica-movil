import type { ChatMessage } from "@/hooks/use-chat-realtime";
import { chatBroadcastService } from "@/lib/chat-broadcast";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

export interface ChatRoom {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  isActive: boolean;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  appointment?: {
    id: string;
    scheduledAt: string;
    type: string;
    status: string;
  };
  patient?: {
    id: string;
    name: string;
    role: string;
  };
  doctor?: {
    id: string;
    name: string;
    specialty: string;
  };
  _count?: {
    messages: number;
    unreadMessages?: number;
  };
}

export interface CreateChatRoomData {
  appointmentId: string;
  patientId: string;
  doctorId: string;
}

export interface SendMessageData {
  chatRoomId: string;
  senderId: string;
  content?: string;
  messageType?: "TEXT" | "FILE" | "IMAGE" | "VIDEO" | "AUDIO";
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
}

export interface MessageFilters {
  messageType?: "TEXT" | "FILE" | "IMAGE" | "VIDEO" | "AUDIO";
  senderId?: string;
  isRead?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface ChatStats {
  totalMessages: number;
  unreadMessages: number;
  lastMessageAt: Date | null;
  participantCount: number;
  averageResponseTime: number;
}

export class ChatApiService {
  private supabase = createSupabaseBrowserClient();

  // Create a new chat room
  async createChatRoom(data: CreateChatRoomData): Promise<ChatRoom> {
    try {
      const { data: chatRoom, error } = await this.supabase
        .from("chat_rooms")
        .insert({
          appointmentId: data.appointmentId,
          patientId: data.patientId,
          doctorId: data.doctorId,
          isActive: true,
        })
        .select(
          `
          *,
          appointment:appointmentId (
            id,
            scheduledAt,
            type,
            status
          ),
          patient:patientId (
            id,
            name,
            role
          ),
          doctor:doctorId (
            id,
            name,
            doctorProfile (
              specialty
            )
          )
        `
        )
        .single();

      if (error) throw error;

      // Broadcast room creation
      await chatBroadcastService.broadcastSystemMessage(
        chatRoom.id,
        "system",
        "system",
        "Sistema",
        "Chat iniciado para la consulta",
        { appointmentId: data.appointmentId }
      );

      return this.formatChatRoom(chatRoom);
    } catch (error) {
      console.error("Error creating chat room:", error);
      throw error;
    }
  }

  // Get chat room by ID
  async getChatRoom(
    chatRoomId: string,
    userId: string
  ): Promise<ChatRoom | null> {
    try {
      const { data: chatRoom, error } = await this.supabase
        .from("chat_rooms")
        .select(
          `
          *,
          appointment:appointmentId (
            id,
            scheduledAt,
            type,
            status
          ),
          patient:patientId (
            id,
            name,
            role
          ),
          doctor:doctorId (
            id,
            name,
            doctorProfile (
              specialty
            )
          ),
          _count:messages (
            count
          )
        `
        )
        .eq("id", chatRoomId)
        .or(`patientId.eq.${userId},doctorId.eq.${userId}`)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null; // Not found
        throw error;
      }

      return this.formatChatRoom(chatRoom);
    } catch (error) {
      console.error("Error fetching chat room:", error);
      throw error;
    }
  }

  // Get chat rooms for a user
  async getUserChatRooms(
    userId: string,
    options: PaginationOptions & { includeInactive?: boolean } = {}
  ): Promise<{ chatRooms: ChatRoom[]; total: number }> {
    try {
      const { page = 1, limit = 20, includeInactive = false } = options;
      const offset = (page - 1) * limit;

      let query = this.supabase
        .from("chat_rooms")
        .select(
          `
          *,
          appointment:appointmentId (
            id,
            scheduledAt,
            type,
            status
          ),
          patient:patientId (
            id,
            name,
            role
          ),
          doctor:doctorId (
            id,
            name,
            doctorProfile (
              specialty
            )
          ),
          _count:messages (
            count
          )
        `,
          { count: "exact" }
        )
        .or(`patientId.eq.${userId},doctorId.eq.${userId}`)
        .order("updatedAt", { ascending: false })
        .range(offset, offset + limit - 1);

      if (!includeInactive) {
        query = query.eq("isActive", true);
      }

      const { data: chatRooms, error, count } = await query;

      if (error) throw error;

      return {
        chatRooms: (chatRooms || []).map(this.formatChatRoom),
        total: count || 0,
      };
    } catch (error) {
      console.error("Error fetching user chat rooms:", error);
      throw error;
    }
  }

  // Send a message
  async sendMessage(
    data: SendMessageData,
    senderName: string
  ): Promise<ChatMessage> {
    try {
      const { data: message, error } = await this.supabase
        .from("chat_messages")
        .insert({
          chatRoomId: data.chatRoomId,
          senderId: data.senderId,
          content: data.content,
          messageType: data.messageType || "TEXT",
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          fileSize: data.fileSize,
          isRead: false,
        })
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
        .single();

      if (error) throw error;

      // Broadcast the message
      await chatBroadcastService.broadcastMessage(
        data.chatRoomId,
        data.senderId,
        senderName,
        data.content || "",
        {
          messageType: data.messageType,
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          messageId: message.id,
        }
      );

      // Update chat room's updatedAt timestamp
      await this.supabase
        .from("chat_rooms")
        .update({ updatedAt: new Date().toISOString() })
        .eq("id", data.chatRoomId);

      return message as ChatMessage;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  // Get messages for a chat room
  async getChatMessages(
    chatRoomId: string,
    userId: string,
    options: PaginationOptions & { filters?: MessageFilters } = {}
  ): Promise<{ messages: ChatMessage[]; total: number; hasMore: boolean }> {
    try {
      const { page = 1, limit = 50, filters = {} } = options;
      const offset = (page - 1) * limit;

      // Verify user has access to this chat room
      const hasAccess = await this.verifyChatRoomAccess(chatRoomId, userId);
      if (!hasAccess) {
        throw new Error("Access denied to chat room");
      }

      let query = this.supabase
        .from("chat_messages")
        .select(
          `
          *,
          sender:senderId (
            id,
            name,
            role
          )
        `,
          { count: "exact" }
        )
        .eq("chatRoomId", chatRoomId)
        .order("sentAt", { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply filters
      if (filters.messageType) {
        query = query.eq("messageType", filters.messageType);
      }
      if (filters.senderId) {
        query = query.eq("senderId", filters.senderId);
      }
      if (filters.isRead !== undefined) {
        query = query.eq("isRead", filters.isRead);
      }
      if (filters.dateFrom) {
        query = query.gte("sentAt", filters.dateFrom.toISOString());
      }
      if (filters.dateTo) {
        query = query.lte("sentAt", filters.dateTo.toISOString());
      }

      const { data: messages, error, count } = await query;

      if (error) throw error;

      return {
        messages: (messages || []).reverse() as ChatMessage[], // Reverse to show oldest first
        total: count || 0,
        hasMore: (count || 0) > offset + limit,
      };
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      throw error;
    }
  }

  // Mark messages as read
  async markMessagesAsRead(
    chatRoomId: string,
    userId: string,
    messageIds?: string[]
  ): Promise<void> {
    try {
      // Verify user has access to this chat room
      const hasAccess = await this.verifyChatRoomAccess(chatRoomId, userId);
      if (!hasAccess) {
        throw new Error("Access denied to chat room");
      }

      let query = this.supabase
        .from("chat_messages")
        .update({ isRead: true })
        .eq("chatRoomId", chatRoomId)
        .neq("senderId", userId); // Don't mark own messages as read

      if (messageIds && messageIds.length > 0) {
        query = query.in("id", messageIds);
      } else {
        query = query.eq("isRead", false);
      }

      const { error } = await query;

      if (error) throw error;
    } catch (error) {
      console.error("Error marking messages as read:", error);
      throw error;
    }
  }

  // Get unread message count for a user
  async getUnreadMessageCount(userId: string): Promise<number> {
    try {
      const { data: chatRooms } = await this.supabase
        .from("chat_rooms")
        .select("id")
        .or(`patientId.eq.${userId},doctorId.eq.${userId}`)
        .eq("isActive", true);

      if (!chatRooms || chatRooms.length === 0) return 0;

      const chatRoomIds = chatRooms.map((room) => room.id);

      const { count, error } = await this.supabase
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .in("chatRoomId", chatRoomIds)
        .neq("senderId", userId)
        .eq("isRead", false);

      if (error) throw error;

      return count || 0;
    } catch (error) {
      console.error("Error fetching unread message count:", error);
      return 0;
    }
  }

  // Get chat statistics
  async getChatStats(chatRoomId: string, userId: string): Promise<ChatStats> {
    try {
      // Verify user has access to this chat room
      const hasAccess = await this.verifyChatRoomAccess(chatRoomId, userId);
      if (!hasAccess) {
        throw new Error("Access denied to chat room");
      }

      const [totalMessages, unreadMessages, lastMessage] = await Promise.all([
        this.getTotalMessageCount(chatRoomId),
        this.getUnreadMessageCountForRoom(chatRoomId, userId),
        this.getLastMessage(chatRoomId),
      ]);

      return {
        totalMessages,
        unreadMessages,
        lastMessageAt: lastMessage?.sentAt
          ? new Date(lastMessage.sentAt)
          : null,
        participantCount: 2, // Always doctor + patient
        averageResponseTime: 0, // TODO: Implement response time calculation
      };
    } catch (error) {
      console.error("Error fetching chat stats:", error);
      throw error;
    }
  }

  // Deactivate chat room
  async deactivateChatRoom(chatRoomId: string, userId: string): Promise<void> {
    try {
      // Verify user has access to this chat room
      const hasAccess = await this.verifyChatRoomAccess(chatRoomId, userId);
      if (!hasAccess) {
        throw new Error("Access denied to chat room");
      }

      const { error } = await this.supabase
        .from("chat_rooms")
        .update({
          isActive: false,
          endedAt: new Date().toISOString(),
        })
        .eq("id", chatRoomId);

      if (error) throw error;

      // Broadcast room deactivation
      await chatBroadcastService.broadcastSystemMessage(
        chatRoomId,
        "system",
        userId,
        "Sistema",
        "Chat finalizado",
        { endedAt: new Date().toISOString() }
      );
    } catch (error) {
      console.error("Error deactivating chat room:", error);
      throw error;
    }
  }

  // Private helper methods
  private async verifyChatRoomAccess(
    chatRoomId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from("chat_rooms")
        .select("id")
        .eq("id", chatRoomId)
        .or(`patientId.eq.${userId},doctorId.eq.${userId}`)
        .single();

      return !error && !!data;
    } catch {
      return false;
    }
  }

  private async getTotalMessageCount(chatRoomId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("chat_messages")
      .select("*", { count: "exact", head: true })
      .eq("chatRoomId", chatRoomId);

    if (error) throw error;
    return count || 0;
  }

  private async getUnreadMessageCountForRoom(
    chatRoomId: string,
    userId: string
  ): Promise<number> {
    const { count, error } = await this.supabase
      .from("chat_messages")
      .select("*", { count: "exact", head: true })
      .eq("chatRoomId", chatRoomId)
      .neq("senderId", userId)
      .eq("isRead", false);

    if (error) throw error;
    return count || 0;
  }

  private async getLastMessage(
    chatRoomId: string
  ): Promise<ChatMessage | null> {
    const { data, error } = await this.supabase
      .from("chat_messages")
      .select("*")
      .eq("chatRoomId", chatRoomId)
      .order("sentAt", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return (data as ChatMessage) || null;
  }

  private formatChatRoom(chatRoom: any): ChatRoom {
    return {
      ...chatRoom,
      doctor: chatRoom.doctor
        ? {
            ...chatRoom.doctor,
            specialty:
              chatRoom.doctor.doctorProfile?.specialty || "Medicina General",
          }
        : undefined,
    };
  }
}

// Export singleton instance
export const chatApiService = new ChatApiService();
