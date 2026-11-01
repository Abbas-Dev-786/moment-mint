import { validateQueueMessage, type QueueMessage } from "./contracts.js"
import { findWebhookEvent, markWebhookFailed, markWebhookProcessed } from "../repositories/webhook.js"
import { processNominationEvent } from "../domain/nomination.js"
import { captureChatContextEvent } from "../domain/chat-context.js"
import { processCreateClip, processGenerateMetadata, processVerifyClip } from "../domain/jobs.js"

type ConsumerEnv = { DB: D1Database; MOMENTMINT_JOBS: Queue<QueueMessage>; AI?: Ai; AI_MODEL_ID: string; TOKEN_ENCRYPTION_KEY: string; TWITCH_CLIENT_ID: string; TWITCH_CLIENT_SECRET: string }

const processEvent = async (env: ConsumerEnv, eventId: string) => {
  const event = await findWebhookEvent(env.DB, eventId)
  if (!event || event.processing_status === "PROCESSED") return
  if (event.message_type === "notification" && event.creator_id && event.payload_json) {
    const payload = JSON.parse(event.payload_json) as { broadcaster_user_id: string | null; chatter_user_id: string | null; message_id: string | null; message_text: string | null; event_timestamp?: string | null }
    const eventTimestamp = payload.event_timestamp ?? event.eventsub_timestamp ?? event.received_at
    await captureChatContextEvent(env.DB, { creatorId: event.creator_id, sourceMessageId: payload.message_id, messageText: payload.message_text, eventsubTimestamp: eventTimestamp, receivedAt: event.received_at, isNomination: payload.message_text?.trim().toLowerCase() === "!moment" })
    await processNominationEvent(env, { creatorId: event.creator_id, eventsubTimestamp: eventTimestamp, receivedAt: event.received_at, payload })
  }
  await markWebhookProcessed(env.DB, eventId)
}

export const dispatchQueueMessage = async (message: QueueMessage, env: ConsumerEnv) => {
  const parsed = validateQueueMessage(message)
  switch (parsed.type) {
    case "process_event":
      await processEvent(env, parsed.eventId)
      return
    case "create_clip":
      await processCreateClip(parsed.clipJobId, env)
      return
    case "verify_clip":
      await processVerifyClip(parsed.clipJobId, parsed.attempt, env)
      return
    case "generate_metadata":
      await processGenerateMetadata(parsed.momentId, env)
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
