"use client"

import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Scale, AlertTriangle, TrendingDown, Users } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import {
  useZeusBillingAggregate,
  type ZeusBillingGroupBy,
} from "@/hooks/api/use-zeus-billing-aggregate-api"
import type { ZeusBillingAggregateItem } from "@/types/api"
import { useAppStore } from "@/stores/app-store"

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

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "₵0.00"
  return `₵${(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatMoneyShort(value: number | null | undefined) {
  if (value === null || value === undefined) return "₵0"
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `₵${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `₵${(value / 1_000).toFixed(1)}k`
  return `₵${value.toFixed(0)}`
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "0"
  return (value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })
}

const DEBT_COLORS = [
  "#0369a1",
  "#0284c7",
  "#0ea5e9",
  "#38bdf8",
  "#7dd3fc",
  "#075985",
  "#0c4a6e",
  "#bae6fd",
]

interface BreakdownRow {
  label: string
  debt: number
  due: number
  outstanding: number
  customers: number
}

function toBreakdownRows(
  items: ZeusBillingAggregateItem[],
  keyField: keyof ZeusBillingAggregateItem,
): BreakdownRow[] {
  return items
    .map((item) => ({
      label: (item[keyField] as string) || "Unknown",
      debt: item.sum_debtamount || 0,
      due: item.sum_amountdue || 0,
      outstanding: item.sum_outstandingamount || 0,
      customers: item.customer_count || 0,
    }))
    .sort((a, b) => b.debt - a.debt)
}

interface DebtBreakdownChartProps {
  title: string
  description: string
  rows: BreakdownRow[]
  isLoading: boolean
  emptyLabel?: string
  onBarClick?: (label: string) => void
  selectedLabel?: string | null
  clearLabel?: string
  onClear?: () => void
}

