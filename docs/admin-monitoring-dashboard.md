# Admin Monitoring Dashboard

## Overview

The Admin Monitoring Dashboard is a comprehensive real-time monitoring system that provides administrators with complete oversight of platform activities. It includes chat monitoring, video call analytics, payment tracking, and real-time notifications.

## Features

### 1. Real-time Chat Monitoring

- Monitor all active chat conversations
- View message history and participant information
- Admin intervention capabilities with predefined messages
- Real-time message updates
- Activity tracking and statistics

### 2. Video Call Analytics

- Real-time video call statistics and metrics
- Active call monitoring with participant details
- Call history and performance analytics
- Success rate tracking and alerts
- Duration and quality metrics

### 3. Payment Dashboard

- Financial metrics and revenue tracking
- Payment method distribution analytics
- Transaction monitoring and status tracking
- Failure analysis and alerts
- Real-time payment updates

### 4. Admin Notification System

- Real-time notifications for platform events
- Categorized notifications (chat, payment, video, system)
- Unread count tracking and management
- Toast notifications for immediate alerts
- Notification history and read status

### 5. Security and Access Control

- Admin role verification
- Secure authentication and authorization
- Audit logging for admin actions
- Data privacy protection
- Rate limiting and abuse prevention

## Architecture

### Database Schema

#### Admin Monitoring Notifications

```sql
CREATE TABLE admin_monitoring_notifications (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('CHAT', 'PAYMENT', 'VIDEO_CALL', 'SYSTEM')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  isRead BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

#### Admin Actions (Audit Log)

```sql
CREATE TABLE admin_actions (
  id TEXT PRIMARY KEY,
  adminId TEXT NOT NULL,
  actionType TEXT NOT NULL,
  targetId TEXT,
  targetType TEXT,
  details JSONB,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

#### Enhanced Chat Messages

```sql
ALTER TABLE chat_messages ADD COLUMN senderType TEXT DEFAULT 'USER'
CHECK (senderType IN ('USER', 'SYSTEM', 'ADMIN'));
```

### Real-time Architecture

The system uses Supabase Realtime for live updates:

1. **Admin Notifications Channel**: Handles notification creation and updates
2. **Chat Monitoring Channel**: Tracks chat messages and room changes
3. **Video Analytics Channel**: Monitors video session changes
4. **Payment Dashboard Channel**: Tracks payment status updates

### Component Structure

```
components/admin/
├── notification-bell.tsx          # Notification dropdown component
├── chat-monitoring.tsx            # Chat monitoring interface
├── video-call-analytics.tsx       # Video analytics dashboard
├── payment-dashboard.tsx          # Payment monitoring dashboard
├── connection-status.tsx          # Real-time connection status
├── admin-guard.tsx               # Authentication guard
└── lazy-monitoring-tabs.tsx      # Lazy-loaded components

hooks/
├── use-admin-notifications.ts     # Notification management hook
├── use-realtime-connection.ts     # Connection management hook
└── use-debounced-value.ts         # Performance optimization hook

lib/
└── admin-auth.ts                  # Admin authentication utilities
```

## Usage

### Setting Up the Dashboard

1. **Database Migration**: Apply the database schema changes

```bash
npx prisma migrate dev --name add_admin_monitoring_schema
```

2. **Environment Variables**: Ensure Supabase credentials are configured

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

3. **Admin User Setup**: Ensure at least one user has ADMIN role

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'admin@example.com';
```

### Accessing the Dashboard

1. Navigate to `/admin`
2. Authenticate with admin credentials
3. Access monitoring features through the tab navigation

### Using Monitoring Features

#### Chat Monitoring

1. Select the "Chat" tab
2. View active chat rooms in the left panel
3. Click on a room to view messages
4. Use intervention buttons to send admin messages

#### Video Analytics

1. Select the "Video" tab
2. View real-time statistics in the top cards
3. Monitor active calls in the left panel
4. Review call history in the right panel

#### Payment Dashboard

1. Select the "Payments" tab
2. View financial metrics in the top cards
3. Monitor payment methods distribution
4. Review recent transactions

#### Notifications

1. Click the bell icon in the header
2. View unread notifications
3. Click notifications to mark as read
4. Use "Mark all read" for bulk actions

## Performance Optimizations

### Lazy Loading

- Monitoring components are lazy-loaded for better initial performance
- Suspense boundaries provide loading states
- Code splitting reduces bundle size

### Real-time Optimizations

- Debounced updates prevent UI thrashing
- Efficient state management minimizes re-renders
- Connection resilience with automatic retry logic

### Memory Management

- Proper cleanup of real-time subscriptions
- Efficient data structures for large datasets
- Virtual scrolling for long lists

## Security Considerations

### Authentication

- Admin role verification on every request
- Secure session management
- Automatic logout on role changes

### Data Protection

- Sensitive information masking in displays
- Audit logging for all admin actions
- Rate limiting for admin operations

### Access Control

- Row Level Security (RLS) policies
- API endpoint protection
- Client-side route guards

## Testing

### Unit Tests

```bash
npm test -- __tests__/admin/
```

### Integration Tests

```bash
npm run test:integration
```

### E2E Tests

```bash
npm run test:e2e -- --spec="admin-monitoring"
```

## Monitoring and Alerts

### Connection Status

- Real-time connection monitoring
- Automatic reconnection with exponential backoff
- Visual indicators for connection issues

### Performance Metrics

- Component render times
- Real-time update latency
- Memory usage tracking

### Error Handling

- Graceful degradation on connection loss
- Error boundaries for component failures
- Comprehensive error logging

## Troubleshooting

### Common Issues

1. **Connection Problems**

   - Check Supabase credentials
   - Verify network connectivity
   - Review browser console for errors

2. **Permission Errors**

   - Verify admin role assignment
   - Check RLS policies
   - Review authentication status

3. **Performance Issues**
   - Monitor real-time subscription count
   - Check for memory leaks
   - Review component re-render frequency

### Debug Mode

Enable debug logging:

```javascript
localStorage.setItem("admin-debug", "true");
```

## API Reference

### Admin Notifications Hook

```typescript
const {
  notifications,
  unreadCount,
  isLoading,
  error,
  markAsRead,
  markAllAsRead,
  createNotification,
  refresh,
} = useAdminNotifications();
```

### Real-time Connection Hook

```typescript
const {
  channel,
  connectionStatus,
  retryCount,
  reconnect,
  isConnected,
  isConnecting,
  hasError,
} = useRealtimeConnection({
  channelName: "admin-monitoring",
  maxRetries: 5,
  retryDelay: 1000,
});
```

## Contributing

1. Follow the existing code structure
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Ensure security best practices
5. Test real-time functionality thoroughly

## License

This admin monitoring dashboard is part of the Medica Movil platform and follows the same licensing terms.
