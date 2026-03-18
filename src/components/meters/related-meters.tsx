"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Meter } from "@/lib/types/api"
import { ExternalLink } from "lucide-react"

interface RelatedMetersProps {
  meters: Meter[]
  currentMeterType: string
  filterType: "station" | "boundary" | "district"
}

export function RelatedMeters({ meters, currentMeterType, filterType }: RelatedMetersProps) {
  const title =
    filterType === "station"
      ? "Same Station"
      : filterType === "boundary"
        ? "Same Boundary Point"
        : "Same District"

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Related Meters</CardTitle>
        <p className="text-xs text-muted-foreground">{title}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {meters.slice(0, 5).map((meter) => (
            <Link
              key={meter.meter_number}
              href={`/meters/${meter.meter_number}`}
              className="block p-2 hover:bg-muted/50 rounded-lg transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm font-semibold truncate group-hover:text-primary">
                    {meter.meter_number}
                  </p>
                  {meter.location && <p className="text-xs text-muted-foreground truncate">{meter.location}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Badge
                    variant={meter.status === "Operational" ? "default" : "destructive"}
                    className="text-xs"
                  >
                    {meter.status || "Unknown"}
                  </Badge>
                  <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                </div>
              </div>
            </Link>
          ))}

          {meters.length > 5 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              +{meters.length - 5} more meter{meters.length - 5 !== 1 ? "s" : ""}
            </p>
          )}

          {meters.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No related meters found</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
