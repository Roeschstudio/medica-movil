"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from "lucide-react";
import React, { Component, ErrorInfo, ReactNode } from "react";

interface ChatErrorBoundaryProps {
  children: ReactNode;
  chatRoomId?: string;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onRetry?: () => void;
  showConnectionStatus?: boolean;
}

interface ChatErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  retryCount: number;
  isRetrying: boolean;
}

export class ChatErrorBoundary extends Component<
  ChatErrorBoundaryProps,
  ChatErrorBoundaryState
> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: ChatErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
      isRetrying: false,
    };
  }

  static getDerivedStateFromError(
    error: Error
  ): Partial<ChatErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = `chat_error_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    console.error("Chat Error Boundary caught an error:", error, errorInfo);

    this.setState({
      error,
      errorInfo,
      errorId,
    });

    // Report error
    this.reportError(error, errorInfo, errorId);

    // Call onError callback
    this.props.onError?.(error, errorInfo);

    // Show error toast
    toast({
      title: "Error en el chat",
      description: this.getErrorMessage(error),
      variant: "destructive",
    });
  }

  private reportError = (
    error: Error,
    errorInfo: ErrorInfo,
    errorId: string
  ) => {
    const errorReport = {
      errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      chatRoomId: this.props.chatRoomId,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      retryCount: this.state.retryCount,
    };

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("Chat Error Report:", errorReport);
    }

    // Send to error tracking service in production
    try {
      // Example: Send to your error tracking service
      // errorTrackingService.captureException(error, errorReport);
      console.error("Production Chat Error:", errorReport);
    } catch (reportingError) {
      console.error("Failed to report chat error:", reportingError);
    }
  };

  private getErrorMessage = (error: Error): string => {
    if (error.message.includes("network") || error.message.includes("fetch")) {
      return "Problema de conexión. Verificando conexión...";
    }
    if (
      error.message.includes("unauthorized") ||
      error.message.includes("auth")
    ) {
      return "Error de autenticación. Por favor, recarga la página.";
    }
    if (error.message.includes("chat") || error.message.includes("message")) {
      return "Error en el chat. Reintentando conexión...";
    }
    return "Ha ocurrido un error inesperado en el chat.";
  };

  private handleRetry = () => {
    if (this.state.isRetrying) return;

    this.setState({ isRetrying: true });

    // Clear any existing timeout
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }

    // Exponential backoff for retry
    const delay = Math.min(1000 * Math.pow(2, this.state.retryCount), 10000);

    this.retryTimeoutId = setTimeout(() => {
      this.setState((prevState) => ({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null,
        retryCount: prevState.retryCount + 1,
        isRetrying: false,
      }));

      // Call onRetry callback if provided
      this.props.onRetry?.();
    }, delay);
  };

  private handleReload = () => {
    window.location.reload();
  };

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default chat error UI
      return (
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Error en el chat
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {this.getErrorMessage(this.state.error!)}
            </div>

            {this.props.showConnectionStatus && (
              <div className="flex items-center gap-2 text-sm">
                <WifiOff className="h-4 w-4 text-destructive" />
                <span>Verificando conexión...</span>
              </div>
            )}

            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="text-xs bg-muted p-2 rounded">
                <summary className="cursor-pointer font-medium mb-2">
                  Detalles del error (desarrollo)
                </summary>
                <pre className="whitespace-pre-wrap text-xs">
                  {this.state.error.message}
                  {"\n\n"}
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            <div className="flex gap-2">
              <Button
                onClick={this.handleRetry}
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={this.state.isRetrying}
              >
                {this.state.isRetrying ? (
                  <>
                    <div className="animate-spin h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full" />
                    Reintentando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reintentar
                  </>
                )}
              </Button>
              <Button onClick={this.handleReload} size="sm" className="flex-1">
                Recargar página
              </Button>
            </div>

            {this.state.retryCount > 0 && (
              <div className="text-xs text-muted-foreground text-center">
                Intentos: {this.state.retryCount}
              </div>
            )}

            {this.state.errorId && (
              <div className="text-xs text-muted-foreground text-center">
                ID del error: {this.state.errorId}
              </div>
            )}
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

// Connection Status Component
interface ConnectionStatusProps {
  isConnected: boolean;
  isReconnecting: boolean;
  onReconnect?: () => void;
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isConnected,
  isReconnecting,
  onReconnect,
  className,
}) => {
  if (isConnected) {
    return (
      <div
        className={`flex items-center gap-1 text-xs text-green-600 ${className}`}
      >
        <Wifi className="h-3 w-3" />
        <span>Conectado</span>
      </div>
    );
  }

  if (isReconnecting) {
    return (
      <div
        className={`flex items-center gap-1 text-xs text-yellow-600 ${className}`}
      >
        <div className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full" />
        <span>Reconectando...</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-1 text-xs text-destructive ${className}`}
    >
      <WifiOff className="h-3 w-3" />
      <span>Desconectado</span>
      {onReconnect && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReconnect}
          className="h-5 px-1 ml-1"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
};

// Error Display Component
interface ErrorDisplayProps {
  error: string;
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
  return (
    <div
      className={`bg-destructive/10 border border-destructive/20 rounded-md p-3 ${className}`}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-destructive">{error}</p>
        </div>
        <div className="flex gap-1">
          {onRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="h-6 px-2 text-destructive hover:text-destructive"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-6 px-2 text-destructive hover:text-destructive"
            >
              ✕
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatErrorBoundary;
