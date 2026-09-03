"use client"

import { Construction } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface LegacyMeterComingSoonProps {
  name: string
}

/** Placeholder for a legacy meter source that's been identified but isn't wired up to a backend yet. */
export function LegacyMeterComingSoon({ name }: LegacyMeterComingSoonProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Construction className="h-8 w-8 text-muted-foreground" />
        <div>
          <p className="text-base font-semibold text-foreground">{name}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Coming soon — this legacy meter source isn&apos;t wired up yet.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
