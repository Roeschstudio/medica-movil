import { toast } from "@/hooks/use-toast";

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  chatRoomId?: string;
  metadata?: Record<string, any>;
}

export interface RetryOptions {
  maxAttempts: number;
  delay: number;
  backoff?: "linear" | "exponential";
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly context: ErrorContext;
  public readonly timestamp: Date;
  public readonly isRetryable: boolean;

  constructor(
    message: string,
    code: string = "UNKNOWN_ERROR",
    context: ErrorContext = {},
    isRetryable: boolean = false
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.context = context;
    this.timestamp = new Date();
    this.isRetryable = isRetryable;
  }
}

export class NetworkError extends AppError {
  constructor(message: string, context: ErrorContext = {}) {
    super(message, "NETWORK_ERROR", context, true);
    this.name = "NetworkError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context: ErrorContext = {}) {
    super(message, "VALIDATION_ERROR", context, false);
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string, context: ErrorContext = {}) {
    super(message, "AUTH_ERROR", context, false);
    this.name = "AuthenticationError";
  }
}

export class ChatError extends AppError {
  constructor(message: string, code: string, context: ErrorContext = {}) {
    super(message, code, context, true);
    this.name = "ChatError";
  }
}

export class ConnectionError extends NetworkError {
  constructor(
    message: string = "Connection failed",
    context: ErrorContext = {}
  ) {
    super(message, context);
    this.name = "ConnectionError";
  }
}

// Error classification
export const classifyError = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    // Network-related errors
    if (
      error.message.includes("fetch") ||
      error.message.includes("network") ||
      error.message.includes("connection") ||
      error.message.includes("timeout")
    ) {
      return new NetworkError(error.message);
    }

    // Authentication errors
    if (
      error.message.includes("unauthorized") ||
      error.message.includes("authentication") ||
      error.message.includes("token")
    ) {
      return new AuthenticationError(error.message);
    }

    // Validation errors
    if (
      error.message.includes("validation") ||
      error.message.includes("invalid") ||
      error.message.includes("required")
    ) {
      return new ValidationError(error.message);
    }

    return new AppError(error.message, "UNKNOWN_ERROR");
  }

  return new AppError("An unknown error occurred", "UNKNOWN_ERROR");
};

// User-friendly error messages
export const getErrorMessage = (error: AppError): string => {
  const errorMessages: Record<string, string> = {
    NETWORK_ERROR: "Problema de conexión. Por favor, verifica tu internet.",
    CONNECTION_ERROR: "No se pudo conectar al servidor. Reintentando...",
    AUTH_ERROR: "Error de autenticación. Por favor, inicia sesión nuevamente.",
    VALIDATION_ERROR: "Los datos ingresados no son válidos.",
    CHAT_CONNECTION_FAILED: "No se pudo conectar al chat. Reintentando...",
    CHAT_MESSAGE_SEND_FAILED: "No se pudo enviar el mensaje. Reintentando...",
    CHAT_ROOM_ACCESS_DENIED: "No tienes acceso a este chat.",
    FILE_UPLOAD_FAILED: "Error al subir el archivo. Intenta nuevamente.",
    FILE_TOO_LARGE: "El archivo es demasiado grande.",
    FILE_TYPE_NOT_ALLOWED: "Tipo de archivo no permitido.",
    RATE_LIMIT_EXCEEDED: "Demasiadas solicitudes. Espera un momento.",
    SERVER_ERROR: "Error del servidor. Intenta más tarde.",
    UNKNOWN_ERROR: "Ha ocurrido un error inesperado.",
  };

  return (
    errorMessages[error.code] || error.message || errorMessages.UNKNOWN_ERROR
  );
};

// Retry mechanism with exponential backoff
export const withRetry = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> => {
  const { maxAttempts, delay, backoff = "exponential", shouldRetry } = options;
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry this error
      if (shouldRetry && !shouldRetry(lastError, attempt)) {
        throw lastError;
      }

      // Don't retry on the last attempt
      if (attempt === maxAttempts) {
        throw lastError;
      }

      // Calculate delay for next attempt
      let nextDelay = delay;
      if (backoff === "exponential") {
        nextDelay = delay * Math.pow(2, attempt - 1);
      } else if (backoff === "linear") {
        nextDelay = delay * attempt;
      }

      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 1000;
      await new Promise((resolve) => {
        setTimeout(resolve, nextDelay + jitter);
      });
    }
  }

  throw lastError!;
};

// Error reporting
export const reportError = (error: AppError, context?: ErrorContext) => {
  const errorReport = {
    message: error.message,
    code: error.code,
    stack: error.stack,
    context: { ...error.context, ...context },
    timestamp: error.timestamp,
    userAgent:
      typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    url: typeof window !== "undefined" ? window.location.href : undefined,
  };

  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    console.error("Error Report:", errorReport);
  }

  // Send to error tracking service in production
  if (process.env.NODE_ENV === "production") {
    try {
      // Example: Send to your error tracking service
      // errorTrackingService.captureException(error, errorReport);

      // For now, just log to console
      console.error("Production Error:", errorReport);
    } catch (reportingError) {
      console.error("Failed to report error:", reportingError);
    }
  }
};

// Toast error notifications
export const showErrorToast = (error: AppError) => {
  const message = getErrorMessage(error);

  toast({
    title: "Error",
    description: message,
    variant: "destructive",
  });
};

// Handle errors with user feedback
export const handleError = (
  error: unknown,
  context?: ErrorContext,
  showToast: boolean = true
) => {
  const appError = classifyError(error);

  // Add context
  if (context) {
    appError.context = { ...appError.context, ...context };
  }

  // Report error
  reportError(appError, context);

  // Show user feedback
  if (showToast) {
    showErrorToast(appError);
  }

  return appError;
};

// Specific error handlers for common scenarios
export const handleNetworkError = (error: unknown, context?: ErrorContext) => {
  return handleError(error, { ...context, action: "network_request" });
};

export const handleChatError = (error: unknown, chatRoomId?: string) => {
  return handleError(error, {
    component: "chat",
    chatRoomId,
    action: "chat_operation",
  });
};

export const handleFileUploadError = (error: unknown, fileName?: string) => {
  return handleError(error, {
    component: "file_upload",
    action: "file_upload",
    metadata: { fileName },
  });
};

// Async error wrapper for React components
export const withErrorHandling = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context?: ErrorContext
) => {
  return async (...args: T): Promise<R | undefined> => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, context);
      return undefined;
    }
  };
};

// Default retry options for different scenarios
export const DEFAULT_RETRY_OPTIONS: Record<string, RetryOptions> = {
  network: {
    maxAttempts: 3,
    delay: 1000,
    backoff: "exponential",
    shouldRetry: (error) => error instanceof NetworkError,
  },
  chat: {
    maxAttempts: 5,
    delay: 2000,
    backoff: "exponential",
    shouldRetry: (error) =>
      error instanceof ChatError || error instanceof NetworkError,
  },
  fileUpload: {
    maxAttempts: 3,
    delay: 2000,
    backoff: "linear",
    shouldRetry: (error) => error instanceof NetworkError,
  },
};
