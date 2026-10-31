import { SELF } from "cloudflare:test"
import { expect, it } from "vitest"

it("serves the Worker health contract", async () => {
  const response = await SELF.fetch("https://momentmint.test/health")

  expect(response.status).toBe(200)
  await expect(response.json()).resolves.toEqual({
    data: {
      service: "momentmint-worker",
      status: "ok",
    },
  })
})

it("serves the database readiness contract", async () => {
  const response = await SELF.fetch("https://momentmint.test/health/ready")

  expect(response.status).toBe(200)
  await expect(response.json()).resolves.toMatchObject({
    data: {
      service: "momentmint-worker",
      status: "ready",
      checks: { database: "ok", configuration: "ok" },
    },
  })
})
