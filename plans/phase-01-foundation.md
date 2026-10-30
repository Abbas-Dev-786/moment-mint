# Phase 1 — D1, Queue, contracts, and durable event foundation

## Objective

Implement the durable data model and asynchronous work primitives so every later feature can be idempotent, auditable, and recoverable.

## Evidence and constraints

- TDD 4.3-4.5, 8, 10, and 12 define D1 entities, Queue messages, state transitions, bindings, and Cron responsibilities.
- PRD FR-7.1 requires D1 authority, bounded retries, DLQ/manual review, and reconciliation.
- D1 and Queue sends are not atomic; the webhook event outbox state must represent the gap.

## Implementation tasks

1. Add `database/schema.sql` and a forward-only initial migration for `creators`, `eventsub_subscriptions`, `stream_sessions`, `webhook_events`, `moments`, `nominations`, `clip_jobs`, and `ai_metadata`. Keep `chat_context_events` optional and defer it unless the privacy/cleanup design is ready.
2. Add foreign keys, `UNIQUE(twitch_user_id)`, `UNIQUE(twitch_message_id)`, `UNIQUE(source_message_id)`, `UNIQUE(moment_id, viewer_twitch_id)`, and `UNIQUE(idempotency_key)`. Add indexes from TDD 8.11 and timestamps/status fields needed for reconciliation.
3. Define shared Zod schemas/types for settings, API envelopes, moment/clip/AI statuses, queue messages, and safe error codes. Reject unknown or invalid state transitions in domain helpers.
4. Add typed Worker bindings for D1, Queue producer/DLQ, AI, assets, public vars, and secrets. Keep secret types distinct from public configuration.
5. Implement repository modules for creator, event, moment, clip, and metadata reads/writes. Every repository method must require creator scope where data is user-owned.
6. Implement Queue message helpers that send only IDs and minimal attempt metadata. Add a consumer dispatcher that acknowledges terminal/idempotently repeated work and retries only retryable failures.
7. Add Cron reconciliation scaffolding: stale `webhook_events`, stuck `clip_jobs`, expired OAuth state rows once that table exists, and temporary context cleanup. Bound each query/page.
8. Configure `wrangler.jsonc` for local/remote D1, Queue producer/consumer/DLQ, AI binding, and a reconciliation cron. Use placeholder resource IDs only where Wrangler requires them; document creation commands separately.

## Verification

- Apply migrations locally and inspect all constraints/indexes.
- Repository tests prove creator scoping and duplicate inserts are safe.
- Queue contract tests reject tokens/raw chat and accept all four defined message types.
- Duplicate event/job delivery is a no-op after the first successful state transition.
- Reconciliation finds an inserted-but-not-queued event and re-enqueues it.
- Worker type generation succeeds after bindings are configured.

## Exit checkpoint

Local D1 migrations, repositories, queue contracts, and reconciliation tests pass. The project can persist a durable event and recover queue delivery without any Twitch integration.

