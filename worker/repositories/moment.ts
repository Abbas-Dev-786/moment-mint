import { newId, nowIso } from "../lib/ids.js"

export type MomentRow = {
  id: string
  creator_id: string
  stream_session_id: string
  anchor_eventsub_at: string
  anchor_received_at: string
  group_window_seconds: number
  unique_nominator_count: number
  threshold_required: number
  threshold_met_at: string | null
  status: string
  created_at: string
  updated_at: string
}

export const findMomentForCreator = (db: D1Database, creatorId: string, momentId: string) =>
  db.prepare("SELECT * FROM moments WHERE id = ?1 AND creator_id = ?2").bind(momentId, creatorId).first<MomentRow>()

export const listMomentsForCreator = (db: D1Database, creatorId: string, limit = 50) =>
  db.prepare("SELECT * FROM moments WHERE creator_id = ?1 ORDER BY created_at DESC LIMIT ?2").bind(creatorId, limit).all<MomentRow>()

export const createMoment = (db: D1Database, input: { creatorId: string; streamSessionId: string; anchorEventsubAt: string; anchorReceivedAt: string; groupWindowSeconds: number; thresholdRequired: number }) => {
  const timestamp = nowIso()
  return db.prepare("INSERT INTO moments (id, creator_id, stream_session_id, anchor_eventsub_at, anchor_received_at, group_window_seconds, threshold_required, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8) RETURNING *").bind(newId("moment"), input.creatorId, input.streamSessionId, input.anchorEventsubAt, input.anchorReceivedAt, input.groupWindowSeconds, input.thresholdRequired, timestamp).first<MomentRow>()
}

export const createNominationIfNew = (db: D1Database, input: { id: string; momentId: string; creatorId: string; viewerTwitchId: string; sourceMessageId: string; eventsubTimestamp: string; receivedAt: string }) =>
  db.prepare("INSERT OR IGNORE INTO nominations (id, moment_id, creator_id, viewer_twitch_id, source_message_id, eventsub_timestamp, received_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)").bind(input.id, input.momentId, input.creatorId, input.viewerTwitchId, input.sourceMessageId, input.eventsubTimestamp, input.receivedAt).run()

export const refreshMomentNominatorCount = (db: D1Database, creatorId: string, momentId: string) =>
  db.prepare("UPDATE moments SET unique_nominator_count = (SELECT COUNT(*) FROM nominations WHERE moment_id = moments.id), updated_at = ?1 WHERE id = ?2 AND creator_id = ?3").bind(nowIso(), momentId, creatorId).run()
