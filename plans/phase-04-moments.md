# Phase 4 — Nomination processing, grouping, threshold, and clip-job intent

## Objective

Turn accepted chat nominations into durable, approximate candidate moments with distinct-viewer counts and a single auditable clip-job intent.

## Evidence and constraints

- PRD FR-3.1-3.4 and the edge-case table require anchored 30-second grouping, unique viewers, below-threshold retention, deterministic overlap handling, and idempotent jobs.
- TDD 5.4-5.5 and 6.3-6.4 define exact command parsing, earliest-anchor behavior, nearest-candidate tie-breaking, threshold default 2, and conservative consumer concurrency.
- The clip request must not happen here unless the creator setting explicitly enables automatic creation; otherwise only manual eligibility is exposed.

## Implementation tasks

1. Implement `isMomentCommand(text)` as trim + lowercase exact comparison with the configured command. Ignore invalid variants and ordinary messages.
2. Resolve/create a stream session for the broadcaster. Use known live/session metadata when available; otherwise retain `UNKNOWN` with clear UI wording.
3. Implement grouping using EventSub timestamp as the approximate anchor, Worker receive time separately, a snapshot of window/threshold settings, open candidates only, nearest anchor selection, and deterministic tie-breaking. Never slide the anchor forward.
4. Insert nominations with unique `(moment_id, viewer_twitch_id)` and source message ID constraints. Treat duplicate viewer nominations as a no-op while preserving the original event.
5. Update/count distinct nominators transactionally or with a safe recomputation. Mark `THRESHOLD_MET` once with a conditional update; retain `COLLECTING` candidates below threshold.
6. Create an automatic `clip_jobs` row only if the threshold is crossed and auto-clip is enabled. Use `${momentId}:auto` idempotency; manual attempts must be separate and allowed only after terminal/retryable prior state.
7. Add moment detail/list repository queries with owner scope, bounded pagination, time/count sorting, and status filters.
8. Add domain state transition tests for all moment, clip, and AI states, including invalid transitions.

## Verification

- Unit tests cover whitespace/case, boundary exactly at 30 seconds, outside-window creation, overlap tie-breaks, delayed delivery, duplicate viewer, two viewers, repeated threshold event, and manual below-threshold eligibility.
- Integration test: two distinct viewers -> one moment -> count 2 -> one eligible auto job when enabled.
- Integration test: one viewer spamming -> count 1 and no automatic job.
- Test that a Queue duplicate cannot create a second nomination or clip job.
- Verify no raw ordinary chat is retained permanently.

## Exit checkpoint

The dashboard data contract can show reliable candidates and counts, and every valid nomination survives downstream failures. Phase 5 may now call Twitch clips.

