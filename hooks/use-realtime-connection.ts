import { createClient } from "@/lib/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

interface UseRealtimeConnectionOptions {
  channelName: string;
  maxRetries?: number;
  retryDelay?: number;
  onConnectionChange?: (status: ConnectionStatus) => void;
}

export function useRealtimeConnection({
  channelName,
  maxRetries = 5,
  retryDelay = 1000,
  onConnectionChange,
}: UseRealtimeConnectionOptions) {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [retryCount, setRetryCount] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = createClient();

  const updateConnectionStatus = useCallback(
    (status: ConnectionStatus) => {
      setConnectionStatus(status);
      onConnectionChange?.(status);
    },
    [onConnectionChange]
  );

  const cleanup = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    cleanup();

    updateConnectionStatus("connecting");

    try {
      const channel = supabase.channel(channelName);
      channelRef.current = channel;

      channel.subscribe((status) => {
        switch (status) {
          case "SUBSCRIBED":
            updateConnectionStatus("connected");
            setRetryCount(0);
            break;
          case "CHANNEL_ERROR":
            updateConnectionStatus("error");
            if (retryCount < maxRetries) {
              const delay = Math.min(
                retryDelay * Math.pow(2, retryCount),
                30000
              );
              retryTimeoutRef.current = setTimeout(() => {
                setRetryCount((prev) => prev + 1);
                connect();
              }, delay);
            } else {
              updateConnectionStatus("disconnected");
            }
            break;
          case "TIMED_OUT":
            updateConnectionStatus("error");
            break;
          case "CLOSED":
            updateConnectionStatus("disconnected");
            break;
        }
      });

      return channel;
    } catch (error) {
      console.error("Error setting up realtime connection:", error);
      updateConnectionStatus("error");
      return null;
    }
  }, [
    channelName,
    maxRetries,
    retryDelay,
    retryCount,
    supabase,
    updateConnectionStatus,
    cleanup,
  ]);

  const reconnect = useCallback(() => {
    setRetryCount(0);
    connect();
  }, [connect]);

  useEffect(() => {
    const channel = connect();

    return () => {
      cleanup();
    };
  }, [connect, cleanup]);

  return {
    channel: channelRef.current,
    connectionStatus,
    retryCount,
    reconnect,
    isConnected: connectionStatus === "connected",
    isConnecting: connectionStatus === "connecting",
    hasError: connectionStatus === "error",
  };
}
