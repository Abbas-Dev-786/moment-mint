export interface AssetBinding {
  fetch(request: Request): Promise<Response>
}

/**
 * Phase 0 environment boundary.
 *
 * Resource bindings such as D1, Queues, and Workers AI are intentionally
 * added in Phase 1. Keeping the boundary typed here prevents route code from
 * reaching for process.env or browser-exposed configuration.
 */
export interface AppBindings {
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
