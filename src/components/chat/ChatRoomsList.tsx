'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  MessageCircle, 
  Search, 
  Clock, 
  Video,
  Phone,
  MoreHorizontal,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ChatRoom {
  id: string;
  appointmentId: string;
  isActive: boolean;
  type: 'CONSULTATION' | 'FOLLOW_UP';
  createdAt: Date;
  updatedAt: Date;
  unreadCount: number;
  lastMessage?: {
    id: string;
    content: string;
    type: string;
    createdAt: Date;
    sender: {
      name: string;
    };
  };
  appointment: {
    id: string;
    patientId: string;
    doctorId: string;
    scheduledAt: Date;
    status: string;
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

interface ChatRoomsListProps {
  onRoomSelect: (roomId: string) => void;
  selectedRoomId?: string;
}

export const ChatRoomsList: React.FC<ChatRoomsListProps> = ({ 
  onRoomSelect, 
  selectedRoomId 
}) => {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<ChatRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { data: session } = useSession();

  // Load chat rooms
  useEffect(() => {
    const loadChatRooms = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/chat/rooms');
        
        if (response.ok) {
          const data = await response.json();
          setRooms(data.rooms || []);
        } else {
          toast.error('Failed to load chat rooms');
        }
      } catch (_error) {
      toast.error('Error al cargar las salas de chat');
    } finally {
        setIsLoading(false);
      }
    };

    loadChatRooms();
  }, []);

  // Filter rooms based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredRooms(rooms);
    } else {
      const filtered = rooms.filter(room => {
        const otherParticipant = room.appointment.patient.id === session?.user?.id 
          ? room.appointment.doctor.user 
          : room.appointment.patient;
        
        return otherParticipant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
               otherParticipant.email.toLowerCase().includes(searchQuery.toLowerCase());
      });
      setFilteredRooms(filtered);
    }
  }, [rooms, searchQuery, session?.user?.id]);



  if (isLoading) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading chats...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2">
          <MessageCircle className="h-5 w-5" />
          <span>Chats</span>
          <Badge variant="secondary">{filteredRooms.length}</Badge>
        </CardTitle>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>
      
      <Separator />
      
      {/* Rooms List */}
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full">
          {filteredRooms.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              {searchQuery ? 'No chats found' : 'No active chats'}
            </div>
          ) : (
            <div className="divide-y">
              {filteredRooms.map((room) => {
                const otherParticipant = room.appointment.patient.id === session?.user?.id 
                  ? room.appointment.doctor.user 
                  : room.appointment.patient;
                
                const isSelected = selectedRoomId === room.id;
                
                return (
                  <div
                    key={room.id}
                    className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                      isSelected ? 'bg-muted' : ''
                    }`}
                    onClick={() => onRoomSelect(room.id)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="relative">
                        <Avatar>
                          <AvatarImage src={otherParticipant.image} alt={`${otherParticipant.name} profile picture`} />
                          <AvatarFallback>
                            {otherParticipant.name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        
                        {/* Online status indicator */}
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium truncate">
                            {otherParticipant.name}
                          </h3>
                          
                          <div className="flex items-center space-x-1">
                            {room.unreadCount > 0 && (
                              <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                                {room.unreadCount}
                              </Badge>
                            )}
                            
                            <span className="text-xs text-muted-foreground">
                              {room.lastMessage 
                                ? format(new Date(room.lastMessage.createdAt), 'HH:mm', { locale: es })
                                : format(new Date(room.updatedAt), 'HH:mm', { locale: es })
                              }
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between mt-1">
                          <div className="flex-1">
                            {room.lastMessage ? (
                              <p className="text-sm text-muted-foreground truncate">
                                {room.lastMessage.sender.name === session?.user?.name ? 'You: ' : ''}
                                {room.lastMessage.type === 'TEXT' 
                                  ? room.lastMessage.content 
                                  : `📎 ${room.lastMessage.type.toLowerCase()}`
                                }
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                No messages yet
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center space-x-2">
                            <Badge 
                              variant={room.isActive ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {room.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            
                            <Badge variant="outline" className="text-xs">
                              {room.type === 'CONSULTATION' ? 'Consultation' : 'Follow-up'}
                            </Badge>
                            
                            <Badge 
                              variant={room.appointment.status === 'COMPLETED' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {room.appointment.status}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <Video className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <Phone className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Appointment info */}
                        <div className="mt-2 text-xs text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>
                              Appointment: {format(new Date(room.appointment.scheduledAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};