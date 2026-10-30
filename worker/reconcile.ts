import { findPendingWebhookEvents, markWebhookQueued } from "./repositories/webhook.js"
import { sendQueueMessage } from "./queue/contracts.js"

export const reconcile = async (env: { DB: D1Database; MOMENTMINT_JOBS: Queue<import("../shared/contracts/domain.js").QueueMessage> }) => {
  const pending = await findPendingWebhookEvents(env.DB, 50)
  let requeued = 0
  for (const event of pending.results) {
    await markWebhookQueued(env.DB, event.id)
    await sendQueueMessage(env.MOMENTMINT_JOBS, { type: "process_event", eventId: event.id })
    requeued += 1
  }
  const staleClipJobs = await env.DB.prepare("SELECT id FROM clip_jobs WHERE status = 'QUEUED' AND updated_at < ?1 ORDER BY updated_at ASC LIMIT 50").bind(new Date(Date.now() - 30_000).toISOString()).all<{ id: string }>()
  for (const job of staleClipJobs.results) {
    try {
      await sendQueueMessage(env.MOMENTMINT_JOBS, { type: "create_clip", clipJobId: job.id })
      requeued += 1
    } catch {
      break
    }
  }
  const staleVerifications = await env.DB.prepare("SELECT id FROM clip_jobs WHERE status = 'VERIFYING' AND updated_at < ?1 AND verify_deadline_at > ?2 ORDER BY updated_at ASC LIMIT 50").bind(new Date(Date.now() - 5_000).toISOString(), new Date().toISOString()).all<{ id: string }>()
  for (const job of staleVerifications.results) {
    try {
      await sendQueueMessage(env.MOMENTMINT_JOBS, { type: "verify_clip", clipJobId: job.id, attempt: 2 })
      requeued += 1
    } catch {
      break
    }
  }
  const staleMetadata = await env.DB.prepare("SELECT moment_id FROM ai_metadata WHERE status = 'PENDING' AND updated_at < ?1 ORDER BY updated_at ASC LIMIT 50").bind(new Date(Date.now() - 30_000).toISOString()).all<{ moment_id: string }>()
  for (const metadata of staleMetadata.results) {
    try {
      await sendQueueMessage(env.MOMENTMINT_JOBS, { type: "generate_metadata", momentId: metadata.moment_id })
      requeued += 1
    } catch {
      break
    }
  }
  await env.DB.prepare("DELETE FROM oauth_states WHERE expires_at <= ?1 OR used_at IS NOT NULL").bind(new Date().toISOString()).run()
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?1").bind(new Date().toISOString()).run()
  return { requeued }
}
