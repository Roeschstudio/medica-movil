-- =====================================================
-- WebRTC Video Calls Database Schema and Configuration
-- This migration creates the video calling system infrastructure
-- and required chat system tables
-- =====================================================

-- First, create the chat system tables that are required for video calls

-- Create enum for message types
CREATE TYPE message_type AS ENUM (
  'TEXT',
  'FILE',
  'IMAGE',
  'VIDEO',
  'AUDIO'
);

-- Create enum for file types
CREATE TYPE file_type AS ENUM (
  'STUDY',
  'PRESCRIPTION',
  'DOCUMENT',
  'IMAGE',
  'PDF'
);

-- Create enum for video session types
CREATE TYPE video_session_type AS ENUM (
  'CONSULTATION',
  'FOLLOW_UP',
  'EMERGENCY'
);

-- Create enum for video session status
CREATE TYPE video_session_status AS ENUM (
  'WAITING',
  'ACTIVE',
  'ENDED',
  'CANCELLED'
);

-- Create chat_rooms table
CREATE TABLE chat_rooms (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  appointment_id TEXT NOT NULL UNIQUE,
  patient_id TEXT NOT NULL,
  doctor_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Foreign key constraints will be added after ensuring referenced tables exist
  CONSTRAINT chat_rooms_patient_doctor_different CHECK (patient_id != doctor_id)
);

-- Create chat_messages table
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  chat_room_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  content TEXT,
  message_type message_type NOT NULL DEFAULT 'TEXT',
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  is_read BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT chat_messages_content_or_file CHECK (
    (content IS NOT NULL AND content != '') OR 
    (file_url IS NOT NULL AND file_name IS NOT NULL)
  )
);

-- Create video_sessions table (existing VideoSession from Prisma)
CREATE TABLE video_sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  chat_room_id TEXT NOT NULL,
  session_id TEXT NOT NULL UNIQUE,
  room_name TEXT NOT NULL,
  type video_session_type NOT NULL DEFAULT 'CONSULTATION',
  status video_session_status NOT NULL DEFAULT 'WAITING',
  initiator_id TEXT NOT NULL,
  recording_url TEXT,
  duration INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create video_session_participants table
CREATE TABLE video_session_participants (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  video_session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE,
  left_at TIMESTAMP WITH TIME ZONE,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT video_session_participants_unique UNIQUE (video_session_id, user_id)
);

