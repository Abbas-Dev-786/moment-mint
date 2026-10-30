import { newId, nowIso } from "../lib/ids.js"

export type WebhookEventRow = {
  id: string
  twitch_message_id: string
  creator_id: string | null
  message_type: "verification" | "notification" | "revocation"
  eventsub_timestamp: string | null
  received_at: string
  payload_json: string | null
  processing_status: "RECEIVED" | "QUEUED" | "PROCESSED" | "FAILED"
  attempts: number
  last_queued_at: string | null
}

export const insertWebhookEvent = async (db: D1Database, input: Omit<WebhookEventRow, "id" | "processing_status" | "attempts" | "last_queued_at">) => {
  const id = newId("event")
  const result = await db.prepare(`INSERT OR IGNORE INTO webhook_events (id, twitch_message_id, creator_id, message_type, eventsub_timestamp, received_at, payload_json)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`).bind(id, input.twitch_message_id, input.creator_id, input.message_type, input.eventsub_timestamp, input.received_at, input.payload_json).run()
  return { id, inserted: result.meta.changes === 1 }
}

export const markWebhookQueued = (db: D1Database, eventId: string) =>
  db.prepare("UPDATE webhook_events SET processing_status = 'QUEUED', attempts = attempts + 1, last_queued_at = ?1 WHERE id = ?2 AND processing_status IN ('RECEIVED','QUEUED')").bind(nowIso(), eventId).run()

export const markWebhookProcessed = (db: D1Database, eventId: string) =>
  db.prepare("UPDATE webhook_events SET processing_status = 'PROCESSED', processed_at = ?1, last_error_code = NULL WHERE id = ?2").bind(nowIso(), eventId).run()

export const markWebhookFailed = (db: D1Database, eventId: string, errorCode: string) =>
  db.prepare("UPDATE webhook_events SET processing_status = 'FAILED', last_error_code = ?1 WHERE id = ?2").bind(errorCode, eventId).run()

export const findWebhookEvent = (db: D1Database, eventId: string) =>
  db.prepare("SELECT * FROM webhook_events WHERE id = ?1").bind(eventId).first<WebhookEventRow>()

export const findPendingWebhookEvents = (db: D1Database, limit = 50) =>
  db.prepare("SELECT * FROM webhook_events WHERE processing_status IN ('RECEIVED','QUEUED') AND (last_queued_at IS NULL OR last_queued_at < ?1) ORDER BY received_at ASC LIMIT ?2").bind(new Date(Date.now() - 30_000).toISOString(), limit).all<WebhookEventRow>()
