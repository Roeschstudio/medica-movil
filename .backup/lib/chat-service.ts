import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { ChatMessage, ChatRoom, MessageType } from "@/lib/types";
import { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

// Interfaces for the ChatService
export interface FileData {
  url: string;
  name: string;
  size: number;
  type: string;
}

export interface MessageCallbacks {
  onMessage: (message: ChatMessage) => void;
  onMessageUpdate: (message: ChatMessage) => void;
  onError: (error: Error) => void;
  onConnectionChange: (connected: boolean) => void;
}

export interface ConnectionStatus {
  isConnected: boolean;
  isReconnecting: boolean;
  lastConnected: Date | null;
  reconnectAttempts: number;
}

export interface SendMessageOptions {
  content?: string;
  messageType?: MessageType;
  fileData?: FileData;
}

export interface ChatServiceConfig {
  maxReconnectAttempts: number;
  reconnectDelay: number;
  maxFileSize: number;
  allowedFileTypes: string[];
  messageRetryAttempts: number;
}

// Default configuration
const DEFAULT_CONFIG: ChatServiceConfig = {
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedFileTypes: [
    "image/*",
    "application/pdf",
    "text/*",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  messageRetryAttempts: 3,
};

/**
 * Comprehensive ChatService class for real-time chat functionality
 * Implements all core methods for room and message management with Supabase Realtime
 */
export class ChatService {
  private supabase: SupabaseClient;
  private config: ChatServiceConfig;
  private subscriptions: Map<string, RealtimeChannel> = new Map();
  private connectionStatus: ConnectionStatus = {
    isConnected: false,
    isReconnecting: false,
    lastConnected: null,
    reconnectAttempts: 0,
  };
  private messageQueue: Array<{
    roomId: string;
    message: SendMessageOptions;
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
  }> = [];
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<ChatServiceConfig & { disableConnectionMonitoring?: boolean }> = {}) {
    this.supabase = createSupabaseBrowserClient();
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Only initialize connection monitoring if realtime is available and not disabled
    if (this.supabase?.realtime && !config?.disableConnectionMonitoring) {
      this.initializeConnectionMonitoring();
    }
  }

  /**
   * Initialize connection monitoring and heartbeat
   */
  private initializeConnectionMonitoring(): void {
    // Monitor Supabase connection status
    this.supabase.realtime.onOpen(() => {
      this.updateConnectionStatus(true);
      this.processMessageQueue();
    });

    this.supabase.realtime.onClose(() => {
      this.updateConnectionStatus(false);
      this.attemptReconnection();
    });

    this.supabase.realtime.onError((error) => {
      console.error("Supabase Realtime error:", error);
      this.updateConnectionStatus(false);
    });

    // Start heartbeat to monitor connection
    this.startHeartbeat();
  }

  /**
   * Start heartbeat to monitor connection health
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      // Check if we have active subscriptions and connection is healthy
      if (this.subscriptions.size > 0) {
        this.checkConnectionHealth();
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Check connection health by testing a simple query
   */
  private async checkConnectionHealth(): Promise<void> {
    try {
      const { error } = await this.supabase
        .from("chat_rooms")
        .select("id")
        .limit(1);

      if (error) {
        throw error;
      }

      if (!this.connectionStatus.isConnected) {
        this.updateConnectionStatus(true);
      }
    } catch (error) {
      console.error("Connection health check failed:", error);
      this.updateConnectionStatus(false);
    }
  }

  /**
   * Update connection status and notify subscribers (with monitoring)
   */
  private updateConnectionStatus(connected: boolean): void {
    const wasConnected = this.connectionStatus.isConnected;

    this.connectionStatus = {
      ...this.connectionStatus,
      isConnected: connected,
      lastConnected: connected
        ? new Date()
        : this.connectionStatus.lastConnected,
      reconnectAttempts: connected
        ? 0
        : this.connectionStatus.reconnectAttempts,
      isReconnecting: !connected && this.connectionStatus.reconnectAttempts > 0,
    };

    // Record connection metrics
    performanceMonitor.recordGauge("chat.connection_status", connected ? 1 : 0);
    performanceMonitor.recordGauge(
      "chat.active_connections",
      this.subscriptions.size
    );
    performanceMonitor.recordGauge(
      "chat.reconnect_attempts",
      this.connectionStatus.reconnectAttempts
    );

    if (wasConnected !== connected) {
      if (connected) {
        performanceMonitor.incrementCounter("chat.connection_established");
      } else {
        performanceMonitor.incrementCounter("chat.connection_lost");
      }

      // Notify all active subscriptions about connection change
      this.subscriptions.forEach((channel) => {
        const callbacks = (channel as any)._callbacks;
        if (callbacks?.onConnectionChange) {
          callbacks.onConnectionChange(connected);
        }
      });
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnection(): void {
    if (
      this.connectionStatus.reconnectAttempts >=
      this.config.maxReconnectAttempts
    ) {
      console.error("Max reconnection attempts reached");
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay =
      this.config.reconnectDelay *
      Math.pow(2, this.connectionStatus.reconnectAttempts);

    this.connectionStatus.reconnectAttempts++;
    this.connectionStatus.isReconnecting = true;

    this.reconnectTimer = setTimeout(async () => {
      try {
        // Reconnect all active subscriptions
        const roomIds = Array.from(this.subscriptions.keys());

        for (const roomId of roomIds) {
          const channel = this.subscriptions.get(roomId);
          if (channel) {
            await this.reconnectSubscription(roomId, channel);
          }
        }

        this.updateConnectionStatus(true);
      } catch (error) {
        console.error("Reconnection failed:", error);
        this.attemptReconnection();
      }
    }, delay);
  }

  /**
   * Reconnect a specific subscription
   */
  private async reconnectSubscription(
    roomId: string,
    oldChannel: RealtimeChannel
  ): Promise<void> {
    try {
      // Get callbacks from old channel
      const callbacks = (oldChannel as any)._callbacks;

      // Unsubscribe old channel
      await this.supabase.removeChannel(oldChannel);

      // Create new subscription
      if (callbacks) {
        this.subscribeToMessages(roomId, callbacks);
      }
    } catch (error) {
      console.error(
        `Failed to reconnect subscription for room ${roomId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get or create a chat room for an appointment (optimized)
   */
  async getOrCreateChatRoom(appointmentId: string): Promise<ChatRoom | null> {
    return perf.measure(
      "chat.get_or_create_room",
      async () => {
        try {
          // Try to get existing chat room with caching
          const existingRoom = await dbOptimizer.getChatRoom(appointmentId, {
            cache: true,
            cacheTTL: 300000, // 5 minutes cache
            tags: [`appointment:${appointmentId}`, "chatrooms"],
          });

          if (existingRoom) {
            performanceMonitor.incrementCounter("chat.room_cache_hit");
            return this.formatChatRoom(existingRoom);
          }

          performanceMonitor.incrementCounter("chat.room_cache_miss");

          // If no existing room, get appointment details to create one
          const { data: appointment, error: appointmentError } =
            await this.supabase
              .from("appointments")
              .select("id, patientId, doctorId, scheduledAt, type, status")
              .eq("id", appointmentId)
              .single();

          if (appointmentError || !appointment) {
            throw new Error("Appointment not found");
          }

          // Create new chat room
          const { data: newRoom, error: createError } = await this.supabase
            .from("chat_rooms")
            .insert({
              appointmentId,
              patientId: appointment.patientId,
              doctorId: appointment.doctorId,
              isActive: true,
            })
            .select(
              `
              *,
              appointment:appointments!inner(id, scheduledAt, type, status, patientId, doctorId),
              patient:users!chat_rooms_patientId_fkey(id, name, role),
              doctor:doctors!chat_rooms_doctorId_fkey(id, specialty, user:users(id, name))
            `
            )
            .single();

          if (createError) {
            throw createError;
          }

          // Invalidate cache to ensure fresh data
          dbOptimizer.invalidateCache(`appointment:${appointmentId}`);

          performanceMonitor.incrementCounter("chat.room_created");
          return this.formatChatRoom(newRoom);
        } catch (error) {
          performanceMonitor.incrementCounter("chat.room_error");
          console.error("Error getting or creating chat room:", error);
          throw error;
        }
      },
      { appointmentId }
    );
  }

  /**
   * Get a specific chat room by ID
   */
  async getChatRoom(roomId: string, userId: string): Promise<ChatRoom | null> {
    try {
      const { data: room, error } = await this.supabase
        .from("chat_rooms")
        .select(
          `
          *,
          appointment:appointments!inner(id, scheduledAt, type, status),
          patient:users!chat_rooms_patientId_fkey(id, name, role),
          doctor:doctors!chat_rooms_doctorId_fkey(id, specialty, user:users(id, name))
        `
        )
        .eq("id", roomId)
        .or(`patientId.eq.${userId},doctorId.eq.${userId}`)
        .single();

      if (error || !room) {
        return null;
      }

      return this.formatChatRoom(room);
    } catch (error) {
      console.error("Error fetching chat room:", error);
      throw error;
    }
  }

  /**
   * Create a new chat room
   */
  async createChatRoom(data: {
    appointmentId: string;
    patientId: string;
    doctorId: string;
  }): Promise<ChatRoom> {
    try {
      const { data: newRoom, error } = await this.supabase
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
          appointment:appointments!inner(id, scheduledAt, type, status),
          patient:users!chat_rooms_patientId_fkey(id, name, role),
          doctor:doctors!chat_rooms_doctorId_fkey(id, specialty, user:users(id, name))
        `
        )
        .single();

      if (error) {
        throw error;
      }

      return this.formatChatRoom(newRoom);
    } catch (error) {
      console.error("Error creating chat room:", error);
      throw error;
    }
  }

  /**
   * Deactivate a chat room
   */
  async deactivateChatRoom(roomId: string, userId: string): Promise<void> {
    try {
      // Verify user has access to this room
      const room = await this.getChatRoom(roomId, userId);
      if (!room) {
        throw new Error("Chat room not found or access denied");
      }

      const { error } = await this.supabase
        .from("chat_rooms")
        .update({ 
          isActive: false,
          endedAt: new Date().toISOString()
        })
        .eq("id", roomId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error("Error deactivating chat room:", error);
      throw error;
    }
  }

  /**
   * Get unread message count for a user
   */
  async getUnreadMessageCount(userId: string): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .neq("senderId", userId)
        .eq("isRead", false)
        .in(
          "chatRoomId",
          this.supabase
            .from("chat_rooms")
            .select("id")
            .or(`patientId.eq.${userId},doctorId.eq.${userId}`)
            .eq("isActive", true)
        );

      if (error) {
        throw error;
      }

      return count || 0;
    } catch (error) {
      console.error("Error getting unread message count:", error);
      return 0;
    }
  }

  /**
   * Get active chat rooms for the current user
   */
  async getActiveChatRooms(): Promise<ChatRoom[]> {
    try {
      const {
        data: { user },
      } = await this.supabase.auth.getUser();

      if (!user) {
        throw new Error("User not authenticated");
      }

      const { data: rooms, error } = await this.supabase
        .from("chat_rooms")
        .select(
          `
          *,
          appointment:appointments!inner(id, scheduledAt, type, status),
          patient:users!chat_rooms_patientId_fkey(id, name, role),
          doctor:doctors!chat_rooms_doctorId_fkey(id, specialty, user:users(id, name))
        `
        )
        .eq("isActive", true)
        .or(`patientId.eq.${user.id},doctorId.eq.${user.id}`)
        .order("updatedAt", { ascending: false });

      if (error) {
        throw error;
      }

      return (rooms || []).map((room) => this.formatChatRoom(room));
    } catch (error) {
      console.error("Error fetching active chat rooms:", error);
      throw error;
    }
  }

  /**
   * Get messages for a chat room with pagination (optimized)
   */
  async getMessages(
    roomId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ChatMessage[]> {
    return perf.measure(
      "chat.get_messages",
      async () => {
        // Use optimized database query with caching
        const messages = await dbOptimizer.getMessages(roomId, limit, offset, {
          cache: true,
          cacheTTL: 60000, // 1 minute cache for messages
          tags: [`room:${roomId}`, "messages"],
        });

        performanceMonitor.recordGauge(
          "chat.messages_fetched",
          messages.length
        );
        return messages;
      },
      { roomId, limit: limit.toString(), offset: offset.toString() }
    );
  }

  /**
   * Send a message with retry logic and queuing (optimized)
   */
  async sendMessage(
    roomId: string,
    senderId: string,
    content: string,
    type: MessageType = "TEXT",
    fileData?: FileData
  ): Promise<boolean> {
    return perf.measure(
      "chat.send_message",
      async () => {
        const messageOptions: SendMessageOptions = {
          content,
          messageType: type,
          fileData,
        };

        performanceMonitor.incrementCounter("chat.message_send_attempt", {
          type,
          hasFile: fileData ? "true" : "false",
        });

        // If not connected, queue the message
        if (!this.connectionStatus.isConnected) {
          performanceMonitor.incrementCounter("chat.message_queued");
          return new Promise((resolve, reject) => {
            this.messageQueue.push({
              roomId,
              message: messageOptions,
              resolve,
              reject,
            });
          });
        }

        const result = await this.sendMessageWithRetry(
          roomId,
          senderId,
          messageOptions
        );

        if (result) {
          performanceMonitor.incrementCounter("chat.message_sent", { type });
          // Invalidate message cache for this room
          dbOptimizer.invalidateCache(`room:${roomId}`);
        }

        return result;
      },
      { roomId, senderId, type }
    );
  }

  /**
   * Send message with retry logic
   */
  private async sendMessageWithRetry(
    roomId: string,
    senderId: string,
    options: SendMessageOptions,
    attempt: number = 1
  ): Promise<boolean> {
    try {
      const { data: message, error } = await this.supabase
        .from("chat_messages")
        .insert({
          chatRoomId: roomId,
          senderId,
          content: options.content,
          messageType: options.messageType || "TEXT",
          fileUrl: options.fileData?.url,
          fileName: options.fileData?.name,
          fileSize: options.fileData?.size,
          isRead: false,
        })
        .select(
          `
          *,
          sender:users!chat_messages_senderId_fkey(id, name, role)
        `
        )
        .single();

      if (error) {
        throw error;
      }

      // Update chat room's updatedAt timestamp
      await this.supabase
        .from("chat_rooms")
        .update({ updatedAt: new Date().toISOString() })
        .eq("id", roomId);

      // Create notification for the recipient
      try {
        await this.createChatNotification(
          roomId,
          senderId,
          options.content || ""
        );
      } catch (notificationError) {
        console.error("Failed to create chat notification:", notificationError);
        // Don't fail the message send if notification fails
      }

      return true;
    } catch (error) {
      console.error(`Message send attempt ${attempt} failed:`, error);

      if (attempt < this.config.messageRetryAttempts) {
        // Wait before retry with exponential backoff
        await new Promise((resolve) => {
          setTimeout(resolve, 1000 * attempt);
        });
        return this.sendMessageWithRetry(
          roomId,
          senderId,
          options,
          attempt + 1
        );
      }

      throw error;
    }
  }

  /**
   * Process queued messages when connection is restored
   */
  private async processMessageQueue(): Promise<void> {
    const queue = [...this.messageQueue];
    this.messageQueue = [];

    for (const { roomId, message, resolve, reject } of queue) {
      try {
        const {
          data: { user },
        } = await this.supabase.auth.getUser();
        if (!user) {
          reject(new Error("User not authenticated"));
          continue;
        }

        const result = await this.sendMessageWithRetry(
          roomId,
          user.id,
          message
        );
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(roomId: string, userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from("chat_messages")
        .update({ isRead: true })
        .eq("chatRoomId", roomId)
        .neq("senderId", userId)
        .eq("isRead", false);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error("Error marking messages as read:", error);
      throw error;
    }
  }

  /**
   * Subscribe to real-time messages for a chat room
   */
  subscribeToMessages(
    roomId: string,
    callbacks: MessageCallbacks
  ): RealtimeChannel {
    // Remove existing subscription if any
    this.unsubscribeFromMessages(roomId);

    // Check if Supabase client and channel method are available
    if (!this.supabase?.channel) {
      console.warn("Supabase realtime not available");
      // Return a mock channel for testing
      const mockChannel = {
        on: () => mockChannel,
        subscribe: () => {},
      } as any;
      this.subscriptions.set(roomId, mockChannel);
      return mockChannel;
    }

    const channel = this.supabase
      .channel(`chat_room_${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `chatRoomId=eq.${roomId}`,
        },
        async (payload) => {
          try {
            // Fetch complete message data with sender info
            const { data: message, error } = await this.supabase
              .from("chat_messages")
              .select(
                `
                *,
                sender:users!chat_messages_senderId_fkey(id, name, role)
              `
              )
              .eq("id", payload.new.id)
              .single();

            if (error) {
              throw error;
            }

            callbacks.onMessage(message as ChatMessage);
          } catch (error) {
            console.error("Error processing new message:", error);
            callbacks.onError(error as Error);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_messages",
          filter: `chatRoomId=eq.${roomId}`,
        },
        async (payload) => {
          try {
            // Fetch complete message data with sender info
            const { data: message, error } = await this.supabase
              .from("chat_messages")
              .select(
                `
                *,
                sender:users!chat_messages_senderId_fkey(id, name, role)
              `
              )
              .eq("id", payload.new.id)
              .single();

            if (error) {
              throw error;
            }

            callbacks.onMessageUpdate(message as ChatMessage);
          } catch (error) {
            console.error("Error processing message update:", error);
            callbacks.onError(error as Error);
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          callbacks.onConnectionChange(true);
        } else if (status === "CLOSED") {
          callbacks.onConnectionChange(false);
        }
      });

    // Store callbacks for reconnection
    if (channel && typeof channel === "object") {
      (channel as any)._callbacks = callbacks;
    }

    this.subscriptions.set(roomId, channel);
    return channel;
  }

  /**
   * Unsubscribe from messages for a chat room
   */
  unsubscribeFromMessages(roomId: string): void {
    const channel = this.subscriptions.get(roomId);
    if (channel) {
      this.supabase.removeChannel(channel);
      this.subscriptions.delete(roomId);
    }
  }

  /**
   * Upload file to Supabase Storage
   */
  async uploadFile(file: File, roomId: string): Promise<string | null> {
    try {
      // Validate file
      this.validateFile(file);

      const {
        data: { user },
      } = await this.supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Generate unique filename
      const timestamp = Date.now();
      const fileExtension = file.name.split(".").pop();
      const fileName = `${timestamp}-${file.name}`;
      const filePath = `chat-files/${roomId}/${this.getFileCategory(
        file.type
      )}/${fileName}`;

      // Upload file
      const { data, error } = await this.supabase.storage
        .from("chat-files")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = this.supabase.storage.from("chat-files").getPublicUrl(data.path);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading file:", error);
      throw error;
    }
  }

  /**
   * Validate file before upload
   */
  private validateFile(file: File): void {
    // Check file size
    if (file.size > this.config.maxFileSize) {
      throw new Error(
        `File size exceeds maximum allowed size of ${
          this.config.maxFileSize / (1024 * 1024)
        }MB`
      );
    }

    // Check file type
    const isAllowed = this.config.allowedFileTypes.some((allowedType) => {
      if (allowedType.endsWith("/*")) {
        const category = allowedType.replace("/*", "");
        return file.type.startsWith(category);
      }
      return file.type === allowedType;
    });

    if (!isAllowed) {
      throw new Error(`File type ${file.type} is not allowed`);
    }
  }

  /**
   * Get file category for storage organization
   */
  private getFileCategory(mimeType: string): string {
    if (mimeType.startsWith("image/")) return "images";
    if (mimeType.startsWith("video/")) return "videos";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType === "application/pdf") return "documents";
    if (mimeType.includes("document") || mimeType.includes("text"))
      return "documents";
    return "other";
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Manual reconnection trigger
   */
  async reconnect(): Promise<void> {
    this.connectionStatus.reconnectAttempts = 0;
    this.attemptReconnection();
  }

  /**
   * Format chat room data for consistent structure
   */
  private formatChatRoom(room: any): ChatRoom {
    return {
      id: room.id,
      appointmentId: room.appointmentId,
      patientId: room.patientId,
      doctorId: room.doctorId,
      isActive: room.isActive,
      startedAt: new Date(room.startedAt),
      endedAt: room.endedAt ? new Date(room.endedAt) : undefined,
      createdAt: new Date(room.createdAt),
      updatedAt: new Date(room.updatedAt),
    };
  }

  /**
   * Create chat notification for message recipient
   */
  private async createChatNotification(
    roomId: string,
    senderId: string,
    messageContent: string
  ): Promise<void> {
    try {
      // Get chat room details to find recipient
      const { data: chatRoom, error } = await this.supabase
        .from("chat_rooms")
        .select("patientId, doctorId")
        .eq("id", roomId)
        .single();

      if (error || !chatRoom) {
        throw new Error("Chat room not found");
      }

      // Determine recipient (the other participant)
      const recipientId =
        senderId === chatRoom.patientId
          ? chatRoom.doctorId
          : chatRoom.patientId;

      // Create notification via the notification service
      await notificationService.createChatNotification(
        roomId,
        senderId,
        messageContent,
        recipientId
      );
    } catch (error) {
      console.error("Error creating chat notification:", error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Clear timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Unsubscribe from all channels
    this.subscriptions.forEach((channel, roomId) => {
      this.unsubscribeFromMessages(roomId);
    });

    // Clear message queue
    this.messageQueue.forEach(({ reject }) => {
      reject(new Error("ChatService destroyed"));
    });
    this.messageQueue = [];
  }
}

// Export singleton instance - will be created when first imported
let _chatService: ChatService | null = null;

export const chatService = (() => {
  if (!_chatService) {
    // Check if we're in test environment
    const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
    _chatService = new ChatService(isTest ? { disableConnectionMonitoring: true } : {});
  }
  return _chatService;
})();

// Export factory function for testing
export const createChatService = (config?: Partial<ChatServiceConfig>) => {
  return new ChatService(config);
};
