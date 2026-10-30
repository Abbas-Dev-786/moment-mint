import { describe, expect, it } from "vitest"

import { creatorSettingsSchema, queueMessageSchema } from "../../shared/contracts/domain.js"
import { decryptSecret, encryptSecret, hmacSha256Hex } from "../../worker/lib/crypto.js"

describe("MomentMint contracts", () => {
  it("accepts only ID-based queue messages", () => {
    expect(queueMessageSchema.parse({ type: "process_event", eventId: "event_1" })).toEqual({ type: "process_event", eventId: "event_1" })
    expect(() => queueMessageSchema.parse({ type: "process_event", eventId: "event_1", token: "secret" })).toThrow()
    expect(() => queueMessageSchema.parse({ type: "process_event", eventId: "event_1", rawChat: "!moment" })).toThrow()
  })

  it("preserves and validates safe creator defaults", () => {
    expect(creatorSettingsSchema.parse({ nominationCommand: "!moment", groupWindowSeconds: 30, uniqueViewerThreshold: 2, autoClipEnabled: false }).autoClipEnabled).toBe(false)
  })

  it("round trips AES-GCM secrets and rejects a wrong key", async () => {
    const encrypted = await encryptSecret("twitch-access-token", "test-encryption-key")
    await expect(decryptSecret(encrypted.ciphertext, encrypted.iv, "test-encryption-key")).resolves.toBe("twitch-access-token")
    await expect(decryptSecret(encrypted.ciphertext, encrypted.iv, "different-key")).rejects.toThrow()
  })

  it("creates a Twitch-compatible HMAC hex digest", async () => {
    await expect(hmacSha256Hex("message-id2026-10-30T00:00:00Zbody", "secret")).resolves.toMatch(/^[0-9a-f]{64}$/)
  })
})
