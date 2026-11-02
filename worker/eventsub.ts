import type { Context } from "hono"
import { eventSubPayloadSchema } from "../shared/contracts/domain.js"
import { constantTimeEqual, hmacSha256Hex } from "./lib/crypto.js"
import { nowIso } from "./lib/ids.js"
import { findCreatorById, findCreatorByTwitchId } from "./repositories/creator.js"
import { findSubscriptionByTwitchId, saveSubscription, updateSubscriptionStatus } from "./repositories/eventsub.js"
import { insertWebhookEvent, markWebhookQueued } from "./repositories/webhook.js"
import { sendQueueMessage } from "./queue/contracts.js"
import { deleteSubscription, listChatSubscriptions, registerChatSubscription, requiredScopes, TwitchApiError } from "./twitch/client.js"
import type { AuthContext } from "./oauth.js"
import { sanitizeChatText } from "./domain/chat-context.js"
import type { CreatorRow } from "./repositories/creator.js"

type EventSubEnv = { DB: D1Database; TWITCH_CLIENT_ID: string; TWITCH_CLIENT_SECRET: string; TOKEN_ENCRYPTION_KEY: string; APP_BASE_URL: string; EVENTSUB_SECRET?: string }

const replayWindowMs = 10 * 60_000

const validTimestamp = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null

export const safeEventPayload = (event: Record<string, unknown>) => {
  const messageText = typeof event.message === "object" && event.message !== null && "text" in event.message && typeof event.message.text === "string" ? sanitizeChatText(event.message.text) : null
  const isNomination = messageText?.toLowerCase() === "!moment"
  return {
  broadcaster_user_id: typeof event.broadcaster_user_id === "string" ? event.broadcaster_user_id : null,
  chatter_user_id: isNomination && typeof event.chatter_user_id === "string" ? event.chatter_user_id : null,
  message_id: typeof event.message_id === "string" ? event.message_id : null,
  event_timestamp: validTimestamp(event.message_timestamp),
  // Text is retained only in the short-lived webhook outbox until the queue
  // consumer converts it into creator-scoped context or clears the payload.
  message_text: messageText,
  message_type: typeof event.message_type === "string" ? event.message_type : null,
  }
}

const eventSubContext = async (c: Context<{ Bindings: AuthContext["env"] }>, payload: { subscription: { id: string; condition: { broadcaster_user_id: string } } }) => {
  const stored = await findSubscriptionByTwitchId(c.env.DB, payload.subscription.id)
  if (stored) {
    const creator = await findCreatorById(c.env.DB, stored.creator_id)
    return creator?.twitch_user_id === payload.subscription.condition.broadcaster_user_id ? creator.id : null
  }
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
    await saveSubscription(c.env.DB, { creatorId, twitchId: parsed.subscription.id, status: "enabled", condition: parsed.subscription.condition })
    return c.text(parsed.challenge ?? "", 200)
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

export const ensureCreatorEventSub = async (env: EventSubEnv, creator: CreatorRow) => {
  const eventSubSecret = env.EVENTSUB_SECRET
  if (!eventSubSecret) throw new TwitchApiError(503, "CONFIGURATION_ERROR", false, "EventSub secret is not configured.")
  let grantedScopes: string[] = []
  try {
    grantedScopes = JSON.parse(creator.scopes_json) as string[]
  } catch {
    grantedScopes = []
  }
  if (!requiredScopes.every((scope) => grantedScopes.includes(scope))) {
    throw new TwitchApiError(401, "RECONNECT_REQUIRED", false, "Required chat permissions are missing.")
  }
  const existing = await listChatSubscriptions(env, creator.twitch_user_id)
  const callback = `${env.APP_BASE_URL.replace(/\/$/, "")}/webhooks/twitch`
  const matching = existing.data.find((subscription) => subscription.type === "channel.chat.message" && subscription.condition.broadcaster_user_id === creator.twitch_user_id && subscription.condition.user_id === creator.twitch_user_id && subscription.transport?.method === "webhook" && subscription.transport.callback === callback && subscription.status === "enabled")
  const pending = existing.data.find((subscription) => subscription.type === "channel.chat.message" && subscription.condition.broadcaster_user_id === creator.twitch_user_id && subscription.condition.user_id === creator.twitch_user_id && subscription.transport?.method === "webhook" && subscription.transport.callback === callback && subscription.status === "webhook_callback_verification_pending")
  if (pending) await deleteSubscription(env, pending.id)
  const result = matching
    ? { data: [{ id: matching.id, status: matching.status, condition: matching.condition }] }
    : await registerChatSubscription({ ...env, EVENTSUB_SECRET: eventSubSecret }, creator)
  const subscription = result.data[0]
  await saveSubscription(env.DB, { creatorId: creator.id, twitchId: subscription.id, status: subscription.status, condition: subscription.condition })
  return { id: subscription.id, status: subscription.status, type: "channel.chat.message" as const }
}

export const registerEventSub = async (c: AuthContext) => {
  const creator = await findCreatorById(c.env.DB, c.get("creatorId"))
  if (!creator) return c.json({ error: { code: "NOT_FOUND", message: "Creator was not found." } }, 404)
  try {
    const subscription = await ensureCreatorEventSub(c.env, creator)
    return c.json({ data: subscription })
  } catch (error) {
    const apiError = error instanceof TwitchApiError ? error : null
    console.error("EventSub registration failed", { creatorId: creator.id, status: apiError?.status ?? 0, code: apiError?.code ?? (error instanceof Error ? error.message : "unknown"), upstreamMessage: apiError?.upstreamMessage ?? null })
    if (apiError?.code === "RECONNECT_REQUIRED") return c.json({ error: { code: "RECONNECT_REQUIRED", message: "Reconnect Twitch to refresh the authorization required for EventSub." } }, 401)
    if (apiError?.code === "TWITCH_RATE_LIMITED") return c.json({ error: { code: "TWITCH_API_ERROR", message: "Twitch is rate-limiting EventSub changes. Wait briefly and try again." } }, 429)
    const detail = apiError?.upstreamMessage?.replace(/[\r\n]+/g, " ").trim()
    return c.json({ error: { code: "TWITCH_API_ERROR", message: detail ? `Twitch rejected EventSub registration: ${detail}` : "Twitch rejected EventSub registration. Reconnect Twitch to refresh chat permissions, then try again." } }, 502)
  }
}

export const eventSubStatus = async (c: AuthContext) => {
  const creatorId = c.get("creatorId")
  const row = await c.env.DB.prepare("SELECT id, status, subscription_type, condition_json, reason, updated_at FROM eventsub_subscriptions WHERE creator_id = ?1 ORDER BY updated_at DESC LIMIT 1").bind(creatorId).first<{ id: string; status: string; subscription_type: string; condition_json: string; reason: string | null; updated_at: string }>()
  return c.json({ data: row ? { ...row, condition: JSON.parse(row.condition_json) } : null })
}
