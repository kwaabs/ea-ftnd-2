"use client"

import { useMemo } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExportButton } from "@/components/ui/export-button"
import type { Meter } from "@/lib/types/api"
import { ExternalLink } from "lucide-react"

interface RelatedMetersProps {
  meters: Meter[]
  currentMeterType: string
  filterType: "station" | "boundary" | "district"
  filenamePrefix?: string
}

export function RelatedMeters({ meters, currentMeterType, filterType, filenamePrefix = "meter" }: RelatedMetersProps) {
  const title =
    filterType === "station"
      ? "Same Station"
      : filterType === "boundary"
        ? "Same Boundary Point"
        : "Same District"

  const exportData = useMemo(
    () =>
      meters.map((meter) => ({
        meter_number: meter.meter_number,
        meter_type: meter.meter_type,
        location: meter.location ?? "",
        station: meter.station ?? "",
        region: meter.region ?? "",
        district: meter.district ?? "",
        status: meter.status ?? "",
        boundary_metering_point: meter.boundary_metering_point ?? "",
      })),
    [meters]
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm">Related Meters</CardTitle>
            <p className="text-xs text-muted-foreground">{title}</p>
          </div>
          <ExportButton
            data={exportData}
            filename={`${filenamePrefix}-related-meters`}
            disabled={meters.length === 0}
          />
        </div>
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
