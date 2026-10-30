import { Outlet } from "react-router"

import { AppFooter } from "@/components/layout/app-footer"
import { AppHeader } from "@/components/layout/app-header"

function AppLayout() {
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="relative isolate flex min-h-screen flex-col overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(circle_at_top,oklch(0.55_0.14_165_/_0.18),transparent_65%)]"
        />
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 sm:px-6 lg:px-8">
          <AppHeader />
          <main className="flex-1 py-12 lg:py-20">
            <Outlet />
          </main>
          <AppFooter />
        </div>
      </div>
    </div>
  )
}

export { AppLayout }
