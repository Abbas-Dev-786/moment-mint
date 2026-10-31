CREATE UNIQUE INDEX IF NOT EXISTS idx_stream_sessions_current_creator ON stream_sessions(creator_id) WHERE ended_at IS NULL AND status IN ('LIVE','UNKNOWN');
