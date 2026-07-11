"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAmrConsumptionAggregate } from "@/hooks/api/use-amr-consumption-aggregate-api"
import { ArrowDownToLine, ArrowUpFromLine, Gauge, Radio } from "lucide-react"

interface RegionalAmrConsumptionKpisProps {
  region: string
  dateRange: { start: string; end: string }
}

function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined) return "—"
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function RegionalAmrConsumptionKpis({ region, dateRange }: RegionalAmrConsumptionKpisProps) {
  const { data: aggregateData } = useAmrConsumptionAggregate({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    region,
  })

  const metrics = useMemo(() => {
    let totalImportKwh = 0
    let totalExportKwh = 0
    let meterCountSum = 0
    let activeMetersSum = 0
    let periodCount = 0

    ;(aggregateData || []).forEach((item) => {
      if (item.system_name === "import_kwh") {
        totalImportKwh += item.total_consumption || 0
      } else if (item.system_name === "export_kwh") {
        totalExportKwh += item.total_consumption || 0
      }
      meterCountSum += item.total_meter_count || 0
      activeMetersSum += item.active_meters || 0
      periodCount += 1
    })

    const avgTotalMeters = periodCount > 0 ? meterCountSum / periodCount : 0
    const avgActiveMeters = periodCount > 0 ? activeMetersSum / periodCount : 0
    const coveragePct = avgTotalMeters > 0 ? (avgActiveMeters / avgTotalMeters) * 100 : 0

    return {
      totalImportKwh,
      totalExportKwh,
      avgActiveMeters,
      avgTotalMeters,
      coveragePct,
    }
  }, [aggregateData])

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <ArrowDownToLine className="h-4 w-4 text-blue-600" />
            Import
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{formatNumber(metrics.totalImportKwh)}</div>
          <div className="h-px bg-border my-2"></div>
          <p className="text-xs text-muted-foreground">kWh in range</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <ArrowUpFromLine className="h-4 w-4 text-orange-600" />
            Export
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">{formatNumber(metrics.totalExportKwh)}</div>
          <div className="h-px bg-border my-2"></div>
          <p className="text-xs text-muted-foreground">kWh in range</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Radio className="h-4 w-4 text-purple-600" />
            Active Meters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-600">{formatNumber(metrics.avgActiveMeters)}</div>
          <div className="h-px bg-border my-2"></div>
          <p className="text-xs text-muted-foreground">Daily average</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Gauge className="h-4 w-4 text-amber-600" />
            Coverage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">{formatNumber(metrics.coveragePct, 1)}%</div>
          <div className="h-px bg-border my-2"></div>
          <p className="text-xs text-muted-foreground">
            Of {formatNumber(metrics.avgTotalMeters)} meters
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
