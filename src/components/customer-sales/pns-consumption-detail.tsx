"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { usePnsConsumptionDetail } from "@/hooks/api/use-pns-consumption-api"
import { ArrowUpDown, ChevronLeft, ChevronRight, Search, Zap } from "lucide-react"
import { ExportButton } from "@/components/ui/export-button"

interface PnsConsumptionDetailProps {
  dateRange: { start: string; end: string }
  region?: string
  district?: string
}

type SortField = "customer_id" | "energy_kwh" | "bill_month"
type SortOrder = "asc" | "desc"

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

export function PnsConsumptionDetailTable({ dateRange, region, district }: PnsConsumptionDetailProps) {
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortField, setSortField] = useState<SortField>("energy_kwh")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")

  const { data: detailData, isLoading } = usePnsConsumptionDetail({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    region,
    district,
    page: 1,
    limit: 2000,
  })

  const rawRecords = useMemo(() => detailData || [], [detailData])

  const filteredAndSorted = useMemo(() => {
    let filtered = rawRecords

    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (r) =>
          r.customer_id?.toLowerCase().includes(q) ||
          r.service_id?.toLowerCase().includes(q) ||
          r.service_point?.toLowerCase().includes(q) ||
          r.region_id?.toLowerCase().includes(q) ||
          r.district_id?.toLowerCase().includes(q),
      )
    }

    return [...filtered].sort((a, b) => {
      if (sortField === "customer_id") {
        const cmp = (a.customer_id || "").localeCompare(b.customer_id || "")
        return sortOrder === "asc" ? cmp : -cmp
      }
      if (sortField === "bill_month") {
        const cmp = (a.bill_month || "").localeCompare(b.bill_month || "")
        return sortOrder === "asc" ? cmp : -cmp
      }
      const aVal = a.energy_kwh ?? 0
      const bVal = b.energy_kwh ?? 0
      return sortOrder === "desc" ? bVal - aVal : aVal - bVal
    })
  }, [rawRecords, searchTerm, sortField, sortOrder])

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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle>PNS Customer Records</CardTitle>
            <CardDescription>
              Individual PNS-ingested readings — sorted by highest kWh by default
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton
              data={filteredAndSorted.map((r) => ({
                customer_id: r.customer_id,
                service_id: r.service_id,
                service_point: r.service_point,
                region_id: r.region_id,
                district_id: r.district_id,
                tariff_category: r.tariff_category,
                bill_month: r.bill_month,
                energy_kwh: r.energy_kwh,
              }))}
              filename={`${(region || "all").replace(/\s+/g, "-").toLowerCase()}-pns-consumption`}
            />
            <Badge variant="outline" className="text-sm font-medium px-3 py-1 border-rose-300 text-rose-700">
              {filteredAndSorted.length.toLocaleString()} readings
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer ID, service ID, service point..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setPage(1)
              }}
              className="pl-8"
            />
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow className="bg-muted/40">
                  <TableHead className="w-[160px]">
                    <SortButton field="customer_id" activeField={sortField} onToggle={toggleSort}>
                      Customer ID
                    </SortButton>
                  </TableHead>
                  <TableHead>Service ID</TableHead>
                  <TableHead>Service Point</TableHead>
                  <TableHead>Region ID</TableHead>
                  <TableHead>District ID</TableHead>
                  <TableHead>Tariff</TableHead>
                  <TableHead>
                    <SortButton field="bill_month" activeField={sortField} onToggle={toggleSort}>
                      Bill Month
                    </SortButton>
                  </TableHead>
                  <TableHead className="text-right bg-rose-50">
                    <div className="flex items-center justify-end gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-rose-600" />
                      <SortButton field="energy_kwh" activeField={sortField} onToggle={toggleSort}>
                        <span className="text-rose-700">kWh</span>
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
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      No records found for the selected date range
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((r, idx) => (
                    <TableRow key={`${r.service_id}-${r.bill_month}-${idx}`} className="hover:bg-muted/40">
                      <TableCell className="font-medium truncate max-w-[160px]" title={r.customer_id}>
                        {r.customer_id || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.service_id || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.service_point || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.region_id || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.district_id || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-normal">
                          {r.tariff_category || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {r.bill_month || "—"}
                      </TableCell>
                      <TableCell className="text-right bg-rose-50/50">
                        <span className="font-bold text-rose-700 tabular-nums text-sm">
                          {formatKwh(r.energy_kwh)}
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
            Showing {paginated.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}–
            {Math.min(page * PAGE_SIZE, filteredAndSorted.length)} of{" "}
            {filteredAndSorted.length.toLocaleString()} records
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium px-1">
              Page {page} of {totalPages}
            </span>
            <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