function DebtBreakdownChart({
  title,
  description,
  rows,
  isLoading,
  emptyLabel = "No debt data for this selection.",
  onBarClick,
  selectedLabel,
  clearLabel,
  onClear,
}: DebtBreakdownChartProps) {
  const top = rows.slice(0, 12)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {selectedLabel && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-sky-700 hover:underline shrink-0"
          >
            {clearLabel ?? "Clear filter"}
          </button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : top.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">
            {emptyLabel}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={top}
              margin={{ top: 8, right: 8, left: 8, bottom: 70 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                angle={-35}
                textAnchor="end"
                tick={{ fontSize: 11 }}
                interval={0}
              />
              <YAxis
                tickFormatter={(v) => formatMoneyShort(v)}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(value: number) => [formatMoney(value), "Debt"]}
              />
              <Bar
                dataKey="debt"
                radius={[6, 6, 0, 0]}
                cursor={onBarClick ? "pointer" : undefined}
                onClick={
                  onBarClick
                    ? (data: { label?: string }) => {
                        if (data?.label) onBarClick(data.label)
                      }
                    : undefined
                }
              >
                {top.map((row, i) => (
                  <Cell
                    key={row.label}
                    fill={
                      selectedLabel === row.label
                        ? "#0c4a6e"
                        : DEBT_COLORS[i % DEBT_COLORS.length]
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

const BREAKDOWNS: { groupBy: ZeusBillingGroupBy; field: keyof ZeusBillingAggregateItem; title: string; description: string }[] = [
  {
    groupBy: "accounttype",
    field: "accounttype",
    title: "Debt by account type",
    description: "Outstanding debt grouped by account type",
  },
  {
    groupBy: "metermodeltype",
    field: "metermodeltype",
    title: "Debt by meter model type",
    description: "Postpaid, Prepaid and AMR debt",
  },
  {
    groupBy: "tariffclassname",
    field: "tariffclassname",
    title: "Debt by tariff class",
    description: "Outstanding debt grouped by tariff class",
  },
  {
    groupBy: "servicepointstatus",
    field: "servicepointstatus",
    title: "Debt by service point status",
    description: "Outstanding debt grouped by service point status",
  },
]

export function DebtInsightsView() {
  const searchParams = useSearchParams()
  const { filters: globalFilters } = useAppStore()

  const defaultStart = new Date(new Date().setDate(new Date().getDate() - 30))
    .toISOString()
    .split("T")[0]
  const defaultEnd = new Date().toISOString().split("T")[0]

  const dateRange = {
    start: formatDateToString(globalFilters.dateRange?.start, defaultStart),
    end: formatDateToString(globalFilters.dateRange?.end, defaultEnd),
  }

  const [selectedRegion, setSelectedRegion] = useState<string | null>(
    () => searchParams.get("region") || null,
  )

  const selectRegion = (value: string | null) => {
    setSelectedRegion((prev) => (prev === value ? null : value))
  }

  const { data: regionAgg = [], isLoading: regionLoading } =
    useZeusBillingAggregate({
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
      groupBy: "regionname",
    })

  const { data: districtAgg = [], isLoading: districtLoading } =
    useZeusBillingAggregate({
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
      groupBy: "districtname",
      region: selectedRegion || undefined,
      enabled: Boolean(selectedRegion),
    })

  const breakdownQueries = [
    useZeusBillingAggregate({
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
      groupBy: BREAKDOWNS[0].groupBy,
      region: selectedRegion || undefined,
    }),
    useZeusBillingAggregate({
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
      groupBy: BREAKDOWNS[1].groupBy,
      region: selectedRegion || undefined,
    }),
    useZeusBillingAggregate({
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
      groupBy: BREAKDOWNS[2].groupBy,
      region: selectedRegion || undefined,
    }),
    useZeusBillingAggregate({
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
      groupBy: BREAKDOWNS[3].groupBy,
      region: selectedRegion || undefined,
    }),
  ]

  const stats = useMemo(() => {
    const totalDebt = regionAgg.reduce((s, r) => s + (r.sum_debtamount || 0), 0)
    const totalDue = regionAgg.reduce((s, r) => s + (r.sum_amountdue || 0), 0)
    const totalOutstanding = regionAgg.reduce(
      (s, r) => s + (r.sum_outstandingamount || 0),
      0,
    )
    const totalCustomers = regionAgg.reduce(
      (s, r) => s + (r.customer_count || 0),
      0,
    )
    return { totalDebt, totalDue, totalOutstanding, totalCustomers }
  }, [regionAgg])

  const regionRows = useMemo(
    () => toBreakdownRows(regionAgg, "regionname"),
    [regionAgg],
  )
  const districtRows = useMemo(
    () => toBreakdownRows(districtAgg, "districtname"),
    [districtAgg],
  )

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/customer-sales"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Customer Consumption
        </Link>
        <h2 className="text-3xl font-semibold tracking-tight text-foreground mt-2">
          Debt Insights
        </h2>
        <p className="text-muted-foreground mt-1">
          Outstanding customer debt across regions, districts, account types,
          meter model types, tariff classes and service point status
          {selectedRegion ? (
            <span className="text-sky-700"> · filtered by {selectedRegion}</span>
          ) : null}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Scale className="h-3.5 w-3.5" /> Total debt
            </p>
            {regionLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <p className="text-2xl font-bold text-sky-700 tabular-nums">
                {formatMoney(stats.totalDebt)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <TrendingDown className="h-3.5 w-3.5" /> Amount due
            </p>
            {regionLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <p className="text-2xl font-bold text-amber-700 tabular-nums">
                {formatMoney(stats.totalDue)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Outstanding
            </p>
            {regionLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <p className="text-2xl font-bold text-rose-700 tabular-nums">
                {formatMoney(stats.totalOutstanding)}
              </p>
            )}
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
              <p className="text-2xl font-bold tabular-nums">
                {formatNumber(stats.totalCustomers)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Region -> district drill-down */}
      <div className="grid gap-4 md:grid-cols-2">
        <DebtBreakdownChart
          title="Debt by region"
          description="Click a region to drill into its districts"
          rows={regionRows}
          isLoading={regionLoading}
          onBarClick={selectRegion}
          selectedLabel={selectedRegion}
        />
        <DebtBreakdownChart
          title="Debt by district"
          description={
            selectedRegion
              ? `Districts in ${selectedRegion}`
              : "Select a region to see its district breakdown"
          }
          rows={districtRows}
          isLoading={Boolean(selectedRegion) && districtLoading}
          emptyLabel={
            selectedRegion
              ? "No district-level debt data for this region."
              : "Click a region in the chart on the left to drill in."
          }
          selectedLabel={selectedRegion}
          clearLabel="Clear region filter"
          onClear={selectedRegion ? () => selectRegion(null) : undefined}
        />
      </div>

      {/* Other breakdowns — respect the region drill-down when set */}
      <div className="grid gap-4 md:grid-cols-2">
        {BREAKDOWNS.map((b, i) => (
          <DebtBreakdownChart
            key={b.groupBy}
            title={b.title}
            description={
              selectedRegion ? `${b.description} · ${selectedRegion}` : b.description
            }
            rows={toBreakdownRows(breakdownQueries[i].data ?? [], b.field)}
            isLoading={breakdownQueries[i].isLoading}
          />
        ))}
      </div>
    </div>
  )
}
