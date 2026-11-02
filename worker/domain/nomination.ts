import { creatorSettings, findCreatorById } from "../repositories/creator.js"
import { createClipJob } from "../repositories/clip.js"
import { createMoment, createNominationIfNew, findOpenMomentsForSession, refreshMomentNominatorCount, markMomentThresholdMet, findMomentForCreator } from "../repositories/moment.js"
import { findOrCreateStreamSession } from "../repositories/stream.js"
import { getCurrentStream, type TwitchApiError } from "../twitch/client.js"
import { newId, nowIso } from "../lib/ids.js"
import { sendQueueMessage } from "../queue/contracts.js"
import { attachUnassignedContextToMoment } from "./chat-context.js"

export const isMomentCommand = (text: string | null | undefined, configuredCommand = "!moment") =>
  typeof text === "string" && text.trim().toLowerCase() === configuredCommand.trim().toLowerCase()

type EventPayload = {
  broadcaster_user_id: string | null
  chatter_user_id: string | null
  message_id: string | null
  message_text: string | null
}

export type NominationResult = { accepted: boolean; reason: "NOT_COMMAND" | "INVALID_EVENT" | "DUPLICATE_VIEWER" | "ACCEPTED"; momentId?: string; uniqueNominators?: number; thresholdMet?: boolean }

export const selectGroupingCandidate = <T extends { id: string; anchor_eventsub_at: string; group_window_seconds: number }>(candidates: T[], incomingAt: number) => candidates
  .map((candidate) => ({ candidate, distance: Math.abs(Date.parse(candidate.anchor_eventsub_at) - incomingAt) }))
  .filter(({ candidate, distance }) => Number.isFinite(distance) && distance <= candidate.group_window_seconds * 1000)
  .sort((left, right) => left.distance - right.distance || left.candidate.id.localeCompare(right.candidate.id))[0]?.candidate

export const processNominationEvent = async (env: { DB: D1Database; MOMENTMINT_JOBS: Queue<import("../../shared/contracts/domain.js").QueueMessage>; TWITCH_CLIENT_ID: string; TWITCH_CLIENT_SECRET: string; TOKEN_ENCRYPTION_KEY: string }, input: { creatorId: string; eventsubTimestamp: string; receivedAt: string; payload: EventPayload }): Promise<NominationResult> => {
  const creator = await findCreatorById(env.DB, input.creatorId)
  if (!creator) return { accepted: false, reason: "INVALID_EVENT" }
  const settings = creatorSettings(creator)
  if (!isMomentCommand(input.payload.message_text, settings.nominationCommand)) return { accepted: false, reason: "NOT_COMMAND" }
  if (!input.payload.broadcaster_user_id || input.payload.broadcaster_user_id !== creator.twitch_user_id || !input.payload.chatter_user_id || !input.payload.message_id) return { accepted: false, reason: "INVALID_EVENT" }

  let streamDetails
  try {
    const stream = await getCurrentStream(env, creator)
    if (stream) streamDetails = { twitchStreamId: stream.id, title: stream.title || null, categoryName: stream.game_name || null, startedAt: stream.started_at }
  } catch (error) {
    console.error("Twitch stream lookup failed", { creatorId: creator.id, code: (error as TwitchApiError)?.code ?? (error instanceof Error ? error.message : "unknown") })
  }
  const session = await findOrCreateStreamSession(env.DB, creator.id, input.eventsubTimestamp, streamDetails)
  if (!session) return { accepted: false, reason: "INVALID_EVENT" }
  const incomingAt = Date.parse(input.eventsubTimestamp)
  if (!Number.isFinite(incomingAt)) return { accepted: false, reason: "INVALID_EVENT" }

  const candidates = await findOpenMomentsForSession(env.DB, creator.id, session.id)
  const matching = selectGroupingCandidate(candidates.results, incomingAt)
  const moment = matching ?? await createMoment(env.DB, { creatorId: creator.id, streamSessionId: session.id, anchorEventsubAt: input.eventsubTimestamp, anchorReceivedAt: input.receivedAt, groupWindowSeconds: settings.groupWindowSeconds, thresholdRequired: settings.uniqueViewerThreshold })
  if (!moment) return { accepted: false, reason: "INVALID_EVENT" }
  if (settings.communityContextEnabled) await attachUnassignedContextToMoment(env.DB, { creatorId: creator.id, streamSessionId: session.id, momentId: moment.id, anchorEventsubAt: moment.anchor_eventsub_at })

  const nomination = await createNominationIfNew(env.DB, { id: newId("nomination"), momentId: moment.id, creatorId: creator.id, viewerTwitchId: input.payload.chatter_user_id, sourceMessageId: input.payload.message_id, eventsubTimestamp: input.eventsubTimestamp, receivedAt: input.receivedAt })
  if (nomination.meta.changes === 0) {
    const current = await findMomentForCreator(env.DB, creator.id, moment.id)
    return { accepted: false, reason: "DUPLICATE_VIEWER", momentId: moment.id, uniqueNominators: current?.unique_nominator_count ?? 0, thresholdMet: current?.status === "THRESHOLD_MET" }
  }

  await refreshMomentNominatorCount(env.DB, creator.id, moment.id)
  const updated = await findMomentForCreator(env.DB, creator.id, moment.id)
  if (!updated) return { accepted: true, reason: "ACCEPTED", momentId: moment.id }
  let thresholdMet = updated.status === "THRESHOLD_MET"
  if (updated.status === "COLLECTING" && updated.unique_nominator_count >= updated.threshold_required) {
    const threshold = await markMomentThresholdMet(env.DB, creator.id, moment.id, nowIso())
    thresholdMet = threshold.meta.changes === 1 || thresholdMet
    if (threshold.meta.changes === 1 && settings.autoClipEnabled) {
      const job = await createClipJob(env.DB, { momentId: moment.id, creatorId: creator.id, triggerType: "THRESHOLD", idempotencyKey: `${moment.id}:auto` })
      if (job) {
        try {
          await sendQueueMessage(env.MOMENTMINT_JOBS, { type: "create_clip", clipJobId: job.id })
        } catch (error) {
          console.error("Automatic clip enqueue failed", { momentId: moment.id, error: error instanceof Error ? error.message : "unknown" })
        }
      }
    }
  }
  return { accepted: true, reason: "ACCEPTED", momentId: moment.id, uniqueNominators: updated.unique_nominator_count, thresholdMet }
}
