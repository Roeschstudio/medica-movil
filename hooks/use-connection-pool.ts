"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

interface ConnectionPoolOptions {
  maxConnections?: number;
  connectionTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  heartbeatInterval?: number;
  batchSubscriptions?: boolean;
  connectionReuse?: boolean;
}

interface PooledConnection {
  id: string;
  channel: RealtimeChannel;
  isActive: boolean;
  lastUsed: number;
  subscribers: Set<string>;
}

interface ConnectionPoolResult {
  subscribe: (
    channelName: string,
    subscriberId: string,
    callbacks: {
      onMessage?: (payload: any) => void;
      onPresence?: (payload: any) => void;
      onError?: (error: any) => void;
    }
  ) => Promise<void>;
  unsubscribe: (channelName: string, subscriberId: string) => void;
  getConnectionStatus: (
    channelName: string
  ) => "connected" | "connecting" | "disconnected";
  getActiveConnections: () => number;
  cleanup: () => void;
}

export function useConnectionPool(
  options: ConnectionPoolOptions = {}
): ConnectionPoolResult {
  const {
    maxConnections = 10,
    connectionTimeout = 30000,
    retryAttempts = 3,
    retryDelay = 1000,
    heartbeatInterval = 30000,
    batchSubscriptions = true,
    connectionReuse = true,
  } = options;

  const [connections, setConnections] = useState<Map<string, PooledConnection>>(
    new Map()
  );
  const supabase = createSupabaseBrowserClient();
  const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callbacksRef = useRef<Map<string, Map<string, any>>>(new Map());
  const pendingSubscriptions = useRef<Map<string, Promise<void>>>(new Map());
  const connectionMetrics = useRef<
    Map<
      string,
      {
        messageCount: number;
        errorCount: number;
        lastActivity: number;
        latency: number;
      }
    >
  >(new Map());

  // Initialize cleanup interval
  useEffect(() => {
    cleanupIntervalRef.current = setInterval(() => {
      const now = Date.now();
      setConnections((prev) => {
        const updated = new Map(prev);

        for (const [channelName, connection] of updated) {
          // Remove inactive connections that haven't been used recently
          if (
            connection.subscribers.size === 0 &&
            now - connection.lastUsed > connectionTimeout
          ) {
            connection.channel.unsubscribe();
            updated.delete(channelName);
          }
        }

        return updated;
      });
    }, 10000); // Cleanup every 10 seconds

    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
    };
  }, [connectionTimeout]);

  // Subscribe to a channel
  const subscribe = useCallback(
    async (
      channelName: string,
      subscriberId: string,
      callbacks: {
        onMessage?: (payload: any) => void;
        onPresence?: (payload: any) => void;
        onError?: (error: any) => void;
      }
    ) => {
      // Store callbacks
      if (!callbacksRef.current.has(channelName)) {
        callbacksRef.current.set(channelName, new Map());
      }
      callbacksRef.current.get(channelName)!.set(subscriberId, callbacks);

      setConnections((prev) => {
        const updated = new Map(prev);
        let connection = updated.get(channelName);

        if (!connection) {
          // Create new connection
          const channel = supabase.channel(channelName);

          connection = {
            id: channelName,
            channel,
            isActive: false,
            lastUsed: Date.now(),
            subscribers: new Set([subscriberId]),
          };

          // Set up channel event handlers
          channel
            .on(
              "postgres_changes",
              { event: "*", schema: "public" },
              (payload) => {
                const channelCallbacks = callbacksRef.current.get(channelName);
                if (channelCallbacks) {
                  channelCallbacks.forEach((cb) => {
                    cb.onMessage?.(payload);
                  });
                }
              }
            )
            .on("presence", { event: "sync" }, (payload) => {
              const channelCallbacks = callbacksRef.current.get(channelName);
              if (channelCallbacks) {
                channelCallbacks.forEach((cb) => {
                  cb.onPresence?.(payload);
                });
              }
            })
            .on("presence", { event: "join" }, (payload) => {
              const channelCallbacks = callbacksRef.current.get(channelName);
              if (channelCallbacks) {
                channelCallbacks.forEach((cb) => {
                  cb.onPresence?.(payload);
                });
              }
            })
            .on("presence", { event: "leave" }, (payload) => {
              const channelCallbacks = callbacksRef.current.get(channelName);
              if (channelCallbacks) {
                channelCallbacks.forEach((cb) => {
                  cb.onPresence?.(payload);
                });
              }
            });

          // Subscribe with retry logic
          let attempts = 0;
          const attemptSubscribe = async (): Promise<void> => {
            try {
              await new Promise<void>((resolve, reject) => {
                channel.subscribe((status) => {
                  if (status === "SUBSCRIBED") {
                    connection!.isActive = true;
                    resolve();
                  } else if (
                    status === "CHANNEL_ERROR" ||
                    status === "TIMED_OUT"
                  ) {
                    reject(new Error(`Subscription failed: ${status}`));
                  }
                });
              });
            } catch (error) {
              attempts++;
              if (attempts < retryAttempts) {
                await new Promise((resolve) =>
                  setTimeout(resolve, retryDelay * attempts)
                );
                return attemptSubscribe();
              } else {
                const channelCallbacks = callbacksRef.current.get(channelName);
                if (channelCallbacks) {
                  channelCallbacks.forEach((cb) => {
                    cb.onError?.(error);
                  });
                }
                throw error;
              }
            }
          };

          attemptSubscribe().catch(console.error);
          updated.set(channelName, connection);
        } else {
          // Add subscriber to existing connection
          connection.subscribers.add(subscriberId);
          connection.lastUsed = Date.now();
        }

        return updated;
      });
    },
    [supabase, retryAttempts, retryDelay]
  );

  // Unsubscribe from a channel
  const unsubscribe = useCallback(
    (channelName: string, subscriberId: string) => {
      // Remove callbacks
      const channelCallbacks = callbacksRef.current.get(channelName);
      if (channelCallbacks) {
        channelCallbacks.delete(subscriberId);
        if (channelCallbacks.size === 0) {
          callbacksRef.current.delete(channelName);
        }
      }

      setConnections((prev) => {
        const updated = new Map(prev);
        const connection = updated.get(channelName);

        if (connection) {
          connection.subscribers.delete(subscriberId);
          connection.lastUsed = Date.now();

          // If no more subscribers, mark for cleanup but don't immediately remove
          // This allows for quick re-subscription without reconnection overhead
          if (connection.subscribers.size === 0) {
            // The cleanup interval will handle removing unused connections
          }
        }

        return updated;
      });
    },
    []
  );

  // Get connection status
  const getConnectionStatus = useCallback(
    (channelName: string) => {
      const connection = connections.get(channelName);
      if (!connection) return "disconnected";
      return connection.isActive ? "connected" : "connecting";
    },
    [connections]
  );

  // Get active connections count
  const getActiveConnections = useCallback(() => {
    return Array.from(connections.values()).filter((conn) => conn.isActive)
      .length;
  }, [connections]);

  // Cleanup all connections
  const cleanup = useCallback(() => {
    connections.forEach((connection) => {
      connection.channel.unsubscribe();
    });
    setConnections(new Map());
    callbacksRef.current.clear();

    if (cleanupIntervalRef.current) {
      clearInterval(cleanupIntervalRef.current);
    }
  }, [connections]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    subscribe,
    unsubscribe,
    getConnectionStatus,
    getActiveConnections,
    cleanup,
  };
}
