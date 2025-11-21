# Supabase Realtime and Row Level Security Setup

This document describes the configuration of Supabase Realtime and Row Level Security (RLS) for the chat system implementation.

## Overview

The setup includes:

- **Realtime Configuration**: Enables real-time subscriptions on chat tables
- **Row Level Security**: Comprehensive access control policies
- **Storage Configuration**: Secure file storage for chat attachments
- **Helper Functions**: Utility functions for chat operations
- **Performance Optimization**: Indexes and triggers for optimal performance

## Files Created

### Migration File

- `supabase/migrations/20241210_configure_realtime_and_rls.sql` - Complete SQL migration

### Setup Scripts

- `scripts/setup-realtime-rls.ts` - Applies migration and verifies configuration
- `scripts/test-rls-policies.ts` - Tests RLS policies with different user roles

### Documentation

- `docs/realtime-rls-setup.md` - This documentation file

## Quick Setup

### 1. Prerequisites

Ensure you have the following environment variables configured:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 2. Run Setup

Execute the setup script to apply the migration:

```bash
npm run setup:realtime
```

This will:

- Apply the SQL migration
- Verify Realtime configuration
- Check RLS policies
- Validate storage bucket setup
- Confirm helper functions and triggers

### 3. Test Configuration

Run the RLS policy tests to ensure proper access control:

```bash
npm run test:rls
```

This creates test users and verifies that:

- Patients can only access their own chat rooms
- Doctors can only access their assigned chat rooms
- Admins can access all chat rooms
- Unauthorized users cannot access restricted data

## Configuration Details

### Realtime Tables

The following tables are enabled for Supabase Realtime:

- `chat_rooms` - Chat room management
- `chat_messages` - Real-time messaging
- `notifications` - Live notifications
- `video_sessions` - Video call sessions
- `video_session_participants` - Video call participants

### Row Level Security Policies

#### Chat Rooms

- **View**: Users can see rooms for their appointments
- **Create**: Users can create rooms for their appointments
- **Update**: Users can modify their own rooms
- **Admin Override**: Admins can access all rooms

#### Chat Messages

- **View**: Users can see messages in their rooms
- **Insert**: Users can send messages to their rooms
- **Update**: Users can mark messages as read
- **Delete**: Users can delete their own messages

#### Notifications

- **View**: Users see only their notifications
- **Create**: System/admins can create notifications
- **Update**: Users can mark notifications as read

#### Video Sessions

- **View/Create/Update**: Users can manage sessions in their rooms
- **Admin Override**: Admins have full access

#### Medical Files

- **View**: Users can see files from their appointments
- **Upload**: Users can upload files to their appointments
- **Manage**: Users can update/delete their uploads

### Storage Configuration

#### Chat Files Bucket

- **Bucket ID**: `chat-files`
- **Public Access**: Disabled (private)
- **File Size Limit**: 50MB
- **Allowed Types**: Images, documents, audio, video
- **Access Control**: RLS policies enforce room-based access

#### Storage Policies

- **Upload**: Users can upload to their chat rooms
- **Download**: Users can access files from their rooms
- **Management**: Users can manage their uploaded files

### Helper Functions

#### `has_chat_room_access(room_id, user_id)`

Checks if a user has access to a specific chat room.

```sql
SELECT has_chat_room_access('room-uuid', 'user-uuid');
```

#### `get_unread_message_count(user_id, room_id?)`

Returns unread message count for a user.

```sql
-- All unread messages for user
SELECT get_unread_message_count('user-uuid');

-- Unread messages in specific room
SELECT get_unread_message_count('user-uuid', 'room-uuid');
```

#### `mark_messages_as_read(room_id, user_id)`

Marks all unread messages in a room as read for a user.

```sql
SELECT mark_messages_as_read('room-uuid', 'user-uuid');
```

### Triggers and Automation

#### New Message Notifications

- **Trigger**: `trigger_notify_new_message`
- **Function**: `notify_new_message()`
- **Purpose**: Automatically creates notifications for new messages

#### Chat Room Activity

- **Trigger**: `trigger_update_chat_room_activity`
- **Function**: `update_chat_room_activity()`
- **Purpose**: Updates room timestamps on new messages

### Performance Optimizations

#### Database Indexes

- Chat room lookups by appointment, patient, doctor
- Message queries by room and timestamp
- Notification queries by user and read status
- Composite indexes for common query patterns

#### Query Optimization

- Efficient RLS policy queries
- Proper foreign key relationships
- Optimized helper function implementations

## Security Features

### Access Control

- **Role-Based**: Different permissions for patients, doctors, admins
- **Appointment-Based**: Access tied to appointment participation
- **File Security**: Storage access controlled by room membership

### Data Protection

- **Encryption**: All data encrypted in transit and at rest
- **Audit Logging**: Administrative actions are logged
- **Input Validation**: Server-side validation for all inputs
- **File Scanning**: Uploaded files can be scanned for security

### Privacy Compliance

- **Data Isolation**: Users can only access their own data
- **Retention Policies**: Configurable message retention
- **Deletion Rights**: Users can delete their own content

## Troubleshooting

### Common Issues

#### Migration Fails

```bash
# Check Supabase connection
npm run setup:realtime

# Verify environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY
```

#### RLS Tests Fail

```bash
# Run individual test components
npm run test:rls

# Check user creation and permissions
# Verify appointment and chat room relationships
```

#### Realtime Not Working

```bash
# Verify table publication
SELECT * FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';

# Check client connection
# Ensure proper authentication
```

#### Storage Access Issues

```bash
# Verify bucket exists
# Check storage policies
# Confirm file path structure
```

### Debug Commands

#### Check RLS Status

```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('chat_rooms', 'chat_messages');
```

#### List Policies

```sql
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename LIKE 'chat_%';
```

#### Verify Functions

```sql
SELECT proname, prosrc
FROM pg_proc
WHERE proname LIKE '%chat%';
```

## Next Steps

After successful setup:

1. **Implement ChatService**: Create the service layer for chat operations
2. **Build React Hooks**: Develop useChat hook for real-time functionality
3. **Create UI Components**: Build chat interface components
4. **Add File Upload**: Implement file sharing functionality
5. **Test Integration**: Verify end-to-end chat functionality

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review Supabase documentation for RLS and Realtime
3. Verify environment configuration
4. Test with minimal examples before full implementation

## Security Notes

- Never expose service role keys in client-side code
- Always use RLS policies for data access control
- Regularly audit access logs and permissions
- Keep Supabase client libraries updated
- Monitor for unusual access patterns
