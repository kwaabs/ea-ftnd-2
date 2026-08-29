"use client"

import { useMemo, useState } from "react"
import {
  AreaChartIcon,
  BarChart3,
  BatteryCharging,
  Clock,
  Scale,
  Users,
  Wallet,
  Zap,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useZeusBillingAggregate } from "@/hooks/api/use-zeus-billing-aggregate-api"
import { useMmsCustomerSalesAggregate } from "@/hooks/api/use-mms-customer-sales-aggregate-api"
import { CustomerSalesDetail } from "@/components/customer-sales/customer-sales-detail"
import { MmsCustomerSalesDetail } from "@/components/customer-sales/mms-customer-sales-detail"
import { BotConsumptionView } from "@/components/customer-sales/bot-consumption-view"
import {
  normalizeRegionName,
  shortRegionLabel,
  useResolvedRegionName,
} from "@/hooks/use-resolved-region-name"
import { useAppStore } from "@/stores/app-store"
import { cn } from "@/lib/utils"

function formatDateToString(
  date: Date | string | undefined,
  fallback: string,
): string {
  if (!date) return fallback
  if (date instanceof Date) return date.toISOString().split("T")[0]
  if (typeof date === "string")
    return date.includes("T") ? date.split("T")[0] : date
  return fallback
}

function formatKwhRaw(value: number | null | undefined) {
  if (value === null || value === undefined) return "0 kWh"
  return `${(value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} kWh`
}

