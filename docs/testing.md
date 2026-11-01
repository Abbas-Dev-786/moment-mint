Use this order so failures are easy to isolate.

## 1. Preflight

From the repository:

pnpm install --frozen-lockfile
pnpm test
pnpm run build
pnpm run lint
pnpm run production:check
pnpm exec wrangler d1 migrations list momentmint --remote

Expected:

- Tests: all passing
- Build: successful
- Production check: passed
- Remote migrations: all applied

Public smoke tests:

curl.exe -i https://moment-mint.abbasbhp787.workers.dev/health
curl.exe -i https://moment-mint.abbasbhp787.workers.dev/health/ready
curl.exe -i https://moment-mint.abbasbhp787.workers.dev/connect
curl.exe -i https://moment-mint.abbasbhp787.workers.dev/api/me

Expected:

- /health: 200
- /health/ready: 200, database/configuration both ok
- /connect: 200 HTML
- /api/me: 401 while logged out

## 2. Twitch connection

Use a dedicated Twitch test broadcaster.

1. Open /connect.
2. Click Connect Twitch.
3. Approve user:read:chat and clips:edit.
4. Confirm redirect returns to the dashboard.
5. Confirm /api/me returns creator information.
6. Inspect browser storage:
   - No Twitch access token
   - No Twitch refresh token
   - Session cookie is HttpOnly and Secure

Also test:

- Denying OAuth
- Refreshing the callback page
- Using an expired or reused OAuth state
- Disconnecting Twitch
- Reconnecting afterward

## 3. EventSub

From the Connect or Settings screen:

1. Click Register EventSub.
2. Confirm status becomes enabled or verification-pending, then enabled.
3. Confirm the Twitch callback URL is exactly:

https://moment-mint.abbasbhp787.workers.dev/webhooks/twitch

4. Send a normal chat message. It must not create a candidate.
5. Send:

!moment

6. Confirm the webhook is accepted and the nomination appears in the dashboard.

Negative tests:

- Invalid signature
- Missing EventSub headers
- Old timestamp
- Duplicate EventSub delivery
- Revocation event

Expected: invalid requests are rejected, duplicates do not create duplicate nominations, and revocations show a reconnect-required state.

## 4. Nomination grouping

Use two distinct viewer accounts.

Test cases:

| Test | Expected result |
|---|---|
| Two viewers send !moment within 30 seconds | One candidate, count 2 |
| Same viewer sends it repeatedly | Count remains 1 |
| !MOMENT | Accepted |
| !momentplease | Ignored |
| Nomination outside grouping window | New candidate |
| One viewer only | Candidate remains visible below threshold |
| Repeated EventSub delivery | No duplicate nomination |
| Threshold reached twice | One automatic clip-job intent maximum |

The dashboard should update within approximately five seconds.

## 5. Manual clip lifecycle

Keep automatic clipping disabled for the first test.

1. Open a candidate.
2. Click Create clip.
3. Confirm the dialog.
4. Observe:

QUEUED → CREATING → VERIFYING → READY_FOR_REVIEW

5. Confirm the clip only becomes ready after Twitch Get Clips returns it.
6. Test:
   - Open Twitch clip
   - Open edit flow
   - Preview/embed
   - Retry after failure
   - Mark reviewed
   - Dismiss candidate

Failure tests:

- Broadcaster offline
- Clips disabled
- Expired Twitch authorization
- Twitch 401/403
- Twitch 429
- Twitch 5xx
- Clip not returned before the verification deadline

Expected: the candidate remains visible and becomes FAILED or MANUAL_REVIEW; it must never falsely show ready.

## 6. AI metadata

From a selected candidate:

1. Click Generate with AI.
2. Confirm status:

PENDING → READY

3. Verify fields:
   - Title
   - Summary
   - Category
   - Social caption
4. Edit each field.
5. Save metadata.
6. Copy the caption.
7. Regenerate metadata.

You can test the protected smoke endpoint from the authenticated browser console:

fetch("/api/ai/smoke-test", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ confirm: true })
}).then(async response => ({
  status: response.status,
  body: await response.json()
}))

Expected AI failure behavior:

- Fallback metadata is saved
- Candidate and clip states remain unchanged
- Retry remains available
- No viewer IDs or full chat history are sent to AI

## 7. Settings and account controls

Test:

- Change threshold
- Change grouping window
- Enable automatic clips
- Confirm automatic-clip disclosure dialog
- Save and refresh
- Register/re-register EventSub
- Log out
- Disconnect Twitch

After disconnecting, confirm:

- Session is invalid
- Twitch credentials are removed from D1
- EventSub subscriptions are disabled
- Reconnect works cleanly

## 8. Security and ownership

Verify:

- Logged-out API requests return 401
- Cross-origin state-changing requests are rejected
- Creator A cannot access Creator B’s moment or clip
- Manual clip and AI actions eventually return 429 when rate limits are exceeded
- No credentials appear in API responses, browser storage, logs, or queue payloads
- Response headers include CSP, HSTS, nosniff, frame protection, and permissions policy

## 9. Final acceptance checklist

Phase 8 is fully validated when all of these pass:

- /health/ready returns 200
- OAuth succeeds with the production Twitch app
- EventSub reaches enabled
- Two viewers produce one grouped candidate
- Duplicate viewers do not inflate counts
- Manual clip reaches verified ready state
- Clip failure preserves the candidate
- AI produces editable metadata or fallback metadata
- Settings, review, retry, logout, and disconnect work
- Production logs show no secrets or raw chat
- Tests, build, lint, and remote migration checks pass

The only checks that cannot be proven by local automated tests are the real Twitch OAuth, EventSub, clip, and Workers AI flows. Those must be performed with your live broadcaster and viewer test accounts.

