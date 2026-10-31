const windowKey = (now: number, windowMs: number) =>
  new Date(Math.floor(now / windowMs) * windowMs).toISOString()

/**
 * Consumes one creator-scoped action token. The conditional UPSERT keeps the
 * limit durable across Worker instances and rejects the request atomically
 * once the current window is exhausted.
 */
export const consumeRateLimit = async (
  db: D1Database,
  creatorId: string,
  action: string,
  maxCount: number,
  windowMs = 60_000,
) => {
  const startedAt = windowKey(Date.now(), windowMs)
  const row = await db.prepare(`
    INSERT INTO action_rate_limits (creator_id, action, window_started_at, count)
    VALUES (?1, ?2, ?3, 1)
    ON CONFLICT (creator_id, action) DO UPDATE SET
      window_started_at = excluded.window_started_at,
      count = CASE
        WHEN action_rate_limits.window_started_at = excluded.window_started_at
          THEN action_rate_limits.count + 1
        ELSE 1
      END
    WHERE action_rate_limits.window_started_at <> excluded.window_started_at
      OR action_rate_limits.count < ?4
    RETURNING count
  `).bind(creatorId, action, startedAt, maxCount).first<{ count: number }>()

  return Boolean(row)
}
