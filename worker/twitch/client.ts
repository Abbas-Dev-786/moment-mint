import { decryptSecret } from "../lib/crypto.js"
import { encryptSecret } from "../lib/crypto.js"
import { updateCreatorStatus } from "../repositories/creator.js"
import type { CreatorRow } from "../repositories/creator.js"

const TWITCH_API = "https://api.twitch.tv/helix"
const TWITCH_OAUTH = "https://id.twitch.tv/oauth2"

export const isTrustedTwitchUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && (url.hostname === "twitch.tv" || url.hostname.endsWith(".twitch.tv"))
  } catch {
    return false
  }
}

export const requiredScopes = ["user:read:chat", "clips:edit"] as const

export class TwitchApiError extends Error {
  readonly status: number
  readonly code: string
  readonly retryable: boolean

  constructor(status: number, code: string, retryable: boolean) {
    super(code)
    this.status = status
    this.code = code
    this.retryable = retryable
  }
}

export type TwitchTokenValidation = {
  client_id: string
  login: string
  scopes: string[]
  user_id: string
  expires_in: number
}

type TwitchCreator = Pick<CreatorRow, "id" | "twitch_user_id" | "access_token_ciphertext" | "access_token_iv" | "refresh_token_ciphertext" | "refresh_token_iv" | "token_expires_at">

const twitchResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw new TwitchApiError(response.status, response.status === 401 || response.status === 403 ? "RECONNECT_REQUIRED" : response.status === 429 ? "TWITCH_RATE_LIMITED" : response.status >= 500 ? "TWITCH_UNAVAILABLE" : "TWITCH_API_ERROR", response.status === 429 || response.status >= 500)
  }
  return response.json() as Promise<T>
}

export const exchangeCode = async (env: { TWITCH_CLIENT_ID: string; TWITCH_CLIENT_SECRET: string; TWITCH_REDIRECT_URI: string }, code: string) => {
  const response = await fetch(`${TWITCH_OAUTH}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.TWITCH_CLIENT_ID, client_secret: env.TWITCH_CLIENT_SECRET, code, grant_type: "authorization_code", redirect_uri: env.TWITCH_REDIRECT_URI }),
  })
  return twitchResponse<{ access_token: string; refresh_token: string; expires_in: number; scope: string[] }>(response)
}

export const validateToken = async (accessToken: string) => {
  const response = await fetch(`${TWITCH_OAUTH}/validate`, { headers: { Authorization: `OAuth ${accessToken}` } })
  return twitchResponse<TwitchTokenValidation>(response)
}

export const revokeToken = async (clientId: string, accessToken: string) => {
  await fetch(`${TWITCH_OAUTH}/revoke?client_id=${encodeURIComponent(clientId)}&token=${encodeURIComponent(accessToken)}`, { method: "POST" })
}

const authorizedFetch = async (env: { DB: D1Database; TWITCH_CLIENT_ID: string; TWITCH_CLIENT_SECRET: string; TOKEN_ENCRYPTION_KEY: string }, creator: TwitchCreator, path: string, init?: RequestInit) => {
  const token = await ensureCreatorAccessToken(env.DB, env, creator)
  const headers = new Headers(init?.headers)
  headers.set("Client-Id", env.TWITCH_CLIENT_ID)
  headers.set("Authorization", `Bearer ${token}`)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)
  try {
    return await fetch(`${TWITCH_API}${path}`, { ...init, headers, signal: controller.signal })
  } catch (error) {
    throw new TwitchApiError(0, error instanceof DOMException && error.name === "AbortError" ? "TWITCH_TIMEOUT" : "TWITCH_NETWORK_ERROR", true)
  } finally {
    clearTimeout(timeout)
  }
}

const appAuthorizedFetch = async (env: { TWITCH_CLIENT_ID: string; TWITCH_CLIENT_SECRET: string }, path: string, init?: RequestInit) => {
  const tokenResponse = await fetch(`${TWITCH_OAUTH}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.TWITCH_CLIENT_ID, client_secret: env.TWITCH_CLIENT_SECRET, grant_type: "client_credentials" }),
  })
  const token = await twitchResponse<{ access_token: string }>(tokenResponse)
  const headers = new Headers(init?.headers)
  headers.set("Client-Id", env.TWITCH_CLIENT_ID)
  headers.set("Authorization", `Bearer ${token.access_token}`)
  return fetch(`${TWITCH_API}${path}`, { ...init, headers })
}

const tokenStillValid = (creator: TwitchCreator) => Boolean(creator.token_expires_at && Date.parse(creator.token_expires_at) > Date.now() + 60_000)

