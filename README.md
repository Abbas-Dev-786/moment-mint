# MomentMint

MomentMint turns Twitch viewers' `!moment` nominations into a creator-controlled highlight inbox. The community finds moments; the streamer decides what gets clipped and shared.

## Current status

Phase 0 is implemented: the repository has a buildable React/Cloudflare Worker shell, a typed environment boundary, a Worker `/health` route, SPA-aware routing, and placeholder Connect, Dashboard, and Settings views.

Twitch OAuth, D1, EventSub, Queues, Workers AI, and real dashboard data are planned for later phases. See [the master implementation plan](plans/master-plan.md) and [the phase plans](plans/).

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
