"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertCircle, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  onRetry?: (attempt: number) => void;
  onMaxAttemptsReached?: () => void;
  onSuccess?: () => void;
}

export interface RetryState {
  isRetrying: boolean;
  attempts: number;
  maxAttempts: number;
  nextRetryIn: number;
  lastError: Error | null;
  canRetry: boolean;
}

// Hook for retry logic
export function useRetry(
  operation: () => Promise<void>,
  options: RetryOptions = {}
) {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    onRetry,
    onMaxAttemptsReached,
    onSuccess,
  } = options;

  const [state, setState] = useState<RetryState>({
    isRetrying: false,
    attempts: 0,
    maxAttempts,
    nextRetryIn: 0,
    lastError: null,
    canRetry: true,
  });

  const [countdownTimer, setCountdownTimer] = useState<NodeJS.Timeout | null>(
    null
  );

  // Calculate delay with exponential backoff
  const calculateDelay = useCallback(
    (attempt: number) => {
      const delay = Math.min(
        initialDelay * Math.pow(backoffFactor, attempt - 1),
        maxDelay
      );
      return delay;
    },
    [initialDelay, backoffFactor, maxDelay]
  );

  // Execute retry
  const executeRetry = useCallback(async () => {
    if (state.attempts >= maxAttempts) {
      setState((prev) => ({ ...prev, canRetry: false }));
      onMaxAttemptsReached?.();
      return;
    }

    const newAttempt = state.attempts + 1;
    setState((prev) => ({
      ...prev,
      isRetrying: true,
      attempts: newAttempt,
      lastError: null,
    }));

    onRetry?.(newAttempt);

    try {
      await operation();
      setState((prev) => ({
        ...prev,
        isRetrying: false,
        attempts: 0,
        lastError: null,
        canRetry: true,
      }));
      onSuccess?.();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (newAttempt >= maxAttempts) {
        setState((prev) => ({
          ...prev,
          isRetrying: false,
          lastError: err,
          canRetry: false,
        }));
        onMaxAttemptsReached?.();
      } else {
        // Schedule next retry
        const delay = calculateDelay(newAttempt);
        setState((prev) => ({
          ...prev,
          isRetrying: false,
          lastError: err,
          nextRetryIn: delay,
        }));

        // Start countdown
        let remainingTime = delay;
        const interval = setInterval(() => {
          remainingTime -= 1000;
          setState((prev) => ({ ...prev, nextRetryIn: remainingTime }));

          if (remainingTime <= 0) {
            clearInterval(interval);
            executeRetry();
          }
        }, 1000);

        setCountdownTimer(interval);
      }
    }
  }, [
    state.attempts,
    maxAttempts,
    operation,
    onRetry,
    onSuccess,
    onMaxAttemptsReached,
    calculateDelay,
  ]);

  // Manual retry
  const retry = useCallback(() => {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      setCountdownTimer(null);
    }
    executeRetry();
  }, [executeRetry, countdownTimer]);

  // Reset retry state
  const reset = useCallback(() => {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      setCountdownTimer(null);
    }
    setState({
      isRetrying: false,
      attempts: 0,
      maxAttempts,
      nextRetryIn: 0,
      lastError: null,
      canRetry: true,
    });
  }, [maxAttempts, countdownTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (countdownTimer) {
        clearInterval(countdownTimer);
      }
    };
  }, [countdownTimer]);

  return {
    state,
    retry,
    reset,
    executeRetry,
  };
}

// Component for displaying retry UI
interface RetryHandlerProps {
  retryState: RetryState;
  onRetry: () => void;
  onReset?: () => void;
  title?: string;
  description?: string;
  className?: string;
}

