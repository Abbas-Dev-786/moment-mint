# MomentMint — Product Requirements Document (PRD)

**Version:** 1.0  
**Status:** Hackathon MVP requirements  
**Last updated:** 30 October 2026  
**Target event:** Codex x TwitchCon Hackathon 2026

---

## 1. Product summary

MomentMint is a community-powered highlight discovery and AI-assisted clip preparation tool for Twitch streamers.

During a live broadcast, viewers nominate memorable moments by typing `!moment` in chat. MomentMint receives the Twitch chat event, records the nomination, groups nearby nominations into one candidate, and counts distinct viewers. When a candidate meets a configurable community threshold, it can be placed into an automatic clip-creation workflow if the broadcaster has explicitly enabled that behavior. Otherwise, the streamer can create the clip manually from the candidate.

MomentMint verifies clip creation with Twitch, then uses Cloudflare Workers AI to suggest a title, short description, and social caption from limited available context. The streamer reviews the result and decides whether to share it.

**Positioning:** Your community finds the moments. MomentMint helps turn them into clips. You decide what gets shared.

MomentMint is not a video editor and does not claim that an LLM can understand footage it has not been given. The first version relies on viewer nominations and chat context for discovery and uses Twitch's own clip workflow for video capture and editing.

---

## 2. Goals and non-goals

### 2.1 Goals

1. Make it effortless for viewers to nominate memorable livestream moments.
2. Help creators discover moments that their community independently valued.
3. Reduce duplicate nominations and resist trivial spam.
4. Convert qualifying candidates into real Twitch clip candidates with a transparent, reliable status lifecycle.
5. Reduce the creator's writing effort with AI-generated metadata.
6. Give the creator clear review controls and never automatically cross-post to external social platforms.
7. Build a small-channel-friendly workflow that can be demonstrated in a real Twitch test channel.
8. Use OpenAI Codex as a meaningful development tool and show that usage in the hackathon demo.

### 2.2 Non-goals for the hackathon MVP

- Full video editing, transcoding, storage, or automatic vertical-format conversion.
- Downloading or retaining complete Twitch VODs.
- Computer vision or audio understanding of live video.
- Publishing clips to third-party social networks.
- Viewer leaderboards, points, badges, or gamification.
- Twitch Extension development or Extension review.
- Multi-channel agency accounts, team seats, or editor permissions.
- AI-generated content that is published without streamer review.
- Multi-provider inference routing. Cloudflare Workers AI is the MVP provider.
- Advanced analytics, retention, conversion, or social growth attribution.

---

## 3. Users and personas

### 3.1 Streamer (primary)

**Profile:** Independent creator who streams on Twitch and manages their own content workflow.

**Needs:**
- Find noteworthy moments without watching the full VOD again.
- Let the community contribute to highlight discovery.
- Avoid spam, duplicate clips, and accidental clip creation.
- Review and correct titles/captions before sharing.
- Know whether Twitch has actually created a clip or whether a job failed.

**Success:** The streamer can review a concise list of community-selected moments and quickly produce a usable Twitch clip candidate.

### 3.2 Viewer (secondary)

**Profile:** A Twitch viewer who wants to help preserve memorable moments.

**Needs:**
- A simple, familiar command.
- A clear indication that the nomination was received, where feasible.
- No requirement to participate and no public pressure to compete.
- Protection against their repeated commands being used to inflate a moment's popularity.

**Success:** The viewer can nominate a moment in one chat message and return to watching.

---

## 4. Product principles

1. **Community signal, not chat volume:** Count distinct viewers, not repeated messages.
2. **Lurking is valid:** Participation is optional; do not label quiet viewers as disengaged.
3. **Creator remains in control:** Auto-creation must be explicitly enabled, and social sharing must remain creator initiated.
4. **Never lose a nomination:** Twitch or AI failure must not erase the candidate.
5. **Show truthful states:** Do not show “clip ready” until Twitch confirms the clip is retrievable.
6. **AI is an assistant, not an authority:** Generated metadata must be editable and grounded in available context.
7. **Privacy by minimization:** Avoid retaining raw chat text, viewer identity details, or tokens beyond what the feature needs.
8. **Simple first:** A clear, working end-to-end workflow is more valuable than many unfinished features.

---

## 5. Core user journey

### 5.1 First-time setup

