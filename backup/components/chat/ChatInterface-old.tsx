'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/lib/socket-context';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  Send, 
  Paperclip, 
  Video, 
  Phone, 
  MoreVertical,
  Clock,
  CheckCheck,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  type: 'TEXT' | 'FILE' | 'IMAGE' | 'VIDEO' | 'AUDIO';
  fileUrl?: string;
  fileName?: string;
  createdAt: Date;
  isRead: boolean;
  sender: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
}

interface ChatRoom {
  id: string;
  appointmentId: string;
  isActive: boolean;
  type: 'CONSULTATION' | 'FOLLOW_UP';
  createdAt: Date;
  updatedAt: Date;
  appointment: {
    id: string;
    patientId: string;
    doctorId: string;
    scheduledAt: Date;
    patient: {
      id: string;
      name: string;
      email: string;
      image?: string;
    };
    doctor: {
      id: string;
      userId: string;
      user: {
        id: string;
        name: string;
        email: string;
        image?: string;
      };
    };
  };
}

interface ChatInterfaceProps {
  roomId: string;
  onClose?: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ roomId, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [roomData, setRoomData] = useState<ChatRoom | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { data: session } = useSession();
  const {
    socket,
    isConnected: socketConnected,
    joinChatRoom,
    leaveChatRoom,
    sendMessage,
    startTyping,
    stopTyping,
    onNewMessage,
    onUserTyping,
    onUserStoppedTyping,
    onUserJoined,
    onUserLeft
  } = useSocket();

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load chat room data and messages
  useEffect(() => {
    const loadChatData = async () => {
      try {
        setIsLoading(true);
        
        // Load room data
        const roomResponse = await fetch(`/api/chat/${roomId}`);
        if (roomResponse.ok) {
          const room = await roomResponse.json();
          setRoomData(room);
        }

        // Load messages
        const messagesResponse = await fetch(`/api/chat/messages?roomId=${roomId}&limit=50`);
        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          setMessages(messagesData.messages || []);
        }
      } catch (error) {
        console.error('Error loading chat data:', error);
        toast.error('Error loading chat');
      } finally {
        setIsLoading(false);
      }
    };

    if (roomId) {
      loadChatData();
    }
  }, [roomId]);

  // Join room when socket connects
  useEffect(() => {
    if (socketConnected && roomId) {
      joinChatRoom(roomId);
      setIsConnected(true);
      
      return () => {
        leaveChatRoom(roomId);
      };
    }
  }, [socketConnected, roomId, joinChatRoom, leaveChatRoom]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // New message handler
    const handleNewMessage = (message: ChatMessage) => {
      setMessages(prev => [...prev, message]);
      scrollToBottom();
    };

    // Typing indicators
    const handleUserTyping = (data: { userId: string; userName: string }) => {
      if (data.userId !== session?.user?.id) {
        setTypingUsers(prev => [...prev.filter(id => id !== data.userId), data.userId]);
      }
    };

    const handleUserStoppedTyping = (data: { userId: string }) => {
      setTypingUsers(prev => prev.filter(id => id !== data.userId));
    };

    // User presence
    const handleUserJoined = (data: { userId: string; userName: string }) => {
      if (data.userId !== session?.user?.id) {
        toast.info(`${data.userName} joined the chat`);
      }
    };

    const handleUserLeft = (data: { userId: string; userName: string }) => {
      if (data.userId !== session?.user?.id) {
        toast.info(`${data.userName} left the chat`);
      }
    };

    onNewMessage(handleNewMessage);
    onUserTyping(handleUserTyping);
    onUserStoppedTyping(handleUserStoppedTyping);
    onUserJoined(handleUserJoined);
    onUserLeft(handleUserLeft);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stopped_typing', handleUserStoppedTyping);
      socket.off('user_joined', handleUserJoined);
      socket.off('user_left', handleUserLeft);
    };
  }, [socket, session?.user?.id, onNewMessage, onUserTyping, onUserStoppedTyping, onUserJoined, onUserLeft]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle typing
  const handleTyping = (value: string) => {
    setNewMessage(value);
    
    if (value.trim() && !isTyping) {
      setIsTyping(true);
      startTyping(roomId);
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      stopTyping(roomId);
    }, 1000);
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !session?.user?.id) return;
    
    const messageData = {
      roomId,
      senderId: session.user.id,
      content: newMessage.trim(),
      type: 'TEXT' as const
    };
    
    sendMessage(messageData);
    setNewMessage('');
    
    // Stop typing
    if (isTyping) {
      setIsTyping(false);
      stopTyping(roomId);
    }
  };

  // Start video call
  const handleVideoCall = async () => {
    try {
      const response = await fetch('/api/video/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId })
      });
      
      if (response.ok) {
        const { sessionId } = await response.json();
        // Navigate to video call page or open video modal
        window.open(`/video-call/${sessionId}`, '_blank');
      }
    } catch (error) {
      console.error('Error starting video call:', error);
      toast.error('Failed to start video call');
    }
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading chat...</span>
        </CardContent>
      </Card>
    );
  }

  const otherParticipant = roomData?.appointment.patient.id === session?.user?.id 
    ? roomData.appointment.doctor.user 
    : roomData?.appointment.patient;

  return (
    <Card className="h-full flex flex-col">
      {/* Chat Header */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar>
              <AvatarImage src={otherParticipant?.image} />
              <AvatarFallback>
                {otherParticipant?.name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">
                {otherParticipant?.name || 'Unknown User'}
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Badge variant={isConnected ? 'default' : 'secondary'}>
                  {isConnected ? 'Connected' : 'Connecting...'}
                </Badge>
                {roomData && (
                  <Badge variant="outline">
                    {roomData.type === 'CONSULTATION' ? 'Consultation' : 'Follow-up'}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleVideoCall}>
              <Video className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm">
              <Phone className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <Separator />
      
      {/* Messages Area */}
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full p-4">
          <div className="space-y-4">
            {messages.map((message) => {
              const isOwnMessage = message.senderId === session?.user?.id;
              
              return (
                <div
                  key={message.id}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] ${isOwnMessage ? 'order-2' : 'order-1'}`}>
                    {!isOwnMessage && (
                      <div className="flex items-center space-x-2 mb-1">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={message.sender.image} />
                          <AvatarFallback className="text-xs">
                            {message.sender.name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground">
                          {message.sender.name}
                        </span>
                      </div>
                    )}
                    
                    <div
                      className={`rounded-lg p-3 ${
                        isOwnMessage
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs opacity-70">
                          {format(new Date(message.createdAt), 'HH:mm', { locale: es })}
                        </span>
                        
                        {isOwnMessage && (
                          <div className="flex items-center space-x-1">
                            {message.isRead ? (
                              <CheckCheck className="h-3 w-3 opacity-70" />
                            ) : (
                              <Clock className="h-3 w-3 opacity-70" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Typing indicator */}
            {typingUsers.length > 0 && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3 max-w-[70%]">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                    <span className="text-xs text-muted-foreground">Typing...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </CardContent>
      
      <Separator />
      
      {/* Message Input */}
      <CardContent className="p-4">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
          <Button type="button" variant="outline" size="sm">
            <Paperclip className="h-4 w-4" />
          </Button>
          
          <Input
            value={newMessage}
            onChange={(e) => handleTyping(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
            disabled={!isConnected}
          />
          
          <Button type="submit" disabled={!newMessage.trim() || !isConnected}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};