import { RealtimeChannel, RealtimePresenceState } from "@supabase/supabase-js";
import { io, Socket } from "socket.io-client";
import { createSupabaseBrowserClient } from "./supabase-client";

// Unified event types
export type UnifiedRealtimeEvent =
  | "message"
  | "message_update"
  | "typing_start"
  | "typing_stop"
  | "user_joined"
  | "user_left"
  | "video_call_start"
  | "video_call_end"
  | "video_signal"
  | "notification"
  | "presence_update"
  | "connection_change";

// Unified message interface
export interface UnifiedMessage {
  id: string;
  chatRoomId: string;
  senderId: string;
  content: string | null;
  messageType: "TEXT" | "FILE" | "IMAGE" | "VIDEO" | "AUDIO";
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  isRead: boolean;
  sentAt: string;
  sender?: {
    id: string;
    name: string;
    role: string;
  };
}

// Unified presence interface
export interface UnifiedPresence {
  userId: string;
  userName: string;
  userRole: string;
  isOnline: boolean;
  isTyping: boolean;
  lastSeen: Date;
}

// Connection status
export interface ConnectionStatus {
  isConnected: boolean;
  isReconnecting: boolean;
  lastConnected: Date | null;
  reconnectAttempts: number;
  provider: "supabase" | "socket" | "hybrid";
}

// Event callback types
export type EventCallback<T = any> = (data: T) => void;

// Unified Realtime Service
export class UnifiedRealtimeService {
  private static instance: UnifiedRealtimeService;
  private supabase = createSupabaseBrowserClient();
  private socket: Socket | null = null;
  private channels: Map<string, RealtimeChannel> = new Map();
  private eventListeners: Map<string, Set<EventCallback>> = new Map();
  private connectionStatus: ConnectionStatus = {
    isConnected: false,
    isReconnecting: false,
    lastConnected: null,
    reconnectAttempts: 0,
    provider: "hybrid",
  };

  private constructor() {}

  static getInstance(): UnifiedRealtimeService {
    if (!UnifiedRealtimeService.instance) {
      UnifiedRealtimeService.instance = new UnifiedRealtimeService();
    }
    return UnifiedRealtimeService.instance;
  }

  // Initialize the unified realtime service
  async initialize(user: {
    id: string;
    name: string;
    role: string;
    email: string;
  }) {
    try {
      // Initialize Socket.io for video calls and admin features
      await this.initializeSocket(user);

      // Update connection status
      this.updateConnectionStatus({
        isConnected: true,
        lastConnected: new Date(),
        reconnectAttempts: 0,
      });

      return true;
    } catch (error) {
      console.error("Failed to initialize unified realtime:", error);
      this.updateConnectionStatus({ isConnected: false });
      return false;
    }
  }

