import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface BroadcastMessage {
  type:
    | "message"
    | "typing"
    | "user_joined"
    | "user_left"
    | "message_read"
    | "message_deleted"
    | "room_updated";
  payload: any;
  userId: string;
  chatRoomId: string;
  timestamp: string;
}

export interface TypingIndicator {
  userId: string;
  userName: string;
  isTyping: boolean;
  timestamp: string;
}

export interface UserPresence {
  userId: string;
  userName: string;
  status: "online" | "offline" | "away";
  lastSeen: string;
}

class ChatBroadcastClientService {
  private supabase = createSupabaseBrowserClient();
  private channels: Map<string, RealtimeChannel> = new Map();
  private messageHandlers: Map<
    string,
    Set<(message: BroadcastMessage) => void>
  > = new Map();
  private typingHandlers: Map<
    string,
    Set<(typing: TypingIndicator[]) => void>
  > = new Map();
  private presenceHandlers: Map<
    string,
    Set<(presence: UserPresence[]) => void>
  > = new Map();

  // Subscribe to a chat room for real-time updates
  subscribeToChatRoom(
    chatRoomId: string,
    userId: string,
    userName: string,
    callbacks?: {
      onMessage?: (message: BroadcastMessage) => void;
      onTyping?: (typing: TypingIndicator[]) => void;
      onPresence?: (presence: UserPresence[]) => void;
    }
  ): RealtimeChannel {
    const channelName = `chat-room-${chatRoomId}`;

    if (this.channels.has(channelName)) {
      return this.channels.get(channelName)!;
    }

    const channel = this.supabase.channel(channelName, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    // Handle broadcast messages
    channel.on("broadcast", { event: "message" }, (payload) => {
      const message: BroadcastMessage = payload.payload;
      this.handleMessage(chatRoomId, message);
      callbacks?.onMessage?.(message);
    });

    // Handle typing indicators
    channel.on("broadcast", { event: "typing" }, (payload) => {
      const typing: TypingIndicator = payload.payload;
      this.handleTyping(chatRoomId, typing);
    });

    // Handle presence changes
    channel.on("presence", { event: "sync" }, () => {
      const presenceState = channel.presenceState();
      const presence = this.transformPresenceState(presenceState);
      this.handlePresence(chatRoomId, presence);
      callbacks?.onPresence?.(presence);
    });

    channel.on("presence", { event: "join" }, ({ key, newPresences }) => {
      console.log("User joined:", key, newPresences);
    });

    channel.on("presence", { event: "leave" }, ({ key, leftPresences }) => {
      console.log("User left:", key, leftPresences);
    });

    // Subscribe and track presence
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          userId,
          userName,
          status: "online",
          lastSeen: new Date().toISOString(),
        });
      }
    });

    this.channels.set(channelName, channel);
    return channel;
  }

  // Send a broadcast message
  async sendBroadcastMessage(
    chatRoomId: string,
    message: Omit<BroadcastMessage, "timestamp">
  ): Promise<void> {
    const channelName = `chat-room-${chatRoomId}`;
    const channel = this.channels.get(channelName);

    if (!channel) {
      throw new Error(`Not subscribed to chat room: ${chatRoomId}`);
    }

    const fullMessage: BroadcastMessage = {
      ...message,
      timestamp: new Date().toISOString(),
    };

    await channel.send({
      type: "broadcast",
      event: "message",
      payload: fullMessage,
    });
  }

  // Send typing indicator
  async sendTypingIndicator(
    chatRoomId: string,
    userId: string,
    userName: string,
    isTyping: boolean
  ): Promise<void> {
    const channelName = `chat-room-${chatRoomId}`;
    const channel = this.channels.get(channelName);

    if (!channel) {
      return;
    }

    const typing: TypingIndicator = {
      userId,
      userName,
      isTyping,
      timestamp: new Date().toISOString(),
    };

    await channel.send({
      type: "broadcast",
      event: "typing",
      payload: typing,
    });
  }

  // Unsubscribe from a chat room
  unsubscribeFromChatRoom(chatRoomId: string): void {
    const channelName = `chat-room-${chatRoomId}`;
    const channel = this.channels.get(channelName);

    if (channel) {
      channel.unsubscribe();
      this.channels.delete(channelName);
      this.messageHandlers.delete(chatRoomId);
      this.typingHandlers.delete(chatRoomId);
      this.presenceHandlers.delete(chatRoomId);
    }
  }

  // Add message handler
  onMessage(
    chatRoomId: string,
    handler: (message: BroadcastMessage) => void
  ): void {
    if (!this.messageHandlers.has(chatRoomId)) {
      this.messageHandlers.set(chatRoomId, new Set());
    }
    this.messageHandlers.get(chatRoomId)!.add(handler);
  }

  // Remove message handler
  offMessage(
    chatRoomId: string,
    handler: (message: BroadcastMessage) => void
  ): void {
    const handlers = this.messageHandlers.get(chatRoomId);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  // Add typing handler
  onTyping(
    chatRoomId: string,
    handler: (typing: TypingIndicator[]) => void
  ): void {
    if (!this.typingHandlers.has(chatRoomId)) {
      this.typingHandlers.set(chatRoomId, new Set());
    }
    this.typingHandlers.get(chatRoomId)!.add(handler);
  }

  // Remove typing handler
  offTyping(
    chatRoomId: string,
    handler: (typing: TypingIndicator[]) => void
  ): void {
    const handlers = this.typingHandlers.get(chatRoomId);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  // Add presence handler
  onPresence(
    chatRoomId: string,
    handler: (presence: UserPresence[]) => void
  ): void {
    if (!this.presenceHandlers.has(chatRoomId)) {
      this.presenceHandlers.set(chatRoomId, new Set());
    }
    this.presenceHandlers.get(chatRoomId)!.add(handler);
  }

  // Remove presence handler
  offPresence(
    chatRoomId: string,
    handler: (presence: UserPresence[]) => void
  ): void {
    const handlers = this.presenceHandlers.get(chatRoomId);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private handleMessage(chatRoomId: string, message: BroadcastMessage): void {
    const handlers = this.messageHandlers.get(chatRoomId);
    if (handlers) {
      handlers.forEach((handler) => handler(message));
    }
  }

  private handleTyping(chatRoomId: string, typing: TypingIndicator): void {
    // For simplicity, we'll just pass the single typing indicator
    // In a real implementation, you'd maintain a list of typing users
    const handlers = this.typingHandlers.get(chatRoomId);
    if (handlers) {
      handlers.forEach((handler) => handler([typing]));
    }
  }

  private handlePresence(chatRoomId: string, presence: UserPresence[]): void {
    const handlers = this.presenceHandlers.get(chatRoomId);
    if (handlers) {
      handlers.forEach((handler) => handler(presence));
    }
  }

  private transformPresenceState(presenceState: any): UserPresence[] {
    const presence: UserPresence[] = [];

    Object.keys(presenceState).forEach((key) => {
      const presences = presenceState[key];
      if (presences && presences.length > 0) {
        const latest = presences[0];
        presence.push({
          userId: latest.userId,
          userName: latest.userName,
          status: latest.status || "online",
          lastSeen: latest.lastSeen || new Date().toISOString(),
        });
      }
    });

    return presence;
  }

  // Cleanup all subscriptions
  cleanup(): void {
    this.channels.forEach((channel) => {
      channel.unsubscribe();
    });
    this.channels.clear();
    this.messageHandlers.clear();
    this.typingHandlers.clear();
    this.presenceHandlers.clear();
  }
}

// Export singleton instance
export const chatBroadcastClientService = new ChatBroadcastClientService();
export default chatBroadcastClientService;
