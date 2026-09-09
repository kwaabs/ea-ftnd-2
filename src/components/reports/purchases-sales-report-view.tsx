"use client"

import { Fragment, useMemo, useState } from "react"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
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
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  currentMonthPoint,
  monthKey,
  monthLabel,
  monthsInRange,
  parseMonthInputValue,
  trailingMonths,
  usePurchasesSalesReport,
  type RegionSeries,
} from "@/hooks/api/use-purchases-sales-report"
import {
  cellLossPct,
  formatAxisKwh,
  formatKwh,
  formatPct,
  lossHeatRgb,
  lossSeverityClass,
  readableTextOn,
  regionTrendDelta,
  rgbToCss,
} from "@/components/reports/report-format"
import { PurchasesSalesLossMap } from "@/components/reports/purchases-sales-loss-map"

const MAX_WINDOW_MONTHS = 12

type PeriodMode = "3" | "6" | "12" | "year" | "custom"

const PERIOD_MODE_OPTIONS: { value: PeriodMode; label: string }[] = [
  { value: "3", label: "Last 3 months" },
  { value: "6", label: "Last 6 months" },
  { value: "12", label: "Last 12 months" },
  { value: "year", label: "Current year" },
  { value: "custom", label: "Custom range" },
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
  const now = currentMonthPoint()
  const [periodMode, setPeriodMode] = useState<PeriodMode>("3")
  // Defaults for the custom-range inputs: last 12 months, so switching into
  // "Custom range" starts from something sane rather than two empty fields.
  const [customFrom, setCustomFrom] = useState(monthKey(trailingMonths(now, MAX_WINDOW_MONTHS)[0]))
  const [customTo, setCustomTo] = useState(monthKey(now))
  // Combined trend chart's per-series visibility -- Purchases/Sales share
  // the left (kWh) axis, Loss % gets its own right (%) axis, since the two
  // are on completely different scales (hundreds of millions vs a
  // percentage) and forcing them onto one axis would flatten whichever one
  // lost the scale fight.
  const [showPurchases, setShowPurchases] = useState(true)
  const [showSales, setShowSales] = useState(true)
  const [showLossPct, setShowLossPct] = useState(true)
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set())
  const toggleRegion = (regionKey: string) => {
    setExpandedRegions((prev) => {
      const next = new Set(prev)
      if (next.has(regionKey)) next.delete(regionKey)
      else next.add(regionKey)
      return next
    })
  }
  // Shared with the loss map below -- clicking a region there or a row in
  // the ranking table highlights the same selection in both, rather than
  // being two disconnected views of the same data.
  const [focusedRegionKey, setFocusedRegionKey] = useState<string | null>(null)

  // Custom range is clamped, not rejected: picking a span over 12 months
  // keeps the most recent 12 of whatever was selected rather than blocking
  // submission or silently overwriting what the user typed into the
  // inputs. customRangeClampedFrom is only set (and shown) when a clamp
  // actually happened.
  const customRange = useMemo(() => {
    const from = parseMonthInputValue(customFrom)
    const to = parseMonthInputValue(customTo)
    if (!from || !to) return { months: trailingMonths(now, MAX_WINDOW_MONTHS), clamped: false }
    const full = monthsInRange(from, to)
    if (full.length <= MAX_WINDOW_MONTHS) return { months: full, clamped: false }
    return { months: full.slice(full.length - MAX_WINDOW_MONTHS), clamped: true }
  }, [customFrom, customTo, now])

  const months = useMemo(() => {
    if (periodMode === "custom") return customRange.months
    if (periodMode === "year") return monthsInRange({ year: now.year, month: 1 }, now)
    return trailingMonths(now, Number(periodMode))
  }, [periodMode, customRange, now])

  const report = usePurchasesSalesReport(months)

  const chartData = report.national.map((n) => ({
    label: n.label,
    purchasesKwh: n.purchasesKwh,
    salesKwh: n.salesKwh,
    lossPct: n.lossPct,
  }))
  const monthKeys = report.months.map((m) => monthKey(m))

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
        <div className="flex items-start gap-2 flex-wrap">
          <Select value={periodMode} onValueChange={(v) => setPeriodMode(v as PeriodMode)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_MODE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {periodMode === "custom" && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Input
                  type="month"
                  value={customFrom}
                  max={monthKey(now)}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-[150px]"
                />
                <span className="text-sm text-muted-foreground">to</span>
                <Input
                  type="month"
                  value={customTo}
                  max={monthKey(now)}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-[150px]"
                />
              </div>
              {customRange.clamped && (
                <p className="text-xs text-amber-700">
                  Capped at {MAX_WINDOW_MONTHS} months — showing {monthLabel(customRange.months[0])} to{" "}
                  {monthLabel(customRange.months[customRange.months.length - 1])}.
                </p>
              )}
            </div>
          )}
        </div>
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

      {/* Monthly trend — Purchases + Sales (left axis, kWh) and Loss %
          (right axis, %) combined into one chart, each series toggleable
          via the checkboxes instead of split across two charts. */}
      <Card>
        <CardHeader>
          <CardTitle>Purchases vs Sales vs Loss % — monthly trend</CardTitle>
          <CardDescription>National totals across the selected window</CardDescription>
          <div className="flex items-center gap-5 pt-2 flex-wrap">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <Checkbox
                checked={showPurchases}
                onCheckedChange={(v) => setShowPurchases(v === true)}
              />
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#1d4ed8" }} />
              Purchases
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <Checkbox checked={showSales} onCheckedChange={(v) => setShowSales(v === true)} />
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#059669" }} />
              Sales
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <Checkbox checked={showLossPct} onCheckedChange={(v) => setShowLossPct(v === true)} />
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#dc2626" }} />
              Loss %
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {report.isLoading ? (
            <Skeleton className="h-[320px] w-full" />
          ) : !showPurchases && !showSales && !showLossPct ? (
            <p className="text-sm text-muted-foreground py-24 text-center">
              Nothing selected — check a box above to show a series.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 8, left: 8, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                {(showPurchases || showSales) && (
                  <YAxis
                    yAxisId="kwh"
                    tickFormatter={formatAxisKwh}
                    tick={{ fontSize: 11 }}
                    label={{ value: "kWh", angle: -90, position: "insideLeft", style: { fontSize: 11 } }}
                  />
                )}
                {showLossPct && (
                  <YAxis
                    yAxisId="pct"
                    orientation="right"
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 11 }}
                    label={{ value: "Loss %", angle: 90, position: "insideRight", style: { fontSize: 11 } }}
                  />
                )}
                <Tooltip
                  formatter={(v, name) =>
                    name === "Loss %"
                      ? [formatPct(typeof v === "number" ? v : null), name]
                      : [formatKwh(typeof v === "number" ? v : 0), name]
                  }
                />
                {showPurchases && (
                  <Area
                    yAxisId="kwh"
                    type="monotone"
                    dataKey="purchasesKwh"
                    name="Purchases"
                    stroke="#1d4ed8"
                    fill="#1d4ed8"
                    fillOpacity={0.15}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                )}
                {showSales && (
                  <Area
                    yAxisId="kwh"
                    type="monotone"
                    dataKey="salesKwh"
                    name="Sales"
                    stroke="#059669"
                    fill="#059669"
                    fillOpacity={0.15}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                )}
                {showLossPct && (
                  <Line
                    yAxisId="pct"
                    type="monotone"
                    dataKey="lossPct"
                    name="Loss %"
                    stroke="#dc2626"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#dc2626" }}
                    isAnimationActive={false}
                    connectNulls
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Loss % heat map — region x month */}
      <Card>
        <CardHeader>
          <CardTitle>Loss % heat map — region × month</CardTitle>
          <CardDescription>
            Each cell colored relative to that month&apos;s own network average — deep green is well below
            average (tight), deep red is well above (leaking), gray is no purchases data that month.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {report.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : report.regions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No data for this window.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-sm border-separate" style={{ borderSpacing: 2 }}>
                <thead>
                  <tr>
                    <th className="text-left py-1 pr-3 font-medium text-muted-foreground sticky left-0 bg-card">
                      Region
                    </th>
                    {report.monthLabels.map((label) => (
                      <th
                        key={label}
                        className="text-center px-1 pb-1 font-medium text-muted-foreground whitespace-nowrap text-xs"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.regions.map((r) => (
                    <tr key={r.regionKey}>
                      <td className="text-left pr-3 font-medium whitespace-nowrap sticky left-0 bg-card">
                        {r.region}
                      </td>
                      {monthKeys.map((mKey, idx) => {
                        const lossPct = cellLossPct(r.byMonth[mKey])
                        const monthAvg = report.national[idx]?.lossPct ?? null
                        const rgb = lossHeatRgb(lossPct, monthAvg)
                        const cell = r.byMonth[mKey]
                        const textColor = readableTextOn(rgb)
                        return (
                          <td
                            key={mKey}
                            className="text-center rounded align-middle px-1.5 py-1.5"
                            style={{ backgroundColor: rgbToCss(rgb), color: textColor, minWidth: 92 }}
                            title={
                              cell
                                ? `${r.region}, ${report.monthLabels[idx]}: purchased ${formatKwh(cell.purchasesKwh)}, sold ${formatKwh(cell.salesKwh)}, loss ${formatKwh(cell.purchasesKwh - cell.salesKwh)}`
                                : `${r.region}, ${report.monthLabels[idx]}: no purchases data`
                            }
                          >
                            {cell ? (
                              <>
                                <div className="text-sm font-bold tabular-nums leading-tight">
                                  {formatPct(lossPct)}
                                </div>
                                <div
                                  className="text-[10px] leading-tight tabular-nums opacity-90"
                                  style={{ color: textColor }}
                                >
                                  P {formatAxisKwh(cell.purchasesKwh)} · S {formatAxisKwh(cell.salesKwh)}
                                </div>
                              </>
                            ) : (
                              <div className="text-xs font-medium">—</div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loss map */}
      {!report.isLoading && report.regions.length > 0 && (
        <PurchasesSalesLossMap
          regions={report.regions}
          nationalAvgLossPct={nationalAvgLossPct}
          monthKeys={monthKeys}
          focusedRegionKey={focusedRegionKey}
          onFocusRegion={setFocusedRegionKey}
        />
      )}

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
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">Loss %</th>
                    <th className="text-center py-2 pl-4 font-medium text-muted-foreground" title="First half vs second half of the window's average loss %">
                      Trend
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.regions.map((r: RegionSeries) => {
                    const isExpanded = expandedRegions.has(r.regionKey)
                    const trend = regionTrendDelta(r.byMonth, monthKeys)
                    const isFocused = r.regionKey === focusedRegionKey
                    return (
                      <Fragment key={r.regionKey}>
                        <tr
                          className={`border-b last:border-0 hover:bg-muted/40 cursor-pointer ${isFocused ? "bg-blue-50/70" : ""}`}
                          onClick={() => {
                            toggleRegion(r.regionKey)
                            setFocusedRegionKey((prev) => (prev === r.regionKey ? null : r.regionKey))
                          }}
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
                          <td className="py-2.5 px-4 text-right tabular-nums">
                            <Badge
                              variant="outline"
                              className={`text-xs font-normal border-0 bg-transparent ${lossSeverityClass(r.lossPct, nationalAvgLossPct)}`}
                            >
                              {formatPct(r.lossPct)}
                            </Badge>
                          </td>
                          <td className="py-2.5 pl-4 text-center">
                            {trend === null ? (
                              <Minus className="h-3.5 w-3.5 text-muted-foreground inline-block" />
                            ) : trend > 0.5 ? (
                              <span
                                className="inline-flex items-center gap-0.5 text-red-700"
                                title={`Loss % worsened ${trend.toFixed(1)} points, first half vs second half of this window`}
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                                <span className="text-xs tabular-nums">{trend.toFixed(1)}</span>
                              </span>
                            ) : trend < -0.5 ? (
                              <span
                                className="inline-flex items-center gap-0.5 text-emerald-700"
                                title={`Loss % improved ${Math.abs(trend).toFixed(1)} points, first half vs second half of this window`}
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                                <span className="text-xs tabular-nums">{Math.abs(trend).toFixed(1)}</span>
                              </span>
                            ) : (
                              <Minus
                                className="h-3.5 w-3.5 text-muted-foreground inline-block"
                                aria-label="Essentially flat"
                              />
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b last:border-0 bg-muted/20">
                            <td colSpan={6} className="py-2 pl-8 pr-4">
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
