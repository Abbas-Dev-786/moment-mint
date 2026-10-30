# MomentMint Implementation Master Plan

## 1. Purpose and planning basis

This plan turns the repository's three authoritative documents into an executable implementation sequence:

- [Project Scope](../docs/project-scope.md) defines the product promise, MVP boundary, defaults, risks, demo path, and success criteria.
- [PRD](../docs/PRD.md) defines the user journeys, functional requirements, UI states, state machines, non-functional requirements, and acceptance checklist.
- [TDD](../docs/TDD.md) defines the Cloudflare architecture, D1 model, API surface, queue contracts, security controls, tests, deployment assumptions, and Phase 0-8 sequence.

The documents were reviewed in full. The current repository was then compared against them. The implementation must treat D1 as the durable source of truth, keep Twitch and AI work asynchronous, preserve candidates on every downstream failure, and keep the creator in control of clip creation and sharing.

## 2. Evidence-based current state

### What exists

- Root Vite + React + TypeScript application with the Cloudflare Vite plugin in `vite.config.ts`.
- Tailwind CSS v4, shadcn CSS variables, IBM Plex Sans, Merriweather, and a large generated `src/components/ui/` primitive set.
- Cloudflare Worker entry point at `worker/index.ts`.
- Minimal Wrangler configuration with SPA fallback and observability in `wrangler.jsonc`.
- A starter `App.tsx` that demonstrates a counter and a placeholder `/api/` request.
- A `plans/` directory ready for implementation planning.

### What does not exist

- No Hono app or authenticated API routes.
- No D1 schema, migrations, repositories, or domain services.
- No Queue producer/consumer, DLQ, Cron reconciliation, or AI binding.
- No Twitch OAuth, token encryption, EventSub registration/webhook verification, or Helix client.
- No nominations, moments, clip jobs, metadata model, session handling, or creator settings.
- No MomentMint dashboard, routing, query client, API client, or product components.
- No unit/integration tests or live Twitch fixtures.
- No deployment bindings, environment template, or MomentMint setup documentation.

### Baseline verification

- `pnpm run build` currently fails before bundling because `tsconfig.app.json` uses deprecated `baseUrl` under the installed TypeScript 6 (`TS5101`). This is a Phase 0 blocker.
- `pnpm run lint` completes with warnings from generated UI primitives and `use-mobile.ts`; there are no current MomentMint lint errors.
- `vite.config.ts` has a pre-existing working-tree modification from `__dirname` to `import.meta.dirname`; preserve it unless implementation work requires a focused config change.
- `docs/` is currently untracked in Git, and `plans/` was empty before this plan set. Do not overwrite unrelated user changes.

## 3. Target architecture

Keep the existing single-package root layout rather than performing a speculative `apps/web` monorepo migration. The TDD explicitly allows filenames to adapt, and the current Cloudflare Vite plugin already provides the full-stack Worker/SPA shape.

```text
src/                         React SPA, product components, query hooks, typed API client
worker/                      Hono routes, Worker entry, domain services, repositories, consumers
shared/                      Zod schemas and serializable contracts shared by browser/Worker
database/                    D1 schema and forward-only migrations
tests/                       Unit tests, Worker integration tests, Twitch fixtures
plans/                       Master and phase implementation plans
```

Runtime flow:

```text
React dashboard
  -> authenticated Hono API
  -> D1 source of truth
  -> Queue IDs-only work
  -> idempotent consumers
  -> Twitch Helix / Workers AI
  -> D1 state transitions
  -> five-second foreground dashboard polling
```

The Worker module must expose `fetch`, `queue`, and `scheduled` handlers. Hono routes should receive typed Cloudflare bindings through `c.env`. The Vite plugin configuration must route `/api/*` and webhook/OAuth paths to the Worker before SPA asset fallback.

## 4. Delivery phases and gates

| Phase | Outcome | Exit gate |
|---|---|---|
| 0. Bootstrap and contract lock | Buildable application skeleton and verified configuration decisions | Build passes; `/health` responds; no secret is committed |
| 1. Durable platform foundation | D1 schema, repositories, Queue contracts, outbox, Cron shell | Migrations and idempotent persistence tests pass |
| 2. Twitch OAuth and session | Secure creator connection lifecycle | Test broadcaster connects; browser never sees Twitch tokens |
| 3. EventSub ingestion | Verified, durable chat webhook path | Real or fixture notification is stored and safely queued |
| 4. Moment domain | Grouping, distinct viewers, thresholds, candidate inbox data | Two viewers yield one candidate and one eligible job; duplicates do not inflate count |
| 5. Clip lifecycle | Twitch Create Clip, bounded verification, failure/retry states | Real manual clip is retrievable before UI says ready |
| 6. AI metadata | Validated, editable metadata and deterministic fallback | AI failure cannot block nominations or clips |
| 7. Creator dashboard | Onboarding, live overview, inbox, detail/review, settings | End-to-end candidate and clip are visible in the product |
| 8. Hardening and demo | Security, accessibility, observability, live test, deployment, demo artifacts | Repeatable three-minute demo and acceptance checklist complete |

Each phase must finish its tests and checkpoint before the next phase adds dependent behavior. Live Twitch and Cloudflare account validation are gates, not assumptions hidden inside implementation.

## 5. Non-negotiable product and technical constraints

