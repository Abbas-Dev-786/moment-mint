import { app } from "./app.js"
import type { AppBindings } from "./env.js"
import type { QueueMessage } from "../shared/contracts/domain.js"
import { consumeQueue } from "./queue/consumer.js"
import { reconcile } from "./reconcile.js"

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

  async queue(batch: MessageBatch<QueueMessage>, env: AppBindings) {
    await consumeQueue(batch, env)
  },

  async scheduled(controller: ScheduledController, env: AppBindings) {
    const result = await reconcile(env)
    console.info("MomentMint reconciliation complete", { scheduledTime: controller.scheduledTime, requeued: result.requeued })
  },
} satisfies ExportedHandler<AppBindings, QueueMessage>
