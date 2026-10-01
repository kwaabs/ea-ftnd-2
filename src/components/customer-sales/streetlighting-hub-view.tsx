"use client"

import { useEffect, useMemo, useState } from "react"
import { BarChart3, ChevronDown, ChevronLeft, ChevronRight, Download, Loader2, Search, Users, Zap } from "lucide-react"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAppStore } from "@/stores/app-store"
import { useZeusBillingAggregate } from "@/hooks/api/use-zeus-billing-aggregate-api"
import { useZeusBillingDetail } from "@/hooks/api/use-zeus-billing-detail-api"
import { normalizeRegionName, shortRegionLabel } from "@/hooks/use-resolved-region-name"
import { exportToCSV, exportToExcel } from "@/lib/export-utils"
import { cn } from "@/lib/utils"

// E03 is Zeus Sales' tariffclasscode for streetlighting — flat-rate,
// government-billed (via an MDA) consumption, not individually-metered
// customer sales like the rest of Prepaid/Postpaid. See
// ea-bknd-3/internal/salessummary's Streetlighting Category and
// streetlightingRows — this tab reads the same underlying Zeus Sales data
// (via the existing generic zeusbilling hooks, filtered to tariffClassCode
// E03) rather than a new endpoint, since there's only one source here.
const STREETLIGHTING_TARIFF_CODE = "E03"
const STREETLIGHTING_COLOR = "#ca8a04" // yellow-600 — distinct from BOT (amber), AMR Postpaid (orange)

function formatDateToString(date: Date | string | undefined, fallback: string): string {
  if (!date) return fallback
  if (date instanceof Date) return date.toISOString().split("T")[0]
  if (typeof date === "string") return date.includes("T") ? date.split("T")[0] : date
  return fallback
}

function formatKwhRaw(value: number | null | undefined) {
  if (value === null || value === undefined) return "0 kWh"
  return `${(value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} kWh`
}

