import { Card, CardContent } from "@/components/ui/card"

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="gap-3 bg-card/70 py-4">
      <CardContent className="grid gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <strong className="text-lg font-semibold tracking-tight">{value}</strong>
      </CardContent>
    </Card>
  )
}

export { MetricCard }
