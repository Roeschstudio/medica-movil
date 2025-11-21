"use client";

import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { AppError, getErrorMessage } from "@/lib/error-handling";
import { AlertCircle, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useCallback } from "react";

interface ErrorToastOptions {
  title?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
  persistent?: boolean;
}

export const useErrorToast = () => {
  const showErrorToast = useCallback(
    (error: AppError | Error | string, options: ErrorToastOptions = {}) => {
      const {
        title = "Error",
        action,
        duration = 5000,
        persistent = false,
      } = options;

      let message: string;
      let isRetryable = false;

      if (error instanceof AppError) {
        message = getErrorMessage(error);
        isRetryable = error.isRetryable;
      } else if (error instanceof Error) {
        message = error.message;
      } else {
        message = error;
      }

      const toastAction =
        action ||
        (isRetryable
          ? {
              label: "Reintentar",
              onClick: () => {
                // Default retry action - could be overridden
                window.location.reload();
              },
            }
          : undefined);

      toast({
        title,
        description: message,
        variant: "destructive",
        duration: persistent ? Infinity : duration,
        action: toastAction ? (
          <Button
            variant="outline"
            size="sm"
            onClick={toastAction.onClick}
            className="ml-2"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            {toastAction.label}
          </Button>
        ) : undefined,
      });
    },
    []
  );

  const showNetworkErrorToast = useCallback(
    (onRetry?: () => void, options: Omit<ErrorToastOptions, "action"> = {}) => {
      showErrorToast("Problema de conexión. Verifica tu internet.", {
        ...options,
        title: "Sin conexión",
        action: onRetry
          ? {
              label: "Reintentar",
              onClick: onRetry,
            }
          : undefined,
      });
    },
    [showErrorToast]
  );

  const showConnectionStatusToast = useCallback(
    (
      isOnline: boolean,
      options: Omit<ErrorToastOptions, "title" | "action"> = {}
    ) => {
      if (isOnline) {
        toast({
          title: "Conexión restaurada",
          description: "Ya estás conectado nuevamente.",
          variant: "default",
          duration: 3000,
          action: (
            <div className="flex items-center text-green-600">
              <Wifi className="h-4 w-4" />
            </div>
          ),
        });
      } else {
        toast({
          title: "Sin conexión",
          description: "Verifica tu conexión a internet.",
          variant: "destructive",
          duration: options.persistent ? Infinity : 5000,
          action: (
            <div className="flex items-center text-destructive">
              <WifiOff className="h-4 w-4" />
            </div>
          ),
        });
      }
    },
    []
  );

  const showSuccessToast = useCallback(
    (message: string, options: Omit<ErrorToastOptions, "title"> = {}) => {
      toast({
        title: "Éxito",
        description: message,
        variant: "default",
        duration: options.duration || 3000,
      });
    },
    []
  );

  return {
    showErrorToast,
    showNetworkErrorToast,
    showConnectionStatusToast,
    showSuccessToast,
  };
};

// Component for displaying error states
interface ErrorDisplayProps {
  error: AppError | Error | string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  className,
}) => {
  let message: string;
  let isRetryable = false;

  if (error instanceof AppError) {
    message = getErrorMessage(error);
    isRetryable = error.isRetryable;
  } else if (error instanceof Error) {
    message = error.message;
  } else {
    message = error;
  }

  return (
    <div
      className={`flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg ${className}`}
    >
      <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-destructive">{message}</p>
      </div>
      <div className="flex gap-2">
        {isRetryable && onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Reintentar
          </Button>
        )}
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="text-destructive hover:bg-destructive/10"
          >
            ✕
          </Button>
        )}
      </div>
    </div>
  );
};
