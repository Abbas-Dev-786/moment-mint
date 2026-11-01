import type { MomentSummary } from "@/lib/api"
import { formatApproximateTime, statusLabel } from "@/lib/format"
import { StatusPill } from "@/components/shared/status-pill"

function MomentCard({ moment, selected, onSelect }: { moment: MomentSummary; selected: boolean; onSelect: () => void }) {
  return (
    <button
      aria-current={selected ? "true" : undefined}
      className={`grid w-full gap-3 rounded-2xl border p-4 text-left transition-colors hover:border-primary/60 hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 ${selected ? "border-primary bg-primary/5" : "border-border/70 bg-card/50"}`}
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">Community moment</p>
          <p className="mt-1 text-sm text-muted-foreground">Approx. {formatApproximateTime(moment.anchor_eventsub_at)}. {moment.unique_nominator_count} of {moment.threshold_required} viewers.</p>
        </div>
        <StatusPill value={moment.status} />
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-2.5 py-1">{moment.unique_nominator_count} distinct viewer{moment.unique_nominator_count === 1 ? "" : "s"}</span>
        <span className="rounded-full bg-muted px-2.5 py-1">{statusLabel(moment.latest_clip_status ?? "NO_CLIP")}</span>
        <span className="rounded-full bg-muted px-2.5 py-1">AI: {statusLabel(moment.ai_status ?? "NOT_REQUESTED")}</span>
      </div>
    </button>
  )
}

export { MomentCard }
