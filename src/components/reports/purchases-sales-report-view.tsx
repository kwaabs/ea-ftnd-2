"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
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
  Pause,
  Play,
  Scale,
  TrendingDown,
  X,
  Zap,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import {
  currentMonthPoint,
  monthKey,
  monthLabel,
  monthsInRange,
  parseMonthInputValue,
  trailingMonths,
  usePurchasesSalesReport,
  type RegionMonthCell,
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

function mixRgb(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}
function rgbToCss([r, g, b]: [number, number, number]): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
}

// Continuous green -> amber -> red ramp for the heat map below, same
// relative-to-that-month's-own-network-average idea as lossSeverityClass
// (not an asserted absolute threshold) but as a real color gradient
// instead of 3 discrete bands, since a heat map's whole point is showing
// gradation, not just above/below a line. Returns RGB (not a CSS string)
// so the same value can drive both the cell background and its text-color
// contrast decision below without re-parsing a string.
function lossHeatRgb(lossPct: number | null, monthAvgPct: number | null): [number, number, number] {
  const NO_DATA: [number, number, number] = [241, 245, 249] // slate-100
  const GREEN: [number, number, number] = [5, 150, 105] // emerald-600
  const AMBER: [number, number, number] = [245, 158, 11] // amber-500
  const RED: [number, number, number] = [185, 28, 28] // red-700
  if (lossPct === null) return NO_DATA
  if (monthAvgPct === null || monthAvgPct <= 0) return AMBER
  const ratio = lossPct / monthAvgPct // 1.0 = exactly average that month
  if (ratio <= 1) return mixRgb(GREEN, AMBER, Math.max(0, Math.min(1, ratio)))
  return mixRgb(AMBER, RED, Math.max(0, Math.min(1, ratio - 1)))
}

/** Readable text color (near-black vs near-white) against a given heat
 * cell background, so percentage labels stay legible across the whole
 * green-to-red range instead of assuming one fixed text color works
 * everywhere. */
function readableTextOn([r, g, b]: [number, number, number]): string {
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? "#1e293b" : "#ffffff"
}

/** Loss % for a single region-month cell — shared by the heat map and the
 * per-region trend indicator so the formula can't drift between them. */
function cellLossPct(cell: RegionMonthCell | undefined): number | null {
  if (!cell || cell.purchasesKwh <= 0) return null
  return ((cell.purchasesKwh - cell.salesKwh) / cell.purchasesKwh) * 100
}

/** First-half vs second-half average loss % for one region across the
 * selected window — the same "is this getting better or worse" question
 * the page's national narrative already answers, just per region so the
 * ranking table can show it inline instead of making you read the
 * headline sentence for the network as a whole and guess whether it
 * applies to the region you're actually looking at. */
function regionTrendDelta(byMonth: Record<string, RegionMonthCell>, monthKeys: string[]): number | null {
  const withLoss = monthKeys.map((k) => cellLossPct(byMonth[k])).filter((v): v is number => v !== null)
  if (withLoss.length < 2) return null
  const mid = Math.floor(withLoss.length / 2)
  const avg = (vals: number[]) => vals.reduce((s, v) => s + v, 0) / vals.length
  return avg(withLoss.slice(mid)) - avg(withLoss.slice(0, mid))
}

/** Worst (highest) loss % first — same convention the hook's own region
 * sort uses, duplicated here (not imported) since it's only needed when
 * re-sorting for a single spotlighted month, which the hook itself has no
 * reason to know about. */
