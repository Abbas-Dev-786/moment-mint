import { validateQueueMessage, type QueueMessage } from "./contracts.js"
import { findWebhookEvent, markWebhookFailed, markWebhookProcessed } from "../repositories/webhook.js"

type ConsumerEnv = { DB: D1Database }

const processEvent = async (db: D1Database, eventId: string) => {
  const event = await findWebhookEvent(db, eventId)
  if (!event || event.processing_status === "PROCESSED") return
  // Phase 3 deliberately stops at the durable boundary. Phase 4 consumes this
  // stored event to apply exact !moment parsing and grouping.
  await markWebhookProcessed(db, eventId)
}

export const dispatchQueueMessage = async (message: QueueMessage, env: ConsumerEnv) => {
  const parsed = validateQueueMessage(message)
  switch (parsed.type) {
    case "process_event":
      await processEvent(env.DB, parsed.eventId)
      return
    case "create_clip":
    case "verify_clip":
    case "generate_metadata":
      // These are contractually accepted now; their domain workers land in later phases.
      return
  }
}

export const consumeQueue = async (batch: MessageBatch<QueueMessage>, env: ConsumerEnv) => {
  for (const message of batch.messages) {
    try {
      await dispatchQueueMessage(message.body, env)
      message.ack()
    } catch (error) {
      console.error("Queue message failed", { messageId: message.id, type: typeof message.body === "object" && message.body ? (message.body as { type?: string }).type : "invalid" })
      if (message.attempts >= 3) message.ack()
      else message.retry({ delaySeconds: Math.min(60 * message.attempts, 300) })
      if (error instanceof Error && message.attempts >= 3 && typeof message.body === "object" && message.body && "type" in message.body && (message.body as { type: string }).type === "process_event") {
        await markWebhookFailed(env.DB, (message.body as { eventId: string }).eventId, "QUEUE_RETRIES_EXHAUSTED")
      }
    }
  }
}
