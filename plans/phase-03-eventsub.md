# Phase 3 — EventSub webhook ingestion and outbox processing

## Objective

Receive Twitch chat events safely, reject forged/replayed requests, persist them before acknowledgement, and recover queue delivery through reconciliation.

## Evidence and constraints

- PRD FR-2.1-2.3 requires `channel.chat.message` v1 webhook transport, challenge response, HMAC verification, revocation, deduplication, and outbox recovery.
- TDD 5.2-5.4 and 6.1-6.2 define headers, signature input, approximate timestamps, persisted statuses, and fast webhook behavior.
- The event body is not a video playhead; store EventSub header timestamp and Worker receive time separately.

## Implementation tasks

1. Implement the Twitch EventSub service using `fetch`: register/delete/list the `channel.chat.message` v1 subscription with broadcaster and authorized chatting user IDs; persist Twitch subscription ID/status/condition.
2. Add `POST /webhooks/twitch` that reads the raw body once, validates required headers, checks replay age, derives the correct creator/subscription context, and verifies HMAC-SHA256 in constant time.
3. Handle callback verification only after signature validation and return the exact plain-text challenge. Handle revocations by marking subscription/creator status and retaining safe reason metadata.
4. For notifications, `INSERT OR IGNORE` the message ID into `webhook_events` with minimal payload and both timestamps. Queue `process_event` only for newly accepted/pending records; keep outbox fields if Queue send fails.
5. Implement the event consumer boundary. It should parse the stored event, ignore ordinary chat for permanent nomination storage, and call the Phase 4 nomination service for exact `!moment` messages.
6. Add an authenticated route to register/re-register EventSub and a status route used by setup/dashboard screens.
7. Add correlation IDs and safe event-type/status logging; never log raw chat payload or credentials.

## Verification

- Fixture tests cover verification, notification, revocation, missing header, bad signature, old timestamp, wrong broadcaster, duplicate message, and queue failure.
- Integration test proves valid notification -> D1 event -> Queue message -> processed status.
- Repeated notification produces no second side effect.
- A Cron/reconciliation test re-enqueues a persisted event whose queue send failed.
- Live test reaches `enabled` subscription over a public HTTPS endpoint.

## Exit checkpoint

The real webhook endpoint safely accepts a chat notification and the system can prove durable receipt, deduplication, and queue recovery. No candidate grouping is considered complete until Phase 4 tests pass.