function formatKwh(value: number | null | undefined) {
  if (value === null || value === undefined) return "0"
  if (Math.abs(value) >= 1_000_000)
    return `${(value / 1_000_000).toFixed(2)}M kWh`
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k kWh`
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 0 })} kWh`
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "0"
  return (value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "₵0.00"
  return `₵${(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// CORRECTION (see git history): an earlier version of this comment claimed
// Zeus Prepaid and MMS never share a region — that was wrong, an artifact
// of comparing region strings without stripping the "Region"/"District"
// suffix mismatch (the recurring bug this whole codebase has elsewhere).
// Properly normalized, they substantially overlap: 249,091 Zeus Prepaid
// meters matched an MMS meter_number, 75% of those also sharing a
// district — real duplication, confirmed against production data, not
// coincidence. Business rule (confirmed with the user): where the two are
// blended, MMS takes precedence on any meter it already has; Zeus Prepaid
// fills in only what MMS doesn't have. The region/district aggregate
// queries below pass excludeMmsDuplicates: true to apply this — see that
// flag's doc comment in use-zeus-billing-aggregate-api.ts and
// sql/zeus_prepaid_mms_precedence.sql (ea-bknd-3) for the mechanism.
// Kept visually distinct from each other (blue vs green) rather than two
// close shades of green — a same-hue pairing here reads as identical in a
// small legend swatch, same failure mode as the Postpaid chart's AMR stack.
const ZEUS_COLOR = "#2563eb"
const MMS_COLOR = "#16a34a"

type ChartKind = "bar" | "area"

interface RegionChartRow {
  regionname: string
  zeusKwh: number
  mmsKwh: number
  totalKwh: number
  customerCount: number
}

/** Renders both the total consumption and total customer-count figures above a stacked bar/area point. */
function DualValueLabel(
  props: { data: RegionChartRow[] } & Record<string, unknown>,
) {
  const x = Number(props.x) || 0
  const y = Number(props.y) || 0
  const width = Number(props.width) || 0
  const index = Number(props.index) || 0
  const row = props.data[index]
  if (!row) return null
  const cx = x + width / 2
  return (
    <g>
      <text x={cx} y={y - 20} textAnchor="middle" className="fill-emerald-700 text-[11px] font-semibold">
        {formatKwh(row.totalKwh)}
      </text>
      <text x={cx} y={y - 7} textAnchor="middle" className="fill-teal-700 text-[10px] font-medium">
        {formatNumber(row.customerCount)} cust.
      </text>
    </g>
  )
}

export function PrepaidHubView() {
  const { filters: globalFilters } = useAppStore()

  const defaultStart = new Date(new Date().setDate(new Date().getDate() - 30))
    .toISOString()
    .split("T")[0]
  const defaultEnd = new Date().toISOString().split("T")[0]

  const dateRange = {
    start: formatDateToString(globalFilters.dateRange?.start, defaultStart),
    end: formatDateToString(globalFilters.dateRange?.end, defaultEnd),
  }

  const region =
    globalFilters.regions?.length > 0
      ? globalFilters.regions.join(",")
      : undefined
  const district =
    globalFilters.districts?.length > 0
      ? globalFilters.districts.join(",")
      : undefined

  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [chartKind, setChartKind] = useState<ChartKind>("bar")
  const rawEffectiveRegion = selectedRegion || region

  const selectRegion = (value: string | null) => {
    setSelectedRegion((prev) => (prev === value ? null : value))
  }

  const { data: zeusRegionAgg = [], isLoading: zeusRegionLoading } =
    useZeusBillingAggregate({
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
      groupBy: "regionname",
      region,
      district,
      meterModelType: "Prepaid",
      // This is the blended figure (summed with mmsRegionAgg below) — MMS
      // takes precedence on any meter it already has. See the flag's doc
      // comment for the confirmed rule and its scope.
      excludeMmsDuplicates: true,
    })

  const { data: mmsRegionAgg = [], isLoading: mmsRegionLoading } =
    useMmsCustomerSalesAggregate({
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
      groupBy: "region",
      region,
      district,
    })

  const { data: zeusAccountTypeAgg = [] } = useZeusBillingAggregate({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    groupBy: "accounttype",
    region: rawEffectiveRegion,
    district,
    meterModelType: "Prepaid",
  })

  const { data: mmsManufacturerAgg = [] } = useMmsCustomerSalesAggregate({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    groupBy: "manufacturer",
    region: rawEffectiveRegion,
    district,
  })

  // Each source has its own regionname convention (e.g. a trailing
  // "Region" suffix may or may not be present) — resolve the clicked/filter
  // region against each source's own known list before using it as that
  // source's filter param, same pattern as region-detail.tsx.
  const zeusRegion = useResolvedRegionName(
    rawEffectiveRegion || "",
    zeusRegionAgg.map((r) => r.regionname),
  )
  const mmsRegion = useResolvedRegionName(
    rawEffectiveRegion || "",
    mmsRegionAgg.map((r) => r.region),
  )
  const effectiveZeusRegion = rawEffectiveRegion ? zeusRegion : undefined
  const effectiveMmsRegion = rawEffectiveRegion ? mmsRegion : undefined

  const { data: zeusDistrictAgg = [], isLoading: zeusDistrictLoading } =
    useZeusBillingAggregate({
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
      groupBy: "districtname",
      region: effectiveZeusRegion,
      district,
      meterModelType: "Prepaid",
      enabled: Boolean(rawEffectiveRegion),
      // Same blended-figure scope as the region query above.
      excludeMmsDuplicates: true,
    })

  const { data: mmsDistrictAgg = [], isLoading: mmsDistrictLoading } =
    useMmsCustomerSalesAggregate({
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
      groupBy: "district",
      region: effectiveMmsRegion,
      district,
      enabled: Boolean(rawEffectiveRegion),
    })

  const stats = useMemo(() => {
    const zeusKwh = zeusRegionAgg.reduce(
      (s, r) => s + (r.sum_billconsumptionvalue || 0),
      0,
    )
    const zeusCustomers = zeusRegionAgg.reduce(
      (s, r) => s + (r.customer_count || 0),
      0,
    )
    const zeusBilling = zeusRegionAgg.reduce(
      (s, r) => s + (r.sum_billamount || 0),
      0,
    )
    const zeusDebt = zeusRegionAgg.reduce(
      (s, r) => s + (r.sum_debtamount || 0),
      0,
    )
    const mmsKwh = mmsRegionAgg.reduce(
      (s, r) => s + (r.sum_last_month_kwh_read || 0),
      0,
    )
    const mmsCustomers = mmsRegionAgg.reduce(
      (s, r) => s + (r.customer_count || 0),
      0,
    )
    const mmsCredit = mmsRegionAgg.reduce(
      (s, r) => s + (r.sum_last_month_credit_read || 0),
      0,
    )
    const mmsBalance = mmsRegionAgg.reduce(
      (s, r) => s + (r.sum_credit_balance_remaining || 0),
      0,
    )
    const totalKwh = zeusKwh + mmsKwh
    const totalCustomers = zeusCustomers + mmsCustomers
    return {
      totalKwh,
      totalCustomers,
      avgKwh: totalCustomers > 0 ? totalKwh / totalCustomers : 0,
      zeusBilling,
      zeusDebt,
      mmsCredit,
      mmsBalance,
    }
  }, [zeusRegionAgg, mmsRegionAgg])

  const byConsumption = useMemo<RegionChartRow[]>(() => {
    const rows = new Map<string, RegionChartRow>()
    const ensure = (raw: string) => {
      const key = normalizeRegionName(raw)
      let row = rows.get(key)
      if (!row) {
        row = {
          regionname: raw,
          zeusKwh: 0,
          mmsKwh: 0,
          totalKwh: 0,
          customerCount: 0,
        }
        rows.set(key, row)
      }
      return row
    }

    zeusRegionAgg.forEach((r) => {
      const row = ensure(r.regionname || "Unknown")
      row.zeusKwh += r.sum_billconsumptionvalue || 0
      row.customerCount += r.customer_count || 0
    })
    mmsRegionAgg.forEach((r) => {
      const row = ensure(r.region || "Unknown")
      row.mmsKwh += r.sum_last_month_kwh_read || 0
      row.customerCount += r.customer_count || 0
    })

    return Array.from(rows.values())
      .map((row) => ({ ...row, totalKwh: row.zeusKwh + row.mmsKwh }))
      .sort((a, b) => b.totalKwh - a.totalKwh)
      .slice(0, 14)
  }, [zeusRegionAgg, mmsRegionAgg])

  const regionLoading = zeusRegionLoading || mmsRegionLoading
  const districtLoading = zeusDistrictLoading || mmsDistrictLoading

  interface DistrictRow {
    districtname: string
    zeusKwh: number
    mmsKwh: number
    zeusCustomers: number
    mmsCustomers: number
  }
  const byDistrict = useMemo<DistrictRow[]>(() => {
    const rows = new Map<string, DistrictRow>()
    const ensure = (raw: string) => {
      const key = normalizeRegionName(raw)
      let row = rows.get(key)
      if (!row) {
        row = {
          districtname: raw,
          zeusKwh: 0,
          mmsKwh: 0,
          zeusCustomers: 0,
          mmsCustomers: 0,
        }
        rows.set(key, row)
      }
      return row
    }
    zeusDistrictAgg.forEach((r) => {
      const row = ensure(r.districtname || "Unknown")
      row.zeusKwh += r.sum_billconsumptionvalue || 0
      row.zeusCustomers += r.customer_count || 0
    })
    mmsDistrictAgg.forEach((r) => {
      const row = ensure(r.district || "Unknown")
      row.mmsKwh += r.sum_last_month_kwh_read || 0
      row.mmsCustomers += r.customer_count || 0
    })
    return Array.from(rows.values()).sort(
      (a, b) => b.zeusKwh + b.mmsKwh - (a.zeusKwh + a.mmsKwh),
    )
  }, [zeusDistrictAgg, mmsDistrictAgg])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">
          Prepaid
        </h2>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="legacy-meters">Legacy Meters</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-6">
      <p className="text-muted-foreground">
        Zeus prepaid accounts and MMS prepaid meters, blended — MMS takes
        precedence on any meter it already has, so nothing is counted twice
        {selectedRegion ? (
          <span className="text-emerald-700">
            {" "}
            · filtered by {shortRegionLabel(selectedRegion)}
          </span>
        ) : null}
      </p>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Zap className="h-3.5 w-3.5" /> Consumption
            </p>
            {regionLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-bold text-emerald-700 tabular-nums">
                {formatKwhRaw(stats.totalKwh)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Avg {formatKwh(stats.avgKwh)} / customer · Zeus + MMS combined
            </p>
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
              <p className="text-2xl font-bold text-teal-700 tabular-nums">
                {formatNumber(stats.totalCustomers)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Prepaid accounts · Zeus + MMS combined
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Scale className="h-3.5 w-3.5" /> Zeus billing
            </p>
            {regionLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <p className="text-2xl font-bold text-emerald-700 tabular-nums">
                {formatMoney(stats.zeusBilling)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Debt {formatMoney(stats.zeusDebt)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <BatteryCharging className="h-3.5 w-3.5" /> MMS credit purchased
            </p>
            {regionLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <p className="text-2xl font-bold text-green-700 tabular-nums">
                {formatMoney(stats.mmsCredit)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Wallet className="h-3.5 w-3.5" /> MMS credit balance
            </p>
            {regionLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <p className="text-2xl font-bold text-green-700 tabular-nums">
                {formatMoney(stats.mmsBalance)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>Consumption &amp; customers by region</CardTitle>
            <CardDescription>
              Billed/read kWh per region, stacked by source — Zeus Prepaid vs MMS
            </CardDescription>
          </div>
          <ToggleGroup
            type="single"
            value={chartKind}
            onValueChange={(v) => {
              if (v) setChartKind(v as ChartKind)
            }}
            variant="outline"
          >
            <ToggleGroupItem value="bar" aria-label="Bar chart">
              <BarChart3 className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="area" aria-label="Area chart">
              <AreaChartIcon className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </CardHeader>
        <CardContent>
          {regionLoading ? (
            <Skeleton className="h-[320px] w-full" />
          ) : byConsumption.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No Zeus or MMS prepaid data for this period.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              {chartKind === "bar" ? (
                <BarChart
                  data={byConsumption}
                  margin={{ top: 40, right: 8, left: 8, bottom: 80 }}
                >
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
                  <Bar
                    dataKey="zeusKwh"
                    name="Zeus Prepaid"
                    stackId="region"
                    fill={ZEUS_COLOR}
                    radius={[0, 0, 0, 0]}
                    cursor="pointer"
                    isAnimationActive={false}
                    onClick={(data: { regionname?: string }) => {
                      if (data?.regionname) selectRegion(data.regionname)
                    }}
                  >
                    {byConsumption.map((row) => (
                      <Cell
                        key={row.regionname}
                        fill={ZEUS_COLOR}
                        fillOpacity={
                          !selectedRegion || selectedRegion === row.regionname ? 1 : 0.35
                        }
                      />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="mmsKwh"
                    name="MMS"
                    stackId="region"
                    fill={MMS_COLOR}
                    radius={[6, 6, 0, 0]}
                    cursor="pointer"
                    isAnimationActive={false}
                    onClick={(data: { regionname?: string }) => {
                      if (data?.regionname) selectRegion(data.regionname)
                    }}
                  >
                    <LabelList
                      dataKey="mmsKwh"
                      content={(props) => <DualValueLabel {...props} data={byConsumption} />}
                    />
                    {byConsumption.map((row) => (
                      <Cell
                        key={row.regionname}
                        fill={MMS_COLOR}
                        fillOpacity={
                          !selectedRegion || selectedRegion === row.regionname ? 1 : 0.35
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <AreaChart
                  data={byConsumption}
                  margin={{ top: 40, right: 8, left: 8, bottom: 80 }}
                >
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
                  <Area
                    type="monotone"
                    dataKey="zeusKwh"
                    name="Zeus Prepaid"
                    stackId="region"
                    stroke={ZEUS_COLOR}
                    fill={ZEUS_COLOR}
                    fillOpacity={0.35}
                    strokeWidth={2}
                    dot={{ r: 3, fill: ZEUS_COLOR }}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="mmsKwh"
                    name="MMS"
                    stackId="region"
                    stroke={MMS_COLOR}
                    fill={MMS_COLOR}
                    fillOpacity={0.35}
                    strokeWidth={2}
                    dot={{ r: 3, fill: MMS_COLOR }}
                    isAnimationActive={false}
                  >
                    <LabelList
                      dataKey="mmsKwh"
                      content={(props) => <DualValueLabel {...props} data={byConsumption} />}
                    />
                  </Area>
                </AreaChart>
              )}
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="regions">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="regions" className="data-[state=active]:text-emerald-700">
            By region
          </TabsTrigger>
          <TabsTrigger value="districts" className="data-[state=active]:text-emerald-700">
            By district
          </TabsTrigger>
        </TabsList>

        <TabsContent value="regions" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Region breakdown</CardTitle>
                <CardDescription>
                  Click a region to filter districts and the detail tables below
                </CardDescription>
              </div>
              {selectedRegion && (
                <button
                  type="button"
                  onClick={() => selectRegion(null)}
                  className="text-xs text-emerald-700 hover:underline"
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
                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                          Region
                        </th>
                        <th className="text-right py-2 px-4 font-medium text-emerald-700">
                          Consumption
                        </th>
                        <th className="text-right py-2 px-4 font-medium text-muted-foreground">
                          Customers
                        </th>
                        <th className="text-right py-2 px-4 font-medium text-emerald-700">
                          Zeus billing
                        </th>
                        <th className="text-right py-2 px-4 font-medium text-sky-700">
                          Zeus debt
                        </th>
                        <th className="text-right py-2 px-4 font-medium text-green-700">
                          MMS credit
                        </th>
                        <th className="text-right py-2 pl-4 font-medium text-green-700">
                          MMS balance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        interface RegionRow {
                          regionname: string
                          zeusKwh: number
                          mmsKwh: number
                          customers: number
                          zeusBilling: number
                          zeusDebt: number
                          mmsCredit: number
                          mmsBalance: number
                        }
                        const rows = new Map<string, RegionRow>()
                        const ensure = (raw: string) => {
                          const key = normalizeRegionName(raw)
                          let row = rows.get(key)
                          if (!row) {
                            row = {
                              regionname: shortRegionLabel(raw),
                              zeusKwh: 0,
                              mmsKwh: 0,
                              customers: 0,
                              zeusBilling: 0,
                              zeusDebt: 0,
                              mmsCredit: 0,
                              mmsBalance: 0,
                            }
                            rows.set(key, row)
                          }
                          return row
                        }
                        zeusRegionAgg.forEach((r) => {
                          const row = ensure(r.regionname || "Unknown")
                          row.zeusKwh += r.sum_billconsumptionvalue || 0
                          row.customers += r.customer_count || 0
                          row.zeusBilling += r.sum_billamount || 0
                          row.zeusDebt += r.sum_debtamount || 0
                        })
                        mmsRegionAgg.forEach((r) => {
                          const row = ensure(r.region || "Unknown")
                          row.mmsKwh += r.sum_last_month_kwh_read || 0
                          row.customers += r.customer_count || 0
                          row.mmsCredit += r.sum_last_month_credit_read || 0
                          row.mmsBalance += r.sum_credit_balance_remaining || 0
                        })

                        return Array.from(rows.values())
                          .sort((a, b) => b.zeusKwh + b.mmsKwh - (a.zeusKwh + a.mmsKwh))
                          .map((item) => {
                            const selected = selectedRegion
                              ? normalizeRegionName(selectedRegion) === normalizeRegionName(item.regionname)
                              : false
                            return (
                              <tr
                                key={item.regionname}
                                className={cn(
                                  "border-b last:border-0 hover:bg-muted/40 cursor-pointer",
                                  selected && "bg-emerald-50",
                                )}
                                onClick={() => selectRegion(item.regionname)}
                              >
                                <td className="py-2.5 pr-4 font-medium">{item.regionname}</td>
                                <td className="py-2.5 px-4 text-right font-semibold text-emerald-700 tabular-nums">
                                  {formatKwhRaw(item.zeusKwh + item.mmsKwh)}
                                </td>
                                <td className="py-2.5 px-4 text-right tabular-nums">
                                  {formatNumber(item.customers)}
                                </td>
                                <td className="py-2.5 px-4 text-right text-emerald-700 tabular-nums">
                                  {item.zeusBilling ? formatMoney(item.zeusBilling) : "—"}
                                </td>
                                <td className="py-2.5 px-4 text-right text-sky-700 tabular-nums">
                                  {item.zeusDebt ? formatMoney(item.zeusDebt) : "—"}
                                </td>
                                <td className="py-2.5 px-4 text-right text-green-700 tabular-nums">
                                  {item.mmsCredit ? formatMoney(item.mmsCredit) : "—"}
                                </td>
                                <td className="py-2.5 pl-4 text-right text-green-700 tabular-nums">
                                  {item.mmsBalance ? formatMoney(item.mmsBalance) : "—"}
                                </td>
                              </tr>
                            )
                          })
                      })()}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/30">
                        <td className="py-2.5 pr-4 font-semibold">Total</td>
                        <td className="py-2.5 px-4 text-right font-bold text-emerald-700 tabular-nums">
                          {formatKwhRaw(stats.totalKwh)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold tabular-nums">
                          {formatNumber(stats.totalCustomers)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-emerald-700 tabular-nums">
                          {formatMoney(stats.zeusBilling)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-sky-700 tabular-nums">
                          {formatMoney(stats.zeusDebt)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-green-700 tabular-nums">
                          {formatMoney(stats.mmsCredit)}
                        </td>
                        <td className="py-2.5 pl-4 text-right font-semibold text-green-700 tabular-nums">
                          {formatMoney(stats.mmsBalance)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="districts" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>District breakdown</CardTitle>
              <CardDescription>
                {rawEffectiveRegion
                  ? `Districts in ${shortRegionLabel(rawEffectiveRegion)}`
                  : "Select a region above to see district breakdown"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!rawEffectiveRegion ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Click a region in the chart or region table to drill into
                  districts.
                </p>
              ) : districtLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : byDistrict.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No district data for {shortRegionLabel(rawEffectiveRegion)}.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                          District
                        </th>
                        <th className="text-right py-2 px-4 font-medium text-emerald-700">
                          Zeus kWh
                        </th>
                        <th className="text-right py-2 px-4 font-medium text-muted-foreground">
                          Zeus customers
                        </th>
                        <th className="text-right py-2 px-4 font-medium text-green-700">
                          MMS kWh
                        </th>
                        <th className="text-right py-2 pl-4 font-medium text-muted-foreground">
                          MMS customers
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {byDistrict.map((item) => (
                        <tr key={item.districtname} className="border-b last:border-0 hover:bg-muted/40">
                          <td className="py-2.5 pr-4 font-medium">{item.districtname}</td>
                          <td className="py-2.5 px-4 text-right text-emerald-700 tabular-nums">
                            {item.zeusKwh ? formatKwhRaw(item.zeusKwh) : "—"}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums">
                            {item.zeusCustomers ? formatNumber(item.zeusCustomers) : "—"}
                          </td>
                          <td className="py-2.5 px-4 text-right text-green-700 tabular-nums">
                            {item.mmsKwh ? formatKwhRaw(item.mmsKwh) : "—"}
                          </td>
                          <td className="py-2.5 pl-4 text-right tabular-nums">
                            {item.mmsCustomers ? formatNumber(item.mmsCustomers) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Zeus/MMS don't share a customer or account schema (billing vs
          prepaid-token accounting), so these stay as two distinct
          breakdowns rather than a forced merge. */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Zeus Prepaid — account type</CardTitle>
            <CardDescription>Consumption and customers by account type</CardDescription>
          </CardHeader>
          <CardContent>
            {zeusAccountTypeAgg.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No data.</p>
            ) : (
              <div className="overflow-x-auto max-h-[240px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Type</th>
                      <th className="text-right py-2 px-3 font-medium text-emerald-700">kWh</th>
                      <th className="text-right py-2 pl-3 font-medium text-muted-foreground">Customers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...zeusAccountTypeAgg]
                      .sort((a, b) => (b.sum_billconsumptionvalue || 0) - (a.sum_billconsumptionvalue || 0))
                      .map((item) => (
                        <tr key={item.accounttype || "unknown"} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-medium">{item.accounttype || "—"}</td>
                          <td className="py-2 px-3 text-right text-emerald-700 tabular-nums">
                            {formatKwhRaw(item.sum_billconsumptionvalue)}
                          </td>
                          <td className="py-2 pl-3 text-right tabular-nums">
                            {formatNumber(item.customer_count)}
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
            <CardTitle>MMS — manufacturer</CardTitle>
            <CardDescription>Consumption and customers by meter manufacturer</CardDescription>
          </CardHeader>
          <CardContent>
            {mmsManufacturerAgg.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No data.</p>
            ) : (
              <div className="overflow-x-auto max-h-[240px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Manufacturer</th>
                      <th className="text-right py-2 px-3 font-medium text-green-700">kWh</th>
                      <th className="text-right py-2 pl-3 font-medium text-muted-foreground">Customers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...mmsManufacturerAgg]
                      .sort((a, b) => (b.sum_last_month_kwh_read || 0) - (a.sum_last_month_kwh_read || 0))
                      .map((item) => (
                        <tr key={item.manufacturer || "unknown"} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-medium">{item.manufacturer || "—"}</td>
                          <td className="py-2 px-3 text-right text-green-700 tabular-nums">
                            {formatKwhRaw(item.sum_last_month_kwh_read)}
                          </td>
                          <td className="py-2 pl-3 text-right tabular-nums">
                            {formatNumber(item.customer_count)}
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

      {/* Detail records — Zeus (324K prepaid accounts) and MMS (1.29M
          meters) are too large to merge-sort client-side, and their row
          schemas don't line up (billing/debt vs prepaid credit/balance),
          so they stay as two separate tables rather than one interleaved
          one. Sub-tabbed instead of stacked, and both capped to the same
          500px scrollable height (customer-sales-detail.tsx's convention)
          so switching between them doesn't jump the page around. */}
      <Tabs defaultValue="zeus-detail">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="zeus-detail" className="data-[state=active]:text-emerald-700">
            Zeus Prepaid
          </TabsTrigger>
          <TabsTrigger value="mms-detail" className="data-[state=active]:text-green-700">
            MMS
          </TabsTrigger>
        </TabsList>
        <TabsContent value="zeus-detail" className="mt-4">
          <CustomerSalesDetail
            dateRange={dateRange}
            region={effectiveZeusRegion}
            district={district}
            serviceType="Prepaid"
          />
        </TabsContent>
        <TabsContent value="mms-detail" className="mt-4">
          <MmsCustomerSalesDetail
            dateRange={dateRange}
            region={effectiveMmsRegion}
            district={district}
          />
        </TabsContent>
      </Tabs>
        </TabsContent>

        <TabsContent value="legacy-meters" className="mt-4">
          <Tabs defaultValue="bot">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="bot">BOT</TabsTrigger>
              <TabsTrigger value="bxc">BXC</TabsTrigger>
            </TabsList>
            <TabsContent value="bot" className="mt-4">
              <BotConsumptionView dateRange={dateRange} />
            </TabsContent>
            <TabsContent value="bxc" className="mt-4">
              <Card>
                <CardContent className="py-16 flex flex-col items-center justify-center text-center gap-2">
                  <Clock className="h-8 w-8 text-muted-foreground" />
                  <h3 className="text-lg font-semibold text-foreground">BXC</h3>
                  <p className="text-sm text-muted-foreground">Coming soon</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  )
}
