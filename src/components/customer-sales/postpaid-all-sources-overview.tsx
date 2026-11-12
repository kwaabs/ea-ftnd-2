"use client"

import { useMemo, useState } from "react"
import { BarChart3, PercentCircle, Scale, Users, Zap } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useZeusBillingAggregate } from "@/hooks/api/use-zeus-billing-aggregate-api"
import { normalizeRegionName, shortRegionLabel, useResolvedRegionName } from "@/hooks/use-resolved-region-name"
import { cn } from "@/lib/utils"

// Both sources are the same underlying Zeus billing table, split only by
// metermodeltype — unlike the Prepaid page's Overview (which genuinely
// merges independent data sources), this is one source read twice.
const SOURCES = ["Non AMR Postpaid", "AMR Postpaid"] as const
type Source = (typeof SOURCES)[number]

// Matches zeus-page-view.tsx's SERIES_COLOR (Postpaid blue, AMR orange) and
// the tab trigger colors on the Postpaid hub, so the same source reads the
// same color everywhere on this page.
const SOURCE_COLORS: Record<Source, string> = {
  "Non AMR Postpaid": "#1d4ed8",
  "AMR Postpaid": "#ea580c",
}

function formatKwhRaw(value: number | null | undefined) {
  if (value === null || value === undefined) return "0 kWh"
  return `${(value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} kWh`
}

