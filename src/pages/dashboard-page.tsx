import { useMemo, useState } from "react"

import { MomentDetail } from "@/components/dashboard/moment-detail"
import { MomentCard } from "@/components/dashboard/moment-card"
import { MetricCard } from "@/components/dashboard/metric-card"
import { StatusPill } from "@/components/shared/status-pill"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ApiRequestError } from "@/lib/api"
import { formatApproximateTime } from "@/lib/format"
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

  if (me.isPending) return <LoadingState />
  if (me.isError && me.error instanceof ApiRequestError && me.error.status === 401) return <DisconnectedState />
  if (me.isError) return <ErrorState message="We could not load your creator session." onRetry={() => void me.refetch()} />

  const dashboard = overview.data
  const stale = overview.isStale || overview.isError

  return (
    <section aria-labelledby="dashboard-title" className="space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><Badge className="rounded-full" variant="outline">Creator workspace</Badge><h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight sm:text-5xl" id="dashboard-title">Highlight inbox</h1><p className="mt-3 max-w-xl text-muted-foreground">Your community finds the moments. You decide what becomes a clip.</p></div>
        <div className="flex items-center gap-2"><StatusPill value={dashboard?.connection.status ?? me.data?.connectionStatus} /><Button onClick={() => { void overview.refetch(); void moments.refetch() }} size="sm" type="button" variant="outline">Refresh</Button></div>
      </div>

      {overview.isError ? <ErrorState message="Live overview is unavailable. Your saved candidates are still shown below." onRetry={() => void overview.refetch()} /> : <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="Connection" value={dashboard?.connection.status === "CONNECTED" ? dashboard.connection.displayName : "Reconnect needed"} />
          <MetricCard label="Stream" value={dashboard?.stream?.status ?? "Waiting"} />
          <MetricCard label="Nominations today" value={String(dashboard?.metrics.nominationsToday ?? 0)} />
          <MetricCard label="Candidates" value={String(dashboard?.metrics.moments ?? 0)} />
          <MetricCard label="Clips ready" value={String(dashboard?.metrics.readyClips ?? 0)} />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"><span>{dashboard?.eventSub ? `EventSub: ${dashboard.eventSub.status}` : "EventSub is not registered"}</span><span aria-hidden="true">•</span><span>{dashboard?.metrics.processingClips ?? 0} clip job{dashboard?.metrics.processingClips === 1 ? "" : "s"} processing</span><span aria-live="polite" className={stale ? "text-destructive" : "text-primary"}>{stale ? "Data may be stale" : `Updated ${dashboard ? formatApproximateTime(dashboard.lastUpdatedAt) : "just now"}`}</span></div>
      </>}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(25rem,1.1fr)]">
        <Card>
          <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>Community candidates</CardTitle><CardDescription className="mt-1">Distinct viewers count once per approximate moment.</CardDescription></div><div className="flex gap-1" aria-label="Sort candidates"><Button aria-pressed={sortMode === "time"} onClick={() => setSortMode("time")} size="sm" type="button" variant={sortMode === "time" ? "secondary" : "ghost"}>Newest</Button><Button aria-pressed={sortMode === "support"} onClick={() => setSortMode("support")} size="sm" type="button" variant={sortMode === "support" ? "secondary" : "ghost"}>Support</Button></div></CardHeader>
          <CardContent className="grid gap-3">
            {moments.isPending && <p className="rounded-xl bg-muted/40 p-5 text-sm text-muted-foreground">Loading candidates…</p>}
            {moments.isError && <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">Candidates could not be loaded. Try refresh.</p>}
            {!moments.isPending && !moments.isError && sortedMoments.length === 0 && <div className="rounded-xl border border-dashed border-border p-8 text-center"><p className="font-medium">No moments yet</p><p className="mt-2 text-sm leading-6 text-muted-foreground">When viewers type <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">!moment</code>, nearby nominations will appear here. One viewer cannot inflate the count by repeating the command.</p></div>}
            {sortedMoments.map((moment) => <MomentCard key={moment.id} moment={moment} onSelect={() => setSelectedMomentId(moment.id)} selected={selectedMomentId === moment.id} />)}
          </CardContent>
        </Card>
        {selectedMomentId ? <MomentDetail key={selectedMomentId} momentId={selectedMomentId} /> : <Card className="border-dashed"><CardContent className="grid min-h-80 place-items-center p-8 text-center"><div><div aria-hidden="true" className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-2xl text-primary">✦</div><h2 className="mt-4 font-heading text-xl">Choose a candidate</h2><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Open a candidate to inspect its approximate timing, verified clip state, and editable metadata.</p></div></CardContent></Card>}
      </div>
    </section>
  )
}

function LoadingState() { return <section aria-live="polite" className="grid gap-4"><div className="h-10 w-64 animate-pulse rounded bg-muted" /><div className="grid gap-3 sm:grid-cols-3"><div className="h-24 animate-pulse rounded-2xl bg-muted" /><div className="h-24 animate-pulse rounded-2xl bg-muted" /><div className="h-24 animate-pulse rounded-2xl bg-muted" /></div><p className="text-sm text-muted-foreground">Loading your creator workspace…</p></section> }

function DisconnectedState() { return <section className="max-w-xl space-y-4"><Badge variant="outline">Connection required</Badge><h1 className="font-heading text-4xl font-semibold tracking-tight">Connect Twitch to open your inbox.</h1><p className="leading-7 text-muted-foreground">MomentMint needs your creator session to show nominations, EventSub status, clip jobs, and editable metadata.</p><Button render={<a href="/oauth/twitch/start" />}>Connect Twitch</Button></section> }

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) { return <div className="flex items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"><span>{message}</span><Button onClick={onRetry} size="sm" type="button" variant="outline">Try again</Button></div> }

export { DashboardPage }