1. Streamer visits MomentMint.
2. Streamer reads a short explanation of chat nominations and clip automation.
3. Streamer clicks “Connect Twitch”.
4. Twitch OAuth authorization opens with the required scopes.
5. Streamer approves the requested permissions.
6. MomentMint stores encrypted tokens and the Twitch broadcaster identity.
7. MomentMint registers the `channel.chat.message` EventSub webhook subscription.
8. MomentMint verifies the EventSub callback and shows connection status.
9. Streamer reviews the initial nomination threshold and decides whether automatic clip creation is enabled.
10. Dashboard shows the channel as ready or explains a specific setup issue.

### 5.2 Live nomination

1. Streamer is live and the EventSub subscription is enabled.
2. Viewer types `!moment`.
3. Twitch sends an EventSub notification.
4. MomentMint verifies the signature and deduplicates the message ID.
5. The event is stored and queued for processing.
6. The consumer finds or creates a nearby candidate moment.
7. The viewer's nomination is inserted only once for that candidate.
8. The candidate's distinct-viewer count is updated.
9. The dashboard refreshes and displays the updated count.

### 5.3 Threshold and clip workflow

1. A candidate reaches the configured distinct-viewer threshold.
2. MomentMint marks it as `THRESHOLD_MET` and creates at most one clip job.
3. If auto-clip creation is disabled, the candidate waits for a streamer action.
4. If auto-clip creation is enabled, the clip job calls Twitch's Create Clip API.
5. Twitch returns a clip ID and edit URL; the job moves to `VERIFYING`.
6. A verification job calls Get Clips using the ID.
7. If Twitch returns the clip, the job moves to `READY_FOR_REVIEW`.
8. If it is not available within the documented verification window, the job becomes `FAILED` or `MANUAL_REVIEW`; the candidate remains in the inbox.

### 5.4 AI metadata and review

1. After a clip is verified—or when the creator chooses—MomentMint collects a minimal context bundle.
2. Cloudflare Workers AI produces JSON metadata: title, summary, category, and social caption.
3. The Worker validates the response and stores the result.
4. The streamer edits or accepts the suggested text.
5. The streamer opens Twitch's edit flow if segment/title adjustment is needed.
6. The streamer decides whether to share the clip. MomentMint does not post to third-party social platforms in the MVP.

---

## 6. Functional requirements and user stories

### Epic 1 — Twitch account connection and setup

**FR-1.1 — Connect Twitch**  
As a streamer, I want to connect my Twitch account so that MomentMint can receive chat events and create clips on my channel.

Acceptance criteria:
- The connection flow uses Twitch's official OAuth authorization flow.
- The app requests only the permissions needed for chat reading and clip creation.
- The callback validates an unpredictable, single-use `state` value and exchanges the authorization code server-side.
- Access and refresh tokens are never sent to the browser.
- Tokens are encrypted before storage in D1.
- The UI shows connected, disconnected, expired, and reconnect-required states.
- Disconnecting revokes/deletes stored credentials where supported and disables the related EventSub subscription.

**FR-1.2 — Explain permissions**  
As a streamer, I want to understand why each Twitch permission is requested.

Acceptance criteria:
- The setup screen explains that `user:read:chat` is used to receive channel chat messages.
- The setup screen explains that `clips:edit` is used to request Twitch clips.
- The UI explains that clip creation may cause a clip to become visible under Twitch's own behavior and that the creator must review the flow before enabling automation.

**FR-1.3 — Configure automation**  
As a streamer, I want to choose whether reaching the threshold automatically requests a Twitch clip.

Acceptance criteria:
- Automatic clip creation is disabled by default until the Twitch API behavior has been validated in the deployed integration.
- The setting is explicit, saved, and visible in the dashboard.
- Enabling it requires a clear confirmation that MomentMint can request clips on the broadcaster's behalf.
- The streamer can turn it off at any time.

### Epic 2 — EventSub webhook and chat nomination

**FR-2.1 — Receive chat events**  
As a streamer, I want MomentMint to receive messages from my channel so viewers can nominate moments without installing an Extension.

Acceptance criteria:
- EventSub subscription uses `channel.chat.message` version `1` and webhook transport.
- Subscription condition identifies the broadcaster and authorized chatting user.
- The Worker handles callback verification challenges and returns the challenge exactly as Twitch expects.
- Notification signatures are verified using the EventSub secret and required message headers.
- Revocation notifications update the local subscription/connection state.
- Invalid signatures are rejected and never processed.

**FR-2.2 — Nominate with a chat command**  
As a viewer, I want to type `!moment` so I can flag the moment I just saw.

