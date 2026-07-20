"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useMmsCustomerSalesDetail } from "@/hooks/api/use-mms-customer-sales-detail-api"
import { ArrowUpDown, ChevronLeft, ChevronRight, Search, Zap } from "lucide-react"
import { ExportButton } from "@/components/ui/export-button"

interface MmsCustomerSalesDetailProps {
  dateRange: { start: string; end: string }
  region?: string
  district?: string
}

type SortField = "customer_name" | "sts_last_month_kwh_read" | "sts_last_month_credit_read" | "sts_credit_balance_remaining" | "date_time"
type SortOrder = "asc" | "desc"

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

export function MmsCustomerSalesDetail({ dateRange, region, district }: MmsCustomerSalesDetailProps) {
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortField, setSortField] = useState<SortField>("sts_last_month_kwh_read")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")
  const [manufacturerFilter, setManufacturerFilter] = useState<string>("all")

  const { data: detailData, isLoading } = useMmsCustomerSalesDetail({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    region,
    district,
    page: 1,
    limit: 2000,
  })

  const rawRecords = detailData || []

  // Derive unique manufacturers for filter
  const manufacturers = useMemo(() => {
    const set = new Set<string>()
    rawRecords.forEach((r: any) => { if (r.manufacturer) set.add(r.manufacturer) })
    return Array.from(set).sort()
  }, [rawRecords])

  const filteredAndSorted = useMemo(() => {
    let filtered = rawRecords

    if (manufacturerFilter && manufacturerFilter !== "all") {
      filtered = filtered.filter((r: any) => r.manufacturer === manufacturerFilter)
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      filtered = filtered.filter((r: any) =>
        r.customer_name?.toLowerCase().includes(q) ||
        r.meter_number?.toLowerCase().includes(q) ||
        r.account_number?.toLowerCase().includes(q) ||
        r.district?.toLowerCase().includes(q) ||
        r.region?.toLowerCase().includes(q) ||
        r.model?.toLowerCase().includes(q)
      )
    }

    return [...filtered].sort((a: any, b: any) => {
      if (sortField === "customer_name") {
        const cmp = (a.customer_name || "").localeCompare(b.customer_name || "")
        return sortOrder === "asc" ? cmp : -cmp
      }
      if (sortField === "date_time") {
        const aVal = a.date_time ? new Date(a.date_time).getTime() : 0
        const bVal = b.date_time ? new Date(b.date_time).getTime() : 0
        return sortOrder === "desc" ? bVal - aVal : aVal - bVal
      }
      const aVal = (a[sortField] as number) ?? 0
      const bVal = (b[sortField] as number) ?? 0
      return sortOrder === "desc" ? bVal - aVal : aVal - bVal
    })
  }, [rawRecords, searchTerm, sortField, sortOrder, manufacturerFilter])

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE))
  const paginated = filteredAndSorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortOrder("desc")
    }
    setPage(1)
  }

  function SortButton({ field, children }: { field: SortField; children: React.ReactNode }) {
    const active = sortField === field
    return (
      <button
        className={`flex items-center gap-1.5 hover:text-foreground cursor-pointer whitespace-nowrap ${active ? "text-foreground font-semibold" : ""}`}
        onClick={() => toggleSort(field)}
      >
        {children}
        <ArrowUpDown className={`h-3.5 w-3.5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
      </button>
    )
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
            <ExportButton
              data={filteredAndSorted.map((r: any) => ({
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
              }))}
              filename={`${(region || "all").replace(/\s+/g, "-").toLowerCase()}-mms-customer-sales`}
            />
            <Badge variant="outline" className="text-sm font-medium px-3 py-1 border-green-300 text-green-700">
              {filteredAndSorted.length.toLocaleString()} meters
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
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1) }}
              className="pl-8"
            />
          </div>
          {manufacturers.length > 0 && (
            <Select value={manufacturerFilter} onValueChange={(v) => { setManufacturerFilter(v); setPage(1) }}>
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-[180px]">
                    <SortButton field="customer_name">Customer</SortButton>
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
                      <SortButton field="sts_last_month_kwh_read">
                        <span className="text-green-700">kWh (Last Month)</span>
                      </SortButton>
                    </div>
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton field="sts_last_month_credit_read">Credit Purchased</SortButton>
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton field="sts_credit_balance_remaining">Balance Remaining</SortButton>
                  </TableHead>
                  <TableHead>
                    <SortButton field="date_time">Date</SortButton>
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
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-12 text-muted-foreground">
                      No records found for the selected date range
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((r: any, idx: number) => (
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
            Showing {paginated.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filteredAndSorted.length)} of {filteredAndSorted.length.toLocaleString()} records
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium px-1">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

      </CardContent>
    </Card>
  )
}