export function RetryHandler({
  retryState,
  onRetry,
  onReset,
  title = "Error de conexión",
  description,
  className,
}: RetryHandlerProps) {
  const formatTime = (ms: number) => {
    const seconds = Math.ceil(ms / 1000);
    return `${seconds}s`;
  };

  const getErrorMessage = () => {
    if (retryState.lastError) {
      return retryState.lastError.message;
    }
    return description || "Ha ocurrido un error inesperado";
  };

  return (
    <div
      className={cn(
        "p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg",
        className
      )}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <AlertCircle className="h-5 w-5 text-red-500" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
            {title}
          </h3>

          <p className="text-sm text-red-600 dark:text-red-300 mt-1">
            {getErrorMessage()}
          </p>

          {retryState.attempts > 0 && (
            <p className="text-xs text-red-500 mt-1">
              Intento {retryState.attempts} de {retryState.maxAttempts}
            </p>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {retryState.isRetrying ? (
            <div className="flex items-center space-x-2 text-sm text-red-600 dark:text-red-300">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Reintentando...</span>
            </div>
          ) : retryState.nextRetryIn > 0 ? (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-red-500">
                Reintentando en {formatTime(retryState.nextRetryIn)}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                className="h-7 px-2 text-xs"
              >
                Reintentar ahora
              </Button>
            </div>
          ) : retryState.canRetry ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onRetry}
              className="h-7 px-2 text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Reintentar
            </Button>
          ) : (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-red-500">
                Máximo de intentos alcanzado
              </span>
              {onReset && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onReset}
                  className="h-7 px-2 text-xs"
                >
                  Restablecer
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Specific retry handlers for different operations
export function MessageSendRetryHandler({
  retryState,
  onRetry,
  onReset,
  className,
}: Omit<RetryHandlerProps, "title" | "description">) {
  return (
    <RetryHandler
      retryState={retryState}
      onRetry={onRetry}
      onReset={onReset}
      title="Error al enviar mensaje"
      description="No se pudo enviar el mensaje. Verifica tu conexión e intenta nuevamente."
      className={className}
    />
  );
}

export function FileUploadRetryHandler({
  retryState,
  onRetry,
  onReset,
  fileName,
  className,
}: Omit<RetryHandlerProps, "title" | "description"> & { fileName?: string }) {
  return (
    <RetryHandler
      retryState={retryState}
      onRetry={onRetry}
      onReset={onReset}
      title="Error al subir archivo"
      description={
        fileName
          ? `No se pudo subir "${fileName}". Intenta nuevamente.`
          : "Error al subir el archivo."
      }
      className={className}
    />
  );
}

export function ConnectionRetryHandler({
  retryState,
  onRetry,
  onReset,
  isOnline,
  className,
}: Omit<RetryHandlerProps, "title" | "description"> & { isOnline?: boolean }) {
  const title = isOnline
    ? "Error de conexión al chat"
    : "Sin conexión a internet";
  const description = isOnline
    ? "No se pudo conectar al servidor de chat. Reintentando automáticamente."
    : "Verifica tu conexión a internet e intenta nuevamente.";

  return (
    <div
      className={cn(
        "p-3 border rounded-lg",
        isOnline
          ? "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800"
          : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
        className
      )}
    >
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">
          {isOnline ? (
            <RefreshCw
              className={cn(
                "h-4 w-4 text-orange-500",
                retryState.isRetrying && "animate-spin"
              )}
            />
          ) : (
            <WifiOff className="h-4 w-4 text-red-500" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-sm font-medium",
              isOnline
                ? "text-orange-800 dark:text-orange-200"
                : "text-red-800 dark:text-red-200"
            )}
          >
            {title}
          </p>

          {retryState.nextRetryIn > 0 && (
            <p
              className={cn(
                "text-xs mt-1",
                isOnline
                  ? "text-orange-600 dark:text-orange-300"
                  : "text-red-600 dark:text-red-300"
              )}
            >
              Reintentando en {Math.ceil(retryState.nextRetryIn / 1000)}s
            </p>
          )}
        </div>

        {isOnline && retryState.canRetry && !retryState.isRetrying && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            className="h-7 px-2 text-xs"
          >
            Reintentar
          </Button>
        )}
      </div>
    </div>
  );
}

// Offline detection component
export function OfflineHandler({
  isOnline,
  onRetry,
  className,
}: {
  isOnline: boolean;
  onRetry?: () => void;
  className?: string;
}) {
  if (isOnline) return null;

  return (
    <div
      className={cn(
        "p-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <WifiOff className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Modo sin conexión
          </span>
        </div>

        {onRetry && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            className="h-7 px-2 text-xs"
          >
            <Wifi className="h-3 w-3 mr-1" />
            Verificar conexión
          </Button>
        )}
      </div>
    </div>
  );
}
