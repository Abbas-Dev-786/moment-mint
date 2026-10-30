import { newId, nowIso } from "../lib/ids.js"

export type ClipJobRow = { id: string; moment_id: string; creator_id: string; status: string; idempotency_key: string; twitch_clip_id: string | null; error_code: string | null }

export const findClipJobForCreator = (db: D1Database, creatorId: string, clipJobId: string) =>
  db.prepare("SELECT * FROM clip_jobs WHERE id = ?1 AND creator_id = ?2").bind(clipJobId, creatorId).first<ClipJobRow>()

export const findActiveClipJobForMoment = (db: D1Database, creatorId: string, momentId: string) =>
  db.prepare("SELECT * FROM clip_jobs WHERE creator_id = ?1 AND moment_id = ?2 AND status NOT IN ('FAILED','MANUAL_REVIEW') ORDER BY attempt_number DESC LIMIT 1").bind(creatorId, momentId).first<ClipJobRow>()

export const createClipJob = (db: D1Database, input: { momentId: string; creatorId: string; triggerType: "THRESHOLD" | "MANUAL"; idempotencyKey: string }) => {
  const timestamp = nowIso()
  return db.prepare("INSERT OR IGNORE INTO clip_jobs (id, moment_id, creator_id, attempt_number, idempotency_key, trigger_type, status, created_at, updated_at) VALUES (?1, ?2, ?3, 1, ?4, ?5, 'QUEUED', ?6, ?6) RETURNING *").bind(newId("clip"), input.momentId, input.creatorId, input.idempotencyKey, input.triggerType, timestamp).first<ClipJobRow>()
}

export const updateClipJobStatus = (db: D1Database, creatorId: string, clipJobId: string, status: string, errorCode?: string) =>
  db.prepare("UPDATE clip_jobs SET status = ?1, error_code = ?2, updated_at = ?3 WHERE id = ?4 AND creator_id = ?5").bind(status, errorCode ?? null, nowIso(), clipJobId, creatorId).run()
