"use client";

import FilePreview from "@/components/file-preview";
import FileUpload, { UploadedFile } from "@/components/file-upload";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useConnectionPool } from "@/hooks/use-connection-pool";
import { useChatErrorHandler } from "@/hooks/use-error-handler";
import { useImageOptimization } from "@/hooks/use-image-optimization";
import { useMessagePagination } from "@/hooks/use-message-pagination";
import { useOfflineAwareOperation } from "@/hooks/use-offline-detection";
import { useQueryCache } from "@/hooks/use-query-cache";
import { useVirtualScroll } from "@/hooks/use-virtual-scroll";
import { chatService } from "@/lib/chat-service";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import { useUnifiedAuth } from "@/lib/unified-auth-context";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronUp, Paperclip, Send, X } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface ChatMessage {
  id: string;
  chatRoomId: string;
  senderId: string;
  content: string | null;
  messageType: "TEXT" | "FILE" | "IMAGE" | "VIDEO" | "AUDIO";
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  isRead: boolean;
  sentAt: string;
  sender?: {
    id: string;
    name: string;
    role: string;
  };
}

interface OptimizedChatRoomProps {
  chatRoomId: string;
  appointmentId?: string;
  className?: string;
  onClose?: () => void;
}

interface OptimizedMessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  showAvatar?: boolean;
  showTimestamp?: boolean;
  style?: React.CSSProperties;
}

