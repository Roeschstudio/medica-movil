'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { SocketProvider } from '@/lib/socket-context';
import { ChatRoomsList } from '@/src/components/chat/ChatRoomsList';
import { ChatInterface } from '@/components/chat/chat-interface';
import { Card, CardContent } from '@/components/ui/card';
import { MessageCircle } from 'lucide-react';

const ChatPage = () => {
  const { status } = useSession();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    redirect('/auth/signin');
  }

  return (
    <SocketProvider>
      <div className="container mx-auto p-4 h-screen">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
          {/* Chat Rooms List */}
          <div className="lg:col-span-1">
            <ChatRoomsList 
              onRoomSelect={setSelectedRoomId}
              selectedRoomId={selectedRoomId || undefined}
            />
          </div>
          
          {/* Chat Interface */}
          <div className="lg:col-span-2">
            {selectedRoomId ? (
              <ChatInterface 
                roomId={selectedRoomId}
                onClose={() => setSelectedRoomId(null)}
              />
            ) : (
              <Card className="h-full">
                <CardContent className="flex flex-col items-center justify-center h-full text-center">
                  <MessageCircle className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Select a Chat</h3>
                  <p className="text-muted-foreground max-w-md">
                    Choose a conversation from the list to start chatting with your doctor or patient.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </SocketProvider>
  );
};

export default ChatPage;