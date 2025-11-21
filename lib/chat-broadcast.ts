import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface BroadcastMessage {
  type:
    | "message"
    | "typing"
    | "user_joined"
    | "user_left"
    | "file_upload"
    | "system";
  chatRoomId: string;
  senderId: string;
  senderName: string;
  content?: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface TypingIndicator {
  userId: string;
  userName: string;
  isTyping: boolean;
  timestamp: number;
}

export interface FileUploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: "uploading" | "completed" | "error";
  error?: string;
}

export class ChatBroadcastService {
  private supabase = createSupabaseBrowserClient();
  private channels = new Map<string, RealtimeChannel>();
  private messageQueue = new Map<string, BroadcastMessage[]>();
  private retryAttempts = new Map<string, number>();
  private maxRetries = 3;
  private retryDelay = 1000;

  // Get or create a broadcast channel for a chat room
  private getChannel(chatRoomId: string): RealtimeChannel {
    const channelKey = `broadcast_${chatRoomId}`;

    if (!this.channels.has(channelKey)) {
      const channel = this.supabase.channel(channelKey, {
        config: {
          broadcast: { self: true },
          presence: { key: chatRoomId },
        },
      });

      this.channels.set(channelKey, channel);
    }

    return this.channels.get(channelKey)!;
  }

  // Subscribe to broadcast messages for a chat room
  async subscribeToBroadcast(
    chatRoomId: string,
    onMessage: (message: BroadcastMessage) => void,
    onTyping?: (typing: TypingIndicator) => void,
    onFileProgress?: (progress: FileUploadProgress) => void
  ): Promise<RealtimeChannel> {
    const channel = this.getChannel(chatRoomId);

    // Subscribe to different broadcast events
    channel
      .on("broadcast", { event: "message" }, ({ payload }) => {
        onMessage(payload as BroadcastMessage);
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (onTyping) {
          onTyping(payload as TypingIndicator);
        }
      })
      .on("broadcast", { event: "file_progress" }, ({ payload }) => {
        if (onFileProgress) {
          onFileProgress(payload as FileUploadProgress);
        }
      })
      .on("broadcast", { event: "system" }, ({ payload }) => {
        onMessage(payload as BroadcastMessage);
      });

    await channel.subscribe();
    return channel;
  }

  // Broadcast a chat message
  async broadcastMessage(
    chatRoomId: string,
    senderId: string,
    senderName: string,
    content: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const message: BroadcastMessage = {
      type: "message",
      chatRoomId,
      senderId,
      senderName,
      content,
      metadata,
      timestamp: Date.now(),
    };

    await this.sendBroadcast(chatRoomId, "message", message);
  }

  // Broadcast typing indicator
  async broadcastTyping(
    chatRoomId: string,
    userId: string,
    userName: string,
    isTyping: boolean
  ): Promise<void> {
    const typing: TypingIndicator = {
      userId,
      userName,
      isTyping,
      timestamp: Date.now(),
    };

    await this.sendBroadcast(chatRoomId, "typing", typing);
  }

  // Broadcast file upload progress
  async broadcastFileProgress(
    chatRoomId: string,
    fileId: string,
    fileName: string,
    progress: number,
    status: FileUploadProgress["status"],
    error?: string
  ): Promise<void> {
    const fileProgress: FileUploadProgress = {
      fileId,
      fileName,
      progress,
      status,
      error,
    };

    await this.sendBroadcast(chatRoomId, "file_progress", fileProgress);
  }

  // Broadcast system message (user joined/left, etc.)
  async broadcastSystemMessage(
    chatRoomId: string,
    type: "user_joined" | "user_left" | "system",
    senderId: string,
    senderName: string,
    content: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const message: BroadcastMessage = {
      type,
      chatRoomId,
      senderId,
      senderName,
      content,
      metadata,
      timestamp: Date.now(),
    };

    await this.sendBroadcast(chatRoomId, "system", message);
  }

  // Send broadcast with retry logic
  private async sendBroadcast(
    chatRoomId: string,
    event: string,
    payload: any,
    attempt = 1
  ): Promise<void> {
    try {
      const channel = this.getChannel(chatRoomId);

      // Ensure channel is subscribed
      if (channel.state !== "joined") {
        await channel.subscribe();
      }

      await channel.send({
        type: "broadcast",
        event,
        payload,
      });

      // Clear retry attempts on success
      this.retryAttempts.delete(`${chatRoomId}_${event}`);

      // Process any queued messages
      await this.processMessageQueue(chatRoomId);
    } catch (error) {
      console.error(`Broadcast failed (attempt ${attempt}):`, error);

      const retryKey = `${chatRoomId}_${event}`;
      const currentAttempts = this.retryAttempts.get(retryKey) || 0;

      if (attempt < this.maxRetries) {
        // Queue message for retry
        this.queueMessage(chatRoomId, payload);
        this.retryAttempts.set(retryKey, currentAttempts + 1);

        // Retry with exponential backoff
        setTimeout(() => {
          this.sendBroadcast(chatRoomId, event, payload, attempt + 1);
        }, this.retryDelay * Math.pow(2, attempt - 1));
      } else {
        console.error(`Max retry attempts reached for ${retryKey}`);
        this.retryAttempts.delete(retryKey);
        throw error;
      }
    }
  }

