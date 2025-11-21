import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

export interface ConnectionState {
  status:
    | "disconnected"
    | "connecting"
    | "connected"
    | "reconnecting"
    | "error";
  isOnline: boolean;
  lastConnected: Date | null;
  lastDisconnected: Date | null;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  nextReconnectIn: number | null;
  error: string | null;
}

export interface ConnectionMetrics {
  totalConnections: number;
  totalDisconnections: number;
  totalReconnectAttempts: number;
  averageConnectionTime: number;
  longestConnectionTime: number;
  connectionUptime: number;
}

interface UseChatConnectionProps {
  chatRoomId: string;
  userId: string;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  onConnectionChange?: (state: ConnectionState) => void;
  onError?: (error: string) => void;
}

export const useChatConnection = ({
  chatRoomId,
  userId,
  autoReconnect = true,
  maxReconnectAttempts = 5,
  reconnectInterval = 1000,
  heartbeatInterval = 30000,
  onConnectionChange,
  onError,
}: UseChatConnectionProps) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: "disconnected",
    isOnline: false,
    lastConnected: null,
    lastDisconnected: null,
    reconnectAttempts: 0,
    maxReconnectAttempts,
    nextReconnectIn: null,
    error: null,
  });

  const [metrics, setMetrics] = useState<ConnectionMetrics>({
    totalConnections: 0,
    totalDisconnections: 0,
    totalReconnectAttempts: 0,
    averageConnectionTime: 0,
    longestConnectionTime: 0,
    connectionUptime: 0,
  });

  const supabase = createSupabaseBrowserClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectionStartTimeRef = useRef<Date | null>(null);
  const connectionTimesRef = useRef<number[]>([]);

  // Update connection state and notify parent
  const updateConnectionState = useCallback(
    (updates: Partial<ConnectionState>) => {
      setConnectionState((prev) => {
        const newState = { ...prev, ...updates };
        onConnectionChange?.(newState);
        return newState;
      });
    },
    [onConnectionChange]
  );

  // Calculate exponential backoff delay
  const getReconnectDelay = useCallback(
    (attempt: number) => {
      const delay = Math.min(reconnectInterval * Math.pow(2, attempt), 30000);
      const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
      return delay + jitter;
    },
    [reconnectInterval]
  );

  // Update metrics
  const updateMetrics = useCallback((updates: Partial<ConnectionMetrics>) => {
    setMetrics((prev) => ({ ...prev, ...updates }));
  }, []);

  // Start countdown timer for next reconnect
  const startReconnectCountdown = useCallback(
    (delay: number) => {
      let remaining = Math.ceil(delay / 1000);
      updateConnectionState({ nextReconnectIn: remaining });

      countdownIntervalRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          updateConnectionState({ nextReconnectIn: null });
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
        } else {
          updateConnectionState({ nextReconnectIn: remaining });
        }
      }, 1000);
    },
    [updateConnectionState]
  );

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // Start heartbeat to detect connection issues
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(async () => {
      if (!channelRef.current) return;

      try {
        // Send a heartbeat by updating presence
        await channelRef.current.track({
          user_id: userId,
          heartbeat: Date.now(),
        });
      } catch (error) {
        console.error("Heartbeat failed:", error);
        handleConnectionError("Heartbeat failed");
      }
    }, heartbeatInterval);
  }, [userId, heartbeatInterval]);

  // Handle connection errors
  const handleConnectionError = useCallback(
    (error: string) => {
      console.error("Connection error:", error);

      updateConnectionState({
        status: "error",
        isOnline: false,
        error,
        lastDisconnected: new Date(),
      });

      // Record connection time if we were connected
      if (connectionStartTimeRef.current) {
        const connectionTime =
          Date.now() - connectionStartTimeRef.current.getTime();
        connectionTimesRef.current.push(connectionTime);

        // Update metrics
        const avgTime =
          connectionTimesRef.current.reduce((a, b) => a + b, 0) /
          connectionTimesRef.current.length;
        const longestTime = Math.max(...connectionTimesRef.current);

        updateMetrics({
          totalDisconnections: metrics.totalDisconnections + 1,
          averageConnectionTime: avgTime,
          longestConnectionTime: longestTime,
        });

        connectionStartTimeRef.current = null;
      }

      onError?.(error);

      if (
        autoReconnect &&
        connectionState.reconnectAttempts < maxReconnectAttempts
      ) {
        attemptReconnect();
      }
    },
    [
      updateConnectionState,
      metrics,
      onError,
      autoReconnect,
      connectionState.reconnectAttempts,
      maxReconnectAttempts,
    ]
  );

  // Attempt to reconnect with exponential backoff
  const attemptReconnect = useCallback(() => {
    if (connectionState.reconnectAttempts >= maxReconnectAttempts) {
      updateConnectionState({
        status: "error",
        error: "Max reconnect attempts reached",
      });
      return;
    }

    const attempt = connectionState.reconnectAttempts + 1;
    const delay = getReconnectDelay(attempt);

    updateConnectionState({
      status: "reconnecting",
      reconnectAttempts: attempt,
      error: null,
    });

    updateMetrics({
      totalReconnectAttempts: metrics.totalReconnectAttempts + 1,
    });

    startReconnectCountdown(delay);

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [
    connectionState.reconnectAttempts,
    maxReconnectAttempts,
    getReconnectDelay,
    updateConnectionState,
    updateMetrics,
    metrics.totalReconnectAttempts,
  ]);

  // Connect to chat room
  const connect = useCallback(async () => {
    try {
      // Cleanup existing connection
      if (channelRef.current) {
        await channelRef.current.unsubscribe();
        channelRef.current = null;
      }

      clearTimers();

      updateConnectionState({
        status: "connecting",
        error: null,
        nextReconnectIn: null,
      });

      const channel = supabase.channel(`chat_connection_${chatRoomId}`);

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          connectionStartTimeRef.current = new Date();

          updateConnectionState({
            status: "connected",
            isOnline: true,
            lastConnected: new Date(),
            reconnectAttempts: 0,
            error: null,
          });

          updateMetrics({
            totalConnections: metrics.totalConnections + 1,
          });

          startHeartbeat();
        } else if (status === "CHANNEL_ERROR") {
          handleConnectionError("Channel subscription error");
        } else if (status === "TIMED_OUT") {
          handleConnectionError("Connection timed out");
        } else if (status === "CLOSED") {
          updateConnectionState({
            status: "disconnected",
            isOnline: false,
            lastDisconnected: new Date(),
          });
        }
      });

      channelRef.current = channel;
    } catch (error) {
      handleConnectionError(`Connection failed: ${error}`);
    }
  }, [
    chatRoomId,
    supabase,
    updateConnectionState,
    updateMetrics,
    metrics.totalConnections,
    clearTimers,
    startHeartbeat,
    handleConnectionError,
  ]);

  // Disconnect from chat room
  const disconnect = useCallback(async () => {
    clearTimers();

    if (channelRef.current) {
      await channelRef.current.unsubscribe();
      channelRef.current = null;
    }

    // Record connection time if we were connected
    if (connectionStartTimeRef.current) {
      const connectionTime =
        Date.now() - connectionStartTimeRef.current.getTime();
      connectionTimesRef.current.push(connectionTime);
      connectionStartTimeRef.current = null;
    }

    updateConnectionState({
      status: "disconnected",
      isOnline: false,
      lastDisconnected: new Date(),
      reconnectAttempts: 0,
      error: null,
      nextReconnectIn: null,
    });
  }, [clearTimers, updateConnectionState]);

  // Manual reconnect (resets attempt counter)
  const reconnect = useCallback(() => {
    updateConnectionState({ reconnectAttempts: 0 });
    connect();
  }, [updateConnectionState, connect]);

  // Get connection health score (0-100)
  const getHealthScore = useCallback(() => {
    const { totalConnections, totalDisconnections, totalReconnectAttempts } =
      metrics;

    if (totalConnections === 0) return 0;

    const disconnectionRate = totalDisconnections / totalConnections;
    const reconnectRate = totalReconnectAttempts / totalConnections;
    const currentConnectionBonus = connectionState.isOnline ? 20 : 0;

    const score = Math.max(
      0,
      100 - disconnectionRate * 30 - reconnectRate * 20 + currentConnectionBonus
    );
    return Math.round(score);
  }, [metrics, connectionState.isOnline]);

  // Initialize connection
  useEffect(() => {
    if (chatRoomId && userId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [chatRoomId, userId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  return {
    connectionState,
    metrics,
    connect,
    disconnect,
    reconnect,
    getHealthScore,
    isConnected: connectionState.status === "connected",
    isConnecting: connectionState.status === "connecting",
    isReconnecting: connectionState.status === "reconnecting",
    hasError: connectionState.status === "error",
  };
};
