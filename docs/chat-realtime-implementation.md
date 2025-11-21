# Real-time Chat Implementation

This document describes the implementation of real-time chat functionality using Supabase for the Medica Movil application.

## Overview

The real-time chat system provides:

- Real-time message delivery using Supabase channels
- Connection status management with automatic reconnection
- Typing indicators using presence tracking
- Message broadcasting with retry logic
- Comprehensive error handling and recovery

## Architecture

### Core Components

1. **Hooks** (`/hooks/`)
   - `use-chat-realtime.ts` - Main real-time chat functionality
   - `use-chat-presence.ts` - User presence and online status
   - `use-chat-connection.ts` - Connection management and health monitoring
   - `use-typing-indicator.ts` - Typing indicators and input integration

2. **Services** (`/lib/`)
   - `chat-broadcast.ts` - Message broadcasting service
   - `chat-api.ts` - Chat API operations
   - `chat-context.tsx` - React context provider

3. **Components** (`/components/`)
   - `chat-example.tsx` - Example implementation

## Features

### Real-time Message Delivery

Messages are delivered in real-time using Supabase's postgres_changes feature:

```typescript
channel.on(
  "postgres_changes",
  {
    event: "INSERT",
    schema: "public",
    table: "chat_messages",
    filter: `chatRoomId=eq.${chatRoomId}`,
  },
  (payload) => {
    const newMessage = payload.new as ChatMessage;
    // Handle new message
  }
);
```

### Connection Management

The system includes robust connection management:

- **Automatic reconnection** with exponential backoff
- **Connection health monitoring** with heartbeat
- **Connection status tracking** (connected, connecting, reconnecting, error)
- **Manual reconnection** capability

### Typing Indicators

Typing indicators use Supabase's presence feature:

```typescript
await channel.track({
  user_id: userId,
  user_name: userName,
  typing: isTyping,
  timestamp: Date.now(),
});
```

Features:

- Auto-stop typing after timeout
- Throttled broadcasts to prevent spam
- Multiple user typing display
- Input field integration

### Message Broadcasting

The broadcast service handles:

- **Reliable message delivery** with retry logic
- **Multiple broadcast types** (message, typing, system, file progress)
- **Queue management** for failed messages
- **Multi-room broadcasting** for admin notifications

## Usage

### Basic Setup

1. **Wrap your app with the ChatProvider:**

```tsx
import { ChatProvider } from "@/lib/chat-context";

function App() {
  return (
    <ChatProvider>
      <YourAppComponents />
    </ChatProvider>
  );
}
```

2. **Use the chat context in components:**

```tsx
import { useChat } from "@/lib/chat-context";

function ChatComponent() {
  const { messages, sendMessage, connectionState, typingUsers, joinChatRoom } =
    useChat();

  // Component implementation
}
```

### Advanced Usage

#### Custom Real-time Hook

```typescript
import { useChatRealtime } from "@/hooks/use-chat-realtime";

const { messages, sendMessage, connectionStatus, reconnect } = useChatRealtime({
  chatRoomId: "room-123",
  userId: "user-456",
  userName: "John Doe",
  onNewMessage: (message) => {
    // Handle new message
  },
  onConnectionStatusChange: (status) => {
    // Handle connection changes
  },
});
```

#### Typing Indicator Integration

```typescript
import { useTypingInput } from '@/hooks/use-typing-indicator'

const { handleInputChange, handleInputBlur, handleSubmit } = useTypingInput(
  chatRoomId,
  userId,
  userName,
  { debounceMs: 1000 }
)

// In your input component
<input
  onChange={(e) => {
    setMessage(e.target.value)
    handleInputChange(e.target.value)
  }}
  onBlur={handleInputBlur}
/>
```

#### Connection Monitoring

```typescript
import { useChatConnection } from "@/hooks/use-chat-connection";

const { connectionState, metrics, reconnect, getHealthScore } =
  useChatConnection({
    chatRoomId,
    userId,
    maxReconnectAttempts: 5,
    onConnectionChange: (state) => {
      console.log("Connection state:", state.status);
    },
  });
```

## Database Schema

The chat system uses these Prisma models:

```prisma
model ChatRoom {
  id            String        @id @default(cuid())
  appointmentId String        @unique
  patientId     String
  doctorId      String
  isActive      Boolean       @default(true)
  startedAt     DateTime      @default(now())
  endedAt       DateTime?
  messages      ChatMessage[]
  videoSessions VideoSession[]
}

model ChatMessage {
  id         String      @id @default(cuid())
  chatRoomId String
  senderId   String
  content    String?
  messageType MessageType @default(TEXT)
  fileUrl    String?
  fileName   String?
  fileSize   Int?
  isRead     Boolean     @default(false)
  sentAt     DateTime    @default(now())
}
```

## Error Handling

The system includes comprehensive error handling:

### Connection Errors

- Automatic reconnection with exponential backoff
- Connection health monitoring
- Graceful degradation when offline

### Message Delivery Errors

- Retry logic for failed sends
- Message queuing for offline periods
- Delivery confirmation tracking

### Presence Errors

- Heartbeat monitoring
- Automatic presence cleanup
- Fallback for presence failures

## Performance Considerations

### Optimization Features

- **Message pagination** to limit memory usage
- **Connection pooling** for database efficiency
- **Throttled broadcasts** to prevent spam
- **Efficient subscriptions** with proper cleanup

### Monitoring

- Connection health scoring
- Performance metrics tracking
- Error rate monitoring
- Usage analytics

## Testing

The implementation includes comprehensive tests:

```bash
# Run chat tests
npm test __tests__/chat-realtime.test.ts
```

Test coverage includes:

- Real-time message delivery
- Connection management
- Typing indicators
- Presence tracking
- Error handling
- Integration scenarios

## Configuration

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Supabase Setup

1. **Enable Realtime** for the chat_messages table
2. **Configure RLS policies** for proper access control
3. **Set up presence** for typing indicators

## Security

### Row Level Security (RLS)

Implement RLS policies to ensure users can only access their own chat rooms:

```sql
-- Chat rooms policy
CREATE POLICY "Users can only access their own chat rooms" ON chat_rooms
FOR ALL USING (
  auth.uid()::text = patient_id OR
  auth.uid()::text = doctor_id
);

-- Chat messages policy
CREATE POLICY "Users can only access messages in their chat rooms" ON chat_messages
FOR ALL USING (
  chat_room_id IN (
    SELECT id FROM chat_rooms
    WHERE patient_id = auth.uid()::text
    OR doctor_id = auth.uid()::text
  )
);
```

### Data Validation

- Input sanitization for message content
- File type and size validation
- Rate limiting for message sending
- Authentication verification

## Troubleshooting

### Common Issues

1. **Connection Failures**
   - Check Supabase credentials
   - Verify network connectivity
   - Review browser console for errors

2. **Messages Not Appearing**
   - Verify RLS policies
   - Check subscription status
   - Confirm chat room access

3. **Typing Indicators Not Working**
   - Ensure presence is enabled
   - Check channel subscription
   - Verify user permissions

### Debug Tools

The system provides debug information:

```typescript
// Connection status
console.log(connectionState);

// Broadcast service status
console.log(chatBroadcastService.getConnectionStatus());

// Queue status
console.log(chatBroadcastService.getQueueStatus());
```

## Future Enhancements

Planned improvements:

- Message encryption for sensitive data
- File sharing with progress tracking
- Voice message support
- Message reactions and threading
- Advanced moderation tools
- Analytics dashboard

## Support

For issues or questions:

1. Check the troubleshooting section
2. Review test files for usage examples
3. Consult Supabase documentation for real-time features
4. Contact the development team
