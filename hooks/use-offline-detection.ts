import { toast } from "@/hooks/use-toast";
import { useCallback, useEffect, useState } from "react";

interface OfflineState {
  isOnline: boolean;
  wasOffline: boolean;
  offlineSince: Date | null;
  onlineSince: Date | null;
}

interface UseOfflineDetectionOptions {
  showToasts?: boolean;
  onOnline?: () => void;
  onOffline?: () => void;
  pingUrl?: string;
  pingInterval?: number;
}

export const useOfflineDetection = (
  options: UseOfflineDetectionOptions = {}
) => {
  const {
    showToasts = true,
    onOnline,
    onOffline,
    pingUrl = "/api/health",
    pingInterval = 30000, // 30 seconds
  } = options;

  const [state, setState] = useState<OfflineState>({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    wasOffline: false,
    offlineSince: null,
    onlineSince: new Date(),
  });

  const updateOnlineStatus = useCallback(
    (isOnline: boolean) => {
      setState((prev) => {
        const now = new Date();

        // If status changed
        if (prev.isOnline !== isOnline) {
          if (isOnline) {
            // Coming back online
            if (showToasts && prev.wasOffline) {
              toast({
                title: "Conexión restaurada",
                description: "Ya estás conectado nuevamente.",
                variant: "default",
              });
            }
            onOnline?.();

            return {
              isOnline: true,
              wasOffline: prev.wasOffline || !prev.isOnline,
              offlineSince: null,
              onlineSince: now,
            };
          } else {
            // Going offline
            if (showToasts) {
              toast({
                title: "Sin conexión",
                description:
                  "Verifica tu conexión a internet. Reintentando automáticamente...",
                variant: "destructive",
              });
            }
            onOffline?.();

            return {
              isOnline: false,
              wasOffline: true,
              offlineSince: now,
              onlineSince: prev.onlineSince,
            };
          }
        }

        return prev;
      });
    },
    [showToasts, onOnline, onOffline]
  );

  // Check connectivity by pinging server
  const checkConnectivity = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(pingUrl, {
        method: "HEAD",
        cache: "no-cache",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }, [pingUrl]);

  // Enhanced online check that combines navigator.onLine with server ping
  const performConnectivityCheck = useCallback(async () => {
    const navigatorOnline = navigator.onLine;

    if (!navigatorOnline) {
      updateOnlineStatus(false);
      return;
    }

    // If navigator says we're online, double-check with server ping
    const serverReachable = await checkConnectivity();
    updateOnlineStatus(serverReachable);
  }, [updateOnlineStatus, checkConnectivity]);

  // Set up event listeners
  useEffect(() => {
    const handleOnline = () => {
      // When browser detects online, do a server check
      performConnectivityCheck();
    };

    const handleOffline = () => {
      updateOnlineStatus(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    performConnectivityCheck();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [performConnectivityCheck, updateOnlineStatus]);

  // Periodic connectivity check
  useEffect(() => {
    if (pingInterval <= 0) return;

    const interval = setInterval(() => {
      performConnectivityCheck();
    }, pingInterval);

    return () => clearInterval(interval);
  }, [performConnectivityCheck, pingInterval]);

  // Manual connectivity check
  const checkConnection = useCallback(async (): Promise<boolean> => {
    await performConnectivityCheck();
    return state.isOnline;
  }, [performConnectivityCheck, state.isOnline]);

  // Get offline duration
  const getOfflineDuration = useCallback((): number => {
    if (!state.offlineSince) return 0;
    return Date.now() - state.offlineSince.getTime();
  }, [state.offlineSince]);

  // Get online duration
  const getOnlineDuration = useCallback((): number => {
    if (!state.onlineSince) return 0;
    return Date.now() - state.onlineSince.getTime();
  }, [state.onlineSince]);

  return {
    isOnline: state.isOnline,
    isOffline: !state.isOnline,
    wasOffline: state.wasOffline,
    offlineSince: state.offlineSince,
    onlineSince: state.onlineSince,
    checkConnection,
    getOfflineDuration,
    getOnlineDuration,
  };
};

// Hook for offline-aware operations
export const useOfflineAwareOperation = <T extends any[], R>(
  operation: (...args: T) => Promise<R>,
  options: {
    fallback?: (...args: T) => R | Promise<R>;
    queueWhenOffline?: boolean;
    showOfflineMessage?: boolean;
  } = {}
) => {
  const { isOnline } = useOfflineDetection();
  const [queuedOperations, setQueuedOperations] = useState<
    Array<{
      args: T;
      resolve: (value: R) => void;
      reject: (error: any) => void;
    }>
  >([]);

  const {
    fallback,
    queueWhenOffline = false,
    showOfflineMessage = true,
  } = options;

  // Execute queued operations when coming back online
  useEffect(() => {
    if (isOnline && queuedOperations.length > 0) {
      const operations = [...queuedOperations];
      setQueuedOperations([]);

      operations.forEach(async ({ args, resolve, reject }) => {
        try {
          const result = await operation(...args);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    }
  }, [isOnline, queuedOperations, operation]);

  const executeOperation = useCallback(
    async (...args: T): Promise<R> => {
      if (!isOnline) {
        if (showOfflineMessage) {
          toast({
            title: "Sin conexión",
            description: "Esta acción requiere conexión a internet.",
            variant: "destructive",
          });
        }

        if (queueWhenOffline) {
          return new Promise<R>((resolve, reject) => {
            setQueuedOperations((prev) => [...prev, { args, resolve, reject }]);
          });
        }

        if (fallback) {
          return await fallback(...args);
        }

        throw new Error("Operation requires internet connection");
      }

      return await operation(...args);
    },
    [isOnline, operation, fallback, queueWhenOffline, showOfflineMessage]
  );

  return {
    executeOperation,
    isOnline,
    queuedOperationsCount: queuedOperations.length,
  };
};
