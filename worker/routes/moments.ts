import { z } from "zod"
import { aiMetadataRequestSchema, aiMetadataSchema } from "../../shared/contracts/domain.js"
import { canTransitionMoment, type MomentStatus } from "../../shared/contracts/states.js"
import type { AuthContext } from "../oauth.js"
import { clampPageSize } from "../lib/ids.js"
import { createClipJob, findActiveClipJobForMoment, findClipJobForCreator, findLatestClipJobForMoment } from "../repositories/clip.js"
import { findMetadataForCreator } from "../repositories/metadata.js"
import { findMomentForCreator, findMomentWithCreator, listMomentsForCreator, transitionMoment } from "../repositories/moment.js"
import { fallbackMetadata } from "../ai/metadata.js"
import { sendQueueMessage } from "../queue/contracts.js"
import { upsertMetadataForCreator } from "../repositories/metadata.js"
import { decryptSecret } from "../lib/crypto.js"

const clipRequestSchema = z.object({ confirm: z.literal(true) }).strict()
const reviewSchema = z.object({ status: z.enum(["REVIEWED", "DISMISSED"]) }).strict()
const allowedMomentStatuses = new Set(["COLLECTING", "THRESHOLD_MET", "CLIP_REQUESTED", "CLIP_READY", "REVIEWED", "DISMISSED", "CLIP_FAILED", "MANUAL_REVIEW"])
const routeParam = (c: AuthContext, name: string) => c.req.param(name) ?? ""

const enqueueClip = async (c: AuthContext, momentId: string, triggerType: "MANUAL" | "THRESHOLD" = "MANUAL") => {
  const creatorId = c.get("creatorId")
  const active = await findActiveClipJobForMoment(c.env.DB, creatorId, momentId)
  if (active) return { job: active, created: false }
  const latest = await findLatestClipJobForMoment(c.env.DB, creatorId, momentId)
  const job = await createClipJob(c.env.DB, { momentId, creatorId, triggerType, attemptNumber: (latest?.attempt_number ?? 0) + 1, idempotencyKey: `${momentId}:manual:${crypto.randomUUID()}` })
  if (!job) throw new Error("CLIP_JOB_CREATE_FAILED")
  await transitionMoment(c.env.DB, creatorId, momentId, "COLLECTING", "CLIP_REQUESTED")
  await transitionMoment(c.env.DB, creatorId, momentId, "THRESHOLD_MET", "CLIP_REQUESTED")
  await transitionMoment(c.env.DB, creatorId, momentId, "CLIP_FAILED", "CLIP_REQUESTED")
  await transitionMoment(c.env.DB, creatorId, momentId, "MANUAL_REVIEW", "CLIP_REQUESTED")
  await transitionMoment(c.env.DB, creatorId, momentId, "REVIEWED", "CLIP_REQUESTED")
  await transitionMoment(c.env.DB, creatorId, momentId, "DISMISSED", "CLIP_REQUESTED")
  try {
    await sendQueueMessage(c.env.MOMENTMINT_JOBS, { type: "create_clip", clipJobId: job.id })
  } catch (error) {
    console.error("Manual clip enqueue failed", { momentId, error: error instanceof Error ? error.message : "unknown" })
  }
  return { job, created: true }
}

export const listMoments = async (c: AuthContext) => {
  const status = new URL(c.req.url).searchParams.get("status") ?? undefined
  const safeStatus = status && allowedMomentStatuses.has(status) ? status : undefined
  const rows = await listMomentsForCreator(c.env.DB, c.get("creatorId"), clampPageSize(new URL(c.req.url).searchParams.get("limit") ?? undefined), safeStatus)
  return c.json({ data: rows.results })
}

export const getMoment = async (c: AuthContext) => {
  const momentId = routeParam(c, "momentId")
  const moment = await findMomentForCreator(c.env.DB, c.get("creatorId"), momentId)
  if (!moment) return c.json({ error: { code: "NOT_FOUND", message: "Moment was not found." } }, 404)
  const nominations = await c.env.DB.prepare("SELECT id, eventsub_timestamp, received_at, created_at FROM nominations WHERE moment_id = ?1 AND creator_id = ?2 ORDER BY created_at ASC").bind(momentId, c.get("creatorId")).all()
  const clips = await c.env.DB.prepare("SELECT id, attempt_number, trigger_type, status, twitch_clip_id, clip_url, embed_url, thumbnail_url, clip_title, clip_duration_seconds, request_at, verify_deadline_at, verified_at, error_code, created_at, updated_at FROM clip_jobs WHERE moment_id = ?1 AND creator_id = ?2 ORDER BY attempt_number DESC").bind(momentId, c.get("creatorId")).all()
  const metadata = await findMetadataForCreator(c.env.DB, c.get("creatorId"), momentId)
  return c.json({ data: { moment, nominations: nominations.results, clips: clips.results, metadata } })
}

export const requestClip = async (c: AuthContext) => {
  const momentId = routeParam(c, "momentId")
  const moment = await findMomentForCreator(c.env.DB, c.get("creatorId"), momentId)
  if (!moment) return c.json({ error: { code: "NOT_FOUND", message: "Moment was not found." } }, 404)
  let body: unknown
  try { body = await c.req.json() } catch { body = null }
  if (!clipRequestSchema.safeParse(body).success) return c.json({ error: { code: "BAD_REQUEST", message: "Clip creation requires explicit confirmation." } }, 400)
  const result = await enqueueClip(c, momentId)
  return c.json({ data: { clipJob: result.job, queued: result.created } }, result.created ? 202 : 200)
}

