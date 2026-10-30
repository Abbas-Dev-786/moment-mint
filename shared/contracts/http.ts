export type ErrorCode =
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "INTERNAL_ERROR"
  | "CONFIGURATION_ERROR"

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
