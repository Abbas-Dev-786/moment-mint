# MomentMint

MomentMint turns Twitch viewers' `!moment` nominations into a creator-controlled highlight inbox. The community finds moments; the streamer decides what gets clipped and shared.

## Current status

Phases 1–7 are implemented: the repository now includes durable D1/Queue foundations, encrypted Twitch OAuth/session handling, EventSub ingestion, nomination grouping, verified Twitch clip jobs, Workers AI metadata with fallback, and the creator dashboard workflow.

Production hardening is implemented locally: authenticated action rate limits, security headers, request correlation IDs, trusted Twitch URL validation, a D1-backed readiness check, and a guarded production deploy command. Live Cloudflare/Twitch validation still requires the production account, resources, credentials, and public hostname. See [the master implementation plan](plans/master-plan.md) and [the phase plans](plans/).

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

The health endpoints are `/health` and `/health/ready`. Local values can be copied from `.dev.vars.example` into a local `.dev.vars` file; `.dev.vars` is ignored by Git.

Apply the local D1 migration with `pnpm exec wrangler d1 migrations apply momentmint --local` before exercising authenticated routes. Twitch EventSub requires a public HTTPS callback URL in deployed environments.

## Production deployment

The repository does not create or select Cloudflare resources automatically. Complete these steps while authenticated to the intended Cloudflare account:

1. Create the resources and record the returned D1 `database_id`:

   ```sh
   pnpm exec wrangler login
   pnpm exec wrangler d1 create momentmint
   pnpm exec wrangler queues create momentmint-jobs
   pnpm exec wrangler queues create momentmint-jobs-dlq
   ```

2. Update `wrangler.jsonc` with the real D1 ID, public HTTPS `APP_BASE_URL`, Twitch client ID, and matching `TWITCH_REDIRECT_URI`. The callback must be `https://YOUR_HOST/oauth/twitch/callback`; do not deploy the localhost values.

3. Apply the migrations remotely:

   ```sh
   pnpm exec wrangler d1 migrations apply momentmint --remote
   ```

4. Set secrets without putting them in source control:

   ```sh
   pnpm exec wrangler secret put TWITCH_CLIENT_SECRET
   pnpm exec wrangler secret put TOKEN_ENCRYPTION_KEY
   pnpm exec wrangler secret put SESSION_SECRET
   pnpm exec wrangler secret put EVENTSUB_SECRET
   ```

   `TOKEN_ENCRYPTION_KEY` must be a base64 encoding of 32 random bytes. A local value can be generated with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.

5. Add the exact HTTPS callback URL to the Twitch developer application, then run the guarded deployment:

   ```sh
   pnpm run deploy:production
   ```

   This command fails before deployment if the Wrangler file still contains placeholders, localhost values, or an invalid D1 ID.

6. Smoke-test the deployed service and inspect Worker logs:

   ```sh
   curl https://YOUR_HOST/health
   curl https://YOUR_HOST/health/ready
   pnpm exec wrangler tail
   ```

   Then sign in through Twitch, register EventSub from Settings, send a real `!moment`, and verify the resulting clip through the creator review flow. Do not claim live readiness until these checks pass against the intended account and hostname.

## Verification commands

```sh
pnpm test
pnpm run build
pnpm run lint
pnpm run production:check
```

## Configuration and secrets

Public Worker variables are `APP_BASE_URL`, `TWITCH_CLIENT_ID`, `TWITCH_REDIRECT_URI`, `AI_MODEL_ID`, `DEFAULT_GROUP_WINDOW_SECONDS`, and `DEFAULT_UNIQUE_VIEWER_THRESHOLD`.

Keep `TWITCH_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `SESSION_SECRET`, and `EVENTSUB_SECRET` in local `.dev.vars` or deployed Wrangler secrets. Never place real values in source control, frontend environment variables, screenshots, or logs.

Production protections include CSP and related browser security headers, HTTPS HSTS, request IDs in API responses and error logs, creator-scoped limits on manual clip and AI generation actions, and an allow-list for Twitch HTTPS URLs before they are stored or returned. The readiness endpoint checks D1 connectivity without exposing configuration values.

The current root layout intentionally stays as one Cloudflare Vite application. Product code will be added under `src/`, Worker code under `worker/`, shared contracts under `shared/`, database migrations under `database/`, and tests under `tests/` as later phases land.

## Product guardrails

- Automatic clip creation is off until Twitch's current publication/edit behavior is tested and disclosed.
- A Twitch clip is not shown as ready until Twitch confirms it through Get Clips.
- Approximate EventSub timing is never presented as a precise video frame.
- MomentMint does not publish to third-party social networks in the MVP.
- Ordinary chat messages are not retained as a product data store; only the minimum EventSub event data needed to form and process a moment is persisted.