export const ensureCreatorAccessToken = async (db: D1Database, env: { TWITCH_CLIENT_ID: string; TWITCH_CLIENT_SECRET: string; TOKEN_ENCRYPTION_KEY: string }, creator: TwitchCreator) => {
  if (!creator.access_token_ciphertext || !creator.access_token_iv) throw new Error("RECONNECT_REQUIRED")
  if (tokenStillValid(creator)) return decryptSecret(creator.access_token_ciphertext, creator.access_token_iv, env.TOKEN_ENCRYPTION_KEY)
  if (!creator.refresh_token_ciphertext || !creator.refresh_token_iv) {
    await updateCreatorStatus(db, creator.id, "RECONNECT_REQUIRED")
    throw new Error("RECONNECT_REQUIRED")
  }
  try {
    const refreshToken = await decryptSecret(creator.refresh_token_ciphertext, creator.refresh_token_iv, env.TOKEN_ENCRYPTION_KEY)
    const response = await fetch(`${TWITCH_OAUTH}/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: env.TWITCH_CLIENT_ID, client_secret: env.TWITCH_CLIENT_SECRET, grant_type: "refresh_token", refresh_token: refreshToken }) })
    const token = await twitchResponse<{ access_token: string; refresh_token?: string; expires_in: number }>(response)
    const access = await encryptSecret(token.access_token, env.TOKEN_ENCRYPTION_KEY)
    const refresh = token.refresh_token ? await encryptSecret(token.refresh_token, env.TOKEN_ENCRYPTION_KEY) : { ciphertext: creator.refresh_token_ciphertext, iv: creator.refresh_token_iv }
    await db.prepare("UPDATE creators SET access_token_ciphertext = ?1, access_token_iv = ?2, refresh_token_ciphertext = ?3, refresh_token_iv = ?4, token_expires_at = ?5, connection_status = 'CONNECTED', updated_at = ?6 WHERE id = ?7").bind(access.ciphertext, access.iv, refresh.ciphertext, refresh.iv, new Date(Date.now() + token.expires_in * 1000).toISOString(), new Date().toISOString(), creator.id).run()
    return token.access_token
  } catch {
    await updateCreatorStatus(db, creator.id, "RECONNECT_REQUIRED")
    throw new Error("RECONNECT_REQUIRED")
  }
}

export const registerChatSubscription = async (env: { DB: D1Database; TWITCH_CLIENT_ID: string; TWITCH_CLIENT_SECRET: string; TOKEN_ENCRYPTION_KEY: string; APP_BASE_URL: string; EVENTSUB_SECRET: string }, creator: TwitchCreator) => {
  const condition = { broadcaster_user_id: creator.twitch_user_id, user_id: creator.twitch_user_id }
  const response = await appAuthorizedFetch(env, "/eventsub/subscriptions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "channel.chat.message", version: "1", condition, transport: { method: "webhook", callback: `${env.APP_BASE_URL.replace(/\/$/, "")}/webhooks/twitch`, secret: env.EVENTSUB_SECRET } }),
  })
  return twitchResponse<{ data: [{ id: string; status: string; condition: Record<string, string> }] }>(response)
}

export type TwitchEventSubSubscription = {
  id: string
  status: string
  type: string
  condition: Record<string, string>
  transport?: { method?: string; callback?: string }
}

export const listChatSubscriptions = async (env: { TWITCH_CLIENT_ID: string; TWITCH_CLIENT_SECRET: string }, broadcasterId: string) => {
  const response = await appAuthorizedFetch(env, `/eventsub/subscriptions?type=channel.chat.message&user_id=${encodeURIComponent(broadcasterId)}`)
  return twitchResponse<{ data: TwitchEventSubSubscription[] }>(response)
}

export const deleteSubscription = async (env: { TWITCH_CLIENT_ID: string; TWITCH_CLIENT_SECRET: string }, subscriptionId: string) => {
  const response = await appAuthorizedFetch(env, `/eventsub/subscriptions?id=${encodeURIComponent(subscriptionId)}`, { method: "DELETE" })
  if (!response.ok && response.status !== 404) throw new Error(`TWITCH_HTTP_${response.status}`)
}

export type TwitchClipRecord = {
  id: string
  url: string
  embed_url: string
  title: string
  thumbnail_url: string
  duration: number
  broadcaster_id: string
  vod_offset: number | null
}

export const createClip = async (env: { DB: D1Database; TWITCH_CLIENT_ID: string; TWITCH_CLIENT_SECRET: string; TOKEN_ENCRYPTION_KEY: string }, creator: TwitchCreator) => {
  const response = await authorizedFetch(env, creator, `/clips?broadcaster_id=${encodeURIComponent(creator.twitch_user_id)}`, { method: "POST" })
  const body = await twitchResponse<{ data?: [{ id?: string; edit_url?: string }] }>(response)
  const created = body.data?.[0]
  if (!created?.id || !created.edit_url || !isTrustedTwitchUrl(created.edit_url)) throw new TwitchApiError(200, "TWITCH_UNTRUSTED_CLIP_URL", false)
  return { id: created.id, editUrl: created.edit_url }
}

export const getClip = async (env: { DB: D1Database; TWITCH_CLIENT_ID: string; TWITCH_CLIENT_SECRET: string; TOKEN_ENCRYPTION_KEY: string }, creator: TwitchCreator, clipId: string) => {
  const response = await authorizedFetch(env, creator, `/clips?id=${encodeURIComponent(clipId)}`, { method: "GET" })
  const body = await twitchResponse<{ data?: TwitchClipRecord[] }>(response)
  const clip = body.data?.[0] ?? null
  if (clip && (!isTrustedTwitchUrl(clip.url) || !isTrustedTwitchUrl(clip.embed_url) || !isTrustedTwitchUrl(clip.thumbnail_url))) {
    throw new TwitchApiError(200, "TWITCH_UNTRUSTED_CLIP_URL", false)
  }
  return clip
}
