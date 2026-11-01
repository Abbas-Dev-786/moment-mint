ALTER TABLE ai_metadata ADD COLUMN evidence_summary TEXT;
ALTER TABLE ai_metadata ADD COLUMN evidence_message_count INTEGER;
ALTER TABLE ai_metadata ADD COLUMN evidence_window_start TEXT;
ALTER TABLE ai_metadata ADD COLUMN evidence_window_end TEXT;
ALTER TABLE ai_metadata ADD COLUMN confidence_note TEXT;
ALTER TABLE ai_metadata ADD COLUMN context_mode TEXT NOT NULL DEFAULT 'MINIMAL';

CREATE TABLE IF NOT EXISTS chat_context_events (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  moment_id TEXT REFERENCES moments(id) ON DELETE CASCADE,
  stream_session_id TEXT NOT NULL REFERENCES stream_sessions(id) ON DELETE CASCADE,
  source_message_id TEXT NOT NULL UNIQUE,
  message_text TEXT NOT NULL,
  eventsub_timestamp TEXT NOT NULL,
  received_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_context_session_time ON chat_context_events(creator_id, stream_session_id, eventsub_timestamp);
CREATE INDEX IF NOT EXISTS idx_chat_context_moment_time ON chat_context_events(creator_id, moment_id, eventsub_timestamp);
CREATE INDEX IF NOT EXISTS idx_chat_context_expiry ON chat_context_events(expires_at);
