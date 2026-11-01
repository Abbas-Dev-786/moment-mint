# Phase 9 — AI-assisted community context

## Objective

Make Workers AI materially useful by giving it a small, privacy-conscious evidence bundle about why viewers nominated a moment. AI should summarize community reaction and turn that evidence into editable metadata while remaining explicit about what it does not know.

This phase improves AI usefulness without making AI responsible for clip discovery, clip creation, or publication. Deterministic nomination grouping, Twitch clip creation, and creator review remain authoritative.

## Current gap

- EventSub currently persists only the exact `!moment` command for nomination processing; ordinary chat is discarded in `worker/eventsub.ts`.
- The current AI input is limited to stream title/category, approximate timestamp, distinct nominator count, and an optional creator note.
- As a result, the model has no evidence about the community's reaction and can only produce generic highlight copy.
- `confidenceNote` is accepted by the shared AI schema but is not currently persisted or rendered.

## Product behavior

For each candidate moment, MomentMint may retain a bounded context window around the first nomination. The context is used to produce an evidence summary, not to establish factual truth about the video.

The creator should see:

- A short “What the community said” summary.
- The number of sampled messages and the approximate time window.
- AI-generated title, summary, category, and social caption.
- A confidence/evidence note when available.
- A clear warning that chat reactions are opinions and that AI has not watched the video.
- Controls to regenerate, edit, accept, or ignore the suggestions.

The creator must be able to generate metadata even when no usable chat context exists. In that case, the system falls back to the current minimal-input behavior.

## Privacy and safety boundaries

1. Capture only a short, configurable window around a candidate, with a conservative default such as 60 seconds before and 30 seconds after the first nomination.
2. Store message text only after bounded normalization and truncation. Enforce a maximum message count, maximum character count per message, and maximum total context size.
3. Do not send viewer Twitch IDs, display names, badges, tokens, credentials, or unrelated personal data to AI.
4. Do not retain ordinary chat globally. Context belongs to one creator and one moment only.
5. Add an explicit retention timestamp and delete or redact context after a short period, such as 24 hours after metadata generation or seven days after collection, whichever comes first.
6. Treat every message as untrusted source data. Prompt injection, URLs, commands, and requests for secrets must be ignored by the model.
7. Do not claim that chat consensus proves what happened in the video. Use language such as “Viewers reacted with…” and preserve uncertainty.
8. Keep Queue messages ID-only. Context is read from D1 by the consumer and never placed in queue payloads or logs.
9. Add a creator setting or product disclosure explaining whether short-lived chat context is stored and used for AI suggestions.

## Implementation tasks

### 1. Capture and persistence

1. Extend the safe EventSub payload boundary to retain only the minimum normalized message text and event timestamp needed for a short-lived context record. Preserve the existing behavior of ignoring non-nomination messages for permanent nomination records.
2. Add a forward-only migration for a creator-scoped `chat_context_events` table linked to `moments`, with fields for sanitized text, event timestamp, received timestamp, retention expiry, source message ID, and created timestamp.
3. Add constraints and indexes for creator/moment ownership, source-message deduplication, expiry cleanup, and bounded retrieval by event timestamp.
4. When a nomination is accepted, collect only messages in the configured context window for the associated stream session. Handle delayed EventSub delivery and messages that arrive before the moment row exists.
5. Define deterministic truncation and normalization helpers. Strip or neutralize control characters, cap Unicode length, and avoid storing raw payload JSON in the context table.
6. Add Cron/reconciliation cleanup for expired context rows. Ensure creator disconnect removes retained context.

### 2. Context summarization contract

1. Extend the metadata input contract with a bounded `communityContext` object containing sanitized message text plus relative timing, without sender identity.
2. Keep the raw context out of browser responses by default, or return only the saved AI evidence summary and counts. If raw context is shown for transparency, make it creator-scoped and explicitly labeled as sampled chat.
3. Add persisted fields for `evidence_summary`, `evidence_message_count`, `evidence_window_start`, `evidence_window_end`, and `confidence_note`, or create a separate creator-scoped AI evidence table if that produces a cleaner lifecycle.
4. Version the prompt and output contract separately from `metadata-v1`, so old metadata remains interpretable and regeneration is auditable.

