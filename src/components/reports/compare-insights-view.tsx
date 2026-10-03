"use client"

import { useMemo, useState } from "react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cellLossPct, formatAxisKwh, formatKwh, formatPct } from "@/components/reports/report-format"
import type { PurchasesSalesReport, RegionSeries } from "@/hooks/api/use-purchases-sales-report"

// Every tracked quantity in this report, in one place -- "every data point
// should have this ability [to be compared]" (the feature request this
// module exists for) means this list is the one spot a newly-tracked
// quantity needs to be added for both compare modes below to pick it up,
// same "one list, every consumer reads from it" shape as
// ea-bknd-3/internal/salessummary's sourcesFor.
type SeriesKey = "purchasesKwh" | "salesKwh" | "postpaidKwh" | "prepaidKwh" | "streetlightingKwh" | "lossPct"

const SERIES_OPTIONS: { key: SeriesKey; label: string; color: string; isPct?: boolean }[] = [
  { key: "purchasesKwh", label: "Purchases", color: "#1d4ed8" },
  { key: "salesKwh", label: "Sales (all)", color: "#059669" },
  { key: "postpaidKwh", label: "Postpaid", color: "#2563eb" },
  { key: "prepaidKwh", label: "Prepaid", color: "#9333ea" },
  { key: "streetlightingKwh", label: "Streetlighting", color: "#ca8a04" },
  { key: "lossPct", label: "Loss %", color: "#dc2626", isPct: true },
]

// Cycled through for however many regions are picked in "Regions" mode --
// deliberately not reusing any single source's brand color (blue/emerald/
// purple/amber/...) since a region here can hold a mix of every source.
const REGION_LINE_COLORS = [
  "#1d4ed8", "#059669", "#ca8a04", "#9333ea", "#dc2626", "#0891b2", "#db2777", "#65a30d",
]

interface CompareInsightsViewProps {
  report: PurchasesSalesReport
  monthKeys: string[]
}

/**
 * A standalone comparison module, independent of the page's own region/
 * district filter above -- "every data point should have the ability to
 * be looked at together in a comparative and time-bound nature, either
 * standalone or mashed up" (the literal feature request). Two modes:
 *
 *  - "Series over time": pick any combination of tracked quantities
 *    (Purchases/Sales/Postpaid/Prepaid/Streetlighting/Loss%) and see them
 *    overlaid on one national trend chart -- the "mashed up" case, and the
 *    one place Postpaid and Prepaid can be compared side by side (the main
 *    trend chart above only ever shows blended Sales).
 *  - "Regions over time": pick one quantity and compare it across any
 *    number of regions at once, each as its own line -- the "standalone"
 *    case (one data point, many contexts).
 */
