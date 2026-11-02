import { env, SELF } from "cloudflare:test"
import { expect, it } from "vitest"

import { attachUnassignedContextToMoment, captureChatContextEvent, deleteExpiredChatContext, findChatContextForMoment } from "../../worker/domain/chat-context.js"
import { findOrCreateStreamSession } from "../../worker/repositories/stream.js"

it("serves the Worker health contract", async () => {
  const response = await SELF.fetch("https://momentmint.test/health")

  expect(response.status).toBe(200)
  await expect(response.json()).resolves.toEqual({
    data: {
      service: "momentmint-worker",
      status: "ok",
    },
  })
})

it("serves the database readiness contract", async () => {
  const response = await SELF.fetch("https://momentmint.test/health/ready")

  expect(response.status).toBe(200)
  await expect(response.json()).resolves.toMatchObject({
    data: {
      service: "momentmint-worker",
      status: "ready",
      checks: { database: "ok", configuration: "ok" },
    },
  })
})

it("captures bounded, deduplicated, creator-scoped context and cleans expired rows", async () => {
  const creatorId = `test_creator_${crypto.randomUUID()}`
  const otherCreatorId = `test_creator_${crypto.randomUUID()}`
  const anchor = "2026-10-30T00:00:00.000Z"
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS creators (id TEXT PRIMARY KEY, twitch_user_id TEXT NOT NULL UNIQUE, twitch_login TEXT NOT NULL, display_name TEXT NOT NULL, settings_json TEXT NOT NULL, connection_status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS stream_sessions (id TEXT PRIMARY KEY, creator_id TEXT NOT NULL, twitch_stream_id TEXT, title TEXT, category_name TEXT, started_at TEXT, ended_at TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS moments (id TEXT PRIMARY KEY, creator_id TEXT NOT NULL, stream_session_id TEXT NOT NULL, anchor_eventsub_at TEXT NOT NULL, anchor_received_at TEXT NOT NULL, group_window_seconds INTEGER NOT NULL, threshold_required INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'COLLECTING', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS chat_context_events (id TEXT PRIMARY KEY, creator_id TEXT NOT NULL, moment_id TEXT, stream_session_id TEXT NOT NULL, source_message_id TEXT NOT NULL UNIQUE, message_text TEXT NOT NULL, eventsub_timestamp TEXT NOT NULL, received_at TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
  `)
  const insertCreator = (id: string) => env.DB.prepare(`INSERT INTO creators (id, twitch_user_id, twitch_login, display_name, settings_json, connection_status, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, 'CONNECTED', ?6, ?6)`).bind(id, id, id, id, JSON.stringify({ nominationCommand: "!moment", groupWindowSeconds: 30, uniqueViewerThreshold: 2, autoClipEnabled: false, communityContextEnabled: true }), anchor)
  try {
    await env.DB.batch([insertCreator(creatorId), insertCreator(otherCreatorId)])

    await captureChatContextEvent(env.DB, { creatorId, sourceMessageId: "message_before", messageText: "before", eventsubTimestamp: "2026-10-29T23:58:59.000Z", receivedAt: anchor })
    await captureChatContextEvent(env.DB, { creatorId, sourceMessageId: "message_start", messageText: "at the start", eventsubTimestamp: "2026-10-29T23:59:00.000Z", receivedAt: anchor })
    await captureChatContextEvent(env.DB, { creatorId, sourceMessageId: "message_end", messageText: "at the end", eventsubTimestamp: "2026-10-30T00:00:30.000Z", receivedAt: anchor })
    await captureChatContextEvent(env.DB, { creatorId, sourceMessageId: "message_after", messageText: "after", eventsubTimestamp: "2026-10-30T00:00:31.000Z", receivedAt: anchor })
    await captureChatContextEvent(env.DB, { creatorId, sourceMessageId: "message_start", messageText: "duplicate", eventsubTimestamp: "2026-10-29T23:59:00.000Z", receivedAt: anchor })
    await captureChatContextEvent(env.DB, { creatorId, sourceMessageId: "nomination", messageText: "!moment", eventsubTimestamp: anchor, receivedAt: anchor, isNomination: true })

    const session = await env.DB.prepare("SELECT id FROM stream_sessions WHERE creator_id = ?1 LIMIT 1").bind(creatorId).first<{ id: string }>()
    expect(session).not.toBeNull()
    const momentId = `test_moment_${crypto.randomUUID()}`
    await env.DB.prepare(`INSERT INTO moments (id, creator_id, stream_session_id, anchor_eventsub_at, anchor_received_at, group_window_seconds, threshold_required, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?4, 30, 2, ?4, ?4)`).bind(momentId, creatorId, session?.id, anchor).run()
    await attachUnassignedContextToMoment(env.DB, { creatorId, streamSessionId: session?.id ?? "", momentId, anchorEventsubAt: anchor })

    const context = await findChatContextForMoment(env.DB, creatorId, momentId, anchor)
    expect(context.map((item) => item.message_text)).toEqual(["at the start", "at the end"])
    expect(await findChatContextForMoment(env.DB, otherCreatorId, momentId, anchor)).toEqual([])

    await env.DB.prepare("UPDATE chat_context_events SET expires_at = ?1 WHERE moment_id = ?2").bind("2020-01-01T00:00:00.000Z", momentId).run()
    await deleteExpiredChatContext(env.DB, "2021-01-01T00:00:00.000Z")
    expect(await findChatContextForMoment(env.DB, creatorId, momentId, anchor)).toEqual([])

    const firstStream = await findOrCreateStreamSession(env.DB, creatorId, anchor, { twitchStreamId: "twitch_stream_1", title: "First broadcast", categoryName: "Game one", startedAt: anchor })
    const secondStream = await findOrCreateStreamSession(env.DB, creatorId, "2026-10-30T01:00:00.000Z", { twitchStreamId: "twitch_stream_2", title: "Second broadcast", categoryName: "Game two", startedAt: "2026-10-30T01:00:00.000Z" })
    expect(firstStream?.id).not.toBe(secondStream?.id)
    await expect(env.DB.prepare("SELECT status FROM stream_sessions WHERE id = ?1").bind(firstStream?.id).first<{ status: string }>()).resolves.toEqual({ status: "ENDED" })
  } finally {
    await env.DB.prepare("DELETE FROM creators WHERE id IN (?1, ?2)").bind(creatorId, otherCreatorId).run()
  }
})
