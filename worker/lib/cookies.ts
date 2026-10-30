export const SESSION_COOKIE = "mm_session"
export const OAUTH_FLOW_COOKIE = "mm_oauth_flow"

export const parseCookies = (header: string | null) => {
  const cookies: Record<string, string> = {}
  for (const part of header?.split(";") ?? []) {
    const separator = part.indexOf("=")
    if (separator > 0) cookies[part.slice(0, separator).trim()] = decodeURIComponent(part.slice(separator + 1).trim())
  }
  return cookies
}

export const sessionCookie = (value: string, secure: boolean, maxAge = 60 * 60 * 24 * 30) =>
  `${SESSION_COOKIE}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`

export const expiredSessionCookie = (secure: boolean) => sessionCookie("", secure, 0)

export const oauthFlowCookie = (value: string, secure: boolean) =>
  `${OAUTH_FLOW_COOKIE}=${encodeURIComponent(value)}; Max-Age=600; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`

export const expiredOAuthFlowCookie = (secure: boolean) => `${OAUTH_FLOW_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`
