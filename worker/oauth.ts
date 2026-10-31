import type { Context } from "hono"
import { creatorSettings } from "./repositories/creator.js"
import { consumeOAuthState, createOAuthState, createSession, deleteSession, findSessionCreatorId } from "./repositories/auth.js"
import { findCreatorById, upsertCreator } from "./repositories/creator.js"
import { disableCreatorSubscriptions, findSubscriptionForCreator } from "./repositories/eventsub.js"
import { deleteSubscription, exchangeCode, revokeToken, requiredScopes, validateToken } from "./twitch/client.js"
import { constantTimeEqual, decryptSecret, encryptSecret, sha256Base64, signValue } from "./lib/crypto.js"
import { expiredOAuthFlowCookie, expiredSessionCookie, oauthFlowCookie, OAUTH_FLOW_COOKIE, parseCookies, SESSION_COOKIE, sessionCookie } from "./lib/cookies.js"
import type { AppBindings } from "./env.js"

type AuthEnv = { Bindings: AppBindings; Variables: { creatorId: string } }
type AuthContext = Context<AuthEnv>

const configured = (env: AppBindings) => Boolean(env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET && env.TWITCH_REDIRECT_URI && env.SESSION_SECRET && env.TOKEN_ENCRYPTION_KEY)

export const sessionValue = async (sessionId: string, secret: string) => `${sessionId}.${await signValue(sessionId, secret)}`

export const resolveCreatorId = async (db: D1Database, cookieHeader: string | null, secret: string) => {
  const value = parseCookies(cookieHeader ?? null)[SESSION_COOKIE]
  if (!value) return null
  const separator = value.lastIndexOf(".")
  if (separator < 1) return null
  const sessionId = value.slice(0, separator)
  const expected = await sessionValue(sessionId, secret)
  if (!constantTimeEqual(expected, value)) return null
  const session = await findSessionCreatorId(db, sessionId)
  return session?.creator_id ?? null
}

export const requireCreator = async (c: AuthContext, next: () => Promise<void>) => {
  const origin = c.req.header("origin")
  if (c.req.method !== "GET" && origin && origin !== new URL(c.env.APP_BASE_URL).origin) return c.json({ error: { code: "FORBIDDEN", message: "Cross-origin state changes are not allowed." } }, 403)
  const creatorId = await resolveCreatorId(c.env.DB, c.req.header("cookie") ?? null, c.env.SESSION_SECRET)
  if (!creatorId) return c.json({ error: { code: "UNAUTHORIZED", message: "Connect Twitch to continue." } }, 401)
  c.set("creatorId", creatorId)
  await next()
}

export const oauthStart = async (c: AuthContext) => {
  if (!configured(c.env)) return c.json({ error: { code: "CONFIGURATION_ERROR", message: "Twitch OAuth is not configured." } }, 503)
  const state = crypto.randomUUID() + crypto.randomUUID()
  const flowId = crypto.randomUUID()
  await createOAuthState(c.env.DB, await sha256Base64(state), new Date(Date.now() + 10 * 60_000).toISOString(), flowId)
  const url = new URL("https://id.twitch.tv/oauth2/authorize")
  url.search = new URLSearchParams({ client_id: c.env.TWITCH_CLIENT_ID, redirect_uri: c.env.TWITCH_REDIRECT_URI, response_type: "code", scope: requiredScopes.join(" "), state }).toString()
  const response = c.redirect(url.toString(), 302)
  response.headers.append("Set-Cookie", oauthFlowCookie(flowId, new URL(c.req.url).protocol === "https:"))
  return response
}

