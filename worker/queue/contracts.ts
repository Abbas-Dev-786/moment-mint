import { queueMessageSchema, type QueueMessage } from "../../shared/contracts/domain.js"

export const validateQueueMessage = (value: unknown) => queueMessageSchema.parse(value)

export const sendQueueMessage = async (queue: Queue<QueueMessage>, message: QueueMessage, options?: QueueSendOptions) => {
  const validated = validateQueueMessage(message)
  await queue.send(validated, options)
}

export type { QueueMessage }
