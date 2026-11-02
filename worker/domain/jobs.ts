import { encryptSecret } from "../lib/crypto.js"
import { creatorSettings, updateCreatorStatus } from "../repositories/creator.js"
import { claimClipJob, findClipJobWithCreator, markClipJob, requeueClipJob, saveClipCreation, saveClipVerification } from "../repositories/clip.js"
import { findMetadataForCreator } from "../repositories/metadata.js"
import { findMomentWithCreator } from "../repositories/moment.js"
import { createClipFromMoment, getClip, TwitchApiError } from "../twitch/client.js"
import { generateMetadata, saveGeneratedMetadata } from "../ai/metadata.js"
import type { QueueMessage } from "../../shared/contracts/domain.js"

type JobEnv = {
  DB: D1Database
  MOMENTMINT_JOBS: Queue<QueueMessage>
  AI?: Ai
  AI_MODEL_ID: string
  TOKEN_ENCRYPTION_KEY: string
  TWITCH_CLIENT_ID: string
  TWITCH_CLIENT_SECRET: string
}

export const CLIP_VERIFICATION_DEADLINE_SECONDS = 60
export const MAX_CLIP_VERIFICATION_ATTEMPTS = 5

const verificationDelaySeconds = (attempt: number) => [5, 10, 15, 20, 0][Math.max(0, Math.min(attempt, MAX_CLIP_VERIFICATION_ATTEMPTS) - 1)] ?? 20

export const shouldRetryClipCreation = (code: string, startedAt: string | null, now = Date.now()) => {
  if (!startedAt || !["TWITCH_VOD_NOT_FOUND", "TWITCH_VOD_NOT_READY"].includes(code)) return false
  const startedMs = Date.parse(startedAt)
  return Number.isFinite(startedMs) && now < startedMs + CLIP_VERIFICATION_DEADLINE_SECONDS * 1000
}

const clipCreator = (job: Awaited<ReturnType<typeof findClipJobWithCreator>>) => job && ({
  id: job.creator_id,
  twitch_user_id: job.twitch_user_id,
  access_token_ciphertext: job.access_token_ciphertext,
  access_token_iv: job.access_token_iv,
  refresh_token_ciphertext: job.refresh_token_ciphertext,
  refresh_token_iv: job.refresh_token_iv,
  token_expires_at: job.token_expires_at,
})

const markMomentClipFailed = (db: D1Database, job: { moment_id: string; creator_id: string }) =>
  db.prepare("UPDATE moments SET status = 'CLIP_FAILED', updated_at = ?1 WHERE id = ?2 AND creator_id = ?3 AND status IN ('THRESHOLD_MET','CLIP_REQUESTED','CLIP_FAILED','REVIEWED','DISMISSED')").bind(new Date().toISOString(), job.moment_id, job.creator_id).run()

const markMomentManualReview = (db: D1Database, job: { moment_id: string; creator_id: string }) =>
  db.prepare("UPDATE moments SET status = 'MANUAL_REVIEW', updated_at = ?1 WHERE id = ?2 AND creator_id = ?3 AND status IN ('THRESHOLD_MET','CLIP_REQUESTED','CLIP_FAILED','REVIEWED','DISMISSED')").bind(new Date().toISOString(), job.moment_id, job.creator_id).run()

const enqueueVerification = async (env: JobEnv, clipJobId: string, attempt: number) => {
  try {
    await env.MOMENTMINT_JOBS.send({ type: "verify_clip", clipJobId, attempt }, { delaySeconds: verificationDelaySeconds(attempt) })
    return true
  } catch (error) {
    console.error("Clip verification enqueue failed", { clipJobId, attempt, error: error instanceof Error ? error.message : "unknown" })
    return false
  }
}

const enqueueClipCreationRetry = async (env: JobEnv, clipJobId: string) => {
  try {
    await env.MOMENTMINT_JOBS.send({ type: "create_clip", clipJobId }, { delaySeconds: 10 })
    return true
  } catch (error) {
    console.error("Clip creation retry enqueue failed", { clipJobId, error: error instanceof Error ? error.message : "unknown" })
    return false
  }
}

