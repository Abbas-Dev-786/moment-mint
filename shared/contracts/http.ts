export type ErrorCode =
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "INTERNAL_ERROR"
  | "CONFIGURATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "INVALID_SIGNATURE"
  | "REPLAYED_EVENT"
  | "OAUTH_DENIED"
  | "OAUTH_STATE_INVALID"
  | "MISSING_SCOPE"
  | "TWITCH_API_ERROR"
  | "RECONNECT_REQUIRED"
  | "AI_UNAVAILABLE"

export interface ApiSuccess<T> {
  data: T
}

export interface ApiError {
  error: {
    code: ErrorCode
    message: string
    requestId?: string
  }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError
