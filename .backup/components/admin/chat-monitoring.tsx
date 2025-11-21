"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  MessageCircle,
  Send,
  Stethoscope,
  User,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface ChatRoom {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  isActive: boolean;
  startedAt: string;
  endedAt?: string;
  messageCount: number;
  lastMessage?: string;
  lastMessageAt?: string;
  appointment: {
    doctor: {
      user: {
        name: string;
      };
    };
    patient: {
      name: string;
    };
  };
}

interface ChatMessage {
  id: string;
  chatRoomId: string;
  senderId: string;
  content: string;
  messageType: "TEXT" | "FILE" | "IMAGE" | "VIDEO" | "AUDIO";
  senderType: "USER" | "SYSTEM" | "ADMIN";
  fileUrl?: string;
  fileName?: string;
  isRead: boolean;
  sentAt: string;
  sender: {
    name: string;
    role: "PATIENT" | "DOCTOR" | "ADMIN";
  };
}

interface ChatMonitoringState {
  chatRooms: ChatRoom[];
  selectedRoom: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isLoadingMessages: boolean;
  error: string | null;
}

const ADMIN_INTERVENTION_MESSAGES = [
  {
    id: "quality_reminder",
    title: "Quality Reminder",
    message:
      "🔔 Admin Notice: Please maintain professional communication standards during this consultation.",
  },
  {
    id: "technical_support",
    title: "Technical Support",
    message:
      "🛠️ Admin Notice: If you are experiencing technical difficulties, please contact our support team.",
  },
  {
    id: "consultation_reminder",
    title: "Consultation Reminder",
    message:
      "⏰ Admin Notice: Please focus on the medical consultation. Keep the conversation relevant to the appointment.",
  },
  {
    id: "privacy_reminder",
    title: "Privacy Reminder",
    message:
      "🔒 Admin Notice: Remember to protect patient privacy and avoid sharing sensitive information in chat.",
  },
];