export const retryClip = async (c: AuthContext) => {
  const job = await findClipJobForCreator(c.env.DB, c.get("creatorId"), routeParam(c, "clipJobId"))
  if (!job) return c.json({ error: { code: "NOT_FOUND", message: "Clip job was not found." } }, 404)
  if (!["FAILED", "RETRYABLE_FAILED", "MANUAL_REVIEW"].includes(job.status)) return c.json({ error: { code: "BAD_REQUEST", message: "This clip job is not eligible for retry." } }, 400)
  const result = await enqueueClip(c, job.moment_id)
  return c.json({ data: { clipJob: result.job, queued: result.created } }, result.created ? 202 : 200)
}

export const reviewMoment = async (c: AuthContext) => {
  const moment = await findMomentForCreator(c.env.DB, c.get("creatorId"), routeParam(c, "momentId"))
  if (!moment) return c.json({ error: { code: "NOT_FOUND", message: "Moment was not found." } }, 404)
  let body: unknown
  try { body = await c.req.json() } catch { body = null }
  const parsed = reviewSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: { code: "BAD_REQUEST", message: "Review status is invalid." } }, 400)
  if (!canTransitionMoment(moment.status as MomentStatus, parsed.data.status)) return c.json({ error: { code: "BAD_REQUEST", message: "This moment cannot enter that review state." } }, 400)
  await transitionMoment(c.env.DB, c.get("creatorId"), moment.id, moment.status, parsed.data.status)
  return c.json({ data: { status: parsed.data.status } })
}

export const editMetadata = async (c: AuthContext) => {
  const creatorId = c.get("creatorId")
  const moment = await findMomentWithCreator(c.env.DB, routeParam(c, "momentId"))
  if (!moment || moment.creator_id !== creatorId) return c.json({ error: { code: "NOT_FOUND", message: "Moment was not found." } }, 404)
  let body: unknown
  try { body = await c.req.json() } catch { body = null }
  const parsed = aiMetadataSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: { code: "BAD_REQUEST", message: "Metadata is invalid." } }, 400)
  const existing = await findMetadataForCreator(c.env.DB, creatorId, moment.id)
  await upsertMetadataForCreator(c.env.DB, { creatorId, momentId: moment.id, modelId: existing?.model_id ?? c.env.AI_MODEL_ID, status: "READY", ...parsed.data, socialCaption: parsed.data.socialCaption, promptVersion: existing?.prompt_version ?? "manual-edit", generatedAt: existing?.generated_at ?? new Date().toISOString() })
  return c.json({ data: { metadata: await findMetadataForCreator(c.env.DB, creatorId, moment.id) } })
}

export const getClipEditUrl = async (c: AuthContext) => {
  const job = await findClipJobForCreator(c.env.DB, c.get("creatorId"), routeParam(c, "clipJobId"))
  if (!job) return c.json({ error: { code: "NOT_FOUND", message: "Clip job was not found." } }, 404)
  if (!job.edit_url_ciphertext || !job.edit_url_iv) return c.json({ error: { code: "NOT_FOUND", message: "Twitch has not returned an edit URL for this clip." } }, 404)
  try {
    const editUrl = await decryptSecret(job.edit_url_ciphertext, job.edit_url_iv, c.env.TOKEN_ENCRYPTION_KEY)
    return c.json({ data: { editUrl } })
  } catch {
    return c.json({ error: { code: "INTERNAL_ERROR", message: "The clip edit URL could not be opened." } }, 500)
  }
}

export const requestMetadata = async (c: AuthContext) => {
  const creatorId = c.get("creatorId")
  const moment = await findMomentWithCreator(c.env.DB, routeParam(c, "momentId"))
  if (!moment || moment.creator_id !== creatorId) return c.json({ error: { code: "NOT_FOUND", message: "Moment was not found." } }, 404)
  let body: unknown
  try { body = await c.req.json() } catch { body = {} }
  const parsed = aiMetadataRequestSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: { code: "BAD_REQUEST", message: "Creator note is invalid." } }, 400)
  const existing = await findMetadataForCreator(c.env.DB, creatorId, moment.id)
  if (existing?.status === "PENDING") return c.json({ data: { metadata: existing, queued: false } }, 202)
  const fallback = fallbackMetadata(moment)
  await upsertMetadataForCreator(c.env.DB, { creatorId, momentId: moment.id, modelId: c.env.AI_MODEL_ID, status: "PENDING", ...fallback, promptVersion: "metadata-v1", creatorNote: parsed.data.creatorNote ?? null, generatedAt: null })
  try {
    await sendQueueMessage(c.env.MOMENTMINT_JOBS, { type: "generate_metadata", momentId: moment.id })
  } catch (error) {
    console.error("Metadata enqueue failed", { momentId: moment.id, error: error instanceof Error ? error.message : "unknown" })
  }
  return c.json({ data: { metadata: await findMetadataForCreator(c.env.DB, creatorId, moment.id), queued: true } }, 202)
}
