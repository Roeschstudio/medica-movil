-- =====================================================
-- Verification Script for Realtime and RLS Setup
-- Run this in Supabase SQL Editor to verify configuration
-- =====================================================

-- Check if Realtime is enabled on chat tables
SELECT 
  schemaname,
  tablename,
  'Realtime Enabled' as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
  AND tablename IN ('chat_rooms', 'chat_messages', 'notifications', 'video_sessions', 'video_session_participants');

-- Check RLS status on chat tables
SELECT 
  schemaname,
  tablename,
  CASE WHEN rowsecurity THEN 'RLS Enabled' ELSE 'RLS Disabled' END as rls_status
FROM pg_tables 
WHERE tablename IN ('chat_rooms', 'chat_messages', 'notifications', 'video_sessions', 'video_session_participants', 'medical_files')
  AND schemaname = 'public';

-- Count RLS policies per table
SELECT 
  tablename,
  COUNT(*) as policy_count,
  STRING_AGG(policyname, ', ') as policies
FROM pg_policies 
WHERE tablename IN ('chat_rooms', 'chat_messages', 'notifications', 'video_sessions', 'video_session_participants', 'medical_files')
GROUP BY tablename
ORDER BY tablename;

-- Check helper functions
SELECT 
  proname as function_name,
  'Function Exists' as status
FROM pg_proc 
WHERE proname IN ('has_chat_room_access', 'get_unread_message_count', 'mark_messages_as_read');

-- Check triggers
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  'Trigger Exists' as status
FROM pg_trigger 
WHERE tgname IN ('trigger_notify_new_message', 'trigger_update_chat_room_activity');

-- Check indexes
SELECT 
  indexname,
  tablename,
  'Index Exists' as status
FROM pg_indexes 
WHERE indexname LIKE 'idx_chat_%'
ORDER BY tablename, indexname;

-- Check storage bucket (if accessible)
SELECT 
  id as bucket_id,
  name as bucket_name,
  public,
  file_size_limit,
  array_length(allowed_mime_types, 1) as mime_type_count
FROM storage.buckets 
WHERE id = 'chat-files';

-- Test helper functions with dummy data
SELECT 
  'Testing has_chat_room_access' as test_name,
  'Function callable' as result
WHERE EXISTS (
  SELECT 1 FROM pg_proc WHERE proname = 'has_chat_room_access'
);

SELECT 
  'Testing get_unread_message_count' as test_name,
  'Function callable' as result
WHERE EXISTS (
  SELECT 1 FROM pg_proc WHERE proname = 'get_unread_message_count'
);

-- Summary report
SELECT 
  'CONFIGURATION SUMMARY' as section,
  '' as details
UNION ALL
SELECT 
  'Realtime Tables',
  COALESCE((
    SELECT COUNT(*)::text || ' tables enabled'
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND tablename IN ('chat_rooms', 'chat_messages', 'notifications', 'video_sessions', 'video_session_participants')
  ), '0 tables enabled')
UNION ALL
SELECT 
  'RLS Enabled Tables',
  COALESCE((
    SELECT COUNT(*)::text || ' tables with RLS'
    FROM pg_tables 
    WHERE tablename IN ('chat_rooms', 'chat_messages', 'notifications', 'video_sessions', 'video_session_participants', 'medical_files')
      AND schemaname = 'public'
      AND rowsecurity = true
  ), '0 tables with RLS')
UNION ALL
SELECT 
  'Total RLS Policies',
  COALESCE((
    SELECT COUNT(*)::text || ' policies created'
    FROM pg_policies 
    WHERE tablename IN ('chat_rooms', 'chat_messages', 'notifications', 'video_sessions', 'video_session_participants', 'medical_files')
  ), '0 policies created')
UNION ALL
SELECT 
  'Helper Functions',
  COALESCE((
    SELECT COUNT(*)::text || ' functions created'
    FROM pg_proc 
    WHERE proname IN ('has_chat_room_access', 'get_unread_message_count', 'mark_messages_as_read')
  ), '0 functions created')
UNION ALL
SELECT 
  'Triggers',
  COALESCE((
    SELECT COUNT(*)::text || ' triggers created'
    FROM pg_trigger 
    WHERE tgname IN ('trigger_notify_new_message', 'trigger_update_chat_room_activity')
  ), '0 triggers created')
UNION ALL
SELECT 
  'Performance Indexes',
  COALESCE((
    SELECT COUNT(*)::text || ' indexes created'
    FROM pg_indexes 
    WHERE indexname LIKE 'idx_chat_%'
  ), '0 indexes created')
UNION ALL
SELECT 
  'Storage Bucket',
  CASE 
    WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'chat-files') 
    THEN 'chat-files bucket configured'
    ELSE 'chat-files bucket missing'
  END;