const OptimizedMessageBubble: React.FC<OptimizedMessageBubbleProps> =
  React.memo(
    ({ message, isOwn, showAvatar = true, showTimestamp = true, style }) => {
      const formatMessageTime = (dateString: string) => {
        const date = new Date(dateString);

        if (isToday(date)) {
          return format(date, "HH:mm", { locale: es });
        } else if (isYesterday(date)) {
          return `Ayer ${format(date, "HH:mm", { locale: es })}`;
        } else {
          return format(date, "dd/MM/yyyy HH:mm", { locale: es });
        }
      };

      // Use optimized image loading for image messages
      const optimizedImage = useImageOptimization(message.fileUrl || "", {
        maxWidth: 400,
        maxHeight: 300,
        quality: 80,
        enableLazyLoading: true,
      });

      const renderMessageContent = () => {
        switch (message.messageType) {
          case "TEXT":
            return (
              <p className="text-sm whitespace-pre-wrap break-words">
                {message.content}
              </p>
            );

          case "IMAGE":
            return (
              <div className="space-y-2">
                {message.content && (
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                )}
                {message.fileUrl && (
                  <div className="relative max-w-xs">
                    <img
                      src={optimizedImage.src}
                      alt={message.fileName || "Imagen"}
                      className={cn(
                        "rounded-lg max-w-full h-auto transition-opacity duration-200",
                        optimizedImage.isLoading && "opacity-50"
                      )}
                      loading="lazy"
                    />
                    {optimizedImage.isLoading && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-spin h-6 w-6 border-2 border-current border-t-transparent rounded-full" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );

          case "FILE":
            return (
              <div className="space-y-2">
                {message.content && (
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                )}
                {message.fileUrl && (
                  <FilePreview
                    fileName={message.fileName || "Archivo"}
                    fileUrl={message.fileUrl}
                    fileSize={message.fileSize || undefined}
                    fileType="application/octet-stream"
                    className="max-w-xs"
                  />
                )}
              </div>
            );

          default:
            return (
              <p className="text-sm text-muted-foreground italic">
                Tipo de mensaje no soportado
              </p>
            );
        }
      };

      return (
        <div
          style={style}
          className={cn(
            "flex gap-3 max-w-[80%] px-4 py-2",
            isOwn ? "ml-auto flex-row-reverse" : "mr-auto"
          )}
        >
          {showAvatar && (
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarImage src={message.sender?.id} />
              <AvatarFallback className="text-xs">
                {message.sender?.name?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
          )}

          <div
            className={cn(
              "flex flex-col gap-1",
              isOwn ? "items-end" : "items-start"
            )}
          >
            {showAvatar && message.sender?.name && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {message.sender.name}
                </span>
                {message.sender.role === "DOCTOR" && (
                  <Badge variant="secondary" className="text-xs px-1 py-0">
                    Doctor
                  </Badge>
                )}
              </div>
            )}

            <div
              className={cn(
                "rounded-lg px-3 py-2 max-w-full",
                isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
              )}
            >
              {renderMessageContent()}
            </div>

            {showTimestamp && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">
                  {formatMessageTime(message.sentAt)}
                </span>
                {isOwn && (
                  <div className="flex items-center">
                    {message.isRead ? (
                      <div className="text-xs text-muted-foreground">✓✓</div>
                    ) : (
                      <div className="text-xs text-muted-foreground">✓</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
  );

OptimizedMessageBubble.displayName = "OptimizedMessageBubble";

export const OptimizedChatRoom: React.FC<OptimizedChatRoomProps> = ({
  chatRoomId,
  appointmentId,
  className,
  onClose,
}) => {
  const { user } = useUnifiedAuth();
  const [message, setMessage] = useState("");
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createSupabaseBrowserClient();

  const userId = user?.id || "";
  const userName = user?.name || "Usuario";

  // Error handling
  const { error, handleError, clearError, retryOperation } =
    useChatErrorHandler(chatRoomId);

  // Connection pooling for real-time subscriptions
  const connectionPool = useConnectionPool({
    maxConnections: 5,
    connectionTimeout: 30000,
  });

  // Message pagination with caching
  const loadMessagesFunction = useCallback(
    async (limit: number, offset: number) => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select(
          `
        *,
        sender:senderId (
          id,
          name,
          role
        )
      `
        )
        .eq("chatRoomId", chatRoomId)
        .order("sentAt", { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data || [];
    },
    [chatRoomId, supabase]
  );

  const {
    messages,
    hasMore,
    isLoading: isLoadingMessages,
    loadMore,
    addMessage,
    updateMessage,
  } = useMessagePagination(loadMessagesFunction, {
    pageSize: 50,
    maxCachedPages: 3,
  });

  // Cache chat room details
  const { data: chatRoomDetails } = useQueryCache(
    `chat-room-${chatRoomId}`,
    async () => {
      const chatRoom = await chatService.getChatRoom(chatRoomId);
      return chatRoom;
    },
    { ttl: 300000, staleTime: 60000 }
  );

  // Virtual scrolling for large message lists
  const ITEM_HEIGHT = 80; // Approximate height per message
  const CONTAINER_HEIGHT = 400; // Height of the scroll container

  const { virtualItems, totalHeight, scrollElementProps, scrollToItem } =
    useVirtualScroll(messages, {
      itemHeight: ITEM_HEIGHT,
      containerHeight: CONTAINER_HEIGHT,
      overscan: 5,
    });

  // Group messages for better rendering
  const groupedMessages = useMemo(() => {
    return messages.reduce((groups: ChatMessage[][], message, index) => {
      const prevMessage = messages[index - 1];
      const shouldGroup =
        prevMessage &&
        prevMessage.senderId === message.senderId &&
        new Date(message.sentAt).getTime() -
          new Date(prevMessage.sentAt).getTime() <
          300000; // 5 minutes

      if (shouldGroup && groups.length > 0) {
        groups[groups.length - 1].push(message);
      } else {
        groups.push([message]);
      }

      return groups;
    }, []);
  }, [messages]);

  // Real-time subscription using connection pool
  useEffect(() => {
    const subscribeToMessages = async () => {
      await connectionPool.subscribe(
        `chat_room_${chatRoomId}`,
        `chat-room-component-${chatRoomId}`,
        {
          onMessage: (payload) => {
            if (
              payload.eventType === "INSERT" &&
              payload.table === "chat_messages"
            ) {
              const newMessage = payload.new as ChatMessage;
              addMessage(newMessage);

              // Auto-scroll to bottom if user is near bottom
              if (scrollContainerRef.current) {
                const { scrollTop, scrollHeight, clientHeight } =
                  scrollContainerRef.current;
                const isNearBottom =
                  scrollTop + clientHeight >= scrollHeight - 100;

                if (isNearBottom) {
                  setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({
                      behavior: "smooth",
                    });
                  }, 100);
                }
              }
            } else if (
              payload.eventType === "UPDATE" &&
              payload.table === "chat_messages"
            ) {
              const updatedMessage = payload.new as ChatMessage;
              updateMessage(updatedMessage.id, updatedMessage);
            }
          },
          onError: handleError,
        }
      );
    };

    subscribeToMessages();

    return () => {
      connectionPool.unsubscribe(
        `chat_room_${chatRoomId}`,
        `chat-room-component-${chatRoomId}`
      );
    };
  }, [chatRoomId, connectionPool, addMessage, updateMessage, handleError]);

  // Offline-aware send message
  const { executeOperation: sendMessageOffline } = useOfflineAwareOperation(
    async (
      content: string,
      messageType: ChatMessage["messageType"] = "TEXT",
      fileData?: UploadedFile
    ) => {
      const messageData = {
        chatRoomId,
        senderId: userId,
        content,
        messageType,
        fileUrl: fileData?.url || null,
        fileName: fileData?.name || null,
        fileSize: fileData?.size || null,
        isRead: false,
      };

      const { data, error } = await supabase
        .from("chat_messages")
        .insert(messageData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    {
      queueWhenOffline: true,
      showOfflineMessage: true,
    }
  );

  // Handle scroll events
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

      // Show scroll to bottom button
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;
      setShowScrollToBottom(!isNearBottom && messages.length > 0);

      // Load more messages when scrolling to top
      if (scrollTop < 100 && hasMore && !isLoadingMessages) {
        loadMore();
      }
    },
    [hasMore, isLoadingMessages, loadMore, messages.length]
  );

  // Send message handler
  const handleSendMessage = useCallback(
    async (
      content: string,
      messageType?: ChatMessage["messageType"],
      fileData?: UploadedFile
    ) => {
      if ((!content.trim() && !fileData) || isSending) return;

      setIsSending(true);
      try {
        await retryOperation(
          () => sendMessageOffline(content, messageType, fileData),
          { maxAttempts: 3, delay: 1000 }
        );
        setMessage("");
        setShowFileUpload(false);
      } catch (error) {
        handleError(error, { action: "send_message" });
      } finally {
        setIsSending(false);
      }
    },
    [isSending, retryOperation, sendMessageOffline, handleError]
  );

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load more messages handler
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMessages || !hasMore) return;

    try {
      await loadMore();
    } catch (error) {
      handleError(error, { action: "load_more_messages" });
    }
  }, [isLoadingMessages, hasMore, loadMore, handleError]);

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Chat de Consulta</CardTitle>
            <Badge variant="outline" className="text-xs">
              {connectionPool.getConnectionStatus(`chat_room_${chatRoomId}`)}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {/* Video Call Button - will be added here */}
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                ✕
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
            {error.message}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearError}
              className="ml-2 h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>

      <Separator />

      <CardContent className="flex-1 flex flex-col p-0 min-h-0 relative">
        {/* Load more button */}
        {hasMore && (
          <div className="flex justify-center p-2 border-b">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadMore}
              disabled={isLoadingMessages}
            >
              {isLoadingMessages ? (
                <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
              ) : (
                <ChevronUp className="h-4 w-4 mr-2" />
              )}
              Cargar mensajes anteriores
            </Button>
          </div>
        )}

        {/* Messages area with virtual scrolling */}
        <div className="flex-1 relative">
          <ScrollArea
            ref={scrollContainerRef}
            className="h-full"
            onScrollCapture={handleScroll}
          >
            <div style={{ height: totalHeight, position: "relative" }}>
              {virtualItems.map(({ index, start, item: message }) => {
                const group = groupedMessages.find((g) => g.includes(message));
                const messageIndex = group?.indexOf(message) || 0;
                const isFirstInGroup = messageIndex === 0;
                const isLastInGroup = messageIndex === (group?.length || 1) - 1;

                return (
                  <OptimizedMessageBubble
                    key={message.id}
                    message={message}
                    isOwn={message.senderId === userId}
                    showAvatar={isFirstInGroup}
                    showTimestamp={isLastInGroup}
                    style={{
                      position: "absolute",
                      top: start,
                      left: 0,
                      right: 0,
                    }}
                  />
                );
              })}
            </div>
            <div ref={messagesEndRef} />
          </ScrollArea>

          {/* Scroll to bottom button */}
          {showScrollToBottom && (
            <Button
              variant="secondary"
              size="sm"
              className="absolute bottom-4 right-4 rounded-full shadow-lg"
              onClick={scrollToBottom}
            >
              <ChevronUp className="h-4 w-4 rotate-180" />
            </Button>
          )}
        </div>

        {/* File upload area */}
        {showFileUpload && (
          <div className="p-4 border-t bg-muted/30">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium">Subir archivo</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFileUpload(false)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <FileUpload
              onFileUpload={(file) =>
                handleSendMessage(
                  "",
                  file.type.startsWith("image/") ? "IMAGE" : "FILE",
                  file
                )
              }
              onError={handleError}
              maxFileSize={10}
              disabled={isSending}
            />
          </div>
        )}

        {/* Message input */}
        <div className="border-t p-4">
          <div className="flex items-end gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowFileUpload(!showFileUpload)}
              disabled={isSending}
              className="flex-shrink-0"
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            <div className="flex-1 relative">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(message.trim());
                  }
                }}
                placeholder="Escribe un mensaje..."
                disabled={isSending}
                className="pr-12"
              />
              <Button
                size="sm"
                onClick={() => handleSendMessage(message.trim())}
                disabled={!message.trim() || isSending}
                className="absolute right-1 top-1 h-8 w-8 p-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OptimizedChatRoom;
