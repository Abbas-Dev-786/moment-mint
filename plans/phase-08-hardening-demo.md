# Phase 8 — Hardening, live validation, deployment, and demo readiness

## Objective

Prove the end-to-end workflow in the real Cloudflare/Twitch environment, close security/reliability gaps, and prepare a repeatable submission demo without overstating capabilities.

## Evidence and constraints

- PRD acceptance checklist is the release gate; Scope 9-10 defines the real demo path and success criteria.
- TDD 13-16 defines error taxonomy, logging, security, tests, deployment, free-tier caution, and demo checklist.
- Published quotas and current Twitch/Cloudflare behavior are assumptions until checked in the actual accounts.

## Implementation tasks

1. Run the complete unit/integration/browser suite and resolve all product-code build/lint/type errors. Keep generated primitive warnings documented or fix only when safe.
2. Perform a security review: HMAC/replay, OAuth state, AES-GCM key handling, cookie/CSRF/origin controls, creator ownership, rate limits, URL allow-listing, CSP, log redaction, and secret scans.
3. Run the live Twitch plan in order: HTTPS callback, test broadcaster OAuth, EventSub enabled, clips enabled, two viewer accounts, one grouped candidate, manual clip, Get Clips, edit/publication behavior, failure cases, token expiry, and AI fallback.
4. Do not enable automatic clipping by default unless the live publication/edit gate is passed and the setup confirmation explains the behavior. If not passed, demonstrate manual clip creation and clearly label any simulation.
5. Configure production D1, Queue/DLQ, AI, cron, vars, and secrets. Apply migrations, deploy Worker + static assets, and verify `/health`, session cookie, API routes, webhook, Queue consumer, Cron, D1, and AI binding in production.
6. Add bounded/paginated reconciliation metrics and safe operational logging. Verify no queue retry can duplicate a nomination, clip request, or metadata record.
7. Update README with prerequisites, Twitch app callback setup, Cloudflare resource creation, local development, public HTTPS webhook requirement, secrets, migrations, tests, deployment, troubleshooting, privacy, and non-goals.
8. Prepare a sub-three-minute demo: problem, connect, two nominations, grouped threshold, real/manual clip verification, AI/fallback, creator review/edit/share decision, and Codex development proof. Label prerecorded/simulated elements.

## Verification

- All PRD MVP acceptance items are checked with evidence links or test/run notes.
- Production live test is repeatable with stable test accounts and reauthorization plan.
- Failure/fallback path leaves candidate visible and actionable.
- Cloudflare free-tier use is monitored; no zero-cost guarantee is claimed.
- Final `pnpm run build`, `pnpm run lint`, test command, and `wrangler deploy`/production smoke checks are recorded.

## Exit checkpoint

MomentMint is a truthful, secure, deployable hackathon MVP with a repeatable live demo and documented limitations. Any unresolved open decision is explicitly shown as a guardrail or deferred feature, never silently promised.

