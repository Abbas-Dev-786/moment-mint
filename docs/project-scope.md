# MomentMint — Project Scope

**Document version:** 1.0  
**Status:** Working scope for the Codex x TwitchCon Hackathon  
**Last updated:** 30 October 2026  
**Submission deadline:** 2 November 2026, 2:00 PM Pacific Time (3 November 2026, 3:30 AM India Standard Time)

---

## 1. Product name and positioning

### Product name

**MomentMint**

### One-line summary

MomentMint turns Twitch viewers' live nominations into a ranked highlight inbox, automatically prepares qualifying clip candidates, and uses AI to help streamers package memorable moments for sharing.

### Product promise

**Your community finds the moments. MomentMint helps turn them into clips. You decide what gets shared.**

### Product category

Creator productivity, live community engagement, and AI-assisted content preparation.

---

## 2. Target users

### Primary user: independent Twitch streamer

A streamer who broadcasts regularly, manages their own channel, and does not have a dedicated editor or production team. They want to retain memorable content without reviewing an entire VOD after every stream.

### Secondary user: viewer/community member

A viewer who wants to contribute to the stream community by flagging funny, surprising, impressive, or meaningful moments. Participation must remain optional; viewers who prefer to lurk should not be pressured or ranked.

### Initial product focus

Design for any streamer, but make the setup and core workflow practical for a small channel with a modest number of active chatters. The initial threshold must be configurable in the product design, with a default chosen for the hackathon demo.

---

## 3. Problem statement

Streamers often have to entertain live, moderate chat, remember noteworthy events, find moments in VODs, create clips, and prepare content for social platforms. This creates a fragmented post-stream workflow. The streamer may miss moments that viewers found memorable, and manually searching long recordings takes time.

Viewers already react to moments in chat. MomentMint treats those reactions as a lightweight discovery signal: a viewer nominates a moment, independent nominations are grouped, and the streamer receives a prioritized candidate with context.

The product does **not** assume that the number of chat messages is a reliable measure of quality. It uses distinct viewer nominations as one signal, protects against repeated nominations, and keeps editorial control with the streamer.

---

## 4. Core product hypothesis

If viewers can nominate moments with a simple chat command, and MomentMint can group those nominations into a low-friction highlight inbox, then streamers can discover audience-valued moments faster than by manually reviewing the full VOD.

AI can reduce the remaining packaging effort by drafting titles, short summaries, and social captions from limited, explicitly available context. AI is not responsible for deciding whether a video moment is objectively good, and it must not claim to have watched footage it has not received.

---

## 5. Core workflow

1. A streamer signs in to MomentMint with Twitch and authorizes the required permissions.
2. MomentMint registers a Twitch EventSub webhook subscription for channel chat messages.
3. During a live stream, a viewer types `!moment` in chat.
4. MomentMint validates the Twitch webhook, deduplicates the notification, and stores the nomination.
5. Nominations near the same event time are grouped into one candidate moment.
6. Distinct viewers are counted once per candidate. A configurable threshold can make the candidate eligible for automatic clip creation.
7. A clip job is created idempotently. The Twitch Clips API is called only when the streamer has enabled automatic clip creation or explicitly requests a clip.
8. MomentMint verifies whether Twitch created the clip and stores the clip URL, edit URL, status, and associated candidate.
9. Cloudflare Workers AI generates optional title, summary, and social caption suggestions from limited chat/stream context.
10. The streamer reviews the candidate, checks the clip segment/title in Twitch's editing flow where available, and decides whether to share it.
11. If clip creation fails, MomentMint retains the candidate and allows manual retry or review.

---

## 6. What we are building for the hackathon MVP

### Must-have

- Twitch OAuth connection for one broadcaster account per MomentMint user.
- Secure handling of Twitch access and refresh tokens.
- EventSub webhook registration and signature verification.
- `!moment` nomination capture from Twitch chat.
- Event/message deduplication and one nomination per viewer per grouped moment.
- Time-window grouping and distinct-viewer threshold detection.
- D1 persistence for creators, stream sessions, webhook events, nominations, moments, clip jobs, and AI metadata.
- Cloudflare Queues for asynchronous nomination/clip/AI jobs, with idempotent consumers.
- Twitch live Clip API integration using the broadcaster's authorized token.
- Clip verification using the Twitch Get Clips endpoint.
- A creator dashboard that shows live session status, nominations, candidate moments, nomination counts, clip states, and AI metadata.
- Cloudflare Workers AI integration for editable titles, summaries, and social captions.
- Creator-controlled review and sharing workflow.
- Useful empty, loading, processing, failed, and disconnected states.
- A deployable Cloudflare app and a documented demo/test setup.

