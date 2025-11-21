"use client";

import { toast } from "@/hooks/use-toast";
import { chatMessageQueue, QueuedMessage } from "@/lib/chat-message-queue";
import {
  AppError,
  ChatError,
  classifyError,
  ConnectionError,
  DEFAULT_RETRY_OPTIONS,
  NetworkError,
  withRetry,
} from "@/lib/error-handling";
import { useCallback, useEffect, useRef, useState } from "react";
import { useOfflineDetection } from "./use-offline-detection";

export interface ChatErrorRecoveryOptions {
  chatRoomId: string;
  userId: string;
  maxRetryAttempts?: number;
  retryDelay?: number;
  enableOfflineQueue?: boolean;
  enableAutoRecovery?: boolean;
  onError?: (error: AppError) => void;
  onRecovery?: () => void;
  onConnectionChange?: (connected: boolean) => void;
}

export interface ErrorRecoveryState {
  hasError: boolean;
  error: AppError | null;
  isRecovering: boolean;
  recoveryAttempts: number;
  lastErrorTime: Date | null;
  connectionStatus: "connected" | "disconnected" | "reconnecting";
  queuedMessagesCount: number;
}

export interface ChatErrorRecoveryReturn {
  errorState: ErrorRecoveryState;
  handleError: (error: unknown, context?: string) => AppError;
  clearError: () => void;
  retryOperation: <T>(operation: () => Promise<T>) => Promise<T | undefined>;
  queueMessage: (
    message: Omit<QueuedMessage, "id" | "timestamp" | "retryCount" | "status">
  ) => string;
  processQueue: (
    sendFunction: (message: QueuedMessage) => Promise<boolean>
  ) => Promise<void>;
  getQueuedMessages: () => QueuedMessage[];
  clearQueue: () => void;
  forceRecovery: () => Promise<void>;
}

