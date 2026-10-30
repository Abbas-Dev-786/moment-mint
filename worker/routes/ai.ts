import { z } from "zod"
import type { AuthContext } from "../oauth.js"

const smokeTestSchema = z.object({ confirm: z.literal(true) }).strict()

export const aiSmokeTest = async (c: AuthContext) => {
  let body: unknown
  try { body = await c.req.json() } catch { body = null }
  if (!smokeTestSchema.safeParse(body).success) return c.json({ error: { code: "BAD_REQUEST", message: "AI smoke tests require explicit confirmation." } }, 400)
  if (!c.env.AI) return c.json({ error: { code: "CONFIGURATION_ERROR", message: "Workers AI is not configured." } }, 503)
  try {
    await c.env.AI.run(c.env.AI_MODEL_ID, { messages: [{ role: "user", content: "Return only the word OK." }] })
    return c.json({ data: { available: true, modelId: c.env.AI_MODEL_ID } })
  } catch {
    return c.json({ error: { code: "TWITCH_API_ERROR", message: "Workers AI is unavailable." } }, 502)
  }
}
