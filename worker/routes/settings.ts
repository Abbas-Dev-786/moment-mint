import { z } from "zod"
import type { AuthContext } from "../oauth.js"
import { creatorSettings, findCreatorById } from "../repositories/creator.js"
import { findSubscriptionForCreator } from "../repositories/eventsub.js"
import { nowIso } from "../lib/ids.js"

const settingsPatchSchema = z.object({
  groupWindowSeconds: z.number().int().min(5).max(120),
  uniqueViewerThreshold: z.number().int().min(1).max(100),
  autoClipEnabled: z.boolean(),
  confirmAutoClip: z.boolean().optional(),
}).strict()

const disclosure = "Automatic clip creation is off by default. Twitch may publish a created clip according to Twitch's current behavior; review the clip and edit flow before enabling automation."

export const getSettings = async (c: AuthContext) => {
  const creator = await findCreatorById(c.env.DB, c.get("creatorId"))
  if (!creator) return c.json({ error: { code: "UNAUTHORIZED", message: "Connect Twitch to continue." } }, 401)
  const subscription = await findSubscriptionForCreator(c.env.DB, creator.id)
  return c.json({ data: { creator: { twitchLogin: creator.twitch_login, displayName: creator.display_name, scopes: JSON.parse(creator.scopes_json) as string[] }, settings: creatorSettings(creator), eventSub: subscription ? { status: subscription.status, reason: subscription.reason } : null, disclosure, chatContext: { stored: false, explanation: "MomentMint stores nomination counts and approximate timing only; ordinary chat is not retained for AI context." } } })
}

export const updateSettings = async (c: AuthContext) => {
  const creator = await findCreatorById(c.env.DB, c.get("creatorId"))
  if (!creator) return c.json({ error: { code: "UNAUTHORIZED", message: "Connect Twitch to continue." } }, 401)
  let body: unknown
  try { body = await c.req.json() } catch { body = null }
  const parsed = settingsPatchSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: { code: "BAD_REQUEST", message: "Settings are invalid." } }, 400)
  const current = creatorSettings(creator)
  if (parsed.data.autoClipEnabled && !current.autoClipEnabled && parsed.data.confirmAutoClip !== true) return c.json({ error: { code: "BAD_REQUEST", message: "Enabling automatic clips requires explicit confirmation." } }, 400)
  const settings = { nominationCommand: "!moment" as const, groupWindowSeconds: parsed.data.groupWindowSeconds, uniqueViewerThreshold: parsed.data.uniqueViewerThreshold, autoClipEnabled: parsed.data.autoClipEnabled }
  await c.env.DB.prepare("UPDATE creators SET settings_json = ?1, updated_at = ?2 WHERE id = ?3").bind(JSON.stringify(settings), nowIso(), creator.id).run()
  return c.json({ data: { settings, disclosure } })
}
