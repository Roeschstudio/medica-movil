import { NextRequest } from 'next/server';
import { Server as NetServer } from 'http';
import { Server as ServerIO } from 'socket.io';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/unified-auth';
import { prisma } from '@/lib/db';

interface AuthenticatedSocket {
  userId: string;
  userRole: string;
  userName: string;
}

interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  type: 'TEXT' | 'FILE' | 'IMAGE' | 'VIDEO' | 'AUDIO';
  fileUrl?: string;
  fileName?: string;
  createdAt: Date;
  sender: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
}

interface VideoSignal {
  roomId: string;
  signal: any;
  from: string;
  to: string;
}

interface NotificationData {
  type: 'MESSAGE' | 'VIDEO_CALL' | 'APPOINTMENT' | 'PAYMENT';
  title: string;
  message: string;
  userId: string;
  data?: any;
}

let io: ServerIO | null = null;

export async function GET() {
  if (!io) {
    console.log('Initializing Socket.IO server...');
    
    // Create HTTP server for Socket.IO
    const httpServer = new NetServer();
    
    io = new ServerIO(httpServer, {
      path: '/api/socketio',
      addTrailingSlash: false,
      cors: {
        origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    // Authentication middleware
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        const userId = socket.handshake.auth.userId;
        const userRole = socket.handshake.auth.userRole;
        const userName = socket.handshake.auth.userName;

        if (!userId || !token) {
          return next(new Error('Authentication error'));
        }

        // Verify user exists in database
        const user = await prisma.user.findUnique({
          where: { id: userId }
        });

        if (!user) {
          return next(new Error('User not found'));
        }

        (socket as any).auth = {
          userId,
          userRole: user.role,
          userName: user.name || user.email,
        } as AuthenticatedSocket;

        next();
      } catch (err) {
        console.error('Socket authentication error:', err);
        next(new Error('Authentication error'));
      }
    });

    io.on('connection', (socket) => {
      const auth = (socket as any).auth as AuthenticatedSocket;
      console.log(`User ${auth.userName} connected with socket ${socket.id}`);

      // Join user to their personal room for notifications
      socket.join(`user_${auth.userId}`);

      // Join chat room
      socket.on('join_chat_room', async (roomId: string) => {
        try {
          // Verify user has access to the chat room
          const chatRoom = await prisma.chatRoom.findFirst({
            where: {
              id: roomId,
              appointment: {
                OR: [
                  { patientId: auth.userId },
                  { doctor: { userId: auth.userId } }
                ]
              }
            }
          });

          if (chatRoom) {
            socket.join(roomId);
            socket.emit('joined_chat_room', { roomId, success: true });
            
            // Notify others in the room
            socket.to(roomId).emit('user_joined', {
              userId: auth.userId,
              userName: auth.userName
            });
          } else {
            socket.emit('joined_chat_room', { roomId, success: false, error: 'Access denied' });
          }
        } catch (error) {
          console.error('Error joining chat room:', error);
          socket.emit('joined_chat_room', { roomId, success: false, error: 'Server error' });
        }
      });

      // Leave chat room
      socket.on('leave_chat_room', (roomId: string) => {
        socket.leave(roomId);
        socket.to(roomId).emit('user_left', {
          userId: auth.userId,
          userName: auth.userName
        });
      });

      // Send chat message
      socket.on('send_message', async (messageData: Omit<ChatMessage, 'id' | 'createdAt' | 'sender'>) => {
        try {
          // Verify user has access to the chat room
          const chatRoom = await prisma.chatRoom.findFirst({
            where: {
              id: messageData.roomId,
              appointment: {
                OR: [
                  { patientId: auth.userId },
                  { doctor: { userId: auth.userId } }
                ]
              }
            }
          });

          if (!chatRoom || !chatRoom.isActive) {
            socket.emit('message_error', { error: 'Chat room not accessible' });
            return;
          }

          // Create message in database
          const message = await prisma.chatMessage.create({
            data: {
              roomId: messageData.roomId,
              senderId: auth.userId,
              content: messageData.content,
              type: messageData.type,
              fileUrl: messageData.fileUrl,
              fileName: messageData.fileName,
              isRead: false
            },
            include: {
              sender: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true
                }
              }
            }
          });

          // Update chat room's last activity
          await prisma.chatRoom.update({
            where: { id: messageData.roomId },
            data: { updatedAt: new Date() }
          });

          // Broadcast message to room
          io!.to(messageData.roomId).emit('new_message', message);

          // Send notification to other participants
          const appointment = await prisma.appointment.findFirst({
            where: { id: chatRoom.appointmentId },
            include: {
              patient: true,
              doctor: { include: { user: true } }
            }
          });

          if (appointment) {
            const recipientId = auth.userId === appointment.patientId 
              ? appointment.doctor.userId 
              : appointment.patientId;

            io!.to(`user_${recipientId}`).emit('notification', {
              type: 'MESSAGE',
              title: 'New Message',
              message: `${auth.userName} sent you a message`,
              userId: recipientId,
              data: { roomId: messageData.roomId, messageId: message.id }
            } as NotificationData);
          }
        } catch (error) {
          console.error('Error sending message:', error);
          socket.emit('message_error', { error: 'Failed to send message' });
        }
      });

      // Video call signaling
      socket.on('video_signal', (data: VideoSignal) => {
        socket.to(data.to).emit('video_signal', {
          signal: data.signal,
          from: data.from,
          roomId: data.roomId
        });
      });

      // Video call events
      socket.on('start_video_call', async (data: { roomId: string; sessionId: string }) => {
        try {
          // Update video session status
          await prisma.videoSession.update({
            where: { sessionId: data.sessionId },
            data: { 
              status: 'ACTIVE',
              startedAt: new Date()
            }
          });

          // Notify room participants
          socket.to(data.roomId).emit('video_call_started', {
            sessionId: data.sessionId,
            initiator: auth.userId
          });
        } catch (error) {
          console.error('Error starting video call:', error);
        }
      });

      socket.on('end_video_call', async (data: { roomId: string; sessionId: string }) => {
        try {
          // Update video session status
          await prisma.videoSession.update({
            where: { sessionId: data.sessionId },
            data: { 
              status: 'ENDED',
              endedAt: new Date()
            }
          });

          // Notify room participants
          io!.to(data.roomId).emit('video_call_ended', {
            sessionId: data.sessionId,
            endedBy: auth.userId
          });
        } catch (error) {
          console.error('Error ending video call:', error);
        }
      });

      // Admin monitoring events
      if (auth.userRole === 'ADMIN') {
        socket.join('admin_monitoring');
        
        socket.on('get_active_chats', async () => {
          try {
            const activeChats = await prisma.chatRoom.findMany({
              where: { isActive: true },
              include: {
                appointment: {
                  include: {
                    patient: true,
                    doctor: { include: { user: true } }
                  }
                },
                _count: {
                  select: { messages: true }
                }
              }
            });

            socket.emit('active_chats_data', activeChats);
          } catch (error) {
            console.error('Error fetching active chats:', error);
          }
        });
      }

      // Handle typing indicators
      socket.on('typing_start', (data: { roomId: string }) => {
        socket.to(data.roomId).emit('user_typing', {
          userId: auth.userId,
          userName: auth.userName
        });
      });

      socket.on('typing_stop', (data: { roomId: string }) => {
        socket.to(data.roomId).emit('user_stopped_typing', {
          userId: auth.userId
        });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User ${auth.userName} disconnected`);
      });
    });

    console.log('Socket.IO server initialized successfully');
  }

  return new Response(JSON.stringify({ message: 'Socket.IO server is running' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Socket.IO server instance is managed internally
