import {
  AppError,
  classifyError,
  DEFAULT_RETRY_OPTIONS,
  ErrorContext,
  handleError,
  RetryOptions,
  withRetry,
} from "@/lib/error-handling";
import { useCallback, useState } from "react";

interface UseErrorHandlerOptions {
  showToast?: boolean;
  context?: ErrorContext;
  onError?: (error: AppError) => void;
}

interface ErrorState {
  error: AppError | null;
  isRetrying: boolean;
  retryCount: number;
  lastRetryAt: Date | null;
}

export const useErrorHandler = (options: UseErrorHandlerOptions = {}) => {
  const { showToast = true, context, onError } = options;

  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    isRetrying: false,
    retryCount: 0,
    lastRetryAt: null,
  });

  const handleErrorWithState = useCallback(
    (error: unknown, additionalContext?: ErrorContext) => {
      const appError = classifyError(error);
      const fullContext = { ...context, ...additionalContext };

      setErrorState((prev) => ({
        ...prev,
        error: appError,
        isRetrying: false,
      }));

      const handledError = handleError(error, fullContext, showToast);
      onError?.(handledError);

      return handledError;
    },
    [context, showToast, onError]
  );

  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      isRetrying: false,
      retryCount: 0,
      lastRetryAt: null,
    });
  }, []);

  const retryOperation = useCallback(
    async <T>(
      operation: () => Promise<T>,
      retryOptions?: Partial<RetryOptions>
    ): Promise<T | undefined> => {
      const options = { ...DEFAULT_RETRY_OPTIONS.network, ...retryOptions };

      setErrorState((prev) => ({
        ...prev,
        isRetrying: true,
        retryCount: prev.retryCount + 1,
        lastRetryAt: new Date(),
      }));

      try {
        const result = await withRetry(operation, options);
        clearError();
        return result;
      } catch (error) {
        handleErrorWithState(error);
        return undefined;
      } finally {
        setErrorState((prev) => ({
          ...prev,
          isRetrying: false,
        }));
      }
    },
    [handleErrorWithState, clearError]
  );

  return {
    error: errorState.error,
    isRetrying: errorState.isRetrying,
    retryCount: errorState.retryCount,
    lastRetryAt: errorState.lastRetryAt,
    handleError: handleErrorWithState,
    clearError,
    retryOperation,
    hasError: !!errorState.error,
  };
};

// Specialized hooks for different contexts
export const useChatErrorHandler = (chatRoomId?: string) => {
  return useErrorHandler({
    context: { component: "chat", chatRoomId },
    showToast: true,
  });
};

export const useFileUploadErrorHandler = () => {
  return useErrorHandler({
    context: { component: "file_upload" },
    showToast: true,
  });
};

export const useNetworkErrorHandler = () => {
  return useErrorHandler({
    context: { action: "network_request" },
    showToast: true,
  });
};