  // Initialize Socket.io connection
  private async initializeSocket(user: {
    id: string;
    name: string;
    role: string;
    email: string;
  }) {
    if (this.socket?.connected) return;

    // Get auth token for Socket.io
    const {
      data: { session },
    } = await this.supabase.auth.getSession();

    this.socket = io(
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      {
        path: "/api/socketio",
        addTrailingSlash: false,
        auth: {
          token: session?.access_token || "temp-token",
          userId: user.id,
          userRole: user.role,
          userName: user.name,
        },
      }
    );

    // Socket event handlers
    this.socket.on("connect", () => {
      console.log("Socket.io connected");
      this.updateConnectionStatus({
        isConnected: true,
        lastConnected: new Date(),
      });
    });

    this.socket.on("disconnect", () => {
      console.log("Socket.io disconnected");
      this.updateConnectionStatus({ isConnected: false });
    });

    this.socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      this.updateConnectionStatus({ isConnected: false });
      this.emit("connection_change", this.connectionStatus);
    });

    // Forward Socket.io events to unified event system
    this.socket.on("notification", (data) => this.emit("notification", data));
    this.socket.on("video_call_started", (data) =>
      this.emit("video_call_start", data)
    );
    this.socket.on("video_call_ended", (data) =>
      this.emit("video_call_end", data)
    );
    this.socket.on("video_signal", (data) => this.emit("video_signal", data));
    this.socket.on("user_joined", (data) => this.emit("user_joined", data));
    this.socket.on("user_left", (data) => this.emit("user_left", data));
    this.socket.on("user_typing", (data) => this.emit("typing_start", data));
    this.socket.on("user_stopped_typing", (data) =>
      this.emit("typing_stop", data)
    );
  }

  // Subscribe to chat room (uses Supabase Realtime for messages, Socket.io for signaling)
  async subscribeToChatRoom(
    chatRoomId: string,
    userId: string,
    userName: string,
    callbacks?: {
      onMessage?: (message: UnifiedMessage) => void;
      onMessageUpdate?: (message: UnifiedMessage) => void;
      onPresenceUpdate?: (presence: UnifiedPresence[]) => void;
      onTyping?: (data: {
        userId: string;
        userName: string;
        isTyping: boolean;
      }) => void;
    }
  ) {
    // Use Supabase Realtime for messages and presence
    const channel = this.supabase
      .channel(`chat_room_${chatRoomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `chatRoomId=eq.${chatRoomId}`,
        },
        (payload) => {
          const message = payload.new as UnifiedMessage;
          callbacks?.onMessage?.(message);
          this.emit("message", message);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_messages",
          filter: `chatRoomId=eq.${chatRoomId}`,
        },
        (payload) => {
          const message = payload.new as UnifiedMessage;
          callbacks?.onMessageUpdate?.(message);
          this.emit("message_update", message);
        }
      )
      .on("presence", { event: "sync" }, () => {
        const presenceState = channel.presenceState() as RealtimePresenceState;
        const presence = this.parsePresenceState(presenceState);
        callbacks?.onPresenceUpdate?.(presence);
        this.emit("presence_update", presence);
      });

    // Subscribe to channel
    await channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        // Track presence
        await channel.track({
          user_id: userId,
          user_name: userName,
          typing: false,
          timestamp: Date.now(),
        });
      }
    });

    this.channels.set(chatRoomId, channel);

    // Use Socket.io for typing indicators and real-time signaling
    if (this.socket) {
      this.socket.emit("join_chat_room", chatRoomId);

      // Set up typing callbacks
      if (callbacks?.onTyping) {
        this.on("typing_start", callbacks.onTyping);
        this.on("typing_stop", (data) =>
          callbacks.onTyping?.({ ...data, isTyping: false })
        );
      }
    }

    return {
      unsubscribe: () => this.unsubscribeFromChatRoom(chatRoomId),
    };
  }

  // Unsubscribe from chat room
  async unsubscribeFromChatRoom(chatRoomId: string) {
    // Unsubscribe from Supabase channel
    const channel = this.channels.get(chatRoomId);
    if (channel) {
      await channel.unsubscribe();
      this.channels.delete(chatRoomId);
    }

    // Leave Socket.io room
    if (this.socket) {
      this.socket.emit("leave_chat_room", chatRoomId);
    }
  }

  // Send message (uses Supabase for persistence)
  async sendMessage(
    chatRoomId: string,
    senderId: string,
    content: string,
    messageType: UnifiedMessage["messageType"] = "TEXT",
    fileData?: { url: string; name: string; size: number }
  ): Promise<UnifiedMessage | null> {
    try {
      const { data, error } = await this.supabase
        .from("chat_messages")
        .insert({
          chatRoomId,
          senderId,
          content,
          messageType,
          fileUrl: fileData?.url,
          fileName: fileData?.name,
          fileSize: fileData?.size,
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
      return data as UnifiedMessage;
    } catch (error) {
      console.error("Error sending message:", error);
      return null;
    }
  }

  // Set typing status (uses both Supabase presence and Socket.io)
  async setTyping(
    chatRoomId: string,
    userId: string,
    userName: string,
    isTyping: boolean
  ) {
    // Update Supabase presence
    const channel = this.channels.get(chatRoomId);
    if (channel) {
      await channel.track({
        user_id: userId,
        user_name: userName,
        typing: isTyping,
        timestamp: Date.now(),
      });
    }

    // Send Socket.io event for immediate feedback
    if (this.socket) {
      if (isTyping) {
        this.socket.emit("typing_start", { roomId: chatRoomId });
      } else {
        this.socket.emit("typing_stop", { roomId: chatRoomId });
      }
    }
  }

  // Video call signaling (uses Socket.io)
  startVideoCall(chatRoomId: string, sessionId: string) {
    if (this.socket) {
      this.socket.emit("start_video_call", { roomId: chatRoomId, sessionId });
    }
  }

  endVideoCall(chatRoomId: string, sessionId: string) {
    if (this.socket) {
      this.socket.emit("end_video_call", { roomId: chatRoomId, sessionId });
    }
  }

  sendVideoSignal(signal: any, to: string, chatRoomId: string, from: string) {
    if (this.socket) {
      this.socket.emit("video_signal", {
        signal,
        to,
        roomId: chatRoomId,
        from,
      });
    }
  }

  // Admin monitoring (uses Socket.io)
  subscribeToAdminEvents(callbacks: {
    onChatActivity?: (data: any) => void;
    onVideoCallActivity?: (data: any) => void;
    onPaymentActivity?: (data: any) => void;
    onSystemAlert?: (data: any) => void;
  }) {
    if (this.socket) {
      this.socket.emit("join_admin_monitoring");

      // Set up admin event listeners
      this.socket.on("chat_activity", callbacks.onChatActivity || (() => {}));
      this.socket.on(
        "video_activity",
        callbacks.onVideoCallActivity || (() => {})
      );
      this.socket.on(
        "payment_activity",
        callbacks.onPaymentActivity || (() => {})
      );
      this.socket.on("system_alert", callbacks.onSystemAlert || (() => {}));
    }
  }

  // Unified event system
  on(event: UnifiedRealtimeEvent, callback: EventCallback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: UnifiedRealtimeEvent, callback: EventCallback) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit(event: UnifiedRealtimeEvent, data: any) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }

  // Parse Supabase presence state
  private parsePresenceState(
    presenceState: RealtimePresenceState
  ): UnifiedPresence[] {
    return Object.values(presenceState)
      .flat()
      .map((presence: any) => ({
        userId: presence.user_id,
        userName: presence.user_name,
        userRole: presence.user_role || "PATIENT",
        isOnline: true,
        isTyping: presence.typing || false,
        lastSeen: new Date(presence.timestamp),
      }));
  }

  // Update connection status
  private updateConnectionStatus(updates: Partial<ConnectionStatus>) {
    this.connectionStatus = { ...this.connectionStatus, ...updates };
    this.emit("connection_change", this.connectionStatus);
  }

  // Get connection status
  getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  // Reconnect
  async reconnect() {
    this.updateConnectionStatus({ isReconnecting: true });

    // Reconnect Socket.io
    if (this.socket) {
      this.socket.disconnect();
      this.socket.connect();
    }

    // Reconnect Supabase channels
    for (const [chatRoomId, channel] of this.channels.entries()) {
      await channel.unsubscribe();
      // Re-subscribe logic would go here
    }
  }

  // Cleanup
  async cleanup() {
    // Unsubscribe from all channels
    for (const channel of this.channels.values()) {
      await channel.unsubscribe();
    }
    this.channels.clear();

    // Disconnect Socket.io
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    // Clear event listeners
    this.eventListeners.clear();

    // Reset connection status
    this.connectionStatus = {
      isConnected: false,
      isReconnecting: false,
      lastConnected: null,
      reconnectAttempts: 0,
      provider: "hybrid",
    };
  }
}

// Export singleton instance
export const unifiedRealtime = UnifiedRealtimeService.getInstance();

// React hook for unified realtime
export function useUnifiedRealtime() {
  return unifiedRealtime;
}
