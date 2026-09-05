"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { fetchAllMmsCustomerSalesDetail, useMmsCustomerSalesDetail } from "@/hooks/api/use-mms-customer-sales-detail-api"
import { useMmsCustomerSalesAggregate } from "@/hooks/api/use-mms-customer-sales-aggregate-api"
import { ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, Download, Loader2, Search, Zap } from "lucide-react"
import { exportToCSV, exportToExcel } from "@/lib/export-utils"

interface MmsCustomerSalesDetailProps {
  dateRange: { start: string; end: string }
  region?: string
  district?: string
}

type SortField = "customer_name" | "sts_last_month_kwh_read" | "sts_last_month_credit_read" | "sts_credit_balance_remaining" | "date_time"
type SortOrder = "asc" | "desc"
type ExportFormat = "csv" | "xlsx"

// The server's own per-request cap (see ea-bknd-3's httpx.ParsePagination
// call in mmssales/handler.go) is 500 — this is just the table's own page
// size, independent of that.
const PAGE_SIZE = 50

function formatKwh(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) return "—"
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "—"
  return "₵" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

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

/**
 * Real, server-side pagination/sort/search — NOT "fetch a big batch once
 * and slice/sort/filter it in the browser." That pattern (this component's
 * previous shape) silently broke past this endpoint's 500-row-per-request
 * cap: a query with more real matches than that would fetch exactly 500
 * rows, treat that count as if it were the grand total, and have no way to
 * reach anything past it. total/total_pages here always come from the
 * server's own count, which isn't capped by the per-request row limit.
 *
 * The manufacturer filter's option list comes from a separate Aggregate
 * call (groupBy=manufacturer, one row per distinct manufacturer) instead
 * of being derived from the fetched page — deriving it from a single
 * 50-row page would only ever show whichever manufacturers happened to
 * land on the current page.
 */
export function MmsCustomerSalesDetail({ dateRange, region, district }: MmsCustomerSalesDetailProps) {
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [sortField, setSortField] = useState<SortField>("sts_last_month_kwh_read")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")
  const [manufacturerFilter, setManufacturerFilter] = useState<string>("all")
  const [exporting, setExporting] = useState<ExportFormat | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300)
    return () => clearTimeout(t)
  }, [searchTerm])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, sortField, sortOrder, manufacturerFilter, dateRange.start, dateRange.end, region, district])

  const { data: manufacturerAgg } = useMmsCustomerSalesAggregate({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    region,
    district,
    groupBy: "manufacturer",
  })

  const manufacturers = useMemo(() => {
    const set = new Set<string>()
    ;(manufacturerAgg || []).forEach((r) => { if (r.manufacturer) set.add(r.manufacturer) })
    return Array.from(set).sort()
  }, [manufacturerAgg])

  const {
    data: detailData,
    isLoading,
    isFetching,
  } = useMmsCustomerSalesDetail({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    region,
    district,
    manufacturer: manufacturerFilter !== "all" ? manufacturerFilter : undefined,
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
      const all = await fetchAllMmsCustomerSalesDetail({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        region,
        district,
        manufacturer: manufacturerFilter !== "all" ? manufacturerFilter : undefined,
        search: debouncedSearch || undefined,
        sortBy: sortField,
        sortOrder,
      })
      const rowsForExport = all.map((r) => ({
        customer_name: r.customer_name,
        meter_number: r.meter_number,
        account_number: r.account_number,
        region: r.region,
        district: r.district,
        manufacturer: r.manufacturer,
        model: r.model,
        last_month_kwh: r.sts_last_month_kwh_read,
        last_month_credit: r.sts_last_month_credit_read,
        credit_balance: r.sts_credit_balance_remaining,
        date_time: r.date_time,
      }))
      const filename = `${(region || "all").replace(/\s+/g, "-").toLowerCase()}-mms-customer-sales`
      if (format === "csv") {
        exportToCSV(rowsForExport, filename)
      } else {
        await exportToExcel(rowsForExport, filename)
      }
    } catch (err) {
      console.error("Failed to export MMS customer sales records", err)
    } finally {
      setExporting(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle>MMS Customer Records — Prepaid</CardTitle>
            <CardDescription>
              Individual prepaid meter readings — sorted by highest kWh by default
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
            <Badge variant="outline" className="text-sm font-medium px-3 py-1 border-green-300 text-green-700">
              {total.toLocaleString()} meters
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, meter, account, district..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          {manufacturers.length > 0 && (
            <Select value={manufacturerFilter} onValueChange={setManufacturerFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All manufacturers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All manufacturers</SelectItem>
                {manufacturers.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
                  <TableHead>Account No.</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>District</TableHead>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Tariff</TableHead>
                  <TableHead className="text-right bg-green-50">
                    <div className="flex items-center justify-end gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-green-600" />
                      <SortButton field="sts_last_month_kwh_read" activeField={sortField} onToggle={toggleSort}>
                        <span className="text-green-700">kWh (Last Month)</span>
                      </SortButton>
                    </div>
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton field="sts_last_month_credit_read" activeField={sortField} onToggle={toggleSort}>
                      Credit Purchased
                    </SortButton>
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton field="sts_credit_balance_remaining" activeField={sortField} onToggle={toggleSort}>
                      Balance Remaining
                    </SortButton>
                  </TableHead>
                  <TableHead>
                    <SortButton field="date_time" activeField={sortField} onToggle={toggleSort}>
                      Date
                    </SortButton>
                  </TableHead>
                  <TableHead>Contract Type</TableHead>
                  <TableHead>Install Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(12)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(14)].map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-12 text-muted-foreground">
                      No records found for the selected date range
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r: any, idx: number) => (
                    <TableRow key={`${r.meter_number}-${r.date_time}-${idx}`} className="hover:bg-muted/40">
                      <TableCell className="font-medium truncate max-w-[180px]" title={r.customer_name}>
                        {r.customer_name || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.meter_number || r.meter_serial_number || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.account_number || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.region || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.district || "—"}</TableCell>
                      <TableCell className="text-xs">{r.manufacturer || "—"}</TableCell>
                      <TableCell className="text-xs">{r.model || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-normal">{r.tariff || "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-right bg-green-50/50">
                        <span className="font-bold text-green-700 tabular-nums text-sm">
                          {formatKwh(r.sts_last_month_kwh_read)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-green-700">
                        {formatMoney(r.sts_last_month_credit_read)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        <span className={r.sts_credit_balance_remaining != null && r.sts_credit_balance_remaining > 0 ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>
                          {formatMoney(r.sts_credit_balance_remaining)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(r.date_time)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs font-normal">{r.contract_type || "Prepaid"}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(r.installation_date)}
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
            Showing {rows.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()} records
            {isFetching && !isLoading ? " · updating…" : ""}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1 || isFetching}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium px-1">Page {page} of {totalPages.toLocaleString()}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages || isFetching}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

      </CardContent>
    </Card>
  )
}
