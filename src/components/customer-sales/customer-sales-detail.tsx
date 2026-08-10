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
import { useZeusBillingDetail } from "@/hooks/api/use-zeus-billing-detail-api"
import { useZeusBillingAggregate } from "@/hooks/api/use-zeus-billing-aggregate-api"
import { ArrowUpDown, ChevronLeft, ChevronRight, ExternalLink, Search, Zap } from "lucide-react"

// Backend sort keys (internal/zeusbilling detailSortCols) — "outstandingamount"
// and payment/period fields are not whitelisted there, so those columns are
// rendered but not sortable.
type SortField = "createdAt" | "billConsumptionValue" | "billAmount" | "debtAmount" | "amountDue" | "customerName"
type SortOrder = "asc" | "desc"

interface CustomerSalesDetailProps {
    dateRange: { start: string; end: string }
    region?: string
    district?: string
    serviceType?: string
    initialSortField?: SortField
    initialSortOrder?: SortOrder
}

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

const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

function formatBillingPeriod(month: number | null | undefined, year: number | null | undefined) {
    if (!month || !year) return "—"
    const name = MONTH_NAMES[month - 1]
    return name ? `${name} ${year}` : `${month}/${year}`
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

export function CustomerSalesDetail({
    dateRange,
    region,
    district,
    serviceType,
    initialSortField = "billConsumptionValue",
    initialSortOrder = "desc",
}: CustomerSalesDetailProps) {
    const [page, setPage] = useState(1)
    const [searchTerm, setSearchTerm] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")
    const [filterRegion, setFilterRegion] = useState(region?.trim() || ALL)
    const [filterDistrict, setFilterDistrict] = useState(district?.trim() || ALL)
    const [filterAccountType, setFilterAccountType] = useState(ALL)
    const [filterBillStatus, setFilterBillStatus] = useState(ALL)
    const [filterMeterType, setFilterMeterType] = useState(serviceType?.trim() || ALL)
    const [sortField, setSortField] = useState<SortField>(initialSortField)
    const [sortOrder, setSortOrder] = useState<SortOrder>(initialSortOrder)

    // Keep table filters in sync when parent chart / global filters change.
    useEffect(() => {
        setFilterRegion(region?.trim() || ALL)
        setFilterDistrict(district?.trim() || ALL)
        setFilterMeterType(serviceType?.trim() || ALL)
    }, [region, district, serviceType])

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300)
        return () => clearTimeout(t)
    }, [searchTerm])

    const effectiveRegion = filterRegion === ALL ? undefined : filterRegion
    const effectiveDistrict = filterDistrict === ALL ? undefined : filterDistrict
    const effectiveAccountType =
        filterAccountType === ALL ? undefined : filterAccountType
    const effectiveBillStatus =
        filterBillStatus === ALL ? undefined : filterBillStatus
    const effectiveMeterType =
        filterMeterType === ALL ? undefined : filterMeterType

    useEffect(() => {
        setPage(1)
    }, [
        debouncedSearch,
        filterRegion,
        filterDistrict,
        filterAccountType,
        filterBillStatus,
        filterMeterType,
        dateRange.start,
        dateRange.end,
    ])

    const aggBase = {
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        meterModelType: effectiveMeterType,
    }

    const { data: regionAgg } = useZeusBillingAggregate({
        ...aggBase,
        groupBy: "regionname",
    })
    const { data: districtAgg } = useZeusBillingAggregate({
        ...aggBase,
        region: effectiveRegion,
        groupBy: "districtname",
    })
    const { data: accountTypeAgg } = useZeusBillingAggregate({
        ...aggBase,
        region: effectiveRegion,
        district: effectiveDistrict,
        groupBy: "accounttype",
    })
    const { data: billStatusAgg } = useZeusBillingAggregate({
        ...aggBase,
        region: effectiveRegion,
        district: effectiveDistrict,
        accountType: effectiveAccountType,
        groupBy: "billstatus",
    })
    // Only fetched when the meter type isn't locked by a parent hub page —
    // a locked hub (e.g. Postpaid) must never let its Customer Records table
    // filter across into another hub's records (e.g. Prepaid).
    const { data: meterTypeAgg } = useZeusBillingAggregate({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        region: effectiveRegion,
        district: effectiveDistrict,
        accountType: effectiveAccountType,
        groupBy: "metermodeltype",
        enabled: !serviceType,
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
    const billStatusOptions = useMemo(
        () => uniqueSorted((billStatusAgg || []).map((r) => r.billstatus)),
        [billStatusAgg],
    )
    const meterTypeOptions = useMemo(
        () => uniqueSorted((meterTypeAgg || []).map((r) => r.metermodeltype)),
        [meterTypeAgg],
    )

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

    const { data: detailData, isLoading, isFetching } = useZeusBillingDetail({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        region: effectiveRegion,
        district: effectiveDistrict,
        meterModelType: effectiveMeterType,
        accountType: effectiveAccountType,
        billStatus: effectiveBillStatus,
        search: debouncedSearch || undefined,
        page,
        limit: PAGE_SIZE,
        sortBy: sortField.toLowerCase(),
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
        filterBillStatus !== ALL ? filterBillStatus : null,
        filterMeterType !== ALL ? filterMeterType : null,
    ]
        .filter(Boolean)
        .join(" · ")

    const SORT_FIELD_LABELS: Record<SortField, string> = {
        createdAt: "created date",
        billConsumptionValue: "kWh",
        billAmount: "bill amount",
        debtAmount: "debt",
        amountDue: "amount due",
        customerName: "customer name",
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <CardTitle>Customer Records</CardTitle>
                        <CardDescription>
                            {filterSummary || "All accounts"} — consumption and billing, sorted by highest{" "}
                            {SORT_FIELD_LABELS[sortField]}
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
                            placeholder="Search by name, account, or service point..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
                            value={filterBillStatus}
                            onValueChange={setFilterBillStatus}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Bill status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>All bill statuses</SelectItem>
                                {billStatusOptions.map((name) => (
                                    <SelectItem key={name} value={name}>
                                        {name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={filterMeterType}
                            onValueChange={setFilterMeterType}
                            disabled={Boolean(serviceType)}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Meter type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>All meter types</SelectItem>
                                {meterTypeOptions.map((name) => (
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
                                        <SortButton field="customerName">Customer</SortButton>
                                    </TableHead>
                                    <TableHead>Account Code</TableHead>
                                    <TableHead>Service Point Code</TableHead>
                                    <TableHead>Region</TableHead>
                                    <TableHead>District</TableHead>
                                    <TableHead>Meter Type</TableHead>
                                    <TableHead>Account Type</TableHead>
                                    <TableHead className="text-right bg-blue-50">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <Zap className="h-3.5 w-3.5 text-blue-600" />
                                            <SortButton field="billConsumptionValue">
                                                <span className="text-blue-700">Consumption (kWh)</span>
                                            </SortButton>
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-right">
                                        <SortButton field="billAmount">Bill (₵)</SortButton>
                                    </TableHead>
                                    <TableHead className="text-right">
                                        <SortButton field="debtAmount">Debt (₵)</SortButton>
                                    </TableHead>
                                    <TableHead className="text-right">
                                        <SortButton field="amountDue">Due (₵)</SortButton>
                                    </TableHead>
                                    <TableHead className="text-right">Outstanding (₵)</TableHead>
                                    <TableHead className="bg-amber-50 min-w-[120px]">
                                        <span className="text-amber-700">Billing Period</span>
                                    </TableHead>
                                    <TableHead>Payment Date</TableHead>
                                    <TableHead>Bill Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    [...Array(12)].map((_, i) => (
                                        <TableRow key={i}>
                                            {[...Array(15)].map((_, j) => (
                                                <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                ) : records.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={15} className="text-center py-12 text-muted-foreground">
                                            No records found for the selected filters
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    records.map((c, idx) => (
                                        <TableRow key={`${c.accountCode}-${c.servicePointCode}-${c.billingYear}-${c.billingMonth}-${idx}`} className="hover:bg-muted/40">
                                            <TableCell className="font-medium text-sm max-w-[190px] truncate" title={c.customerName}>
                                                {c.customerName || "—"}
                                            </TableCell>
                                            <TableCell className="text-sm font-mono">
                                                {c.accountCode ? (
                                                    <Link
                                                        href={`/customer-sales/account/${encodeURIComponent(c.accountCode)}?dateFrom=${dateRange.start}&dateTo=${dateRange.end}`}
                                                        className="inline-flex items-center gap-1 text-primary hover:underline"
                                                    >
                                                        {c.accountCode}
                                                        <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                                                    </Link>
                                                ) : "—"}
                                            </TableCell>
                                            <TableCell className="text-sm font-mono">
                                                {c.servicePointCode ? (
                                                    <Link
                                                        href={`/customer-sales/service-point/${encodeURIComponent(c.servicePointCode)}?dateFrom=${dateRange.start}&dateTo=${dateRange.end}`}
                                                        className="inline-flex items-center gap-1 text-primary hover:underline"
                                                    >
                                                        {c.servicePointCode}
                                                        <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                                                    </Link>
                                                ) : "—"}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{c.regionName || "—"}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{c.districtName || "—"}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-xs font-normal">{c.meterModelType || "—"}</Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {c.accountType || "—"}
                                            </TableCell>
                                            <TableCell className="text-right font-semibold text-blue-700 tabular-nums bg-blue-50/50">
                                                {formatKwh(c.billConsumptionValue)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-sm">
                                                {formatMoney(c.billAmount)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-sm">
                                                {formatMoney(c.debtAmount)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-sm">
                                                {formatMoney(c.amountDue)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-sm">
                                                {formatMoney(c.outstandingAmount)}
                                            </TableCell>
                                            <TableCell className="text-sm tabular-nums bg-amber-50/50 text-amber-900">
                                                {formatBillingPeriod(c.billingMonth, c.billingYear)}
                                            </TableCell>
                                            <TableCell className="text-sm tabular-nums">
                                                {formatDate(c.lastPaymentDate)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={`text-xs font-normal ${
                                                        c.billStatus === "Billed"
                                                            ? "border-green-300 text-green-700"
                                                            : "border-slate-300 text-slate-600"
                                                    }`}
                                                >
                                                    {c.billStatus || "—"}
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
