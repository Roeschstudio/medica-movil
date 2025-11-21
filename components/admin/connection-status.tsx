"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConnectionStatus } from "@/hooks/use-realtime-connection";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useState } from "react";

interface ConnectionStatusIndicatorProps {
  status: ConnectionStatus;
  retryCount?: number;
  onReconnect?: () => void;
  className?: string;
}

export function ConnectionStatusIndicator({
  status,
  retryCount = 0,
  onReconnect,
  className,
}: ConnectionStatusIndicatorProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show the indicator when there are connection issues
    setIsVisible(status !== "connected");
  }, [status]);

  if (!isVisible) {
    return null;
  }

  const getStatusConfig = () => {
    switch (status) {
      case "connecting":
        return {
          icon: <RefreshCw className="h-3 w-3 animate-spin" />,
          text: "Conectando...",
          variant: "secondary" as const,
          color: "text-blue-600",
        };
      case "connected":
        return {
          icon: <CheckCircle className="h-3 w-3" />,
          text: "Conectado",
          variant: "default" as const,
          color: "text-green-600",
        };
      case "disconnected":
        return {
          icon: <WifiOff className="h-3 w-3" />,
          text: "Desconectado",
          variant: "destructive" as const,
          color: "text-red-600",
        };
      case "error":
        return {
          icon: <AlertTriangle className="h-3 w-3" />,
          text: `Error (${retryCount} reintentos)`,
          variant: "destructive" as const,
          color: "text-red-600",
        };
      default:
        return {
          icon: <Wifi className="h-3 w-3" />,
          text: "Desconocido",
          variant: "secondary" as const,
          color: "text-gray-600",
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Badge variant={config.variant} className="flex items-center gap-1">
        {config.icon}
        <span className="text-xs">{config.text}</span>
      </Badge>

      {(status === "error" || status === "disconnected") && onReconnect && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReconnect}
          className="h-6 px-2 text-xs"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Reconectar
        </Button>
      )}
    </div>
  );
}

interface ConnectionStatusBannerProps {
  status: ConnectionStatus;
  retryCount?: number;
  onReconnect?: () => void;
}

export function ConnectionStatusBanner({
  status,
  retryCount = 0,
  onReconnect,
}: ConnectionStatusBannerProps) {
  if (status === "connected") {
    return null;
  }

  const getMessage = () => {
    switch (status) {
      case "connecting":
        return "Estableciendo conexión en tiempo real...";
      case "disconnected":
        return "Conexión perdida. Los datos pueden no estar actualizados.";
      case "error":
        return `Error de conexión. Reintentando... (${retryCount}/${5})`;
      default:
        return "Estado de conexión desconocido.";
    }
  };

  const getBannerColor = () => {
    switch (status) {
      case "connecting":
        return "bg-blue-50 border-blue-200 text-blue-800";
      case "disconnected":
        return "bg-yellow-50 border-yellow-200 text-yellow-800";
      case "error":
        return "bg-red-50 border-red-200 text-red-800";
      default:
        return "bg-gray-50 border-gray-200 text-gray-800";
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 border rounded-lg mb-4",
        getBannerColor()
      )}
    >
      <div className="flex items-center gap-2">
        {status === "connecting" && (
          <RefreshCw className="h-4 w-4 animate-spin" />
        )}
        {status === "disconnected" && <WifiOff className="h-4 w-4" />}
        {status === "error" && <AlertTriangle className="h-4 w-4" />}
        <span className="text-sm font-medium">{getMessage()}</span>
      </div>

      {(status === "error" || status === "disconnected") && onReconnect && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReconnect}
          className="text-xs"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Reconectar
        </Button>
      )}
    </div>
  );
}
