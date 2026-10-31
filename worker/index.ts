import { app } from "./app.js"
import type { AppBindings } from "./env.js"
import type { QueueMessage } from "../shared/contracts/domain.js"
import { consumeQueue } from "./queue/consumer.js"
import { reconcile } from "./reconcile.js"

const workerOwnedPath = (pathname: string) =>
  pathname === "/health" ||
  pathname === "/health/ready" ||
  pathname.startsWith("/api/") ||
  pathname.startsWith("/oauth/") ||
  pathname.startsWith("/webhooks/")

const withSecurityHeaders = (response: Response, url: URL) => {
  const headers = new Headers(response.headers)
  headers.set("x-content-type-options", "nosniff")
  headers.set("x-frame-options", "SAMEORIGIN")
  headers.set("referrer-policy", "strict-origin-when-cross-origin")
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()")
  headers.set("content-security-policy", [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://static-cdn.jtvnw.net https://clips-media-assets2.twitch.tv",
    "frame-src https://clips.twitch.tv https://*.twitch.tv",
    "connect-src 'self' https://api.twitch.tv https://id.twitch.tv",
  ].join("; "))
  if (url.protocol === "https:") headers.set("strict-transport-security", "max-age=31536000; includeSubDomains")
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const response = await app.fetch(request, env, ctx)

    if (response.status !== 404 || workerOwnedPath(url.pathname)) {
      return withSecurityHeaders(response, url)
    }

    // The Cloudflare Vite plugin provides ASSETS in production and local
    // Worker-aware development. API/webhook/OAuth paths never fall through
    // to the SPA asset handler.
    if (env.ASSETS) {
      return withSecurityHeaders(await env.ASSETS.fetch(request), url)
    }

    return withSecurityHeaders(response, url)
  },

  async queue(batch: MessageBatch<QueueMessage>, env: AppBindings) {
    await consumeQueue(batch, env)
  },

  async scheduled(controller: ScheduledController, env: AppBindings) {
    const result = await reconcile(env)
    console.info("MomentMint reconciliation complete", { scheduledTime: controller.scheduledTime, requeued: result.requeued })
  },
} satisfies ExportedHandler<AppBindings, QueueMessage>
