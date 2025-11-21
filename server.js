const { createServer } = require('http');
const { Server } = require('socket.io');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3001;

// Preparar la aplicación Next.js
const app = next({ dev, hostname, port: 3000 });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  });

  // Manejar conexiones de Socket.IO
  io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    // Unirse a una sala de chat
    socket.on('join-room', (roomId, userId) => {
      socket.join(roomId);
      console.log(`Usuario ${userId} se unió a la sala ${roomId}`);
      
      // Notificar a otros usuarios en la sala
      socket.to(roomId).emit('user-joined', userId);
    });

    // Enviar mensaje
    socket.on('send-message', (data) => {
      const { roomId, message, senderId, senderName, timestamp } = data;
      
      // Enviar mensaje a todos en la sala
      io.to(roomId).emit('receive-message', {
        id: Date.now().toString(),
        content: message,
        senderId,
        senderName,
        timestamp,
        roomId
      });
    });

    // Notificación de escritura
    socket.on('typing', (data) => {
      socket.to(data.roomId).emit('user-typing', {
        userId: data.userId,
        userName: data.userName
      });
    });

    socket.on('stop-typing', (data) => {
      socket.to(data.roomId).emit('user-stop-typing', {
        userId: data.userId
      });
    });

    // Llamada de video
    socket.on('video-call-request', (data) => {
      socket.to(data.roomId).emit('incoming-video-call', {
        callerId: data.callerId,
        callerName: data.callerName,
        roomId: data.roomId
      });
    });

    socket.on('video-call-accepted', (data) => {
      socket.to(data.roomId).emit('video-call-accepted', data);
    });

    socket.on('video-call-rejected', (data) => {
      socket.to(data.roomId).emit('video-call-rejected', data);
    });

    // WebRTC signaling
    socket.on('webrtc-offer', (data) => {
      socket.to(data.roomId).emit('webrtc-offer', data);
    });

    socket.on('webrtc-answer', (data) => {
      socket.to(data.roomId).emit('webrtc-answer', data);
    });

    socket.on('webrtc-ice-candidate', (data) => {
      socket.to(data.roomId).emit('webrtc-ice-candidate', data);
    });

    // Desconexión
    socket.on('disconnect', () => {
      console.log('Usuario desconectado:', socket.id);
    });
  });

  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Servidor Socket.IO listo en http://${hostname}:${port}`);
  });
});