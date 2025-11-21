"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Message {
  id: string;
  sentAt: string;
  [key: string]: any;
}

interface MessagePaginationOptions {
  pageSize?: number;
  loadThreshold?: number;
  maxCachedPages?: number;
}

interface MessagePaginationResult<T extends Message> {
  messages: T[];
  hasMore: boolean;
  isLoading: boolean;
  loadMore: () => Promise<void>;
  reset: () => void;
  addMessage: (message: T) => void;
  updateMessage: (messageId: string, updates: Partial<T>) => void;
  scrollToBottom: () => void;
  scrollToMessage: (messageId: string) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  registerMessageRef: (
    messageId: string,
    element: HTMLDivElement | null
  ) => void;
}

export function useMessagePagination<T extends Message>(
  loadMessagesFunction: (limit: number, offset: number) => Promise<T[]>,
  options: MessagePaginationOptions = {}
): MessagePaginationResult<T> {
  const { pageSize = 50, loadThreshold = 10, maxCachedPages = 5 } = options;

  const [messages, setMessages] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [totalLoaded, setTotalLoaded] = useState(0);

  const loadingRef = useRef(false);
  const initialLoadRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Load more messages
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;

    loadingRef.current = true;
    setIsLoading(true);

    try {
      const newMessages = await loadMessagesFunction(pageSize, totalLoaded);

      if (newMessages.length === 0) {
        setHasMore(false);
      } else {
        setMessages((prev) => {
          // For chat messages, we want newest at the bottom
          // So we prepend older messages to the beginning
          const combined = [...newMessages, ...prev];

          // Limit total cached messages to prevent memory issues
          const maxMessages = maxCachedPages * pageSize;
          if (combined.length > maxMessages) {
            // Keep the most recent messages
            return combined.slice(-maxMessages);
          }

          return combined;
        });

        setTotalLoaded((prev) => prev + newMessages.length);

        if (newMessages.length < pageSize) {
          setHasMore(false);
        }
      }
    } catch (error) {
      console.error("Error loading messages:", error);
      throw error;
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [loadMessagesFunction, pageSize, totalLoaded, hasMore, maxCachedPages]);

  // Initial load
  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      loadMore();
    }
  }, [loadMore]);

  // Reset pagination
  const reset = useCallback(() => {
    setMessages([]);
    setHasMore(true);
    setTotalLoaded(0);
    initialLoadRef.current = false;
    loadingRef.current = false;
  }, []);

  // Add new message (for real-time updates)
  const addMessage = useCallback((message: T) => {
    setMessages((prev) => {
      // Check if message already exists
      const exists = prev.some((m) => m.id === message.id);
      if (exists) return prev;

      // Add to the end (newest messages at bottom)
      return [...prev, message];
    });
  }, []);

  // Update existing message
  const updateMessage = useCallback(
    (messageId: string, updates: Partial<T>) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, ...updates } : msg))
      );
    },
    []
  );

  // Enhanced scroll helpers with smooth scrolling
  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, []);

  const scrollToMessage = useCallback((messageId: string) => {
    const messageElement = messageRefs.current.get(messageId);
    if (messageElement && scrollContainerRef.current) {
      messageElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, []);

  // Register message ref
  const registerMessageRef = useCallback(
    (messageId: string, element: HTMLDivElement | null) => {
      if (element) {
        messageRefs.current.set(messageId, element);
      } else {
        messageRefs.current.delete(messageId);
      }
    },
    []
  );

  return {
    messages,
    hasMore,
    isLoading,
    loadMore,
    reset,
    addMessage,
    updateMessage,
    scrollToBottom,
    scrollToMessage,
    scrollContainerRef,
    registerMessageRef,
  };
}
