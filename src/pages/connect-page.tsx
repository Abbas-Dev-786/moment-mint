import { useState } from "react"
import { Link } from "react-router"

import { Feedback, RequestError } from "@/components/shared/feedback"
import { StatusPill } from "@/components/shared/status-pill"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api, isUnauthorized } from "@/lib/api"
import { statusLabel } from "@/lib/format"
import { useMe, useSettings, useWorkspaceMutation } from "@/hooks/use-momentmint"

function ConnectPage() {
  const me = useMe()
  const connected = Boolean(me.data)
  const settings = useSettings(connected)
  const register = useWorkspaceMutation(() => api.registerEventSub())
  const disconnect = useWorkspaceMutation(() => api.disconnect())
  const [disconnectOpen, setDisconnectOpen] = useState(false)

  if (me.isPending) return <ConnectionLoading />
  if (me.isError && isUnauthorized(me.error)) return <DisconnectedConnect />
  if (me.isError) return <main className="max-w-2xl"><RequestError error={me.error} onRetry={() => void me.refetch()} title="We could not check your connection" /></main>
  if (!me.data) return <DisconnectedConnect />
  if (settings.isError && isUnauthorized(settings.error)) return <DisconnectedConnect />
  if (settings.isError && !isUnauthorized(settings.error)) return <main className="max-w-3xl"><RequestError error={settings.error} onRetry={() => void settings.refetch()} title="Your account is connected, but setup status is unavailable" /></main>

  const creator = me.data
  const eventSub = settings.data?.eventSub
  const listening = eventSub?.status === "enabled"
  const pending = eventSub?.status === "webhook_callback_verification_pending"

  return (
    <section aria-labelledby="connect-title" className="space-y-8">
      <div className="flex flex-col gap-6 rounded-3xl border border-primary/20 bg-[radial-gradient(circle_at_90%_0%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_45%),var(--card)] p-6 sm:p-10 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <Badge className="rounded-full" variant="outline">Connection center</Badge>
          <h1 className="mt-4 font-heading text-4xl font-semibold tracking-tight sm:text-5xl" id="connect-title">{listening ? "Your workspace is ready." : "One step from a live inbox."}</h1>
          <p className="mt-4 max-w-xl text-lg leading-8 text-muted-foreground">{listening ? "MomentMint is listening for !moment in your Twitch chat. When viewers find something special, it will appear in Moments." : "Connect your Twitch account, then turn on chat listening. We will keep the next step visible."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button render={<Link to="/dashboard" />} size="lg">Open moments</Button>
          {!listening && <Button disabled={register.isPending || pending} onClick={() => register.mutate()} size="lg" type="button" variant="outline">{register.isPending ? "Setting up…" : pending ? "Waiting for Twitch…" : "Turn on chat listening"}</Button>}
        </div>
      </div>

      {register.isError && <RequestError error={register.error} onRetry={() => register.mutate()} title="Chat listening could not be enabled" />}
      {disconnect.isError && <RequestError error={disconnect.error} title="Twitch was not disconnected" />}
      {register.isSuccess && <Feedback title={register.data.status === "enabled" ? "Chat listening is on" : "Twitch is finishing the connection"} tone="success">{register.data.status === "enabled" ? "You can now send !moment in your live chat." : "Keep this page open and refresh in a few seconds while Twitch verifies the callback."}</Feedback>}

      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader className="border-b border-border/60">
            <div className="flex items-start justify-between gap-4"><div><CardTitle>Your Twitch account</CardTitle><CardDescription className="mt-1">This is the account MomentMint will monitor.</CardDescription></div><StatusPill value={creator.connectionStatus} /></div>
          </CardHeader>
          <CardContent className="grid gap-5 pt-6">
            <div className="flex items-center gap-4"><div className="grid size-12 place-items-center rounded-2xl bg-primary/15 font-heading text-xl text-primary">{creator.displayName.slice(0, 1).toUpperCase()}</div><div><p className="font-medium">{creator.displayName}</p><p className="text-sm text-muted-foreground">@{creator.login}</p></div></div>
            <div className="grid gap-2 text-sm"><div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Account access</span><span className="font-medium text-primary">Connected</span></div><div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Permissions</span><span className="font-medium">{creator.scopes.length} granted</span></div></div>
          </CardContent>
          <CardFooter className="border-t border-border/60 pt-6"><Button onClick={() => setDisconnectOpen(true)} type="button" variant="destructive">Disconnect Twitch</Button></CardFooter>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/60"><div className="flex items-start justify-between gap-4"><div><CardTitle>Chat listening</CardTitle><CardDescription className="mt-1">The bridge between Twitch chat and your inbox.</CardDescription></div><StatusPill value={eventSub?.status ?? "NOT_REGISTERED"} /></div></CardHeader>
          <CardContent className="grid gap-5 pt-6">
            <div className="flex gap-3"><span className={`mt-1 size-2.5 shrink-0 rounded-full ${listening ? "bg-primary shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_18%,transparent)]" : "bg-muted-foreground/50"}`} /><div><p className="font-medium">{listening ? "Listening for !moment" : pending ? "Twitch is checking the callback" : "Not listening yet"}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{listening ? "New nominations will appear in Moments automatically." : pending ? "This usually takes a few seconds. Do not register it repeatedly." : "Turn this on once after connecting your account."}</p></div></div>
            <div className="grid gap-2 text-sm"><div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Current status</span><span className="font-medium">{statusLabel(eventSub?.status ?? "NOT_REGISTERED")}</span></div><div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Command</span><code className="rounded-md bg-muted px-2 py-1 font-mono text-xs">!moment</code></div></div>
          </CardContent>
          <CardFooter className="border-t border-border/60 pt-6"><Button disabled={register.isPending || pending} onClick={() => register.mutate()} type="button" variant={listening ? "outline" : "default"}>{register.isPending ? "Setting up…" : listening ? "Check connection" : pending ? "Waiting for Twitch…" : "Turn on chat listening"}</Button></CardFooter>
        </Card>
      </div>

      <Card className="bg-card/60">
        <CardHeader><CardTitle>How the workflow works</CardTitle><CardDescription>There are only three things to remember.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <FlowStep number="01" title="Connect once" text="Authorize your creator account. You can disconnect any time." complete />
          <FlowStep number="02" title="Keep chat listening" text="MomentMint watches for the exact !moment command." complete={listening} />
          <FlowStep number="03" title="Review your moments" text="Open Moments to inspect clips and edit metadata before sharing." complete={false} />
        </CardContent>
      </Card>

      <Dialog onOpenChange={setDisconnectOpen} open={disconnectOpen}><DialogContent><DialogHeader><DialogTitle>Disconnect Twitch?</DialogTitle><DialogDescription>This stops chat listening, revokes the saved Twitch session where supported, and signs you out of MomentMint. Your saved moments remain in the workspace.</DialogDescription></DialogHeader><DialogFooter><Button onClick={() => setDisconnectOpen(false)} type="button" variant="outline">Keep connected</Button><Button disabled={disconnect.isPending} onClick={() => { disconnect.mutate(); setDisconnectOpen(false) }} type="button" variant="destructive">{disconnect.isPending ? "Disconnecting…" : "Disconnect Twitch"}</Button></DialogFooter></DialogContent></Dialog>
    </section>
  )
}

function FlowStep({ number, title, text, complete }: { number: string; title: string; text: string; complete: boolean }) {
  return <div className="grid gap-3 rounded-2xl border border-border/60 bg-background/30 p-4"><div className="flex items-center justify-between"><span className="font-mono text-xs text-muted-foreground">{number}</span><StatusPill label={complete ? "Complete" : "Next"} value={complete ? "ENABLED" : "NOT_REQUESTED"} /></div><div><p className="font-medium">{title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p></div></div>
}

function DisconnectedConnect() {
  return <section aria-labelledby="connect-title" className="space-y-8"><div className="max-w-3xl"><Badge className="rounded-full" variant="outline">Start here</Badge><h1 className="mt-4 font-heading text-5xl font-semibold tracking-tight sm:text-6xl" id="connect-title">Turn chat reactions into moments worth keeping.</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">Connect Twitch first. Then MomentMint will guide you through turning on chat listening and reviewing your first community-nominated highlight.</p><div className="mt-7 flex flex-wrap items-center gap-3"><Button render={<a href="/oauth/twitch/start" />} size="lg">Connect Twitch</Button><span className="text-sm text-muted-foreground">Takes about 30 seconds.</span></div></div><div className="grid gap-4 md:grid-cols-3"><FlowStep number="01" title="Connect Twitch" text="Sign in with the creator account you want to monitor." complete={false} /><FlowStep number="02" title="Turn on listening" text="Approve the chat connection and register EventSub." complete={false} /><FlowStep number="03" title="Review moments" text="Viewers type !moment while you stream." complete={false} /></div><Card className="max-w-3xl bg-card/60"><CardHeader><CardTitle>What MomentMint needs access to</CardTitle><CardDescription>Only permissions needed for this workflow.</CardDescription></CardHeader><CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground"><p><strong className="text-foreground">Chat access</strong> reads the !moment nominations sent in your live channel.</p><p><strong className="text-foreground">Clip management</strong> lets MomentMint target the nominated timestamp in your stream recording.</p><p><strong className="text-foreground">You stay in control</strong> clips and metadata remain reviewable before you share them.</p></CardContent></Card></section>
}

function ConnectionLoading() {
  return <section aria-live="polite" className="max-w-3xl space-y-4"><div className="h-8 w-56 animate-pulse rounded-lg bg-muted" /><div className="h-24 animate-pulse rounded-3xl bg-muted" /><p className="text-sm text-muted-foreground">Checking your Twitch connection…</p></section>
}

export { ConnectPage }
