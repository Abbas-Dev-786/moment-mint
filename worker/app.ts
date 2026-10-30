import { Hono } from "hono"
import type { Context, ErrorHandler } from "hono"

import type { ApiError, ApiSuccess } from "../shared/contracts/http.js"
import type { AppBindings } from "./env.js"

export const app = new Hono<{ Bindings: AppBindings }>()
type AppContext = Context<{ Bindings: AppBindings }>

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

app.notFound((c: AppContext) => {
  const response: ApiError = {
    error: {
      code: "NOT_FOUND",
      message: "The requested resource was not found.",
    },
  }

  return c.json(response, 404)
})

const errorHandler: ErrorHandler<{ Bindings: AppBindings }> = (
  error: Error,
  c: AppContext,
) => {
  console.error("Unhandled Worker request error", {
    error: error.message,
    method: c.req.method,
    path: new URL(c.req.url).pathname,
  })

  const response: ApiError = {
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
    },
  }

  return c.json(response, 500)
}

app.onError(errorHandler)
