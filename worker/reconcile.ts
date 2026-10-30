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
  await env.DB.prepare("DELETE FROM oauth_states WHERE expires_at <= ?1 OR used_at IS NOT NULL").bind(new Date().toISOString()).run()
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?1").bind(new Date().toISOString()).run()
  return { requeued }
}
