import { describe, expect, it } from "vitest"

import { creatorSettingsSchema, eventSubPayloadSchema, queueMessageSchema } from "../../shared/contracts/domain.js"
import { decryptSecret, encryptSecret, hmacSha256Hex } from "../../worker/lib/crypto.js"
import { isMomentCommand, selectGroupingCandidate } from "../../worker/domain/nomination.js"
import { buildMetadataPrompt, fallbackMetadata, parseMetadataOutput } from "../../worker/ai/metadata.js"
import { canTransitionClipJob, canTransitionMoment } from "../../shared/contracts/states.js"
import { calculateVodClipWindow, isTrustedTwitchUrl } from "../../worker/twitch/client.js"
import { parseCookies } from "../../worker/lib/cookies.js"

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

  it("accepts only the exact nomination command and groups by fixed nearest anchor", () => {
    expect(isMomentCommand("  !MOMENT ")).toBe(true)
    expect(isMomentCommand("!momentplease")).toBe(false)
    const candidates = [
      { id: "b", anchor_eventsub_at: "2026-10-30T00:00:10.000Z", group_window_seconds: 30 },
      { id: "a", anchor_eventsub_at: "2026-10-30T00:00:00.000Z", group_window_seconds: 30 },
    ]
    expect(selectGroupingCandidate(candidates, Date.parse("2026-10-30T00:00:30.000Z"))?.id).toBe("b")
    expect(selectGroupingCandidate(candidates, Date.parse("2026-10-30T00:00:40.000Z"))?.id).toBe("b")
    expect(selectGroupingCandidate(candidates, Date.parse("2026-10-30T00:00:41.000Z"))).toBeUndefined()
  })

  it("enforces domain state transitions", () => {
    expect(canTransitionMoment("COLLECTING", "THRESHOLD_MET")).toBe(true)
    expect(canTransitionMoment("CLIP_READY", "COLLECTING")).toBe(false)
    expect(canTransitionClipJob("VERIFYING", "READY_FOR_REVIEW")).toBe(true)
    expect(canTransitionClipJob("READY_FOR_REVIEW", "CREATING")).toBe(false)
  })

  it("validates AI JSON and provides grounded fallback metadata", () => {
    expect(parseMetadataOutput({ response: '{"title":"A clutch save","summary":"Community nominated highlight","category":"clutch","socialCaption":"A clutch save from the stream."}' })?.category).toBe("clutch")
    expect(parseMetadataOutput({ response: '{"title":"invented","summary":"bad","category":"not-real","socialCaption":"x"}' })).toBeNull()
    expect(buildMetadataPrompt({ approximateTimestamp: "2026-10-30T00:00:00Z", distinctNominatorCount: 2 })).toContain("NOT watched the video")
    expect(fallbackMetadata({ anchor_eventsub_at: "2026-10-30T00:00:00Z", unique_nominator_count: 2 }).summary).toContain("2 distinct viewers")
  })

  it("allows only HTTPS Twitch-hosted clip URLs", () => {
    expect(isTrustedTwitchUrl("https://clips.twitch.tv/example")).toBe(true)
    expect(isTrustedTwitchUrl("https://clips-media-assets2.twitch.tv/example.jpg")).toBe(true)
    expect(isTrustedTwitchUrl("https://static-cdn.jtvnw.net/example.jpg")).toBe(true)
    expect(isTrustedTwitchUrl("http://clips.twitch.tv/example")).toBe(false)
    expect(isTrustedTwitchUrl("https://evil-twitch.tv/example")).toBe(false)
  })

  it("targets the nominated moment inside the matching VOD", () => {
    expect(calculateVodClipWindow("2026-11-01T07:00:45.000Z", "2026-11-01T07:00:00.000Z")).toEqual({ durationSeconds: 30, vodOffset: 60 })
    expect(calculateVodClipWindow("2026-11-01T06:59:59.000Z", "2026-11-01T07:00:00.000Z")).toBeNull()
  })

  it("accepts only channel chat EventSub payloads and tolerates malformed cookies", () => {
    const payload = {
      subscription: { id: "sub_1", type: "channel.chat.message", status: "enabled", condition: { broadcaster_user_id: "broadcaster_1", user_id: "broadcaster_1" } },
      event: {},
    }
    expect(eventSubPayloadSchema.parse(payload).subscription.type).toBe("channel.chat.message")
    expect(() => eventSubPayloadSchema.parse({ ...payload, subscription: { ...payload.subscription, type: "channel.follow" } })).toThrow()
    expect(parseCookies("mm_session=valid%20value; malformed=%E0%A4%A; other=ok")).toEqual({ mm_session: "valid value", other: "ok" })
  })
})
