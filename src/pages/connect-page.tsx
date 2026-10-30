import { useNavigate } from "react-router"

import { Principle } from "@/components/shared/principle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

function ConnectPage() {
  const navigate = useNavigate()

  return (
    <section aria-labelledby="connect-title" className="max-w-4xl">
      <Badge className="mb-6 rounded-full px-3 py-1" variant="outline">
        Your community sees it first
      </Badge>
      <h1
        className="max-w-3xl font-heading text-4xl font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl"
        id="connect-title"
      >
        Turn chat reactions into your next highlight.
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
        MomentMint groups independent <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">!moment</code>{" "}
        nominations into a focused inbox, then helps you prepare a Twitch clip for review.
      </p>
      <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <Button onClick={() => navigate("/dashboard")} size="lg" type="button">
          Preview creator dashboard
          <span aria-hidden="true">→</span>
        </Button>
        <span className="text-sm text-muted-foreground">Twitch connection arrives in Phase 2.</span>
      </div>

      <div className="mt-20 grid gap-3 border-t border-border/70 pt-6 sm:grid-cols-3">
        <Principle title="Community signal" text="Distinct viewers count once." />
        <Principle title="Creator control" text="Nothing is shared automatically." />
        <Principle title="Truthful status" text="Clips are verified before ready." />
      </div>
    </section>
  )
}

export { ConnectPage }
