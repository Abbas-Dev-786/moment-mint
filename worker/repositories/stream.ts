import { newId, nowIso } from "../lib/ids.js"

export type StreamSessionRow = {
  id: string
  creator_id: string
  twitch_stream_id: string | null
  title: string | null
  category_name: string | null
  started_at: string | null
  ended_at: string | null
  status: "LIVE" | "ENDED" | "UNKNOWN"
  created_at: string
}

export type StreamSessionDetails = {
  twitchStreamId: string
  title: string | null
  categoryName: string | null
  startedAt: string | null
}

export const findCurrentStreamSession = (db: D1Database, creatorId: string) =>
  db.prepare("SELECT * FROM stream_sessions WHERE creator_id = ?1 AND status IN ('LIVE','UNKNOWN') AND ended_at IS NULL ORDER BY created_at DESC LIMIT 1").bind(creatorId).first<StreamSessionRow>()

export const findOrCreateStreamSession = async (db: D1Database, creatorId: string, startedAt: string, details?: StreamSessionDetails) => {
  let current = await findCurrentStreamSession(db, creatorId)
  if (current && details?.twitchStreamId && current.twitch_stream_id && current.twitch_stream_id !== details.twitchStreamId) {
    await db.prepare("UPDATE stream_sessions SET status = 'ENDED', ended_at = ?1 WHERE id = ?2 AND creator_id = ?3 AND ended_at IS NULL").bind(nowIso(), current.id, creatorId).run()
    current = null
  }
  if (current) {
    if (details) await db.prepare("UPDATE stream_sessions SET twitch_stream_id = ?1, title = ?2, category_name = ?3, started_at = COALESCE(?4, started_at), status = 'LIVE', ended_at = NULL WHERE id = ?5 AND creator_id = ?6").bind(details.twitchStreamId, details.title, details.categoryName, details.startedAt, current.id, creatorId).run()
    return findCurrentStreamSession(db, creatorId)
  }
  const id = newId("stream")
  await db.prepare("INSERT OR IGNORE INTO stream_sessions (id, creator_id, twitch_stream_id, title, category_name, started_at, status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)").bind(id, creatorId, details?.twitchStreamId ?? null, details?.title ?? null, details?.categoryName ?? null, details?.startedAt ?? startedAt, details ? "LIVE" : "UNKNOWN", nowIso()).run()
  return findCurrentStreamSession(db, creatorId)
}
