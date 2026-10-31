import { Hono } from "hono"
import type { Context, ErrorHandler } from "hono"

import type { ApiError, ApiSuccess } from "../shared/contracts/http.js"
import type { AppBindings } from "./env.js"
import { disconnect, logout, me, oauthCallback, oauthStart, requireCreator } from "./oauth.js"
import { eventSubStatus, registerEventSub, webhook } from "./eventsub.js"
import { editMetadata, getClipEditUrl, getMoment, listMoments, requestClip, requestMetadata, retryClip, reviewMoment } from "./routes/moments.js"
import { aiSmokeTest } from "./routes/ai.js"
import { dashboardOverview } from "./routes/dashboard.js"
import { getSettings, updateSettings } from "./routes/settings.js"

type AppEnv = { Bindings: AppBindings; Variables: { creatorId: string; requestId: string } }
export const app = new Hono<AppEnv>()
type AppContext = Context<AppEnv>

app.use("*", async (c: AppContext, next: () => Promise<void>) => {
  const supplied = c.req.header("x-request-id")
  const requestId = supplied && supplied.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(supplied) ? supplied : crypto.randomUUID()
  c.set("requestId", requestId)
  c.header("x-request-id", requestId)
  await next()
})

app.get("/health", (c: AppContext) => {
  const response: ApiSuccess<{
    service: string
    status: string
  }> = {
    data: {
      service: "momentmint-worker",
      status: "ok",
    },
  }

  return c.json(response)
})

app.get("/health/ready", async (c: AppContext) => {
  try {
    await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>()
    const configurationReady = [
      c.env.APP_BASE_URL,
      c.env.TWITCH_CLIENT_ID,
      c.env.TWITCH_REDIRECT_URI,
      c.env.AI_MODEL_ID,
      c.env.TWITCH_CLIENT_SECRET,
      c.env.TOKEN_ENCRYPTION_KEY,
      c.env.SESSION_SECRET,
      c.env.EVENTSUB_SECRET,
    ].every((value) => Boolean(value && !value.includes("replace-with")))
    if (!configurationReady) throw new Error("CONFIGURATION_INCOMPLETE")
    return c.json({ data: { service: "momentmint-worker", status: "ready", checks: { database: "ok", configuration: "ok" } } })
  } catch (error) {
    console.error("Readiness check failed", { requestId: c.get("requestId"), error: error instanceof Error ? error.message : "unknown" })
    return c.json({ error: { code: "CONFIGURATION_ERROR", message: "The service is not ready." } }, 503)
  }
})

app.get("/oauth/twitch/start", oauthStart)
app.get("/oauth/twitch/callback", oauthCallback)
app.post("/webhooks/twitch", webhook)

app.use("/api/*", requireCreator)
app.get("/api/me", me)
app.post("/api/auth/logout", logout)
app.post("/api/twitch/disconnect", disconnect)
app.post("/api/twitch/eventsub", registerEventSub)
app.get("/api/twitch/eventsub", eventSubStatus)
app.post("/api/twitch/eventsub/register", registerEventSub)
app.get("/api/twitch/eventsub/status", eventSubStatus)
app.get("/api/dashboard/overview", dashboardOverview)
app.get("/api/settings", getSettings)
app.patch("/api/settings", updateSettings)
app.post("/api/ai/smoke-test", aiSmokeTest)
app.get("/api/moments", listMoments)
app.get("/api/moments/:momentId", getMoment)
app.post("/api/moments/:momentId/clip", requestClip)
app.post("/api/moments/:momentId/ai-metadata", requestMetadata)
app.patch("/api/moments/:momentId/metadata", editMetadata)
app.post("/api/moments/:momentId/review", reviewMoment)
app.post("/api/clip-jobs/:clipJobId/retry", retryClip)
app.get("/api/clip-jobs/:clipJobId/edit-url", getClipEditUrl)

app.notFound((c: AppContext) => {
  const response: ApiError = {
    error: {
      code: "NOT_FOUND",
      message: "The requested resource was not found.",
    },
  }

  return c.json(response, 404)
})

const errorHandler: ErrorHandler<AppEnv> = (
  error: Error,
  c: AppContext,
) => {
  console.error("Unhandled Worker request error", {
    error: error.message,
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    requestId: c.get("requestId"),
  })

  const response: ApiError = {
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
      requestId: c.get("requestId"),
    },
  }

  return c.json(response, 500)
}

app.onError(errorHandler)
