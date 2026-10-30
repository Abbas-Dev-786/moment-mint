export const nowIso = () => new Date().toISOString()

export const newId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`

export const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export const clampPageSize = (value: string | undefined, fallback = 50) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 1), 100) : fallback
}