export function CompareInsightsView({ report, monthKeys }: CompareInsightsViewProps) {
  const [mode, setMode] = useState<"series" | "regions">("series")

  // "Series over time" state -- defaults to the Postpaid/Prepaid/
  // Streetlighting split, since Purchases/Sales/Loss% already has its own
  // dedicated chart above and this is the one place the Sales breakdown
  // can be seen as a trend rather than just a window-total KPI/table cell.
  const [selectedSeries, setSelectedSeries] = useState<Set<SeriesKey>>(
    new Set<SeriesKey>(["postpaidKwh", "prepaidKwh", "streetlightingKwh"]),
  )
  const toggleSeries = (key: SeriesKey) => {
    setSelectedSeries((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // "Regions over time" state -- defaults to the top 3 regions by total
  // sales, so the chart isn't empty on first render.
  const topRegions = useMemo(
    () => [...report.regions].sort((a, b) => b.totalSalesKwh - a.totalSalesKwh).slice(0, 3),
    [report.regions],
  )
  const [selectedRegionKeys, setSelectedRegionKeys] = useState<Set<string>>(
    () => new Set(topRegions.map((r) => r.regionKey)),
  )
  const toggleRegionKey = (key: string) => {
    setSelectedRegionKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const [singleSeries, setSingleSeries] = useState<SeriesKey>("salesKwh")
  const singleSeriesOption = SERIES_OPTIONS.find((o) => o.key === singleSeries)!

  const seriesChartData = useMemo(
    () =>
      report.national.map((n) => {
        const row: Record<string, string | number | null> = { label: n.label }
        SERIES_OPTIONS.forEach((o) => {
          row[o.key] = n[o.key]
        })
        return row
      }),
    [report.national],
  )

  const selectedRegions: RegionSeries[] = useMemo(
    () => report.regions.filter((r) => selectedRegionKeys.has(r.regionKey)),
    [report.regions, selectedRegionKeys],
  )

  const regionsChartData = useMemo(
    () =>
      monthKeys.map((mKey, idx) => {
        const row: Record<string, string | number | null> = { label: report.monthLabels[idx] }
        selectedRegions.forEach((r) => {
          const cell = r.byMonth[mKey]
          row[r.regionKey] = singleSeries === "lossPct" ? cellLossPct(cell) : cell ? cell[singleSeries] : 0
        })
        return row
      }),
    [monthKeys, report.monthLabels, selectedRegions, singleSeries],
  )

  const anySeriesSelected = selectedSeries.size > 0
  const anyRegionsSelected = selectedRegions.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compare</CardTitle>
        <CardDescription>
          Any tracked quantity, overlaid over time -- standalone (one quantity, many regions) or mashed up
          (several quantities, one national trend). Independent of the region/district filter above.
        </CardDescription>
        <div className="pt-2">
          <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v as "series" | "regions")} variant="outline">
            <ToggleGroupItem value="series">Series over time</ToggleGroupItem>
            <ToggleGroupItem value="regions">Regions over time</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {mode === "series" ? (
          <>
            <div className="flex items-center gap-5 flex-wrap">
              {SERIES_OPTIONS.map((o) => (
                <label key={o.key} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <Checkbox checked={selectedSeries.has(o.key)} onCheckedChange={() => toggleSeries(o.key)} />
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: o.color }} />
                  {o.label}
                </label>
              ))}
            </div>
            {!anySeriesSelected ? (
              <p className="text-sm text-muted-foreground py-24 text-center">
                Nothing selected — check a box above to show a series.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={seriesChartData} margin={{ top: 10, right: 8, left: 8, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  {[...selectedSeries].some((k) => k !== "lossPct") && (
                    <YAxis
                      yAxisId="kwh"
                      tickFormatter={formatAxisKwh}
                      tick={{ fontSize: 11 }}
                      label={{ value: "kWh", angle: -90, position: "insideLeft", style: { fontSize: 11 } }}
                    />
                  )}
                  {selectedSeries.has("lossPct") && (
                    <YAxis
                      yAxisId="pct"
                      orientation="right"
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 11 }}
                      label={{ value: "Loss %", angle: 90, position: "insideRight", style: { fontSize: 11 } }}
                    />
                  )}
                  <Tooltip
                    formatter={(v, name) => {
                      const opt = SERIES_OPTIONS.find((o) => o.label === name)
                      if (opt?.isPct) return [formatPct(typeof v === "number" ? v : null), name]
                      return [formatKwh(typeof v === "number" ? v : 0), name]
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {SERIES_OPTIONS.filter((o) => selectedSeries.has(o.key)).map((o) => (
                    <Line
                      key={o.key}
                      yAxisId={o.isPct ? "pct" : "kwh"}
                      type="monotone"
                      dataKey={o.key}
                      name={o.label}
                      stroke={o.color}
                      strokeWidth={2}
                      dot={{ r: 3, fill: o.color }}
                      isAnimationActive={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={singleSeries} onValueChange={(v) => setSingleSeries(v as SeriesKey)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERIES_OPTIONS.map((o) => (
                    <SelectItem key={o.key} value={o.key}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">across</span>
            </div>
            <div className="flex items-center gap-4 flex-wrap max-h-28 overflow-y-auto">
              {report.regions.map((r, idx) => (
                <label key={r.regionKey} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <Checkbox checked={selectedRegionKeys.has(r.regionKey)} onCheckedChange={() => toggleRegionKey(r.regionKey)} />
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: REGION_LINE_COLORS[idx % REGION_LINE_COLORS.length] }}
                  />
                  {r.region}
                </label>
              ))}
            </div>
            {!anyRegionsSelected ? (
              <p className="text-sm text-muted-foreground py-24 text-center">
                Nothing selected — check a region above to show its trend.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={regionsChartData} margin={{ top: 10, right: 8, left: 8, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={singleSeriesOption.isPct ? (v) => `${v}%` : formatAxisKwh}
                    tick={{ fontSize: 11 }}
                    label={{
                      value: singleSeriesOption.isPct ? "%" : "kWh",
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 11 },
                    }}
                  />
                  <Tooltip
                    formatter={(v, name) =>
                      singleSeriesOption.isPct
                        ? [formatPct(typeof v === "number" ? v : null), name]
                        : [formatKwh(typeof v === "number" ? v : 0), name]
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {selectedRegions.map((r) => (
                    <Line
                      key={r.regionKey}
                      type="monotone"
                      dataKey={r.regionKey}
                      name={r.region}
                      stroke={REGION_LINE_COLORS[report.regions.findIndex((x) => x.regionKey === r.regionKey) % REGION_LINE_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      isAnimationActive={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
