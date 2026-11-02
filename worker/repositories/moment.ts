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

const momentListSelect = `SELECT moments.*, stream_sessions.title AS stream_title, stream_sessions.category_name AS stream_category_name, stream_sessions.started_at AS stream_started_at, stream_sessions.status AS stream_status,
  (SELECT status FROM clip_jobs WHERE clip_jobs.moment_id = moments.id ORDER BY attempt_number DESC, created_at DESC LIMIT 1) AS latest_clip_status,
  (SELECT status FROM ai_metadata WHERE ai_metadata.moment_id = moments.id LIMIT 1) AS ai_status
  FROM moments JOIN stream_sessions ON stream_sessions.id = moments.stream_session_id`

export const listMomentsForCreator = (db: D1Database, creatorId: string, limit = 50, status?: string) =>
  status
    ? db.prepare(`${momentListSelect} WHERE moments.creator_id = ?1 AND moments.status = ?2 ORDER BY moments.created_at DESC LIMIT ?3`).bind(creatorId, status, limit).all<MomentRow & { stream_title: string | null; stream_category_name: string | null; stream_started_at: string | null; stream_status: string; latest_clip_status: string | null; ai_status: string | null }>()
    : db.prepare(`${momentListSelect} WHERE moments.creator_id = ?1 ORDER BY moments.created_at DESC LIMIT ?2`).bind(creatorId, limit).all<MomentRow & { stream_title: string | null; stream_category_name: string | null; stream_started_at: string | null; stream_status: string; latest_clip_status: string | null; ai_status: string | null }>()

export const findMomentWithCreator = (db: D1Database, momentId: string) =>
  db.prepare("SELECT moments.*, creators.twitch_user_id, creators.settings_json, creators.twitch_login, stream_sessions.title AS stream_title, stream_sessions.category_name, ai_metadata.creator_note FROM moments JOIN creators ON creators.id = moments.creator_id JOIN stream_sessions ON stream_sessions.id = moments.stream_session_id LEFT JOIN ai_metadata ON ai_metadata.moment_id = moments.id WHERE moments.id = ?1").bind(momentId).first<MomentRow & { twitch_user_id: string; settings_json: string; twitch_login: string; stream_title: string | null; category_name: string | null; creator_note: string | null }>()

export const findOpenMomentsForSession = (db: D1Database, creatorId: string, streamSessionId: string) =>
  db.prepare("SELECT * FROM moments WHERE creator_id = ?1 AND stream_session_id = ?2 AND status = 'COLLECTING' ORDER BY anchor_eventsub_at ASC, id ASC LIMIT 100").bind(creatorId, streamSessionId).all<MomentRow>()

export const createMoment = (db: D1Database, input: { creatorId: string; streamSessionId: string; anchorEventsubAt: string; anchorReceivedAt: string; groupWindowSeconds: number; thresholdRequired: number }) => {
  const timestamp = nowIso()
  return db.prepare("INSERT INTO moments (id, creator_id, stream_session_id, anchor_eventsub_at, anchor_received_at, group_window_seconds, threshold_required, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8) RETURNING *").bind(newId("moment"), input.creatorId, input.streamSessionId, input.anchorEventsubAt, input.anchorReceivedAt, input.groupWindowSeconds, input.thresholdRequired, timestamp).first<MomentRow>()
}

export const createNominationIfNew = (db: D1Database, input: { id: string; momentId: string; creatorId: string; viewerTwitchId: string; sourceMessageId: string; eventsubTimestamp: string; receivedAt: string }) =>
  db.prepare("INSERT OR IGNORE INTO nominations (id, moment_id, creator_id, viewer_twitch_id, source_message_id, eventsub_timestamp, received_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)").bind(input.id, input.momentId, input.creatorId, input.viewerTwitchId, input.sourceMessageId, input.eventsubTimestamp, input.receivedAt).run()

export const refreshMomentNominatorCount = (db: D1Database, creatorId: string, momentId: string) =>
  db.prepare("UPDATE moments SET unique_nominator_count = (SELECT COUNT(*) FROM nominations WHERE moment_id = moments.id), updated_at = ?1 WHERE id = ?2 AND creator_id = ?3").bind(nowIso(), momentId, creatorId).run()

export const markMomentThresholdMet = (db: D1Database, creatorId: string, momentId: string, thresholdMetAt: string) =>
  db.prepare("UPDATE moments SET status = 'THRESHOLD_MET', threshold_met_at = ?1, updated_at = ?1 WHERE id = ?2 AND creator_id = ?3 AND status = 'COLLECTING'").bind(thresholdMetAt, momentId, creatorId).run()

export const transitionMoment = (db: D1Database, creatorId: string, momentId: string, from: string, to: string) =>
  db.prepare("UPDATE moments SET status = ?1, updated_at = ?2 WHERE id = ?3 AND creator_id = ?4 AND status = ?5").bind(to, nowIso(), momentId, creatorId, from).run()
