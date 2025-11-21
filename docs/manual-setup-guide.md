# Manual Setup Guide for Supabase Realtime and RLS

This guide provides step-by-step instructions for manually applying the Realtime and RLS configuration in Supabase.

## Prerequisites

1. Access to your Supabase project dashboard
2. SQL Editor access in Supabase
3. Service role key for your project

## Step 1: Apply the Migration

### Option A: Using Supabase SQL Editor (Recommended)

1. **Open Supabase Dashboard**

   - Go to your project at [supabase.com](https://supabase.com)
   - Navigate to the SQL Editor

2. **Execute Migration**

   - Copy the contents of `supabase/migrations/20241210_configure_realtime_and_rls.sql`
   - Paste into the SQL Editor
   - Click "Run" to execute the migration

3. **Verify Execution**
   - Check for any error messages
   - All statements should execute successfully

### Option B: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
# Initialize Supabase (if not already done)
supabase init

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Apply the migration
supabase db push
```

## Step 2: Verify Configuration

### Using SQL Editor

1. **Copy Verification Script**

   - Copy the contents of `scripts/verify-realtime-setup.sql`
   - Paste into the SQL Editor
   - Run the script

2. **Review Results**
   - Check that all tables show "Realtime Enabled"
   - Verify RLS is enabled on all chat tables
   - Confirm policies, functions, and triggers are created

### Expected Results

The verification script should show:

- ✅ 5 tables enabled for Realtime
- ✅ 6 tables with RLS enabled
- ✅ 20+ RLS policies created
- ✅ 3 helper functions created
- ✅ 2 triggers created
- ✅ 10+ performance indexes created
- ✅ chat-files bucket configured

## Step 3: Configure Storage Bucket

### Manual Bucket Creation (if needed)

If the storage bucket wasn't created automatically:

1. **Go to Storage**

   - Navigate to Storage in your Supabase dashboard
   - Click "Create bucket"

2. **Configure Bucket**

   - **Name**: `chat-files`
   - **Public**: Disabled (unchecked)
   - **File size limit**: 52428800 (50MB)
   - **Allowed MIME types**:
     ```
     image/jpeg, image/png, image/gif, image/webp,
     application/pdf, application/msword,
     application/vnd.openxmlformats-officedocument.wordprocessingml.document,
     text/plain, video/mp4, video/webm,
     audio/mpeg, audio/wav, audio/webm
     ```

3. **Apply Storage Policies**
   - The RLS policies for storage should be automatically applied
   - Verify in the Storage policies section

## Step 4: Test Configuration

### Basic Functionality Test

Run this SQL to test basic functionality:

```sql
-- Test helper function
SELECT has_chat_room_access(
  '00000000-0000-0000-0000-000000000000'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid
) as function_test;

-- Test RLS policies (should return empty result for non-existent user)
SELECT * FROM chat_rooms LIMIT 1;

-- Test Realtime publication
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'chat_messages';
```

### Application Integration Test

1. **Update Environment Variables**

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

2. **Test Realtime Connection**

   ```javascript
   import { createClient } from "@supabase/supabase-js";

   const supabase = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL,
     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
   );

   // Test realtime subscription
   const channel = supabase
     .channel("test-channel")
     .on(
       "postgres_changes",
       {
         event: "INSERT",
         schema: "public",
         table: "chat_messages",
       },
       (payload) => {
         console.log("New message:", payload);
       }
     )
     .subscribe();
   ```

## Step 5: Troubleshooting

### Common Issues

#### Migration Errors

**Error**: "relation already exists"

- **Solution**: This is normal for existing tables, continue with migration

**Error**: "permission denied"

- **Solution**: Ensure you're using the service role key or have proper permissions

#### RLS Policy Issues

**Error**: "new row violates row-level security policy"

- **Solution**: Check that users have proper roles and appointment relationships

**Error**: "insufficient privilege"

- **Solution**: Verify RLS policies allow the intended access patterns

#### Realtime Issues

**Error**: "table not found in publication"

- **Solution**: Re-run the ALTER PUBLICATION commands for the affected tables

**Error**: "connection failed"

- **Solution**: Check Supabase project status and API keys

#### Storage Issues

**Error**: "bucket not found"

- **Solution**: Manually create the chat-files bucket as described above

**Error**: "file upload failed"

- **Solution**: Check storage policies and bucket configuration

### Debug Commands

#### Check Table Status

```sql
-- Check if tables exist
SELECT tablename FROM pg_tables
WHERE tablename LIKE 'chat_%' AND schemaname = 'public';

-- Check RLS status
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('chat_rooms', 'chat_messages')
  AND schemaname = 'public';
```

#### Check Realtime Status

```sql
-- Check publication
SELECT * FROM pg_publication WHERE pubname = 'supabase_realtime';

-- Check published tables
SELECT * FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename LIKE 'chat_%';
```

#### Check Policies

```sql
-- List all chat-related policies
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename LIKE 'chat_%'
ORDER BY tablename, policyname;
```

#### Check Functions

```sql
-- List helper functions
SELECT proname, prosrc FROM pg_proc
WHERE proname LIKE '%chat%' OR proname LIKE '%message%';
```

## Step 6: Next Steps

After successful setup:

1. **Implement ChatService**: Create the service layer
2. **Build React Hooks**: Develop useChat hook
3. **Create UI Components**: Build chat interface
4. **Add File Upload**: Implement file sharing
5. **Test End-to-End**: Verify complete functionality

## Security Checklist

- [ ] RLS enabled on all chat tables
- [ ] Policies restrict access to authorized users only
- [ ] Storage bucket is private (not public)
- [ ] File upload size limits are enforced
- [ ] MIME type restrictions are in place
- [ ] Service role key is kept secure
- [ ] Anon key is used for client-side operations only

## Performance Checklist

- [ ] Indexes created for common query patterns
- [ ] Triggers are efficient and don't block operations
- [ ] RLS policies use efficient queries
- [ ] Realtime subscriptions are properly managed
- [ ] Connection pooling is configured

## Monitoring

After setup, monitor:

- Database performance metrics
- Realtime connection counts
- Storage usage and costs
- Error rates in logs
- User access patterns

## Support Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
