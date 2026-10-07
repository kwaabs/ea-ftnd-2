"use client"

import { useMemo, useState } from "react"
import { BarChart3, Users, Zap } from "lucide-react"
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
import { useAlphaConsumptionAggregate } from "@/hooks/api/use-alpha-consumption-api"
import { AlphaConsumptionDetailTable } from "@/components/customer-sales/alpha-consumption-detail"
import { cn } from "@/lib/utils"

// Indigo, distinct from the other legacy-meter cards on this page (Zeus
// blue, MMS green, BOT amber, BXC purple, PNS rose, Holley teal).
const ALPHA_COLOR = "#4f46e5"

function formatValueRaw(value: number | null | undefined) {
  if (value === null || value === undefined) return "0"
  return (value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })
}

function formatValue(value: number | null | undefined) {
  if (value === null || value === undefined) return "0"
  if (Math.abs(value) >= 1_000_000)
    return `${(value / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`
  if (Math.abs(value) >= 1_000)
    return `${(value / 1_000).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "0"
  return (value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })
}

interface SubstationRow {
  substation: string
  value: number
  consumers: number
}

interface AlphaConsumptionViewProps {
  dateRange: { start: string; end: string }
}

// No region/district dimension on this source at all (see
// ea-bknd-3/internal/alphaconsumption's package doc comment) — grouped by
// substation instead, the only location-ish dimension it has. energy_code
// is shown as-is in the detail table (no human-readable mapping exists
// yet for this source).
export function AlphaConsumptionView({ dateRange }: AlphaConsumptionViewProps) {
  const [selectedSubstation, setSelectedSubstation] = useState<string | null>(null)

  const selectSubstation = (value: string | null) => {
    setSelectedSubstation((prev) => (prev === value ? null : value))
  }

  const { data: substationAgg = [], isLoading: substationLoading } = useAlphaConsumptionAggregate({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    groupBy: "substation",
  })

  const stats = useMemo(() => {
    const totalValue = substationAgg.reduce((s, r) => s + (r.sum_value || 0), 0)
    const totalConsumers = substationAgg.reduce((s, r) => s + (r.consumer_count || 0), 0)
    return {
      totalValue,
      totalConsumers,
      avgValue: totalConsumers > 0 ? totalValue / totalConsumers : 0,
    }
  }, [substationAgg])

  const bySubstation = useMemo<SubstationRow[]>(() => {
    return substationAgg
      .map((r) => ({
        substation: r.substation || "Unknown",
        value: r.sum_value || 0,
        consumers: r.consumer_count || 0,
      }))
      .sort((a, b) => b.value - a.value)
  }, [substationAgg])

  const effectiveSubstation = selectedSubstation || undefined

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold tracking-tight text-foreground">ALPHA</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Alpha T&amp;D-ingested consumption readings — a legacy Oracle metering source, independent of every other
          source on this page
          {selectedSubstation ? (
            <span className="text-indigo-700"> · filtered by {selectedSubstation}</span>
          ) : null}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Zap className="h-3.5 w-3.5" /> Consumption
            </p>
            {substationLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-bold text-indigo-700 tabular-nums">
                {formatValueRaw(stats.totalValue)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Avg {formatValue(stats.avgValue)} / consumer
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> Consumers
            </p>
            {substationLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold text-indigo-700 tabular-nums">
                {formatNumber(stats.totalConsumers)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Alpha-ingested readings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <BarChart3 className="h-3.5 w-3.5" /> Substations
            </p>
            {substationLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-indigo-700 tabular-nums">{bySubstation.length}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">With alpha-ingested data</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Consumption by substation</CardTitle>
          <CardDescription>Click a substation to filter the consumer records below</CardDescription>
        </CardHeader>
        <CardContent>
          {substationLoading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : bySubstation.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No alpha-consumption data for this period.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={bySubstation} margin={{ top: 20, right: 8, left: 8, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="substation"
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
                <Tooltip formatter={(v: number) => [formatValueRaw(v), "Value"]} />
                <Bar
                  dataKey="value"
                  fill={ALPHA_COLOR}
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                  isAnimationActive={false}
                  onClick={(data: { substation?: string }) => {
                    if (data?.substation) selectSubstation(data.substation)
                  }}
                >
                  {bySubstation.map((row) => (
                    <Cell
                      key={row.substation}
                      fill={ALPHA_COLOR}
                      fillOpacity={!selectedSubstation || selectedSubstation === row.substation ? 1 : 0.35}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Substation breakdown</CardTitle>
            <CardDescription>Click a substation to filter the consumer records below</CardDescription>
          </div>
          {selectedSubstation && (
            <button
              type="button"
              onClick={() => selectSubstation(null)}
              className="text-xs text-indigo-700 hover:underline"
            >
              Clear substation filter
            </button>
          )}
        </CardHeader>
        <CardContent>
          {substationLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Substation</th>
                    <th className="text-right py-2 px-4 font-medium text-indigo-700">Consumption</th>
                    <th className="text-right py-2 pl-4 font-medium text-muted-foreground">Consumers</th>
                  </tr>
                </thead>
                <tbody>
                  {bySubstation.map((item) => {
                    const selected = selectedSubstation === item.substation
                    return (
                      <tr
                        key={item.substation}
                        className={cn(
                          "border-b last:border-0 hover:bg-muted/40 cursor-pointer",
                          selected && "bg-indigo-50",
                        )}
                        onClick={() => selectSubstation(item.substation)}
                      >
                        <td className="py-2.5 pr-4 font-medium">{item.substation}</td>
                        <td className="py-2.5 px-4 text-right font-semibold text-indigo-700 tabular-nums">
                          {formatValueRaw(item.value)}
                        </td>
                        <td className="py-2.5 pl-4 text-right tabular-nums">
                          {formatNumber(item.consumers)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30">
                    <td className="py-2.5 pr-4 font-semibold">Total</td>
                    <td className="py-2.5 px-4 text-right font-bold text-indigo-700 tabular-nums">
                      {formatValueRaw(stats.totalValue)}
                    </td>
                    <td className="py-2.5 pl-4 text-right font-semibold tabular-nums">
                      {formatNumber(stats.totalConsumers)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlphaConsumptionDetailTable dateRange={dateRange} substation={effectiveSubstation} />
    </div>
  )
}
