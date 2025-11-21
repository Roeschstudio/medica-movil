"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export interface ConnectionState {
  isConnected: boolean;
  isReconnecting: boolean;
  isOnline: boolean;
  lastConnected: Date | null;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  status: "connected" | "disconnected" | "reconnecting" | "offline";
  error?: string;
}

interface ConnectionStatusProps {
  connectionState: ConnectionState;
  onReconnect?: () => void;
  onDismiss?: () => void;
  showDetails?: boolean;
  className?: string;
}

export function ConnectionStatus({
  connectionState,
  onReconnect,
  onDismiss,
  showDetails = false,
  className,
}: ConnectionStatusProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showFullDetails, setShowFullDetails] = useState(false);

  // Show/hide based on connection state
  useEffect(() => {
    const shouldShow =
      !connectionState.isConnected ||
      !connectionState.isOnline ||
      connectionState.isReconnecting ||
      !!connectionState.error;

    setIsVisible(shouldShow);
  }, [connectionState]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  const handleReconnect = useCallback(() => {
    onReconnect?.();
  }, [onReconnect]);

  const getStatusInfo = () => {
    if (!connectionState.isOnline) {
      return {
        icon: WifiOff,
        title: "Sin conexión a internet",
        description: "Verifica tu conexión a internet",
        color: "text-red-500",
        bgColor: "bg-red-50 dark:bg-red-900/20",
        borderColor: "border-red-200 dark:border-red-800",
        showReconnect: false,
      };
    }

    if (connectionState.isReconnecting) {
      return {
        icon: RefreshCw,
        title: "Reconectando...",
        description: `Intento ${connectionState.reconnectAttempts} de ${connectionState.maxReconnectAttempts}`,
        color: "text-orange-500",
        bgColor: "bg-orange-50 dark:bg-orange-900/20",
        borderColor: "border-orange-200 dark:border-orange-800",
        showReconnect: false,
      };
    }

    if (!connectionState.isConnected) {
      return {
        icon: WifiOff,
        title: "Desconectado del chat",
        description:
          connectionState.error || "Conexión perdida con el servidor",
        color: "text-red-500",
        bgColor: "bg-red-50 dark:bg-red-900/20",
        borderColor: "border-red-200 dark:border-red-800",
        showReconnect: true,
      };
    }

    if (connectionState.error) {
      return {
        icon: AlertCircle,
        title: "Error de conexión",
        description: connectionState.error,
        color: "text-orange-500",
        bgColor: "bg-orange-50 dark:bg-orange-900/20",
        borderColor: "border-orange-200 dark:border-orange-800",
        showReconnect: true,
      };
    }

    return {
      icon: CheckCircle,
      title: "Conectado",
      description: "Chat funcionando correctamente",
      color: "text-green-500",
      bgColor: "bg-green-50 dark:bg-green-900/20",
      borderColor: "border-green-200 dark:border-green-800",
      showReconnect: false,
    };
  };

  const formatLastConnected = () => {
    if (!connectionState.lastConnected) return "Nunca";

    const now = new Date();
    const diff = now.getTime() - connectionState.lastConnected.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `Hace ${days} día${days > 1 ? "s" : ""}`;
    if (hours > 0) return `Hace ${hours} hora${hours > 1 ? "s" : ""}`;
    if (minutes > 0) return `Hace ${minutes} minuto${minutes > 1 ? "s" : ""}`;
    return "Hace un momento";
  };

  if (!isVisible) return null;

  const statusInfo = getStatusInfo();
  const IconComponent = statusInfo.icon;

  return (
    <div
      className={cn(
        "border rounded-lg p-3 transition-all duration-200",
        statusInfo.bgColor,
        statusInfo.borderColor,
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1 min-w-0">
          <div className="flex-shrink-0 mt-0.5">
            <IconComponent
              className={cn(
                "h-5 w-5",
                statusInfo.color,
                connectionState.isReconnecting && "animate-spin"
              )}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className={cn("text-sm font-medium", statusInfo.color)}>
                {statusInfo.title}
              </h4>

              {showDetails && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFullDetails(!showFullDetails)}
                  className="h-6 px-2 text-xs"
                >
                  {showFullDetails ? "Ocultar" : "Detalles"}
                </Button>
              )}
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {statusInfo.description}
            </p>

            {/* Detailed information */}
            {showFullDetails && (
              <div className="mt-3 space-y-2 text-xs text-gray-500">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium">Estado:</span>{" "}
                    {connectionState.status}
                  </div>
                  <div>
                    <span className="font-medium">Última conexión:</span>{" "}
                    {formatLastConnected()}
                  </div>
                  <div>
                    <span className="font-medium">Intentos:</span>{" "}
                    {connectionState.reconnectAttempts}/
                    {connectionState.maxReconnectAttempts}
                  </div>
                  <div>
                    <span className="font-medium">Internet:</span>{" "}
                    {connectionState.isOnline ? "Sí" : "No"}
                  </div>
                </div>

                {connectionState.error && (
                  <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                    <span className="font-medium">Error:</span>{" "}
                    {connectionState.error}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2 ml-3">
          {statusInfo.showReconnect && (
            <Button
              onClick={handleReconnect}
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={connectionState.isReconnecting}
            >
              {connectionState.isReconnecting ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Reconectando
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Reconectar
                </>
              )}
            </Button>
          )}

          {onDismiss && (
            <Button
              onClick={handleDismiss}
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Compact version for header/toolbar
export function ConnectionStatusIndicator({
  connectionState,
  onReconnect,
  className,
}: {
  connectionState: ConnectionState;
  onReconnect?: () => void;
  className?: string;
}) {
  const getStatusInfo = () => {
    if (!connectionState.isOnline) {
      return {
        icon: WifiOff,
        text: "Sin internet",
        color: "text-red-500",
      };
    }

    if (connectionState.isReconnecting) {
      return {
        icon: RefreshCw,
        text: "Reconectando...",
        color: "text-orange-500",
      };
    }

    if (!connectionState.isConnected) {
      return {
        icon: WifiOff,
        text: "Desconectado",
        color: "text-red-500",
      };
    }

    return {
      icon: Wifi,
      text: "Conectado",
      color: "text-green-500",
    };
  };

  const statusInfo = getStatusInfo();
  const IconComponent = statusInfo.icon;

  return (
    <div
      className={cn("flex items-center space-x-2", className)}
      onClick={onReconnect}
    >
      <IconComponent
        className={cn(
          "h-4 w-4",
          statusInfo.color,
          connectionState.isReconnecting && "animate-spin"
        )}
      />
      <span className={cn("text-sm", statusInfo.color)}>{statusInfo.text}</span>
    </div>
  );
}

// Hook for managing connection status
export function useConnectionStatus(
  initialState: Partial<ConnectionState> = {}
): [ConnectionState, (updates: Partial<ConnectionState>) => void] {
  const [state, setState] = useState<ConnectionState>({
    isConnected: false,
    isReconnecting: false,
    isOnline: navigator.onLine,
    lastConnected: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    status: "disconnected",
    ...initialState,
  });

  const updateState = useCallback((updates: Partial<ConnectionState>) => {
    setState((prev) => ({
      ...prev,
      ...updates,
      status: getStatus({ ...prev, ...updates }),
    }));
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => updateState({ isOnline: true });
    const handleOffline = () => updateState({ isOnline: false });

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [updateState]);

  return [state, updateState];
}

function getStatus(state: ConnectionState): ConnectionState["status"] {
  if (!state.isOnline) return "offline";
  if (state.isReconnecting) return "reconnecting";
  if (!state.isConnected) return "disconnected";
  return "connected";
}
