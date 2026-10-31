# MomentMint

MomentMint turns Twitch viewers' `!moment` nominations into a creator-controlled highlight inbox. The community finds moments; the streamer decides what gets clipped and shared.

## Current status

Phases 1–7 are implemented: the repository now includes durable D1/Queue foundations, encrypted Twitch OAuth/session handling, EventSub ingestion, nomination grouping, verified Twitch clip jobs, Workers AI metadata with fallback, and the creator dashboard workflow.

Hardening, live validation, deployment, and demo readiness remain for Phase 8. See [the master implementation plan](plans/master-plan.md) and [the phase plans](plans/).

## Local development

Requirements:

- Node.js compatible with the installed toolchain
- pnpm
- Cloudflare Wrangler access for later integration phases

Install dependencies and start the Vite/Worker-aware development server:

```sh
pnpm install
pnpm dev
```

The Phase 0 health endpoint is available at `/health`. Local values can be copied from `.dev.vars.example` into a local `.dev.vars` file; `.dev.vars` is ignored by Git.

Apply the local D1 migration with `pnpm exec wrangler d1 migrations apply momentmint --local` before exercising authenticated routes. Twitch EventSub requires a public HTTPS callback URL in deployed environments.

For a deployed environment, create the D1 database and queues with `wrangler d1 create momentmint` and `wrangler queues create momentmint-jobs` / `wrangler queues create momentmint-jobs-dlq`, replace the placeholder D1 ID in `wrangler.jsonc`, apply migrations with `wrangler d1 migrations apply momentmint`, then set `TWITCH_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `SESSION_SECRET`, and `EVENTSUB_SECRET` with `wrangler secret put`.

## Verification commands

```sh
pnpm run build
pnpm run lint
```

## Configuration and secrets

Public Worker variables are `APP_BASE_URL`, `TWITCH_CLIENT_ID`, `TWITCH_REDIRECT_URI`, `AI_MODEL_ID`, `DEFAULT_GROUP_WINDOW_SECONDS`, and `DEFAULT_UNIQUE_VIEWER_THRESHOLD`.

Keep `TWITCH_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, and `SESSION_SECRET` in local `.dev.vars` or deployed Wrangler secrets. Never place real values in source control, frontend environment variables, screenshots, or logs.

The current root layout intentionally stays as one Cloudflare Vite application. Product code will be added under `src/`, Worker code under `worker/`, shared contracts under `shared/`, database migrations under `database/`, and tests under `tests/` as later phases land.

## Product guardrails

- Automatic clip creation is off until Twitch's current publication/edit behavior is tested and disclosed.
- A Twitch clip is not shown as ready until Twitch confirms it through Get Clips.
- Approximate EventSub timing is never presented as a precise video frame.
- MomentMint does not publish to third-party social networks in the MVP.
