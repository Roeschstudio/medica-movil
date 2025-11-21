"use client";

import { useChat } from "@/hooks/use-chat";
import { ChatRoom } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Users, Wifi, WifiOff } from "lucide-react";
import { useCallback, useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { MessageInput } from "./message-input";
import { MessageList } from "./message-list";

interface ChatInterfaceProps {
  appointmentId: string;
  chatRoom?: ChatRoom | null;
  className?: string;
  onError?: (error: Error) => void;
  onConnectionChange?: (connected: boolean) => void;
  onNewMessage?: (message: any) => void;
}

export function ChatInterface({
  appointmentId,
  chatRoom: initialChatRoom,
  className,
  onError,
  onConnectionChange,
  onNewMessage,
}: ChatInterfaceProps) {
  const { user } = useUnifiedAuth();
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // Initialize chat hook
  const chat = useChat({
    appointmentId,
    userId: user?.id || "",
    userName: user?.name || "",
    userRole: user?.role || "PATIENT",
    autoConnect: true,
    enableTypingIndicators: true,
    enablePresence: true,
    onError,
    onConnectionChange,
    onNewMessage,
  });

  // Handle file download
  const handleFileDownload = useCallback(
    async (fileUrl: string, fileName: string) => {
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
        onError?.(new Error("Error al descargar el archivo"));
      }
    },
    [onError]
  );

  // Handle image preview
  const handleImagePreview = useCallback((imageUrl: string) => {
    setImagePreviewUrl(imageUrl);
  }, []);

  // Close image preview
  const closeImagePreview = useCallback(() => {
    setImagePreviewUrl(null);
  }, []);

  // Handle message send
  const handleSendMessage = useCallback(
    async (content: string) => {
      try {
        return await chat.sendMessage(content);
      } catch (error) {
        console.error("Error sending message:", error);
        onError?.(new Error("Error al enviar el mensaje"));
        return false;
      }
    },
    [chat.sendMessage, onError]
  );

  // Handle file upload
  const handleFileUpload = useCallback(
    async (file: File) => {
      try {
        return await chat.sendFile(file);
      } catch (error) {
        console.error("Error uploading file:", error);
        onError?.(new Error("Error al subir el archivo"));
        return false;
      }
    },
    [chat.sendFile, onError]
  );

  // Get typing indicator text
  const getTypingText = useCallback(() => {
    const typingUsers = chat.typingUsers.filter(
      (user) => user.userId !== session?.user?.id
    );

    if (typingUsers.length === 0) return "";
    if (typingUsers.length === 1)
      return `${typingUsers[0].userName} está escribiendo...`;
    if (typingUsers.length === 2) {
      return `${typingUsers[0].userName} y ${typingUsers[1].userName} están escribiendo...`;
    }
    return `${typingUsers.length} personas están escribiendo...`;
  }, [chat.typingUsers, session?.user?.id]);

  // Get connection status info
  const getConnectionInfo = () => {
    if (!chat.isOnline) {
      return {
        icon: WifiOff,
        text: "Sin conexión a internet",
        color: "text-red-500",
        bgColor: "bg-red-50 dark:bg-red-900/20",
        borderColor: "border-red-200 dark:border-red-800",
      };
    }

    if (!chat.isConnected) {
      return {
        icon: WifiOff,
        text: chat.isReconnecting ? "Reconectando..." : "Desconectado",
        color: "text-orange-500",
        bgColor: "bg-orange-50 dark:bg-orange-900/20",
        borderColor: "border-orange-200 dark:border-orange-800",
      };
    }

    return {
      icon: Wifi,
      text: "Conectado",
      color: "text-green-500",
      bgColor: "bg-green-50 dark:bg-green-900/20",
      borderColor: "border-green-200 dark:border-green-800",
    };
  };

  const connectionInfo = getConnectionInfo();
  const typingText = getTypingText();

  if (chat.isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-gray-500">Cargando chat...</p>
        </div>
      </div>
    );
  }

  if (chat.error) {
    return (
      <div
        className={cn("flex items-center justify-center h-full p-4", className)}
      >
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <WifiOff className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Error de conexión
          </h3>
          <p className="text-gray-500 mb-4">{chat.error}</p>
          <Button onClick={chat.reconnect} variant="outline">
            Reintentar conexión
          </Button>
        </div>
      </div>
    );
  }

  if (!chat.chatRoom) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="text-center">
          <p className="text-gray-500">No se pudo cargar el chat</p>
        </div>
      </div>
    );
  }

  return (
    <ChatErrorBoundary>
      <div
        className={cn(
          "flex flex-col h-full bg-gray-50 dark:bg-gray-900",
          className
        )}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Chat de Consulta
                </h3>
                <ConnectionStatusIndicator
                  connectionState={{
                    isConnected: chat.isConnected,
                    isReconnecting: chat.isReconnecting,
                    isOnline: chat.isOnline,
                    lastConnected: null,
                    reconnectAttempts: 0,
                    maxReconnectAttempts: 5,
                    status: chat.isConnected ? "connected" : "disconnected",
                  }}
                  onReconnect={chat.reconnect}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* Online users indicator */}
              {chat.totalOnlineUsers > 0 && (
                <Badge
                  variant="secondary"
                  className="flex items-center space-x-1"
                >
                  <Users className="h-3 w-3" />
                  <span>{chat.totalOnlineUsers}</span>
                </Badge>
              )}

              {/* Unread messages badge */}
              {chat.unreadCount > 0 && (
                <Badge variant="destructive">
                  {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Connection status banner */}
        <ConnectionStatus
          connectionState={{
            isConnected: chat.isConnected,
            isReconnecting: chat.isReconnecting,
            isOnline: chat.isOnline,
            lastConnected: null,
            reconnectAttempts: 0,
            maxReconnectAttempts: 5,
            status: chat.isConnected ? "connected" : "disconnected",
            error: chat.error || undefined,
          }}
          onReconnect={chat.reconnect}
          showDetails={true}
          className="flex-shrink-0 mx-4 mt-2"
        />

        {/* Offline handler */}
        <OfflineHandler
          isOnline={chat.isOnline}
          onRetry={chat.reconnect}
          className="flex-shrink-0 mx-4 mt-2"
        />

        {/* Messages */}
        <MessageListErrorBoundary>
          <MessageList
            messages={chat.messages}
            currentUserId={session?.user?.id || ""}
            isLoading={chat.isLoadingMessages}
            hasMoreMessages={chat.hasMoreMessages}
            onLoadMore={chat.loadMoreMessages}
            onFileDownload={handleFileDownload}
            onImagePreview={handleImagePreview}
            className="flex-1"
          />
        </MessageListErrorBoundary>

        {/* Typing indicator */}
        {typingText && (
          <div className="flex-shrink-0 px-4 py-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                 />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                 />
              </div>
              <span className="text-sm text-gray-500">{typingText}</span>
            </div>
          </div>
        )}

        {/* Message input */}
        <div className="flex-shrink-0 p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <MessageInputErrorBoundary>
            <MessageInput
              value={chat.newMessage}
              onChange={chat.setNewMessage}
              onSend={handleSendMessage}
              onFileUpload={handleFileUpload}
              disabled={chat.isSending || !chat.isConnected}
              onTypingStart={chat.startTyping}
              onTypingStop={chat.stopTyping}
              placeholder={
                !chat.isConnected
                  ? "Reconectando..."
                  : !chat.isOnline
                  ? "Sin conexión a internet"
                  : "Escribe un mensaje..."
              }
            />
          </MessageInputErrorBoundary>
        </div>

        {/* Image preview modal */}
        {imagePreviewUrl && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
            onClick={closeImagePreview}
          >
            <div className="relative max-w-4xl max-h-4xl p-4">
              <img
                src={imagePreviewUrl}
                alt="Vista previa"
                className="max-w-full max-h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
              <Button
                onClick={closeImagePreview}
                variant="secondary"
                size="sm"
                className="absolute top-2 right-2"
              >
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </div>
    </ChatErrorBoundary>
  );
}
