import { app } from "./app.js"
import type { AppBindings } from "./env.js"

const workerOwnedPath = (pathname: string) =>
  pathname === "/health" ||
  pathname.startsWith("/api/") ||
  pathname.startsWith("/oauth/") ||
  pathname.startsWith("/webhooks/")

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const response = await app.fetch(request, env, ctx)

    if (response.status !== 404 || workerOwnedPath(url.pathname)) {
      return response
    }

    // The Cloudflare Vite plugin provides ASSETS in production and local
    // Worker-aware development. API/webhook/OAuth paths never fall through
    // to the SPA asset handler.
    if (env.ASSETS) {
      return env.ASSETS.fetch(request)
    }

    return response
  },

  async queue(batch) {
    // Queue processing is intentionally not implemented until Phase 1. If a
    // queue is provisioned early, retry rather than silently dropping work.
    batch.retryAll({ delaySeconds: 60 })
  },

  async scheduled(controller) {
    console.info("MomentMint scheduled hook is ready", {
      scheduledTime: controller.scheduledTime,
    })
  },
} satisfies ExportedHandler<AppBindings>