Acceptance criteria:
- Command comparison is case-insensitive and trims surrounding whitespace.
- Only the exact configured command is accepted (initially `!moment`).
- Ordinary chat messages are not stored permanently just because they were received.
- Each accepted nomination records broadcaster, stream session, viewer identifier needed for deduplication, source message ID, and approximate event time.
- The UI can show the count increasing after polling.

**FR-2.3 — Deduplicate webhook notifications**  
As the system, I must avoid processing the same EventSub notification more than once.

Acceptance criteria:
- `Twitch-Eventsub-Message-Id` is stored with a unique constraint.
- Duplicate deliveries cannot create duplicate nomination records.
- A webhook event that was persisted but not queued can be recovered by an outbox/reconciliation path.

### Epic 3 — Candidate grouping and community ranking

**FR-3.1 — Group nearby nominations**  
As a streamer, I want nominations for the same approximate event to be grouped into one candidate.

Acceptance criteria:
- Nominations within the configured 30-second grouping window are associated with one candidate when they fall within its anchored window.
- The grouping algorithm uses the EventSub notification timestamp header as an approximate event marker and records Worker receive time separately.
- The system does not claim the timestamp is the exact video frame or stream playhead.
- A later nomination outside an existing window creates a new candidate.
- The UI displays an approximate timestamp and communicates when timing is uncertain.

**FR-3.2 — Count distinct viewers**  
As a streamer, I want to see how many different viewers nominated a moment.

Acceptance criteria:
- A viewer can contribute at most one nomination to a given candidate.
- Database uniqueness constraints enforce the rule.
- Repeated commands by the same viewer do not increase the distinct count.
- A candidate is threshold-qualified when its distinct nomination count reaches the configured threshold.
- The initial default is two distinct viewers; threshold remains a configurable setting in the data model.

**FR-3.3 — Preserve below-threshold candidates**  
As a streamer, I want to review a moment even if only one person nominated it.

Acceptance criteria:
- Every valid nomination is retained as a candidate or attached to a candidate.
- Below-threshold candidates remain eligible for manual clip creation.
- A candidate does not disappear simply because it failed to meet the default threshold.

**FR-3.4 — Prevent duplicate clip jobs**  
As the system, I must create at most one automatic clip job per candidate unless the creator explicitly retries after failure.

Acceptance criteria:
- Clip job creation is protected by a unique idempotency key or unique candidate/attempt constraint.
- Repeated threshold events do not create parallel Twitch clip requests.
- Manual retry creates a new, auditable attempt only after the previous attempt is terminal or marked retryable.

### Epic 4 — Twitch clip creation and verification

**FR-4.1 — Request a clip**  
As a streamer, I want a qualifying moment to become a Twitch clip candidate.

Acceptance criteria:
- The Worker calls `POST /helix/clips?broadcaster_id={id}` using the broadcaster's authorized user access token with `clips:edit`.
- The request is not called if the streamer has not enabled automation and has not manually requested a clip.
- The system stores the Twitch clip ID and edit URL as soon as the request returns them.
- The system records the request time and nomination anchor time.
- If Twitch reports the channel is not live, clips are disabled, authorization is missing, or another API error occurs, the candidate remains stored and shows a useful reason.

**FR-4.2 — Verify clip creation**  
As a streamer, I want to know whether the clip actually exists.

Acceptance criteria:
- Clip creation is treated as asynchronous.
- The system polls `GET /helix/clips?id={clipId}` using bounded retries.
- A returned clip record changes the job to `READY_FOR_REVIEW`.
- If the official verification window is exceeded, the job becomes `FAILED` or `MANUAL_REVIEW`; it is never falsely shown as ready.
- The worker stores Twitch's clip URL, embed URL, title, thumbnail URL, duration, and available video/VOD metadata when returned.

**FR-4.3 — Preserve edit flow**  
As a streamer, I want to inspect the clip segment and correct it before sharing.

Acceptance criteria:
- The creator can open the Twitch edit URL from the review interface.
- The UI explains that the live Create Clip API captures a surrounding window and that the default segment may need adjustment.
- The UI does not promise a private draft or unlisted clip unless Twitch's current behavior has been verified.
- MomentMint never automatically posts the clip to an external social network.

**FR-4.4 — Manual clip creation**  
As a streamer, I want to request a clip from any saved candidate even when it did not reach the threshold.

