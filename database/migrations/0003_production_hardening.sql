CREATE TABLE IF NOT EXISTS action_rate_limits (
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  window_started_at TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (creator_id, action)
);

CREATE INDEX IF NOT EXISTS idx_action_rate_limits_window ON action_rate_limits(window_started_at);
