# Phase 7 — Creator dashboard, review workflow, and polling

## Objective

Replace the starter UI with the product workflow: connection/setup, live overview, highlight inbox, moment detail/review, and settings with truthful status and recovery states.

## Evidence and constraints

- PRD screens 7.1-7.5 and FR-6.1-6.3 define the required views, actions, statuses, and review controls.
- TDD 2.1-2.2, 9, and 11 define React/TanStack Query structure, API routes, UI separation, and accessibility expectations.
- Current `src/components/ui/` already contains generated primitives; product components must compose them rather than modify them globally.

## Implementation tasks

1. Add `QueryClientProvider`, a typed fetch/API client, response/error normalization, and route/page structure. Use TanStack Query v5 with five-second `refetchInterval` while the dashboard is active; keep default background polling off.
2. Build the landing/connect screen with positioning, scope explanations, explicit auto-clip disclosure, and connection/reconnect states.
3. Build setup/settings with Twitch identity, EventSub status, command, threshold, grouping window, auto-clip confirmation, chat-context explanation, disconnect, loading, and errors.
4. Build dashboard overview metrics: connection/subscription, stream state, nomination count, grouped moments, clip-ready/processing counts, stale-data indicator, and last refresh.
5. Build the highlight inbox with time/count sorting, bounded list, empty state, candidate statuses, approximate timestamp warning, and keyboard navigation.
6. Build moment detail/review with nomination count, retained context only when allowed, clip/embed/edit links, AI fields, generate/retry, create/retry clip confirmation, mark reviewed/dismissed, and copy-caption action.
7. Use semantic labels, focus management, accessible dialogs, keyboard operation, text+icon statuses, responsive layout, and safe plain-text rendering for AI output. Add loading/skeleton, empty, processing, stale, error, and disconnected states.
8. Remove or archive starter images/links/CSS once no product screen uses them. Keep generated UI primitives isolated in `src/components/ui/`.

## Verification

- Component tests cover connection states, polling pause/inactive behavior, sorting, empty/error/stale states, confirmation dialogs, and editable metadata.
- Browser smoke test covers connect redirect, dashboard polling, candidate selection, clip review, settings update, and logout/disconnect.
- Keyboard and screen-reader pass over primary flows; color is never the only state signal.
- Verify API responses do not expose tokens or untrusted HTML.

## Exit checkpoint

The real candidate/clip workflow is understandable and usable from the dashboard, with five-second foreground updates and all required creator controls. Phase 8 can harden and deploy.

