# Phase 0 — Bootstrap, scope lock, and deployable skeleton

## Objective

Convert the starter repository into a buildable MomentMint shell with a stable Worker/SPA contract, verified package choices, typed environment boundaries, and a minimal health endpoint. This phase must remove infrastructure ambiguity before any Twitch or persistence work begins.

## Evidence and constraints

- Current `src/App.tsx` is the Cloudflare starter and must be replaced by a product shell.
- Current `worker/index.ts` only returns `{ name: "Cloudflare" }` for `/api/*`.
- `wrangler.jsonc` has SPA fallback and observability but no D1, Queue, AI, cron, vars, or secrets.
- `pnpm run build` fails on TypeScript 6 `baseUrl` deprecation in `tsconfig.app.json`.
- TDD 2, 3, 11, and 12 define the intended stack and configuration boundary.

## Implementation tasks


2. Add the minimum runtime dependencies: Hono, Zod, TanStack Query, and the chosen test/Workers test tooling. Add React Router only if the chosen SPA route strategy needs it. Do not add an AI provider SDK or Twitch SDK; use platform HTTP APIs and the Workers AI binding.
3. Preserve the root layout and current Hugeicons/shadcn setup. Replace the starter `App.tsx` with a minimal accessible MomentMint shell that can render connect/dashboard/settings placeholders.
4. Create `worker/app.ts`, `worker/env.ts`, and a module Worker entry that exports Hono `fetch`, queue, and scheduled hooks. Add `GET /health` with a non-secret status response.
5. Configure Vite/Cloudflare routing so `/api/*`, OAuth paths, and `/webhooks/twitch` reach the Worker, while unknown frontend paths still use SPA fallback. Follow current plugin syntax and keep the existing `vite.config.ts` working-tree change.
6. Add `.dev.vars.example` with names only and safe placeholders. Document which values are vars versus Worker secrets; never commit real credentials.
7. Add `shared/` contract scaffolding, `database/`, `tests/unit/`, `tests/integration/`, and a small `tests/fixtures/` layout. Add a typed error/JSON response convention.
8. Update `index.html` title and basic product metadata; remove starter branding/assets only when no longer referenced.

## Verification

- `pnpm run build` passes.
- `pnpm run lint` has no new product-code errors.
- Local dev serves the SPA and `/health` through the same Worker-aware dev path.
- A production build/preview serves the SPA and routes `/api/*` to the Worker.
- No secret, token, or account ID appears in source, assets, generated bundles, or `.dev.vars.example`.

## Exit checkpoint

The repository has a stable skeleton, a passing build, a documented package/config decision, and a Worker health route. No Phase 1 schema work starts until this checkpoint is green.