### 3. AI generation

1. Update the prompt to distinguish source evidence from instructions and to require:
   - A concise community-reaction summary grounded only in supplied messages.
   - Metadata that uses the evidence without asserting unverified video facts.
   - A confidence/evidence note explaining whether the context was strong, mixed, sparse, or absent.
2. Require structured JSON with bounded fields and reject output that includes unsupported visual/audio/gameplay claims, identities, or definitive outcomes not present in the source context.
3. Keep the current deterministic fallback for missing AI, malformed output, quota errors, and timeouts. Add an evidence fallback such as “No usable community context was available.”
4. Keep generation asynchronous through the existing `generate_metadata` Queue message and preserve idempotent `PENDING` handling.
5. Record provider, model ID, prompt version, input mode (`minimal` or `community_context`), generation status, and timestamps. Do not log prompt contents or chat text.
6. Continue rate limiting generation per creator and preserve the rule that AI failures do not change moment or clip state.

### 4. Dashboard and creator controls

1. Add a settings disclosure and control for short-lived community context retention, defaulting to the safer enabled/limited behavior only after the product copy is clear.
2. Add an evidence section to moment detail showing the sampled-message count, time window, AI evidence summary, and confidence note.
3. Label generated fields as AI suggestions until the creator edits or accepts them. Keep all fields editable.
4. Add loading, unavailable, no-context, expired-context, and generation-failure states.
5. Do not expose viewer identity or allow raw chat text to be copied into external destinations by default.

### 5. Migration and rollout

1. Ship the database migration and cleanup path before enabling context capture.
2. Backfill nothing from historical webhook payloads; existing moments remain on the minimal-input AI path.
3. Roll out context capture behind a server-side feature flag or creator setting.
4. Start with metadata generation only. Do not use AI output to auto-create clips, alter timestamps, or publish content.
5. Measure context availability, generation success, fallback rate, latency, and approximate input size without collecting message text in analytics.

## Verification

### Unit tests

- Context-window inclusion/exclusion at exact boundaries.
- Delayed messages and messages arriving before/after moment creation.
- Per-message and total-context truncation.
- Unicode/control-character normalization.
- Source-message deduplication and creator scoping.
- Expiry calculation and cleanup selection.
- Prompt construction with adversarial chat text.
- Structured output parsing, unsupported-claim rejection, confidence-note handling, and minimal-input fallback.

### Worker integration tests

- A nomination creates only bounded context records for its creator/moment.
- Duplicate EventSub delivery does not duplicate context.
- Context is not included in Queue payloads or logs.
- Expired context is deleted by reconciliation.
- Disconnect and creator ownership checks prevent cross-account access.
- AI failure leaves nomination, moment, and clip states unchanged.
- Historical moments can still generate minimal-input metadata.

### Browser/product tests

- Creator sees evidence summary and retention disclosure.
- No-context and expired-context states are understandable.
- AI fields remain editable and reviewable.
- Viewer identities are never displayed.
- Keyboard, screen-reader, stale, loading, and error states work for the new evidence section.

### Live validation

- Use a test channel with intentionally varied reactions: positive, negative, irrelevant, prompt-injection-like, and no-context cases.
- Confirm the model summarizes reactions without claiming to have watched the clip.
- Confirm generated titles/captions become more specific than the current generic fallback when useful evidence exists.
- Measure latency and Workers AI Neurons usage before expanding the context window or enabling it for all creators.

## Exit checkpoint

A creator can generate metadata grounded in a short, disclosed, short-lived sample of community reactions. The dashboard shows what evidence was used and how much confidence to place in it. Missing context, unsafe output, AI errors, and retention cleanup all degrade gracefully without affecting nomination or clipping.

The phase is not complete until privacy tests, retention cleanup, adversarial prompt tests, and a live AI validation pass are documented.
