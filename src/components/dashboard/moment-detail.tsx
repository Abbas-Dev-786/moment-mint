import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { StatusPill } from "@/components/shared/status-pill"
import { RequestError } from "@/components/shared/feedback"
import { api, type MetadataInput } from "@/lib/api"
import { errorLabel, formatApproximateTime } from "@/lib/format"
import { useMoment, useWorkspaceMutation } from "@/hooks/use-momentmint"

function MomentDetail({ momentId }: { momentId: string }) {
  const detail = useMoment(momentId)
  const [confirmClip, setConfirmClip] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<MetadataInput>({ title: "", summary: "", category: "other", socialCaption: "" })
  const clipMutation = useWorkspaceMutation(() => api.requestClip(momentId))
  const metadataMutation = useWorkspaceMutation(() => api.requestMetadata(momentId))
  const saveMetadataMutation = useWorkspaceMutation((input: MetadataInput) => api.updateMetadata(momentId, input))
  const reviewMutation = useWorkspaceMutation((status: "REVIEWED" | "DISMISSED") => api.reviewMoment(momentId, status))

  useEffect(() => {
    if (detail.data?.metadata) {
      setMetadata({ title: detail.data.metadata.title, summary: detail.data.metadata.summary, category: detail.data.metadata.category, socialCaption: detail.data.metadata.social_caption })
    }
  }, [detail.data?.metadata])

  if (detail.isPending) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading moment details…</CardContent></Card>
  if (detail.isError) return <Card><CardContent className="p-6 text-sm text-destructive">Moment details are unavailable. Try refreshing.</CardContent></Card>
  if (!detail.data) return null

  const { moment, nominations, clips, metadata: savedMetadata } = detail.data
  const clip = clips[0]
  const contextLabel = savedMetadata?.context_mode === "COMMUNITY_CONTEXT"
    ? "Community context"
    : savedMetadata?.context_mode === "CONTEXT_EXPIRED"
      ? "Context expired"
      : savedMetadata?.context_mode === "NO_CONTEXT"
        ? "No usable context"
        : "Minimal context"
  const contextNotice = savedMetadata?.context_mode === "CONTEXT_EXPIRED"
    ? "The short-lived chat sample expired before metadata was generated. These suggestions use the remaining stream and nomination details only."
    : savedMetadata?.context_mode === "NO_CONTEXT"
      ? "No usable chat sample was available around this nomination. These suggestions use the remaining stream and nomination details only."
      : savedMetadata?.evidence_summary ?? "No usable community context was available; review the clip before sharing."
  const metadataFallback = savedMetadata?.status === "FAILED_WITH_FALLBACK"
  const canRequestClip = !clip || ["FAILED", "RETRYABLE_FAILED", "MANUAL_REVIEW"].includes(clip.status)
  const saveMetadata = () => saveMetadataMutation.mutate(metadata)
  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(metadata.socialCaption)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setActionError("The caption could not be copied. Select it and copy it manually.")
    }
  }
  const openEditFlow = async () => {
    if (!clip) return
    const popup = window.open("about:blank", "_blank", "noopener,noreferrer")
    setEditLoading(true)
    setActionError(null)
    try {
      const result = await api.getClipEditUrl(clip.id)
      if (popup) popup.location.href = result.editUrl
      else window.location.href = result.editUrl
    } catch {
      popup?.close()
      setActionError("Twitch has not returned an edit link for this clip yet.")
    } finally {
      setEditLoading(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-4 bg-card/70">
          <div className="flex items-start justify-between gap-3">
          <div>
            <CardDescription>Approximate nomination time</CardDescription>
            <CardTitle className="mt-1 text-2xl">{formatApproximateTime(moment.anchor_eventsub_at)}</CardTitle>
          </div>
          <StatusPill value={moment.status} />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs leading-5 text-muted-foreground"><span>EventSub gives an approximate marker; the clip targets that point in the stream recording.</span>{detail.isFetching && <span className="text-primary">Updating…</span>}</div>
      </CardHeader>
      <CardContent className="grid gap-6 p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Distinct viewers</p><p className="mt-1 text-xl font-semibold">{moment.unique_nominator_count}</p></div>
          <div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Nominations</p><p className="mt-1 text-xl font-semibold">{nominations.length}</p></div>
          <div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Threshold</p><p className="mt-1 text-xl font-semibold">{moment.threshold_required}</p></div>
        </div>

        <section aria-labelledby="clip-section-title" className="grid gap-3">
          <div className="flex items-center justify-between gap-3"><h3 className="font-medium" id="clip-section-title">Clip review</h3>{clip && <StatusPill value={clip.status} />}</div>
          {clip?.embed_url && clip.status === "READY_FOR_REVIEW" ? <iframe className="aspect-video w-full rounded-xl border border-border/70" title="Twitch clip preview" src={`${clip.embed_url}${clip.embed_url.includes("?") ? "&" : "?"}parent=${window.location.hostname}`} allowFullScreen /> : <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">A clip is not ready until Twitch confirms it through Get Clips.</p>}
          <div className="flex flex-wrap gap-2">
            {clip?.clip_url && <Button render={<a href={clip.clip_url} target="_blank" rel="noreferrer" />} variant="outline">Open Twitch clip</Button>}
            {clip && <Button disabled={editLoading} onClick={() => void openEditFlow()} type="button" variant="outline">{editLoading ? "Opening…" : "Open edit flow"}</Button>}
            {canRequestClip && <Button onClick={() => setConfirmClip(true)} type="button">{clip ? "Retry clip" : "Create clip"}</Button>}
          </div>
          {clip?.error_code && <p className="text-sm text-destructive">{errorLabel(clip.error_code)} The candidate is retained so you can retry it.</p>}
          {actionError && <p className="text-sm text-destructive">{actionError}</p>}
          {clipMutation.isError && <RequestError error={clipMutation.error} title="The clip request could not be started" />}
          {clipMutation.isSuccess && <p aria-live="polite" className="rounded-xl border border-primary/25 bg-primary/8 p-3 text-sm text-muted-foreground">Clip request queued. This panel will update automatically when Twitch confirms it.</p>}
        </section>

        <Separator />

        <section aria-labelledby="metadata-section-title" className="grid gap-4">
          <div className="flex items-start justify-between gap-3"><div><h3 className="font-medium" id="metadata-section-title">Editable metadata</h3><p className="mt-1 text-sm text-muted-foreground">AI does not watch the video. Review every field before sharing.</p></div><StatusPill value={savedMetadata?.status ?? "NOT_REQUESTED"} /></div>
          {metadataFallback && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm"><p className="font-medium">AI suggestions were unavailable</p><p className="mt-1 leading-6 text-muted-foreground">MomentMint saved safe starter metadata instead. You can edit it now or try generating again.</p></div>}
          {savedMetadata && <div className="rounded-xl border border-border/70 bg-muted/30 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">Evidence used</p><span className="text-xs text-muted-foreground">{contextLabel}</span></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{contextNotice}</p><div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground"><span className="rounded-full bg-background px-2.5 py-1">{savedMetadata.evidence_message_count ?? 0} sampled message{savedMetadata.evidence_message_count === 1 ? "" : "s"}</span>{savedMetadata.evidence_window_start && savedMetadata.evidence_window_end && <span className="rounded-full bg-background px-2.5 py-1">{formatApproximateTime(savedMetadata.evidence_window_start)}–{formatApproximateTime(savedMetadata.evidence_window_end)}</span>}</div>{savedMetadata.confidence_note && <p className="mt-3 text-xs leading-5 text-muted-foreground">{savedMetadata.confidence_note}</p>}</div>}
          <label className="grid gap-2 text-sm font-medium" htmlFor="metadata-title">Title<input aria-label="Metadata title" className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 font-normal outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50]" id="metadata-title" maxLength={80} onChange={(event) => setMetadata((current) => ({ ...current, title: event.target.value }))} value={metadata.title} /></label>
          <label className="grid gap-2 text-sm font-medium" htmlFor="metadata-summary">Summary<Textarea aria-label="Metadata summary" id="metadata-summary" maxLength={240} onChange={(event) => setMetadata((current) => ({ ...current, summary: event.target.value }))} value={metadata.summary} /></label>
          <label className="grid gap-2 text-sm font-medium" htmlFor="metadata-category">Category<select aria-label="Metadata category" className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm font-normal outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" id="metadata-category" onChange={(event) => setMetadata((current) => ({ ...current, category: event.target.value }))} value={metadata.category}><option value="funny">Funny</option><option value="clutch">Clutch</option><option value="surprise">Surprise</option><option value="wholesome">Wholesome</option><option value="reaction">Reaction</option><option value="other">Other</option></select></label>
          <label className="grid gap-2 text-sm font-medium" htmlFor="metadata-caption">Social caption<Textarea aria-label="Social caption" id="metadata-caption" maxLength={280} onChange={(event) => setMetadata((current) => ({ ...current, socialCaption: event.target.value }))} value={metadata.socialCaption} /></label>
          <div className="flex flex-wrap gap-2"><Button disabled={saveMetadataMutation.isPending || !metadata.title || !metadata.summary || !metadata.socialCaption} onClick={saveMetadata} type="button">{saveMetadataMutation.isPending ? "Saving…" : "Save metadata"}</Button><Button disabled={metadataMutation.isPending} onClick={() => metadataMutation.mutate()} type="button" variant="outline">{metadataMutation.isPending ? "Generating…" : savedMetadata ? "Regenerate with AI" : "Generate with AI"}</Button><Button disabled={!metadata.socialCaption} onClick={() => void copyCaption()} type="button" variant="ghost">{copied ? "Copied" : "Copy caption"}</Button></div>
        </section>
      </CardContent>
      <CardFooter className="justify-between gap-2 border-t border-border/70 bg-card/40"><div><span className="text-xs text-muted-foreground">Choose what happens next.</span>{reviewMutation.isError && <p aria-live="polite" className="mt-1 text-sm text-destructive">{reviewMutation.error.message}</p>}</div><div className="flex gap-2"><Button disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate("DISMISSED")} type="button" variant="ghost">Dismiss</Button><Button disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate("REVIEWED")} type="button" variant="outline">Mark reviewed</Button></div></CardFooter>

      <Dialog onOpenChange={setConfirmClip} open={confirmClip}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request a Twitch clip?</DialogTitle><DialogDescription>Twitch controls the capture and publication behavior. MomentMint will wait for Get Clips to confirm the result before calling it ready.</DialogDescription></DialogHeader>
          <DialogFooter><Button onClick={() => setConfirmClip(false)} type="button" variant="outline">Cancel</Button><Button disabled={clipMutation.isPending} onClick={() => { clipMutation.mutate(); setConfirmClip(false) }} type="button">{clipMutation.isPending ? "Requesting…" : "Confirm clip request"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export { MomentDetail }