### Proposed MVP defaults (subject to live integration test)

| Setting | Initial default | Notes |
|---|---:|---|
| Nomination command | `!moment` | Case-insensitive, whitespace-trimmed command |
| Distinct viewers to qualify | 2 | A prototype default, not a proven optimal value |
| Grouping window | 30 seconds | Uses EventSub message timestamp header as an approximate event marker, not a video-frame timestamp |
| One nomination per viewer | Per grouped moment | Enforced by a database uniqueness constraint |
| Auto clip creation | Off until broadcaster opts in | Requires explicit setup and disclosure because Twitch's API has a publication/edit workflow that must be validated |
| AI generation | On demand after clip candidate creation | Does not block nomination or clip processing |
| Dashboard refresh | 5 seconds while open | Polling is sufficient for the MVP |

### Important product-control decision

The PRD may describe threshold-triggered automatic clip creation, but implementation must not assume the Twitch API creates a private draft. Twitch's current Clips guide says the API publishes a default segment and returns an `edit_url` for selecting the portion/title. Therefore:

- The MVP should default to **candidate-only/manual clip creation** until the real Twitch flow is tested and the streamer explicitly enables automatic clip creation.
- If the current Twitch API flow makes a clip publicly visible as soon as created, the product must tell the streamer this before enabling automation.
- MomentMint will never automatically publish to external social networks.

---

## 7. What we are not building

The following are explicitly outside the hackathon MVP:

- Full video hosting or video transcoding.
- Automatic downloading of Twitch VODs or storing full video files.
- Automatic portrait/vertical editing, subtitles, templates, or multi-track video editing.
- Automatic cross-posting to TikTok, YouTube Shorts, Instagram, or other social networks.
- A Twitch Extension requiring review.
- A public viewer leaderboard, viewer reputation score, or rewards system.
- A full community archive or persistent lore system.
- AI vision/audio analysis of the stream video.
- Multi-provider AI routing (Groq/OpenRouter). Cloudflare Workers AI is the sole MVP inference provider.
- Multi-tenant teams, agencies, or editor roles.
- Advanced analytics, growth attribution, or clip performance reporting.
- Complex real-time WebSocket infrastructure or Durable Objects unless polling proves inadequate.

---

## 8. Differentiation and inspiration

MomentMint is not positioned as another generic AI clip generator. Its intended differentiator is **community-informed discovery**: independent viewer nominations are captured, grouped, and surfaced to the creator.

AI is used after discovery to reduce the content-packaging workload. The product keeps deterministic rules for nomination counting, threshold checks, clip lifecycle, permissions, and publishing decisions.

Existing Twitch clip tools and AI clip editors mean the team must demonstrate the distinct nomination-to-highlight workflow, not claim that automatic clipping or AI titles are novel by themselves.

---

## 9. Demo path

The strongest demo should show one complete, real workflow:

1. Streamer connects a Twitch test channel.
2. EventSub is enabled and the dashboard shows the channel as connected/live.
3. Two distinct test viewers send `!moment` close together in chat.
4. MomentMint groups the nominations and shows the threshold state.
5. Depending on the validated clip flow and creator setting, MomentMint creates a clip candidate or asks the streamer to trigger creation.
6. Twitch confirms the clip; the dashboard shows the real clip URL/embed and edit flow.
7. Workers AI generates an editable title, summary, and caption from the permitted context.
8. The streamer reviews the result and chooses whether to share it.
9. Demonstrate a failure/fallback: disable clips or simulate an AI failure and show that the nomination remains saved.

Use real Twitch integration in the demo wherever possible. If a live API dependency cannot be made stable, label any fallback/simulated data clearly and do not present it as a live Twitch result.

---

## 10. Success criteria

### Product success

- A streamer can connect a Twitch channel without manually handling API tokens.
- A viewer can nominate a moment using one chat command.
- Two different viewers nominating within the grouping window create one candidate, not duplicate moments.
- Repeated commands from the same viewer do not inflate the distinct-viewer count.
- Candidate and clip states are visible and understandable.
- Clip creation failures do not delete nominations or candidate moments.
- AI metadata is editable and never blocks core functionality.
- A streamer can review before sharing.

