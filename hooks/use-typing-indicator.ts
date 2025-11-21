import type { TypingIndicator } from "@/lib/chat-broadcast-client";
import { useCallback, useEffect, useRef, useState } from "react";

export interface TypingState {
  isTyping: boolean;
  typingUsers: TypingIndicator[];
  startTyping: () => void;
  stopTyping: () => void;
  getTypingText: () => string;
}

interface UseTypingIndicatorProps {
  chatRoomId: string;
  userId: string;
  userName: string;
  typingTimeout?: number;
  maxTypingUsers?: number;
  onTypingChange?: (typingUsers: TypingIndicator[]) => void;
}

export const useTypingIndicator = ({
  chatRoomId,
  userId,
  userName,
  typingTimeout = 3000,
  maxTypingUsers = 3,
  onTypingChange,
}: UseTypingIndicatorProps): TypingState => {
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([]);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingBroadcastRef = useRef<number>(0);
  const broadcastThrottleMs = 1000; // Throttle broadcasts to once per second

  // Clean up expired typing indicators
  const cleanupExpiredTyping = useCallback(() => {
    const now = Date.now();
    const expiredThreshold = typingTimeout + 1000; // Add 1 second buffer

    setTypingUsers((prev) => {
      const active = prev.filter(
        (user) =>
          now - user.timestamp < expiredThreshold && user.userId !== userId
      );

      if (active.length !== prev.length) {
        onTypingChange?.(active);
      }

      return active;
    });
  }, [typingTimeout, userId, onTypingChange]);

  // Start periodic cleanup of expired typing indicators
  useEffect(() => {
    cleanupTimeoutRef.current = setInterval(cleanupExpiredTyping, 1000);

    return () => {
      if (cleanupTimeoutRef.current) {
        clearInterval(cleanupTimeoutRef.current);
      }
    };
  }, [cleanupExpiredTyping]);

  // Handle incoming typing indicators
  const handleTypingUpdate = useCallback(
    (typing: TypingIndicator) => {
      // Ignore our own typing indicators
      if (typing.userId === userId) return;

      setTypingUsers((prev) => {
        let updated = [...prev];
        const existingIndex = updated.findIndex(
          (user) => user.userId === typing.userId
        );

        if (typing.isTyping) {
          if (existingIndex >= 0) {
            // Update existing typing indicator
            updated[existingIndex] = typing;
          } else {
            // Add new typing indicator
            updated.push(typing);
          }
        } else {
          // Remove typing indicator
          if (existingIndex >= 0) {
            updated.splice(existingIndex, 1);
          }
        }

        // Limit the number of typing users displayed
        if (updated.length > maxTypingUsers) {
          updated = updated.slice(-maxTypingUsers);
        }

        onTypingChange?.(updated);
        return updated;
      });
    },
    [userId, maxTypingUsers, onTypingChange]
  );

  // Subscribe to typing indicators
  useEffect(() => {
    if (!chatRoomId) return;

    const subscribeToTyping = async () => {
      try {
        chatBroadcastClientService.onTyping(chatRoomId, handleTypingUpdate);
        chatBroadcastClientService.subscribeToChatRoom(
          chatRoomId,
          userId,
          userName || "Unknown"
        );
      } catch (error) {
        console.error("Failed to subscribe to typing indicators:", error);
      }
    };

    subscribeToTyping();

    return () => {
      chatBroadcastClientService.unsubscribeFromChatRoom(chatRoomId);
    };
  }, [chatRoomId, handleTypingUpdate]);

  // Start typing
  const startTyping = useCallback(async () => {
    if (!chatRoomId || isTyping) return;

    const now = Date.now();

    // Throttle broadcasts to prevent spam
    if (now - lastTypingBroadcastRef.current < broadcastThrottleMs) {
      return;
    }

    try {
      setIsTyping(true);
      lastTypingBroadcastRef.current = now;

      await chatBroadcastClientService.sendTypingIndicator(
        chatRoomId,
        userId,
        userName,
        true
      );

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Auto-stop typing after timeout
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, typingTimeout);
    } catch (error) {
      console.error("Failed to broadcast typing start:", error);
      setIsTyping(false);
    }
  }, [chatRoomId, userId, userName, isTyping, typingTimeout]);

  // Stop typing
  const stopTyping = useCallback(async () => {
    if (!chatRoomId || !isTyping) return;

    try {
      setIsTyping(false);

      await chatBroadcastClientService.sendTypingIndicator(
        chatRoomId,
        userId,
        userName,
        false
      );

      // Clear timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    } catch (error) {
      console.error("Failed to broadcast typing stop:", error);
    }
  }, [chatRoomId, userId, userName, isTyping]);

  // Generate typing text
  const getTypingText = useCallback((): string => {
    const activeTyping = typingUsers.filter((user) => user.isTyping);

    if (activeTyping.length === 0) {
      return "";
    }

    if (activeTyping.length === 1) {
      return `${activeTyping[0].userName} está escribiendo...`;
    }

    if (activeTyping.length === 2) {
      return `${activeTyping[0].userName} y ${activeTyping[1].userName} están escribiendo...`;
    }

    if (activeTyping.length === 3) {
      return `${activeTyping[0].userName}, ${activeTyping[1].userName} y ${activeTyping[2].userName} están escribiendo...`;
    }

    // More than 3 users
    return `${activeTyping[0].userName}, ${activeTyping[1].userName} y ${
      activeTyping.length - 2
    } más están escribiendo...`;
  }, [typingUsers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (cleanupTimeoutRef.current) {
        clearInterval(cleanupTimeoutRef.current);
      }

      // Stop typing when component unmounts
      if (isTyping) {
        chatBroadcastClientService.sendTypingIndicator(
          chatRoomId,
          userId,
          userName,
          false
        );
      }
    };
  }, [chatRoomId, userId, userName, isTyping]);

  return {
    isTyping,
    typingUsers: typingUsers.filter((user) => user.isTyping),
    startTyping,
    stopTyping,
    getTypingText,
  };
};

// Hook for input field integration
export const useTypingInput = (
  chatRoomId: string,
  userId: string,
  userName: string,
  options?: {
    typingTimeout?: number;
    debounceMs?: number;
  }
) => {
  const { startTyping, stopTyping } = useTypingIndicator({
    chatRoomId,
    userId,
    userName,
    typingTimeout: options?.typingTimeout,
  });

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // Handle input change with debouncing
  const handleInputChange = useCallback(
    (value: string) => {
      // Clear existing debounce timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Start typing if not already typing and there's content
      if (value.trim() && !isTypingRef.current) {
        startTyping();
        isTypingRef.current = true;
      }

      // Set debounce timeout to stop typing
      debounceTimeoutRef.current = setTimeout(() => {
        if (isTypingRef.current) {
          stopTyping();
          isTypingRef.current = false;
        }
      }, options?.debounceMs || 1000);
    },
    [startTyping, stopTyping, options?.debounceMs]
  );

  // Handle input blur (stop typing immediately)
  const handleInputBlur = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (isTypingRef.current) {
      stopTyping();
      isTypingRef.current = false;
    }
  }, [stopTyping]);

  // Handle form submit (stop typing immediately)
  const handleSubmit = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (isTypingRef.current) {
      stopTyping();
      isTypingRef.current = false;
    }
  }, [stopTyping]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    handleInputChange,
    handleInputBlur,
    handleSubmit,
  };
};