Acceptance criteria:
- The creator can trigger the request from the candidate detail view.
- The request follows the same idempotency and verification behavior as automatic creation.
- The creator sees a confirmation before the API call.

### Epic 5 — AI-assisted content packaging

**FR-5.1 — Generate metadata**  
As a streamer, I want AI to suggest an engaging title, summary, category, and social caption so I spend less time writing.

Acceptance criteria:
- AI requests are made through the Cloudflare Workers AI binding, not directly from the browser.
- The initial model candidate is `@cf/openai/gpt-oss-20b`; model availability and output quality must be confirmed in the actual Cloudflare account.
- Inputs contain only necessary context: stream title/category when available, nomination count, approximate moment time, and a small sanitized chat excerpt.
- Viewer IDs, OAuth tokens, unrelated personal data, and full chat history are not sent to the model.
- The response is schema-validated before storage.
- Generated fields remain editable.
- The UI labels text as AI-suggested until accepted by the streamer.

**FR-5.2 — Avoid hallucinated video descriptions**  
As a streamer, I want AI suggestions to be based on evidence rather than invented visual details.

Acceptance criteria:
- The model is explicitly told that it has not watched the video.
- It may summarize chat reactions but cannot state what visually happened unless the streamer or another verified source supplied that fact.
- The UI can show a neutral fallback title when AI fails or returns invalid data.

**FR-5.3 — Graceful AI fallback**  
As a streamer, I want MomentMint to work even when AI is unavailable.

Acceptance criteria:
- AI timeout, quota error, model error, or malformed JSON does not block nomination or clip creation.
- The system saves fallback metadata, for example `Community highlight — 12:43`.
- The dashboard exposes a retry action.

### Epic 6 — Creator dashboard and review

**FR-6.1 — Live overview**  
As a streamer, I want to see the state of my current session.

Acceptance criteria:
- The dashboard displays Twitch connection/subscription state, active session state when known, nomination count, grouped moment count, and clip candidate count.
- The MVP uses polling at approximately five-second intervals while the dashboard is active.
- The UI distinguishes no active stream, active stream, disconnected integration, and stale data.

**FR-6.2 — Highlight inbox**  
As a streamer, I want to sort and inspect community candidates.

Acceptance criteria:
- Each candidate displays approximate timestamp, distinct viewer count, nomination state, clip state, and AI metadata status.
- Candidates can be sorted by time and distinct nomination count.
- Clicking a candidate opens details and available clip links.
- Empty state explains how to nominate a moment.

**FR-6.3 — Review and sharing**  
As a streamer, I want to check the clip and its metadata before sharing it.

Acceptance criteria:
- The streamer can view/embed the confirmed Twitch clip where possible.
- The streamer can edit the AI title, summary, and caption.
- The streamer can open the Twitch edit flow.
- The streamer can mark the candidate as reviewed or dismissed.
- Sharing to third-party networks is outside the MVP; a copy-caption action is sufficient.

### Epic 7 — Reliability, settings, and privacy

**FR-7.1 — Durable event processing**

Acceptance criteria:
- D1 is the durable source of truth.
- Queue consumers are idempotent.
- Failed jobs are retried with bounded attempts and eventually routed to a dead-letter queue or marked for manual review.
- A scheduled reconciliation job can find persisted but unprocessed webhook events or stuck clip jobs.

**FR-7.2 — Token security**

Acceptance criteria:
- Twitch tokens are encrypted with AES-GCM before insertion into D1.
- Encryption key is stored as a Worker secret, not in source control or D1.
- Tokens are never returned to the frontend or written into logs.
- OAuth state values are unpredictable, single-use, and short-lived.
- Token refresh updates encrypted token values and expiry.

**FR-7.3 — Minimize chat data**

Acceptance criteria:
- Store nomination data necessary for deduplication and grouping.
- Store only a small, time-bounded set of chat messages if needed for AI context.
- Do not store raw chat indefinitely.
- A cleanup task deletes expired context messages.
- The streamer is told what chat context is used for.

**FR-7.4 — Accessible interface**

Acceptance criteria:
- Core interactions work by keyboard.
- Status is communicated through text and icons, not color alone.
- Dialogs, menus, inputs, and buttons have accessible labels.
- Loading and error states are visible.

---

## 7. Screen requirements

### 7.1 Landing / connect screen

- Clear product positioning and short explanation.
- “Connect Twitch” primary action.
- Permission explanation.
- No false claim that automatic publishing is safe or enabled by default.

