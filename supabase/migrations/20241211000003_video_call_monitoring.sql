-- Video Call Quality Metrics Table
CREATE TABLE IF NOT EXISTS video_call_quality_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    call_id UUID REFERENCES video_calls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    connection_time INTEGER NOT NULL DEFAULT 0,
    ice_gathering_time INTEGER NOT NULL DEFAULT 0,
    audio_quality JSONB NOT NULL DEFAULT '{}',
    video_quality JSONB NOT NULL DEFAULT '{}',
    network_conditions JSONB NOT NULL DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Video Call Usage Analytics Table
CREATE TABLE IF NOT EXISTS video_call_usage_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    call_id UUID REFERENCES video_calls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_role TEXT NOT NULL CHECK (user_role IN ('doctor', 'patient')),
    call_duration INTEGER NOT NULL DEFAULT 0,
    call_type TEXT NOT NULL CHECK (call_type IN ('video', 'audio')),
    end_reason TEXT NOT NULL,
    device_info JSONB NOT NULL DEFAULT '{}',
    features JSONB NOT NULL DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Video Call Error Events Table
CREATE TABLE IF NOT EXISTS video_call_error_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    call_id UUID REFERENCES video_calls(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    error_type TEXT NOT NULL CHECK (error_type IN ('connection', 'media', 'signaling', 'permission', 'browser')),
    error_message TEXT NOT NULL,
    error_stack TEXT,
    context JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_call_quality_metrics_call_id ON video_call_quality_metrics(call_id);
CREATE INDEX IF NOT EXISTS idx_video_call_quality_metrics_user_id ON video_call_quality_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_video_call_quality_metrics_timestamp ON video_call_quality_metrics(timestamp);

CREATE INDEX IF NOT EXISTS idx_video_call_usage_analytics_call_id ON video_call_usage_analytics(call_id);
CREATE INDEX IF NOT EXISTS idx_video_call_usage_analytics_user_id ON video_call_usage_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_video_call_usage_analytics_timestamp ON video_call_usage_analytics(timestamp);
CREATE INDEX IF NOT EXISTS idx_video_call_usage_analytics_user_role ON video_call_usage_analytics(user_role);

CREATE INDEX IF NOT EXISTS idx_video_call_error_events_call_id ON video_call_error_events(call_id);
CREATE INDEX IF NOT EXISTS idx_video_call_error_events_user_id ON video_call_error_events(user_id);
CREATE INDEX IF NOT EXISTS idx_video_call_error_events_error_type ON video_call_error_events(error_type);
CREATE INDEX IF NOT EXISTS idx_video_call_error_events_created_at ON video_call_error_events(created_at);

-- Row Level Security Policies
ALTER TABLE video_call_quality_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_call_usage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_call_error_events ENABLE ROW LEVEL SECURITY;

-- Quality metrics policies
CREATE POLICY "Users can insert their own quality metrics" ON video_call_quality_metrics
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own quality metrics" ON video_call_quality_metrics
    FOR SELECT USING (auth.uid() = user_id);

-- Usage analytics policies
CREATE POLICY "Users can insert their own usage analytics" ON video_call_usage_analytics
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own usage analytics" ON video_call_usage_analytics
    FOR SELECT USING (auth.uid() = user_id);

-- Error events policies
CREATE POLICY "Users can insert their own error events" ON video_call_error_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own error events" ON video_call_error_events
    FOR SELECT USING (auth.uid() = user_id);

-- Admin policies for system monitoring
CREATE POLICY "Admins can view all quality metrics" ON video_call_quality_metrics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

CREATE POLICY "Admins can view all usage analytics" ON video_call_usage_analytics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

CREATE POLICY "Admins can view all error events" ON video_call_error_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Functions for aggregated metrics
CREATE OR REPLACE FUNCTION get_video_call_system_health()
RETURNS TABLE (
    active_calls BIGINT,
    total_calls_today BIGINT,
    average_call_duration NUMERIC,
    success_rate NUMERIC,
    error_rate NUMERIC,
    average_connection_time NUMERIC,
    average_ice_gathering_time NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH today_calls AS (
        SELECT 
            vc.id,
            vc.status,
            vc.duration_seconds,
            vca.end_reason
        FROM video_calls vc
        LEFT JOIN video_call_usage_analytics vca ON vc.id = vca.call_id
        WHERE vc.started_at >= CURRENT_DATE
    ),
    quality_metrics AS (
        SELECT 
            AVG(connection_time) as avg_connection_time,
            AVG(ice_gathering_time) as avg_ice_gathering_time
        FROM video_call_quality_metrics
        WHERE timestamp >= CURRENT_DATE
    )
    SELECT 
        (SELECT COUNT(*) FROM video_calls WHERE status = 'active')::BIGINT as active_calls,
        (SELECT COUNT(*) FROM today_calls)::BIGINT as total_calls_today,
        COALESCE((SELECT AVG(duration_seconds) FROM today_calls WHERE status = 'ended'), 0) as average_call_duration,
        COALESCE((
            SELECT COUNT(*)::NUMERIC / NULLIF(COUNT(*), 0) 
            FROM today_calls 
            WHERE end_reason IN ('user_ended', 'completed') OR status IN ('ended', 'active')
        ), 0) as success_rate,
        COALESCE((
            SELECT COUNT(*)::NUMERIC / NULLIF(COUNT(*), 0) 
            FROM today_calls 
            WHERE end_reason NOT IN ('user_ended', 'completed') AND status NOT IN ('ended', 'active')
        ), 0) as error_rate,
        COALESCE((SELECT avg_connection_time FROM quality_metrics), 0) as average_connection_time,
        COALESCE((SELECT avg_ice_gathering_time FROM quality_metrics), 0) as average_ice_gathering_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_video_call_system_health() TO authenticated;

-- Function to clean up old monitoring data (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_monitoring_data()
RETURNS void AS $$
BEGIN
    -- Delete quality metrics older than 30 days
    DELETE FROM video_call_quality_metrics 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Delete usage analytics older than 90 days
    DELETE FROM video_call_usage_analytics 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    -- Delete error events older than 60 days
    DELETE FROM video_call_error_events 
    WHERE created_at < NOW() - INTERVAL '60 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role for cleanup
GRANT EXECUTE ON FUNCTION cleanup_old_monitoring_data() TO service_role;