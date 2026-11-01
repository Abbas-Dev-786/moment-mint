import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router"

import { Feedback, RequestError } from "@/components/shared/feedback"
import { StatusPill } from "@/components/shared/status-pill"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { api, isUnauthorized, type SettingsPatch } from "@/lib/api"
import { useSettings, useWorkspaceMutation } from "@/hooks/use-momentmint"

function SettingsPage() {
  const navigate = useNavigate()
  const settings = useSettings()
  const update = useWorkspaceMutation((input: SettingsPatch) => api.updateSettings(input))
  const disconnect = useWorkspaceMutation(() => api.disconnect())
  const logout = useWorkspaceMutation(() => api.logout())
  const [threshold, setThreshold] = useState(2)
  const [windowSeconds, setWindowSeconds] = useState(30)
  const [autoClip, setAutoClip] = useState(false)
  const [communityContext, setCommunityContext] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [disconnectOpen, setDisconnectOpen] = useState(false)

  useEffect(() => {
    if (settings.data && !dirty) {
      setThreshold(settings.data.settings.uniqueViewerThreshold)
      setWindowSeconds(settings.data.settings.groupWindowSeconds)
      setAutoClip(settings.data.settings.autoClipEnabled)
      setCommunityContext(settings.data.settings.communityContextEnabled)
    }
  }, [dirty, settings.data])

  useEffect(() => {
    if (update.isSuccess) setDirty(false)
    if (disconnect.isSuccess || logout.isSuccess) navigate("/connect")
  }, [disconnect.isSuccess, logout.isSuccess, navigate, update.isSuccess])

  if (settings.isPending) return <SettingsLoading />
  if (settings.isError && isUnauthorized(settings.error)) return <section className="max-w-xl space-y-5"><Badge variant="outline">Connection required</Badge><h1 className="font-heading text-4xl font-semibold tracking-tight">Connect Twitch before changing settings.</h1><p className="leading-7 text-muted-foreground">Your discovery rules belong to your creator account. Connect Twitch to open them.</p><Button render={<Link to="/connect" />}>Open connection</Button></section>
  if (settings.isError || !settings.data) return <section className="max-w-xl"><RequestError error={settings.error} onRetry={() => void settings.refetch()} title="We could not load settings" /></section>

  const data = settings.data
  const save = (confirmAutoClip = false) => update.mutate({ groupWindowSeconds: windowSeconds, uniqueViewerThreshold: threshold, autoClipEnabled: autoClip, communityContextEnabled: communityContext, ...(confirmAutoClip ? { confirmAutoClip: true } : {}) })
  const submit = () => {
    if (autoClip && !data.settings.autoClipEnabled) setConfirmOpen(true)
    else save()
  }
  const updateField = (setter: (value: number) => void, value: number) => { setDirty(true); setter(value) }

  return <section aria-labelledby="settings-title" className="max-w-3xl space-y-8">
    <div><Badge className="rounded-full" variant="outline">Workspace controls</Badge><h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight sm:text-5xl" id="settings-title">Settings</h1><p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">Choose how quickly community signals qualify a moment. Changes apply to new nominations.</p></div>
    {update.isError && <RequestError error={update.error} title="Settings were not saved" />}
    {update.isSuccess && !dirty && <Feedback title="Settings saved" tone="success">New nominations will use these rules.</Feedback>}

    <Card><CardHeader><div className="flex items-start justify-between gap-4"><div><CardTitle>Connected Twitch account</CardTitle><CardDescription className="mt-1">Tokens stay encrypted on the Worker.</CardDescription></div><StatusPill value={data.eventSub?.status ?? "NOT_REGISTERED"} /></div></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-medium">{data.creator.displayName}</p><p className="text-sm text-muted-foreground">@{data.creator.twitchLogin}</p><p className="mt-2 text-sm text-muted-foreground">{data.eventSub?.status === "enabled" ? "Chat listening is active." : "Chat listening still needs attention."}</p></div><Button render={<Link to="/connect" />} size="sm" variant="outline">Open connection</Button></CardContent></Card>

    <Card><CardHeader><CardTitle>Moment discovery</CardTitle><CardDescription>Viewers type <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{data.settings.nominationCommand}</code> in your live chat.</CardDescription></CardHeader><CardContent className="grid gap-5"><label className="grid gap-2 text-sm font-medium" htmlFor="threshold">Distinct viewers to qualify<span className="font-normal text-muted-foreground">Repeated nominations from one viewer count once.</span><Input id="threshold" max={100} min={1} onChange={(event) => updateField(setThreshold, Number(event.target.value))} type="number" value={threshold} /></label><label className="grid gap-2 text-sm font-medium" htmlFor="window">Grouping window in seconds<span className="font-normal text-muted-foreground">Nominations within this window are grouped around the first signal.</span><Input id="window" max={120} min={5} onChange={(event) => updateField(setWindowSeconds, Number(event.target.value))} type="number" value={windowSeconds} /></label><div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4"><label className="grid gap-1 text-sm font-medium" htmlFor="auto-clip">Automatic clip creation<span className="font-normal text-muted-foreground">When the threshold is met, create a clip automatically for review.</span></label><Switch aria-label="Automatic clip creation" checked={autoClip} id="auto-clip" onCheckedChange={(checked) => { setDirty(true); setAutoClip(checked) }} /></div><p className="text-sm leading-6 text-muted-foreground">{data.disclosure}</p></CardContent><CardFooter><Button disabled={update.isPending || !dirty} onClick={submit} type="button">{update.isPending ? "Saving…" : "Save changes"}</Button>{dirty && <span className="ml-3 text-sm text-muted-foreground">Unsaved changes</span>}</CardFooter></Card>

    <Card><CardHeader><CardTitle>Privacy and AI context</CardTitle><CardDescription>MomentMint keeps the AI context intentionally small.</CardDescription></CardHeader><CardContent className="grid gap-4"><div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4"><label className="grid gap-1 text-sm font-medium" htmlFor="community-context">Use short-lived community context for AI<span className="font-normal text-muted-foreground">Sample nearby chat without viewer identities to make AI suggestions more specific.</span></label><Switch aria-label="Use short-lived community context for AI" checked={communityContext} id="community-context" onCheckedChange={(checked) => { setDirty(true); setCommunityContext(checked) }} /></div><p className="text-sm leading-6 text-muted-foreground">{data.chatContext.explanation} AI suggestions are editable and never publish to third-party networks.</p></CardContent></Card>

    {disconnect.isError && <RequestError error={disconnect.error} title="Twitch was not disconnected" />}
    {logout.isError && <RequestError error={logout.error} title="You were not logged out" />}
    <Card className="border-destructive/30"><CardHeader><CardTitle>Account actions</CardTitle><CardDescription>Disconnecting stops chat listening and removes local credentials. Your saved moments remain.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2"><Button disabled={disconnect.isPending} onClick={() => setDisconnectOpen(true)} type="button" variant="destructive">Disconnect Twitch</Button><Button disabled={logout.isPending} onClick={() => logout.mutate()} type="button" variant="outline">{logout.isPending ? "Logging out…" : "Log out"}</Button></CardContent></Card>
    <Dialog onOpenChange={setConfirmOpen} open={confirmOpen}><DialogContent><DialogHeader><DialogTitle>Enable automatic clips?</DialogTitle><DialogDescription>MomentMint will request a clip when your viewer threshold is met, then wait for Twitch to verify it. You still review the result before sharing.</DialogDescription></DialogHeader><DialogFooter><Button onClick={() => setConfirmOpen(false)} type="button" variant="outline">Keep off</Button><Button onClick={() => { setConfirmOpen(false); save(true) }} type="button">Enable automatic clips</Button></DialogFooter></DialogContent></Dialog>
    <Dialog onOpenChange={setDisconnectOpen} open={disconnectOpen}><DialogContent><DialogHeader><DialogTitle>Disconnect Twitch?</DialogTitle><DialogDescription>This stops chat listening, revokes the saved Twitch session where supported, and signs you out of MomentMint. Your saved moments remain.</DialogDescription></DialogHeader><DialogFooter><Button onClick={() => setDisconnectOpen(false)} type="button" variant="outline">Keep connected</Button><Button disabled={disconnect.isPending} onClick={() => disconnect.mutate()} type="button" variant="destructive">{disconnect.isPending ? "Disconnecting…" : "Disconnect Twitch"}</Button></DialogFooter></DialogContent></Dialog>
    <Separator />
  </section>
}

function SettingsLoading() { return <section aria-live="polite" className="max-w-3xl space-y-4"><div className="h-8 w-48 animate-pulse rounded-lg bg-muted" /><div className="h-32 animate-pulse rounded-2xl bg-muted" /><div className="h-72 animate-pulse rounded-2xl bg-muted" /><p className="text-sm text-muted-foreground">Loading workspace settings…</p></section> }

export { SettingsPage }
