"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCustomerConsumptionDetail } from "@/hooks/api/use-customer-consumption-detail-api"
import { useCustomerConsumptionAggregate } from "@/hooks/api/use-customer-consumption-aggregate-api"
import { ArrowUpDown, ChevronLeft, ChevronRight, ExternalLink, Search, Zap } from "lucide-react"

interface CustomerSalesDetailProps {
    dateRange: { start: string; end: string }
    region?: string
    district?: string
    serviceType?: string
}

type SortField = "lastbilldate" | "lastbillconsumption" | "lastbillamount" | "currentbalance" | "lastpaymentdate" | "fullname"
type SortOrder = "asc" | "desc"

const PAGE_SIZE = 50
const ALL = "all"

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

function uniqueSorted(values: Array<string | null | undefined>) {
    return Array.from(
        new Set(
            values
                .map((v) => (v || "").trim())
                .filter(Boolean),
        ),
    ).sort((a, b) => a.localeCompare(b))
}

export function CustomerSalesDetail({ dateRange, region, district, serviceType }: CustomerSalesDetailProps) {
    const [page, setPage] = useState(1)
    const [searchTerm, setSearchTerm] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")
    const [filterRegion, setFilterRegion] = useState(region?.trim() || ALL)
    const [filterDistrict, setFilterDistrict] = useState(district?.trim() || ALL)
    const [filterAccountType, setFilterAccountType] = useState(ALL)
    const [filterCustomerType, setFilterCustomerType] = useState(ALL)
    const [sortField, setSortField] = useState<SortField>("lastbillconsumption")
    const [sortOrder, setSortOrder] = useState<SortOrder>("desc")

    // Keep table filters in sync when parent chart / global filters change.
    useEffect(() => {
        setFilterRegion(region?.trim() || ALL)
        setFilterDistrict(district?.trim() || ALL)
    }, [region, district])

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300)
        return () => clearTimeout(t)
    }, [searchTerm])

    const effectiveRegion = filterRegion === ALL ? undefined : filterRegion
    const effectiveDistrict = filterDistrict === ALL ? undefined : filterDistrict
    const effectiveAccountType =
        filterAccountType === ALL ? undefined : filterAccountType
    const effectiveCustomerType =
        filterCustomerType === ALL ? undefined : filterCustomerType

    useEffect(() => {
        setPage(1)
    }, [
        debouncedSearch,
        filterRegion,
        filterDistrict,
        filterAccountType,
        filterCustomerType,
        dateRange.start,
        dateRange.end,
        serviceType,
    ])

    const aggBase = {
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        serviceType,
    }

    const { data: regionAgg } = useCustomerConsumptionAggregate({
        ...aggBase,
        groupBy: "regionname",
    })
    const { data: districtAgg } = useCustomerConsumptionAggregate({
        ...aggBase,
        region: effectiveRegion,
        groupBy: "districtname",
    })
    const { data: accountTypeAgg } = useCustomerConsumptionAggregate({
        ...aggBase,
        region: effectiveRegion,
        district: effectiveDistrict,
        groupBy: "accounttype",
    })
    const { data: customerTypeAgg } = useCustomerConsumptionAggregate({
        ...aggBase,
        region: effectiveRegion,
        district: effectiveDistrict,
        accountType: effectiveAccountType,
        groupBy: "customertype",
    })

    const regionOptions = useMemo(
        () => uniqueSorted((regionAgg || []).map((r) => r.regionname)),
        [regionAgg],
    )
    const districtOptions = useMemo(
        () => uniqueSorted((districtAgg || []).map((r) => r.districtname)),
        [districtAgg],
    )
    const accountTypeOptions = useMemo(
        () => uniqueSorted((accountTypeAgg || []).map((r) => r.accounttype)),
        [accountTypeAgg],
    )
    const customerTypeOptions = useMemo(() => {
        const fromAgg = uniqueSorted(
            (customerTypeAgg || []).map((r) => r.customertype),
        )
        // Always offer the common pair even if aggregates are still loading.
        const fallback = ["Individual", "Organization"]
        return uniqueSorted([...fallback, ...fromAgg])
    }, [customerTypeAgg])

    // Drop district if it is no longer valid for the selected region.
    useEffect(() => {
        if (
            filterDistrict !== ALL &&
            districtOptions.length > 0 &&
            !districtOptions.includes(filterDistrict)
        ) {
            setFilterDistrict(ALL)
        }
    }, [filterDistrict, districtOptions])

    const { data: detailData, isLoading, isFetching } = useCustomerConsumptionDetail({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        region: effectiveRegion,
        district: effectiveDistrict,
        serviceType,
        accountType: effectiveAccountType,
        customerType: effectiveCustomerType,
        search: debouncedSearch || undefined,
        page,
        limit: PAGE_SIZE,
        sortBy: sortField,
        sortDir: sortOrder,
    })

    const records = detailData?.data || []
    const total = detailData?.total || 0
    const totalPages = Math.max(1, detailData?.total_pages || 1)
    const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
    const to = Math.min(page * PAGE_SIZE, total)

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

    const filterSummary = [
        filterRegion !== ALL ? filterRegion : null,
        filterDistrict !== ALL ? filterDistrict : null,
        filterAccountType !== ALL ? filterAccountType : null,
        filterCustomerType !== ALL ? filterCustomerType : null,
    ]
        .filter(Boolean)
        .join(" · ")

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <CardTitle>Customer Records</CardTitle>
                        <CardDescription>
                            {filterSummary || "All customer types"} — consumption and billing, sorted by highest kWh by default
                        </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-sm font-medium px-3 py-1">
                        {total.toLocaleString()} customers
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">

                <div className="flex flex-col gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name, account, service point, or district..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <Select
                            value={filterRegion}
                            onValueChange={(v) => {
                                setFilterRegion(v)
                                setFilterDistrict(ALL)
                            }}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Region" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>All regions</SelectItem>
                                {regionOptions.map((name) => (
                                    <SelectItem key={name} value={name}>
                                        {name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={filterDistrict}
                            onValueChange={setFilterDistrict}
                            disabled={filterRegion === ALL && districtOptions.length === 0}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="District" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>All districts</SelectItem>
                                {districtOptions.map((name) => (
                                    <SelectItem key={name} value={name}>
                                        {name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={filterAccountType}
                            onValueChange={setFilterAccountType}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Account type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>All account types</SelectItem>
                                {accountTypeOptions.map((name) => (
                                    <SelectItem key={name} value={name}>
                                        {name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={filterCustomerType}
                            onValueChange={setFilterCustomerType}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Customer type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>
                                    All (Individuals & Organizations)
                                </SelectItem>
                                {customerTypeOptions.map((name) => (
                                    <SelectItem key={name} value={name}>
                                        {name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className={`border rounded-lg overflow-hidden ${isFetching && !isLoading ? "opacity-70" : ""}`}>
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
                                    <TableHead>Account Type</TableHead>
                                    <TableHead>Data Source</TableHead>
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
                                            {[...Array(17)].map((_, j) => (
                                                <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                ) : records.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={17} className="text-center py-12 text-muted-foreground">
                                            No records found for the selected filters
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    records.map((c, idx) => (
                                        <TableRow key={`${c.accountnumber}-${c.servicepointnumber}-${c.billmonth}-${idx}`} className="hover:bg-muted/40">
                                            <TableCell className="font-medium text-sm max-w-[190px] truncate" title={c.fullname}>
                                                {c.fullname || "—"}
                                            </TableCell>
                                            <TableCell className="text-sm font-mono">
                                                {c.accountnumber ? (
                                                    <Link
                                                        href={`/customer-sales/account/${encodeURIComponent(c.accountnumber)}?dateFrom=${dateRange.start}&dateTo=${dateRange.end}`}
                                                        className="inline-flex items-center gap-1 text-primary hover:underline"
                                                    >
                                                        {c.accountnumber}
                                                        <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                                                    </Link>
                                                ) : "—"}
                                            </TableCell>
                                            <TableCell className="text-sm font-mono">
                                                {c.servicepointnumber ? (
                                                    <Link
                                                        href={`/customer-sales/service-point/${encodeURIComponent(c.servicepointnumber)}?dateFrom=${dateRange.start}&dateTo=${dateRange.end}`}
                                                        className="inline-flex items-center gap-1 text-primary hover:underline"
                                                    >
                                                        {c.servicepointnumber}
                                                        <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                                                    </Link>
                                                ) : "—"}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{c.regionname || "—"}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{c.districtname || "—"}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-xs font-normal">{c.servicetype || "—"}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="secondary"
                                                    className={`text-xs font-normal ${
                                                        c.customertype === "Organization"
                                                            ? "bg-violet-100 text-violet-800"
                                                            : "bg-sky-100 text-sky-800"
                                                    }`}
                                                >
                                                    {c.customertype || "—"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {c.accounttype || "—"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-xs font-normal border-blue-300 text-blue-700">
                                                    {c.data_src || "Zeus"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-semibold text-blue-700 tabular-nums bg-blue-50/50">
                                                {formatKwh(c.lastbillconsumption)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-sm">
                                                {formatMoney(c.lastbillamount)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-sm">
                                                {formatMoney(c.currentbalance)}
                                            </TableCell>
                                            <TableCell className="text-sm tabular-nums bg-amber-50/50 text-amber-900">
                                                {formatDate(c.lastbilldate)}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                {c.billmonth || "—"}
                                            </TableCell>
                                            <TableCell className="text-sm tabular-nums">
                                                {formatDate(c.lastpaymentdate)}
                                            </TableCell>
                                            <TableCell className="text-sm tabular-nums">
                                                {formatDate(c.lastreadingdate)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={`text-xs font-normal ${
                                                        c.contractstatus === "Active"
                                                            ? "border-green-300 text-green-700"
                                                            : "border-slate-300 text-slate-600"
                                                    }`}
                                                >
                                                    {c.contractstatus || "—"}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-1">
                        <p className="text-sm text-muted-foreground">
                            Showing {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1 || isFetching}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Previous
                            </Button>
                            <span className="text-sm tabular-nums text-muted-foreground px-1">
                                Page {page} of {totalPages.toLocaleString()}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= totalPages || isFetching}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            >
                                Next
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