export function ChatMonitoring() {
  const [state, setState] = useState<ChatMonitoringState>({
    chatRooms: [],
    selectedRoom: null,
    messages: [],
    isLoading: true,
    isLoadingMessages: false,
    error: null,
  });

  const supabase = createClient();

  // Load chat rooms with statistics
  const loadChatRooms = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Get chat rooms with appointment and user data
      const { data: rooms, error: roomsError } = await supabase
        .from("chat_rooms")
        .select(
          `
          id,
          appointmentId,
          patientId,
          doctorId,
          isActive,
          startedAt,
          endedAt,
          appointment:appointments(
            doctor:doctors(
              user:users(name)
            ),
            patient:users!appointments_patientId_fkey(name)
          )
        `
        )
        .order("startedAt", { ascending: false })
        .limit(50);

      if (roomsError) throw roomsError;

      // Get message counts and last messages for each room
      const roomsWithStats = await Promise.all(
        (rooms || []).map(async (room) => {
          const { data: messages, error: messagesError } = await supabase
            .from("chat_messages")
            .select("id, content, sentAt")
            .eq("chatRoomId", room.id)
            .order("sentAt", { ascending: false })
            .limit(1);

          if (messagesError) {
            console.error(
              "Error loading messages for room:",
              room.id,
              messagesError
            );
          }

          const { count } = await supabase
            .from("chat_messages")
            .select("id", { count: "exact" })
            .eq("chatRoomId", room.id);

          const lastMessage = messages?.[0];

          return {
            ...room,
            messageCount: count || 0,
            lastMessage: lastMessage?.content,
            lastMessageAt: lastMessage?.sentAt,
          };
        })
      );

      setState((prev) => ({
        ...prev,
        chatRooms: roomsWithStats,
        isLoading: false,
      }));
    } catch (error) {
      console.error("Error loading chat rooms:", error);
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error ? error.message : "Failed to load chat rooms",
        isLoading: false,
      }));
    }
  }, [supabase]);

  // Load messages for selected room
  const loadMessages = useCallback(
    async (roomId: string) => {
      try {
        setState((prev) => ({ ...prev, isLoadingMessages: true }));

        const { data: messages, error } = await supabase
          .from("chat_messages")
          .select(
            `
          id,
          chatRoomId,
          senderId,
          content,
          messageType,
          senderType,
          fileUrl,
          fileName,
          isRead,
          sentAt,
          sender:users(name, role)
        `
          )
          .eq("chatRoomId", roomId)
          .order("sentAt", { ascending: true });

        if (error) throw error;

        setState((prev) => ({
          ...prev,
          messages: messages || [],
          isLoadingMessages: false,
        }));
      } catch (error) {
        console.error("Error loading messages:", error);
        setState((prev) => ({
          ...prev,
          isLoadingMessages: false,
        }));
        toast.error("Failed to load messages");
      }
    },
    [supabase]
  );

  // Send admin intervention message
  const sendAdminMessage = useCallback(
    async (roomId: string, message: string) => {
      try {
        // Get admin user (assuming there's an admin user)
        const { data: adminUser } = await supabase
          .from("users")
          .select("id")
          .eq("role", "ADMIN")
          .limit(1)
          .single();

        if (!adminUser) {
          toast.error("Admin user not found");
          return;
        }

        const { error } = await supabase.from("chat_messages").insert({
          chatRoomId: roomId,
          senderId: adminUser.id,
          content: message,
          messageType: "TEXT",
          senderType: "ADMIN",
        });

        if (error) throw error;

        // Log admin action
        await supabase.from("admin_actions").insert({
          adminId: adminUser.id,
          actionType: "CHAT_INTERVENTION",
          targetId: roomId,
          targetType: "CHAT_ROOM",
          details: { message },
        });

        toast.success("Admin message sent successfully");
      } catch (error) {
        console.error("Error sending admin message:", error);
        toast.error("Failed to send admin message");
      }
    },
    [supabase]
  );

  // Select chat room
  const selectRoom = useCallback(
    (roomId: string) => {
      setState((prev) => ({ ...prev, selectedRoom: roomId }));
      loadMessages(roomId);
    },
    [loadMessages]
  );

  // Set up real-time subscriptions
  useEffect(() => {
    loadChatRooms();

    // Subscribe to chat room changes
    const roomChannel = supabase
      .channel("admin-chat-rooms")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_rooms",
        },
        () => {
          loadChatRooms();
        }
      )
      .subscribe();

    // Subscribe to message changes
    const messageChannel = supabase
      .channel("admin-chat-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        (payload) => {
          const newMessage = payload.new;

          // Update message count for the room
          setState((prev) => ({
            ...prev,
            chatRooms: prev.chatRooms.map((room) =>
              room.id === newMessage.chatRoomId
                ? {
                    ...room,
                    messageCount: room.messageCount + 1,
                    lastMessage: newMessage.content,
                    lastMessageAt: newMessage.sentAt,
                  }
                : room
            ),
          }));

          // If this message is for the selected room, add it to messages
          if (newMessage.chatRoomId === state.selectedRoom) {
            loadMessages(newMessage.chatRoomId);
          }
        }
      )
      .subscribe();

    return () => {
      roomChannel.unsubscribe();
      messageChannel.unsubscribe();
    };
  }, [supabase, loadChatRooms, loadMessages, state.selectedRoom]);

  const selectedRoomData = state.chatRooms.find(
    (room) => room.id === state.selectedRoom
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
      {/* Chat Rooms List */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Active Chat Rooms
            <Badge variant="secondary">{state.chatRooms.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {state.isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
            </div>
          ) : state.error ? (
            <div className="p-4 text-center text-red-500">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
              <p>{state.error}</p>
            </div>
          ) : state.chatRooms.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No active chat rooms</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-1 p-2">
                {state.chatRooms.map((room) => (
                  <div
                    key={room.id}
                    className={cn(
                      "p-3 rounded-lg cursor-pointer transition-colors border",
                      state.selectedRoom === room.id
                        ? "bg-blue-50 border-blue-200"
                        : "hover:bg-gray-50 border-transparent"
                    )}
                    onClick={() => selectRoom(room.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <Badge
                          variant={room.isActive ? "default" : "secondary"}
                        >
                          {room.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-500">
                        {room.messageCount} messages
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-sm">
                        <Stethoscope className="h-3 w-3 text-blue-500" />
                        <span className="font-medium">
                          Dr. {room.appointment.doctor.user.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <User className="h-3 w-3 text-green-500" />
                        <span>{room.appointment.patient.name}</span>
                      </div>
                    </div>

                    {room.lastMessage && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-600 truncate">
                          {room.lastMessage}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3 text-gray-400" />
                          <span className="text-xs text-gray-400">
                            {room.lastMessageAt &&
                              formatDistanceToNow(
                                new Date(room.lastMessageAt),
                                { addSuffix: true }
                              )}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Chat Messages and Intervention */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              {selectedRoomData ? (
                <span>
                  Dr. {selectedRoomData.appointment.doctor.user.name} &{" "}
                  {selectedRoomData.appointment.patient.name}
                </span>
              ) : (
                "Select a chat room"
              )}
            </div>
            {selectedRoomData && (
              <Badge
                variant={selectedRoomData.isActive ? "default" : "secondary"}
              >
                {selectedRoomData.isActive ? "Active" : "Inactive"}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!state.selectedRoom ? (
            <div className="flex items-center justify-center h-96 text-gray-500">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a chat room to view messages</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Messages */}
              <ScrollArea className="h-80 border rounded-lg p-4">
                {state.isLoadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
                  </div>
                ) : state.messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <p>No messages yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {state.messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          "flex gap-3 p-3 rounded-lg",
                          message.senderType === "ADMIN" &&
                            "bg-red-50 border border-red-200",
                          message.senderType === "SYSTEM" &&
                            "bg-yellow-50 border border-yellow-200",
                          message.senderType === "USER" &&
                            message.sender.role === "DOCTOR" &&
                            "bg-blue-50",
                          message.senderType === "USER" &&
                            message.sender.role === "PATIENT" &&
                            "bg-green-50"
                        )}
                      >
                        <div className="flex-shrink-0">
                          {message.senderType === "ADMIN" && (
                            <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                              <AlertTriangle className="h-4 w-4 text-white" />
                            </div>
                          )}
                          {message.senderType === "SYSTEM" && (
                            <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                              <CheckCircle className="h-4 w-4 text-white" />
                            </div>
                          )}
                          {message.senderType === "USER" &&
                            message.sender.role === "DOCTOR" && (
                              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                                <Stethoscope className="h-4 w-4 text-white" />
                              </div>
                            )}
                          {message.senderType === "USER" &&
                            message.sender.role === "PATIENT" && (
                              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                                <User className="h-4 w-4 text-white" />
                              </div>
                            )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">
                              {message.senderType === "ADMIN"
                                ? "Admin"
                                : message.senderType === "SYSTEM"
                                ? "System"
                                : message.sender.name}
                            </span>
                            <span className="text-xs text-gray-500">
                              {format(new Date(message.sentAt), "HH:mm")}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">
                            {message.content}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Admin Intervention Panel */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Admin Intervention
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ADMIN_INTERVENTION_MESSAGES.map((intervention) => (
                    <Button
                      key={intervention.id}
                      variant="outline"
                      size="sm"
                      className="justify-start text-left h-auto p-3"
                      onClick={() =>
                        sendAdminMessage(
                          state.selectedRoom!,
                          intervention.message
                        )
                      }
                    >
                      <div>
                        <div className="font-medium text-xs">
                          {intervention.title}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {intervention.message}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