  // Queue message for retry
  private queueMessage(chatRoomId: string, message: BroadcastMessage): void {
    if (!this.messageQueue.has(chatRoomId)) {
      this.messageQueue.set(chatRoomId, []);
    }

    const queue = this.messageQueue.get(chatRoomId)!;
    queue.push(message);

    // Limit queue size to prevent memory issues
    if (queue.length > 100) {
      queue.shift(); // Remove oldest message
    }
  }

  // Process queued messages
  private async processMessageQueue(chatRoomId: string): Promise<void> {
    const queue = this.messageQueue.get(chatRoomId);
    if (!queue || queue.length === 0) return;

    const messages = [...queue];
    this.messageQueue.set(chatRoomId, []);

    for (const message of messages) {
      try {
        await this.sendBroadcast(chatRoomId, message.type, message);
      } catch (error) {
        console.error("Failed to process queued message:", error);
        // Re-queue failed message
        this.queueMessage(chatRoomId, message);
      }
    }
  }

  // Broadcast to multiple chat rooms (for admin notifications)
  async broadcastToMultipleRooms(
    chatRoomIds: string[],
    senderId: string,
    senderName: string,
    content: string,
    type: BroadcastMessage["type"] = "system",
    metadata?: Record<string, any>
  ): Promise<void> {
    const promises = chatRoomIds.map((chatRoomId) => {
      if (type === "system") {
        return this.broadcastSystemMessage(
          chatRoomId,
          "system",
          senderId,
          senderName,
          content,
          metadata
        );
      } else {
        return this.broadcastMessage(
          chatRoomId,
          senderId,
          senderName,
          content,
          metadata
        );
      }
    });

    await Promise.allSettled(promises);
  }

  // Get active chat rooms for a user
  async getUserActiveChatRooms(userId: string): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from("chat_rooms")
        .select("id")
        .or(`patientId.eq.${userId},doctorId.eq.${userId}`)
        .eq("isActive", true);

      if (error) throw error;

      return data.map((room) => room.id);
    } catch (error) {
      console.error("Error fetching user chat rooms:", error);
      return [];
    }
  }

  // Broadcast notification to all user's active chat rooms
  async broadcastToUserRooms(
    userId: string,
    senderId: string,
    senderName: string,
    content: string,
    type: BroadcastMessage["type"] = "system",
    metadata?: Record<string, any>
  ): Promise<void> {
    const chatRoomIds = await this.getUserActiveChatRooms(userId);
    if (chatRoomIds.length > 0) {
      await this.broadcastToMultipleRooms(
        chatRoomIds,
        senderId,
        senderName,
        content,
        type,
        metadata
      );
    }
  }

  // Unsubscribe from a chat room
  async unsubscribeFromRoom(chatRoomId: string): Promise<void> {
    const channelKey = `broadcast_${chatRoomId}`;
    const channel = this.channels.get(channelKey);

    if (channel) {
      await channel.unsubscribe();
      this.channels.delete(channelKey);
    }

    // Clear any queued messages for this room
    this.messageQueue.delete(chatRoomId);

    // Clear retry attempts for this room
    const keysToDelete = Array.from(this.retryAttempts.keys()).filter((key) =>
      key.startsWith(`${chatRoomId}_`)
    );

    keysToDelete.forEach((key) => this.retryAttempts.delete(key));
  }

  // Cleanup all channels and queues
  async cleanup(): Promise<void> {
    const unsubscribePromises = Array.from(this.channels.values()).map(
      (channel) => channel.unsubscribe()
    );

    await Promise.allSettled(unsubscribePromises);

    this.channels.clear();
    this.messageQueue.clear();
    this.retryAttempts.clear();
  }

  // Get connection status for all channels
  getConnectionStatus(): Record<string, string> {
    const status: Record<string, string> = {};

    this.channels.forEach((channel, key) => {
      status[key] = channel.state;
    });

    return status;
  }

  // Get queue status
  getQueueStatus(): Record<string, number> {
    const status: Record<string, number> = {};

    this.messageQueue.forEach((queue, chatRoomId) => {
      status[chatRoomId] = queue.length;
    });

    return status;
  }
}

// Export singleton instance
export const chatBroadcastService = new ChatBroadcastService();