export const oauthCallback = async (c: AuthContext) => {
  const query = new URL(c.req.url).searchParams
  const state = query.get("state")
  if (!state) return c.json({ error: { code: "OAUTH_STATE_INVALID", message: "The OAuth state is missing or expired." } }, 400)
  const flowId = parseCookies(c.req.header("cookie") ?? null)[OAUTH_FLOW_COOKIE]
  if (!flowId) return c.json({ error: { code: "OAUTH_STATE_INVALID", message: "The OAuth flow does not match this browser session." } }, 400)
  const consumed = await consumeOAuthState(c.env.DB, await sha256Base64(state), flowId)
  if (!consumed) return c.json({ error: { code: "OAUTH_STATE_INVALID", message: "The OAuth state is invalid or expired." } }, 400)
  if (query.get("error")) return c.json({ error: { code: "OAUTH_DENIED", message: "Twitch authorization was cancelled." } }, 400)
  const code = query.get("code")
  if (!code || !configured(c.env)) return c.json({ error: { code: "BAD_REQUEST", message: "The OAuth callback is incomplete." } }, 400)

  try {
    const token = await exchangeCode(c.env, code)
    const validated = await validateToken(token.access_token)
    if (validated.client_id !== c.env.TWITCH_CLIENT_ID || requiredScopes.some((scope) => !validated.scopes.includes(scope))) {
      return c.json({ error: { code: "MISSING_SCOPE", message: "Twitch did not grant the required permissions." } }, 403)
    }
    const access = await encryptSecret(token.access_token, c.env.TOKEN_ENCRYPTION_KEY)
    const refresh = await encryptSecret(token.refresh_token, c.env.TOKEN_ENCRYPTION_KEY)
    const creator = await upsertCreator(c.env.DB, { twitchUserId: validated.user_id, login: validated.login, displayName: validated.login, accessTokenCiphertext: access.ciphertext, accessTokenIv: access.iv, refreshTokenCiphertext: refresh.ciphertext, refreshTokenIv: refresh.iv, tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(), scopes: validated.scopes })
    if (!creator) throw new Error("CREATOR_UPSERT_FAILED")
    const sessionId = await createSession(c.env.DB, creator.id, new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString())
    const response = c.redirect("/dashboard", 302)
    response.headers.append("Set-Cookie", sessionCookie(await sessionValue(sessionId, c.env.SESSION_SECRET), new URL(c.req.url).protocol === "https:"))
    response.headers.append("Set-Cookie", expiredOAuthFlowCookie(new URL(c.req.url).protocol === "https:"))
    return response
  } catch (error) {
    console.error("Twitch OAuth exchange failed", { error: error instanceof Error ? error.message : "unknown" })
    return c.json({ error: { code: "TWITCH_API_ERROR", message: "Twitch connection could not be completed." } }, 502)
  }
}

export const me = async (c: AuthContext) => {
  const creator = await findCreatorById(c.env.DB, c.get("creatorId"))
  if (!creator) return c.json({ error: { code: "UNAUTHORIZED", message: "Connect Twitch to continue." } }, 401)
  return c.json({ data: { id: creator.id, twitchUserId: creator.twitch_user_id, login: creator.twitch_login, displayName: creator.display_name, connectionStatus: creator.connection_status, scopes: JSON.parse(creator.scopes_json), settings: creatorSettings(creator) } })
}

export const logout = async (c: AuthContext) => {
  const value = parseCookies(c.req.header("cookie") ?? null)[SESSION_COOKIE]
  if (value) await deleteSession(c.env.DB, value.split(".")[0])
  const response = c.json({ data: { loggedOut: true } })
  response.headers.append("Set-Cookie", expiredSessionCookie(new URL(c.req.url).protocol === "https:"))
  return response
}

export const disconnect = async (c: AuthContext) => {
  const creatorId = c.get("creatorId")
  const creator = await findCreatorById(c.env.DB, creatorId)
  if (!creator) return c.json({ error: { code: "NOT_FOUND", message: "Creator was not found." } }, 404)
  const subscription = await findSubscriptionForCreator(c.env.DB, creatorId)
  try {
    if (subscription?.twitch_subscription_id) await deleteSubscription(c.env, subscription.twitch_subscription_id)
    if (creator.access_token_ciphertext && creator.access_token_iv) {
      await revokeToken(c.env.TWITCH_CLIENT_ID, await decryptSecret(creator.access_token_ciphertext, creator.access_token_iv, c.env.TOKEN_ENCRYPTION_KEY))
    }
  } catch (error) {
    console.error("Twitch disconnect cleanup failed", { creatorId, error: error instanceof Error ? error.message : "unknown" })
  }
  await disableCreatorSubscriptions(c.env.DB, creatorId)
  await c.env.DB.prepare("UPDATE creators SET access_token_ciphertext = NULL, access_token_iv = NULL, refresh_token_ciphertext = NULL, refresh_token_iv = NULL, token_expires_at = NULL, scopes_json = '[]', connection_status = 'DISCONNECTED', updated_at = ?1 WHERE id = ?2").bind(new Date().toISOString(), creatorId).run()
  const value = parseCookies(c.req.header("cookie") ?? null)[SESSION_COOKIE]
  if (value) await deleteSession(c.env.DB, value.split(".")[0])
  const response = c.json({ data: { disconnected: true } })
  response.headers.append("Set-Cookie", expiredSessionCookie(new URL(c.req.url).protocol === "https:"))
  return response
}

export type { AuthContext, AuthEnv }
