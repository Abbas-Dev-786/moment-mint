# Phase 6 — Workers AI metadata and deterministic fallback

## Objective

Add optional, creator-triggered AI packaging that is evidence-grounded, schema-validated, editable, privacy-minimized, and never required for core nomination/clip work.

## Evidence and constraints

- PRD FR-5.1-5.3 requires the Cloudflare AI binding, minimal inputs, no hallucinated footage, editable output, and fallback/retry.
- TDD 4.6 and 7 define model candidate `@cf/openai/gpt-oss-20b`, input/output contracts, prompt safety, Zod validation, and Neurons monitoring.
- The account must validate model availability and output shape; the plan does not assume the model is usable merely because it is documented.

## Implementation tasks

1. Add an `AI` binding and configurable `AI_MODEL_ID` with the documented model as the initial candidate. Add a smoke-test route protected from public use or a local command path.
2. Implement `POST /api/moments/:momentId/ai-metadata` and the `generate_metadata` consumer. Allow generation after clip verification or explicit creator request; never invoke per chat message.
3. Build the minimal input contract: stream title/category when available, approximate timestamp, distinct count, and optional creator note. Start without raw chat context; add short-lived sanitized context only if separately approved.
4. Version the prompt. Explicitly tell the model it has not watched the video, treat any chat text as untrusted source material, and forbid invented visual claims, secret requests, publication actions, or tool instructions.
5. Validate title (3-80), summary (1-240), enum category, caption (1-280), and optional confidence note with Zod. Sanitize for text rendering and reject invalid/empty output.
6. Save `PENDING`, `READY`, or `FAILED_WITH_FALLBACK` with provider/model/prompt version. Fallback title includes the approximate time and count; all fields remain editable.
7. Add manual retry with per-creator/moment rate limiting and safe AI latency/error logging. Ensure AI failures leave moment and clip statuses unchanged.

## Verification

- Unit tests cover prompt constraints, schema bounds, malformed JSON, unexpected category, timeout/quota/model error, and fallback text.
- Integration tests cover successful binding response and failure without blocking clip state.
- Live smoke test confirms actual model availability, latency, response shape, and Neurons usage.
- Inspect logs and queue payloads to prove no credentials, viewer IDs, or full chat history are sent.

## Exit checkpoint

A creator can generate or retry editable metadata for a candidate, and a deterministic fallback appears when Workers AI is unavailable. Dashboard integration can begin.

