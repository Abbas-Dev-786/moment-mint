import type { Context } from "hono"
import { eventSubPayloadSchema } from "../shared/contracts/domain.js"
import { constantTimeEqual, hmacSha256Hex } from "./lib/crypto.js"
import { nowIso } from "./lib/ids.js"
import { findCreatorById, findCreatorByTwitchId } from "./repositories/creator.js"
import { findSubscriptionByTwitchId, saveSubscription, updateSubscriptionStatus } from "./repositories/eventsub.js"
import { insertWebhookEvent, markWebhookQueued } from "./repositories/webhook.js"
import { sendQueueMessage } from "./queue/contracts.js"
import { registerChatSubscription } from "./twitch/client.js"
import type { AuthContext } from "./oauth.js"

const replayWindowMs = 10 * 60_000

const safeEventPayload = (event: Record<string, unknown>) => {
  const messageText = typeof event.message === "object" && event.message !== null && "text" in event.message && typeof event.message.text === "string" ? event.message.text.trim() : null
  return {
  broadcaster_user_id: typeof event.broadcaster_user_id === "string" ? event.broadcaster_user_id : null,
  chatter_user_id: typeof event.chatter_user_id === "string" ? event.chatter_user_id : null,
  message_id: typeof event.message_id === "string" ? event.message_id : null,
  // Only retain the exact nomination command. Ordinary chat is not a durable product record.
  message_text: messageText?.toLowerCase() === "!moment" ? messageText : null,
  message_type: typeof event.message_type === "string" ? event.message_type : null,
  }
}

const eventSubContext = async (c: Context<{ Bindings: AuthContext["env"] }>, payload: { subscription: { id: string; condition: { broadcaster_user_id: string } } }) => {
  const stored = await findSubscriptionByTwitchId(c.env.DB, payload.subscription.id)
  if (stored) return stored.creator_id
  const creator = await findCreatorByTwitchId(c.env.DB, payload.subscription.condition.broadcaster_user_id)
  return creator?.id ?? null
}

export const verifyEventSubRequest = async (c: Context<{ Bindings: AuthContext["env"] }>, rawBody: string) => {
  const messageId = c.req.header("Twitch-Eventsub-Message-Id")
  const timestamp = c.req.header("Twitch-Eventsub-Message-Timestamp")
  const signature = c.req.header("Twitch-Eventsub-Message-Signature")
  const messageType = c.req.header("Twitch-Eventsub-Message-Type")
  if (!messageId || !timestamp || !signature || !messageType) return { ok: false as const, status: 400, code: "MISSING_HEADERS" }
  const timestampMs = Date.parse(timestamp)
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > replayWindowMs) return { ok: false as const, status: 403, code: "REPLAYED_EVENT" }
  if (!c.env.EVENTSUB_SECRET) return { ok: false as const, status: 503, code: "CONFIGURATION_ERROR" }
  const expected = `sha256=${await hmacSha256Hex(messageId + timestamp + rawBody, c.env.EVENTSUB_SECRET)}`
  if (!constantTimeEqual(expected.toLowerCase(), signature.toLowerCase())) return { ok: false as const, status: 403, code: "INVALID_SIGNATURE" }
  if (!["webhook_callback_verification", "notification", "revocation"].includes(messageType)) return { ok: false as const, status: 400, code: "BAD_MESSAGE_TYPE" }
  return { ok: true as const, messageId, timestamp, messageType: messageType as "webhook_callback_verification" | "notification" | "revocation" }
}

