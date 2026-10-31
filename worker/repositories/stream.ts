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

export const findCurrentStreamSession = (db: D1Database, creatorId: string) =>
  db.prepare("SELECT * FROM stream_sessions WHERE creator_id = ?1 AND status IN ('LIVE','UNKNOWN') AND ended_at IS NULL ORDER BY created_at DESC LIMIT 1").bind(creatorId).first<StreamSessionRow>()

export const findOrCreateStreamSession = async (db: D1Database, creatorId: string, startedAt: string) => {
  const current = await findCurrentStreamSession(db, creatorId)
  if (current) return current
  const id = newId("stream")
  await db.prepare("INSERT OR IGNORE INTO stream_sessions (id, creator_id, started_at, status, created_at) VALUES (?1, ?2, ?3, 'UNKNOWN', ?4)").bind(id, creatorId, startedAt, nowIso()).run()
  return findCurrentStreamSession(db, creatorId)
}
