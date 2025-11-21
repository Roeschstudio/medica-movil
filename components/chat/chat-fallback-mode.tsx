"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Download,
  MessageCircle,
  Phone,
  RefreshCw,
  Send,
  WifiOff,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

interface ChatFallbackModeProps {
  chatRoomId: string;
  appointmentId?: string;
  onRetryConnection?: () => void;
  onExportMessages?: () => void;
  className?: string;
}

interface OfflineMessage {
  id: string;
  content: string;
  timestamp: Date;
  type: "note" | "message";
}

export const ChatFallbackMode: React.FC<ChatFallbackModeProps> = ({
  chatRoomId,
  appointmentId,
  onRetryConnection,
  onExportMessages,
  className,
}) => {
  const [offlineMessages, setOfflineMessages] = useState<OfflineMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);

  // Load offline messages from localStorage
  useEffect(() => {
    const storageKey = `chat_fallback_${chatRoomId}`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const messages = JSON.parse(stored);
        setOfflineMessages(
          messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }))
        );
      }
    } catch (error) {
      console.error("Failed to load offline messages:", error);
    }
  }, [chatRoomId]);

  // Save offline messages to localStorage
  const saveOfflineMessages = useCallback(
    (messages: OfflineMessage[]) => {
      const storageKey = `chat_fallback_${chatRoomId}`;
      try {
        localStorage.setItem(storageKey, JSON.stringify(messages));
      } catch (error) {
        console.error("Failed to save offline messages:", error);
      }
    },
    [chatRoomId]
  );

  // Add offline message
  const addOfflineMessage = useCallback(
    (content: string, type: "note" | "message" = "message") => {
      const message: OfflineMessage = {
        id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content,
        timestamp: new Date(),
        type,
      };

      const updatedMessages = [...offlineMessages, message];
      setOfflineMessages(updatedMessages);
      saveOfflineMessages(updatedMessages);

      toast({
        title: "Mensaje guardado",
        description:
          "El mensaje se guardó localmente y se enviará cuando se restaure la conexión.",
        variant: "default",
      });
    },
    [offlineMessages, saveOfflineMessages]
  );

  // Handle send message
  const handleSendMessage = useCallback(() => {
    if (!newMessage.trim()) return;

    addOfflineMessage(newMessage.trim(), "message");
    setNewMessage("");
  }, [newMessage, addOfflineMessage]);

  // Handle retry connection
  const handleRetryConnection = useCallback(async () => {
    if (isRetrying) return;

    setIsRetrying(true);
    try {
      await onRetryConnection?.();
    } finally {
      setIsRetrying(false);
    }
  }, [isRetrying, onRetryConnection]);

  // Export offline messages
  const handleExportMessages = useCallback(() => {
    if (offlineMessages.length === 0) {
      toast({
        title: "No hay mensajes",
        description: "No hay mensajes offline para exportar.",
        variant: "default",
      });
      return;
    }

    try {
      const exportData = {
        chatRoomId,
        appointmentId,
        exportDate: new Date().toISOString(),
        messages: offlineMessages,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chat_offline_messages_${chatRoomId}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Mensajes exportados",
        description: "Los mensajes offline se han descargado correctamente.",
        variant: "default",
      });

      onExportMessages?.();
    } catch (error) {
      console.error("Failed to export messages:", error);
      toast({
        title: "Error al exportar",
        description: "No se pudieron exportar los mensajes.",
        variant: "destructive",
      });
    }
  }, [offlineMessages, chatRoomId, appointmentId, onExportMessages]);

  // Clear offline messages
  const clearOfflineMessages = useCallback(() => {
    setOfflineMessages([]);
    saveOfflineMessages([]);

    toast({
      title: "Mensajes eliminados",
      description: "Se eliminaron todos los mensajes offline.",
      variant: "default",
    });
  }, [saveOfflineMessages]);

  // Add system note
  const addSystemNote = useCallback(
    (content: string) => {
      addOfflineMessage(content, "note");
    },
    [addOfflineMessage]
  );

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <WifiOff className="h-5 w-5 text-destructive" />
            Modo Sin Conexión
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetryConnection}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <>
                <div className="animate-spin h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full" />
                Conectando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reintentar
              </>
            )}
          </Button>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">
                Chat temporalmente no disponible
              </p>
              <p>
                Puedes escribir mensajes que se enviarán automáticamente cuando
                se restaure la conexión. También puedes usar las opciones
                alternativas de comunicación.
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="flex-1 flex flex-col p-0 min-h-0">
        {/* Alternative Communication Options */}
        <div className="p-4 border-b bg-muted/30">
          <h4 className="text-sm font-medium mb-3">
            Opciones alternativas de comunicación
          </h4>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1">
              <Phone className="h-4 w-4 mr-2" />
              Llamar
            </Button>
            <Button variant="outline" size="sm" className="flex-1">
              <MessageCircle className="h-4 w-4 mr-2" />
              SMS
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportMessages}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Offline Messages */}
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-3 py-4">
            {offlineMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <MessageCircle className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No hay mensajes offline. Los mensajes que escribas se
                  guardarán aquí.
                </p>
              </div>
            ) : (
              offlineMessages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "rounded-lg p-3 max-w-[80%]",
                    message.type === "note"
                      ? "bg-blue-50 border border-blue-200 mx-auto text-center"
                      : "bg-primary text-primary-foreground ml-auto"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                  <div className="flex items-center justify-between mt-2 text-xs opacity-70">
                    <span>
                      {message.type === "note"
                        ? "Nota del sistema"
                        : "Mensaje offline"}
                    </span>
                    <span>{message.timestamp.toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Message Input */}
        <div className="border-t p-4">
          <div className="space-y-3">
            <div className="flex gap-2">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Escribe un mensaje que se enviará cuando se restaure la conexión..."
                className="flex-1 min-h-[60px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
                className="self-end"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>
                {offlineMessages.length} mensaje(s) offline guardado(s)
              </span>
              {offlineMessages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearOfflineMessages}
                  className="h-6 px-2 text-xs"
                >
                  Limpiar
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Hook for managing fallback mode
export const useChatFallbackMode = (chatRoomId: string) => {
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<string>("");

  const enableFallbackMode = useCallback((reason: string) => {
    setIsFallbackMode(true);
    setFallbackReason(reason);

    toast({
      title: "Modo sin conexión activado",
      description: reason,
      variant: "destructive",
    });
  }, []);

  const disableFallbackMode = useCallback(() => {
    setIsFallbackMode(false);
    setFallbackReason("");

    toast({
      title: "Conexión restaurada",
      description: "El chat está funcionando normalmente.",
      variant: "default",
    });
  }, []);

  return {
    isFallbackMode,
    fallbackReason,
    enableFallbackMode,
    disableFallbackMode,
  };
};

export default ChatFallbackMode;
