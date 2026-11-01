import { Link } from "react-router"

import { PrimaryNav } from "@/components/layout/primary-nav"
import { Button } from "@/components/ui/button"
import { useMe } from "@/hooks/use-momentmint"

function AppHeader() {
  const me = useMe()
  const connected = Boolean(me.data)
  return (
    <header className="flex flex-col gap-5 border-b border-border/70 py-4 sm:flex-row sm:items-center sm:justify-between">
      <Link
        className="group inline-flex w-fit items-center gap-3"
        to="/connect"
        aria-label="MomentMint home"
      >
        <span className="relative grid size-10 place-items-center rounded-xl bg-primary font-heading text-lg font-bold text-primary-foreground shadow-sm transition-transform group-hover:-rotate-3" aria-hidden="true">
          M<span className="absolute -z-10 size-10 rounded-xl bg-primary/30 blur-md" />
        </span>
        <span className="grid gap-0.5">
          <strong className="font-heading text-base tracking-tight">MomentMint</strong>
          <span className="text-xs text-muted-foreground">community-powered highlights</span>
        </span>
      </Link>
      <div className="flex flex-wrap items-center gap-3 sm:gap-5">
        <PrimaryNav />
        {connected ? <Link className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground" to="/connect"><span className="size-1.5 rounded-full bg-primary shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary)_18%,transparent)]" /> <span className="hidden sm:inline">Connected as</span> @{me.data?.login}</Link> : <Button render={<Link to="/connect" />} size="sm">Connect Twitch</Button>}
      </div>
    </header>
  )
}

export { AppHeader }
