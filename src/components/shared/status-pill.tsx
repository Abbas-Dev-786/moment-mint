import { Badge } from "@/components/ui/badge"
import { statusLabel, statusTone } from "@/lib/format"

function StatusPill({ value, label }: { value?: string | null; label?: string }) {
  return <Badge aria-label={label ?? statusLabel(value)} variant={statusTone(value)}>{label ?? statusLabel(value)}</Badge>
}

export { StatusPill }
