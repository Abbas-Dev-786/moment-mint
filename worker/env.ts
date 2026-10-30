import type { QueueMessage } from "../shared/contracts/domain.js"

export interface AssetBinding {
  fetch(request: Request): Promise<Response>
}

/**
 * Worker environment boundary. Keeping bindings here prevents route code from
 * reaching for process.env or browser-exposed configuration.
 */
export interface AppBindings {
  DB: D1Database
  MOMENTMINT_JOBS: Queue<QueueMessage>
  MOMENTMINT_JOBS_DLQ?: Queue<QueueMessage>
  AI?: Ai
  EVENTSUB_SECRET?: string
  APP_BASE_URL: string
  TWITCH_CLIENT_ID: string
  TWITCH_REDIRECT_URI: string
  AI_MODEL_ID: string
  DEFAULT_GROUP_WINDOW_SECONDS: string
  DEFAULT_UNIQUE_VIEWER_THRESHOLD: string

  TWITCH_CLIENT_SECRET: string
  TOKEN_ENCRYPTION_KEY: string
  SESSION_SECRET: string

  ASSETS?: AssetBinding
}
