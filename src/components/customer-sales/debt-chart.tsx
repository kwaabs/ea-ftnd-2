"use client"

import { useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { BarChart3, LineChart as LineChartIcon } from "lucide-react"
import { useZeusBillingAggregate } from "@/hooks/api/use-zeus-billing-aggregate-api"
import type { ZeusBillingAggregateItem } from "@/types/api"

type ChartKind = "bar" | "line"

type Dimension =
  | "regionname"
  | "districtname"
  | "accounttype"
  | "metermodeltype"
  | "tariffclassname"
  | "servicepointstatus"
  | "overtime"

const DIMENSIONS: { value: Dimension; label: string }[] = [
  { value: "regionname", label: "Region" },
  { value: "districtname", label: "District" },
  { value: "accounttype", label: "Account type" },
  { value: "metermodeltype", label: "Meter model type" },
  { value: "tariffclassname", label: "Tariff class" },
  { value: "servicepointstatus", label: "Service point status" },
  { value: "overtime", label: "Over time (calendar year)" },
]

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

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

interface ChartRow {
  label: string
  debt: number
  due: number
  outstanding: number
  customers: number
}

function toBreakdownRows(
  items: ZeusBillingAggregateItem[],
  keyField: keyof ZeusBillingAggregateItem,
): ChartRow[] {
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

function toMonthlyRows(items: ZeusBillingAggregateItem[]): ChartRow[] {
  const byMonth = new Map<number, ZeusBillingAggregateItem>()
  items.forEach((item) => {
    if (item.billingmonth) byMonth.set(item.billingmonth, item)
  })
  return MONTH_LABELS.map((label, i) => {
    const item = byMonth.get(i + 1)
    return {
      label,
      debt: item?.sum_debtamount || 0,
      due: item?.sum_amountdue || 0,
      outstanding: item?.sum_outstandingamount || 0,
      customers: item?.customer_count || 0,
    }
  })
}

interface DebtChartProps {
  dateRange: { start: string; end: string }
  region?: string
  district?: string
}

export function DebtChart({ dateRange, region, district }: DebtChartProps) {
  const [dimension, setDimension] = useState<Dimension>("regionname")
  const [chartKind, setChartKind] = useState<ChartKind>("bar")

  const isOverTime = dimension === "overtime"
  const currentYear = new Date().getFullYear()

  const { data: aggData = [], isLoading } = useZeusBillingAggregate({
    dateFrom: isOverTime ? `${currentYear}-01-01` : dateRange.start,
    dateTo: isOverTime ? `${currentYear}-12-31` : dateRange.end,
    groupBy: isOverTime ? "billingmonth" : dimension,
    region,
    district,
  })

  const rows = useMemo(
    () => (isOverTime ? toMonthlyRows(aggData) : toBreakdownRows(aggData, dimension)),
    [aggData, dimension, isOverTime],
  )

  const chartData = isOverTime ? rows : rows.slice(0, 15)
  const dimensionLabel = DIMENSIONS.find((d) => d.value === dimension)?.label ?? ""

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap">
        <div>
          <CardTitle>Debt breakdown</CardTitle>
          <CardDescription>
            {isOverTime
              ? `Monthly debt trend for ${currentYear}`
              : `Outstanding debt by ${dimensionLabel.toLowerCase()}`}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={dimension} onValueChange={(v) => setDimension(v as Dimension)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIMENSIONS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            <ToggleGroupItem value="line" aria-label="Line chart">
              <LineChartIcon className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[320px] w-full" />
        ) : chartData.every((r) => r.debt === 0) ? (
          <p className="text-sm text-muted-foreground py-16 text-center">
            No debt data for this selection.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            {chartKind === "bar" ? (
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 16, left: 8, bottom: 70 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  angle={isOverTime ? 0 : -35}
                  textAnchor={isOverTime ? "middle" : "end"}
                  tick={{ fontSize: 11 }}
                  interval={0}
                />
                <YAxis tickFormatter={(v) => formatMoneyShort(v)} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => [formatMoney(value), "Debt"]} />
                <Bar dataKey="debt" radius={[6, 6, 0, 0]}>
                  {chartData.map((row, i) => (
                    <Cell key={row.label} fill={DEBT_COLORS[i % DEBT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 16, left: 8, bottom: 70 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  angle={isOverTime ? 0 : -35}
                  textAnchor={isOverTime ? "middle" : "end"}
                  tick={{ fontSize: 11 }}
                  interval={0}
                />
                <YAxis tickFormatter={(v) => formatMoneyShort(v)} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => [formatMoney(value), "Debt"]} />
                <Line
                  type="monotone"
                  dataKey="debt"
                  stroke="#0369a1"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#0369a1" }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
