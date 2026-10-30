import { MetricCard } from "@/components/dashboard/metric-card"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card"

function DashboardPage() {
  return (
    <section aria-labelledby="dashboard-title" className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge className="rounded-full" variant="outline">
            Creator workspace
          </Badge>
          <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight sm:text-5xl" id="dashboard-title">
            Highlight inbox
          </h1>
        </div>
        <Badge className="w-fit" variant="secondary">
          Preview data
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Connection" value="Not connected" />
        <MetricCard label="Live session" value="Waiting" />
        <MetricCard label="Nominations" value="0" />
        <MetricCard label="Clip candidates" value="0" />
      </div>

      <Card className="min-h-80 items-center justify-center border-dashed bg-card/60 text-center">
        <CardContent className="max-w-lg space-y-3">
          <div aria-hidden="true" className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-2xl text-primary">
            ✦
          </div>
          <CardTitle className="text-xl">No moments yet</CardTitle>
          <CardDescription className="text-base leading-7">
            Once Twitch is connected, viewers can type <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">!moment</code>{" "}
            in chat. Nearby nominations will appear here as one candidate.
          </CardDescription>
        </CardContent>
      </Card>
    </section>
  )
}

export { DashboardPage }
