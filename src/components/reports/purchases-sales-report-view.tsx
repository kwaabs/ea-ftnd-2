"use client"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
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
  ArrowRight,
  ChevronLeft,
  Minus,
  Scale,
  TrendingDown,
  Wifi,
  Zap,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
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
  METRIC_HEAT_HUES,
  readableTextOn,
  regionTrendDelta,
  rgbToCss,
} from "@/components/reports/report-format"
import { PurchasesSalesLossMap } from "@/components/reports/purchases-sales-loss-map"
import { CompareInsightsView } from "@/components/reports/compare-insights-view"
import { MetricHeatMap } from "@/components/reports/metric-heat-map"
import { GenerateReportDialog } from "@/components/reports/generate-report-dialog"
import { useMeterStatusSummary, useMeterStatusDetails } from "@/hooks/api/use-meter-status-api"
import { formatApiDate } from "@/lib/utils"

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
  const router = useRouter()
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
  // Streetlighting (Zeus tariffclasscode E03) is its own toggle, not part
  // of Sales -- same Category split as everywhere else in this app.
  const [showStreetlighting, setShowStreetlighting] = useState(true)
  // Region/district filters live on the page itself, not in the app's
  // global header Filters popover -- that popover's state (useAppStore)
  // isn't read anywhere in this page's data hook, so it would just be
  // dead UI here (see header.tsx's showGlobalFilters). "all" is the
  // sentinel for "no filter", since shadcn Select can't take "".
  const [regionFilter, setRegionFilter] = useState<string>("all")
  const [districtFilter, setDistrictFilter] = useState<string>("all")
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

  // Capture targets for the "Generate Report" export -- plain refs rather
  // than passing the chart data back out, since the export reuses the
  // already-rendered DOM (via captureElementAsPngDataUrl) instead of
  // redrawing each chart a second time just for the file.
  const trendChartRef = useRef<HTMLDivElement>(null)
  const lossHeatMapRef = useRef<HTMLDivElement>(null)
  const purchasesHeatMapRef = useRef<HTMLDivElement>(null)
  const prepaidHeatMapRef = useRef<HTMLDivElement>(null)
  const postpaidHeatMapRef = useRef<HTMLDivElement>(null)

  // Heat map carousel: Embla lays every slide out in one row and sizes its
  // own viewport to the tallest of them, so without this the carousel stays
  // exactly as tall as the Loss % slide (the longest one) even while a much
  // shorter slide like Purchases is showing -- leaving visible dead space
  // below its card. Tracking the active slide's own height and applying it
  // to Embla's root node keeps the carousel's box matching whatever's
  // actually on screen. Re-measured on slide change and on resize (a slide
  // whose data is still loading is shorter than once its table renders).
  const [heatCarouselApi, setHeatCarouselApi] = useState<CarouselApi>()
  useEffect(() => {
    if (!heatCarouselApi) return
    const updateHeight = () => {
      const slide = heatCarouselApi.slideNodes()[heatCarouselApi.selectedScrollSnap()]
      if (slide) heatCarouselApi.rootNode().style.height = `${slide.offsetHeight}px`
    }
    updateHeight()
    heatCarouselApi.on("select", updateHeight)
    heatCarouselApi.on("reInit", updateHeight)
    const resizeObserver = new ResizeObserver(updateHeight)
    heatCarouselApi.slideNodes().forEach((node) => resizeObserver.observe(node))
    return () => {
      heatCarouselApi.off("select", updateHeight)
      heatCarouselApi.off("reInit", updateHeight)
      resizeObserver.disconnect()
    }
  }, [heatCarouselApi])

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
  const monthKeys = report.months.map((m) => monthKey(m))

  // BSP incomer meter online/offline status for the same reporting window
  // (first day of the first month through the last day of the last month)
  // — reuses the generic meter-status engine already powering
  // /meter-category/bsp (app.meters + app.meter_consumption_daily), just
  // scoped to meterTypes: ["BSP"], rather than inventing a second
  // online/offline computation for this page.
  const bspStatusRange = useMemo(() => {
    const first = report.months[0]
    const last = report.months[report.months.length - 1]
    if (!first || !last) return null
    const start = new Date(first.year, first.month - 1, 1)
    const end = new Date(last.year, last.month, 0) // day 0 of next month = last day of this one
    return { dateFrom: formatApiDate(start), dateTo: formatApiDate(end) }
  }, [report.months])

  const { data: bspStatus, isLoading: bspStatusLoading } = useMeterStatusSummary({
    dateFrom: bspStatusRange?.dateFrom ?? "",
    dateTo: bspStatusRange?.dateTo ?? "",
    meterTypes: ["BSP"],
  })

  // Inline detail panel for the BSP Meter Status card below — clicking the
  // card expands this in place rather than navigating away, so the detail
  // is on the same page; /meter-category/bsp (FeedersTrafoTab's full,
  // richer table) stays one click further for anyone who wants more than
  // this compact view.
  const [bspExpanded, setBspExpanded] = useState(false)
  const [bspFilter, setBspFilterRaw] = useState<"all" | "online" | "offline">("all")
  const [bspPage, setBspPage] = useState(1)
  const BSP_PAGE_SIZE = 10

  // Changing the filter resets to page 1 directly in the setter, rather
  // than via a separate effect reacting to bspFilter.
  const setBspFilter = (f: "all" | "online" | "offline") => {
    setBspFilterRaw(f)
    setBspPage(1)
  }

  const { data: bspDetails, isLoading: bspDetailsLoading } = useMeterStatusDetails({
    dateFrom: bspStatusRange?.dateFrom ?? "",
    dateTo: bspStatusRange?.dateTo ?? "",
    meterTypes: ["BSP"],
    status: bspFilter === "all" ? undefined : bspFilter,
    page: bspPage,
    limit: BSP_PAGE_SIZE,
  })

  const selectedRegion = regionFilter === "all" ? null : report.regions.find((r) => r.regionKey === regionFilter) ?? null
  const selectedDistrict =
    districtFilter === "all" || !selectedRegion
      ? null
      : selectedRegion.districts.find((d) => d.districtKey === districtFilter) ?? null

  const handleRegionFilterChange = (value: string) => {
    setRegionFilter(value)
    setDistrictFilter("all")
    setFocusedRegionKey(value === "all" ? null : value)
  }

  // Everything below (headline totals, trend chart, narrative, heat map,
  // ranking table) is driven off this scoped region list rather than
  // report.regions/report.national directly, so picking a region or
  // district actually filters the whole story instead of just the table.
  // The loss map is the one exception -- it stays national, since a
  // single-district view has no geometry of its own to draw.
  // Purchases (BSP) aren't tracked below region level -- only down to
  // station, which belongs to the region, not any one district within it
  // (see use-purchases-sales-report.ts). So a district-scoped row has no
  // honest purchases/loss figure of its own; those are left as 0/null
  // placeholders here and the UI shows "—" for them wherever
  // purchasesAvailable is false, rather than rendering a fabricated number.
  const purchasesAvailable = !selectedDistrict
  const effShowPurchases = showPurchases && purchasesAvailable
  const effShowLossPct = showLossPct && purchasesAvailable

  const scopeRegions: RegionSeries[] = useMemo(() => {
    if (!selectedRegion) return report.regions
    if (!selectedDistrict) return [selectedRegion]
    return [
      {
        region: `${selectedRegion.region} — ${selectedDistrict.district}`,
        regionKey: `${selectedRegion.regionKey}::${selectedDistrict.districtKey}`,
        byMonth: selectedDistrict.byMonth,
        totalPurchasesKwh: 0,
        totalSalesKwh: selectedDistrict.totalSalesKwh,
        totalPostpaidKwh: selectedDistrict.totalPostpaidKwh,
        totalPrepaidKwh: selectedDistrict.totalPrepaidKwh,
        totalStreetlightingKwh: selectedDistrict.totalStreetlightingKwh,
        lossKwh: 0,
        lossPct: null,
        districts: [],
        stations: [],
      },
    ]
  }, [report.regions, selectedRegion, selectedDistrict])

  // PNS has no region of its own (see use-purchases-sales-report.ts), so
  // it's folded into report.national/nationalTotals directly rather than
  // any one region's byMonth -- re-summing scopeRegions (as below) always
  // matches report.national exactly EXCEPT for that one non-regional
  // contributor, which only matters when nothing is filtered (no region
  // picked, so PNS should still be counted) vs when a region/district IS
  // selected (PNS genuinely has no data to attribute to it, so being
  // absent from the region-sum there is correct, not a bug).
  const scopeNational = useMemo(() => {
    if (!selectedRegion) return report.national
    return report.months.map((m, idx) => {
      const mKey = monthKeys[idx]
      let purchases = 0
      let sales = 0
      let postpaid = 0
      let prepaid = 0
      let streetlighting = 0
      scopeRegions.forEach((r) => {
        const c = r.byMonth[mKey]
        if (c) {
          purchases += c.purchasesKwh
          sales += c.salesKwh
          postpaid += c.postpaidKwh
          prepaid += c.prepaidKwh
          streetlighting += c.streetlightingKwh
        }
      })
      const lossKwh = purchases - sales
      return {
        month: mKey,
        label: report.monthLabels[idx],
        purchasesKwh: purchases,
        salesKwh: sales,
        postpaidKwh: postpaid,
        prepaidKwh: prepaid,
        streetlightingKwh: streetlighting,
        lossKwh,
        lossPct: purchases > 0 ? (lossKwh / purchases) * 100 : null,
      }
    })
  }, [report.months, report.monthLabels, report.national, selectedRegion, scopeRegions, monthKeys])

  const scopeTotals = useMemo(() => {
    if (!selectedRegion) return report.nationalTotals
    const purchases = scopeRegions.reduce((s, r) => s + r.totalPurchasesKwh, 0)
    const sales = scopeRegions.reduce((s, r) => s + r.totalSalesKwh, 0)
    const postpaid = scopeRegions.reduce((s, r) => s + r.totalPostpaidKwh, 0)
    const prepaid = scopeRegions.reduce((s, r) => s + r.totalPrepaidKwh, 0)
    const streetlighting = scopeRegions.reduce((s, r) => s + r.totalStreetlightingKwh, 0)
    const lossKwh = purchases - sales
    return {
      purchasesKwh: purchases,
      salesKwh: sales,
      postpaidKwh: postpaid,
      prepaidKwh: prepaid,
      streetlightingKwh: streetlighting,
      lossKwh,
      lossPct: purchases > 0 ? (lossKwh / purchases) * 100 : null,
    }
  }, [report.nationalTotals, selectedRegion, scopeRegions])

  const scopeAnomalies = selectedRegion
    ? report.anomalies.filter((a) => a.region === selectedRegion.region)
    : report.anomalies

  const chartData = scopeNational.map((n) => ({
    label: n.label,
    purchasesKwh: n.purchasesKwh,
    salesKwh: n.salesKwh,
    postpaidKwh: n.postpaidKwh,
    prepaidKwh: n.prepaidKwh,
    streetlightingKwh: n.streetlightingKwh,
    lossPct: n.lossPct,
  }))

  // Narrative: compare the first vs second half of the window's average
  // loss %, to say whether the network (or the filtered region/district) is
  // trending better or worse, not just what the current snapshot is.
  const narrative = useMemo(() => {
    const withLoss = scopeNational.filter((n) => n.lossPct !== null)
    if (withLoss.length < 2) return null
    const mid = Math.floor(withLoss.length / 2)
    const firstHalf = withLoss.slice(0, mid)
    const secondHalf = withLoss.slice(mid)
    const avg = (rows: typeof withLoss) => rows.reduce((s, r) => s + (r.lossPct || 0), 0) / rows.length
    const firstAvg = avg(firstHalf)
    const secondAvg = avg(secondHalf)
    const delta = secondAvg - firstAvg
    // Worst/best-region comparison only means something across multiple
    // regions -- once filtered down to one region or district there's
    // nothing to rank against, so it's left out rather than comparing an
    // entry to itself.
    const worst = scopeRegions.length > 1 ? scopeRegions[0] : null
    const best = scopeRegions.length > 1 ? [...scopeRegions].reverse().find((r) => r.lossPct !== null) : null
    return { firstAvg, secondAvg, delta, worst, best }
  }, [scopeNational, scopeRegions])

  // True national average, not the filtered scope's -- severity coloring
  // (lossSeverityClass) means "worse than the network as a whole", which
  // should stay a fixed yardstick regardless of what's currently filtered.
  const nationalAvgLossPct = report.nationalTotals.lossPct

  // One rendering for every heat map "total" cell (the new right-hand Total
  // column per region, the new bottom Total row per month, and their
  // corner) -- unlike a normal region-month cell, a total is always a real
  // number (a sum), never "no data for that one month", so it always shows
  // the figures rather than falling back to a dash.
  const heatTotalCell = (key: string, purchasesKwh: number, salesKwh: number, lossPct: number | null, title: string) => {
    const rgb = lossHeatRgb(lossPct)
    const textColor = readableTextOn(rgb)
    return (
      <td
        key={key}
        className="text-center rounded align-middle px-1.5 py-1.5 border-l"
        style={{ backgroundColor: rgbToCss(rgb), color: textColor, minWidth: 92 }}
        title={title}
      >
        <div className="text-sm font-bold tabular-nums leading-tight">{formatPct(lossPct)}</div>
        <div className="text-[10px] leading-tight tabular-nums opacity-90" style={{ color: textColor }}>
          P {formatAxisKwh(purchasesKwh)} · S {formatAxisKwh(salesKwh)}
        </div>
      </td>
    )
  }

  const scopeLabel = selectedDistrict
    ? `${selectedRegion!.region} — ${selectedDistrict.district}`
    : selectedRegion
      ? selectedRegion.region
      : null

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
          <GenerateReportDialog
            report={report}
            periodLabel={
              report.monthLabels.length <= 1
                ? (report.monthLabels[0] ?? "")
                : `${report.monthLabels[0]} – ${report.monthLabels[report.monthLabels.length - 1]}`
            }
            chartRefs={{
              trend: trendChartRef,
              lossHeatMap: lossHeatMapRef,
              purchasesHeatMap: purchasesHeatMapRef,
              prepaidHeatMap: prepaidHeatMapRef,
              postpaidHeatMap: postpaidHeatMapRef,
            }}
          />
          <Button variant="outline" onClick={() => router.push("/reports/builder")}>
            Report Builder
          </Button>
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

      {/* Region/district filters -- page-native, not the app's global
          header filter (which doesn't read this page's data at all). */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={regionFilter} onValueChange={handleRegionFilterChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All regions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All regions</SelectItem>
            {report.regions.map((r) => (
              <SelectItem key={r.regionKey} value={r.regionKey}>
                {r.region}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={districtFilter}
          onValueChange={setDistrictFilter}
          disabled={!selectedRegion || selectedRegion.districts.length === 0}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={selectedRegion ? "All districts" : "Select a region first"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All districts</SelectItem>
            {(selectedRegion?.districts ?? []).map((d) => (
              <SelectItem key={d.districtKey} value={d.districtKey}>
                {d.district}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {scopeLabel && (
          <Badge
            variant="outline"
            className="gap-1.5 cursor-pointer hover:bg-muted"
            onClick={() => handleRegionFilterChange("all")}
            title="Clear filter"
          >
            Filtered to {scopeLabel} ✕
          </Badge>
        )}
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
            <CardDescription className="text-[11px]">
              {purchasesAvailable ? "BSP incomer imports (net)" : "Not tracked below region level"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {report.isLoading ? (
              <Skeleton className="h-9 w-40" />
            ) : purchasesAvailable ? (
              <div className="text-3xl font-bold text-blue-700">{formatKwh(scopeTotals.purchasesKwh)}</div>
            ) : (
              <div className="text-3xl font-bold text-muted-foreground">—</div>
            )}
            {!bspStatusLoading && bspStatus && (
              <div className="mt-2">
                <Badge
                  variant="outline"
                  className="text-[10px] gap-1 border-indigo-300 text-indigo-700 cursor-pointer hover:bg-indigo-50"
                  onClick={() => setBspExpanded((v) => !v)}
                >
                  <Wifi className="h-3 w-3" />
                  BSP meters {bspStatus.online}/{bspStatus.total} online ({formatPct(bspStatus.online_percentage)})
                  {bspExpanded ? " — hide detail" : " — view detail"}
                </Badge>
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
              <>
                <div className="text-3xl font-bold text-emerald-700">{formatKwh(scopeTotals.salesKwh)}</div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <Badge variant="outline" className="text-[10px] gap-1 border-blue-300 text-blue-700">
                    Postpaid {formatKwh(scopeTotals.postpaidKwh)}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] gap-1 border-pink-300 text-pink-700">
                    Prepaid {formatKwh(scopeTotals.prepaidKwh)}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] gap-1 border-cyan-300 text-cyan-700">
                    Streetlighting {formatKwh(scopeTotals.streetlightingKwh)}
                  </Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="border-2 border-rose-200 bg-rose-50/40">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-rose-600" />
              <CardTitle className="text-sm font-medium text-muted-foreground">Losses</CardTitle>
            </div>
            <CardDescription className="text-[11px]">
              {purchasesAvailable ? "Purchases − Sales" : "Not tracked below region level"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {report.isLoading ? (
              <Skeleton className="h-9 w-40" />
            ) : purchasesAvailable ? (
              <>
                <div className="text-3xl font-bold text-rose-700">{formatKwh(scopeTotals.lossKwh)}</div>
                <div className="text-sm text-rose-600 mt-1">{formatPct(scopeTotals.lossPct)} of purchases</div>
              </>
            ) : (
              <div className="text-3xl font-bold text-muted-foreground">—</div>
            )}
          </CardContent>
        </Card>
      </div>

      {bspExpanded && (
        <Card className="border-indigo-200">
          <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle>BSP Meter Status Detail</CardTitle>
              <CardDescription>
                {bspStatusRange ? `${bspStatusRange.dateFrom} to ${bspStatusRange.dateTo}` : ""} — same window as the
                report above
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push("/meter-category/bsp")}>
              Open full BSP page
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={bspFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setBspFilter("all")}
              >
                All ({bspStatus?.total ?? 0})
              </Button>
              <Button
                variant={bspFilter === "online" ? "default" : "outline"}
                size="sm"
                onClick={() => setBspFilter("online")}
              >
                Online ({bspStatus?.online ?? 0})
              </Button>
              <Button
                variant={bspFilter === "offline" ? "default" : "outline"}
                size="sm"
                onClick={() => setBspFilter("offline")}
              >
                Offline ({bspStatus?.total_offline ?? 0})
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead>Meter Number</TableHead>
                      <TableHead>Region / Station</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Reading</TableHead>
                      <TableHead className="text-right">Uptime %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bspDetailsLoading ? (
                      [...Array(5)].map((_, i) => (
                        <TableRow key={i}>
                          {[...Array(5)].map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-4 w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : !bspDetails || bspDetails.data.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No BSP meters found for this filter/window.
                        </TableCell>
                      </TableRow>
                    ) : (
                      bspDetails.data.map((m) => {
                        const lastReading = m.last_reading_time ? new Date(m.last_reading_time) : null
                        const hasLastReading = lastReading && lastReading.getFullYear() > 1900
                        return (
                          <TableRow key={m.meter_number}>
                            <TableCell className="font-medium font-mono text-xs">{m.meter_number}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {m.region || "—"} · {m.station || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={m.status === "ONLINE" ? "default" : "destructive"}>{m.status}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {hasLastReading ? lastReading!.toLocaleString() : "Not available"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {m.uptime_percentage.toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {bspDetails && bspDetails.pagination.total_pages > 1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {bspDetails.pagination.total_records.toLocaleString()} meter(s) total
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBspPage((p) => Math.max(1, p - 1))}
                    disabled={bspPage === 1 || bspDetailsLoading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="font-medium px-1">
                    Page {bspPage} of {bspDetails.pagination.total_pages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBspPage((p) => Math.min(bspDetails.pagination.total_pages, p + 1))}
                    disabled={bspPage >= bspDetails.pagination.total_pages || bspDetailsLoading}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
      {!report.isLoading && scopeAnomalies.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/40">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <CardTitle className="text-sm font-medium text-amber-900">
                {scopeAnomalies.length} region{scopeAnomalies.length === 1 ? "" : "s"} sold more than purchased
              </CardTitle>
            </div>
            <CardDescription className="text-[11px] text-amber-800">
              A region can&apos;t sell more than it bought — this points at a data or timing mismatch between
              sources over the selected window, not a real negative loss. One row per region, on its own totals
              for the whole window — not once per month it happened in.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-amber-900 space-y-1">
            {scopeAnomalies.slice(0, 8).map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <span>
                  {a.region}{" "}
                  <span className="text-amber-700">
                    ({a.monthsAffected} month{a.monthsAffected === 1 ? "" : "s"})
                  </span>
                </span>
                <span className="font-mono">
                  purchased {formatKwh(a.purchasesKwh)}, sold {formatKwh(a.salesKwh)}
                </span>
              </div>
            ))}
            {scopeAnomalies.length > 8 && (
              <p className="text-muted-foreground pt-1">…and {scopeAnomalies.length - 8} more.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Monthly trend — Purchases + Sales (left axis, kWh) and Loss %
          (right axis, %) combined into one chart, each series toggleable
          via the checkboxes instead of split across two charts. */}
      <div ref={trendChartRef}>
      <Card>
        <CardHeader>
          <CardTitle>Purchases vs Sales vs Loss % — monthly trend</CardTitle>
          <CardDescription>{scopeLabel ?? "National"} totals across the selected window</CardDescription>
          <div className="flex items-center gap-5 pt-2 flex-wrap">
            <label
              className={`flex items-center gap-2 text-sm select-none ${purchasesAvailable ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
              title={purchasesAvailable ? undefined : "Purchases aren't tracked below region level"}
            >
              <Checkbox
                checked={effShowPurchases}
                disabled={!purchasesAvailable}
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
              <Checkbox checked={showStreetlighting} onCheckedChange={(v) => setShowStreetlighting(v === true)} />
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#ca8a04" }} />
              Streetlighting
            </label>
            <label
              className={`flex items-center gap-2 text-sm select-none ${purchasesAvailable ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
              title={purchasesAvailable ? undefined : "Loss % needs purchases, not tracked below region level"}
            >
              <Checkbox checked={effShowLossPct} disabled={!purchasesAvailable} onCheckedChange={(v) => setShowLossPct(v === true)} />
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#dc2626" }} />
              Loss %
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {report.isLoading ? (
            <Skeleton className="h-[320px] w-full" />
          ) : !effShowPurchases && !showSales && !showStreetlighting && !effShowLossPct ? (
            <p className="text-sm text-muted-foreground py-24 text-center">
              Nothing selected — check a box above to show a series.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 8, left: 8, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                {(effShowPurchases || showSales || showStreetlighting) && (
                  <YAxis
                    yAxisId="kwh"
                    tickFormatter={formatAxisKwh}
                    tick={{ fontSize: 11 }}
                    label={{ value: "kWh", angle: -90, position: "insideLeft", style: { fontSize: 11 } }}
                  />
                )}
                {effShowLossPct && (
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
                {effShowPurchases && (
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
                {showStreetlighting && (
                  <Area
                    yAxisId="kwh"
                    type="monotone"
                    dataKey="streetlightingKwh"
                    name="Streetlighting"
                    stroke="#ca8a04"
                    fill="#ca8a04"
                    fillOpacity={0.15}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                )}
                {effShowLossPct && (
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
      </div>

      {/* Region ranking */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Region ranking — highest loss % first</CardTitle>
          </div>
          <CardDescription>{scopeLabel ?? "Totals"} across the selected window</CardDescription>
        </CardHeader>
        <CardContent>
          {report.isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : scopeRegions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No data for this window.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Region</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">Purchases</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">Sales</th>
                    <th className="text-right py-2 px-4 font-medium text-yellow-700">Streetlighting</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">Loss</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">Loss %</th>
                    <th className="text-center py-2 pl-4 font-medium text-muted-foreground" title="First half vs second half of the window's average loss %">
                      Trend
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {scopeRegions.map((r: RegionSeries) => {
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
                              {r.districts.length > 0 && (
                                <span className="text-xs text-muted-foreground font-normal">
                                  ({r.districts.length} district{r.districts.length === 1 ? "" : "s"})
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-blue-700">
                            {purchasesAvailable ? formatKwh(r.totalPurchasesKwh) : "—"}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-emerald-700">
                            {formatKwh(r.totalSalesKwh)}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-yellow-700">
                            {formatKwh(r.totalStreetlightingKwh)}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums">
                            {purchasesAvailable ? formatKwh(r.lossKwh) : "—"}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums">
                            {purchasesAvailable ? (
                              <Badge
                                variant="outline"
                                className={`text-xs font-normal border-0 bg-transparent ${lossSeverityClass(r.lossPct, nationalAvgLossPct)}`}
                              >
                                {formatPct(r.lossPct)}
                              </Badge>
                            ) : (
                              "—"
                            )}
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
                            <td colSpan={7} className="py-3 pl-8 pr-4">
                              {/* Districts (sales) and stations (purchases) are two
                                  separate breakdowns, not one merged table -- sales are
                                  tracked by district, purchases (BSP) by station, and
                                  the two aren't the same physical unit, so forcing
                                  purchases into a district row just produced a bogus
                                  "Unknown" district holding every kWh. */}
                              <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                  <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
                                    Districts (sales)
                                  </p>
                                  {r.districts.length === 0 ? (
                                    <p className="text-xs text-muted-foreground py-2">No district-level sales data.</p>
                                  ) : (
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b border-dashed">
                                          <th className="text-left py-1.5 pr-4 font-medium text-muted-foreground">
                                            District
                                          </th>
                                          <th className="text-right py-1.5 px-4 font-medium text-muted-foreground">
                                            Sales
                                          </th>
                                          <th className="text-right py-1.5 pl-4 font-medium text-yellow-700">
                                            Streetlighting
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {r.districts.map((d) => (
                                          <tr key={d.districtKey} className="border-b border-dashed last:border-0">
                                            <td className="py-1.5 pr-4">{d.district}</td>
                                            <td className="py-1.5 px-4 text-right tabular-nums text-emerald-700">
                                              {formatKwh(d.totalSalesKwh)}
                                            </td>
                                            <td className="py-1.5 pl-4 text-right tabular-nums text-yellow-700">
                                              {formatKwh(d.totalStreetlightingKwh)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                                <div>
                                  <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
                                    Stations (purchases)
                                  </p>
                                  {r.stations.length === 0 ? (
                                    <p className="text-xs text-muted-foreground py-2">No station-level purchase data.</p>
                                  ) : (
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b border-dashed">
                                          <th className="text-left py-1.5 pr-4 font-medium text-muted-foreground">
                                            Station
                                          </th>
                                          <th className="text-right py-1.5 pl-4 font-medium text-muted-foreground">
                                            Purchased
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {r.stations.map((s) => (
                                          <tr key={s.stationKey} className="border-b border-dashed last:border-0">
                                            <td className="py-1.5 pr-4">{s.station}</td>
                                            <td className="py-1.5 pl-4 text-right tabular-nums text-blue-700">
                                              {formatKwh(s.totalPurchasesKwh)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                  <tr className="border-t-2 font-semibold">
                    <td className="py-2.5 pr-4">Total</td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-blue-700">
                      {purchasesAvailable ? formatKwh(scopeTotals.purchasesKwh) : "—"}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-emerald-700">
                      {formatKwh(scopeTotals.salesKwh)}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">
                      {purchasesAvailable ? formatKwh(scopeTotals.lossKwh) : "—"}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">
                      {purchasesAvailable ? formatPct(scopeTotals.lossPct) : "—"}
                    </td>
                    <td className="py-2.5 pl-4 text-center">
                      {!narrative ? (
                        <Minus className="h-3.5 w-3.5 text-muted-foreground inline-block" />
                      ) : narrative.delta > 0.5 ? (
                        <span
                          className="inline-flex items-center gap-0.5 text-red-700"
                          title={`Loss % worsened ${narrative.delta.toFixed(1)} points, first half vs second half of this window`}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                          <span className="text-xs tabular-nums">{narrative.delta.toFixed(1)}</span>
                        </span>
                      ) : narrative.delta < -0.5 ? (
                        <span
                          className="inline-flex items-center gap-0.5 text-emerald-700"
                          title={`Loss % improved ${Math.abs(narrative.delta).toFixed(1)} points, first half vs second half of this window`}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                          <span className="text-xs tabular-nums">{Math.abs(narrative.delta).toFixed(1)}</span>
                        </span>
                      ) : (
                        <Minus className="h-3.5 w-3.5 text-muted-foreground inline-block" aria-label="Essentially flat" />
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Heat map carousel — Loss % (diverging severity) plus one sequential
          magnitude map per sales category. Each slide is its own self-
          contained Card so the carousel can be a thin wrapper around markup
          that otherwise renders exactly as it did as a single Card. Nav
          buttons sit above the card, top-right, rather than pinned to the
          viewport's side edges -- the side position put them well outside
          this (narrower, padded) content column on real layouts. */}
      <Carousel opts={{ align: "start" }} setApi={setHeatCarouselApi} className="[&_[data-slot=carousel-content]]:transition-[height] [&_[data-slot=carousel-content]]:duration-300">
        <div className="flex justify-end gap-2 mb-2">
          <CarouselPrevious className="static translate-y-0" />
          <CarouselNext className="static translate-y-0" />
        </div>
        <CarouselContent className="items-start">
            <CarouselItem>
              <div ref={lossHeatMapRef}>
              <Card>
                <CardHeader>
                  <CardTitle>Loss % heat map — region × month</CardTitle>
                  <CardDescription>
                    Green is tight (≤10% loss), amber is watch (10–30%), red is leaking (30%+). Violet flags a
                    region-month that sold more than it bought — a data mismatch, not real negative loss (see
                    Anomalies above). Gray is no purchases data that month.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {report.isLoading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : scopeRegions.length === 0 ? (
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
                            <th className="text-center px-1 pb-1 font-medium text-muted-foreground whitespace-nowrap text-xs border-l">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {scopeRegions.map((r) => (
                            <tr key={r.regionKey}>
                              <td className="text-left pr-3 font-medium whitespace-nowrap sticky left-0 bg-card">
                                {r.region}
                              </td>
                              {monthKeys.map((mKey, idx) => {
                                const lossPct = cellLossPct(r.byMonth[mKey])
                                const rgb = lossHeatRgb(lossPct)
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
                              {heatTotalCell(
                                `${r.regionKey}-total`,
                                r.totalPurchasesKwh,
                                r.totalSalesKwh,
                                r.lossPct,
                                `${r.region}, whole window: purchased ${formatKwh(r.totalPurchasesKwh)}, sold ${formatKwh(r.totalSalesKwh)}, loss ${formatKwh(r.lossKwh)}`,
                              )}
                            </tr>
                          ))}
                          <tr className="border-t-2">
                            <td className="text-left pr-3 font-semibold whitespace-nowrap sticky left-0 bg-card">
                              Total
                            </td>
                            {monthKeys.map((mKey, idx) => {
                              const n = scopeNational[idx]
                              return heatTotalCell(
                                `total-${mKey}`,
                                n?.purchasesKwh ?? 0,
                                n?.salesKwh ?? 0,
                                n?.lossPct ?? null,
                                `${report.monthLabels[idx]}, all regions: purchased ${formatKwh(n?.purchasesKwh ?? 0)}, sold ${formatKwh(n?.salesKwh ?? 0)}, loss ${formatKwh(n?.lossKwh ?? 0)}`,
                              )
                            })}
                            {heatTotalCell(
                              "grand-total",
                              scopeTotals.purchasesKwh,
                              scopeTotals.salesKwh,
                              scopeTotals.lossPct,
                              `Whole window, all regions: purchased ${formatKwh(scopeTotals.purchasesKwh)}, sold ${formatKwh(scopeTotals.salesKwh)}, loss ${formatKwh(scopeTotals.lossKwh)}`,
                            )}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
              </div>
            </CarouselItem>

            <CarouselItem>
              <div ref={purchasesHeatMapRef}>
              <MetricHeatMap
                title="Purchases heat map — region × month"
                description="BSP incomer imports by region and month. Darker blue is more purchased."
                hue={METRIC_HEAT_HUES.purchases}
                isLoading={report.isLoading}
                regions={scopeRegions}
                monthKeys={monthKeys}
                monthLabels={report.monthLabels}
                national={scopeNational}
                cellValue={(cell) => cell?.purchasesKwh ?? 0}
                regionTotal={(r) => r.totalPurchasesKwh}
                nationalValue={(n) => n?.purchasesKwh ?? 0}
                grandTotal={scopeTotals.purchasesKwh}
              />
              </div>
            </CarouselItem>

            <CarouselItem>
              <div ref={prepaidHeatMapRef}>
              <MetricHeatMap
                title="Prepaid heat map — region × month"
                description="Zeus prepaid + MMS + Legacy (BOT/BXC/Holley/eCash4/PNS) prepaid sales by region and month. Darker green is more sold."
                hue={METRIC_HEAT_HUES.prepaid}
                isLoading={report.isLoading}
                regions={scopeRegions}
                monthKeys={monthKeys}
                monthLabels={report.monthLabels}
                national={scopeNational}
                cellValue={(cell) => cell?.prepaidKwh ?? 0}
                regionTotal={(r) => r.totalPrepaidKwh}
                nationalValue={(n) => n?.prepaidKwh ?? 0}
                grandTotal={scopeTotals.prepaidKwh}
              />
              </div>
            </CarouselItem>

            <CarouselItem>
              {/* Streetlighting (Zeus tariff class E03) is billed the same
                  non-prepaid way as Postpaid, not a sibling sales category --
                  nested here as a sub-view of the same slide rather than its
                  own carousel slide, same relationship as the region/district
                  detail pages' Postpaid tab. Postpaid totals elsewhere on
                  this page (KPIs, national Loss %) are unchanged by this --
                  still Postpaid-AMR + Postpaid-non-AMR only, same as before. */}
              <Tabs defaultValue="all">
                <TabsList className="grid w-full grid-cols-2 max-w-xs mb-2">
                  <TabsTrigger value="all">All Postpaid</TabsTrigger>
                  <TabsTrigger value="streetlighting">Streetlighting</TabsTrigger>
                </TabsList>
                <TabsContent value="all">
                  <div ref={postpaidHeatMapRef}>
                  <MetricHeatMap
                    title="Postpaid heat map — region × month"
                    description="Zeus postpaid (non-AMR + AMR) sales by region and month. Darker indigo is more sold."
                    hue={METRIC_HEAT_HUES.postpaid}
                    isLoading={report.isLoading}
                    regions={scopeRegions}
                    monthKeys={monthKeys}
                    monthLabels={report.monthLabels}
                    national={scopeNational}
                    cellValue={(cell) => cell?.postpaidKwh ?? 0}
                    regionTotal={(r) => r.totalPostpaidKwh}
                    nationalValue={(n) => n?.postpaidKwh ?? 0}
                    grandTotal={scopeTotals.postpaidKwh}
                  />
                  </div>
                </TabsContent>
                <TabsContent value="streetlighting">
                  <MetricHeatMap
                    title="Postpaid heat map — Streetlighting — region × month"
                    description="Subset of Postpaid: Zeus streetlighting (tariff class E03) sales by region and month. Darker amber is more sold."
                    hue={METRIC_HEAT_HUES.streetlighting}
                    isLoading={report.isLoading}
                    regions={scopeRegions}
                    monthKeys={monthKeys}
                    monthLabels={report.monthLabels}
                    national={scopeNational}
                    cellValue={(cell) => cell?.streetlightingKwh ?? 0}
                    regionTotal={(r) => r.totalStreetlightingKwh}
                    nationalValue={(n) => n?.streetlightingKwh ?? 0}
                    grandTotal={scopeTotals.streetlightingKwh}
                  />
                </TabsContent>
              </Tabs>
            </CarouselItem>
        </CarouselContent>
      </Carousel>

      {/* Loss map -- stays national regardless of the region/district filter
          above, since a single district has no geometry of its own to draw;
          focusedRegionKey still tracks the filter to highlight it. */}
      {!report.isLoading && report.regions.length > 0 && (
        <PurchasesSalesLossMap
          regions={report.regions}
          monthKeys={monthKeys}
          focusedRegionKey={focusedRegionKey}
          onFocusRegion={setFocusedRegionKey}
        />
      )}

      {!report.isLoading && report.regions.length > 0 && (
        <CompareInsightsView report={report} monthKeys={monthKeys} />
      )}
    </div>
  )
}