// Unit-adaptive formatter for the Reading Quality card — matches
// customer-sales-overview.tsx's formatKwh so the same feature reads the
// same way on both pages.
function formatKwh(value: number | null | undefined) {
  if (value === null || value === undefined) return "—"
  if (value >= 1_000_000)
    return `${(value / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GWh`
  if (value >= 1_000)
    return `${(value / 1_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MWh`
  return `${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh`
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "0"
  return (value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "₵0.00"
  return `₵${(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface SourceBucket {
  kwh: number
  customers: number
  billing: number
  debt: number
}

interface RegionRow {
  regionname: string
  bySource: Partial<Record<Source, SourceBucket>>
  totalKwh: number
  totalCustomers: number
  leadingSource: Source | null
}

function mergeBySource(
  rows: Map<string, RegionRow>,
  raw: string,
  source: Source,
  kwh: number,
  customers: number,
  billing: number,
  debt: number,
) {
  if (kwh === 0 && customers === 0) return
  const key = normalizeRegionName(raw)
  let row = rows.get(key)
  if (!row) {
    row = { regionname: raw, bySource: {}, totalKwh: 0, totalCustomers: 0, leadingSource: null }
    rows.set(key, row)
  }
  const bucket = row.bySource[source] || { kwh: 0, customers: 0, billing: 0, debt: 0 }
  bucket.kwh += kwh
  bucket.customers += customers
  bucket.billing += billing
  bucket.debt += debt
  row.bySource[source] = bucket
  row.totalKwh += kwh
  row.totalCustomers += customers
}

interface ReadingQualityBucket {
  actualKwh: number
  estimatedKwh: number
  noReadingKwh: number
  otherKwh: number
  totalKwh: number
  actualPct: number
  estimatedPct: number
  noReadingPct: number
  otherPct: number
}

// Builds a per-region/per-district reading quality lookup from rows
// grouped by [keyField, billconsumptiontype] — same classification as the
// page-level readingQuality above, just keyed per row instead of summed
// across the whole page. Percentages are per-row (that region/district's
// own Actual+Estimated+No Reading+Other total), not the page total, since
// each row needs its own share.
function buildReadingQualityByKey(
  rows: { regionname?: string; districtname?: string; billconsumptiontype?: string; sum_billconsumptionvalue?: number }[],
  keyField: "regionname" | "districtname",
): Map<string, ReadingQualityBucket> {
  const sums = new Map<string, { actualKwh: number; estimatedKwh: number; noReadingKwh: number; otherKwh: number }>()
  rows.forEach((row) => {
    const label = row[keyField] || "Unknown"
    const key = normalizeRegionName(label)
    const bucket = sums.get(key) || { actualKwh: 0, estimatedKwh: 0, noReadingKwh: 0, otherKwh: 0 }
    const kwh = row.sum_billconsumptionvalue || 0
    const type = (row.billconsumptiontype || "").trim().toUpperCase()
    if (type === "A") bucket.actualKwh += kwh
    else if (type === "E") bucket.estimatedKwh += kwh
    else if (type === "N/A" || type === "") bucket.noReadingKwh += kwh
    else bucket.otherKwh += kwh
    sums.set(key, bucket)
  })
  const result = new Map<string, ReadingQualityBucket>()
  sums.forEach((b, key) => {
    const totalKwh = b.actualKwh + b.estimatedKwh + b.noReadingKwh + b.otherKwh
    const pct = (v: number) => (totalKwh > 0 ? (v / totalKwh) * 100 : 0)
    result.set(key, {
      ...b,
      totalKwh,
      actualPct: pct(b.actualKwh),
      estimatedPct: pct(b.estimatedKwh),
      noReadingPct: pct(b.noReadingKwh),
      otherPct: pct(b.otherKwh),
    })
  })
  return result
}

function readingQualityTitle(bucket: ReadingQualityBucket | undefined): string {
  if (!bucket) return "No reading quality data"
  return `Actual ${bucket.actualPct.toFixed(1)}% • Estimated ${bucket.estimatedPct.toFixed(1)}% • No Reading ${bucket.noReadingPct.toFixed(1)}%${bucket.otherPct > 0 ? ` • Other ${bucket.otherPct.toFixed(1)}%` : ""}`
}

function withLeadingSource(rows: RegionRow[]): RegionRow[] {
  return rows.map((row) => {
    let leader: Source | null = null
    let leadKwh = -1
    for (const source of SOURCES) {
      const kwh = row.bySource[source]?.kwh ?? 0
      if (kwh > leadKwh) {
        leadKwh = kwh
        leader = source
      }
    }
    return { ...row, leadingSource: leadKwh > 0 ? leader : null }
  })
}

interface PostpaidAllSourcesOverviewProps {
  dateRange: { start: string; end: string }
  region?: string
  district?: string
}

export function PostpaidAllSourcesOverview({ dateRange, region, district }: PostpaidAllSourcesOverviewProps) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const selectRegion = (value: string | null) => {
    setSelectedRegion((prev) => (prev === value ? null : value))
  }

  const { data: nonAmrRegionAgg = [], isLoading: nonAmrLoading } = useZeusBillingAggregate({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    groupBy: "regionname",
    region,
    district,
    meterModelType: "Postpaid",
  })
  const { data: amrRegionAgg = [], isLoading: amrLoading } = useZeusBillingAggregate({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    groupBy: "regionname",
    region,
    district,
    meterModelType: "AMR",
  })

  // Reading quality (Postpaid = Non AMR + AMR combined) — one call with
  // both metermodeltype values comma-joined (same CSV convention the
  // backend's groupBy param already uses) rather than two calls merged,
  // since there's no need to tell the two sources apart here.
  const { data: readingQualityAgg = [], isLoading: readingQualityLoading } = useZeusBillingAggregate({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    groupBy: "billconsumptiontype",
    region,
    district,
    meterModelType: "Postpaid,AMR",
  })

  // Reading quality per region, for the Region breakdown table's column —
  // same combined-metermodeltype call as above, grouped by regionname too.
  const { data: readingQualityByRegionAgg = [] } = useZeusBillingAggregate({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    groupBy: ["regionname", "billconsumptiontype"],
    region,
    district,
    meterModelType: "Postpaid,AMR",
  })
  const readingQualityByRegion = useMemo(
    () => buildReadingQualityByKey(readingQualityByRegionAgg, "regionname"),
    [readingQualityByRegionAgg],
  )

  const regionLoading = nonAmrLoading || amrLoading

  const byRegion = useMemo<RegionRow[]>(() => {
    const rows = new Map<string, RegionRow>()
    nonAmrRegionAgg.forEach((r) =>
      mergeBySource(
        rows,
        r.regionname || "Unknown",
        "Non AMR Postpaid",
        r.sum_billconsumptionvalue || 0,
        r.customer_count || 0,
        r.sum_billamount || 0,
        r.sum_debtamount || 0,
      ),
    )
    amrRegionAgg.forEach((r) =>
      mergeBySource(
        rows,
        r.regionname || "Unknown",
        "AMR Postpaid",
        r.sum_billconsumptionvalue || 0,
        r.customer_count || 0,
        r.sum_billamount || 0,
        r.sum_debtamount || 0,
      ),
    )

    return withLeadingSource(Array.from(rows.values())).sort((a, b) => b.totalKwh - a.totalKwh)
  }, [nonAmrRegionAgg, amrRegionAgg])

  const bySource = useMemo(() => {
    const totals: Record<Source, SourceBucket> = {
      "Non AMR Postpaid": { kwh: 0, customers: 0, billing: 0, debt: 0 },
      "AMR Postpaid": { kwh: 0, customers: 0, billing: 0, debt: 0 },
    }
    byRegion.forEach((row) => {
      for (const source of SOURCES) {
        const bucket = row.bySource[source]
        if (!bucket) continue
        totals[source].kwh += bucket.kwh
        totals[source].customers += bucket.customers
        totals[source].billing += bucket.billing
        totals[source].debt += bucket.debt
      }
    })
    return SOURCES.map((source) => ({ source, ...totals[source] })).sort((a, b) => b.kwh - a.kwh)
  }, [byRegion])

  const stats = useMemo(() => {
    const totalKwh = bySource.reduce((s, x) => s + x.kwh, 0)
    const totalCustomers = bySource.reduce((s, x) => s + x.customers, 0)
    const totalBilling = bySource.reduce((s, x) => s + x.billing, 0)
    const totalDebt = bySource.reduce((s, x) => s + x.debt, 0)
    const debtRatio = totalBilling > 0 ? (totalDebt / totalBilling) * 100 : 0
    return { totalKwh, totalCustomers, totalBilling, totalDebt, debtRatio }
  }, [bySource])

  // Reading quality — billconsumptiontype tells us whether the billed kWh
  // came from an actual meter read ("A"), an estimate ("E"), or no reading
  // at all ("N/A"/blank/null). Percentages are against stats.totalKwh (the
  // same Non AMR + AMR combined total shown above) rather than re-summing
  // these buckets, so an unrecognized type doesn't silently understate the
  // total — same approach as customer-sales-overview.tsx's identical card.
  const readingQuality = useMemo(() => {
    let actualKwh = 0
    let estimatedKwh = 0
    let noReadingKwh = 0
    let otherKwh = 0
    readingQualityAgg.forEach((row) => {
      const kwh = row.sum_billconsumptionvalue || 0
      const type = (row.billconsumptiontype || "").trim().toUpperCase()
      if (type === "A") actualKwh += kwh
      else if (type === "E") estimatedKwh += kwh
      else if (type === "N/A" || type === "") noReadingKwh += kwh
      else otherKwh += kwh
    })
    const totalKwh = stats.totalKwh
    const pct = (v: number) => (totalKwh > 0 ? (v / totalKwh) * 100 : 0)
    return {
      actualKwh,
      estimatedKwh,
      noReadingKwh,
      otherKwh,
      actualPct: pct(actualKwh),
      estimatedPct: pct(estimatedKwh),
      noReadingPct: pct(noReadingKwh),
      otherPct: pct(otherKwh),
    }
  }, [readingQualityAgg, stats.totalKwh])

  // Zeus's regionname convention (e.g. a trailing "Region" suffix) is
  // resolved against each source's own known list before it's used as
  // that source's district-drill-down filter, same pattern as
  // prepaid-all-sources-overview.tsx.
  const nonAmrRegion = useResolvedRegionName(selectedRegion || "", nonAmrRegionAgg.map((r) => r.regionname))
  const amrRegion = useResolvedRegionName(selectedRegion || "", amrRegionAgg.map((r) => r.regionname))
  const effectiveNonAmrRegion = selectedRegion ? nonAmrRegion : undefined
  const effectiveAmrRegion = selectedRegion ? amrRegion : undefined

  const { data: nonAmrDistrictAgg = [], isLoading: nonAmrDistrictLoading } = useZeusBillingAggregate({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    groupBy: "districtname",
    region: effectiveNonAmrRegion,
    district,
    meterModelType: "Postpaid",
    enabled: Boolean(selectedRegion),
  })
  const { data: amrDistrictAgg = [], isLoading: amrDistrictLoading } = useZeusBillingAggregate({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    groupBy: "districtname",
    region: effectiveAmrRegion,
    district,
    meterModelType: "AMR",
    enabled: Boolean(selectedRegion),
  })

  // Reading quality per district, for the District breakdown table's
  // column — mirrors the region version above, scoped to the selected
  // region like the other district-level calls.
  const { data: readingQualityByDistrictAgg = [] } = useZeusBillingAggregate({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    groupBy: ["districtname", "billconsumptiontype"],
    region: effectiveNonAmrRegion,
    district,
    meterModelType: "Postpaid,AMR",
    enabled: Boolean(selectedRegion),
  })
  const readingQualityByDistrict = useMemo(
    () => buildReadingQualityByKey(readingQualityByDistrictAgg, "districtname"),
    [readingQualityByDistrictAgg],
  )

  const districtLoading = nonAmrDistrictLoading || amrDistrictLoading

  const byDistrict = useMemo<RegionRow[]>(() => {
    const rows = new Map<string, RegionRow>()
    nonAmrDistrictAgg.forEach((r) =>
      mergeBySource(
        rows,
        r.districtname || "Unknown",
        "Non AMR Postpaid",
        r.sum_billconsumptionvalue || 0,
        r.customer_count || 0,
        r.sum_billamount || 0,
        r.sum_debtamount || 0,
      ),
    )
    amrDistrictAgg.forEach((r) =>
      mergeBySource(
        rows,
        r.districtname || "Unknown",
        "AMR Postpaid",
        r.sum_billconsumptionvalue || 0,
        r.customer_count || 0,
        r.sum_billamount || 0,
        r.sum_debtamount || 0,
      ),
    )

    return withLeadingSource(Array.from(rows.values())).sort((a, b) => b.totalKwh - a.totalKwh)
  }, [nonAmrDistrictAgg, amrDistrictAgg])

  const chartData = byRegion.slice(0, 14)

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground">
          Every postpaid source combined — Non AMR Postpaid and AMR Postpaid.
          {selectedRegion ? (
            <span className="text-foreground font-medium"> · filtered by {shortRegionLabel(selectedRegion)}</span>
          ) : null}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Zap className="h-3.5 w-3.5" /> Consumption
            </p>
            {regionLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-bold text-foreground tabular-nums">{formatKwhRaw(stats.totalKwh)}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Non AMR + AMR combined</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> Customers
            </p>
            {regionLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold text-foreground tabular-nums">{formatNumber(stats.totalCustomers)}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Non AMR + AMR combined</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Scale className="h-3.5 w-3.5" /> Billing / Debt
            </p>
            {regionLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-lg font-bold text-foreground tabular-nums">
                {formatMoney(stats.totalBilling)}{" "}
                <span className="text-sm font-medium text-rose-700">/ {formatMoney(stats.totalDebt)}</span>
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Non AMR + AMR combined</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <PercentCircle className="h-3.5 w-3.5" /> Debt ratio
            </p>
            {regionLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold text-rose-700 tabular-nums">
                {stats.debtRatio.toFixed(1)}%
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Debt as a share of billing</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Consumption by source</CardTitle>
          <CardDescription>Total kWh per source across the selected date range</CardDescription>
        </CardHeader>
        <CardContent>
          {regionLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Source</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">Consumption</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">Customers</th>
                    <th className="text-right py-2 pl-4 font-medium text-muted-foreground">Billing / Debt</th>
                  </tr>
                </thead>
                <tbody>
                  {bySource.map((item) => (
                    <tr key={item.source} className="border-b last:border-0">
                      <td className="py-2.5 pr-4 font-medium">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: SOURCE_COLORS[item.source] }}
                          />
                          {item.source}
                        </span>
                      </td>
                      <td
                        className="py-2.5 px-4 text-right font-semibold tabular-nums"
                        style={{ color: SOURCE_COLORS[item.source] }}
                      >
                        {formatKwhRaw(item.kwh)}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{formatNumber(item.customers)}</td>
                      <td className="py-2.5 pl-4 text-right tabular-nums">
                        {formatMoney(item.billing)} <span className="text-rose-700">/ {formatMoney(item.debt)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reading Quality — Postpaid</CardTitle>
          <CardDescription>
            Share of billed Postpaid kWh (Non AMR + AMR) from an actual meter
            read vs. an estimate vs. no reading at all
          </CardDescription>
        </CardHeader>
        <CardContent>
          {readingQualityLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                <div className="bg-green-600" style={{ width: `${readingQuality.actualPct}%` }} />
                <div className="bg-amber-600" style={{ width: `${readingQuality.estimatedPct}%` }} />
                <div className="bg-red-600" style={{ width: `${readingQuality.noReadingPct}%` }} />
                {readingQuality.otherPct > 0 && (
                  <div className="bg-gray-400" style={{ width: `${readingQuality.otherPct}%` }} />
                )}
              </div>
              <div
                className={`grid gap-4 mt-3 ${readingQuality.otherPct > 0 ? "grid-cols-4" : "grid-cols-3"}`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-green-600 shrink-0" />
                    <span className="text-sm font-medium">Actual</span>
                    <span className="text-xs text-muted-foreground">
                      {readingQuality.actualPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xl font-bold text-green-700 mt-0.5">
                    {formatKwh(readingQuality.actualKwh)}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-600 shrink-0" />
                    <span className="text-sm font-medium">Estimated</span>
                    <span className="text-xs text-muted-foreground">
                      {readingQuality.estimatedPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xl font-bold text-amber-700 mt-0.5">
                    {formatKwh(readingQuality.estimatedKwh)}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-600 shrink-0" />
                    <span className="text-sm font-medium">No Reading</span>
                    <span className="text-xs text-muted-foreground">
                      {readingQuality.noReadingPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xl font-bold text-red-700 mt-0.5">
                    {formatKwh(readingQuality.noReadingKwh)}
                  </div>
                </div>
                {readingQuality.otherPct > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-gray-400 shrink-0" />
                      <span className="text-sm font-medium">Other</span>
                      <span className="text-xs text-muted-foreground">
                        {readingQuality.otherPct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xl font-bold text-gray-600 mt-0.5">
                      {formatKwh(readingQuality.otherKwh)}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consumption by region, by source</CardTitle>
          <CardDescription>Click a region to see its district breakdown below</CardDescription>
        </CardHeader>
        <CardContent>
          {regionLoading ? (
            <Skeleton className="h-[320px] w-full" />
          ) : chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No postpaid data for this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} margin={{ top: 20, right: 8, left: 8, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="regionname"
                  tickFormatter={(v: string) => shortRegionLabel(v)}
                  angle={-35}
                  textAnchor="end"
                  tick={{ fontSize: 11 }}
                  interval={0}
                />
                <YAxis
                  tickFormatter={(v) =>
                    Math.abs(v) >= 1_000_000
                      ? `${(v / 1_000_000).toFixed(0)}M`
                      : Math.abs(v) >= 1_000
                        ? `${(v / 1_000).toFixed(0)}k`
                        : String(v)
                  }
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(v: number, name: string) => [formatKwhRaw(v), name]}
                  labelFormatter={(label: string) => shortRegionLabel(label)}
                />
                <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 11 }} />
                {SOURCES.map((source, i) => (
                  <Bar
                    key={source}
                    dataKey={(row: RegionRow) => row.bySource[source]?.kwh ?? 0}
                    name={source}
                    stackId="region"
                    fill={SOURCE_COLORS[source]}
                    radius={i === SOURCES.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                    cursor="pointer"
                    isAnimationActive={false}
                    onClick={(data: { regionname?: string }) => {
                      if (data?.regionname) selectRegion(data.regionname)
                    }}
                  >
                    {chartData.map((row) => (
                      <Cell
                        key={row.regionname}
                        fill={SOURCE_COLORS[source]}
                        fillOpacity={!selectedRegion || selectedRegion === row.regionname ? 1 : 0.35}
                      />
                    ))}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Region breakdown</CardTitle>
            <CardDescription>Click a region to see its district breakdown below</CardDescription>
          </div>
          {selectedRegion && (
            <button
              type="button"
              onClick={() => selectRegion(null)}
              className="text-xs text-muted-foreground hover:underline"
            >
              Clear region filter
            </button>
          )}
        </CardHeader>
        <CardContent>
          {regionLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Region</th>
                    {SOURCES.map((source) => (
                      <th key={source} className="text-right py-2 px-4 font-medium" style={{ color: SOURCE_COLORS[source] }}>
                        {source}
                      </th>
                    ))}
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">Total</th>
                    <th className="text-left py-2 pl-4 font-medium text-muted-foreground">Leading</th>
                    <th className="text-left py-2 pl-4 font-medium text-muted-foreground">Reading Quality</th>
                  </tr>
                </thead>
                <tbody>
                  {byRegion.map((item) => {
                    const rq = readingQualityByRegion.get(normalizeRegionName(item.regionname))
                    const selected = selectedRegion
                      ? normalizeRegionName(selectedRegion) === normalizeRegionName(item.regionname)
                      : false
                    return (
                      <tr
                        key={item.regionname}
                        className={cn(
                          "border-b last:border-0 hover:bg-muted/40 cursor-pointer",
                          selected && "bg-muted/60",
                        )}
                        onClick={() => selectRegion(item.regionname)}
                      >
                        <td className="py-2.5 pr-4 font-medium">{shortRegionLabel(item.regionname)}</td>
                        {SOURCES.map((source) => (
                          <td key={source} className="py-2.5 px-4 text-right tabular-nums">
                            {item.bySource[source]?.kwh ? formatKwhRaw(item.bySource[source]!.kwh) : "—"}
                          </td>
                        ))}
                        <td className="py-2.5 px-4 text-right font-semibold tabular-nums">
                          {formatKwhRaw(item.totalKwh)}
                        </td>
                        <td className="py-2.5 pl-4">
                          {item.leadingSource ? (
                            <span
                              className="inline-flex items-center gap-1.5 text-xs font-medium"
                              style={{ color: SOURCE_COLORS[item.leadingSource] }}
                            >
                              <BarChart3 className="h-3 w-3" />
                              {item.leadingSource}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2.5 pl-4" title={readingQualityTitle(rq)}>
                          {rq ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                              <span className="h-2 w-2 rounded-full bg-green-600 shrink-0" />
                              {rq.actualPct.toFixed(1)}% Actual
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>District breakdown</CardTitle>
          <CardDescription>
            {selectedRegion
              ? `Districts in ${shortRegionLabel(selectedRegion)}`
              : "Select a region above to see its district breakdown"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedRegion ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Click a region in the chart or region table above to drill into districts.
            </p>
          ) : districtLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : byDistrict.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No district data for {shortRegionLabel(selectedRegion)}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">District</th>
                    {SOURCES.map((source) => (
                      <th key={source} className="text-right py-2 px-4 font-medium" style={{ color: SOURCE_COLORS[source] }}>
                        {source}
                      </th>
                    ))}
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">Total</th>
                    <th className="text-left py-2 pl-4 font-medium text-muted-foreground">Leading</th>
                    <th className="text-left py-2 pl-4 font-medium text-muted-foreground">Reading Quality</th>
                  </tr>
                </thead>
                <tbody>
                  {byDistrict.map((item) => {
                    const rq = readingQualityByDistrict.get(normalizeRegionName(item.regionname))
                    return (
                      <tr key={item.regionname} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="py-2.5 pr-4 font-medium">{item.regionname}</td>
                        {SOURCES.map((source) => (
                          <td key={source} className="py-2.5 px-4 text-right tabular-nums">
                            {item.bySource[source]?.kwh ? formatKwhRaw(item.bySource[source]!.kwh) : "—"}
                          </td>
                        ))}
                        <td className="py-2.5 px-4 text-right font-semibold tabular-nums">
                          {formatKwhRaw(item.totalKwh)}
                        </td>
                        <td className="py-2.5 pl-4">
                          {item.leadingSource ? (
                            <span
                              className="inline-flex items-center gap-1.5 text-xs font-medium"
                              style={{ color: SOURCE_COLORS[item.leadingSource] }}
                            >
                              <BarChart3 className="h-3 w-3" />
                              {item.leadingSource}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2.5 pl-4" title={readingQualityTitle(rq)}>
                          {rq ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                              <span className="h-2 w-2 rounded-full bg-green-600 shrink-0" />
                              {rq.actualPct.toFixed(1)}% Actual
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
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
