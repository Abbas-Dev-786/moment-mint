import { useState } from "react"
import { Link } from "react-router"

import { Principle } from "@/components/shared/principle"
import { StatusPill } from "@/components/shared/status-pill"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ApiRequestError } from "@/lib/api"
import { useMe, useSettings, useWorkspaceMutation } from "@/hooks/use-momentmint"
import { api } from "@/lib/api"

function ConnectPage() {
  const me = useMe()
  const connected = Boolean(me.data)
  const settings = useSettings(connected)
  const register = useWorkspaceMutation(() => api.registerEventSub())
  const disconnect = useWorkspaceMutation(() => api.disconnect())
  const [disconnectOpen, setDisconnectOpen] = useState(false)

  if (me.isPending) return <section aria-live="polite" className="max-w-3xl space-y-4"><div className="h-6 w-40 animate-pulse rounded bg-muted" /><div className="h-16 w-full animate-pulse rounded bg-muted" /><p className="text-sm text-muted-foreground">Checking your Twitch connection…</p></section>
  if (me.isError && !(me.error instanceof ApiRequestError && me.error.status === 401)) return <section className="max-w-xl space-y-4"><Badge variant="destructive">Connection error</Badge><h1 className="font-heading text-4xl font-semibold">We could not check Twitch.</h1><p className="text-muted-foreground">Refresh the page and try again. Your saved credentials remain server-side.</p><Button onClick={() => void me.refetch()} type="button">Try again</Button></section>

  if (!connected) return <DisconnectedConnect />
  const creator = me.data
  if (!creator) return <DisconnectedConnect />

  const eventSub = settings.data?.eventSub
  return (
    <section aria-labelledby="connect-title" className="max-w-4xl space-y-8">
      <div><Badge className="rounded-full" variant="outline">Twitch connection</Badge><h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight sm:text-6xl" id="connect-title">Your creator workspace is connected.</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">{creator.displayName} is connected with the permissions needed to read channel chat and request Twitch clips.</p></div>
      <Card><CardHeader><div className="flex items-center justify-between gap-4"><div><CardTitle>{creator.displayName}</CardTitle><CardDescription>@{creator.login}</CardDescription></div><StatusPill value={creator.connectionStatus} /></div></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Granted scopes</p><p className="mt-2 text-sm">{creator.scopes.join(" · ") || "No scopes returned"}</p></div><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">EventSub</p><div className="mt-2 flex items-center gap-2"><StatusPill value={eventSub?.status ?? "NOT_REGISTERED"} />{eventSub?.reason && <span className="text-sm text-muted-foreground">{eventSub.reason}</span>}</div></div></CardContent><CardFooter className="flex flex-wrap gap-2"><Button disabled={register.isPending} onClick={() => register.mutate()} type="button">{register.isPending ? "Registering…" : eventSub?.status === "enabled" ? "Re-register EventSub" : "Register EventSub"}</Button><Button render={<Link to="/dashboard" />} variant="outline">Open dashboard</Button><Button render={<Link to="/settings" />} variant="ghost">Review settings</Button><Button disabled={disconnect.isPending} onClick={() => setDisconnectOpen(true)} type="button" variant="destructive">Disconnect</Button></CardFooter></Card>
      <Dialog onOpenChange={setDisconnectOpen} open={disconnectOpen}><DialogContent><DialogHeader><DialogTitle>Disconnect Twitch?</DialogTitle><DialogDescription>MomentMint will disable related EventSub subscriptions, revoke where supported, remove local credentials, and sign you out.</DialogDescription></DialogHeader><DialogFooter><Button onClick={() => setDisconnectOpen(false)} type="button" variant="outline">Cancel</Button><Button disabled={disconnect.isPending} onClick={() => { disconnect.mutate(); setDisconnectOpen(false) }} type="button" variant="destructive">Disconnect</Button></DialogFooter></DialogContent></Dialog>
      <div className="grid gap-3 border-t border-border/70 pt-6 sm:grid-cols-3"><Principle title="Community signal" text="Distinct viewers count once." /><Principle title="Creator control" text="Automatic clips stay off until you opt in." /><Principle title="Truthful status" text="Clips are verified before ready." /></div>
    </section>
  )
}

function DisconnectedConnect() {
  return <section aria-labelledby="connect-title" className="max-w-4xl"><Badge className="mb-6 rounded-full px-3 py-1" variant="outline">Your community sees it first</Badge><h1 className="max-w-3xl font-heading text-4xl font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl" id="connect-title">Turn chat reactions into your next highlight.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">MomentMint groups independent <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">!moment</code> nominations into a focused inbox, then helps you prepare a Twitch clip for review.</p><div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center"><a className={buttonVariants({ size: "lg" })} href="/oauth/twitch/start">Connect Twitch <span aria-hidden="true">→</span></a><span className="text-sm text-muted-foreground">You can disconnect at any time.</span></div><Card className="mt-12 max-w-2xl bg-card/60"><CardHeader><CardTitle className="text-xl">What MomentMint requests</CardTitle><CardDescription>Only the permissions needed for this workflow.</CardDescription></CardHeader><CardContent className="grid gap-3 text-sm leading-6"><p><strong className="text-foreground">user:read:chat</strong> lets MomentMint receive channel chat nominations through Twitch EventSub.</p><p><strong className="text-foreground">clips:edit</strong> lets MomentMint request a Twitch clip after you explicitly choose to create one.</p><p className="text-muted-foreground">Automatic clip creation is off by default. Twitch controls publication behavior, so review the edit flow before enabling automation.</p></CardContent></Card><div className="mt-16 grid gap-3 border-t border-border/70 pt-6 sm:grid-cols-3"><Principle title="Community signal" text="Distinct viewers count once." /><Principle title="Creator control" text="Nothing is shared automatically." /><Principle title="Truthful status" text="Clips are verified before ready." /></div></section>
}

export { ConnectPage }
