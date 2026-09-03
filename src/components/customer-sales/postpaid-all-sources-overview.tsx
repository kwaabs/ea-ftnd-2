"use client"

import { useMemo, useState } from "react"
import { BarChart3, Scale, Trophy, Users, Zap } from "lucide-react"
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
    const leading = bySource.find((x) => x.kwh > 0)
    return { totalKwh, totalCustomers, totalBilling, totalDebt, leadingSource: leading?.source ?? "—" }
  }, [bySource])

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
              <Trophy className="h-3.5 w-3.5" /> Leading source
            </p>
            {regionLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <p
                className="text-2xl font-bold tabular-nums"
                style={{ color: stats.leadingSource !== "—" ? SOURCE_COLORS[stats.leadingSource as Source] : undefined }}
              >
                {stats.leadingSource}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">By total consumption</p>
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
                  </tr>
                </thead>
                <tbody>
                  {byRegion.map((item) => {
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
                  </tr>
                </thead>
                <tbody>
                  {byDistrict.map((item) => (
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
