import { creatorSettings, findCreatorById } from "../repositories/creator.js"
import { findOrCreateStreamSession } from "../repositories/stream.js"
import { newId, nowIso } from "../lib/ids.js"

export const CHAT_CONTEXT_BEFORE_SECONDS = 60
export const CHAT_CONTEXT_AFTER_SECONDS = 30
export const CHAT_CONTEXT_RETENTION_SECONDS = 24 * 60 * 60
export const CHAT_CONTEXT_MAX_COLLECTION_SECONDS = 7 * 24 * 60 * 60
export const CHAT_CONTEXT_BUFFER_SECONDS = 15 * 60
export const CHAT_CONTEXT_MAX_MESSAGE_CHARS = 280
export const CHAT_CONTEXT_MAX_MESSAGES = 24
export const CHAT_CONTEXT_MAX_TOTAL_CHARS = 4_000
export const CHAT_CONTEXT_MAX_BUFFER_MESSAGES = 120

export type ChatContextEventInput = {
  creatorId: string
  sourceMessageId: string | null
  messageText: string | null
  eventsubTimestamp: string
  receivedAt: string
  isNomination?: boolean
}

export type ChatContextEventRow = {
  id: string
  creator_id: string
  moment_id: string | null
  stream_session_id: string
  source_message_id: string
  message_text: string
  eventsub_timestamp: string
  received_at: string
  expires_at: string
  created_at: string
}

export type ChatContextItem = Pick<ChatContextEventRow, "message_text" | "eventsub_timestamp"> & { relative_seconds: number }

export const chatContextWindow = (anchorEventsubAt: string, beforeSeconds = CHAT_CONTEXT_BEFORE_SECONDS, afterSeconds = CHAT_CONTEXT_AFTER_SECONDS) => {
  const anchor = Date.parse(anchorEventsubAt)
  if (!Number.isFinite(anchor)) return null
  return {
    start: new Date(anchor - beforeSeconds * 1000).toISOString(),
    end: new Date(anchor + afterSeconds * 1000).toISOString(),
  }
}

export const contextRetentionExpiry = (createdAt: string, generatedAt: string | null = null) => {
  const createdMs = Date.parse(createdAt)
  if (!Number.isFinite(createdMs)) return null
  const collectionExpiry = createdMs + CHAT_CONTEXT_MAX_COLLECTION_SECONDS * 1000
  const retentionStart = generatedAt ? Date.parse(generatedAt) : Date.now()
  if (!Number.isFinite(retentionStart)) return null
  return new Date(Math.min(collectionExpiry, retentionStart + CHAT_CONTEXT_RETENTION_SECONDS * 1000)).toISOString()
}

export const sanitizeChatText = (value: string | null | undefined) => {
  if (typeof value !== "string") return null
  const normalized = Array.from(value, (character) => {
    const code = character.charCodeAt(0)
    return (code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127) ? " " : character
  }).join("")
    .replace(/\s+/g, " ")
    .trim()
  if (!normalized) return null
  return Array.from(normalized).slice(0, CHAT_CONTEXT_MAX_MESSAGE_CHARS).join("")
}

export const contextEvidenceFallback = (messageCount: number) => messageCount > 0
  ? `Sampled ${messageCount} community message${messageCount === 1 ? "" : "s"}; viewer reactions are not proof of what happened in the video.`
  : "No usable community context was available; review the clip before sharing."

export const contextConfidenceFallback = (messageCount: number) => messageCount >= 5
  ? "Moderate evidence from several sampled community reactions."
  : messageCount > 0
    ? "Limited evidence from a small sample of community reactions."
    : "No community reaction evidence was available."

const nearestMoment = async (db: D1Database, creatorId: string, streamSessionId: string, eventsubTimestamp: string) => {
  const eventAt = Date.parse(eventsubTimestamp)
  if (!Number.isFinite(eventAt)) return null
  const rows = await db.prepare("SELECT id, anchor_eventsub_at FROM moments WHERE creator_id = ?1 AND stream_session_id = ?2 ORDER BY anchor_eventsub_at DESC LIMIT 100").bind(creatorId, streamSessionId).all<{ id: string; anchor_eventsub_at: string }>()
  return rows.results
    .map((row) => ({ row, anchorAt: Date.parse(row.anchor_eventsub_at) }))
    .filter(({ anchorAt }) => Number.isFinite(anchorAt) && eventAt >= anchorAt - CHAT_CONTEXT_BEFORE_SECONDS * 1000 && eventAt <= anchorAt + CHAT_CONTEXT_AFTER_SECONDS * 1000)
    .sort((left, right) => Math.abs(left.anchorAt - eventAt) - Math.abs(right.anchorAt - eventAt) || left.row.id.localeCompare(right.row.id))[0]?.row ?? null
}

