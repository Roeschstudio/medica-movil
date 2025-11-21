# Chat API Fixes and Enhancements

## Overview

This document outlines the fixes and enhancements made to the chat API endpoints to align with the current Prisma schema and improve error handling.

## Issues Fixed

### 1. Schema Field Mismatches

**Problem**: The API endpoints were using incorrect field names that didn't match the Prisma schema.

**Fixes**:

- Changed `roomId` to `chatRoomId` in message operations
- Updated chat room queries to use direct `patientId` and `doctorId` instead of nested appointment queries
- Fixed `createdAt` to `sentAt` for message ordering
- Removed non-existent `type` field from chat room creation

### 2. Import Path Issues

**Problem**: API endpoints were importing from incorrect auth configuration paths.

**Fixes**:

- Updated imports from `@/lib/auth` to `@/lib/auth-config`
- Ensured consistent import paths across all chat endpoints

### 3. Validation and Error Handling

**Problem**: Basic validation with poor error messages and no input sanitization.

**Enhancements**:

- Added comprehensive Zod validation schemas with detailed error messages
- Implemented `safeParse` for better error handling
- Added file size limits (50MB max)
- Added content length limits (5000 characters max)
- Added proper URL validation for file uploads
- Enhanced error responses with validation details

### 4. Database Query Optimizations

**Problem**: Inefficient queries and missing data in responses.

**Enhancements**:

- Added `_count` fields to include message and video session counts
- Optimized chat room queries to reduce database calls
- Added proper pagination limits and validation
- Included sender role information in message responses

## API Endpoints Updated

### 1. `/api/chat/rooms` (POST, GET)

**POST - Create Chat Room**:

- Fixed field mappings for `patientId` and `doctorId`
- Added proper validation for appointment ID format
- Enhanced error messages for better debugging
- Added message count in response

**GET - List Chat Rooms**:

- Added message counts and video session counts
- Improved last message preview with sender information
- Better ordering and filtering

### 2. `/api/chat/messages` (POST, GET)

**POST - Send Message**:

- Fixed `chatRoomId` field mapping
- Added comprehensive file validation
- Enhanced access control checks
- Added file size and type validation

**GET - Get Messages**:

- Fixed pagination parameters with proper limits
- Updated field mappings for `chatRoomId`
- Improved message ordering by `sentAt`
- Enhanced sender information in responses

### 3. `/api/chat/[roomId]` (GET, PATCH, DELETE)

**GET - Get Chat Room Details**:

- Fixed access control queries
- Added message and video session counts
- Enhanced unread message counting

**PATCH - Update Chat Room**:

- Added proper validation for update data
- Fixed `endedAt` field handling with date conversion
- Enhanced authorization checks

**DELETE - Delete Chat Room**:

- Fixed cascade deletion for messages
- Updated field mappings for proper cleanup
- Enhanced authorization checks

## Validation Schemas

### Create Room Schema

```typescript
const createRoomSchema = z.object({
  appointmentId: z.string().cuid("Invalid appointment ID format"),
});
```

### Send Message Schema

```typescript
const sendMessageSchema = z.object({
  chatRoomId: z.string().cuid("Invalid chat room ID format"),
  content: z
    .string()
    .min(1, "Message content is required")
    .max(5000, "Message too long"),
  messageType: z
    .enum(["TEXT", "FILE", "IMAGE", "VIDEO", "AUDIO"])
    .default("TEXT"),
  fileUrl: z.string().url("Invalid file URL").optional(),
  fileName: z.string().max(255, "File name too long").optional(),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(50 * 1024 * 1024, "File too large (max 50MB)")
    .optional(),
});
```

### Update Room Schema

```typescript
const updateRoomSchema = z.object({
  isActive: z.boolean().optional(),
  endedAt: z.string().datetime().optional(),
});
```

## Security Enhancements

1. **Access Control**: Enhanced authorization checks to ensure users can only access their own chat rooms
2. **Input Validation**: Comprehensive validation for all input parameters
3. **File Security**: Added file size limits and URL validation
4. **Rate Limiting Ready**: Validation schemas support rate limiting implementation

## Testing

Created validation scripts to test:

- Schema validation for all endpoints
- Error handling for invalid data
- Field mapping correctness
- Input sanitization

## Next Steps

1. **Real-time Integration**: Implement Supabase real-time subscriptions
2. **File Upload**: Add Supabase Storage integration for file handling
3. **Rate Limiting**: Implement rate limiting for message sending
4. **Monitoring**: Add logging and monitoring for chat operations
5. **Testing**: Add comprehensive integration tests

## Usage Examples

### Create Chat Room

```typescript
POST /api/chat/rooms
{
  "appointmentId": "clx1234567890abcdef"
}
```

### Send Message

```typescript
POST /api/chat/messages
{
  "chatRoomId": "clx1234567890abcdef",
  "content": "Hello, how are you feeling today?",
  "messageType": "TEXT"
}
```

### Send File Message

```typescript
POST /api/chat/messages
{
  "chatRoomId": "clx1234567890abcdef",
  "content": "Here's your prescription",
  "messageType": "FILE",
  "fileUrl": "https://storage.supabase.co/bucket/files/prescription.pdf",
  "fileName": "prescription.pdf",
  "fileSize": 1024000
}
```

### Get Messages

```typescript
GET /api/chat/messages?chatRoomId=clx1234567890abcdef&page=1&limit=50
```

All endpoints now return consistent error responses with proper HTTP status codes and detailed error messages for better debugging and user experience.
