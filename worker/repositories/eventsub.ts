import { newId, nowIso } from "../lib/ids.js"

export type EventSubRow = {
  id: string
  creator_id: string
  twitch_subscription_id: string | null
  subscription_type: string
  status: string
  condition_json: string
  reason: string | null
}

export const findSubscriptionByTwitchId = (db: D1Database, twitchSubscriptionId: string) =>
  db.prepare("SELECT * FROM eventsub_subscriptions WHERE twitch_subscription_id = ?1").bind(twitchSubscriptionId).first<EventSubRow>()

export const findSubscriptionForCreator = (db: D1Database, creatorId: string) =>
  db.prepare("SELECT * FROM eventsub_subscriptions WHERE creator_id = ?1 ORDER BY updated_at DESC LIMIT 1").bind(creatorId).first<EventSubRow>()

export const saveSubscription = (db: D1Database, input: { creatorId: string; twitchId: string; status: string; condition: Record<string, string>; reason?: string }) => {
  const timestamp = nowIso()
  return db.prepare(`INSERT INTO eventsub_subscriptions (id, creator_id, twitch_subscription_id, subscription_type, status, condition_json, reason, created_at, updated_at)
    VALUES (?1, ?2, ?3, 'channel.chat.message', ?4, ?5, ?6, ?7, ?7)
    ON CONFLICT(twitch_subscription_id) DO UPDATE SET creator_id=excluded.creator_id, status=excluded.status, condition_json=excluded.condition_json, reason=excluded.reason, updated_at=excluded.updated_at`)
    .bind(newId("sub"), input.creatorId, input.twitchId, input.status, JSON.stringify(input.condition), input.reason ?? null, timestamp).run()
}

export const updateSubscriptionStatus = (db: D1Database, twitchId: string, status: string, reason?: string) =>
  db.prepare("UPDATE eventsub_subscriptions SET status = ?1, reason = ?2, updated_at = ?3 WHERE twitch_subscription_id = ?4").bind(status, reason ?? null, nowIso(), twitchId).run()

export const disableCreatorSubscriptions = (db: D1Database, creatorId: string) =>
  db.prepare("UPDATE eventsub_subscriptions SET status = 'paused', updated_at = ?1 WHERE creator_id = ?2 AND status = 'enabled'").bind(nowIso(), creatorId).run()
