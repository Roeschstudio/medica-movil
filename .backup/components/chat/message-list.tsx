"use client";

import { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { MessageBubble } from "./message-bubble";

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
  isLoading?: boolean;
  hasMoreMessages?: boolean;
  onLoadMore?: () => Promise<void>;
  onFileDownload?: (fileUrl: string, fileName: string) => void;
  onImagePreview?: (imageUrl: string) => void;
  className?: string;
}

interface GroupedMessage extends ChatMessage {
  isGrouped: boolean;
  showSender: boolean;
  showTimestamp: boolean;
}

export function MessageList({
  messages,
  currentUserId,
  isLoading = false,
  hasMoreMessages = false,
  onLoadMore,
  onFileDownload,
  onImagePreview,
  className,
}: MessageListProps) {
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(messages.length);

  // Group messages by sender and time
  const groupedMessages = useCallback((): GroupedMessage[] => {
    if (!messages.length) return [];

    const grouped: GroupedMessage[] = [];
    const GROUPING_TIME_THRESHOLD = 5 * 60 * 1000; // 5 minutes

    messages.forEach((message, index) => {
      const prevMessage = messages[index - 1];
      const nextMessage = messages[index + 1];

      // Determine if this message should be grouped with the previous one
      const shouldGroupWithPrev =
        prevMessage &&
        prevMessage.senderId === message.senderId &&
        new Date(message.sentAt).getTime() -
          new Date(prevMessage.sentAt).getTime() <
          GROUPING_TIME_THRESHOLD;

      // Determine if this message should be grouped with the next one
      const shouldGroupWithNext =
        nextMessage &&
        nextMessage.senderId === message.senderId &&
        new Date(nextMessage.sentAt).getTime() -
          new Date(message.sentAt).getTime() <
          GROUPING_TIME_THRESHOLD;

      grouped.push({
        ...message,
        isGrouped: shouldGroupWithPrev,
        showSender: !shouldGroupWithPrev,
        showTimestamp: !shouldGroupWithNext || index === messages.length - 1,
      });
    });

    return grouped;
  }, [messages]);

  // Format date for day separators
  const formatDateSeparator = (date: Date) => {
    if (isToday(date)) {
      return "Hoy";
    } else if (isYesterday(date)) {
      return "Ayer";
    } else {
      return format(date, "EEEE, d 'de' MMMM", { locale: es });
    }
  };

  // Check if we need a date separator
  const needsDateSeparator = (
    currentMessage: ChatMessage,
    prevMessage?: ChatMessage
  ) => {
    if (!prevMessage) return true;

    const currentDate = new Date(currentMessage.sentAt);
    const prevDate = new Date(prevMessage.sentAt);

    return !isSameDay(currentDate, prevDate);
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        block: "end",
      });
    }
  }, []);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // Show scroll button if user is not near bottom
    const nearBottom = distanceFromBottom < 100;
    setIsNearBottom(nearBottom);
    setShowScrollButton(!nearBottom && messages.length > 0);

    // Load more messages if scrolled to top
    if (scrollTop === 0 && hasMoreMessages && onLoadMore && !isLoadingMore) {
      setIsLoadingMore(true);
      onLoadMore().finally(() => setIsLoadingMore(false));
    }
  }, [messages.length, hasMoreMessages, onLoadMore, isLoadingMore]);

  // Auto-scroll when new messages arrive (only if user is near bottom)
  useEffect(() => {
    const newMessageCount = messages.length;
    const hasNewMessages = newMessageCount > lastMessageCountRef.current;

    if (hasNewMessages && isNearBottom) {
      // Small delay to ensure DOM is updated
      setTimeout(() => scrollToBottom(), 100);
    }

    lastMessageCountRef.current = newMessageCount;
  }, [messages.length, isNearBottom, scrollToBottom]);

  // Initial scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom(false);
    }
  }, []);

  // Handle file download
  const handleFileDownload = useCallback(
    async (fileUrl: string, fileName: string) => {
      if (onFileDownload) {
        onFileDownload(fileUrl, fileName);
      } else {
        // Default download behavior
        try {
          const response = await fetch(fileUrl);
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } catch (error) {
          console.error("Error downloading file:", error);
        }
      }
    },
    [onFileDownload]
  );

  const processedMessages = groupedMessages();

  return (
    <div className={cn("relative flex-1 overflow-hidden", className)}>
      {/* Messages container */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto px-4 py-2 space-y-1"
        onScroll={handleScroll}
      >
        {/* Loading more indicator */}
        {isLoadingMore && (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
          </div>
        )}

        {/* Messages */}
        {processedMessages.map((message, index) => {
          const prevMessage = messages[index - 1];
          const showDateSeparator = needsDateSeparator(message, prevMessage);

          return (
            <div key={message.id}>
              {/* Date separator */}
              {showDateSeparator && (
                <div className="flex justify-center my-4">
                  <div className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full">
                    <span className="text-xs text-gray-500 font-medium">
                      {formatDateSeparator(new Date(message.sentAt))}
                    </span>
                  </div>
                </div>
              )}

              {/* Message bubble */}
              <MessageBubble
                message={message}
                isOwn={message.senderId === currentUserId}
                showSender={message.showSender}
                showTimestamp={message.showTimestamp}
                isGrouped={message.isGrouped}
                onFileDownload={handleFileDownload}
                onImagePreview={onImagePreview}
              />
            </div>
          );
        })}

        {/* Empty state */}
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No hay mensajes aún
            </h3>
            <p className="text-gray-500 max-w-sm">
              Inicia la conversación enviando un mensaje o compartiendo un
              archivo.
            </p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && messages.length === 0 && (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <div className="absolute bottom-4 right-4">
          <Button
            onClick={() => scrollToBottom()}
            size="sm"
            className="rounded-full shadow-lg h-10 w-10 p-0"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