-- Create medical_files table
CREATE TABLE medical_files (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  appointment_id TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type file_type NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create notifications table (referenced by other migrations)
CREATE TABLE notifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Now create the WebRTC video calls enums and tables

-- Create enum for video call status
CREATE TYPE video_call_status AS ENUM (
  'calling',
  'ringing', 
  'active',
  'ended',
  'declined',
  'failed'
);

-- Create enum for call type
CREATE TYPE call_type AS ENUM (
  'video',
  'audio'
);

-- Create enum for WebRTC signal types
CREATE TYPE webrtc_signal_type AS ENUM (
  'offer',
  'answer',
  'ice_candidate'
);

-- =====================================================
-- VIDEO CALLS TABLE
-- =====================================================

CREATE TABLE video_calls (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  room_id TEXT NOT NULL,
  caller_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  status video_call_status NOT NULL DEFAULT 'calling',
  call_type call_type NOT NULL DEFAULT 'video',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  answered_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  end_reason VARCHAR(50),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT video_calls_caller_receiver_different CHECK (caller_id != receiver_id),
  CONSTRAINT video_calls_duration_positive CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  CONSTRAINT video_calls_answered_after_started CHECK (answered_at IS NULL OR answered_at >= started_at),
  CONSTRAINT video_calls_ended_after_started CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- =====================================================
-- WEBRTC SIGNALS TABLE
-- =====================================================

CREATE TABLE webrtc_signals (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  call_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  signal_type webrtc_signal_type NOT NULL,
  signal_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT webrtc_signals_sender_receiver_different CHECK (sender_id != receiver_id),
  CONSTRAINT webrtc_signals_valid_signal_data CHECK (signal_data IS NOT NULL AND signal_data != '{}')
);

-- =====================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- =====================================================

-- Chat system indexes
CREATE INDEX idx_chat_rooms_appointment_id ON chat_rooms(appointment_id);
CREATE INDEX idx_chat_rooms_patient_id ON chat_rooms(patient_id);
CREATE INDEX idx_chat_rooms_doctor_id ON chat_rooms(doctor_id);
CREATE INDEX idx_chat_rooms_is_active ON chat_rooms(is_active);
CREATE INDEX idx_chat_rooms_updated_at ON chat_rooms(updated_at DESC);

CREATE INDEX idx_chat_messages_chat_room_id ON chat_messages(chat_room_id);
CREATE INDEX idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX idx_chat_messages_sent_at ON chat_messages(sent_at DESC);
CREATE INDEX idx_chat_messages_is_read ON chat_messages(is_read);
CREATE INDEX idx_chat_messages_message_type ON chat_messages(message_type);
CREATE INDEX idx_chat_messages_room_sent_at ON chat_messages(chat_room_id, sent_at DESC);

CREATE INDEX idx_video_sessions_chat_room_id ON video_sessions(chat_room_id);
CREATE INDEX idx_video_sessions_initiator_id ON video_sessions(initiator_id);
CREATE INDEX idx_video_sessions_status ON video_sessions(status);
CREATE INDEX idx_video_sessions_started_at ON video_sessions(started_at DESC);

CREATE INDEX idx_video_session_participants_video_session_id ON video_session_participants(video_session_id);
CREATE INDEX idx_video_session_participants_user_id ON video_session_participants(user_id);

CREATE INDEX idx_medical_files_appointment_id ON medical_files(appointment_id);
CREATE INDEX idx_medical_files_uploaded_by ON medical_files(uploaded_by);
CREATE INDEX idx_medical_files_uploaded_at ON medical_files(uploaded_at DESC);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Video calls indexes
CREATE INDEX idx_video_calls_room_id ON video_calls(room_id);
CREATE INDEX idx_video_calls_caller_id ON video_calls(caller_id);
CREATE INDEX idx_video_calls_receiver_id ON video_calls(receiver_id);
CREATE INDEX idx_video_calls_status ON video_calls(status);
CREATE INDEX idx_video_calls_started_at ON video_calls(started_at DESC);
CREATE INDEX idx_video_calls_created_at ON video_calls(created_at DESC);

-- Composite indexes for common queries
CREATE INDEX idx_video_calls_room_status ON video_calls(room_id, status);
CREATE INDEX idx_video_calls_caller_status ON video_calls(caller_id, status);
CREATE INDEX idx_video_calls_receiver_status ON video_calls(receiver_id, status);
CREATE INDEX idx_video_calls_active_calls ON video_calls(status, started_at) WHERE status IN ('calling', 'ringing', 'active');

-- WebRTC signals indexes
CREATE INDEX idx_webrtc_signals_call_id ON webrtc_signals(call_id);
CREATE INDEX idx_webrtc_signals_sender_id ON webrtc_signals(sender_id);
CREATE INDEX idx_webrtc_signals_receiver_id ON webrtc_signals(receiver_id);
CREATE INDEX idx_webrtc_signals_signal_type ON webrtc_signals(signal_type);
CREATE INDEX idx_webrtc_signals_created_at ON webrtc_signals(created_at DESC);

-- Composite indexes for signaling queries
CREATE INDEX idx_webrtc_signals_call_created ON webrtc_signals(call_id, created_at DESC);
CREATE INDEX idx_webrtc_signals_receiver_call ON webrtc_signals(receiver_id, call_id, created_at DESC);

-- =====================================================
-- ADD FOREIGN KEY CONSTRAINTS
-- =====================================================

-- Add foreign keys for chat_rooms (referencing existing tables from initial migration)
ALTER TABLE chat_rooms 
  ADD CONSTRAINT chat_rooms_patient_id_fkey 
  FOREIGN KEY (patient_id) REFERENCES "User"(id) ON DELETE CASCADE;

ALTER TABLE chat_rooms 
  ADD CONSTRAINT chat_rooms_doctor_id_fkey 
  FOREIGN KEY (doctor_id) REFERENCES "Doctor"(id) ON DELETE CASCADE;

ALTER TABLE chat_rooms 
  ADD CONSTRAINT chat_rooms_appointment_id_fkey 
  FOREIGN KEY (appointment_id) REFERENCES "Appointment"(id) ON DELETE CASCADE;

-- Add foreign keys for chat_messages
ALTER TABLE chat_messages 
  ADD CONSTRAINT chat_messages_chat_room_id_fkey 
  FOREIGN KEY (chat_room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE;

ALTER TABLE chat_messages 
  ADD CONSTRAINT chat_messages_sender_id_fkey 
  FOREIGN KEY (sender_id) REFERENCES "User"(id) ON DELETE CASCADE;

-- Add foreign keys for video_sessions
ALTER TABLE video_sessions 
  ADD CONSTRAINT video_sessions_chat_room_id_fkey 
  FOREIGN KEY (chat_room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE;

ALTER TABLE video_sessions 
  ADD CONSTRAINT video_sessions_initiator_id_fkey 
  FOREIGN KEY (initiator_id) REFERENCES "User"(id) ON DELETE CASCADE;

-- Add foreign keys for video_session_participants
ALTER TABLE video_session_participants 
  ADD CONSTRAINT video_session_participants_video_session_id_fkey 
  FOREIGN KEY (video_session_id) REFERENCES video_sessions(id) ON DELETE CASCADE;

ALTER TABLE video_session_participants 
  ADD CONSTRAINT video_session_participants_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES "User"(id) ON DELETE CASCADE;

-- Add foreign keys for medical_files
ALTER TABLE medical_files 
  ADD CONSTRAINT medical_files_appointment_id_fkey 
  FOREIGN KEY (appointment_id) REFERENCES "Appointment"(id) ON DELETE CASCADE;

ALTER TABLE medical_files 
  ADD CONSTRAINT medical_files_uploaded_by_fkey 
  FOREIGN KEY (uploaded_by) REFERENCES "User"(id) ON DELETE CASCADE;

-- Add foreign keys for notifications
ALTER TABLE notifications 
  ADD CONSTRAINT notifications_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES "User"(id) ON DELETE CASCADE;

-- Add foreign keys for video_calls
ALTER TABLE video_calls 
  ADD CONSTRAINT video_calls_room_id_fkey 
  FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE;

ALTER TABLE video_calls 
  ADD CONSTRAINT video_calls_caller_id_fkey 
  FOREIGN KEY (caller_id) REFERENCES "User"(id) ON DELETE CASCADE;

ALTER TABLE video_calls 
  ADD CONSTRAINT video_calls_receiver_id_fkey 
  FOREIGN KEY (receiver_id) REFERENCES "User"(id) ON DELETE CASCADE;

-- Add foreign keys for webrtc_signals
ALTER TABLE webrtc_signals 
  ADD CONSTRAINT webrtc_signals_call_id_fkey 
  FOREIGN KEY (call_id) REFERENCES video_calls(id) ON DELETE CASCADE;

ALTER TABLE webrtc_signals 
  ADD CONSTRAINT webrtc_signals_sender_id_fkey 
  FOREIGN KEY (sender_id) REFERENCES "User"(id) ON DELETE CASCADE;

ALTER TABLE webrtc_signals 
  ADD CONSTRAINT webrtc_signals_receiver_id_fkey 
  FOREIGN KEY (receiver_id) REFERENCES "User"(id) ON DELETE CASCADE;

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE video_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE webrtc_signals ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- VIDEO CALLS RLS POLICIES
-- =====================================================

-- Policy: Users can view video calls they are involved in
CREATE POLICY "Users can view their video calls"
ON video_calls FOR SELECT USING (
  caller_id = auth.uid()::text
  OR receiver_id = auth.uid()::text
  OR
  -- Admins can view all video calls
  EXISTS (
    SELECT 1 FROM "User" 
    WHERE id = auth.uid()::text AND role = 'ADMIN'
  )
);

-- Policy: Users can create video calls in their chat rooms
CREATE POLICY "Users can create video calls in their chat rooms"
ON video_calls FOR INSERT WITH CHECK (
  -- User must be the caller
  caller_id = auth.uid()::text
  AND
  -- Room must belong to user's appointment
  room_id IN (
    SELECT id FROM chat_rooms 
    WHERE patient_id = auth.uid()::text
    OR doctor_id IN (
      SELECT id FROM "Doctor" WHERE "userId" = auth.uid()::text
    )
  )
  AND
  -- Receiver must be the other participant in the chat room
  receiver_id IN (
    SELECT 
      CASE 
        WHEN cr.patient_id = auth.uid()::text THEN d."userId"
        ELSE cr.patient_id
      END
    FROM chat_rooms cr
    LEFT JOIN "Doctor" d ON cr.doctor_id = d.id
    WHERE cr.id = room_id
  )
);

-- Policy: Users can update video calls they are involved in
CREATE POLICY "Users can update their video calls"
ON video_calls FOR UPDATE USING (
  caller_id = auth.uid()::text
  OR receiver_id = auth.uid()::text
  OR
  -- Admins can update any video call
  EXISTS (
    SELECT 1 FROM "User" 
    WHERE id = auth.uid()::text AND role = 'ADMIN'
  )
);

-- =====================================================
-- WEBRTC SIGNALS RLS POLICIES
-- =====================================================

-- Policy: Users can view signals for their video calls
CREATE POLICY "Users can view their webrtc signals"
ON webrtc_signals FOR SELECT USING (
  sender_id = auth.uid()::text
  OR receiver_id = auth.uid()::text
  OR
  -- Admins can view all signals
  EXISTS (
    SELECT 1 FROM "User" 
    WHERE id = auth.uid()::text AND role = 'ADMIN'
  )
);

-- Policy: Users can create signals for their video calls
CREATE POLICY "Users can create webrtc signals"
ON webrtc_signals FOR INSERT WITH CHECK (
  -- User must be the sender
  sender_id = auth.uid()::text
  AND
  -- Call must involve the user
  call_id IN (
    SELECT id FROM video_calls 
    WHERE caller_id = auth.uid()::text OR receiver_id = auth.uid()::text
  )
  AND
  -- Receiver must be the other participant in the call
  receiver_id IN (
    SELECT 
      CASE 
        WHEN caller_id = auth.uid()::text THEN receiver_id
        ELSE caller_id
      END
    FROM video_calls 
    WHERE id = call_id
  )
);

-- =====================================================
-- ENABLE REALTIME PUBLICATIONS
-- =====================================================

-- Add video calls and webrtc signals to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE video_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE webrtc_signals;

-- =====================================================
-- HELPER FUNCTIONS FOR VIDEO CALLS
-- =====================================================

-- Function to check if user has access to video call
CREATE OR REPLACE FUNCTION has_video_call_access(call_id TEXT, user_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM video_calls vc
    WHERE vc.id = call_id
    AND (
      vc.caller_id = user_id
      OR vc.receiver_id = user_id
      OR EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = user_id AND u.role = 'ADMIN'
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active video call for a chat room
CREATE OR REPLACE FUNCTION get_active_video_call(room_id TEXT)
RETURNS TEXT AS $$
DECLARE
  call_id TEXT;
BEGIN
  SELECT id INTO call_id
  FROM video_calls
  WHERE room_id = get_active_video_call.room_id
    AND status IN ('calling', 'ringing', 'active')
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN call_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to end video call and calculate duration
CREATE OR REPLACE FUNCTION end_video_call(call_id TEXT, end_reason VARCHAR(50) DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
  call_record RECORD;
  calculated_duration INTEGER;
BEGIN
  -- Get call record
  SELECT * INTO call_record
  FROM video_calls
  WHERE id = call_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Video call not found';
  END IF;
  
  -- Calculate duration if call was answered
  IF call_record.answered_at IS NOT NULL THEN
    calculated_duration := EXTRACT(EPOCH FROM (NOW() - call_record.answered_at))::INTEGER;
  END IF;
  
  -- Update call record
  UPDATE video_calls
  SET 
    status = 'ended',
    ended_at = NOW(),
    duration_seconds = calculated_duration,
    end_reason = COALESCE(end_video_call.end_reason, 'normal'),
    updated_at = NOW()
  WHERE id = call_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update call status with validation
CREATE OR REPLACE FUNCTION update_video_call_status(
  call_id TEXT, 
  new_status video_call_status,
  user_id TEXT DEFAULT auth.uid()::text
)
RETURNS VOID AS $$
DECLARE
  call_record RECORD;
BEGIN
  -- Verify user has access to the call
  IF NOT has_video_call_access(call_id, user_id) THEN
    RAISE EXCEPTION 'Access denied to video call';
  END IF;
  
  -- Get current call record
  SELECT * INTO call_record
  FROM video_calls
  WHERE id = call_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Video call not found';
  END IF;
  
  -- Validate status transitions
  CASE call_record.status
    WHEN 'calling' THEN
      IF new_status NOT IN ('ringing', 'declined', 'failed', 'ended') THEN
        RAISE EXCEPTION 'Invalid status transition from calling to %', new_status;
      END IF;
    WHEN 'ringing' THEN
      IF new_status NOT IN ('active', 'declined', 'failed', 'ended') THEN
        RAISE EXCEPTION 'Invalid status transition from ringing to %', new_status;
      END IF;
    WHEN 'active' THEN
      IF new_status NOT IN ('ended', 'failed') THEN
        RAISE EXCEPTION 'Invalid status transition from active to %', new_status;
      END IF;
    ELSE
      -- Terminal states (ended, declined, failed) cannot be changed
      RAISE EXCEPTION 'Cannot change status from terminal state %', call_record.status;
  END CASE;
  
  -- Update the call status
  UPDATE video_calls
  SET 
    status = new_status,
    answered_at = CASE 
      WHEN new_status = 'active' AND answered_at IS NULL THEN NOW()
      ELSE answered_at
    END,
    ended_at = CASE 
      WHEN new_status IN ('ended', 'declined', 'failed') AND ended_at IS NULL THEN NOW()
      ELSE ended_at
    END,
    duration_seconds = CASE 
      WHEN new_status IN ('ended', 'declined', 'failed') AND answered_at IS NOT NULL THEN
        EXTRACT(EPOCH FROM (NOW() - answered_at))::INTEGER
      ELSE duration_seconds
    END,
    updated_at = NOW()
  WHERE id = call_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Function to update video_calls updated_at timestamp
CREATE OR REPLACE FUNCTION update_video_calls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for video_calls updated_at
CREATE TRIGGER trigger_video_calls_updated_at
  BEFORE UPDATE ON video_calls
  FOR EACH ROW
  EXECUTE FUNCTION update_video_calls_updated_at();

-- Function to notify video call status changes
CREATE OR REPLACE FUNCTION notify_video_call_status_change()
RETURNS TRIGGER AS $$
DECLARE
  notification_title TEXT;
  notification_message TEXT;
  recipient_id UUID;
BEGIN
  -- Determine recipient and notification content based on status change
  CASE NEW.status
    WHEN 'calling' THEN
      recipient_id := NEW.receiver_id;
      notification_title := 'Llamada de video entrante';
      notification_message := 'Tienes una llamada de video entrante';
    WHEN 'ringing' THEN
      recipient_id := NEW.caller_id;
      notification_title := 'Llamada conectando';
      notification_message := 'Tu llamada está conectando';
    WHEN 'active' THEN
      -- Notify both participants that call is active
      INSERT INTO notifications (user_id, type, title, message, sent_at)
      VALUES 
        (NEW.caller_id, 'EMAIL', 'Llamada activa', 'La llamada de video está activa', NOW()),
        (NEW.receiver_id, 'EMAIL', 'Llamada activa', 'La llamada de video está activa', NOW());
      RETURN NEW;
    WHEN 'ended' THEN
      -- Notify both participants that call ended
      INSERT INTO notifications (user_id, type, title, message, sent_at)
      VALUES 
        (NEW.caller_id, 'EMAIL', 'Llamada terminada', 'La llamada de video ha terminado', NOW()),
        (NEW.receiver_id, 'EMAIL', 'Llamada terminada', 'La llamada de video ha terminado', NOW());
      RETURN NEW;
    WHEN 'declined' THEN
      recipient_id := NEW.caller_id;
      notification_title := 'Llamada rechazada';
      notification_message := 'Tu llamada de video fue rechazada';
    WHEN 'failed' THEN
      -- Notify both participants of call failure
      INSERT INTO notifications (user_id, type, title, message, sent_at)
      VALUES 
        (NEW.caller_id, 'EMAIL', 'Llamada falló', 'La llamada de video falló', NOW()),
        (NEW.receiver_id, 'EMAIL', 'Llamada falló', 'La llamada de video falló', NOW());
      RETURN NEW;
    ELSE
      RETURN NEW;
  END CASE;

  -- Create single recipient notification
  IF recipient_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, sent_at)
    VALUES (recipient_id, 'EMAIL', notification_title, notification_message, NOW());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for video call status change notifications
CREATE TRIGGER trigger_notify_video_call_status_change
  AFTER UPDATE OF status ON video_calls
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_video_call_status_change();

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON video_calls TO authenticated;
GRANT SELECT, INSERT ON webrtc_signals TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION has_video_call_access(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_video_call(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION end_video_call(TEXT, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION update_video_call_status(TEXT, video_call_status, TEXT) TO authenticated;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE video_calls IS 'Video call sessions between doctors and patients with WebRTC signaling';
COMMENT ON TABLE webrtc_signals IS 'WebRTC signaling data for peer-to-peer connection establishment';
COMMENT ON TYPE video_call_status IS 'Status of video call: calling, ringing, active, ended, declined, failed';
COMMENT ON TYPE call_type IS 'Type of call: video or audio only';
COMMENT ON TYPE webrtc_signal_type IS 'WebRTC signal type: offer, answer, or ice_candidate';

COMMENT ON FUNCTION has_video_call_access(TEXT, TEXT) IS 'Checks if a user has access to a specific video call';
COMMENT ON FUNCTION get_active_video_call(TEXT) IS 'Returns active video call ID for a chat room, if any';
COMMENT ON FUNCTION end_video_call(TEXT, VARCHAR) IS 'Ends a video call and calculates duration';
COMMENT ON FUNCTION update_video_call_status(TEXT, video_call_status, TEXT) IS 'Updates video call status with validation';

-- =====================================================
-- CONFIGURATION COMPLETE
-- =====================================================

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'WebRTC Video Calls schema configuration completed successfully';
  RAISE NOTICE 'Created tables: video_calls, webrtc_signals';
  RAISE NOTICE 'Created enums: video_call_status, call_type, webrtc_signal_type';
  RAISE NOTICE 'Enabled Realtime on: video_calls, webrtc_signals';
  RAISE NOTICE 'Created comprehensive RLS policies for secure access control';
  RAISE NOTICE 'Added helper functions and performance indexes';
  RAISE NOTICE 'Configured automatic notifications for call status changes';
END $$;