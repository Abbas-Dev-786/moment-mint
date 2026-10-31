export const formatApproximateTime = (value: string | null | undefined) => {
  if (!value) return "Unknown time"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown time"
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

export const statusLabel = (value: string | null | undefined) => {
  if (!value) return "Not started"
  return value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase())
}

export const statusTone = (value: string | null | undefined): "default" | "secondary" | "destructive" | "outline" => {
  if (!value) return "outline"
  if (["FAILED", "CLIP_FAILED", "RECONNECT_REQUIRED", "DISCONNECTED", "REVOKED"].includes(value)) return "destructive"
  if (["READY_FOR_REVIEW", "CLIP_READY", "CONNECTED", "ENABLED", "THRESHOLD_MET"].includes(value)) return "default"
  return "secondary"
}
