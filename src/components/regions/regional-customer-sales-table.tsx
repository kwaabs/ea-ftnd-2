"use client"

import Link from "next/link"
import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCustomerConsumptionDetail } from "@/hooks/api/use-customer-consumption-detail-api"
import { ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react"
import { ExportButton } from "@/components/ui/export-button"

interface RegionalCustomerSalesTableProps {
  region: string
  dateRange: { start: string; end: string }
}

type SortField = "fullname" | "accountnumber" | "servicepointnumber" | "lastbillconsumption" | "currentbalance" | "lastbilldate"
type SortOrder = "asc" | "desc"

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatKwhRaw(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 })
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

export function RegionalCustomerSalesTable({ region, dateRange }: RegionalCustomerSalesTableProps) {
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [searchTerm, setSearchTerm] = useState("")
  const [sortField, setSortField] = useState<SortField>("lastbillconsumption")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")

  const { data, isLoading } = useCustomerConsumptionDetail({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    region,
    page: 1,
    limit: 1000,
  })

  const filteredData = useMemo(() => {
    const records = data?.data || []
    return records.filter((r: any) => {
      const searchLower = searchTerm.toLowerCase()
      return (
        (r.fullname?.toLowerCase() || "").includes(searchLower) ||
        (r.accountnumber?.toLowerCase() || "").includes(searchLower) ||
        (r.servicepointnumber?.toLowerCase() || "").includes(searchLower)
      )
    })
  }, [data, searchTerm])

  const sortedData = useMemo(() => {
    const sorted = [...filteredData].sort((a: any, b: any) => {
      let aVal = a[sortField]
      let bVal = b[sortField]

      if (aVal === null || aVal === undefined) aVal = 0
      if (bVal === null || bVal === undefined) bVal = 0

      if (typeof aVal === "string") {
        return sortOrder === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }

      return sortOrder === "asc" ? aVal - bVal : bVal - aVal
    })

    return sorted
  }, [filteredData, sortField, sortOrder])

  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize
    const end = start + pageSize
    return sortedData.slice(start, end)
  }, [sortedData, page, pageSize])

  const totalPages = Math.ceil(sortedData.length / pageSize)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortOrder("desc")
    }
  }

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-foreground cursor-pointer"
    >
      {children}
      {sortField === field && <ArrowUpDown className="h-3 w-3" />}
    </button>
  )

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">Loading customer data...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>Customer Records</CardTitle>
            <CardDescription>Individual customer consumption and billing — {filteredData.length} records</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton
              data={sortedData.map((r: any) => ({
                customer_name: r.fullname,
                account_number: r.accountnumber,
                service_point: r.servicepointnumber,
                last_bill_consumption_kwh: r.lastbillconsumption,
                current_balance: r.currentbalance,
                last_bill_date: r.lastbilldate,
                data_src: r.data_src,
              }))}
              filename={`${region.replace(/\s+/g, "-").toLowerCase()}-zeus-customer-sales`}
            />
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by name, account, service point..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setPage(1)
                }}
                className="pl-8 w-64"
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <Table className="text-xs max-h-[600px]">
            <TableHeader>
              <TableRow>
                <TableHead className="py-2">
                  <SortButton field="fullname">Customer Name</SortButton>
                </TableHead>
                <TableHead className="text-right py-2">
                  <SortButton field="accountnumber">Account</SortButton>
                </TableHead>
                <TableHead className="text-right py-2">
                  <SortButton field="servicepointnumber">SP</SortButton>
                </TableHead>
                <TableHead className="py-2">Type</TableHead>
                <TableHead className="text-right bg-blue-50 py-2">
                  <SortButton field="lastbillconsumption">kWh</SortButton>
                </TableHead>
                <TableHead className="text-right py-2">
                  <SortButton field="currentbalance">Balance</SortButton>
                </TableHead>
                <TableHead className="py-2">
                  <SortButton field="lastbilldate">Date</SortButton>
                </TableHead>
                <TableHead className="py-2">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((record: any, idx: number) => (
                  <TableRow key={idx} className="hover:bg-muted/50">
                    <TableCell className="py-2 font-medium truncate">{record.fullname || "—"}</TableCell>
                    <TableCell className="text-right py-2">
                      <Link
                        href={`/customer-sales/account/${encodeURIComponent(record.accountnumber)}?dateFrom=${dateRange.start}&dateTo=${dateRange.end}`}
                        className="text-primary hover:underline text-[11px] font-mono"
                      >
                        {record.accountnumber || "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <Link
                        href={`/customer-sales/service-point/${encodeURIComponent(record.servicepointnumber)}?dateFrom=${dateRange.start}&dateTo=${dateRange.end}`}
                        className="text-primary hover:underline text-[11px] font-mono"
                      >
                        {record.servicepointnumber || "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="py-2">{record.servicetype || "—"}</TableCell>
                    <TableCell className="text-right bg-blue-50/50 py-2 font-semibold text-blue-700 tabular-nums">
                      {formatKwhRaw(record.lastbillconsumption)}
                    </TableCell>
                    <TableCell className="text-right py-2 tabular-nums">
                      <span
                        className={
                          record.currentbalance != null && record.currentbalance > 0
                            ? "text-red-600 font-medium"
                            : "text-green-600 font-medium"
                        }
                      >
                        ₵{formatNumber(record.currentbalance)}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 text-muted-foreground whitespace-nowrap">
                      {formatDate(record.lastbilldate)}
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge
                        variant={record.contractstatus === "Active" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {record.contractstatus || "—"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No records found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {sortedData.length > 0 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              {sortedData.length > 0 && `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, sortedData.length)} of ${sortedData.length} records`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground min-w-[60px] text-center">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