export const webhook = async (c: Context<{ Bindings: AuthContext["env"] }>) => {
  const rawBody = await c.req.text()
  const verification = await verifyEventSubRequest(c, rawBody)
  if (!verification.ok) return c.json({ error: { code: verification.code === "INVALID_SIGNATURE" ? "INVALID_SIGNATURE" : verification.code === "REPLAYED_EVENT" ? "REPLAYED_EVENT" : "BAD_REQUEST", message: "EventSub request was rejected." } }, verification.status as 400 | 403 | 503)
  let parsed: ReturnType<typeof eventSubPayloadSchema.parse>
  try {
    parsed = eventSubPayloadSchema.parse(JSON.parse(rawBody))
  } catch {
    return c.json({ error: { code: "BAD_REQUEST", message: "Invalid EventSub payload." } }, 400)
  }
  const creatorId = await eventSubContext(c, parsed)
  if (!creatorId) return c.json({ error: { code: "FORBIDDEN", message: "Unknown EventSub subscription." } }, 403)

  if (verification.messageType === "webhook_callback_verification") {
    return c.text(typeof parsed.event.challenge === "string" ? parsed.event.challenge : "", 200)
  }

  if (verification.messageType === "revocation") {
    await updateSubscriptionStatus(c.env.DB, parsed.subscription.id, "revoked", typeof parsed.event.reason === "string" ? parsed.event.reason : "TWITCH_REVOKED")
    const event = await insertWebhookEvent(c.env.DB, { twitch_message_id: verification.messageId, creator_id: creatorId, message_type: "revocation", eventsub_timestamp: verification.timestamp, received_at: nowIso(), payload_json: JSON.stringify({ reason: parsed.event.reason ?? "TWITCH_REVOKED" }) })
    if (event.inserted) await c.env.DB.prepare("UPDATE creators SET connection_status = 'RECONNECT_REQUIRED', updated_at = ?1 WHERE id = ?2").bind(nowIso(), creatorId).run()
    return new Response(null, { status: 204 })
  }

  const event = await insertWebhookEvent(c.env.DB, { twitch_message_id: verification.messageId, creator_id: creatorId, message_type: "notification", eventsub_timestamp: verification.timestamp, received_at: nowIso(), payload_json: JSON.stringify(safeEventPayload(parsed.event)) })
  if (!event.inserted) return c.text("", 202)
  try {
    await sendQueueMessage(c.env.MOMENTMINT_JOBS, { type: "process_event", eventId: event.id })
    await markWebhookQueued(c.env.DB, event.id)
  } catch (error) {
    console.error("EventSub outbox enqueue failed", { eventId: event.id, error: error instanceof Error ? error.message : "unknown" })
  }
  return c.text("", 202)
}

export const registerEventSub = async (c: AuthContext) => {
  const eventSubSecret = c.env.EVENTSUB_SECRET
  if (!eventSubSecret) return c.json({ error: { code: "CONFIGURATION_ERROR", message: "EventSub secret is not configured." } }, 503)
  const creator = await findCreatorById(c.env.DB, c.get("creatorId"))
  if (!creator) return c.json({ error: { code: "NOT_FOUND", message: "Creator was not found." } }, 404)
  try {
    const result = await registerChatSubscription({ ...c.env, EVENTSUB_SECRET: eventSubSecret }, creator)
    const subscription = result.data[0]
    await saveSubscription(c.env.DB, { creatorId: creator.id, twitchId: subscription.id, status: subscription.status, condition: subscription.condition })
    return c.json({ data: { id: subscription.id, status: subscription.status, type: "channel.chat.message" } })
  } catch (error) {
    console.error("EventSub registration failed", { creatorId: creator.id, error: error instanceof Error ? error.message : "unknown" })
    return c.json({ error: { code: "TWITCH_API_ERROR", message: "Twitch EventSub registration failed." } }, 502)
  }
}

export const eventSubStatus = async (c: AuthContext) => {
  const creatorId = c.get("creatorId")
  const row = await c.env.DB.prepare("SELECT id, status, subscription_type, condition_json, reason, updated_at FROM eventsub_subscriptions WHERE creator_id = ?1 ORDER BY updated_at DESC LIMIT 1").bind(creatorId).first<{ id: string; status: string; subscription_type: string; condition_json: string; reason: string | null; updated_at: string }>()
  return c.json({ data: row ? { ...row, condition: JSON.parse(row.condition_json) } : null })
}
