"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw } from "lucide-react";
import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  eventId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: number | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    this.setState({
      error,
      errorInfo,
      eventId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    });

    // Call the onError callback if provided
    this.props.onError?.(error, errorInfo);

    // Report error to monitoring service (if available)
    this.reportError(error, errorInfo);
  }

  componentDidUpdate(prevProps: Props) {
    const { resetOnPropsChange, resetKeys } = this.props;
    const { hasError } = this.state;

    if (hasError && prevProps.resetKeys !== resetKeys) {
      if (resetOnPropsChange) {
        this.resetErrorBoundary();
      }
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      window.clearTimeout(this.resetTimeoutId);
    }
  }

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      window.clearTimeout(this.resetTimeoutId);
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null,
    });
  };

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    // Here you would typically send the error to a monitoring service
    // like Sentry, LogRocket, or your own error tracking system
    try {
      const errorReport = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      };

      // Example: Send to your error tracking service
      // errorTrackingService.captureException(error, errorReport);

      console.error("Error Report:", errorReport);
    } catch (reportingError) {
      console.error("Failed to report error:", reportingError);
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <Card className="w-full max-w-md mx-auto mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Algo salió mal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ha ocurrido un error inesperado. Por favor, intenta recargar la
              página.
            </p>

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
                onClick={this.resetErrorBoundary}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reintentar
              </Button>
              <Button
                onClick={() => window.location.reload()}
                size="sm"
                className="flex-1"
              >
                Recargar página
              </Button>
            </div>

            {this.state.eventId && (
              <p className="text-xs text-muted-foreground text-center">
                ID del error: {this.state.eventId}
              </p>
            )}
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

// Chat-specific error boundary
interface ChatErrorBoundaryProps {
  children: ReactNode;
  chatRoomId?: string;
  onError?: (error: Error) => void;
}

export const ChatErrorBoundary: React.FC<ChatErrorBoundaryProps> = ({
  children,
  chatRoomId,
  onError,
}) => {
  const handleError = (error: Error, errorInfo: ErrorInfo) => {
    console.error("Chat error:", error, errorInfo);
    onError?.(error);
  };

  const fallback = (
    <Card className="w-full">
      <CardContent className="p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Error en el chat</h3>
        <p className="text-sm text-muted-foreground mb-4">
          No se pudo cargar el chat. Por favor, intenta recargar la página.
        </p>
        <Button onClick={() => window.location.reload()} size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Recargar
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <ErrorBoundary
      fallback={fallback}
      onError={handleError}
      resetKeys={[chatRoomId]}
      resetOnPropsChange
    >
      {children}
    </ErrorBoundary>
  );
};

export default ErrorBoundary;
