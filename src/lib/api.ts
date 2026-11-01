export type ApiErrorBody = { error: { code: string; message: string; requestId?: string } }

export class ApiRequestError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId?: string

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message)
    this.status = status
    this.code = body.error.code
    this.requestId = body.error.requestId
  }
}

export const isUnauthorized = (error: unknown) => error instanceof ApiRequestError && error.status === 401

export const errorMessage = (error: unknown, fallback = "Something went wrong. Try again.") => {
  if (error instanceof ApiRequestError) return error.message || fallback
  if (error instanceof Error && error.message) return error.message
  return fallback
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const headers = new Headers(init?.headers)
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json")
  const response = await fetch(path, { ...init, headers, credentials: "same-origin" })
  if (!response.ok) {
    let body: ApiErrorBody = { error: { code: "INTERNAL_ERROR", message: "The request could not be completed." } }
    try { body = await response.json() as ApiErrorBody } catch { /* keep safe fallback */ }
    throw new ApiRequestError(response.status, body)
  }
  if (response.status === 204) return undefined as T
  const body = await response.json() as { data: T }
  return body.data
}

export const api = {
  me: () => request<Me>("/api/me"),
  dashboard: () => request<DashboardOverview>("/api/dashboard/overview"),
  moments: (status?: string) => request<MomentSummary[]>(`/api/moments${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  moment: (momentId: string) => request<MomentDetail>(`/api/moments/${encodeURIComponent(momentId)}`),
  settings: () => request<SettingsResponse>("/api/settings"),
  registerEventSub: () => request<{ id: string; status: string; type: string }>("/api/twitch/eventsub/register", { method: "POST" }),
  updateSettings: (settings: SettingsPatch) => request<{ settings: CreatorSettings; disclosure: string }>("/api/settings", { method: "PATCH", body: JSON.stringify(settings) }),
  requestClip: (momentId: string) => request<{ clipJob: ClipJob; queued: boolean }>(`/api/moments/${encodeURIComponent(momentId)}/clip`, { method: "POST", body: JSON.stringify({ confirm: true }) }),
  retryClip: (clipJobId: string) => request<{ clipJob: ClipJob; queued: boolean }>(`/api/clip-jobs/${encodeURIComponent(clipJobId)}/retry`, { method: "POST" }),
  getClipEditUrl: (clipJobId: string) => request<{ editUrl: string }>(`/api/clip-jobs/${encodeURIComponent(clipJobId)}/edit-url`),
  requestMetadata: (momentId: string, creatorNote?: string) => request<{ metadata: Metadata | null; queued: boolean }>(`/api/moments/${encodeURIComponent(momentId)}/ai-metadata`, { method: "POST", body: JSON.stringify({ creatorNote }) }),
  updateMetadata: (momentId: string, metadata: MetadataInput) => request<{ metadata: Metadata | null }>(`/api/moments/${encodeURIComponent(momentId)}/metadata`, { method: "PATCH", body: JSON.stringify(metadata) }),
  reviewMoment: (momentId: string, status: "REVIEWED" | "DISMISSED") => request<{ status: string }>(`/api/moments/${encodeURIComponent(momentId)}/review`, { method: "POST", body: JSON.stringify({ status }) }),
  logout: () => request<{ loggedOut: boolean }>("/api/auth/logout", { method: "POST" }),
  disconnect: () => request<{ disconnected: boolean }>("/api/twitch/disconnect", { method: "POST" }),
}

export type CreatorSettings = { nominationCommand: "!moment"; groupWindowSeconds: number; uniqueViewerThreshold: number; autoClipEnabled: boolean }
export type Me = { id: string; twitchUserId: string; login: string; displayName: string; connectionStatus: string; scopes: string[]; settings: CreatorSettings }
export type DashboardOverview = { connection: { status: string; twitchLogin: string; displayName: string; scopes: string[] }; eventSub: { status: string; reason: string | null } | null; stream: { status: string; title: string | null; categoryName: string | null; startedAt: string | null } | null; metrics: { nominationsToday: number; moments: number; clipCandidates: number; readyClips: number; processingClips: number }; settings: CreatorSettings; lastUpdatedAt: string }
export type MomentSummary = { id: string; anchor_eventsub_at: string; anchor_received_at: string; unique_nominator_count: number; threshold_required: number; status: string; latest_clip_status: string | null; ai_status: string | null; created_at: string; updated_at: string }
export type ClipJob = { id: string; moment_id: string; attempt_number: number; trigger_type: string; status: string; twitch_clip_id: string | null; clip_url: string | null; embed_url: string | null; thumbnail_url: string | null; clip_title: string | null; clip_duration_seconds: number | null; error_code: string | null }
export type Metadata = { id: string; moment_id: string; provider: string; model_id: string; status: string; title: string; summary: string; category: string; social_caption: string; prompt_version: string; creator_note: string | null; generated_at: string | null; updated_at: string }
export type MomentDetail = { moment: MomentSummary & { stream_session_id: string; group_window_seconds: number }; nominations: Array<{ id: string; eventsub_timestamp: string; received_at: string; created_at: string }>; clips: ClipJob[]; metadata: Metadata | null }
export type SettingsResponse = { creator: { twitchLogin: string; displayName: string; scopes: string[] }; settings: CreatorSettings; eventSub: { status: string; reason: string | null } | null; disclosure: string; chatContext: { stored: boolean; explanation: string } }
export type SettingsPatch = { groupWindowSeconds: number; uniqueViewerThreshold: number; autoClipEnabled: boolean; confirmAutoClip?: boolean }
export type MetadataInput = { title: string; summary: string; category: string; socialCaption: string }
