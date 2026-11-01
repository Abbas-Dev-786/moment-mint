export const formatApproximateTime = (value: string | null | undefined) => {
  if (!value) return "Unknown time"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown time"
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

export const statusLabel = (value: string | null | undefined) => {
  if (!value) return "Not started"
  const labels: Record<string, string> = {
    CONNECTED: "Connected",
    DISCONNECTED: "Disconnected",
    RECONNECT_REQUIRED: "Reconnect required",
    ENABLED: "Listening",
    WEBHOOK_CALLBACK_VERIFICATION_PENDING: "Finishing setup",
    NOT_REGISTERED: "Not set up",
    COLLECTING: "Collecting signals",
    THRESHOLD_MET: "Ready to clip",
    CLIP_REQUESTED: "Creating clip",
    CLIP_READY: "Ready for review",
    CLIP_FAILED: "Clip failed",
    MANUAL_REVIEW: "Needs review",
    READY_FOR_REVIEW: "Ready for review",
    VERIFYING: "Verifying with Twitch",
    RETRYABLE_FAILED: "Retry available",
    FAILED: "Failed",
    PENDING: "In progress",
    READY: "Ready",
    FAILED_WITH_FALLBACK: "Ready with fallback",
    NO_CLIP: "No clip yet",
    NOT_REQUESTED: "Not requested",
  }
  return labels[value] ?? value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase())
}

export const errorLabel = (value: string | null | undefined) => {
  const labels: Record<string, string> = {
    TWITCH_UNTRUSTED_CLIP_URL: "Twitch returned a clip that could not be verified. Try again.",
    CLIP_NOT_RETRIEVABLE: "Twitch has not published the clip yet. Try again in a moment.",
    AUTO_CLIP_DISABLED: "Automatic clips are turned off in Settings.",
    TWITCH_VOD_NOT_FOUND: "The stream recording is not available yet. Try again shortly.",
    TWITCH_VOD_NOT_READY: "The stream recording has not reached that moment yet. Try again shortly.",
    RECONNECT_REQUIRED: "Reconnect Twitch so MomentMint can refresh its permissions.",
    CREATOR_NOT_FOUND: "The Twitch connection is no longer available. Reconnect Twitch.",
  }
  return labels[value ?? ""] ?? statusLabel(value)
}

export const statusTone = (value: string | null | undefined): "default" | "secondary" | "destructive" | "outline" => {
  if (!value) return "outline"
  if (["FAILED", "CLIP_FAILED", "RECONNECT_REQUIRED", "DISCONNECTED", "REVOKED"].includes(value)) return "destructive"
  if (["READY_FOR_REVIEW", "CLIP_READY", "CONNECTED", "ENABLED", "THRESHOLD_MET"].includes(value)) return "default"
  return "secondary"
}
