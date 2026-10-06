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
import { fetchAllAlphaConsumptionDetail, useAlphaConsumptionDetail } from "@/hooks/api/use-alpha-consumption-api"
import { ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, Download, Loader2, Search, Zap } from "lucide-react"
import { exportToCSV, exportToExcel } from "@/lib/export-utils"

interface AlphaConsumptionDetailProps {
  dateRange: { start: string; end: string }
  substation?: string
}

type SortField = "consumer_name" | "value" | "from_date"
type SortOrder = "asc" | "desc"
type ExportFormat = "csv" | "xlsx"

// The server's own per-request cap (see ea-bknd-3's httpx.ParsePagination
// call in alphaconsumption/handler.go) is 500 — this is just the table's
// own page size, independent of that.
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
      <ArrowUpDown className={`h-3.5 w-3.5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
    </button>
  )
}

function formatValue(value: number | null | undefined) {
  if (value === null || value === undefined) return "—"
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" })
}

/**
 * Real, server-side pagination/sort/search — same contract as
 * HolleyConsumptionDetailTable: total/total_pages always come from the
 * server's own count, not capped by this endpoint's 500-row-per-request
 * limit.
 */
export function AlphaConsumptionDetailTable({ dateRange, substation }: AlphaConsumptionDetailProps) {
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  // No default sort — starts in the backend's own stable order
  // (substation, consumer_name, meter_serial_no, from_date) rather than
  // highest-value-first, same reasoning as Holley's identical choice.
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")
  const [exporting, setExporting] = useState<ExportFormat | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300)
    return () => clearTimeout(t)
  }, [searchTerm])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, sortField, sortOrder, dateRange.start, dateRange.end, substation])

  const {
    data: detailData,
    isLoading,
    isFetching,
  } = useAlphaConsumptionDetail({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    substation,
    search: debouncedSearch || undefined,
    page,
    limit: PAGE_SIZE,
    sortBy: sortField ?? undefined,
    sortOrder: sortField ? sortOrder : undefined,
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
      const all = await fetchAllAlphaConsumptionDetail({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        substation,
        search: debouncedSearch || undefined,
        sortBy: sortField ?? undefined,
        sortOrder: sortField ? sortOrder : undefined,
      })
      const rowsForExport = all.map((r) => ({
        consumer_name: r.consumer_name,
        meter_serial_no: r.meter_serial_no,
        consumer_id: r.consumer_id,
        substation: r.substation,
        energy_code: r.energy_code,
        from_date: r.from_date,
        to_date: r.to_date,
        value: r.value,
      }))
      const filename = `${(substation || "all").replace(/\s+/g, "-").toLowerCase()}-alpha-consumption`
      if (format === "csv") {
        exportToCSV(rowsForExport, filename)
      } else {
        await exportToExcel(rowsForExport, filename)
      }
    } catch (err) {
      console.error("Failed to export alpha consumption records", err)
    } finally {
      setExporting(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle>Alpha Consumer Records</CardTitle>
            <CardDescription>Individual Alpha T&amp;D-ingested readings</CardDescription>
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
            <Badge variant="outline" className="text-sm font-medium px-3 py-1 border-indigo-300 text-indigo-700">
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
              placeholder="Search by consumer name, meter serial no, substation..."
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
                    <SortButton field="consumer_name" activeField={sortField} onToggle={toggleSort}>
                      Consumer
                    </SortButton>
                  </TableHead>
                  <TableHead>Meter Serial No.</TableHead>
                  <TableHead>Substation</TableHead>
                  <TableHead>Energy Code</TableHead>
                  <TableHead>
                    <SortButton field="from_date" activeField={sortField} onToggle={toggleSort}>
                      Period
                    </SortButton>
                  </TableHead>
                  <TableHead className="text-right bg-indigo-50">
                    <div className="flex items-center justify-end gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-indigo-600" />
                      <SortButton field="value" activeField={sortField} onToggle={toggleSort}>
                        <span className="text-indigo-700">Value</span>
                      </SortButton>
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(12)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(6)].map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No records found for the selected date range
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, idx) => (
                    <TableRow
                      key={`${r.reading_master_id}-${r.energy_code}-${idx}`}
                      className="hover:bg-muted/40"
                    >
                      <TableCell className="font-medium truncate max-w-[180px]" title={r.consumer_name}>
                        {r.consumer_name || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.meter_serial_no || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.substation || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-normal font-mono">
                          {r.energy_code}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(r.from_date)} – {formatDate(r.to_date)}
                      </TableCell>
                      <TableCell className="text-right bg-indigo-50/50">
                        <span className="font-bold text-indigo-700 tabular-nums text-sm">
                          {formatValue(r.value)}
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