function byWorstLoss<T extends { lossPct: number | null }>(a: T, b: T): number {
  if (a.lossPct === null && b.lossPct === null) return 0
  if (a.lossPct === null) return 1
  if (b.lossPct === null) return -1
  return b.lossPct - a.lossPct
}

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
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set())
  const toggleRegion = (regionKey: string) => {
    setExpandedRegions((prev) => {
      const next = new Set(prev)
      if (next.has(regionKey)) next.delete(regionKey)
      else next.add(regionKey)
      return next
    })
  }

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

  // Spotlight: scrubbing/playing through the window swaps the headline,
  // heat map column highlight, and region ranking from "totals across the
  // whole window" to "this one month" -- the thing that actually makes
  // this feel like watching a story unfold instead of reading one
  // aggregated snapshot. null = back to the whole-window view.
  const [spotlightIndex, setSpotlightIndex] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    if (!isPlaying || monthKeys.length === 0) return
    const id = setInterval(() => {
      setSpotlightIndex((prev) => {
        const next = (prev === null ? -1 : prev) + 1
        if (next >= monthKeys.length) {
          setIsPlaying(false)
          return prev
        }
        return next
      })
    }, 1400)
    return () => clearInterval(id)
  }, [isPlaying, monthKeys.length])

  const spotlightMonthKey = spotlightIndex !== null ? monthKeys[spotlightIndex] : null
  const spotlightNational = spotlightIndex !== null ? report.national[spotlightIndex] : null

  // Region ranking re-sorted and re-valued for the spotlighted month when
  // one is active -- whole-window totals (report.regions, already sorted)
  // otherwise. District drill-down still shows whole-window district
  // totals even while spotlighting a month (kept simple deliberately --
  // the spotlight's job is the region-level story, not a third level of
  // per-month-per-district recomputation).
  const rankingRows =
    spotlightMonthKey === null
      ? report.regions
      : [...report.regions]
          .map((r) => {
            const c = r.byMonth[spotlightMonthKey]
            const purchasesKwh = c?.purchasesKwh ?? 0
            const salesKwh = c?.salesKwh ?? 0
            const lossKwh = purchasesKwh - salesKwh
            const lossPct = purchasesKwh > 0 ? (lossKwh / purchasesKwh) * 100 : null
            return { ...r, totalPurchasesKwh: purchasesKwh, totalSalesKwh: salesKwh, lossKwh, lossPct }
          })
          .sort(byWorstLoss)

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

      {/* Month scrubber — drag, click a tick, or press Play to walk the
          window month by month; every card/chart below reacts live. */}
      {!report.isLoading && monthKeys.length > 1 && (
        <Card className="bg-gradient-to-r from-slate-50 to-slate-100/60 border-slate-200">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant={isPlaying ? "default" : "outline"}
                size="icon"
                className="shrink-0 rounded-full"
                onClick={() => {
                  if (isPlaying) {
                    setIsPlaying(false)
                    return
                  }
                  // Starting from the end (or with nothing spotlighted) restarts
                  // from month 0 rather than doing nothing / stepping past the end.
                  if (spotlightIndex === null || spotlightIndex >= monthKeys.length - 1) {
                    setSpotlightIndex(0)
                  }
                  setIsPlaying(true)
                }}
                title={isPlaying ? "Pause" : "Play through the window"}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
              </Button>
              <div className="flex-1 px-1">
                <Slider
                  value={[spotlightIndex ?? -1]}
                  min={-1}
                  max={monthKeys.length - 1}
                  step={1}
                  onValueChange={([v]) => {
                    setIsPlaying(false)
                    setSpotlightIndex(v < 0 ? null : v)
                  }}
                />
                <div className="flex justify-between mt-1.5 px-0.5">
                  {report.monthLabels.map((label, idx) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        setIsPlaying(false)
                        setSpotlightIndex(idx)
                      }}
                      className={`text-[10px] whitespace-nowrap ${
                        idx === spotlightIndex
                          ? "text-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {monthKeys.length > 8 ? label.split(" ")[0] : label}
                    </button>
                  ))}
                </div>
              </div>
              {spotlightIndex !== null && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 gap-1 text-xs text-muted-foreground"
                  onClick={() => {
                    setIsPlaying(false)
                    setSpotlightIndex(null)
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                  Show whole window
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {report.isError && (
        <p className="text-sm text-red-600">
          Failed to load: {report.erroredSources.join(", ")} — figures below may be incomplete for that source.
          This usually means that source&apos;s query timed out; try a shorter window.
        </p>
      )}

      {/* National headline — swaps to the spotlighted month's own figures
          when the scrubber is active, whole-window totals otherwise. */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={spotlightIndex !== null ? "h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" : ""} />
        Showing:{" "}
        <span className="font-semibold text-foreground">
          {spotlightIndex !== null
            ? report.monthLabels[spotlightIndex]
            : `whole window (${report.monthLabels[0]} – ${report.monthLabels[report.monthLabels.length - 1]})`}
        </span>
      </div>
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
              <div className="text-3xl font-bold text-blue-700 transition-all">
                {formatKwh(spotlightNational ? spotlightNational.purchasesKwh : report.nationalTotals.purchasesKwh)}
              </div>
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
              <div className="text-3xl font-bold text-emerald-700 transition-all">
                {formatKwh(spotlightNational ? spotlightNational.salesKwh : report.nationalTotals.salesKwh)}
              </div>
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
                <div className="text-3xl font-bold text-rose-700 transition-all">
                  {formatKwh(spotlightNational ? spotlightNational.lossKwh : report.nationalTotals.lossKwh)}
                </div>
                <div className="text-sm text-rose-600 mt-1">
                  {formatPct(spotlightNational ? spotlightNational.lossPct : nationalAvgLossPct)} of purchases
                </div>
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
                    {report.monthLabels.map((label, idx) => (
                      <th
                        key={label}
                        onClick={() => {
                          setIsPlaying(false)
                          setSpotlightIndex((prev) => (prev === idx ? null : idx))
                        }}
                        className={`text-center px-1 pb-1 font-medium whitespace-nowrap text-xs cursor-pointer ${
                          idx === spotlightIndex ? "text-foreground font-bold" : "text-muted-foreground"
                        }`}
                        title="Click to spotlight this month"
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
                        return (
                          <td
                            key={mKey}
                            onClick={() => {
                              setIsPlaying(false)
                              setSpotlightIndex((prev) => (prev === idx ? null : idx))
                            }}
                            className={`text-center text-xs font-medium tabular-nums rounded cursor-pointer transition-opacity ${
                              spotlightIndex !== null && idx !== spotlightIndex ? "opacity-40" : ""
                            }`}
                            style={{
                              backgroundColor: rgbToCss(rgb),
                              color: readableTextOn(rgb),
                              minWidth: 56,
                              height: 32,
                              outline: idx === spotlightIndex ? "2px solid #1e293b" : undefined,
                              outlineOffset: idx === spotlightIndex ? -2 : undefined,
                            }}
                            title={
                              cell
                                ? `${r.region}, ${report.monthLabels[idx]}: purchased ${formatKwh(cell.purchasesKwh)}, sold ${formatKwh(cell.salesKwh)}`
                                : `${r.region}, ${report.monthLabels[idx]}: no data`
                            }
                          >
                            {formatPct(lossPct)}
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

      {/* Region ranking */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Region ranking — highest loss % first</CardTitle>
          </div>
          <CardDescription>
            {spotlightIndex !== null
              ? `${report.monthLabels[spotlightIndex]} only — click the scrubber above or "Show whole window" to go back to totals`
              : "Totals across the selected window"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {report.isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rankingRows.length === 0 ? (
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
                  {rankingRows.map((r) => {
                    const isExpanded = expandedRegions.has(r.regionKey)
                    const trend = regionTrendDelta(r.byMonth, monthKeys)
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
