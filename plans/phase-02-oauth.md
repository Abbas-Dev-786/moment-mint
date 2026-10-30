# Phase 2 — Twitch OAuth, encrypted credentials, and creator session

## Objective

Connect one Twitch broadcaster securely, persist only encrypted credentials server-side, and establish the authenticated creator session used by every dashboard/API route.

## Evidence and constraints

- PRD FR-1.1-1.3 requires official OAuth, minimal scopes, single-use state, server-side exchange, encrypted tokens, connection states, and disconnect behavior.
- TDD 5.1 and 13.3 define AES-GCM, HttpOnly/Secure/SameSite cookies, refresh handling, and scope validation.
- Scope proposes `user:read:chat` and `clips:edit`; broadcaster-as-chat-reader remains an account-level validation gate.

## Implementation tasks

1. Add a short-lived `oauth_states` table or equivalent state repository with hashed, random state, creator/session correlation, expiry, and used-at protection.
2. Implement `GET /oauth/twitch/start`: validate configured client/redirect values, generate state with Web Crypto, persist only its hash, and redirect to Twitch with the exact requested scopes.
3. Implement `GET /oauth/twitch/callback`: handle denial/errors, atomically consume state, exchange the code server-side, validate the user identity and granted scopes, and upsert the creator.
4. Implement AES-GCM token encryption/decryption using Web Crypto and `TOKEN_ENCRYPTION_KEY`. Store ciphertext, IV, expiry, and granted scopes; never return plaintext to route handlers that serialize browser responses.
5. Create an opaque MomentMint session record/cookie using `SESSION_SECRET`. Use HttpOnly, Secure in production, SameSite, expiry, and CSRF protection for state-changing browser routes.
6. Add token validation/refresh with safe error categorization. On refresh failure, mark `RECONNECT_REQUIRED` and stop new Twitch API work.
7. Implement `/api/me`, `/api/auth/logout`, and `/api/twitch/disconnect`. Disconnect must delete/revoke local credentials where supported and disable related EventSub subscriptions once Phase 3 exists.
8. Add setup copy explaining `user:read:chat`, `clips:edit`, and the unverified/public clip behavior guardrail; keep automation disabled by default.

## Verification

- Unit test state randomness/expiry/one-time use, AES-GCM round trip, wrong-key failure, and safe cookie flags.
- Integration test success, denial, invalid state, missing scope, token exchange failure, refresh failure, logout, and disconnect.
- Browser/API response inspection proves access/refresh tokens are absent from JSON, cookies, logs, and bundles.
- Use a separate Twitch test app/account and verify the actual redirect URI and granted scopes.

## Exit checkpoint

A test broadcaster can connect and return to a creator-scoped session; the database contains only encrypted tokens; reconnect/disconnect states are truthful. EventSub registration is the next phase.

