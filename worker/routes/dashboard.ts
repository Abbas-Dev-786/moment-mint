import type { AuthContext } from "../oauth.js"
import { creatorSettings, findCreatorById } from "../repositories/creator.js"
import { findSubscriptionForCreator } from "../repositories/eventsub.js"
import { findCurrentStreamSession, findOrCreateStreamSession } from "../repositories/stream.js"
import { getCurrentStream } from "../twitch/client.js"

export const dashboardOverview = async (c: AuthContext) => {
  const creatorId = c.get("creatorId")
  const creator = await findCreatorById(c.env.DB, creatorId)
  if (!creator) return c.json({ error: { code: "UNAUTHORIZED", message: "Connect Twitch to continue." } }, 401)
  let streamSession = await findCurrentStreamSession(c.env.DB, creatorId)
  try {
    const currentStream = await getCurrentStream(c.env, creator)
    if (currentStream) streamSession = await findOrCreateStreamSession(c.env.DB, creatorId, currentStream.started_at, { twitchStreamId: currentStream.id, title: currentStream.title || null, categoryName: currentStream.game_name || null, startedAt: currentStream.started_at })
  } catch (error) {
    console.error("Dashboard stream sync failed", { creatorId, code: error instanceof Error ? error.message : "unknown" })
  }
  const [subscription, nominations, moments, clips, readyClips, processingClips] = await Promise.all([
    findSubscriptionForCreator(c.env.DB, creatorId),
    c.env.DB.prepare("SELECT COUNT(*) AS count FROM nominations WHERE creator_id = ?1 AND date(received_at) = date('now')").bind(creatorId).first<{ count: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) AS count FROM moments WHERE creator_id = ?1").bind(creatorId).first<{ count: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) AS count FROM clip_jobs WHERE creator_id = ?1").bind(creatorId).first<{ count: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) AS count FROM clip_jobs WHERE creator_id = ?1 AND status = 'READY_FOR_REVIEW'").bind(creatorId).first<{ count: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) AS count FROM clip_jobs WHERE creator_id = ?1 AND status IN ('QUEUED','CREATING','VERIFYING')").bind(creatorId).first<{ count: number }>(),
  ])
  return c.json({ data: {
    connection: { status: creator.connection_status, twitchLogin: creator.twitch_login, displayName: creator.display_name, scopes: JSON.parse(creator.scopes_json) as string[] },
    eventSub: subscription ? { status: subscription.status, reason: subscription.reason } : null,
    stream: streamSession ? { status: streamSession.status, title: streamSession.title, categoryName: streamSession.category_name, startedAt: streamSession.started_at } : null,
    metrics: { nominationsToday: nominations?.count ?? 0, moments: moments?.count ?? 0, clipCandidates: clips?.count ?? 0, readyClips: readyClips?.count ?? 0, processingClips: processingClips?.count ?? 0 },
    settings: creatorSettings(creator),
    lastUpdatedAt: new Date().toISOString(),
  } })
}
