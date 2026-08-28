"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useBotConsumptionDetail } from "@/hooks/api/use-bot-consumption-api"
import { ArrowUpDown, ChevronLeft, ChevronRight, Search, Zap } from "lucide-react"
import { ExportButton } from "@/components/ui/export-button"

interface BotConsumptionDetailProps {
  dateRange: { start: string; end: string }
  region?: string
  district?: string
}

type SortField = "customer_name" | "kwh" | "bill_month"
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

export function BotConsumptionDetailTable({ dateRange, region, district }: BotConsumptionDetailProps) {
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortField, setSortField] = useState<SortField>("kwh")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")

  const { data: detailData, isLoading } = useBotConsumptionDetail({
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
          r.customer_name?.toLowerCase().includes(q) ||
          r.meter_number?.toLowerCase().includes(q) ||
          r.geo_code?.toLowerCase().includes(q) ||
          r.district?.toLowerCase().includes(q) ||
          r.region?.toLowerCase().includes(q),
      )
    }

    return [...filtered].sort((a, b) => {
      if (sortField === "customer_name") {
        const cmp = (a.customer_name || "").localeCompare(b.customer_name || "")
        return sortOrder === "asc" ? cmp : -cmp
      }
      if (sortField === "bill_month") {
        const cmp = (a.bill_month || "").localeCompare(b.bill_month || "")
        return sortOrder === "asc" ? cmp : -cmp
      }
      const aVal = a.kwh ?? 0
      const bVal = b.kwh ?? 0
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
            <CardTitle>BOT Customer Records</CardTitle>
            <CardDescription>
              Individual bot-ingested readings — sorted by highest kWh by default
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton
              data={filteredAndSorted.map((r) => ({
                customer_name: r.customer_name,
                meter_number: r.meter_number,
                geo_code: r.geo_code,
                region: r.region,
                district: r.district,
                tariff: r.tariff,
                bill_month: r.bill_month,
                kwh: r.kwh,
              }))}
              filename={`${(region || "all").replace(/\s+/g, "-").toLowerCase()}-bot-consumption`}
            />
            <Badge variant="outline" className="text-sm font-medium px-3 py-1 border-amber-300 text-amber-700">
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
              placeholder="Search by name, meter, geo code, district..."
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
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
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      No records found for the selected date range
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((r, idx) => (
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
