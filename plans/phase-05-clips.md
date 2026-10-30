# Phase 5 — Twitch clip creation, verification, retry, and review links

## Objective

Implement creator-confirmed/manual and opt-in automatic clip requests with bounded asynchronous verification and truthful failure states.

## Evidence and constraints

- PRD FR-4.1-4.4 requires Helix Create Clip, Get Clips verification, edit URL access, manual creation, idempotency, and useful error states.
- TDD 5.6-5.7 and 10 define the request/verify sequence, up-to-90-second capture behavior, edit URL limitations, 15-second verification boundary, and state machine.
- Never promise a private draft or exact historical VOD offset. Auto mode remains off until live behavior is reviewed.

## Implementation tasks

1. Implement a typed Twitch Helix client with base URL, client ID, user access token, status/error normalization, timeout, and safe response parsing.
2. Implement `POST /api/moments/:momentId/clip` with creator ownership, explicit `{ confirm: true }`, eligibility/idempotency checks, and a clear response before queue processing.
3. Implement the `create_clip` consumer: claim `QUEUED` conditionally, refresh token when needed, call `POST /helix/clips?broadcaster_id=...`, store clip ID/edit URL/request time/deadline, and transition to `VERIFYING` or a categorized retryable/permanent failure.
4. Encrypt the edit URL if it is treated as a capability-bearing secret; never log it. Store only Twitch-returned/validated URLs and metadata.
5. Implement delayed `verify_clip` messages with bounded checks (for example, 2-3 seconds, 5 seconds, final check before deadline). A returned Get Clips record is the only path to `READY_FOR_REVIEW`.
6. Store clip URL, embed URL, title, thumbnail, duration, and available VOD metadata. Preserve candidate and allow manual retry after failure/manual review.
7. Add clip list/detail/retry routes and review/dismiss transitions. Allow opening the Twitch edit URL and explain approximate timing and publication behavior in the UI.
8. Add rate limits for manual clip/retry actions and ensure every query is creator-scoped.

## Verification

- Unit tests cover Helix response parsing, status mapping, idempotency, claim races, retry boundaries, and state transitions.
- Mock integration tests cover success, offline/clips disabled, 401/403 refresh/reconnect, 429/5xx retry, malformed response, delayed Get Clips, timeout, and duplicate queue delivery.
- Live test manual creation first; verify real clip ID with Get Clips; inspect edit URL and actual publication/edit behavior before enabling automatic mode.
- UI never labels a clip ready from Create Clip alone.

## Exit checkpoint

A real broadcaster can manually request a clip, the system verifies it with Get Clips, and the creator can inspect/edit it through Twitch. Automatic mode remains disabled unless the live gate is explicitly passed.

