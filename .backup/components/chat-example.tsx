"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useChat } from "@/hooks/use-chat";
import { Loader2, Send, Upload, Wifi, WifiOff } from "lucide-react";
import { useUnifiedAuth } from "@/lib/unified-auth-context";
import { useRef } from "react";

interface ChatExampleProps {
  appointmentId: string;
}

export function ChatExample({ appointmentId }: ChatExampleProps) {
  const { user } = useUnifiedAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    // Chat room state
    chatRoom,
    isLoading,
    error,

    // Messages
    messages,
    hasMoreMessages,
    isLoadingMessages,
    loadMoreMessages,
    unreadCount,

    // Message operations
    sendMessage,
    sendFile,
    markMessagesAsRead,

    // Input state
    newMessage,
    setNewMessage,
    isSending,

    // Connection state
    isConnected,
    isReconnecting,
    connectionStatus,
    reconnect,

    // Offline state
    isOnline,
    queuedMessagesCount,

    // Typing indicators
    isTyping,
    typingUsers,
    getTypingText,

    // Presence
    onlineUsers,
    totalOnlineUsers,

    // Cleanup
    cleanup,
  } = useChat({
    appointmentId,
    userId: user?.id || "",
    userName: user?.name || "",
    userRole: user?.role || "patient",
    onError: (error) => {
      console.error("Chat error:", error);
    },
    onConnectionChange: (connected) => {
      console.log("Connection changed:", connected);
    },
    onNewMessage: (message) => {
      console.log("New message:", message);
      // You could play a notification sound here
    },
  });

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    const success = await sendMessage(newMessage);
    if (success) {
      // Message sent successfully, newMessage is automatically cleared
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const success = await sendFile(file);
    if (success) {
      // File sent successfully
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleMarkAsRead = async () => {
    await markMessagesAsRead();
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Iniciando chat...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-8">
          <div className="text-center">
            <p className="text-red-600 mb-4">Error: {error}</p>
            <Button onClick={reconnect} variant="outline">
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Chat de Consulta</CardTitle>
          <div className="flex items-center gap-2">
            {/* Connection Status */}
            <Badge variant={isConnected ? "default" : "destructive"}>
              {isConnected ? (
                <Wifi className="h-3 w-3 mr-1" />
              ) : (
                <WifiOff className="h-3 w-3 mr-1" />
              )}
              {connectionStatus}
            </Badge>

            {/* Online Status */}
            <Badge variant={isOnline ? "default" : "secondary"}>
              {isOnline ? "En línea" : "Sin conexión"}
            </Badge>

            {/* Online Users Count */}
            {totalOnlineUsers > 0 && (
              <Badge variant="outline">{totalOnlineUsers} en línea</Badge>
            )}

            {/* Unread Messages */}
            {unreadCount > 0 && (
              <Badge variant="destructive">{unreadCount} sin leer</Badge>
            )}

            {/* Queued Messages */}
            {queuedMessagesCount > 0 && (
              <Badge variant="warning">{queuedMessagesCount} en cola</Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Messages Area */}
        <div className="h-96 overflow-y-auto border rounded-lg p-4 space-y-2">
          {/* Load More Button */}
          {hasMoreMessages && (
            <div className="text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadMoreMessages}
                disabled={isLoadingMessages}
              >
                {isLoadingMessages ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Cargar mensajes anteriores
              </Button>
            </div>
          )}

          {/* Messages */}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.senderId === user?.id
                  ? "justify-end"
                  : "justify-start"
              }`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.senderId === user?.id
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-900"
                }`}
              >
                {message.messageType === "TEXT" && <p>{message.content}</p>}
                {message.messageType === "IMAGE" && (
                  <div>
                    <img
                      src={message.fileUrl || ""}
                      alt={message.fileName || ""}
                      className="max-w-full h-auto rounded"
                    />
                    <p className="text-xs mt-1">{message.fileName}</p>
                  </div>
                )}
                {message.messageType === "FILE" && (
                  <div>
                    <p>{message.content}</p>
                    <a
                      href={message.fileUrl || ""}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline"
                    >
                      {message.fileName}
                    </a>
                  </div>
                )}
                <div className="text-xs opacity-75 mt-1">
                  {new Date(message.sentAt).toLocaleTimeString()}
                  {message.isRead && " ✓"}
                </div>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {typingUsers.length > 0 && (
            <div className="text-sm text-gray-500 italic">
              {getTypingText()}
            </div>
          )}
        </div>

        {/* Online Users */}
        {onlineUsers.length > 0 && (
          <div className="text-sm text-gray-600">
            <strong>En línea:</strong>{" "}
            {onlineUsers.map((user) => user.userName).join(", ")}
          </div>
        )}

        {/* Message Input */}
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Escribe tu mensaje..."
            disabled={isSending || !isConnected}
            className="flex-1"
          />

          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.txt"
          />

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending || !isConnected}
          >
            <Upload className="h-4 w-4" />
          </Button>

          <Button
            type="submit"
            disabled={isSending || !newMessage.trim() || !isConnected}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>

        {/* Actions */}
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAsRead}>
              Marcar como leído ({unreadCount})
            </Button>
          )}

          {!isConnected && (
            <Button variant="outline" size="sm" onClick={reconnect}>
              {isReconnecting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Reconectar
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={cleanup}>
            Limpiar chat
          </Button>
        </div>

        {/* Connection Info */}
        {!isOnline && (
          <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
            Sin conexión a internet. Los mensajes se enviarán cuando se restaure
            la conexión.
          </div>
        )}

        {isReconnecting && (
          <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
            Reconectando al chat...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
