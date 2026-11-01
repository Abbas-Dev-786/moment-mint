import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon, CheckmarkCircle02Icon, InformationCircleIcon } from "@hugeicons/core-free-icons"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { errorMessage } from "@/lib/api"

type FeedbackTone = "info" | "success" | "error"

const toneStyles: Record<FeedbackTone, { icon: typeof InformationCircleIcon; className: string }> = {
  info: { icon: InformationCircleIcon, className: "border-primary/25 bg-primary/8 text-foreground [&_[data-slot=alert-description]]:text-muted-foreground" },
  success: { icon: CheckmarkCircle02Icon, className: "border-primary/30 bg-primary/10 text-foreground [&_[data-slot=alert-description]]:text-muted-foreground" },
  error: { icon: Alert02Icon, className: "border-destructive/35 bg-destructive/10 text-destructive [&_[data-slot=alert-description]]:text-destructive/90" },
}

function Feedback({ tone, title, children, action, onAction }: { tone: FeedbackTone; title: string; children: React.ReactNode; action?: string; onAction?: () => void }) {
  const style = toneStyles[tone]
  return (
    <Alert className={style.className} variant={tone === "error" ? "destructive" : "default"}>
      <HugeiconsIcon icon={style.icon} strokeWidth={2} />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
      {action && onAction && <Button className="mt-2 w-fit" onClick={onAction} size="sm" type="button" variant="outline">{action}</Button>}
    </Alert>
  )
}

function RequestError({ error, onRetry, title = "We could not finish that" }: { error: unknown; onRetry?: () => void; title?: string }) {
  return <Feedback action={onRetry ? "Try again" : undefined} onAction={onRetry} title={title} tone="error">{errorMessage(error)}</Feedback>
}

export { Feedback, RequestError }