### 7.2 Setup screen

- Twitch account identity.
- EventSub connection status.
- Required scope confirmation.
- Nomination command display (`!moment`).
- Threshold setting and auto-clip toggle with explanatory copy.
- Reconnect/disconnect controls.

### 7.3 Dashboard screen

- Live/connection status.
- Session summary metrics.
- Highlight inbox.
- Clip job status.
- Clear empty state and refresh state.

### 7.4 Moment detail panel

- Approximate timestamp and confidence/accuracy note.
- Distinct viewer nomination count.
- Limited chat context where retained.
- Clip status, clip URL, embed URL, and edit URL actions.
- AI metadata fields with edit controls.
- Create/retry clip, generate metadata, dismiss/review actions.

### 7.5 Settings screen

- Connected Twitch identity.
- Threshold value.
- Grouping window.
- Auto clip creation opt-in.
- Chat context/AI preference and retention explanation.
- Disconnect account.

---

## 8. Data and state requirements

### Moment states

`COLLECTING` → `THRESHOLD_MET` → `CLIP_REQUESTED` → `CLIP_READY` → `REVIEWED` / `DISMISSED`

Alternative terminal/error states: `CLIP_FAILED`, `MANUAL_REVIEW`.

### Clip job states

`QUEUED` → `CREATING` → `VERIFYING` → `READY_FOR_REVIEW`

Failure states: `RETRYABLE_FAILED`, `FAILED`, `MANUAL_REVIEW`.

### AI metadata states

`NOT_REQUESTED` → `PENDING` → `READY`

Failure state: `FAILED_WITH_FALLBACK`.

All transitions must be persisted and auditable. Invalid state transitions must be rejected by backend domain logic.

---

## 9. Edge cases and expected behavior

| Scenario | Expected behavior |
|---|---|
| Duplicate EventSub message ID | Ignore duplicate processing; preserve the original event record |
| Viewer repeats `!moment` for same candidate | Do not increment distinct-viewer count |
| Viewer nominates again for a later moment | Allow it if it falls outside the same candidate and viewer cooldown rules |
| Two candidates overlap in time | Attach to nearest eligible candidate; deterministic tie-breaker by earliest anchor |
| Event delivery is delayed | Use the EventSub message timestamp header as approximate marker; store Worker receive time; do not claim frame-accurate timing |
| Candidate does not reach threshold | Keep it in inbox and allow manual clip creation |
| Broadcaster goes offline before clip request | Keep candidate; mark auto clip unavailable; manual VOD workflow is not promised in MVP |
| Clips disabled or restricted | Explain the Twitch response and retain candidate |
| Missing/expired token | Refresh when possible; otherwise mark reconnect required |
| Twitch clip API returns a clip ID but clip is not yet retrievable | Keep `VERIFYING`; use bounded checks; do not show ready prematurely |
| Clip verification times out | Preserve candidate and offer retry/manual review |
| AI model times out or quota exhausted | Save fallback metadata; core workflow continues |
| AI describes unseen footage | Reject or regenerate; use neutral fallback wording |
| Queue job is delivered multiple times | Idempotency key and DB constraints prevent duplicate effects |
| Queue is unavailable after event persistence | Outbox/reconciliation job re-enqueues pending event |
| Streamer disconnects MomentMint | Disable/unsubscribe EventSub; no new notifications should be processed for that creator |

---

## 10. Non-functional requirements

### Reliability

- Webhook endpoint should respond promptly after signature verification and durable acceptance.
- Queue processing must be retryable and idempotent.
- D1 remains authoritative for all user-visible statuses.
- Clip and AI failures are isolated from nomination ingestion.

### Performance

- Dashboard API should use pagination or bounded result sets.
- Poll only while the dashboard is visible/active.
- Avoid model calls on every chat message; AI is called only for selected candidates.
- Keep webhook work minimal and move all nonessential processing into Queues.

### Security

- HTTPS only.
- Strict Twitch webhook signature verification.
- Server-side OAuth and token encryption.
- No credentials in frontend bundles, logs, screenshots, or repository.
- Validate owner/creator ID on every candidate and clip API request.
- Rate-limit manual clip creation and AI generation.

### Privacy

- Do not persist ordinary raw chat history indefinitely.
- Do not send viewer identifiers to the AI model.
- Disclose the limited use of chat context for AI suggestions.
- Provide a disconnect and data deletion pathway in the product design.

### Accessibility and usability

