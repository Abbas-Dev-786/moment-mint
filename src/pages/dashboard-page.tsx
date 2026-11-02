import { useMemo, useState } from "react"

import { MomentDetail } from "@/components/dashboard/moment-detail"
import { MomentCard } from "@/components/dashboard/moment-card"
import { MetricCard } from "@/components/dashboard/metric-card"
import { Feedback, RequestError } from "@/components/shared/feedback"
import { StatusPill } from "@/components/shared/status-pill"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ApiRequestError } from "@/lib/api"
import { formatApproximateTime, statusLabel } from "@/lib/format"
import { useDashboard, useMe, useMoments } from "@/hooks/use-momentmint"

type SortMode = "time" | "support"

function DashboardPage() {
  const me = useMe()
  const connected = Boolean(me.data)
  const overview = useDashboard(connected)
  const moments = useMoments(connected)
  const [selectedMomentId, setSelectedMomentId] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>("time")

  const sortedMoments = useMemo(() => {
    const rows = [...(moments.data ?? [])]
    return rows.sort((left, right) => sortMode === "support" ? right.unique_nominator_count - left.unique_nominator_count : right.anchor_eventsub_at.localeCompare(left.anchor_eventsub_at))
  }, [moments.data, sortMode])

  const streamGroups = useMemo(() => {
    const groups = new Map<string, { id: string; title: string | null; category: string | null; startedAt: string | null; status: string; moments: typeof sortedMoments }>()
    for (const moment of sortedMoments) {
      const current = groups.get(moment.stream_session_id)
      if (current) current.moments.push(moment)
      else groups.set(moment.stream_session_id, { id: moment.stream_session_id, title: moment.stream_title, category: moment.stream_category_name, startedAt: moment.stream_started_at, status: moment.stream_status, moments: [moment] })
    }
    const timestamp = (value: string | null | undefined) => {
      const parsed = value ? Date.parse(value) : Number.NaN
      return Number.isFinite(parsed) ? parsed : 0
    }
    return Array.from(groups.values()).map((group) => ({
      ...group,
      moments: [...group.moments].sort((left, right) => sortMode === "support" ? right.unique_nominator_count - left.unique_nominator_count || timestamp(right.anchor_eventsub_at) - timestamp(left.anchor_eventsub_at) : timestamp(right.anchor_eventsub_at) - timestamp(left.anchor_eventsub_at)),
    })).sort((left, right) => {
      if (sortMode === "support") {
        const supportDelta = Math.max(...right.moments.map((moment) => moment.unique_nominator_count)) - Math.max(...left.moments.map((moment) => moment.unique_nominator_count))
        if (supportDelta !== 0) return supportDelta
      }
      const rightLatest = Math.max(...right.moments.map((moment) => timestamp(moment.anchor_eventsub_at)), timestamp(right.startedAt))
      const leftLatest = Math.max(...left.moments.map((moment) => timestamp(moment.anchor_eventsub_at)), timestamp(left.startedAt))
      return rightLatest - leftLatest
    })
  }, [sortedMoments, sortMode])

  if (me.isPending) return <LoadingState />
  if (me.isError && me.error instanceof ApiRequestError && me.error.status === 401) return <DisconnectedState />
  if (me.isError) return <main className="max-w-2xl"><RequestError error={me.error} onRetry={() => void me.refetch()} title="We could not load your creator session" /></main>

  const dashboard = overview.data
  const stale = overview.isFetching || overview.isError
  const eventSubReady = dashboard?.eventSub?.status === "enabled"
  const currentStreamLabel = dashboard?.stream?.title || (dashboard?.stream?.status === "LIVE" ? "Live stream" : dashboard?.stream?.status === "UNKNOWN" ? "Stream details unavailable" : "No active stream")

  return (
    <section aria-labelledby="dashboard-title" className="space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><Badge className="rounded-full" variant="outline">Live workspace</Badge><h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight sm:text-5xl" id="dashboard-title">Moments</h1><p className="mt-3 max-w-xl text-muted-foreground">A focused inbox for the scenes your community wants you to keep.</p></div>
        <div className="flex items-center gap-2"><StatusPill value={dashboard?.connection.status ?? me.data?.connectionStatus} /><Button onClick={() => { void overview.refetch(); void moments.refetch() }} size="sm" type="button" variant="outline">{overview.isFetching || moments.isFetching ? "Refreshing…" : "Refresh"}</Button></div>
      </div>

      {overview.isError ? <RequestError error={overview.error} onRetry={() => void overview.refetch()} title="Live workspace status is unavailable" /> : <>
        {!eventSubReady && <Feedback action="Open connection" onAction={() => { window.location.href = "/connect" }} title="Chat listening is not ready" tone="info">{dashboard?.connection.status === "CONNECTED" ? "Twitch is connected, but chat listening still needs to be restored. Open the Connection Center before expecting new !moment nominations." : "Connect Twitch and turn on chat listening before expecting new !moment nominations."} Your saved moments are still safe.</Feedback>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="Connection" value={dashboard?.connection.status === "CONNECTED" ? dashboard.connection.displayName : "Reconnect needed"} />
          <MetricCard label="Current stream" value={currentStreamLabel} />
          <MetricCard label="Nominations today" value={String(dashboard?.metrics.nominationsToday ?? 0)} />
          <MetricCard label="Candidates" value={String(dashboard?.metrics.moments ?? 0)} />
          <MetricCard label="Clips ready" value={String(dashboard?.metrics.readyClips ?? 0)} />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"><span>{dashboard?.eventSub ? `Chat listening: ${statusLabel(dashboard.eventSub.status)}` : "Chat listening is not set up"}</span><span aria-hidden="true">•</span><span>{dashboard?.metrics.processingClips ?? 0} clip job{dashboard?.metrics.processingClips === 1 ? "" : "s"} processing</span><span aria-live="polite" className={stale ? "text-muted-foreground" : "text-primary"}>{overview.isFetching ? "Updating…" : overview.isError ? "Update unavailable" : `Updated ${dashboard ? formatApproximateTime(dashboard.lastUpdatedAt) : "just now"}`}</span></div>
      </>}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(25rem,1.1fr)]">
        <Card>
          <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>Community candidates</CardTitle><CardDescription className="mt-1">Grouped by broadcast so every clip stays in the stream where it happened.</CardDescription></div><div className="flex gap-1" aria-label="Sort candidates"><Button aria-pressed={sortMode === "time"} onClick={() => setSortMode("time")} size="sm" type="button" variant={sortMode === "time" ? "secondary" : "ghost"}>Newest</Button><Button aria-pressed={sortMode === "support"} onClick={() => setSortMode("support")} size="sm" type="button" variant={sortMode === "support" ? "secondary" : "ghost"}>Support</Button></div></CardHeader>
          <CardContent className="grid gap-3">
            {moments.isPending && <p className="rounded-xl bg-muted/40 p-5 text-sm text-muted-foreground">Loading candidates…</p>}
            {moments.isError && <RequestError error={moments.error} onRetry={() => void moments.refetch()} title="Moments could not be loaded" />}
            {!moments.isPending && !moments.isError && sortedMoments.length === 0 && <div className="rounded-xl border border-dashed border-border p-8 text-center"><p className="font-medium">No moments yet</p><p className="mt-2 text-sm leading-6 text-muted-foreground">When viewers type <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">!moment</code>, nearby nominations will appear here. One viewer cannot inflate the count by repeating the command.</p></div>}
            {streamGroups.map((group) => <section aria-labelledby={`stream-${group.id}`} className="rounded-2xl border border-border/70 bg-card/35 p-3" key={group.id}><div className="flex items-start justify-between gap-3 rounded-xl bg-muted/35 p-4"><div className="min-w-0"><p className="text-xs font-medium tracking-wide text-primary">Broadcast session</p><h3 className="mt-1 truncate font-heading text-lg" id={`stream-${group.id}`}>{group.title || "Untitled broadcast"}</h3><p className="mt-1 text-sm text-muted-foreground">{group.category || "Category not provided"} · Started {formatApproximateTime(group.startedAt)} · {group.moments.length} moment{group.moments.length === 1 ? "" : "s"}</p></div><StatusPill value={group.status} label={group.status === "LIVE" ? "Live now" : group.status === "ENDED" ? "Ended" : "Stream details unavailable"} /></div><div className="mt-3 grid gap-3">{group.moments.map((moment) => <MomentCard key={moment.id} moment={moment} onSelect={() => setSelectedMomentId(moment.id)} selected={selectedMomentId === moment.id} />)}</div></section>)}
          </CardContent>
        </Card>
        {selectedMomentId ? <MomentDetail key={selectedMomentId} momentId={selectedMomentId} /> : <Card className="border-dashed"><CardContent className="grid min-h-80 place-items-center p-8 text-center"><div><div aria-hidden="true" className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-2xl text-primary">✦</div><h2 className="mt-4 font-heading text-xl">Choose a candidate</h2><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Open a candidate to inspect its approximate timing, verified clip state, and editable metadata.</p></div></CardContent></Card>}
      </div>
    </section>
  )
}

function LoadingState() { return <section aria-live="polite" className="grid gap-4"><div className="h-10 w-64 animate-pulse rounded bg-muted" /><div className="grid gap-3 sm:grid-cols-3"><div className="h-24 animate-pulse rounded-2xl bg-muted" /><div className="h-24 animate-pulse rounded-2xl bg-muted" /><div className="h-24 animate-pulse rounded-2xl bg-muted" /></div><p className="text-sm text-muted-foreground">Loading your creator workspace…</p></section> }

function DisconnectedState() { return <section className="max-w-xl space-y-5"><Badge variant="outline">Connection required</Badge><h1 className="font-heading text-4xl font-semibold tracking-tight">Connect Twitch to open your moments.</h1><p className="leading-7 text-muted-foreground">Your inbox is private to your connected creator account. Connect Twitch first, then MomentMint will show you the next setup step.</p><Button render={<a href="/oauth/twitch/start" />}>Connect Twitch</Button></section> }

export { DashboardPage }
