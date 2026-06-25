"use client"

import Link from "next/link"
import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useCustomerConsumptionDetail } from "@/hooks/api/use-customer-consumption-detail-api"
import { ArrowUpDown, ChevronLeft, ChevronRight, ExternalLink, Search, Zap } from "lucide-react"

interface CustomerSalesDetailProps {
    dateRange: { start: string; end: string }
}

type SortField = "lastbilldate" | "lastbillconsumption" | "lastbillamount" | "currentbalance" | "lastpaymentdate" | "fullname"
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

function dateValue(v: string | null | undefined) {
    if (!v) return 0
    return new Date(v).getTime()
}

export function CustomerSalesDetail({ dateRange }: CustomerSalesDetailProps) {
    const [page, setPage] = useState(1)
    const [searchTerm, setSearchTerm] = useState("")
    const [sortField, setSortField] = useState<SortField>("lastbilldate")
    const [sortOrder, setSortOrder] = useState<SortOrder>("desc")

    const { data: detailData, isLoading } = useCustomerConsumptionDetail({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        page: 1,
        limit: 2000,
    })

    const rawRecords = detailData?.data || []

    const filteredAndSorted = useMemo(() => {
        let filtered = rawRecords

        if (searchTerm) {
            const q = searchTerm.toLowerCase()
            filtered = filtered.filter(
                (c) =>
                    c.fullname?.toLowerCase().includes(q) ||
                    c.accountnumber?.toLowerCase().includes(q) ||
                    c.servicepointnumber?.toLowerCase().includes(q) ||
                    c.districtname?.toLowerCase().includes(q) ||
                    c.regionname?.toLowerCase().includes(q)
            )
        }

        return [...filtered].sort((a, b) => {
            let aVal: number
            let bVal: number

            if (sortField === "fullname") {
                const cmp = (a.fullname || "").localeCompare(b.fullname || "")
                return sortOrder === "asc" ? cmp : -cmp
            }

            if (sortField === "lastbilldate" || sortField === "lastpaymentdate") {
                aVal = dateValue(a[sortField])
                bVal = dateValue(b[sortField])
            } else {
                aVal = (a[sortField] as number) ?? 0
                bVal = (b[sortField] as number) ?? 0
            }

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
                        <CardTitle>Customer Records</CardTitle>
                        <CardDescription>
                            Individual customer consumption and billing — default sorted by highest kWh
                        </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-sm font-medium px-3 py-1">
                        {filteredAndSorted.length.toLocaleString()} customers
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">

                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name, account, service point, or district..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setPage(1) }}
                        className="pl-8"
                    />
                </div>

                <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/40">
                                    <TableHead className="w-[190px]">
                                        <SortButton field="fullname">Customer</SortButton>
                                    </TableHead>
                                    <TableHead>Account No.</TableHead>
                                    <TableHead>Service Point No.</TableHead>
                                    <TableHead>Region</TableHead>
                                    <TableHead>District</TableHead>
                                    <TableHead>Service Type</TableHead>
                                    <TableHead>Customer Type</TableHead>
                                    <TableHead>Data Source</TableHead>
                                    {/* kWh — primary column */}
                                    <TableHead className="text-right bg-blue-50">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <Zap className="h-3.5 w-3.5 text-blue-600" />
                                            <SortButton field="lastbillconsumption">
                                                <span className="text-blue-700">Consumption (kWh)</span>
                                            </SortButton>
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-right">
                                        <SortButton field="lastbillamount">Last Bill (₵)</SortButton>
                                    </TableHead>
                                    <TableHead className="text-right">
                                        <SortButton field="currentbalance">Balance (₵)</SortButton>
                                    </TableHead>
                                    {/* lastbilldate — driving column for understanding multi-month data */}
                                    <TableHead className="bg-amber-50 min-w-[140px]">
                                        <SortButton field="lastbilldate">
                                            <span className="text-amber-700">Bill Date</span>
                                        </SortButton>
                                    </TableHead>
                                    <TableHead>Bill Month</TableHead>
                                    <TableHead>
                                        <SortButton field="lastpaymentdate">Payment Date</SortButton>
                                    </TableHead>
                                    <TableHead>Reading Date</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    [...Array(12)].map((_, i) => (
                                        <TableRow key={i}>
                                            {[...Array(16)].map((_, j) => (
                                                <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                ) : paginated.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={16} className="text-center py-12 text-muted-foreground">
                                            No records found for the selected date range
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginated.map((c, idx) => (
                                        <TableRow key={`${c.accountnumber}-${c.servicepointnumber}-${c.billmonth}-${idx}`} className="hover:bg-muted/40">

                                            <TableCell className="font-medium truncate max-w-[190px]" title={c.fullname}>
                                                {c.fullname || "—"}
                                            </TableCell>

                                            {/* Account number — opens account detail (all service points for this account) */}
                                            <TableCell>
                                                <Link
                                                    href={`/customer-sales/account/${encodeURIComponent(c.accountnumber)}?dateFrom=${dateRange.start}&dateTo=${dateRange.end}`}
                                                    className="flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                                                >
                                                    {c.accountnumber}
                                                    <ExternalLink className="h-3 w-3 shrink-0" />
                                                </Link>
                                            </TableCell>

                                            {/* Service point number — opens service point detail */}
                                            <TableCell>
                                                <Link
                                                    href={`/customer-sales/service-point/${encodeURIComponent(c.servicepointnumber)}?dateFrom=${dateRange.start}&dateTo=${dateRange.end}`}
                                                    className="flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                                                >
                                                    {c.servicepointnumber || "—"}
                                                    <ExternalLink className="h-3 w-3 shrink-0" />
                                                </Link>
                                            </TableCell>

                                            <TableCell className="text-xs text-muted-foreground">{c.regionname || "—"}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{c.districtname || "—"}</TableCell>
                                            <TableCell className="text-xs">{c.servicetype || "—"}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-xs font-normal">{c.customertype || "Unknown"}</Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{c.data_src || "—"}</TableCell>

                                            {/* kWh hero */}
                                            <TableCell className="text-right bg-blue-50/50">
                        <span className="font-bold text-blue-700 tabular-nums text-sm">
                          {formatKwh(c.lastbillconsumption)}
                        </span>
                                            </TableCell>

                                            <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                                                {formatMoney(c.lastbillamount)}
                                            </TableCell>

                                            <TableCell className="text-right tabular-nums text-xs">
                        <span className={c.currentbalance != null && c.currentbalance > 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                          {formatMoney(c.currentbalance)}
                        </span>
                                            </TableCell>

                                            {/* Bill Date — highlighted amber, primary temporal anchor */}
                                            <TableCell className="bg-amber-50/40 whitespace-nowrap text-xs font-medium text-amber-900">
                                                {formatDate(c.lastbilldate)}
                                            </TableCell>

                                            {/* Bill Month */}
                                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                {c.billmonth || "—"}
                                            </TableCell>

                                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                {formatDate(c.lastpaymentdate)}
                                            </TableCell>

                                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                {formatDate(c.lastreadingdate)}
                                            </TableCell>

                                            <TableCell>
                                                <Badge variant={c.contractstatus === "Active" ? "default" : "secondary"} className="text-xs">
                                                    {c.contractstatus || "Unknown"}
                                                </Badge>
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
