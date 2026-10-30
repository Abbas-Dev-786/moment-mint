import { SettingRow } from "@/components/settings/setting-row"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

function SettingsPage() {
  return (
    <section aria-labelledby="settings-title" className="max-w-3xl">
      <Badge className="rounded-full" variant="outline">
        Workspace controls
      </Badge>
      <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight sm:text-5xl" id="settings-title">
        Settings
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
        These defaults will become editable when the Twitch connection is implemented.
      </p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Moment discovery</CardTitle>
          <CardDescription>Phase 0 product defaults from the approved scope.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-0">
          <SettingRow label="Nomination command" value="!moment" />
          <Separator />
          <SettingRow label="Distinct viewers to qualify" value="2 viewers" />
          <Separator />
          <SettingRow label="Grouping window" value="30 seconds" />
          <Separator />
          <SettingRow label="Automatic clip creation" value="Off by default" />
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground">
            Creator control and truthful clip states are core product principles.
          </p>
        </CardFooter>
      </Card>
    </section>
  )
}

export { SettingsPage }
