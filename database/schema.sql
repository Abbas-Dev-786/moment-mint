PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS creators (
  id TEXT PRIMARY KEY,
  twitch_user_id TEXT NOT NULL UNIQUE,
  twitch_login TEXT NOT NULL,
  display_name TEXT NOT NULL,
  access_token_ciphertext TEXT,
  access_token_iv TEXT,
  refresh_token_ciphertext TEXT,
  refresh_token_iv TEXT,
  token_expires_at TEXT,
  scopes_json TEXT NOT NULL DEFAULT '[]',
  settings_json TEXT NOT NULL DEFAULT '{"nominationCommand":"!moment","groupWindowSeconds":30,"uniqueViewerThreshold":1,"autoClipEnabled":true,"communityContextEnabled":false}',
  connection_status TEXT NOT NULL DEFAULT 'DISCONNECTED' CHECK (connection_status IN ('CONNECTED','RECONNECT_REQUIRED','DISCONNECTED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS action_rate_limits (
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  window_started_at TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (creator_id, action)
);

CREATE TABLE IF NOT EXISTS oauth_states (
  id TEXT PRIMARY KEY,
  state_hash TEXT NOT NULL UNIQUE,
  session_id TEXT,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS eventsub_subscriptions (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  twitch_subscription_id TEXT UNIQUE,
  subscription_type TEXT NOT NULL DEFAULT 'channel.chat.message',
  status TEXT NOT NULL CHECK (status IN ('enabled','webhook_callback_verification_pending','revoked','failed','paused')),
  condition_json TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stream_sessions (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  twitch_stream_id TEXT,
  title TEXT,
  category_name TEXT,
  started_at TEXT,
  ended_at TEXT,
  status TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (status IN ('LIVE','ENDED','UNKNOWN')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  twitch_message_id TEXT NOT NULL UNIQUE,
  creator_id TEXT REFERENCES creators(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL CHECK (message_type IN ('verification','notification','revocation')),
  eventsub_timestamp TEXT,
  received_at TEXT NOT NULL,
  payload_json TEXT,
  processing_status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (processing_status IN ('RECEIVED','QUEUED','PROCESSED','FAILED')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_queued_at TEXT,
  processed_at TEXT,
  last_error_code TEXT
);

CREATE TABLE IF NOT EXISTS moments (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  stream_session_id TEXT NOT NULL REFERENCES stream_sessions(id) ON DELETE CASCADE,
  anchor_eventsub_at TEXT NOT NULL,
  anchor_received_at TEXT NOT NULL,
  group_window_seconds INTEGER NOT NULL,
  unique_nominator_count INTEGER NOT NULL DEFAULT 0,
  threshold_required INTEGER NOT NULL,
  threshold_met_at TEXT,
  status TEXT NOT NULL DEFAULT 'COLLECTING' CHECK (status IN ('COLLECTING','THRESHOLD_MET','CLIP_REQUESTED','CLIP_READY','REVIEWED','DISMISSED','CLIP_FAILED','MANUAL_REVIEW')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nominations (
  id TEXT PRIMARY KEY,
  moment_id TEXT NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  viewer_twitch_id TEXT NOT NULL,
  source_message_id TEXT NOT NULL UNIQUE,
  eventsub_timestamp TEXT NOT NULL,
  received_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(moment_id, viewer_twitch_id)
);

CREATE TABLE IF NOT EXISTS clip_jobs (
  id TEXT PRIMARY KEY,
  moment_id TEXT NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  idempotency_key TEXT NOT NULL UNIQUE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('THRESHOLD','MANUAL')),
  status TEXT NOT NULL CHECK (status IN ('QUEUED','CREATING','VERIFYING','READY_FOR_REVIEW','RETRYABLE_FAILED','FAILED','MANUAL_REVIEW')),
  twitch_clip_id TEXT,
  clip_url TEXT,
  embed_url TEXT,
  edit_url_ciphertext TEXT,
  edit_url_iv TEXT,
  thumbnail_url TEXT,
  clip_title TEXT,
  clip_duration_seconds REAL,
  request_at TEXT,
  verify_deadline_at TEXT,
  verified_at TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_metadata (
  id TEXT PRIMARY KEY,
  moment_id TEXT NOT NULL UNIQUE REFERENCES moments(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING','READY','FAILED_WITH_FALLBACK')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  category TEXT NOT NULL,
  social_caption TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  creator_note TEXT,
  evidence_summary TEXT,
  evidence_message_count INTEGER,
  evidence_window_start TEXT,
  evidence_window_end TEXT,
  confidence_note TEXT,
  context_mode TEXT NOT NULL DEFAULT 'MINIMAL' CHECK (context_mode IN ('MINIMAL','COMMUNITY_CONTEXT','NO_CONTEXT','CONTEXT_EXPIRED')),
  generated_at TEXT,
  updated_at TEXT NOT NULL
);

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

CREATE INDEX IF NOT EXISTS idx_webhook_events_outbox ON webhook_events(processing_status, last_queued_at);
CREATE INDEX IF NOT EXISTS idx_moments_creator_created ON moments(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moments_session_anchor ON moments(stream_session_id, anchor_eventsub_at);
CREATE INDEX IF NOT EXISTS idx_nominations_moment ON nominations(moment_id);
CREATE INDEX IF NOT EXISTS idx_clip_jobs_moment_status ON clip_jobs(moment_id, status);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expiry ON oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_action_rate_limits_window ON action_rate_limits(window_started_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stream_sessions_current_creator ON stream_sessions(creator_id) WHERE ended_at IS NULL AND status IN ('LIVE','UNKNOWN');
CREATE INDEX IF NOT EXISTS idx_chat_context_session_time ON chat_context_events(creator_id, stream_session_id, eventsub_timestamp);
CREATE INDEX IF NOT EXISTS idx_chat_context_moment_time ON chat_context_events(creator_id, moment_id, eventsub_timestamp);
CREATE INDEX IF NOT EXISTS idx_chat_context_expiry ON chat_context_events(expires_at);