- Keyboard navigable components.
- Semantic headings and form labels.
- Status text, not color alone.
- Responsive dashboard for laptop and smaller screens.

---

## 11. MVP acceptance checklist

The MVP is considered demonstrable when all of the following are true:

- [ ] A user can connect a Twitch test broadcaster.
- [ ] Tokens are stored server-side and encrypted.
- [ ] EventSub subscription for channel chat messages is enabled.
- [ ] Twitch webhook callback verification succeeds.
- [ ] Invalid signatures are rejected.
- [ ] Two distinct viewer accounts can nominate a moment.
- [ ] One viewer spamming the command cannot satisfy the distinct-viewer threshold.
- [ ] Nearby nominations are grouped into one moment.
- [ ] Candidate is stored and visible in the dashboard.
- [ ] Manual clip request succeeds, or auto-clip mode succeeds after explicit opt-in and real API behavior validation.
- [ ] Twitch clip is verified with Get Clips before UI marks it ready.
- [ ] AI produces structured metadata or deterministic fallback is used.
- [ ] Streamer can review and edit metadata.
- [ ] Streamer can open the Twitch edit flow and choose whether to share.
- [ ] Clip/AI failure does not remove the candidate.
- [ ] README explains how to configure and run the application.
- [ ] Under-three-minute public/unlisted YouTube demo shows Twitch functionality and Codex usage.

---

## 12. Hackathon judging alignment

| Official criterion | How MomentMint demonstrates it |
|---|---|
| Innovation / Idea | Community nominations become a structured highlight-discovery signal, rather than relying only on automated AI detection or manual VOD review. |
| Potential Impact | Reduces creator effort and helps viewers contribute to the creator's content workflow. |
| Technological Implementation | Twitch OAuth, EventSub webhooks, clip creation/verification, Cloudflare Queues, D1, Workers AI, and Codex-assisted implementation. |
| Design | Clear, polished creator dashboard with useful status states, review controls, and an understandable live demo. |

---

## 13. Demo script outline (under three minutes)

1. **Problem (15–20 seconds):** Streamers miss moments and spend time searching VODs.
2. **Connect (15 seconds):** Show connected Twitch channel and active EventSub state.
3. **Community signal (30–40 seconds):** Two test viewers type `!moment`; show one grouped candidate and distinct viewer count.
4. **Clip creation (30–40 seconds):** Show the threshold/candidate and a real Twitch clip request/verification. Explain edit review.
5. **AI packaging (20–30 seconds):** Show generated title, summary, caption, and editing.
6. **Creator control (15 seconds):** Show the streamer opening the edit/share flow.
7. **Codex build proof (15–20 seconds):** Show the Codex session/build workflow and mention how Codex helped implement integrations.

Use permitted footage and audio. Do not include third-party copyrighted content unless authorized.

---

## 14. Open questions to validate during implementation

1. Does the broadcaster's own user access token with `user:read:chat` satisfy the selected EventSub chat subscription condition for the intended account setup? Verify by creating the subscription in a real Twitch test channel.
2. Does Twitch's current Create Clip API behavior result in a public clip immediately, and how does its edit URL work for this account? Verify before enabling automatic mode by default.
3. What is the observed difference between EventSub message timestamp header and the actual VOD/playback position in a test broadcast?
4. Does `@cf/openai/gpt-oss-20b` provide acceptable latency and valid structured output within the available Workers AI Neurons allocation?
5. Are Cloudflare Queues available on the selected account and free plan with the required configuration? Verify in dashboard and local/remote development.

---

## 15. Reference links

- Twitch EventSub subscriptions: https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/
- Twitch webhook handling: https://dev.twitch.tv/docs/eventsub/handling-webhook-events/
- Twitch Clips API: https://dev.twitch.tv/docs/api/clips
- Twitch OAuth: https://dev.twitch.tv/docs/authentication/
- Cloudflare Workers AI: https://developers.cloudflare.com/workers-ai/
- GPT-OSS 20B: https://developers.cloudflare.com/workers-ai/models/gpt-oss-20b/
- Cloudflare D1: https://developers.cloudflare.com/d1/
- Cloudflare Queues: https://developers.cloudflare.com/queues/
- Cloudflare Vite plugin: https://developers.cloudflare.com/workers/vite-plugin/
- shadcn/ui: https://ui.shadcn.com/docs/installation/vite
- Tailwind CSS: https://tailwindcss.com/docs/installation/using-vite
