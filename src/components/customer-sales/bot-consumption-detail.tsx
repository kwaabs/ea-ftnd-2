"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { fetchAllBotConsumptionDetail, useBotConsumptionDetail } from "@/hooks/api/use-bot-consumption-api"
import { ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, Download, Loader2, Search, Zap } from "lucide-react"
import { exportToCSV, exportToExcel } from "@/lib/export-utils"

interface BotConsumptionDetailProps {
  dateRange: { start: string; end: string }
  region?: string
  district?: string
}

type SortField = "customer_name" | "kwh" | "bill_month"
type SortOrder = "asc" | "desc"
type ExportFormat = "csv" | "xlsx"

// The server's own per-request cap (see ea-bknd-3's httpx.ParsePagination
// call in botconsumption/handler.go) is 500 — this is just the table's own
// page size, independent of that.
const PAGE_SIZE = 50

function SortButton({
  field,
  activeField,
  onToggle,
  children,
}: {
  field: SortField
  activeField: SortField
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
      <ArrowUpDown className={`h-3.5 w-3.5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
    </button>
  )
}

function formatKwh(value: number | null | undefined) {
  if (value === null || value === undefined) return "—"
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Real, server-side pagination/sort/search — NOT "fetch a big batch once
 * and slice/sort/filter it in the browser." That pattern (this
 * component's previous shape) silently broke past this endpoint's
 * 500-row-per-request cap: a query with more real matches than that
 * (bot_consumption regularly has tens of thousands for a single
 * billmonth) would fetch exactly 500 rows, treat that count as if it were
 * the grand total, and have no way to reach anything past it — "Page 10
 * of 10, 500 of 500" while thousands of rows were never even requested.
 * total/total_pages here always come from the server's own count, which
 * isn't capped by the per-request row limit.
 */
export function BotConsumptionDetailTable({ dateRange, region, district }: BotConsumptionDetailProps) {
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [sortField, setSortField] = useState<SortField>("kwh")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")
  const [exporting, setExporting] = useState<ExportFormat | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300)
    return () => clearTimeout(t)
  }, [searchTerm])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, sortField, sortOrder, dateRange.start, dateRange.end, region, district])

  const {
    data: detailData,
    isLoading,
    isFetching,
  } = useBotConsumptionDetail({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    region,
    district,
    search: debouncedSearch || undefined,
    page,
    limit: PAGE_SIZE,
    sortBy: sortField,
    sortOrder,
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

  // The table only ever holds one 50-row page in memory — a full export
  // needs its own fetch across every page of the current filter/sort/
  // search, not just what's currently rendered.
  const handleExport = async (format: ExportFormat) => {
    setExporting(format)
    try {
      const all = await fetchAllBotConsumptionDetail({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        region,
        district,
        search: debouncedSearch || undefined,
        sortBy: sortField,
        sortOrder,
      })
      const rowsForExport = all.map((r) => ({
        customer_name: r.customer_name,
        meter_number: r.meter_number,
        geo_code: r.geo_code,
        region: r.region,
        district: r.district,
        tariff: r.tariff,
        bill_month: r.bill_month,
        kwh: r.kwh,
      }))
      const filename = `${(region || "all").replace(/\s+/g, "-").toLowerCase()}-bot-consumption`
      if (format === "csv") {
        exportToCSV(rowsForExport, filename)
      } else {
        await exportToExcel(rowsForExport, filename)
      }
    } catch (err) {
      console.error("Failed to export bot consumption records", err)
    } finally {
      setExporting(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle>BOT Customer Records</CardTitle>
            <CardDescription>
              Individual bot-ingested readings — sorted by highest kWh by default
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={exporting !== null || total === 0}>
                  {exporting ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-1.5" />
                  )}
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
            <Badge variant="outline" className="text-sm font-medium px-3 py-1 border-amber-300 text-amber-700">
              {total.toLocaleString()} readings
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, meter, geo code, district..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow className="bg-muted/40">
                  <TableHead className="w-[180px]">
                    <SortButton field="customer_name" activeField={sortField} onToggle={toggleSort}>
                      Customer
                    </SortButton>
                  </TableHead>
                  <TableHead>Meter No.</TableHead>
                  <TableHead>Geo Code</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>District</TableHead>
                  <TableHead>Tariff</TableHead>
                  <TableHead>
                    <SortButton field="bill_month" activeField={sortField} onToggle={toggleSort}>
                      Bill Month
                    </SortButton>
                  </TableHead>
                  <TableHead className="text-right bg-amber-50">
                    <div className="flex items-center justify-end gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-amber-600" />
                      <SortButton field="kwh" activeField={sortField} onToggle={toggleSort}>
                        <span className="text-amber-700">kWh</span>
                      </SortButton>
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(12)].map((_, i) => (
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
                    <TableRow key={`${r.meter_number}-${r.bill_month}-${idx}`} className="hover:bg-muted/40">
                      <TableCell className="font-medium truncate max-w-[180px]" title={r.customer_name}>
                        {r.customer_name || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.meter_number || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.geo_code || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.region || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.district || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-normal">
                          {r.tariff || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {r.bill_month || "—"}
                      </TableCell>
                      <TableCell className="text-right bg-amber-50/50">
                        <span className="font-bold text-amber-700 tabular-nums text-sm">
                          {formatKwh(r.kwh)}
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
            Showing {rows.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}–
            {Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()} records
            {isFetching && !isLoading ? " · updating…" : ""}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1 || isFetching}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium px-1">
              Page {page} of {totalPages.toLocaleString()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages || isFetching}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
