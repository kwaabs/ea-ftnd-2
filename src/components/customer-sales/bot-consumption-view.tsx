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
import { useBotConsumptionAggregate } from "@/hooks/api/use-bot-consumption-api"
import { BotConsumptionDetailTable } from "@/components/customer-sales/bot-consumption-detail"
import { normalizeRegionName, shortRegionLabel } from "@/hooks/use-resolved-region-name"
import { cn } from "@/lib/utils"

// Amber, distinct from Zeus (blue) and MMS (green) elsewhere on this page.
const BOT_COLOR = "#d97706"

function formatKwhRaw(value: number | null | undefined) {
  if (value === null || value === undefined) return "0 kWh"
  return `${(value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} kWh`
}

function formatKwh(value: number | null | undefined) {
  if (value === null || value === undefined) return "0"
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M kWh`
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k kWh`
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 0 })} kWh`
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "0"
  return (value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })
}

interface RegionRow {
  regionname: string
  kwh: number
  customers: number
}

interface BotConsumptionViewProps {
  dateRange: { start: string; end: string }
}

export function BotConsumptionView({ dateRange }: BotConsumptionViewProps) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)

  const selectRegion = (value: string | null) => {
    setSelectedRegion((prev) => (prev === value ? null : value))
  }

  const { data: regionAgg = [], isLoading: regionLoading } = useBotConsumptionAggregate({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    groupBy: "region",
  })

  const stats = useMemo(() => {
    const totalKwh = regionAgg.reduce((s, r) => s + (r.sum_kwh || 0), 0)
    const totalCustomers = regionAgg.reduce((s, r) => s + (r.customer_count || 0), 0)
    return {
      totalKwh,
      totalCustomers,
      avgKwh: totalCustomers > 0 ? totalKwh / totalCustomers : 0,
    }
  }, [regionAgg])

  // Region is already trimmed server-side (region is bpchar(15) — see
  // ea-bknd-3/internal/botconsumption/service.go), but GROUP BY there isn't
  // case-folded, so two rows differing only in casing would still land as
  // separate groups if the source data is ever inconsistent — merge on the
  // same normalized key used everywhere else on this page as a cheap
  // client-side safety net.
  const byRegion = useMemo<RegionRow[]>(() => {
    const rows = new Map<string, RegionRow>()
    regionAgg.forEach((r) => {
      const raw = r.region || "Unknown"
      const key = normalizeRegionName(raw)
      let row = rows.get(key)
      if (!row) {
        row = { regionname: raw, kwh: 0, customers: 0 }
        rows.set(key, row)
      }
      row.kwh += r.sum_kwh || 0
      row.customers += r.customer_count || 0
    })
    return Array.from(rows.values()).sort((a, b) => b.kwh - a.kwh)
  }, [regionAgg])

  const effectiveRegion = selectedRegion || undefined

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold tracking-tight text-foreground">BOT</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Bot-ingested consumption readings — a legacy meter source, independent of Zeus and MMS
          {selectedRegion ? (
            <span className="text-amber-700"> · filtered by {shortRegionLabel(selectedRegion)}</span>
          ) : null}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Zap className="h-3.5 w-3.5" /> Consumption
            </p>
            {regionLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-bold text-amber-700 tabular-nums">
                {formatKwhRaw(stats.totalKwh)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Avg {formatKwh(stats.avgKwh)} / customer
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
              <p className="text-2xl font-bold text-amber-700 tabular-nums">
                {formatNumber(stats.totalCustomers)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Bot-ingested readings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <BarChart3 className="h-3.5 w-3.5" /> Regions
            </p>
            {regionLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-amber-700 tabular-nums">{byRegion.length}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">With bot-ingested data</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Consumption by region</CardTitle>
          <CardDescription>Click a region to filter the customer records below</CardDescription>
        </CardHeader>
        <CardContent>
          {regionLoading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : byRegion.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No bot-consumption data for this period.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byRegion} margin={{ top: 20, right: 8, left: 8, bottom: 60 }}>
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
                  formatter={(v: number) => [formatKwhRaw(v), "kWh"]}
                  labelFormatter={(label: string) => shortRegionLabel(label)}
                />
                <Bar
                  dataKey="kwh"
                  fill={BOT_COLOR}
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                  isAnimationActive={false}
                  onClick={(data: { regionname?: string }) => {
                    if (data?.regionname) selectRegion(data.regionname)
                  }}
                >
                  {byRegion.map((row) => (
                    <Cell
                      key={row.regionname}
                      fill={BOT_COLOR}
                      fillOpacity={!selectedRegion || selectedRegion === row.regionname ? 1 : 0.35}
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
            <CardTitle>Region breakdown</CardTitle>
            <CardDescription>Click a region to filter the customer records below</CardDescription>
          </div>
          {selectedRegion && (
            <button
              type="button"
              onClick={() => selectRegion(null)}
              className="text-xs text-amber-700 hover:underline"
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
                    <th className="text-right py-2 px-4 font-medium text-amber-700">Consumption</th>
                    <th className="text-right py-2 pl-4 font-medium text-muted-foreground">Customers</th>
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
                          selected && "bg-amber-50",
                        )}
                        onClick={() => selectRegion(item.regionname)}
                      >
                        <td className="py-2.5 pr-4 font-medium">{shortRegionLabel(item.regionname)}</td>
                        <td className="py-2.5 px-4 text-right font-semibold text-amber-700 tabular-nums">
                          {formatKwhRaw(item.kwh)}
                        </td>
                        <td className="py-2.5 pl-4 text-right tabular-nums">
                          {formatNumber(item.customers)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30">
                    <td className="py-2.5 pr-4 font-semibold">Total</td>
                    <td className="py-2.5 px-4 text-right font-bold text-amber-700 tabular-nums">
                      {formatKwhRaw(stats.totalKwh)}
                    </td>
                    <td className="py-2.5 pl-4 text-right font-semibold tabular-nums">
                      {formatNumber(stats.totalCustomers)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <BotConsumptionDetailTable dateRange={dateRange} region={effectiveRegion} />
    </div>
  )
}