export const useChatErrorRecovery = (
  options: ChatErrorRecoveryOptions
): ChatErrorRecoveryReturn => {
  const {
    chatRoomId,
    userId,
    maxRetryAttempts = 3,
    retryDelay = 2000,
    enableOfflineQueue = true,
    enableAutoRecovery = true,
    onError,
    onRecovery,
    onConnectionChange,
  } = options;

  const [errorState, setErrorState] = useState<ErrorRecoveryState>({
    hasError: false,
    error: null,
    isRecovering: false,
    recoveryAttempts: 0,
    lastErrorTime: null,
    connectionStatus: "connected",
    queuedMessagesCount: 0,
  });

  const recoveryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRecoveringRef = useRef(false);

  // Offline detection
  const { isOnline, isOffline } = useOfflineDetection({
    showToasts: false, // We'll handle our own toasts
    onOnline: () => {
      setErrorState((prev) => ({ ...prev, connectionStatus: "connected" }));
      onConnectionChange?.(true);

      if (enableAutoRecovery && errorState.hasError) {
        handleAutoRecovery();
      }
    },
    onOffline: () => {
      setErrorState((prev) => ({ ...prev, connectionStatus: "disconnected" }));
      onConnectionChange?.(false);

      toast({
        title: "Sin conexión",
        description:
          "Los mensajes se guardarán y enviarán cuando se restaure la conexión.",
        variant: "destructive",
      });
    },
  });

  // Update queued messages count
  useEffect(() => {
    const updateQueueCount = () => {
      const count = chatMessageQueue.getQueueSizeForRoom(chatRoomId);
      setErrorState((prev) => ({ ...prev, queuedMessagesCount: count }));
    };

    // Initial count
    updateQueueCount();

    // Listen for queue changes
    const unsubscribe = chatMessageQueue.addListener(updateQueueCount);

    return unsubscribe;
  }, [chatRoomId]);

  // Handle error with classification and recovery logic
  const handleError = useCallback(
    (error: unknown, context?: string): AppError => {
      const appError = classifyError(error);

      // Add chat context
      appError.context = {
        ...appError.context,
        component: "chat",
        chatRoomId,
        userId,
        action: context,
      };

      console.error("Chat error handled:", appError);

      setErrorState((prev) => ({
        ...prev,
        hasError: true,
        error: appError,
        lastErrorTime: new Date(),
        connectionStatus:
          appError instanceof NetworkError
            ? "disconnected"
            : prev.connectionStatus,
      }));

      // Show appropriate error message
      showErrorToast(appError);

      // Report error
      onError?.(appError);

      // Trigger auto-recovery for recoverable errors
      if (
        enableAutoRecovery &&
        appError.isRetryable &&
        !isRecoveringRef.current
      ) {
        scheduleAutoRecovery();
      }

      return appError;
    },
    [chatRoomId, userId, enableAutoRecovery, onError]
  );

  // Clear error state
  const clearError = useCallback(() => {
    setErrorState((prev) => ({
      ...prev,
      hasError: false,
      error: null,
      isRecovering: false,
      recoveryAttempts: 0,
    }));

    if (recoveryTimeoutRef.current) {
      clearTimeout(recoveryTimeoutRef.current);
      recoveryTimeoutRef.current = null;
    }

    isRecoveringRef.current = false;
  }, []);

  // Retry operation with error handling
  const retryOperation = useCallback(
    async <T>(operation: () => Promise<T>): Promise<T | undefined> => {
      try {
        const result = await withRetry(operation, {
          ...DEFAULT_RETRY_OPTIONS.chat,
          maxAttempts: maxRetryAttempts,
          delay: retryDelay,
        });

        // Clear error on successful operation
        if (errorState.hasError) {
          clearError();
          onRecovery?.();

          toast({
            title: "Conexión restaurada",
            description: "El chat está funcionando correctamente.",
            variant: "default",
          });
        }

        return result;
      } catch (error) {
        handleError(error, "retry_operation");
        return undefined;
      }
    },
    [
      maxRetryAttempts,
      retryDelay,
      errorState.hasError,
      clearError,
      onRecovery,
      handleError,
    ]
  );

  // Queue message for offline sending
  const queueMessage = useCallback(
    (
      message: Omit<QueuedMessage, "id" | "timestamp" | "retryCount" | "status">
    ): string => {
      if (!enableOfflineQueue) {
        throw new Error("Offline queue is disabled");
      }

      const messageId = chatMessageQueue.enqueue({
        ...message,
        maxRetries: maxRetryAttempts,
      });

      toast({
        title: "Mensaje en cola",
        description: "El mensaje se enviará cuando se restaure la conexión.",
        variant: "default",
      });

      return messageId;
    },
    [enableOfflineQueue, maxRetryAttempts]
  );

  // Process queued messages
  const processQueue = useCallback(
    async (
      sendFunction: (message: QueuedMessage) => Promise<boolean>
    ): Promise<void> => {
      if (!enableOfflineQueue || !isOnline) return;

      try {
        await chatMessageQueue.processQueue(sendFunction);
      } catch (error) {
        handleError(error, "process_queue");
      }
    },
    [enableOfflineQueue, isOnline, handleError]
  );

  // Get queued messages for this room
  const getQueuedMessages = useCallback((): QueuedMessage[] => {
    return chatMessageQueue.getQueueForRoom(chatRoomId);
  }, [chatRoomId]);

  // Clear queue for this room
  const clearQueue = useCallback(() => {
    chatMessageQueue.clearRoom(chatRoomId);

    toast({
      title: "Cola limpiada",
      description: "Se eliminaron todos los mensajes en cola.",
      variant: "default",
    });
  }, [chatRoomId]);

  // Schedule automatic recovery
  const scheduleAutoRecovery = useCallback(() => {
    if (recoveryTimeoutRef.current || isRecoveringRef.current) return;

    const delay = Math.min(
      retryDelay * Math.pow(2, errorState.recoveryAttempts),
      30000 // Max 30 seconds
    );

    recoveryTimeoutRef.current = setTimeout(() => {
      handleAutoRecovery();
    }, delay);
  }, [retryDelay, errorState.recoveryAttempts]);

  // Handle automatic recovery
  const handleAutoRecovery = useCallback(async () => {
    if (isRecoveringRef.current || !errorState.hasError) return;

    isRecoveringRef.current = true;
    setErrorState((prev) => ({
      ...prev,
      isRecovering: true,
      recoveryAttempts: prev.recoveryAttempts + 1,
      connectionStatus: "reconnecting",
    }));

    try {
      // Simple connectivity test
      const response = await fetch("/api/health", {
        method: "HEAD",
        cache: "no-cache",
      });

      if (response.ok) {
        // Recovery successful
        clearError();
        onRecovery?.();

        toast({
          title: "Recuperación exitosa",
          description: "La conexión del chat se ha restaurado.",
          variant: "default",
        });

        // Process any queued messages
        if (enableOfflineQueue) {
          // We'll need the send function from the chat service
          // This will be handled by the chat component
        }
      } else {
        throw new Error("Health check failed");
      }
    } catch (error) {
      console.error("Auto-recovery failed:", error);

      // Schedule next recovery attempt if we haven't exceeded max attempts
      if (errorState.recoveryAttempts < maxRetryAttempts) {
        scheduleAutoRecovery();
      } else {
        toast({
          title: "Recuperación fallida",
          description: "No se pudo restaurar la conexión automáticamente.",
          variant: "destructive",
        });
      }
    } finally {
      isRecoveringRef.current = false;
      setErrorState((prev) => ({
        ...prev,
        isRecovering: false,
        connectionStatus: isOnline ? "connected" : "disconnected",
      }));
    }
  }, [
    errorState.hasError,
    errorState.recoveryAttempts,
    maxRetryAttempts,
    enableOfflineQueue,
    isOnline,
    clearError,
    onRecovery,
    scheduleAutoRecovery,
  ]);

  // Force recovery (manual trigger)
  const forceRecovery = useCallback(async () => {
    clearError();
    await handleAutoRecovery();
  }, [clearError, handleAutoRecovery]);

  // Show appropriate error toast
  const showErrorToast = useCallback((error: AppError) => {
    let title = "Error en el chat";
    let description = "Ha ocurrido un error inesperado.";

    if (error instanceof NetworkError || error instanceof ConnectionError) {
      title = "Error de conexión";
      description = "Problema de conexión. Reintentando automáticamente...";
    } else if (error instanceof ChatError) {
      title = "Error del chat";
      description = error.message;
    }

    toast({
      title,
      description,
      variant: "destructive",
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
      }
      isRecoveringRef.current = false;
    };
  }, []);

  return {
    errorState,
    handleError,
    clearError,
    retryOperation,
    queueMessage,
    processQueue,
    getQueuedMessages,
    clearQueue,
    forceRecovery,
  };
};

// Specialized hook for chat operations with automatic error handling
export const useChatOperationWithRecovery = <T extends any[], R>(
  operation: (...args: T) => Promise<R>,
  options: ChatErrorRecoveryOptions
) => {
  const recovery = useChatErrorRecovery(options);

  const executeOperation = useCallback(
    async (...args: T): Promise<R | undefined> => {
      return recovery.retryOperation(() => operation(...args));
    },
    [operation, recovery]
  );

  return {
    ...recovery,
    executeOperation,
  };
};
