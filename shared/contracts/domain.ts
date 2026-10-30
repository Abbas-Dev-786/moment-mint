import { z } from "zod"

export const creatorSettingsSchema = z.object({
  nominationCommand: z.literal("!moment"),
  groupWindowSeconds: z.number().int().min(5).max(120),
  uniqueViewerThreshold: z.number().int().min(1).max(100),
  autoClipEnabled: z.boolean(),
})

export type CreatorSettings = z.infer<typeof creatorSettingsSchema>

export const queueMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("process_event"), eventId: z.string().min(1) }).strict(),
  z.object({ type: z.literal("create_clip"), clipJobId: z.string().min(1) }).strict(),
  z.object({ type: z.literal("verify_clip"), clipJobId: z.string().min(1), attempt: z.number().int().min(1).max(5) }).strict(),
  z.object({ type: z.literal("generate_metadata"), momentId: z.string().min(1) }).strict(),
])

export type QueueMessage = z.infer<typeof queueMessageSchema>

export const eventSubConditionSchema = z.object({
  broadcaster_user_id: z.string().min(1),
  user_id: z.string().min(1),
})

export const eventSubPayloadSchema = z.object({
  subscription: z.object({
    id: z.string(),
    type: z.string(),
    status: z.string(),
    condition: eventSubConditionSchema,
  }),
  event: z.record(z.string(), z.unknown()).default({}),
})

export const notificationEventSchema = z.object({
  message_id: z.string().min(1),
  message_type: z.literal("notification"),
  message_timestamp: z.string().datetime(),
})

export type SafeEventType = "notification" | "revocation" | "verification"

export const errorCodes = [
  "BAD_REQUEST", "NOT_FOUND", "INTERNAL_ERROR", "CONFIGURATION_ERROR", "UNAUTHORIZED",
  "FORBIDDEN", "INVALID_SIGNATURE", "REPLAYED_EVENT", "OAUTH_DENIED", "OAUTH_STATE_INVALID",
  "MISSING_SCOPE", "TWITCH_API_ERROR", "RECONNECT_REQUIRED",
] as const

export type SafeErrorCode = (typeof errorCodes)[number]
