import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import { RealtimeChannel, RealtimePresenceState } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

export interface PresenceUser {
  userId: string;
  userName: string;
  userRole: string;
  isOnline: boolean;
  lastSeen: Date;
  isTyping: boolean;
}

export interface ChatRoomPresence {
  onlineUsers: PresenceUser[];
  totalOnline: number;
  isUserOnline: (userId: string) => boolean;
  getUserPresence: (userId: string) => PresenceUser | null;
}

interface UseChatPresenceProps {
  chatRoomId: string;
  userId: string;
  userName: string;
  userRole: string;
  onPresenceUpdate?: (presence: ChatRoomPresence) => void;
}

export const useChatPresence = ({
  chatRoomId,
  userId,
  userName,
  userRole,
  onPresenceUpdate,
}: UseChatPresenceProps) => {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const supabase = createSupabaseBrowserClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Convert presence state to PresenceUser array
  const parsePresenceState = useCallback(
    (presenceState: RealtimePresenceState): PresenceUser[] => {
      const users: PresenceUser[] = [];

      Object.entries(presenceState).forEach(([key, presences]) => {
        // Get the most recent presence for each user
        const latestPresence = presences.reduce((latest, current) => {
          return current.timestamp > latest.timestamp ? current : latest;
        });

        users.push({
          userId: latestPresence.user_id,
          userName: latestPresence.user_name,
          userRole: latestPresence.user_role,
          isOnline: true,
          lastSeen: new Date(latestPresence.timestamp),
          isTyping: latestPresence.typing || false,
        });
      });

      return users;
    },
    []
  );

  // Update presence state
  const updatePresence = useCallback(
    (presenceState: RealtimePresenceState) => {
      const users = parsePresenceState(presenceState);
      setOnlineUsers(users);

      const presence: ChatRoomPresence = {
        onlineUsers: users,
        totalOnline: users.length,
        isUserOnline: (targetUserId: string) =>
          users.some((u) => u.userId === targetUserId),
        getUserPresence: (targetUserId: string) =>
          users.find((u) => u.userId === targetUserId) || null,
      };

      onPresenceUpdate?.(presence);
    },
    [parsePresenceState, onPresenceUpdate]
  );

  // Subscribe to presence
  const subscribeToPresence = useCallback(() => {
    if (!chatRoomId || channelRef.current) return;

    const channel = supabase
      .channel(`presence_${chatRoomId}`)
      .on("presence", { event: "sync" }, () => {
        const presenceState = channel.presenceState();
        updatePresence(presenceState);
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        console.log("User joined:", newPresences);
        const presenceState = channel.presenceState();
        updatePresence(presenceState);
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        console.log("User left:", leftPresences);
        const presenceState = channel.presenceState();
        updatePresence(presenceState);
      });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        setIsConnected(true);

        // Track user presence
        await channel.track({
          user_id: userId,
          user_name: userName,
          user_role: userRole,
          timestamp: Date.now(),
          typing: false,
        });

        // Start heartbeat to maintain presence
        startHeartbeat(channel);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setIsConnected(false);
        stopHeartbeat();
      }
    });

    channelRef.current = channel;
  }, [chatRoomId, userId, userName, userRole, updatePresence]);

  // Start heartbeat to maintain presence
  const startHeartbeat = useCallback(
    (channel: RealtimeChannel) => {
      stopHeartbeat(); // Clear any existing heartbeat

      heartbeatIntervalRef.current = setInterval(async () => {
        try {
          await channel.track({
            user_id: userId,
            user_name: userName,
            user_role: userRole,
            timestamp: Date.now(),
            typing: false,
          });
        } catch (error) {
          console.error("Heartbeat failed:", error);
        }
      }, 30000); // Send heartbeat every 30 seconds
    },
    [userId, userName, userRole]
  );

  // Stop heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Update typing status
  const updateTypingStatus = useCallback(
    async (isTyping: boolean) => {
      if (!channelRef.current || !isConnected) return;

      try {
        await channelRef.current.track({
          user_id: userId,
          user_name: userName,
          user_role: userRole,
          timestamp: Date.now(),
          typing: isTyping,
        });
      } catch (error) {
        console.error("Error updating typing status:", error);
      }
    },
    [userId, userName, userRole, isConnected]
  );

  // Get current online users count
  const getOnlineCount = useCallback(() => {
    return onlineUsers.length;
  }, [onlineUsers]);

  // Check if specific user is online
  const isUserOnline = useCallback(
    (targetUserId: string) => {
      return onlineUsers.some((user) => user.userId === targetUserId);
    },
    [onlineUsers]
  );

  // Get specific user presence
  const getUserPresence = useCallback(
    (targetUserId: string) => {
      return onlineUsers.find((user) => user.userId === targetUserId) || null;
    },
    [onlineUsers]
  );

  // Get typing users (excluding current user)
  const getTypingUsers = useCallback(() => {
    return onlineUsers.filter(
      (user) => user.isTyping && user.userId !== userId
    );
  }, [onlineUsers, userId]);

  // Initialize presence subscription
  useEffect(() => {
    subscribeToPresence();

    return () => {
      // Cleanup
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      stopHeartbeat();
    };
  }, [subscribeToPresence, stopHeartbeat]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopHeartbeat();
    };
  }, [stopHeartbeat]);

  return {
    onlineUsers,
    isConnected,
    totalOnline: onlineUsers.length,
    updateTypingStatus,
    getOnlineCount,
    isUserOnline,
    getUserPresence,
    getTypingUsers,
  };
};