export const attachUnassignedContextToMoment = async (db: D1Database, input: { creatorId: string; streamSessionId: string; momentId: string; anchorEventsubAt: string }) => {
  const window = chatContextWindow(input.anchorEventsubAt)
  if (!window) return
  const expiresAt = new Date(Date.now() + CHAT_CONTEXT_RETENTION_SECONDS * 1000).toISOString()
  await db.prepare("UPDATE chat_context_events SET moment_id = ?1, expires_at = ?2 WHERE creator_id = ?3 AND stream_session_id = ?4 AND moment_id IS NULL AND eventsub_timestamp >= ?5 AND eventsub_timestamp <= ?6").bind(input.momentId, expiresAt, input.creatorId, input.streamSessionId, window.start, window.end).run()
}

export const captureChatContextEvent = async (db: D1Database, input: ChatContextEventInput) => {
  const creator = await findCreatorById(db, input.creatorId)
  if (!creator || !creatorSettings(creator).communityContextEnabled) return null
  if (input.isNomination) return null
  const messageText = sanitizeChatText(input.messageText)
  if (!messageText || !input.sourceMessageId) return null
  const session = await findOrCreateStreamSession(db, input.creatorId, input.eventsubTimestamp)
  if (!session) return null
  const createdAt = nowIso()
  const expiresAt = new Date(Date.now() + CHAT_CONTEXT_BUFFER_SECONDS * 1000).toISOString()
  await db.prepare(`INSERT OR IGNORE INTO chat_context_events (id, creator_id, stream_session_id, source_message_id, message_text, eventsub_timestamp, received_at, expires_at, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`)
    .bind(newId("chat"), input.creatorId, session.id, input.sourceMessageId, messageText, input.eventsubTimestamp, input.receivedAt, expiresAt, createdAt).run()
  const moment = await nearestMoment(db, input.creatorId, session.id, input.eventsubTimestamp)
  if (moment) await db.prepare("UPDATE chat_context_events SET moment_id = ?1, expires_at = ?2 WHERE creator_id = ?3 AND source_message_id = ?4 AND moment_id IS NULL").bind(moment.id, new Date(Date.now() + CHAT_CONTEXT_RETENTION_SECONDS * 1000).toISOString(), input.creatorId, input.sourceMessageId).run()
  await db.prepare(`DELETE FROM chat_context_events
    WHERE creator_id = ?1 AND stream_session_id = ?2 AND moment_id IS NULL
      AND id NOT IN (SELECT id FROM chat_context_events WHERE creator_id = ?1 AND stream_session_id = ?2 AND moment_id IS NULL ORDER BY eventsub_timestamp DESC, id DESC LIMIT ?3)`)
    .bind(input.creatorId, session.id, CHAT_CONTEXT_MAX_BUFFER_MESSAGES).run()
  return { streamSessionId: session.id, momentId: moment?.id ?? null }
}

export const findChatContextForMoment = async (db: D1Database, creatorId: string, momentId: string, anchorEventsubAt: string) => {
  const now = nowIso()
  const rows = await db.prepare("SELECT message_text, eventsub_timestamp FROM chat_context_events WHERE creator_id = ?1 AND moment_id = ?2 AND expires_at > ?3 ORDER BY eventsub_timestamp ASC, id ASC LIMIT ?4").bind(creatorId, momentId, now, CHAT_CONTEXT_MAX_MESSAGES).all<Pick<ChatContextEventRow, "message_text" | "eventsub_timestamp">>()
  const anchorAt = Date.parse(anchorEventsubAt)
  const items = rows.results.map((row) => ({ ...row, relative_seconds: Number.isFinite(anchorAt) && Number.isFinite(Date.parse(row.eventsub_timestamp)) ? Math.round((Date.parse(row.eventsub_timestamp) - anchorAt) / 1000) : 0 }))
  let totalChars = 0
  return items.filter((item) => {
    if (totalChars + item.message_text.length > CHAT_CONTEXT_MAX_TOTAL_CHARS) return false
    totalChars += item.message_text.length
    return true
  })
}

export const refreshChatContextRetention = async (db: D1Database, momentId: string, generatedAt: string) => {
  const rows = await db.prepare("SELECT id, created_at FROM chat_context_events WHERE moment_id = ?1").bind(momentId).all<Pick<ChatContextEventRow, "id" | "created_at">>()
  const updates = rows.results.flatMap((row) => {
    const expiresAt = contextRetentionExpiry(row.created_at, generatedAt)
    return expiresAt ? [db.prepare("UPDATE chat_context_events SET expires_at = ?1 WHERE id = ?2").bind(expiresAt, row.id)] : []
  })
  if (updates.length > 0) await db.batch(updates)
}

export const deleteExpiredChatContext = (db: D1Database, at = nowIso()) =>
  db.prepare("DELETE FROM chat_context_events WHERE expires_at <= ?1").bind(at).run()

export const deleteCreatorChatContext = (db: D1Database, creatorId: string) =>
  db.prepare("DELETE FROM chat_context_events WHERE creator_id = ?1").bind(creatorId).run()
