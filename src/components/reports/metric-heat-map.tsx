"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { NationalMonthPoint, RegionMonthCell, RegionSeries } from "@/hooks/api/use-purchases-sales-report"
import { formatAxisKwh, formatKwh, magnitudeHeatRgb, readableTextOn, rgbToCss } from "@/components/reports/report-format"

interface MetricHeatMapProps {
  title: string
  description: string
  hue: [number, number, number]
  isLoading: boolean
  regions: RegionSeries[]
  monthKeys: string[]
  monthLabels: string[]
  national: NationalMonthPoint[]
  cellValue: (cell: RegionMonthCell | undefined) => number
  regionTotal: (r: RegionSeries) => number
  nationalValue: (n: NationalMonthPoint | undefined) => number
  grandTotal: number
}

// Single-quantity heat map (Purchases / Prepaid / Postpaid / Streetlighting)
// -- a sibling to the Loss % heat map above, but sequential rather than
// diverging: there's no "good/bad" band for raw kWh, just how much, so the
// color ramp is one hue scaled by each cell's share of this table's own max
// (see magnitudeHeatRgb). Total row/column stay plain (no heat color) since
// a sum is never on the same scale as a single region-month cell -- coloring
// it against the same max would just paint every total the deepest shade.
export function MetricHeatMap({
  title,
  description,
  hue,
  isLoading,
  regions,
  monthKeys,
  monthLabels,
  national,
  cellValue,
  regionTotal,
  nationalValue,
  grandTotal,
}: MetricHeatMapProps) {
  const maxValue = regions.reduce((max, r) => {
    const rowMax = monthKeys.reduce((m, mKey) => Math.max(m, cellValue(r.byMonth[mKey])), 0)
    return Math.max(max, rowMax)
  }, 0)

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : regions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No data for this window.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-sm border-separate" style={{ borderSpacing: 2 }}>
              <thead>
                <tr>
                  <th className="text-left py-1 pr-3 font-medium text-muted-foreground sticky left-0 bg-card">
                    Region
                  </th>
                  {monthLabels.map((label) => (
                    <th
                      key={label}
                      className="text-center px-1 pb-1 font-medium text-muted-foreground whitespace-nowrap text-xs"
                    >
                      {label}
                    </th>
                  ))}
                  <th className="text-center px-1 pb-1 font-medium text-muted-foreground whitespace-nowrap text-xs border-l">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {regions.map((r) => (
                  <tr key={r.regionKey}>
                    <td className="text-left pr-3 font-medium whitespace-nowrap sticky left-0 bg-card">
                      {r.region}
                    </td>
                    {monthKeys.map((mKey, idx) => {
                      const value = cellValue(r.byMonth[mKey])
                      const rgb = magnitudeHeatRgb(value, maxValue, hue)
                      const textColor = readableTextOn(rgb)
                      return (
                        <td
                          key={mKey}
                          className="text-center rounded align-middle px-1.5 py-1.5"
                          style={{ backgroundColor: rgbToCss(rgb), color: textColor, minWidth: 92 }}
                          title={`${r.region}, ${monthLabels[idx]}: ${formatKwh(value)}`}
                        >
                          {value > 0 ? (
                            <div className="text-sm font-bold tabular-nums leading-tight">
                              {formatAxisKwh(value)}
                            </div>
                          ) : (
                            <div className="text-xs font-medium">—</div>
                          )}
                        </td>
                      )
                    })}
                    <td
                      className="text-center rounded align-middle px-1.5 py-1.5 border-l bg-muted/50"
                      title={`${r.region}, whole window: ${formatKwh(regionTotal(r))}`}
                    >
                      <div className="text-sm font-bold tabular-nums leading-tight">
                        {formatAxisKwh(regionTotal(r))}
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2">
                  <td className="text-left pr-3 font-semibold whitespace-nowrap sticky left-0 bg-card">Total</td>
                  {monthKeys.map((mKey, idx) => {
                    const value = nationalValue(national[idx])
                    return (
                      <td
                        key={`total-${mKey}`}
                        className="text-center rounded align-middle px-1.5 py-1.5 bg-muted/50"
                        title={`${monthLabels[idx]}, all regions: ${formatKwh(value)}`}
                      >
                        <div className="text-sm font-bold tabular-nums leading-tight">{formatAxisKwh(value)}</div>
                      </td>
                    )
                  })}
                  <td
                    className="text-center rounded align-middle px-1.5 py-1.5 border-l bg-muted"
                    title={`Whole window, all regions: ${formatKwh(grandTotal)}`}
                  >
                    <div className="text-sm font-bold tabular-nums leading-tight">{formatAxisKwh(grandTotal)}</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