### Hackathon success

- The project is clearly connected to Twitch and built during the official submission period using OpenAI Codex.
- The implementation demonstrates a real, working Twitch interaction.
- The submission video (under 3 minutes) shows both the Twitch workflow and how Codex was used.
- The repository contains source code, assets, setup instructions, and safe environment-variable configuration.

---

## 11. Technical direction (summary only)

- **Frontend:** React + Vite + TypeScript.
- **UI system:** shadcn/ui components, Tailwind CSS v4, CSS variables, Lucide icons.
- **Cloud runtime:** Cloudflare Workers using the Cloudflare Vite plugin.
- **Static hosting:** Worker Static Assets for the React SPA.
- **Database:** Cloudflare D1 (SQLite).
- **Async processing:** Cloudflare Queues and a dead-letter queue.
- **Scheduled recovery:** Cloudflare Cron Triggers.
- **AI:** Cloudflare Workers AI using `@cf/openai/gpt-oss-20b` as the first model candidate, subject to availability, quality, and daily Neurons budget tests.
- **Twitch integration:** OAuth, EventSub webhooks, Helix Clips API.

Detailed architecture, API contracts, data model, file structure, and test plan are defined in `03_MomentMint_Technical_Design.md`.

---

## 12. Scope risks and assumptions

1. **Twitch clip behavior:** Clip creation is asynchronous and the exact draft/publication UX must be tested. Do not promise private drafts or automatic social publishing.
2. **Timestamp precision:** EventSub's chat event body does not expose a precise video playhead timestamp. The EventSub message timestamp header and Worker receive time are approximate markers. The 90-second capture window and `edit_url` are part of the MVP mitigation.
3. **Chat authorization:** `channel.chat.message` requires `user:read:chat` from the chatting user. For the simplest MVP, use the broadcaster as the chatting user; app-token/bot mode requires additional scopes and/or moderator status.
4. **AI budget/model availability:** Workers AI has a daily free Neurons allocation, but model usage is metered. The application must degrade gracefully when the quota is exhausted or a model invocation fails.
5. **Queue limits:** Cloudflare Queues free tier has daily operation and retention limits. D1 is the durable source of truth; queues are not the only record of work.
6. **Privacy:** Store only the minimum chat context needed to prepare metadata, explain this collection to the streamer, and expire raw context quickly.

---

## 13. Decision log

| Decision | Current direction | Status |
|---|---|---|
| Product positioning | Community-informed highlight discovery + AI-assisted packaging | Agreed direction |
| Viewer interaction | `!moment` chat command | MVP assumption |
| Threshold | 2 distinct viewers / 30-second window | Test default |
| Clip workflow | Threshold can qualify a candidate; actual auto-creation gated by streamer setting and API validation | Guardrail required |
| AI provider | Cloudflare Workers AI only | Chosen for MVP |
| AI model | `@cf/openai/gpt-oss-20b` | Initial candidate; verify in account before locking |
| Backend | Cloudflare Workers | Chosen |
| Database | Cloudflare D1 | Chosen |
| Async processing | Cloudflare Queues | Chosen if enabled in the account; durable outbox fallback remains required |
| Frontend | React + Vite + TypeScript | Chosen |
| UI | shadcn/ui + Tailwind CSS v4 | Chosen |
| Real-time dashboard | 5-second polling initially | MVP simplification |

---

## 14. Official and implementation references

- Twitch EventSub subscription types: https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/
- Twitch handling webhook events: https://dev.twitch.tv/docs/eventsub/handling-webhook-events/
- Twitch Clips: https://dev.twitch.tv/docs/api/clips
- Twitch OAuth: https://dev.twitch.tv/docs/authentication/
- Cloudflare Workers Vite plugin: https://developers.cloudflare.com/workers/vite-plugin/
- Cloudflare Workers AI pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/
- Cloudflare GPT-OSS 20B model: https://developers.cloudflare.com/workers-ai/models/gpt-oss-20b/
- Cloudflare D1 pricing: https://developers.cloudflare.com/d1/platform/pricing/
- Cloudflare Queues pricing: https://developers.cloudflare.com/queues/platform/pricing/
- shadcn/ui Vite guide: https://ui.shadcn.com/docs/installation/vite
- Tailwind CSS Vite guide: https://tailwindcss.com/docs/installation/using-vite
