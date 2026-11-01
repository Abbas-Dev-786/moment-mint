import { newId, nowIso } from "../lib/ids.js"

export type ClipJobRow = {
  id: string
  moment_id: string
  creator_id: string
  attempt_number: number
  idempotency_key: string
  trigger_type: "THRESHOLD" | "MANUAL"
  status: "QUEUED" | "CREATING" | "VERIFYING" | "READY_FOR_REVIEW" | "RETRYABLE_FAILED" | "FAILED" | "MANUAL_REVIEW"
  twitch_clip_id: string | null
  clip_url: string | null
  embed_url: string | null
  edit_url_ciphertext: string | null
  edit_url_iv: string | null
  thumbnail_url: string | null
  clip_title: string | null
  clip_duration_seconds: number | null
  request_at: string | null
  verify_deadline_at: string | null
  verified_at: string | null
  error_code: string | null
}

export const findClipJobForCreator = (db: D1Database, creatorId: string, clipJobId: string) =>
  db.prepare("SELECT * FROM clip_jobs WHERE id = ?1 AND creator_id = ?2").bind(clipJobId, creatorId).first<ClipJobRow>()

export const findActiveClipJobForMoment = (db: D1Database, creatorId: string, momentId: string) =>
  db.prepare("SELECT * FROM clip_jobs WHERE creator_id = ?1 AND moment_id = ?2 AND status NOT IN ('FAILED','MANUAL_REVIEW','RETRYABLE_FAILED') ORDER BY attempt_number DESC LIMIT 1").bind(creatorId, momentId).first<ClipJobRow>()

export const findLatestClipJobForMoment = (db: D1Database, creatorId: string, momentId: string) =>
  db.prepare("SELECT * FROM clip_jobs WHERE creator_id = ?1 AND moment_id = ?2 ORDER BY attempt_number DESC, created_at DESC LIMIT 1").bind(creatorId, momentId).first<ClipJobRow>()

export const findClipJobWithCreator = (db: D1Database, clipJobId: string) =>
  db.prepare("SELECT clip_jobs.*, moments.anchor_eventsub_at, creators.twitch_user_id, creators.settings_json, creators.access_token_ciphertext, creators.access_token_iv, creators.refresh_token_ciphertext, creators.refresh_token_iv, creators.token_expires_at, creators.connection_status FROM clip_jobs JOIN creators ON creators.id = clip_jobs.creator_id JOIN moments ON moments.id = clip_jobs.moment_id WHERE clip_jobs.id = ?1").bind(clipJobId).first<ClipJobRow & { anchor_eventsub_at: string; twitch_user_id: string; settings_json: string; access_token_ciphertext: string | null; access_token_iv: string | null; refresh_token_ciphertext: string | null; refresh_token_iv: string | null; token_expires_at: string | null; connection_status: string }>()

export const createClipJob = (db: D1Database, input: { momentId: string; creatorId: string; triggerType: "THRESHOLD" | "MANUAL"; idempotencyKey: string; attemptNumber?: number }) => {
  const timestamp = nowIso()
  return db.prepare("INSERT OR IGNORE INTO clip_jobs (id, moment_id, creator_id, attempt_number, idempotency_key, trigger_type, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'QUEUED', ?7, ?7) RETURNING *").bind(newId("clip"), input.momentId, input.creatorId, input.attemptNumber ?? 1, input.idempotencyKey, input.triggerType, timestamp).first<ClipJobRow>()
}

export const updateClipJobStatus = (db: D1Database, creatorId: string, clipJobId: string, status: string, errorCode?: string) =>
  db.prepare("UPDATE clip_jobs SET status = ?1, error_code = ?2, updated_at = ?3 WHERE id = ?4 AND creator_id = ?5").bind(status, errorCode ?? null, nowIso(), clipJobId, creatorId).run()

export const claimClipJob = (db: D1Database, clipJobId: string) =>
  db.prepare("UPDATE clip_jobs SET status = 'CREATING', request_at = ?1, updated_at = ?1 WHERE id = ?2 AND status = 'QUEUED'").bind(nowIso(), clipJobId).run()

export const saveClipCreation = (db: D1Database, clipJobId: string, input: { clipId: string; editUrlCiphertext: string; editUrlIv: string; deadline: string }) =>
  db.prepare("UPDATE clip_jobs SET status = 'VERIFYING', twitch_clip_id = ?1, edit_url_ciphertext = ?2, edit_url_iv = ?3, verify_deadline_at = ?4, error_code = NULL, updated_at = ?5 WHERE id = ?6 AND status = 'CREATING'").bind(input.clipId, input.editUrlCiphertext, input.editUrlIv, input.deadline, nowIso(), clipJobId).run()

export const saveClipVerification = (db: D1Database, clipJobId: string, input: { clipUrl: string; embedUrl: string; thumbnailUrl: string | null; title: string; duration: number; verifiedAt: string }) =>
  db.prepare("UPDATE clip_jobs SET status = 'READY_FOR_REVIEW', clip_url = ?1, embed_url = ?2, thumbnail_url = ?3, clip_title = ?4, clip_duration_seconds = ?5, verified_at = ?6, error_code = NULL, updated_at = ?6 WHERE id = ?7 AND status = 'VERIFYING'").bind(input.clipUrl, input.embedUrl, input.thumbnailUrl, input.title, input.duration, input.verifiedAt, clipJobId).run()

export const markClipJob = (db: D1Database, clipJobId: string, status: ClipJobRow["status"], errorCode?: string) =>
  db.prepare("UPDATE clip_jobs SET status = ?1, error_code = ?2, updated_at = ?3 WHERE id = ?4").bind(status, errorCode ?? null, nowIso(), clipJobId).run()