function formatKwh(value: number | null | undefined) {
  if (value === null || value === undefined) return "0"
  if (Math.abs(value) >= 1_000_000)
    return `${(value / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M kWh`
  if (Math.abs(value) >= 1_000)
    return `${(value / 1_000).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k kWh`
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 0 })} kWh`
}

// Precise, non-abbreviated — for individual detail-table rows, unlike
// formatKwh above (abbreviated with k/M suffixes, used only for the KPI
// cards). Matches every other legacy source's detail table convention.
function formatRowKwh(value: number | null | undefined) {
  if (value === null || value === undefined) return "—"
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

// Zeus Sales is a per-bill record, not a daily meter reading — there is no
// day-precision date column, only billingMonth/billingYear (the billing
// period this bill covers). Same helper/convention used by every other
// Zeus billing table in this app (account-detail-view.tsx,
// customer-sales-detail.tsx, service-point-detail-view.tsx).
function formatBillingPeriod(month: number | null | undefined, year: number | null | undefined) {
  if (!month || !year) return "—"
  const name = MONTH_NAMES[month - 1]
  return name ? `${name} ${year}` : `${month}/${year}`
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

type SortField = "customername" | "billconsumptionvalue"
type SortOrder = "asc" | "desc"
type ExportFormat = "csv" | "xlsx"

const PAGE_SIZE = 50

function SortButton({
  field,
  activeField,
  onToggle,
  children,
}: {
  field: SortField
  activeField: SortField | null
  onToggle: (field: SortField) => void
  children: React.ReactNode
}) {
  const active = activeField === field
  return (
    <button
      className={`flex items-center gap-1.5 hover:text-foreground cursor-pointer whitespace-nowrap ${active ? "text-foreground font-semibold" : ""}`}
      onClick={() => onToggle(field)}
    >
      {children}
    </button>
  )
}

export function StreetlightingHubView() {
  const { filters: globalFilters } = useAppStore()

  const defaultStart = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0]
  const defaultEnd = new Date().toISOString().split("T")[0]
  const dateRange = {
    start: formatDateToString(globalFilters.dateRange?.start, defaultStart),
    end: formatDateToString(globalFilters.dateRange?.end, defaultEnd),
  }

  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const selectRegion = (value: string | null) => {
    setSelectedRegion((prev) => (prev === value ? null : value))
  }

  const { data: regionAgg = [], isLoading: regionLoading } = useZeusBillingAggregate({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    tariffClassCode: STREETLIGHTING_TARIFF_CODE,
    groupBy: "regionname",
  })

  const stats = useMemo(() => {
    const totalKwh = regionAgg.reduce((s, r) => s + (r.sum_billconsumptionvalue || 0), 0)
    const totalCustomers = regionAgg.reduce((s, r) => s + (r.customer_count || 0), 0)
    return { totalKwh, totalCustomers, avgKwh: totalCustomers > 0 ? totalKwh / totalCustomers : 0 }
  }, [regionAgg])

  const byRegion = useMemo<RegionRow[]>(() => {
    const rows = new Map<string, RegionRow>()
    regionAgg.forEach((r) => {
      const raw = r.regionname || "Unknown"
      const key = normalizeRegionName(raw)
      let row = rows.get(key)
      if (!row) {
        row = { regionname: raw, kwh: 0, customers: 0 }
        rows.set(key, row)
      }
      row.kwh += r.sum_billconsumptionvalue || 0
      row.customers += r.customer_count || 0
    })
    return Array.from(rows.values()).sort((a, b) => b.kwh - a.kwh)
  }, [regionAgg])

  const effectiveRegion = selectedRegion || undefined

  // Detail table state
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")
  const [exporting, setExporting] = useState<ExportFormat | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300)
    return () => clearTimeout(t)
  }, [searchTerm])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, sortField, sortOrder, dateRange.start, dateRange.end, effectiveRegion])

  const { data: detailData, isLoading: detailLoading, isFetching: detailFetching } = useZeusBillingDetail({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    tariffClassCode: STREETLIGHTING_TARIFF_CODE,
    region: effectiveRegion,
    search: debouncedSearch || undefined,
    page,
    limit: PAGE_SIZE,
    sortBy: sortField ?? undefined,
    sortDir: sortField ? sortOrder : undefined,
  })

  const rows = detailData?.data ?? []
  const total = detailData?.total ?? 0
  const totalPages = Math.max(1, detailData?.total_pages ?? 1)

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortOrder("desc")
    }
  }

  const handleExport = async (format: ExportFormat) => {
    setExporting(format)
    try {
      // The server caps limit at 500/request — page through everything
      // matching the current filter/sort for a full export, same pattern
      // as every other legacy-source detail table in this app.
      const first = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"}/api/v1/meters/consumption/zeus-billing/detail?` +
          new URLSearchParams({
            billDateFrom: dateRange.start,
            billDateTo: dateRange.end,
            tariffClassCode: STREETLIGHTING_TARIFF_CODE,
            ...(effectiveRegion ? { region: effectiveRegion } : {}),
            ...(debouncedSearch ? { search: debouncedSearch } : {}),
            ...(sortField ? { sortBy: sortField, sortDir: sortOrder } : {}),
            page: "1",
            limit: "500",
          }),
      ).then((r) => r.json())
      const totalPagesForExport = first.total_pages || 1
      const allPages = [first.data || []]
      for (let p = 2; p <= totalPagesForExport; p++) {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"}/api/v1/meters/consumption/zeus-billing/detail?` +
            new URLSearchParams({
              billDateFrom: dateRange.start,
              billDateTo: dateRange.end,
              tariffClassCode: STREETLIGHTING_TARIFF_CODE,
              ...(effectiveRegion ? { region: effectiveRegion } : {}),
              ...(debouncedSearch ? { search: debouncedSearch } : {}),
              ...(sortField ? { sortBy: sortField, sortDir: sortOrder } : {}),
              page: String(p),
              limit: "500",
            }),
        ).then((r) => r.json())
        allPages.push(res.data || [])
      }
      const all = allPages.flat()
      const rowsForExport = all.map((r: Record<string, unknown>) => ({
        mda_name: r.mdaName,
        customer_name: r.customerName,
        account_code: r.accountCode,
        service_point_code: r.servicePointCode,
        service_class: r.serviceClass,
        region: r.regionName,
        district: r.districtName,
        billing_period: formatBillingPeriod(r.billingMonth as number | undefined, r.billingYear as number | undefined),
        bill_consumption_kwh: r.billConsumptionValue,
      }))
      const filename = `${(effectiveRegion || "all").replace(/\s+/g, "-").toLowerCase()}-streetlighting`
      if (format === "csv") {
        exportToCSV(rowsForExport, filename)
      } else {
        await exportToExcel(rowsForExport, filename)
      }
    } catch (err) {
      console.error("Failed to export streetlighting records", err)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">Streetlighting</h2>
        <p className="text-muted-foreground mt-1">
          Zeus Sales, tariff class E03 — flat-rate, government-billed consumption (via an MDA), not individually-metered
          customer sales
          {selectedRegion ? (
            <span className="text-yellow-700"> · filtered by {shortRegionLabel(selectedRegion)}</span>
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
              <p className="text-2xl font-bold tabular-nums" style={{ color: STREETLIGHTING_COLOR }}>
                {formatKwhRaw(stats.totalKwh)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Avg {formatKwh(stats.avgKwh)} / account</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> Accounts
            </p>
            {regionLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold tabular-nums" style={{ color: STREETLIGHTING_COLOR }}>
                {formatNumber(stats.totalCustomers)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Streetlighting accounts</p>
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
              <p className="text-2xl font-bold tabular-nums" style={{ color: STREETLIGHTING_COLOR }}>
                {byRegion.length}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">With streetlighting data</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Consumption by region</CardTitle>
          <CardDescription>Click a region to filter the records below</CardDescription>
        </CardHeader>
        <CardContent>
          {regionLoading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : byRegion.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No streetlighting data for this period.</p>
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
                <Tooltip formatter={(v: number) => [formatKwhRaw(v), "kWh"]} labelFormatter={(label: string) => shortRegionLabel(label)} />
                <Bar
                  dataKey="kwh"
                  fill={STREETLIGHTING_COLOR}
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
                      fill={STREETLIGHTING_COLOR}
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
            <CardDescription>Click a region to filter the records below</CardDescription>
          </div>
          {selectedRegion && (
            <button type="button" onClick={() => selectRegion(null)} className="text-xs text-yellow-700 hover:underline">
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
                    <th className="text-right py-2 px-4 font-medium" style={{ color: STREETLIGHTING_COLOR }}>
                      Consumption
                    </th>
                    <th className="text-right py-2 pl-4 font-medium text-muted-foreground">Accounts</th>
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
                        className={cn("border-b last:border-0 hover:bg-muted/40 cursor-pointer", selected && "bg-yellow-50")}
                        onClick={() => selectRegion(item.regionname)}
                      >
                        <td className="py-2.5 pr-4 font-medium">{shortRegionLabel(item.regionname)}</td>
                        <td className="py-2.5 px-4 text-right font-semibold tabular-nums" style={{ color: STREETLIGHTING_COLOR }}>
                          {formatKwhRaw(item.kwh)}
                        </td>
                        <td className="py-2.5 pl-4 text-right tabular-nums">{formatNumber(item.customers)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30">
                    <td className="py-2.5 pr-4 font-semibold">Total</td>
                    <td className="py-2.5 px-4 text-right font-bold tabular-nums" style={{ color: STREETLIGHTING_COLOR }}>
                      {formatKwhRaw(stats.totalKwh)}
                    </td>
                    <td className="py-2.5 pl-4 text-right font-semibold tabular-nums">{formatNumber(stats.totalCustomers)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>Streetlighting Records</CardTitle>
              <CardDescription>Individual E03 billing records</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={exporting !== null || total === 0}>
                    {exporting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
                    Download
                    <ChevronDown className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport("csv")} disabled={exporting !== null}>
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("xlsx")} disabled={exporting !== null}>
                    Export as Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Badge variant="outline" className="text-sm font-medium px-3 py-1 border-yellow-300 text-yellow-700">
                {total.toLocaleString()} records
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer/MDA name, account, service point..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow className="bg-muted/40">
                    <TableHead>
                      <SortButton field="customername" activeField={sortField} onToggle={toggleSort}>
                        Customer / MDA
                      </SortButton>
                    </TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Service Point</TableHead>
                    <TableHead>Service Class</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>District</TableHead>
                    <TableHead>Billing Period</TableHead>
                    <TableHead className="text-right bg-yellow-50">
                      <SortButton field="billconsumptionvalue" activeField={sortField} onToggle={toggleSort}>
                        <span className="text-yellow-700">kWh</span>
                      </SortButton>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailLoading ? (
                    [...Array(10)].map((_, i) => (
                      <TableRow key={i}>
                        {[...Array(8)].map((_, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        No records found for the selected date range
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r, idx) => (
                      <TableRow key={`${r.accountCode}-${r.servicePointCode}-${idx}`} className="hover:bg-muted/40">
                        <TableCell className="font-medium truncate max-w-[200px]" title={r.mdaName || r.customerName}>
                          {r.mdaName || r.customerName || "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.accountCode || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{r.servicePointCode || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.serviceClass || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.regionName || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.districtName || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatBillingPeriod(r.billingMonth, r.billingYear)}
                        </TableCell>
                        <TableCell className="text-right bg-yellow-50/50">
                          <span className="font-bold text-yellow-700 tabular-nums text-sm">
                            {formatRowKwh(r.billConsumptionValue)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Showing {rows.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, total)} of{" "}
              {total.toLocaleString()} records
              {detailFetching && !detailLoading ? " · updating…" : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1 || detailFetching}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium px-1">
                Page {page} of {totalPages.toLocaleString()}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages || detailFetching}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
