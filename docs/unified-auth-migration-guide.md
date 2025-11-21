# Unified Authentication Migration Guide

## Overview

This document outlines the migration from dual authentication (NextAuth + Supabase) to a unified authentication system using Supabase as the primary authentication provider with Prisma for user management.

## Migration Status

### ✅ Completed Components

#### Core Infrastructure

- `lib/unified-auth.ts` - Unified authentication service
- `lib/unified-auth-context.tsx` - React context for auth state
- `middleware.ts` - Updated to use unified auth with user headers
- `lib/auth-middleware.ts` - Updated API middleware for unified auth
- `components/providers.tsx` - Added unified auth provider
- `lib/socket.ts` - Updated Socket.io authentication

#### UI Components

- `components/main-nav.tsx` - Navigation with unified auth
- `components/chat-interface.tsx` - Chat interface with unified auth
- `components/chat-example.tsx` - Chat example component
- `components/chat-room-list.tsx` - Chat room listing
- `components/chat-room.tsx` - Individual chat room
- `components/notification-badge.tsx` - Notification badge
- `components/notification-center.tsx` - Notification center
- `components/notification-dropdown.tsx` - Notification dropdown
- `components/notification-history.tsx` - Notification history
- `components/notification-preferences.tsx` - Notification preferences
- `components/optimized-chat-room.tsx` - Optimized chat room

### 🔄 In Progress

#### Feature Systems

- Chat System - Partially updated (interface components done)
- Video Call System - Needs verification
- Payment System - Needs verification
- Admin Dashboard - Needs verification

### ⏳ Pending Updates

#### API Routes

- All API routes in `app/api/*` need verification that they work with updated middleware
- Payment webhook handlers
- Admin API endpoints
- Chat API endpoints
- Video call API endpoints

#### Page Components

- Login/Register pages need to use unified auth
- Dashboard pages (admin, doctor, patient)
- Profile pages
- Appointment booking pages

#### Hooks and Utilities

- Custom hooks that use authentication
- Utility functions that check user roles
- Service functions that need user context

## Migration Strategy

### Phase 1: Core Infrastructure ✅ COMPLETED

- Unified authentication service
- React context and providers
- Middleware updates
- Basic component updates

### Phase 2: Feature Integration (Current)

- Update all feature-specific components
- Verify API route compatibility
- Update page components
- Test authentication flows

### Phase 3: Testing and Validation

- End-to-end authentication testing
- Role-based access testing
- Session management testing
- Error handling verification

## Key Changes Made

### Authentication Flow

**Before:**

```typescript
// NextAuth approach
const { data: session } = useSession();
const user = session?.user;
```

**After:**

```typescript
// Unified approach
const { user } = useUnifiedAuth();
```

### API Authentication

**Before:**

```typescript
// Separate Supabase auth check
const {
  data: { user },
  error,
} = await supabase.auth.getUser();
const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
```

**After:**

```typescript
// Unified middleware with headers
const userId = request.headers.get("x-user-id");
const userRole = request.headers.get("x-user-role");
// Fallback to Supabase session if needed
```

### Component Updates

**Before:**

```typescript
import { useSession } from "next-auth/react";
const { data: session } = useSession();
if (!session?.user) return null;
```

**After:**

```typescript
import { useUnifiedAuth } from "@/lib/unified-auth-context";
const { user } = useUnifiedAuth();
if (!user) return null;
```

## Benefits of Unified Authentication

### 1. Simplified Architecture

- Single authentication provider (Supabase)
- Consistent user object across the application
- Reduced complexity in middleware and API routes

### 2. Better Performance

- User info passed via middleware headers
- Reduced database queries for user verification
- Efficient session management

### 3. Enhanced Security

- Consistent RLS policy enforcement
- Unified session validation
- Better audit trail

### 4. Improved Developer Experience

- Single authentication API to learn
- Consistent error handling
- Better TypeScript support

## Testing Checklist

### Authentication Flows

- [ ] User registration
- [ ] User login
- [ ] User logout
- [ ] Session persistence
- [ ] Session expiration

### Role-Based Access

- [ ] Admin dashboard access
- [ ] Doctor dashboard access
- [ ] Patient dashboard access
- [ ] API endpoint authorization
- [ ] Component-level role checks

### Feature Integration

- [ ] Chat system authentication
- [ ] Video call authentication
- [ ] Payment system authentication
- [ ] Admin monitoring authentication
- [ ] Notification system authentication

### Error Handling

- [ ] Invalid session handling
- [ ] Expired token handling
- [ ] Network error recovery
- [ ] Unauthorized access handling

## Rollback Plan

If issues arise, the rollback process involves:

1. Revert middleware.ts to use NextAuth
2. Revert component imports to use NextAuth
3. Revert API middleware to use NextAuth
4. Remove unified auth provider from providers.tsx

The unified auth files can remain as they don't interfere with NextAuth operation.

## Next Steps

1. Complete Task 2.2: Update remaining features
2. Comprehensive testing of all authentication flows
3. Performance monitoring and optimization
4. Documentation updates for development team