export const processCreateClip = async (clipJobId: string, env: JobEnv) => {
  const job = await findClipJobWithCreator(env.DB, clipJobId)
  if (!job || job.status !== "QUEUED") return
  const claimed = await claimClipJob(env.DB, clipJobId)
  if (claimed.meta.changes !== 1) return
  const creator = clipCreator(job)
  if (!creator) {
    await markClipJob(env.DB, clipJobId, "FAILED", "CREATOR_NOT_FOUND")
    await markMomentClipFailed(env.DB, job)
    return
  }
  if (job.trigger_type === "THRESHOLD" && !creatorSettings({ settings_json: job.settings_json }).autoClipEnabled) {
    await markClipJob(env.DB, clipJobId, "FAILED", "AUTO_CLIP_DISABLED")
    await markMomentClipFailed(env.DB, job)
    return
  }
  const creationStartedAt = job.request_at ?? new Date().toISOString()
  try {
    const created = await createClipFromMoment(env, creator, job.anchor_eventsub_at)
    const edit = await encryptSecret(created.editUrl, env.TOKEN_ENCRYPTION_KEY)
    const deadline = new Date(Date.now() + CLIP_VERIFICATION_DEADLINE_SECONDS * 1000).toISOString()
    const saved = await saveClipCreation(env.DB, clipJobId, { clipId: created.id, editUrlCiphertext: edit.ciphertext, editUrlIv: edit.iv, deadline })
    if (saved.meta.changes !== 1) throw new Error("CLIP_CREATION_STATE_SAVE_FAILED")
    await enqueueVerification(env, clipJobId, 1)
  } catch (error) {
    const apiError = error instanceof TwitchApiError ? error : new TwitchApiError(0, error instanceof Error && error.message === "RECONNECT_REQUIRED" ? "RECONNECT_REQUIRED" : "TWITCH_NETWORK_ERROR", true)
    console.error("Clip creation failed", { clipJobId, code: apiError.code, detail: apiError.upstreamMessage ?? null })
    if (apiError.code === "RECONNECT_REQUIRED") await updateCreatorStatus(env.DB, job.creator_id, "RECONNECT_REQUIRED")
    if (shouldRetryClipCreation(apiError.code, creationStartedAt)) {
      const requeued = await requeueClipJob(env.DB, clipJobId, apiError.code)
      if (requeued.meta.changes === 1 && await enqueueClipCreationRetry(env, clipJobId)) return
    }
    await markClipJob(env.DB, clipJobId, apiError.retryable ? "RETRYABLE_FAILED" : "FAILED", apiError.code)
    await markMomentClipFailed(env.DB, job)
  }
}

export const processVerifyClip = async (clipJobId: string, attempt: number, env: JobEnv) => {
  const job = await findClipJobWithCreator(env.DB, clipJobId)
  if (!job || job.status !== "VERIFYING" || !job.twitch_clip_id || !job.verify_deadline_at) return
  const creator = clipCreator(job)
  if (!creator) return
  try {
    const clip = await getClip(env, creator, job.twitch_clip_id)
    if (clip) {
      await saveClipVerification(env.DB, clipJobId, { clipUrl: clip.url, embedUrl: clip.embed_url, thumbnailUrl: clip.thumbnail_url, title: clip.title, duration: clip.duration, verifiedAt: new Date().toISOString() })
      await env.DB.prepare("UPDATE moments SET status = 'CLIP_READY', updated_at = ?1 WHERE id = ?2 AND creator_id = ?3 AND status IN ('CLIP_REQUESTED','CLIP_FAILED','THRESHOLD_MET','REVIEWED','DISMISSED')").bind(new Date().toISOString(), job.moment_id, job.creator_id).run()
      return
    }
    if (Date.now() < Date.parse(job.verify_deadline_at) && attempt < MAX_CLIP_VERIFICATION_ATTEMPTS) {
      await enqueueVerification(env, clipJobId, attempt + 1)
      return
    }
    await markClipJob(env.DB, clipJobId, "MANUAL_REVIEW", "CLIP_NOT_RETRIEVABLE")
    await env.DB.prepare("UPDATE moments SET status = 'MANUAL_REVIEW', updated_at = ?1 WHERE id = ?2 AND creator_id = ?3").bind(new Date().toISOString(), job.moment_id, job.creator_id).run()
  } catch (error) {
    const apiError = error instanceof TwitchApiError ? error : new TwitchApiError(0, error instanceof Error && error.message === "RECONNECT_REQUIRED" ? "RECONNECT_REQUIRED" : "TWITCH_NETWORK_ERROR", true)
    console.error("Clip verification failed", { clipJobId, code: apiError.code, detail: apiError.upstreamMessage ?? null })
    if (apiError.code === "RECONNECT_REQUIRED") await updateCreatorStatus(env.DB, job.creator_id, "RECONNECT_REQUIRED")
    if (apiError.retryable && Date.now() < Date.parse(job.verify_deadline_at) && attempt < MAX_CLIP_VERIFICATION_ATTEMPTS) {
      await enqueueVerification(env, clipJobId, attempt + 1)
      return
    }
    const terminalStatus = apiError.retryable ? "MANUAL_REVIEW" : "FAILED"
    await markClipJob(env.DB, clipJobId, terminalStatus, apiError.code)
    if (apiError.retryable) await markMomentManualReview(env.DB, job)
    else await markMomentClipFailed(env.DB, job)
  }
}

export const processGenerateMetadata = async (momentId: string, env: JobEnv) => {
  const moment = await findMomentWithCreator(env.DB, momentId)
  if (!moment) return
  const existing = await findMetadataForCreator(env.DB, moment.creator_id, momentId)
  if (!existing || existing.status !== "PENDING") return
  const result = await generateMetadata(env, moment)
  await saveGeneratedMetadata(env, moment, result)
}
