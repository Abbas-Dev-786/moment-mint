import { Link } from "react-router"

import { PrimaryNav } from "@/components/layout/primary-nav"

function AppHeader() {
  return (
    <header className="flex flex-col gap-5 border-b border-border/70 py-5 sm:flex-row sm:items-center sm:justify-between">
      <Link
        className="group inline-flex w-fit items-center gap-3"
        to="/connect"
        aria-label="MomentMint home"
      >
        <span className="grid size-10 place-items-center rounded-xl bg-primary font-heading text-lg font-bold text-primary-foreground shadow-sm transition-transform group-hover:-rotate-3">
          M
        </span>
        <span className="grid gap-0.5">
          <strong className="font-heading text-base tracking-tight">MomentMint</strong>
          <span className="text-xs text-muted-foreground">community-powered highlights</span>
        </span>
      </Link>
      <PrimaryNav />
    </header>
  )
}

export { AppHeader }
