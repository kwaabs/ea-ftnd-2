"use client"

import Link from "next/link"
import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useZeusBillingDetail } from "@/hooks/api/use-zeus-billing-detail-api"
import { ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react"
import { ExportButton } from "@/components/ui/export-button"

const ALL_BILL_STATUS = "all"
const ALL_ACCOUNT_TYPES = "all"

interface RegionalCustomerSalesTableProps {
  region?: string
  district?: string
  dateRange: { start: string; end: string }
  /** Locks the table to this Zeus meter model type (e.g. "Postpaid" / "Prepaid"). */
  meterModelType?: string
}

// "billingPeriod" is a virtual sort key (billingYear*100 + billingMonth) —
// zeus_sales has no single sortable bill-date field, only split year/month.
type SortField = "customerName" | "accountCode" | "servicePointCode" | "accountType" | "billConsumptionValue" | "debtAmount" | "billingPeriod"
type SortOrder = "asc" | "desc"

// Common shape both zeus_sales sources get normalized into, so the table
// can sort/filter/search across both. "zeus-amr" is the same zeus_sales
// table as "zeus", just metermodeltype = 'AMR' instead of 'Postpaid' —
// mirrors amr-page-view.tsx's own CustomerSalesDetail serviceType="AMR".
// (There's also a separate, deprecated app.amr_customer_records daily-
// reading pipeline — intentionally not used here.)
interface UnifiedRecord {
  source: "zeus" | "zeus-amr"
  customerName: string
  accountCode: string
  servicePointCode: string
  accountType: string
  billConsumptionValue: number
  debtAmount: number | null
  billingMonth: number | null
  billingYear: number | null
  billStatus: string | null
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatKwhRaw(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 })
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

function formatBillingPeriod(month: number | null | undefined, year: number | null | undefined): string {
  if (!month || !year) return "—"
  const name = MONTH_NAMES[month - 1]
  return name ? `${name} ${year}` : `${month}/${year}`
}

function billingPeriodValue(record: { billingYear?: number | null; billingMonth?: number | null }): number {
  return (record.billingYear || 0) * 100 + (record.billingMonth || 0)
}

function SortButton({
  field,
  activeField,
  onSort,
  children,
}: {
  field: SortField
  activeField: SortField
  onSort: (field: SortField) => void
  children: React.ReactNode
}) {
  return (
    // inline-flex, not flex: a block-level flex container ignores the
    // TableHead's text-right/text-left — it just sits at the inline-start
    // of the cell regardless, which misaligned the header from its
    // right-aligned column data (Account/SP/kWh/Debt) below it.
    <button
      onClick={() => onSort(field)}
      className="inline-flex items-center gap-1 hover:text-foreground cursor-pointer"
    >
      {children}
      {activeField === field && <ArrowUpDown className="h-3 w-3" />}
    </button>
  )
}

export function RegionalCustomerSalesTable({ region, district, dateRange, meterModelType }: RegionalCustomerSalesTableProps) {
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [searchTerm, setSearchTerm] = useState("")
  const [billStatusFilter, setBillStatusFilter] = useState(ALL_BILL_STATUS)
  const [accountTypeFilter, setAccountTypeFilter] = useState(ALL_ACCOUNT_TYPES)
  // Default to alphabetical by customer — a Postpaid/Prepaid account can have
  // several service points, and sorting by kWh scattered a customer's rows
  // across the whole table instead of keeping them together.
  const [sortField, setSortField] = useState<SortField>("customerName")
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc")

  const { data, isLoading } = useZeusBillingDetail({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    region,
    district,
    meterModelType,
    page: 1,
    limit: 1000,
  })

  // AMR customers belong on the Postpaid tab too (they're postpaid-billed
  // SLT/NSLT meters, same as postpaid-hub-view's own "AMR" tab), tagged with
  // a badge rather than split into a separate table. Only fetched for the
  // Postpaid-locked instance — Radix Tabs keeps both the Postpaid and
  // Prepaid RegionalCustomerSalesTable mounted at once, so without this
  // gate the Prepaid instance would fetch AMR data it never uses.
  const isPostpaid = meterModelType === "Postpaid"

  // "Zeus AMR" — same zeus_sales table as the Postpaid rows above, just
  // metermodeltype = 'AMR' instead of 'Postpaid'. Real debt/period/status.
  const { data: zeusAmrData, isLoading: zeusAmrLoading } = useZeusBillingDetail({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    region,
    district,
    meterModelType: "AMR",
    page: 1,
    limit: 1000,
    enabled: isPostpaid,
  })

  const zeusRecords = useMemo<UnifiedRecord[]>(
    () =>
      (data?.data || []).map((r) => ({
        source: "zeus",
        customerName: r.customerName,
        accountCode: r.accountCode,
        servicePointCode: r.servicePointCode,
        accountType: r.accountType,
        billConsumptionValue: r.billConsumptionValue,
        debtAmount: r.debtAmount,
        billingMonth: r.billingMonth,
        billingYear: r.billingYear,
        billStatus: r.billStatus,
      })),
    [data],
  )

  const zeusAmrRecords = useMemo<UnifiedRecord[]>(
    () =>
      (isPostpaid ? zeusAmrData?.data || [] : []).map((r) => ({
        source: "zeus-amr",
        customerName: r.customerName,
        accountCode: r.accountCode,
        servicePointCode: r.servicePointCode,
        accountType: r.accountType,
        billConsumptionValue: r.billConsumptionValue,
        debtAmount: r.debtAmount,
        billingMonth: r.billingMonth,
        billingYear: r.billingYear,
        billStatus: r.billStatus,
      })),
    [zeusAmrData, isPostpaid],
  )

  const allRecords = useMemo<UnifiedRecord[]>(
    () => [...zeusRecords, ...zeusAmrRecords],
    [zeusRecords, zeusAmrRecords],
  )

  const billStatusOptions = useMemo(() => {
    const values = new Set<string>()
    allRecords.forEach((r) => {
      if (r.billStatus?.trim()) values.add(r.billStatus.trim())
    })
    return [...values].sort((a, b) => a.localeCompare(b))
  }, [allRecords])

  const accountTypeOptions = useMemo(() => {
    const values = new Set<string>()
    allRecords.forEach((r) => {
      if (r.accountType?.trim()) values.add(r.accountType.trim())
    })
    return [...values].sort((a, b) => a.localeCompare(b))
  }, [allRecords])

  const filteredData = useMemo(() => {
    return allRecords.filter((r) => {
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch =
        (r.customerName?.toLowerCase() || "").includes(searchLower) ||
        (r.accountCode?.toLowerCase() || "").includes(searchLower) ||
        (r.servicePointCode?.toLowerCase() || "").includes(searchLower)
      const matchesBillStatus =
        billStatusFilter === ALL_BILL_STATUS || r.billStatus === billStatusFilter
      const matchesAccountType =
        accountTypeFilter === ALL_ACCOUNT_TYPES || r.accountType === accountTypeFilter
      return matchesSearch && matchesBillStatus && matchesAccountType
    })
  }, [allRecords, searchTerm, billStatusFilter, accountTypeFilter])

  const sortedData = useMemo(() => {
    const sorted = [...filteredData].sort((a, b) => {
      if (sortField === "billingPeriod") {
        const aVal = billingPeriodValue(a)
        const bVal = billingPeriodValue(b)
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal
      }

      const aVal: string | number = a[sortField] ?? 0
      const bVal: string | number = b[sortField] ?? 0

      if (typeof aVal === "string" || typeof bVal === "string") {
        return sortOrder === "asc"
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal))
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

  if (isLoading || (isPostpaid && zeusAmrLoading)) {
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
              data={sortedData.map((r) => ({
                data_source: r.source === "zeus-amr" ? "AMR" : "Zeus",
                customer_name: r.customerName,
                account_code: r.accountCode,
                service_point: r.servicePointCode,
                account_type: r.accountType,
                bill_consumption_kwh: r.billConsumptionValue,
                debt_amount: r.debtAmount,
                billing_period: formatBillingPeriod(r.billingMonth, r.billingYear),
              }))}
              filename={`${(region || district || "zeus").replace(/\s+/g, "-").toLowerCase()}-zeus-customer-sales`}
            />
            <Select
              value={billStatusFilter}
              onValueChange={(v) => {
                setBillStatusFilter(v)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Bill status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_BILL_STATUS}>All bill statuses</SelectItem>
                {billStatusOptions.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={accountTypeFilter}
              onValueChange={(v) => {
                setAccountTypeFilter(v)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Account type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ACCOUNT_TYPES}>All account types</SelectItem>
                {accountTypeOptions.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  <SortButton field="customerName" activeField={sortField} onSort={handleSort}>Customer Name</SortButton>
                </TableHead>
                <TableHead className="text-right py-2">
                  <SortButton field="accountCode" activeField={sortField} onSort={handleSort}>Account</SortButton>
                </TableHead>
                <TableHead className="text-right py-2">
                  <SortButton field="servicePointCode" activeField={sortField} onSort={handleSort}>SP</SortButton>
                </TableHead>
                <TableHead className="py-2">
                  <SortButton field="accountType" activeField={sortField} onSort={handleSort}>Account Type</SortButton>
                </TableHead>
                <TableHead className="text-right bg-blue-50 py-2">
                  <SortButton field="billConsumptionValue" activeField={sortField} onSort={handleSort}>kWh</SortButton>
                </TableHead>
                <TableHead className="text-right py-2">
                  <SortButton field="debtAmount" activeField={sortField} onSort={handleSort}>Debt</SortButton>
                </TableHead>
                <TableHead className="py-2">
                  <SortButton field="billingPeriod" activeField={sortField} onSort={handleSort}>Period</SortButton>
                </TableHead>
                <TableHead className="py-2">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((record, idx) => (
                  <TableRow key={idx} className="hover:bg-muted/50">
                    <TableCell className="py-2 font-medium truncate">
                      {record.customerName || "—"}
                      {record.source === "zeus-amr" && (
                        <Badge
                          variant="outline"
                          className="ml-1.5 text-[10px] border-orange-300 text-orange-700 bg-orange-50"
                        >
                          AMR
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <Link
                        href={`/customer-sales/account/${encodeURIComponent(record.accountCode)}?dateFrom=${dateRange.start}&dateTo=${dateRange.end}`}
                        className="text-primary hover:underline text-[11px] font-mono"
                      >
                        {record.accountCode || "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <Link
                        href={`/customer-sales/service-point/${encodeURIComponent(record.servicePointCode)}?dateFrom=${dateRange.start}&dateTo=${dateRange.end}`}
                        className="text-primary hover:underline text-[11px] font-mono"
                      >
                        {record.servicePointCode || "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="py-2">{record.accountType || "—"}</TableCell>
                    <TableCell className="text-right bg-blue-50/50 py-2 font-semibold text-blue-700 tabular-nums">
                      {formatKwhRaw(record.billConsumptionValue)}
                    </TableCell>
                    <TableCell className="text-right py-2 tabular-nums">
                      {record.debtAmount == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={
                            record.debtAmount > 0
                              ? "text-red-600 font-medium"
                              : "text-green-600 font-medium"
                          }
                        >
                          ₵{formatNumber(record.debtAmount)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-muted-foreground whitespace-nowrap">
                      {formatBillingPeriod(record.billingMonth, record.billingYear)}
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge
                        variant={record.billStatus === "Billed" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {record.billStatus || "—"}
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
