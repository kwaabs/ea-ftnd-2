"use client"

import { Fragment, useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Minus,
  Scale,
  TrendingDown,
  Zap,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  currentMonthPoint,
  trailingMonths,
  usePurchasesSalesReport,
  type RegionSeries,
} from "@/hooks/api/use-purchases-sales-report"

function formatKwh(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000)
    return `${(value / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GWh`
  if (abs >= 1_000)
    return `${(value / 1_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MWh`
  return `${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh`
}

function formatPct(value: number | null): string {
  if (value === null) return "—"
  return `${value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

function formatAxisKwh(v: number): string {
  return Math.abs(v) >= 1_000_000
    ? `${(v / 1_000_000).toFixed(0)}M`
    : Math.abs(v) >= 1_000
      ? `${(v / 1_000).toFixed(0)}k`
      : String(v)
}

/** Severity relative to the network's own average loss % this period, not an
 * asserted industry-standard threshold — a region well above the network's
 * own average is the meaningful "worse than normal for this data" signal. */
function lossSeverityClass(lossPct: number | null, nationalAvgPct: number | null): string {
  if (lossPct === null) return "text-muted-foreground"
  if (nationalAvgPct === null || nationalAvgPct <= 0) return "text-foreground"
  if (lossPct > nationalAvgPct * 1.25) return "text-red-700 font-semibold"
  if (lossPct > nationalAvgPct * 0.9) return "text-amber-700 font-medium"
  return "text-emerald-700"
}

const WINDOW_OPTIONS = [
  { value: "6", label: "Last 6 months" },
  { value: "12", label: "Last 12 months" },
  { value: "24", label: "Last 24 months" },
]

/**
 * Purchases (BSP incomer imports) vs Sales (Zeus + MMS + Legacy, blended)
 * per region, monthly. Tells a story rather than just listing numbers: a
 * national headline, a region ranking (worst loss % first), a monthly
 * trend, and any sales-exceed-purchases anomalies (a data-quality flag,
 * not a real negative loss).
 *
 * Runs its own month-granularity window control, independent of the app's
 * global day-precision date filter -- a purchases-vs-sales story is
 * inherently month-bucketed (every source's own time dimension here is
 * month-grained, not daily), so a day-precision range picker doesn't fit
 * this page the way it does elsewhere.
 */
export function PurchasesSalesReportView() {
  const [windowMonths, setWindowMonths] = useState(12)
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set())
  const toggleRegion = (regionKey: string) => {
    setExpandedRegions((prev) => {
      const next = new Set(prev)
      if (next.has(regionKey)) next.delete(regionKey)
      else next.add(regionKey)
      return next
    })
  }
  const months = useMemo(() => trailingMonths(currentMonthPoint(), windowMonths), [windowMonths])
  const report = usePurchasesSalesReport(months)

  const chartData = report.national.map((n) => ({
    label: n.label,
    purchasesKwh: n.purchasesKwh,
    salesKwh: n.salesKwh,
    lossPct: n.lossPct,
  }))

  // Narrative: compare the first vs second half of the window's average
  // loss %, to say whether the network is trending better or worse, not
  // just what the current snapshot is.
  const narrative = useMemo(() => {
    const withLoss = report.national.filter((n) => n.lossPct !== null)
    if (withLoss.length < 2) return null
    const mid = Math.floor(withLoss.length / 2)
    const firstHalf = withLoss.slice(0, mid)
    const secondHalf = withLoss.slice(mid)
    const avg = (rows: typeof withLoss) => rows.reduce((s, r) => s + (r.lossPct || 0), 0) / rows.length
    const firstAvg = avg(firstHalf)
    const secondAvg = avg(secondHalf)
    const delta = secondAvg - firstAvg
    const worst = report.regions[0]
    const best = [...report.regions].reverse().find((r) => r.lossPct !== null)
    return { firstAvg, secondAvg, delta, worst, best }
  }, [report.national, report.regions])

  const nationalAvgLossPct = report.nationalTotals.lossPct

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">Reports</h2>
          <p className="text-muted-foreground mt-1">
            Purchases (BSP incomer imports) vs Sales (Zeus + MMS + Legacy) by region, monthly
          </p>
        </div>
        <Select value={String(windowMonths)} onValueChange={(v) => setWindowMonths(Number(v))}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WINDOW_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {report.isError && (
        <p className="text-sm text-red-600">
          Failed to load: {report.erroredSources.join(", ")} — figures below may be incomplete for that source.
          This usually means that source&apos;s query timed out; try a shorter window.
        </p>
      )}

      {/* National headline */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-2 border-blue-200 bg-blue-50/40">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-600" />
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Purchases</CardTitle>
            </div>
            <CardDescription className="text-[11px]">BSP incomer imports (net)</CardDescription>
          </CardHeader>
          <CardContent>
            {report.isLoading ? (
              <Skeleton className="h-9 w-40" />
            ) : (
              <div className="text-3xl font-bold text-blue-700">{formatKwh(report.nationalTotals.purchasesKwh)}</div>
            )}
          </CardContent>
        </Card>
        <Card className="border-2 border-emerald-200 bg-emerald-50/40">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-600" />
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Sales</CardTitle>
            </div>
            <CardDescription className="text-[11px]">Postpaid + Prepaid, all sources</CardDescription>
          </CardHeader>
          <CardContent>
            {report.isLoading ? (
              <Skeleton className="h-9 w-40" />
            ) : (
              <div className="text-3xl font-bold text-emerald-700">{formatKwh(report.nationalTotals.salesKwh)}</div>
            )}
          </CardContent>
        </Card>
        <Card className="border-2 border-rose-200 bg-rose-50/40">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-rose-600" />
              <CardTitle className="text-sm font-medium text-muted-foreground">Losses</CardTitle>
            </div>
            <CardDescription className="text-[11px]">Purchases − Sales</CardDescription>
          </CardHeader>
          <CardContent>
            {report.isLoading ? (
              <Skeleton className="h-9 w-40" />
            ) : (
              <>
                <div className="text-3xl font-bold text-rose-700">{formatKwh(report.nationalTotals.lossKwh)}</div>
                <div className="text-sm text-rose-600 mt-1">{formatPct(nationalAvgLossPct)} of purchases</div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Narrative */}
      {!report.isLoading && narrative && (
        <Card className="border-dashed">
          <CardContent className="pt-5 flex items-start gap-3">
            {narrative.delta > 0.5 ? (
              <ArrowUp className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            ) : narrative.delta < -0.5 ? (
              <ArrowDown className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <Minus className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            )}
            <p className="text-sm text-foreground">
              Network-wide losses averaged {formatPct(narrative.firstAvg)} in the first half of this window and{" "}
              {formatPct(narrative.secondAvg)} in the second half —{" "}
              <span className="font-semibold">
                {narrative.delta > 0.5
                  ? `up ${Math.abs(narrative.delta).toFixed(1)} points`
                  : narrative.delta < -0.5
                    ? `down ${Math.abs(narrative.delta).toFixed(1)} points`
                    : "essentially flat"}
              </span>
              . {narrative.worst && (
                <>
                  <span className="font-semibold">{narrative.worst.region}</span> has the highest loss rate over
                  this window at {formatPct(narrative.worst.lossPct)}
                  {narrative.best && narrative.best.regionKey !== narrative.worst.regionKey && (
                    <>
                      , while <span className="font-semibold">{narrative.best.region}</span> is tightest at{" "}
                      {formatPct(narrative.best.lossPct)}
                    </>
                  )}
                  .
                </>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Anomalies */}
      {!report.isLoading && report.anomalies.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/40">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <CardTitle className="text-sm font-medium text-amber-900">
                {report.anomalies.length} region-month{report.anomalies.length === 1 ? "" : "s"} sold more than
                purchased
              </CardTitle>
            </div>
            <CardDescription className="text-[11px] text-amber-800">
              A region can&apos;t sell more than it bought — this points at a data or timing mismatch between
              sources for that period, not a real negative loss.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-amber-900 space-y-1">
            {report.anomalies.slice(0, 8).map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <span>
                  {a.region} · {a.label}
                </span>
                <span className="font-mono">
                  purchased {formatKwh(a.purchasesKwh)}, sold {formatKwh(a.salesKwh)}
                </span>
              </div>
            ))}
            {report.anomalies.length > 8 && (
              <p className="text-muted-foreground pt-1">…and {report.anomalies.length - 8} more.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Monthly trend */}
      <Card>
        <CardHeader>
          <CardTitle>Purchases vs Sales — monthly trend</CardTitle>
          <CardDescription>National totals across the selected window</CardDescription>
        </CardHeader>
        <CardContent>
          {report.isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 10, right: 8, left: 8, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={formatAxisKwh} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number, name: string) => [formatKwh(v), name]} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="purchasesKwh"
                  name="Purchases"
                  stroke="#1d4ed8"
                  fill="#1d4ed8"
                  fillOpacity={0.15}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="salesKwh"
                  name="Sales"
                  stroke="#059669"
                  fill="#059669"
                  fillOpacity={0.15}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Loss % trend */}
      <Card>
        <CardHeader>
          <CardTitle>Network loss % — monthly trend</CardTitle>
          <CardDescription>(Purchases − Sales) ÷ Purchases, nationally, per month</CardDescription>
        </CardHeader>
        <CardContent>
          {report.isLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 10, right: 8, left: 8, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v) => [formatPct(typeof v === "number" ? v : null), "Loss %"]}
                />
                <Line
                  type="monotone"
                  dataKey="lossPct"
                  name="Loss %"
                  stroke="#dc2626"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#dc2626" }}
                  isAnimationActive={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Region ranking */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Region ranking — highest loss % first</CardTitle>
          </div>
          <CardDescription>Totals across the selected window</CardDescription>
        </CardHeader>
        <CardContent>
          {report.isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : report.regions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No data for this window.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Region</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">Purchases</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">Sales</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">Loss</th>
                    <th className="text-right py-2 pl-4 font-medium text-muted-foreground">Loss %</th>
                  </tr>
                </thead>
                <tbody>
                  {report.regions.map((r: RegionSeries) => {
                    const isExpanded = expandedRegions.has(r.regionKey)
                    return (
                      <Fragment key={r.regionKey}>
                        <tr
                          className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                          onClick={() => toggleRegion(r.regionKey)}
                        >
                          <td className="py-2.5 pr-4 font-medium">
                            <span className="inline-flex items-center gap-1.5">
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              )}
                              {r.region}
                              <span className="text-xs text-muted-foreground font-normal">
                                ({r.districts.length} district{r.districts.length === 1 ? "" : "s"})
                              </span>
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-blue-700">
                            {formatKwh(r.totalPurchasesKwh)}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-emerald-700">
                            {formatKwh(r.totalSalesKwh)}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums">{formatKwh(r.lossKwh)}</td>
                          <td className="py-2.5 pl-4 text-right tabular-nums">
                            <Badge
                              variant="outline"
                              className={`text-xs font-normal border-0 bg-transparent ${lossSeverityClass(r.lossPct, nationalAvgLossPct)}`}
                            >
                              {formatPct(r.lossPct)}
                            </Badge>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b last:border-0 bg-muted/20">
                            <td colSpan={5} className="py-2 pl-8 pr-4">
                              {r.districts.length === 0 ? (
                                <p className="text-xs text-muted-foreground py-2">
                                  No district-level data for this region.
                                </p>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-dashed">
                                      <th className="text-left py-1.5 pr-4 font-medium text-muted-foreground">
                                        District
                                      </th>
                                      <th className="text-right py-1.5 px-4 font-medium text-muted-foreground">
                                        Purchases
                                      </th>
                                      <th className="text-right py-1.5 px-4 font-medium text-muted-foreground">
                                        Sales
                                      </th>
                                      <th className="text-right py-1.5 px-4 font-medium text-muted-foreground">
                                        Loss
                                      </th>
                                      <th className="text-right py-1.5 pl-4 font-medium text-muted-foreground">
                                        Loss %
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r.districts.map((d) => (
                                      <tr key={d.districtKey} className="border-b border-dashed last:border-0">
                                        <td className="py-1.5 pr-4">{d.district}</td>
                                        <td className="py-1.5 px-4 text-right tabular-nums text-blue-700">
                                          {formatKwh(d.totalPurchasesKwh)}
                                        </td>
                                        <td className="py-1.5 px-4 text-right tabular-nums text-emerald-700">
                                          {formatKwh(d.totalSalesKwh)}
                                        </td>
                                        <td className="py-1.5 px-4 text-right tabular-nums">
                                          {formatKwh(d.lossKwh)}
                                        </td>
                                        <td className="py-1.5 pl-4 text-right tabular-nums">
                                          <Badge
                                            variant="outline"
                                            className={`text-xs font-normal border-0 bg-transparent ${lossSeverityClass(d.lossPct, nationalAvgLossPct)}`}
                                          >
                                            {formatPct(d.lossPct)}
                                          </Badge>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
