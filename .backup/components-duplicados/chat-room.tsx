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
import { useChatRealtime, type ChatMessage } from "@/hooks/use-chat-realtime";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import { Paperclip, Send, X } from "lucide-react";
import { useUnifiedAuth } from "@/lib/unified-auth-context";
import React, { useCallback, useEffect, useRef, useState } from "react";

interface ChatRoomProps {
  chatRoomId: string;
  appointmentId?: string;
  className?: string;
  onClose?: () => void;
}

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  showAvatar?: boolean;
  showTimestamp?: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  showAvatar = true,
  showTimestamp = true,
}) => {
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
              <FilePreview
                fileName={message.fileName || "Imagen"}
                fileUrl={message.fileUrl}
                fileSize={message.fileSize || undefined}
                fileType="image/jpeg"
                className="max-w-xs"
              />
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
      className={cn(
        "flex gap-3 max-w-[80%]",
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
};

interface MessageInputProps {
  onSendMessage: (
    content: string,
    messageType?: ChatMessage["messageType"],
    fileData?: UploadedFile
  ) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  onError?: (error: unknown) => void;
}

const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  disabled = false,
  placeholder = "Escribe un mensaje...",
  onError,
}) => {
  const [message, setMessage] = useState("");
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim() || disabled || isSending) return;

    setIsSending(true);
    try {
      await onSendMessage(message.trim());
      setMessage("");
    } catch (error) {
      onError?.(error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (uploadedFile: UploadedFile) => {
    setIsSending(true);
    try {
      const messageType = uploadedFile.type.startsWith("image/")
        ? "IMAGE"
        : "FILE";
      await onSendMessage("", messageType, uploadedFile);
      setShowFileUpload(false);
    } catch (error) {
      onError?.(error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="border-t">
      {showFileUpload && (
        <div className="p-4 border-b bg-muted/30">
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
            onFileUpload={handleFileUpload}
            onError={onError}
            maxFileSize={10}
            disabled={disabled || isSending}
          />
        </div>
      )}

      <div className="flex items-end gap-2 p-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowFileUpload(!showFileUpload)}
          disabled={disabled}
          className="flex-shrink-0"
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        <div className="flex-1 relative">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={disabled}
            className="pr-12"
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!message.trim() || disabled || isSending}
            className="absolute right-1 top-1 h-8 w-8 p-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export const ChatRoom: React.FC<ChatRoomProps> = ({
  chatRoomId,
  appointmentId,
  className,
  onClose,
}) => {
  const { user } = useUnifiedAuth();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const userId = user?.id || "";
  const userName = user?.name || "Usuario";

  // Error handling
  const { error, handleError, clearError, retryOperation } =
    useChatErrorHandler(chatRoomId);

  const {
    messages,
    typingUsers,
    connectionStatus,
    sendMessage: originalSendMessage,
    markMessagesAsRead,
    setTyping,
    loadMessages: originalLoadMessages,
    reconnect,
  } = useChatRealtime({
    chatRoomId,
    userId,
    userName,
    onNewMessage: (message) => {
      // Auto-scroll to bottom on new message
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    },
    onError: handleError,
  });

  // Offline-aware operations
  const { executeOperation: sendMessage } = useOfflineAwareOperation(
    originalSendMessage,
    {
      queueWhenOffline: true,
      showOfflineMessage: true,
    }
  );

  const { executeOperation: loadMessages } = useOfflineAwareOperation(
    originalLoadMessages,
    {
      fallback: () => [],
      showOfflineMessage: false,
    }
  );

  // Auto-scroll to bottom on initial load
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      }, 100);
    }
  }, [messages.length > 0]);

  // Mark messages as read when they come into view
  useEffect(() => {
    const unreadMessages = messages.filter(
      (msg) => !msg.isRead && msg.senderId !== userId
    );

    if (unreadMessages.length > 0) {
      const messageIds = unreadMessages.map((msg) => msg.id);
      markMessagesAsRead(messageIds);
    }
  }, [messages, userId, markMessagesAsRead]);

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      await retryOperation(() => loadMessages(50, messages.length), {
        maxAttempts: 3,
        delay: 1000,
      });
    } catch (error) {
      handleError(error, { action: "load_more_messages" });
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    isLoadingMore,
    loadMessages,
    messages.length,
    retryOperation,
    handleError,
  ]);

  const groupedMessages = messages.reduce(
    (groups: ChatMessage[][], message, index) => {
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
    },
    []
  );

  return (
    <ChatErrorBoundary chatRoomId={chatRoomId} onError={handleError}>
      <Card className={cn("flex flex-col h-full", className)}>
        <CardHeader className="flex-shrink-0 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Chat de Consulta</CardTitle>
              <ConnectionStatus
                isConnected={connectionStatus.isConnected}
                isReconnecting={connectionStatus.isReconnecting}
                onReconnect={reconnect}
              />
            </div>

            <div className="flex items-center gap-2">
              {onClose && (
                <Button variant="ghost" size="sm" onClick={onClose}>
                  ✕
                </Button>
              )}
            </div>
          </div>

          {typingUsers.length > 0 && (
            <div className="text-sm text-muted-foreground italic">
              {typingUsers.map((user) => user.userName).join(", ")} está
              escribiendo...
            </div>
          )}

          {error && (
            <ErrorDisplay
              error={error}
              onRetry={() => {
                clearError();
                reconnect();
              }}
              onDismiss={clearError}
            />
          )}
        </CardHeader>

        <Separator />

        <CardContent className="flex-1 flex flex-col p-0 min-h-0">
          <ScrollArea ref={scrollAreaRef} className="flex-1 px-4">
            <div className="space-y-4 py-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <div className="text-muted-foreground mb-2">
                    <svg
                      className="h-12 w-12 mx-auto mb-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No hay mensajes aún. ¡Inicia la conversación!
                  </p>
                </div>
              ) : (
                <>
                  {isLoadingMore && (
                    <div className="flex justify-center py-2">
                      <div className="animate-spin h-6 w-6 border-2 border-current border-t-transparent rounded-full" />
                    </div>
                  )}

                  {groupedMessages.map((group, groupIndex) => (
                    <div key={groupIndex} className="space-y-1">
                      {group.map((message, messageIndex) => (
                        <MessageBubble
                          key={message.id}
                          message={message}
                          isOwn={message.senderId === userId}
                          showAvatar={messageIndex === 0}
                          showTimestamp={messageIndex === group.length - 1}
                        />
                      ))}
                    </div>
                  ))}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <MessageInput
            onSendMessage={sendMessage}
            disabled={!connectionStatus.isConnected}
            placeholder={
              connectionStatus.isConnected
                ? "Escribe un mensaje..."
                : "Conectando..."
            }
            onError={handleError}
          />
        </CardContent>
      </Card>
    </ChatErrorBoundary>
  );
};

export default ChatRoom;
