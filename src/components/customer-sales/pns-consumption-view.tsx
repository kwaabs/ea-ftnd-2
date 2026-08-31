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
import { usePnsConsumptionAggregate } from "@/hooks/api/use-pns-consumption-api"
import { PnsConsumptionDetailTable } from "@/components/customer-sales/pns-consumption-detail"
import { cn } from "@/lib/utils"

// Rose, distinct from Zeus (blue), MMS (green), BOT (amber), and BXC (purple) elsewhere on this page.
const PNS_COLOR = "#e11d48"

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
  regionId: string
  kwh: number
  customers: number
}

interface PnsConsumptionViewProps {
  dateRange: { start: string; end: string }
}

export function PnsConsumptionView({ dateRange }: PnsConsumptionViewProps) {
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null)

  const selectRegion = (value: string | null) => {
    setSelectedRegionId((prev) => (prev === value ? null : value))
  }

  const { data: regionAgg = [], isLoading: regionLoading } = usePnsConsumptionAggregate({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    groupBy: "region",
  })

  const stats = useMemo(() => {
    const totalKwh = regionAgg.reduce((s, r) => s + (r.sum_energy_kwh || 0), 0)
    const totalCustomers = regionAgg.reduce((s, r) => s + (r.customer_count || 0), 0)
    return {
      totalKwh,
      totalCustomers,
      avgKwh: totalCustomers > 0 ? totalKwh / totalCustomers : 0,
    }
  }, [regionAgg])

  // regionid is an opaque code, not a name — no lookup exists yet to
  // resolve it (see ea-bknd-3/internal/pnsconsumption's package doc
  // comment), so this shows the raw code as-is rather than pretending to
  // display a region name.
  const byRegion = useMemo<RegionRow[]>(() => {
    const rows = new Map<string, RegionRow>()
    regionAgg.forEach((r) => {
      const regionId = r.region_id || "Unknown"
      let row = rows.get(regionId)
      if (!row) {
        row = { regionId, kwh: 0, customers: 0 }
        rows.set(regionId, row)
      }
      row.kwh += r.sum_energy_kwh || 0
      row.customers += r.customer_count || 0
    })
    return Array.from(rows.values()).sort((a, b) => b.kwh - a.kwh)
  }, [regionAgg])

  const effectiveRegionId = selectedRegionId || undefined

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold tracking-tight text-foreground">PNS</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          PNS-ingested consumption readings — a legacy meter source, independent of Zeus, MMS, BOT and BXC
          {selectedRegionId ? (
            <span className="text-rose-700"> · filtered by region {selectedRegionId}</span>
          ) : null}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Region/district shown as raw codes — a name lookup isn&apos;t available in the source data yet.
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
              <p className="text-2xl font-bold text-rose-700 tabular-nums">
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
              <p className="text-2xl font-bold text-rose-700 tabular-nums">
                {formatNumber(stats.totalCustomers)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">PNS-ingested readings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <BarChart3 className="h-3.5 w-3.5" /> Region codes
            </p>
            {regionLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-rose-700 tabular-nums">{byRegion.length}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">With PNS-ingested data</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Consumption by region code</CardTitle>
          <CardDescription>Click a region code to filter the customer records below</CardDescription>
        </CardHeader>
        <CardContent>
          {regionLoading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : byRegion.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No pns-consumption data for this period.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byRegion} margin={{ top: 20, right: 8, left: 8, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="regionId"
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
                <Tooltip formatter={(v: number) => [formatKwhRaw(v), "kWh"]} />
                <Bar
                  dataKey="kwh"
                  fill={PNS_COLOR}
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                  isAnimationActive={false}
                  onClick={(data: { regionId?: string }) => {
                    if (data?.regionId) selectRegion(data.regionId)
                  }}
                >
                  {byRegion.map((row) => (
                    <Cell
                      key={row.regionId}
                      fill={PNS_COLOR}
                      fillOpacity={!selectedRegionId || selectedRegionId === row.regionId ? 1 : 0.35}
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
            <CardTitle>Region code breakdown</CardTitle>
            <CardDescription>Click a region code to filter the customer records below</CardDescription>
          </div>
          {selectedRegionId && (
            <button
              type="button"
              onClick={() => selectRegion(null)}
              className="text-xs text-rose-700 hover:underline"
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
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Region ID</th>
                    <th className="text-right py-2 px-4 font-medium text-rose-700">Consumption</th>
                    <th className="text-right py-2 pl-4 font-medium text-muted-foreground">Customers</th>
                  </tr>
                </thead>
                <tbody>
                  {byRegion.map((item) => {
                    const selected = selectedRegionId === item.regionId
                    return (
                      <tr
                        key={item.regionId}
                        className={cn(
                          "border-b last:border-0 hover:bg-muted/40 cursor-pointer",
                          selected && "bg-rose-50",
                        )}
                        onClick={() => selectRegion(item.regionId)}
                      >
                        <td className="py-2.5 pr-4 font-medium font-mono text-xs">{item.regionId}</td>
                        <td className="py-2.5 px-4 text-right font-semibold text-rose-700 tabular-nums">
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
                    <td className="py-2.5 px-4 text-right font-bold text-rose-700 tabular-nums">
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

      <PnsConsumptionDetailTable dateRange={dateRange} region={effectiveRegionId} />
    </div>
  )
}
