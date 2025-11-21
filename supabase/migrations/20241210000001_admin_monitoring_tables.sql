-- Create admin interventions table
CREATE TABLE IF NOT EXISTS admin_interventions (
  id TEXT DEFAULT gen_random_uuid()::text PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  admin_name TEXT NOT NULL,
  chat_room_id TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('send_message', 'pause_chat', 'resume_chat', 'end_chat', 'escalate')),
  reason TEXT,
  message TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create chat escalations table
CREATE TABLE IF NOT EXISTS chat_escalations (
  id TEXT DEFAULT gen_random_uuid()::text PRIMARY KEY,
  chat_room_id TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  admin_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  assigned_to TEXT REFERENCES "User"(id),
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create system health table
CREATE TABLE IF NOT EXISTS system_health (
  id TEXT DEFAULT gen_random_uuid()::text PRIMARY KEY,
  overall_status TEXT NOT NULL CHECK (overall_status IN ('healthy', 'degraded', 'unhealthy')),
  services JSONB NOT NULL DEFAULT '[]',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create chat analytics table
CREATE TABLE IF NOT EXISTS chat_analytics (
  id TEXT DEFAULT gen_random_uuid()::text PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'message_sent', 'message_received', 'file_uploaded', 'chat_opened', 
    'chat_closed', 'connection_error', 'performance_metric'
  )),
  chat_room_id TEXT REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES "User"(id) ON DELETE CASCADE,
  session_id TEXT,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admin_interventions_chat_room_id ON admin_interventions(chat_room_id);
CREATE INDEX IF NOT EXISTS idx_admin_interventions_admin_id ON admin_interventions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_interventions_timestamp ON admin_interventions(timestamp);

CREATE INDEX IF NOT EXISTS idx_chat_escalations_chat_room_id ON chat_escalations(chat_room_id);
CREATE INDEX IF NOT EXISTS idx_chat_escalations_status ON chat_escalations(status);
CREATE INDEX IF NOT EXISTS idx_chat_escalations_priority ON chat_escalations(priority);

CREATE INDEX IF NOT EXISTS idx_system_health_timestamp ON system_health(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_health_overall_status ON system_health(overall_status);

CREATE INDEX IF NOT EXISTS idx_chat_analytics_event_type ON chat_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_chat_analytics_chat_room_id ON chat_analytics(chat_room_id);
CREATE INDEX IF NOT EXISTS idx_chat_analytics_user_id ON chat_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_analytics_timestamp ON chat_analytics(timestamp);
CREATE INDEX IF NOT EXISTS idx_chat_analytics_session_id ON chat_analytics(session_id);

-- Add RLS policies for admin interventions
ALTER TABLE admin_interventions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all interventions" ON admin_interventions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "User" 
      WHERE "User".id = auth.uid()::text 
      AND "User".role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can insert interventions" ON admin_interventions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "User" 
      WHERE "User".id = auth.uid()::text 
      AND "User".role = 'ADMIN'
    )
  );

-- Add RLS policies for chat escalations
ALTER TABLE chat_escalations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all escalations" ON chat_escalations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "User" 
      WHERE "User".id = auth.uid()::text 
      AND "User".role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can manage escalations" ON chat_escalations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "User" 
      WHERE "User".id = auth.uid()::text 
      AND "User".role = 'ADMIN'
    )
  );

-- Add RLS policies for system health
ALTER TABLE system_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view system health" ON system_health
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "User" 
      WHERE "User".id = auth.uid()::text 
      AND "User".role = 'ADMIN'
    )
  );

CREATE POLICY "System can insert health records" ON system_health
  FOR INSERT WITH CHECK (true);

-- Add RLS policies for chat analytics
ALTER TABLE chat_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all analytics" ON chat_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "User" 
      WHERE "User".id = auth.uid()::text 
      AND "User".role = 'ADMIN'
    )
  );

CREATE POLICY "Users can insert their own analytics" ON chat_analytics
  FOR INSERT WITH CHECK (
    user_id = auth.uid()::text OR user_id IS NULL
  );

-- Add trigger to update updated_at timestamp for chat_escalations
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chat_escalations_updated_at 
  BEFORE UPDATE ON chat_escalations 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add function to get chat session metrics
CREATE OR REPLACE FUNCTION get_chat_session_metrics(
  p_chat_room_id TEXT,
  p_start_time TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours'
)
RETURNS TABLE (
  total_messages BIGINT,
  total_files BIGINT,
  average_response_time NUMERIC,
  session_duration INTERVAL,
  error_count BIGINT,
  unique_participants BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH message_stats AS (
    SELECT 
      COUNT(*) as msg_count,
      COUNT(*) FILTER (WHERE message_type IN ('FILE', 'IMAGE')) as file_count,
      COUNT(DISTINCT sender_id) as participants
    FROM chat_messages 
    WHERE chat_room_id = p_chat_room_id 
    AND sent_at >= p_start_time
  ),
  response_times AS (
    SELECT 
      EXTRACT(EPOCH FROM (sent_at - LAG(sent_at) OVER (ORDER BY sent_at))) * 1000 as response_ms
    FROM chat_messages 
    WHERE chat_room_id = p_chat_room_id 
    AND sent_at >= p_start_time
    ORDER BY sent_at
  ),
  session_info AS (
    SELECT 
      started_at,
      COALESCE(ended_at, NOW()) as end_time
    FROM chat_rooms 
    WHERE id = p_chat_room_id
  ),
  error_stats AS (
    SELECT COUNT(*) as errors
    FROM chat_analytics 
    WHERE chat_room_id = p_chat_room_id 
    AND event_type = 'connection_error'
    AND timestamp >= p_start_time
  )
  SELECT 
    ms.msg_count,
    ms.file_count,
    COALESCE(AVG(rt.response_ms), 0)::NUMERIC,
    (si.end_time - si.started_at)::INTERVAL,
    es.errors,
    ms.participants
  FROM message_stats ms
  CROSS JOIN session_info si
  CROSS JOIN error_stats es
  LEFT JOIN response_times rt ON rt.response_ms IS NOT NULL AND rt.response_ms > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;