import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router"

import { StatusPill } from "@/components/shared/status-pill"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { api, type SettingsPatch } from "@/lib/api"
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
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [disconnectOpen, setDisconnectOpen] = useState(false)

  useEffect(() => {
    if (settings.data) {
      setThreshold(settings.data.settings.uniqueViewerThreshold)
      setWindowSeconds(settings.data.settings.groupWindowSeconds)
      setAutoClip(settings.data.settings.autoClipEnabled)
    }
  }, [settings.data])

  if (settings.isPending) return <section aria-live="polite" className="max-w-3xl space-y-4"><div className="h-10 w-48 animate-pulse rounded bg-muted" /><div className="h-80 animate-pulse rounded-2xl bg-muted" /><p className="text-sm text-muted-foreground">Loading workspace settings…</p></section>
  if (settings.isError || !settings.data) return <section className="max-w-xl space-y-4"><Badge variant="destructive">Settings unavailable</Badge><h1 className="font-heading text-4xl font-semibold">We could not load settings.</h1><Button onClick={() => void settings.refetch()} type="button">Try again</Button></section>

  const save = (confirmAutoClip = false) => update.mutate({ groupWindowSeconds: windowSeconds, uniqueViewerThreshold: threshold, autoClipEnabled: autoClip, ...(confirmAutoClip ? { confirmAutoClip: true } : {}) })
  const submit = () => {
    if (autoClip && !settings.data.settings.autoClipEnabled) setConfirmOpen(true)
    else save()
  }

  return <section aria-labelledby="settings-title" className="max-w-3xl space-y-8"><div><Badge className="rounded-full" variant="outline">Workspace controls</Badge><h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight sm:text-5xl" id="settings-title">Settings</h1><p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">Tune how community signals become reviewable candidates. Every value is saved per creator.</p></div>
    <Card><CardHeader><CardTitle>Connected Twitch account</CardTitle><CardDescription>Tokens remain encrypted on the Worker and are never sent to this page.</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-medium">{settings.data.creator.displayName}</p><p className="text-sm text-muted-foreground">@{settings.data.creator.twitchLogin}</p></div><div className="flex items-center gap-3"><StatusPill value={settings.data.eventSub?.status ?? "NOT_REGISTERED"} /><Button render={<Link to="/connect" />} size="sm" variant="outline">Connection</Button></div></CardContent></Card>
    <Card><CardHeader><CardTitle>Moment discovery</CardTitle><CardDescription>Exact command: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{settings.data.settings.nominationCommand}</code></CardDescription></CardHeader><CardContent className="grid gap-5"><label className="grid gap-2 text-sm font-medium" htmlFor="threshold">Distinct viewers to qualify<span className="font-normal text-muted-foreground">Repeated nominations from one viewer do not increase this count.</span><Input id="threshold" max={100} min={1} onChange={(event) => setThreshold(Number(event.target.value))} type="number" value={threshold} /></label><label className="grid gap-2 text-sm font-medium" htmlFor="window">Grouping window in seconds<span className="font-normal text-muted-foreground">The first nomination anchors the window; timing remains approximate.</span><Input id="window" max={120} min={5} onChange={(event) => setWindowSeconds(Number(event.target.value))} type="number" value={windowSeconds} /></label><div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4"><label className="grid gap-1 text-sm font-medium" htmlFor="auto-clip">Automatic clip creation<span className="font-normal text-muted-foreground">Off by default until Twitch publication/edit behavior is reviewed.</span></label><Switch aria-label="Automatic clip creation" checked={autoClip} id="auto-clip" onCheckedChange={(checked) => setAutoClip(checked)} /></div><p className="text-sm leading-6 text-muted-foreground">{settings.data.disclosure}</p></CardContent><CardFooter><Button disabled={update.isPending} onClick={submit} type="button">{update.isPending ? "Saving…" : "Save settings"}</Button>{update.isSuccess && <span aria-live="polite" className="ml-3 text-sm text-primary">Saved.</span>}</CardFooter></Card>
    <Card><CardHeader><CardTitle>Privacy and AI context</CardTitle><CardDescription>MomentMint keeps the AI context intentionally small.</CardDescription></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{settings.data.chatContext.explanation} AI suggestions are editable and never publish to third-party networks.</p></CardContent></Card>
    <Card className="border-destructive/30"><CardHeader><CardTitle>Account actions</CardTitle><CardDescription>Disconnecting disables related EventSub subscriptions and removes local credentials.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2"><Button disabled={disconnect.isPending} onClick={() => setDisconnectOpen(true)} type="button" variant="destructive">Disconnect Twitch</Button><Button disabled={logout.isPending} onClick={() => { logout.mutate(); navigate("/connect") }} type="button" variant="outline">Log out</Button></CardContent></Card>
    <Dialog onOpenChange={setConfirmOpen} open={confirmOpen}><DialogContent><DialogHeader><DialogTitle>Enable automatic clips?</DialogTitle><DialogDescription>Twitch may make a created clip visible according to its current behavior. MomentMint will still wait for Twitch verification, but you should review the Twitch edit flow before enabling this setting.</DialogDescription></DialogHeader><DialogFooter><Button onClick={() => setConfirmOpen(false)} type="button" variant="outline">Keep off</Button><Button onClick={() => { setConfirmOpen(false); save(true) }} type="button">I understand, enable</Button></DialogFooter></DialogContent></Dialog>
    <Dialog onOpenChange={setDisconnectOpen} open={disconnectOpen}><DialogContent><DialogHeader><DialogTitle>Disconnect Twitch?</DialogTitle><DialogDescription>MomentMint will disable EventSub subscriptions, revoke where supported, delete local credentials, and sign you out.</DialogDescription></DialogHeader><DialogFooter><Button onClick={() => setDisconnectOpen(false)} type="button" variant="outline">Cancel</Button><Button disabled={disconnect.isPending} onClick={() => { disconnect.mutate(); setDisconnectOpen(false); navigate("/connect") }} type="button" variant="destructive">Disconnect</Button></DialogFooter></DialogContent></Dialog>
    <Separator />
  </section>
}

export { SettingsPage }