1. `!moment` is an exact, trimmed, case-insensitive command.
2. Count distinct viewers, with a D1 uniqueness constraint on `(moment_id, viewer_twitch_id)`.
3. Use a 30-second anchored grouping window and show timing as approximate; never claim frame accuracy.
4. Preserve below-threshold candidates and all failure states.
5. Automatic clip creation is off by default until the real Twitch publication/edit behavior is tested and explicitly disclosed.
6. A clip is not `READY_FOR_REVIEW` until Get Clips returns it.
7. Queue payloads contain IDs and control data only; tokens and raw chat do not enter messages or logs.
8. Encrypt Twitch access/refresh tokens and sensitive edit URLs with AES-GCM using Worker secrets.
9. AI receives minimal sanitized context, never viewer IDs, credentials, or full chat history; all output is schema-validated and editable.
10. No external social publishing, VOD download/storage, video editing, computer vision, multi-channel teams, or gamification in the MVP.

## 6. Dependency and configuration decisions

The current `package.json` does not contain the TDD's proposed Hono, Zod, TanStack Query, React Router, Sonner, Vitest, or Workers testing packages. Phase 0 must add only the packages justified by the chosen architecture and lock them.

The current `components.json` and installed UI primitives use Hugeicons, while the TDD mentions Lucide. The plan keeps Hugeicons to avoid replacing an already generated component system; product requirements do not depend on the icon vendor. If strict TDD parity is required, make that a separately approved migration before Phase 7.

The TDD describes a monorepo under `apps/web`; the actual app is a root package. Keep the root package and introduce `shared/`, `database/`, `tests/`, and Worker submodules in place. A monorepo move would add risk without advancing an MVP requirement.

The optional `chat_context_events` table is deferred until the core flow is stable. The first AI implementation uses stream title/category, approximate time, nomination count, and an optional creator note. Add short-lived sanitized chat context only if it can be implemented and deleted safely within the available delivery window.

## 7. Requirement traceability

| Requirement area | Planned phases | Primary evidence |
|---|---|---|
| OAuth, scopes, state, token security, disconnect | 0, 2, 8 | PRD FR-1.1-1.3; TDD 5.1, 13.3 |
| EventSub challenge, HMAC, replay, revocation, outbox | 1, 3, 8 | PRD FR-2.1-2.3; TDD 5.2-5.4, 6.1-6.2 |
| Grouping and distinct-viewer threshold | 1, 4 | PRD FR-3.1-3.4; TDD 6.3-6.4 |
| Clip create, verify, edit, retry | 4, 5, 8 | PRD FR-4.1-4.4; TDD 5.6-5.7, 10 |
| AI metadata and fallback | 1, 6, 7, 8 | PRD FR-5.1-5.3; TDD 7 |
| Dashboard and creator review | 0, 7, 8 | PRD FR-6.1-6.3 and screens 7.1-7.5 |
| Reliability, privacy, accessibility, observability | 1-8 | PRD FR-7.1-7.4; TDD 13-14 |
| Deployable demo and hackathon proof | 0, 8 | Scope 9-10; TDD 15-16 |

## 8. Cross-cutting test strategy

- Unit: command normalization, timestamp grouping, tie-breaking, distinct-viewer rules, state transitions, idempotency keys, HMAC, token crypto, AI schema/fallback.
- Worker integration: OAuth callback, D1 migrations/repositories, webhook challenge and notification, duplicate delivery, queue failure/outbox recovery, creator scoping, clip API mocks, AI errors.
- Browser/product: keyboard navigation, explicit status text, loading/error/empty/stale/disconnected states, metadata editing, copy-caption, settings confirmation.
- Live Twitch: HTTPS webhook, broadcaster OAuth, subscription enabled, two viewers, manual clip first, Get Clips verification, edit/publication behavior, offline/disabled clips, token expiry, AI quota fallback.
- Every phase adds tests for the behavior it introduces; Phase 8 runs the full suite and acceptance checklist.

## 9. Definition of done

The implementation is complete only when the product can connect a test broadcaster, receive and verify real chat nominations, group two viewers into one candidate, preserve that candidate through clip/AI failures, create and verify a real Twitch clip through a creator-confirmed action, generate or fall back to editable metadata, and expose truthful statuses in the dashboard. Build, lint, unit/integration tests, security review, and deployment verification must all be green or have an explicitly documented, non-blocking warning.

## 10. Open decisions that remain gates

- Confirm broadcaster user token satisfies the selected `channel.chat.message` subscription condition.
- Confirm current Twitch Create Clip publication/edit behavior before enabling automatic mode.
- Measure EventSub timestamp versus observed stream/VOD timing.
- Confirm `@cf/openai/gpt-oss-20b` model availability, response shape, latency, and Neurons consumption in the real account.
- Confirm Queues and required configuration are available in the selected Cloudflare account.
- Decide whether short-lived chat context is safe enough for MVP; otherwise omit it.

## 11. Reference notes

Current framework documentation checked through Context7 confirms:

- Cloudflare's Vite plugin supports a Worker-backed SPA and `runWorkerFirst` rules for `/api/*`; Wrangler config supports AI bindings, cron triggers, and Queue producer/consumer bindings.
- Hono's Cloudflare module pattern exports `app.fetch` and can expose typed bindings through `c.env` while additional `scheduled`/queue handlers remain on the module export.
- TanStack Query v5 supports `QueryClientProvider`, `refetchInterval`, and foreground-only polling behavior; the dashboard should use a five-second interval while active and avoid background polling by default.

These are implementation inputs for Phase 0 and Phase 7; the phase plans still require validation against the exact installed versions.
