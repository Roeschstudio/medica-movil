"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useOfflineDetection } from "@/hooks/use-offline-detection";
import { cn } from "@/lib/utils";
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface ConnectionStatusProps {
  isConnected?: boolean;
  isReconnecting?: boolean;
  onReconnect?: () => void;
  showDetails?: boolean;
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isConnected = true,
  isReconnecting = false,
  onReconnect,
  showDetails = false,
  className,
}) => {
  const { isOnline, wasOffline, getOfflineDuration } = useOfflineDetection({
    showToasts: false, // We'll handle our own notifications
  });

  const [offlineDuration, setOfflineDuration] = useState(0);

  // Update offline duration every second when offline
  useEffect(() => {
    if (!isOnline) {
      const interval = setInterval(() => {
        setOfflineDuration(getOfflineDuration());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isOnline, getOfflineDuration]);

  const formatDuration = useCallback((ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }, []);

  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        icon: <WifiOff className="h-4 w-4" />,
        label: "Sin internet",
        variant: "destructive" as const,
        description:
          offlineDuration > 0
            ? `Desconectado por ${formatDuration(offlineDuration)}`
            : "Sin conexión a internet",
      };
    }

    if (isReconnecting) {
      return {
        icon: <RefreshCw className="h-4 w-4 animate-spin" />,
        label: "Reconectando",
        variant: "secondary" as const,
        description: "Reestableciendo conexión...",
      };
    }

    if (!isConnected) {
      return {
        icon: <AlertTriangle className="h-4 w-4" />,
        label: "Desconectado",
        variant: "destructive" as const,
        description: "Conexión perdida con el servidor",
      };
    }

    return {
      icon: <Wifi className="h-4 w-4" />,
      label: wasOffline ? "Reconectado" : "Conectado",
      variant: "default" as const,
      description: "Conexión estable",
    };
  };

  const statusInfo = getStatusInfo();

  if (showDetails) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "p-2 rounded-full",
                  statusInfo.variant === "destructive" &&
                    "bg-destructive/10 text-destructive",
                  statusInfo.variant === "secondary" &&
                    "bg-secondary text-secondary-foreground",
                  statusInfo.variant === "default" &&
                    "bg-green-100 text-green-700"
                )}
              >
                {statusInfo.icon}
              </div>
              <div>
                <p className="font-medium text-sm">{statusInfo.label}</p>
                <p className="text-xs text-muted-foreground">
                  {statusInfo.description}
                </p>
              </div>
            </div>

            {(!isConnected || !isOnline) && onReconnect && (
              <Button
                variant="outline"
                size="sm"
                onClick={onReconnect}
                disabled={isReconnecting}
              >
                {isReconnecting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Reconectando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reconectar
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Badge variant={statusInfo.variant} className={cn("text-xs", className)}>
      {statusInfo.icon}
      <span className="ml-1">{statusInfo.label}</span>
    </Badge>
  );
};

// Compact connection indicator for headers/toolbars
interface ConnectionIndicatorProps {
  isConnected?: boolean;
  isReconnecting?: boolean;
  className?: string;
}

export const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = ({
  isConnected = true,
  isReconnecting = false,
  className,
}) => {
  const { isOnline } = useOfflineDetection({ showToasts: false });

  const getIndicatorColor = () => {
    if (!isOnline || !isConnected) return "bg-red-500";
    if (isReconnecting) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getTooltipText = () => {
    if (!isOnline) return "Sin conexión a internet";
    if (!isConnected) return "Desconectado del servidor";
    if (isReconnecting) return "Reconectando...";
    return "Conectado";
  };

  return (
    <div className={cn("relative", className)} title={getTooltipText()}>
      <div
        className={cn(
          "w-3 h-3 rounded-full transition-colors duration-200",
          getIndicatorColor()
        )}
      >
        {isReconnecting && (
          <div className="absolute inset-0 w-3 h-3 rounded-full bg-yellow-500 animate-pulse" />
        )}
      </div>
    </div>
  );
};

// Network status banner for full-page notifications
interface NetworkStatusBannerProps {
  className?: string;
}

export const NetworkStatusBanner: React.FC<NetworkStatusBannerProps> = ({
  className,
}) => {
  const { isOnline, checkConnection } = useOfflineDetection({
    showToasts: false,
  });
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await checkConnection();
    } finally {
      setIsRetrying(false);
    }
  };

  if (isOnline) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 bg-destructive text-destructive-foreground p-3",
        className
      )}
    >
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <WifiOff className="h-4 w-4" />
          <span className="text-sm font-medium">Sin conexión a internet</span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleRetry}
          disabled={isRetrying}
          className="bg-white/20 hover:bg-white/30 text-white border-white/20"
        >
          {isRetrying ? (
            <>
              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              Verificando...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-1" />
              Reintentar
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
