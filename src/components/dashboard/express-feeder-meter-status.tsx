"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import {
    BarChart,
    Bar,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TablePagination } from "@/components/ui/table-pagination"
import { ArrowUpDown } from "lucide-react"
import {
    useMeterStatusSummary,
    useStatusTimeline,
    useMeterStatusDetails,
} from "@/hooks/api/use-meter-status-api"

interface ExpressFeederMeterStatusProps {
    params: {
        dateFrom: string
        dateTo: string
        regions?: string[]
        districts?: string[]
        stations?: string[]
        boundaryMeteringPoints?: string[]
        voltages?: string[]
    }
}

export function ExpressFeederMeterStatus({ params }: ExpressFeederMeterStatusProps) {
    const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all")
    const [statusPage, setStatusPage] = useState(1)
    const statusPerPage = 20
    const [meterStatusSearch, setMeterStatusSearch] = useState("")
    const [statusSortColumn, setStatusSortColumn] = useState<string>("consumption")
    const [statusSortDirection, setStatusSortDirection] = useState<"asc" | "desc">("desc")

    // Convert voltages from string[] to number[] for the meter status API
    const statusParams = useMemo(
        () => ({
            ...params,
            meterTypes: ["EXPRESS_FEEDER"],
            voltages: (params.voltages || []).map(Number).filter(Boolean),
        }),
        [params],
    )

    const { data: statusSummary, isLoading: isLoadingStatus } = useMeterStatusSummary(statusParams)
    const { data: statusTimeline, isLoading: isLoadingTimeline } = useStatusTimeline(statusParams)
    const { data: detailsData, isLoading: detailsLoading } = useMeterStatusDetails({
        ...statusParams,
        status: statusFilter === "all" ? undefined : statusFilter,
        page: statusPage,
        limit: statusPerPage,
        search: meterStatusSearch,
        sortBy: statusSortColumn,
        sortOrder: statusSortDirection,
    })

    const formattedStatusTimeline = useMemo(() => {
        if (!statusTimeline) return []
        return statusTimeline.map((item: any) => ({
            ...item,
            date: format(parseISO(item.date), "MMM d, yyyy"),
        }))
    }, [statusTimeline])

    const meterStatusTableData = useMemo(() => {
        if (!detailsData?.data) return []
        return detailsData.data.map((record: any) => ({
            meter_number: record.meter_number,
            region: record.boundary_point || record.region || "N/A",
            district: record.district || "N/A",
            station: record.station || "N/A",
            status: record.status,
            total_consumption: record.total_consumption_kwh || 0,
            avg_reading_count: record.reading_count || 0,
            last_reading_time:
                record.last_reading_date ||
                record.last_reading_time ||
                record.last_reading ||
                record.consumption_date ||
                null,
            uptimePercentage: record.uptime_percentage || 0,
            days_offline: record.days_offline || 0,
        }))
    }, [detailsData])

    const totalStatusPages = detailsData?.pagination?.total_pages || 1
    const totalStatusItems = detailsData?.pagination?.total || 0

    const handleStatusSort = (column: string) => {
        if (statusSortColumn === column) {
            setStatusSortDirection(statusSortDirection === "asc" ? "desc" : "asc")
        } else {
            setStatusSortColumn(column)
            setStatusSortDirection("desc")
        }
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Meters</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoadingStatus ? (
                            <Skeleton className="h-8 w-24" />
                        ) : (
                            <div className="text-3xl font-bold">{statusSummary?.total ?? 0}</div>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Online</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoadingStatus ? (
                            <Skeleton className="h-8 w-24" />
                        ) : (
                            <>
                                <div className="text-3xl font-bold text-green-600">{statusSummary?.online ?? 0}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {statusSummary?.online_percentage?.toFixed(1) ?? "—"}% uptime
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Offline</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoadingStatus ? (
                            <Skeleton className="h-8 w-24" />
                        ) : (
                            <>
                                <div className="text-3xl font-bold text-red-600">{statusSummary?.total_offline ?? 0}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {statusSummary?.offline_percentage?.toFixed(1) ?? "—"}% offline
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Avg Uptime</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoadingStatus ? (
                            <Skeleton className="h-8 w-24" />
                        ) : (
                            <div
                                className={`text-3xl font-bold ${
                                    (statusSummary?.avg_uptime_percentage ?? 0) >= 90
                                        ? "text-green-600"
                                        : (statusSummary?.avg_uptime_percentage ?? 0) >= 70
                                            ? "text-yellow-600"
                                            : "text-red-600"
                                }`}
                            >
                                {statusSummary?.avg_uptime_percentage?.toFixed(1) ?? "—"}%
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Status Timeline Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Meter Status Timeline</CardTitle>
                    <CardDescription>Daily online vs offline meter count over the selected period</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingTimeline ? (
                        <Skeleton className="h-[350px] w-full" />
                    ) : formattedStatusTimeline.length > 0 ? (
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={formattedStatusTimeline}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="online" stackId="status" fill="hsl(142, 76%, 36%)" name="Online" />
                                <Bar dataKey="offline" stackId="status" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} name="Offline" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                            No status timeline data available for the selected period
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Meter Status Details Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Meter Status Details</CardTitle>
                    <CardDescription>Individual meter health and reporting status for express feeders</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                        <Input
                            placeholder="Search meter number..."
                            value={meterStatusSearch}
                            onChange={(e) => {
                                setMeterStatusSearch(e.target.value)
                                setStatusPage(1)
                            }}
                            className="max-w-xs"
                        />
                        <div className="flex gap-2">
                            <Button
                                variant={statusFilter === "all" ? "default" : "outline"}
                                size="sm"
                                onClick={() => { setStatusFilter("all"); setStatusPage(1) }}
                            >
                                All ({statusSummary?.total || 0})
                            </Button>
                            <Button
                                variant={statusFilter === "online" ? "default" : "outline"}
                                size="sm"
                                onClick={() => { setStatusFilter("online"); setStatusPage(1) }}
                            >
                                Online ({statusSummary?.online || 0})
                            </Button>
                            <Button
                                variant={statusFilter === "offline" ? "default" : "outline"}
                                size="sm"
                                onClick={() => { setStatusFilter("offline"); setStatusPage(1) }}
                            >
                                Offline ({statusSummary?.total_offline || 0})
                            </Button>
                        </div>
                    </div>

                    {detailsLoading ? (
                        <div className="space-y-3">
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="sticky left-0 z-10 bg-background">
                                                <Button variant="ghost" onClick={() => handleStatusSort("meter_number")} className="h-8 px-2">
                                                    Meter Number <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                                                </Button>
                                            </TableHead>
                                            <TableHead>Region / Station</TableHead>
                                            <TableHead>
                                                <Button variant="ghost" onClick={() => handleStatusSort("status")} className="h-8 px-2">
                                                    Status <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                                                </Button>
                                            </TableHead>
                                            <TableHead>
                                                <Button variant="ghost" onClick={() => handleStatusSort("last_reading")} className="h-8 px-2">
                                                    Last Reading <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                                                </Button>
                                            </TableHead>
                                            <TableHead>
                                                <Button variant="ghost" onClick={() => handleStatusSort("consumption")} className="h-8 px-2">
                                                    Total Consumption <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                                                </Button>
                                            </TableHead>
                                            <TableHead>
                                                <Button variant="ghost" onClick={() => handleStatusSort("uptime")} className="h-8 px-2">
                                                    Uptime % <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                                                </Button>
                                            </TableHead>
                                            <TableHead>
                                                <Button variant="ghost" onClick={() => handleStatusSort("days_offline")} className="h-8 px-2">
                                                    Days Offline <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                                                </Button>
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {meterStatusTableData.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                                                    No meter status data available
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            meterStatusTableData.map((meter) => (
                                                <TableRow key={meter.meter_number}>
                                                    <TableCell className="sticky left-0 z-10 bg-background font-medium">
                                                        <Link
                                                            href={`/meters/${meter.meter_number}`}
                                                            className="hover:text-blue-600 hover:underline"
                                                        >
                                                            {meter.meter_number}
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1.5 text-sm">
                                                            <span>{meter.region || "—"}</span>
                                                            <span className="text-muted-foreground">•</span>
                                                            <span className="text-muted-foreground">{meter.station || "—"}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={meter.status === "ONLINE" ? "default" : "destructive"}>
                                                            {meter.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {meter.last_reading_time ? (
                                                            <div>
                                                                <div className="text-sm">
                                                                    {new Date(meter.last_reading_time).toLocaleDateString()}
                                                                </div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    {new Date(meter.last_reading_time).toLocaleTimeString()}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground">—</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="tabular-nums">
                                                        {meter.total_consumption?.toFixed(2) ?? "0"} kWh
                                                    </TableCell>
                                                    <TableCell>
                            <span
                                className={
                                    meter.uptimePercentage >= 90
                                        ? "text-green-600 font-medium"
                                        : meter.uptimePercentage >= 70
                                            ? "text-yellow-600 font-medium"
                                            : "text-red-600 font-medium"
                                }
                            >
                              {meter.uptimePercentage.toFixed(1)}%
                            </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        {meter.days_offline > 0 ? (
                                                            <span className="text-red-600 font-medium">{meter.days_offline}</span>
                                                        ) : (
                                                            <span className="text-muted-foreground">—</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {meterStatusTableData.length > 0 && (
                                <div className="mt-4">
                                    <TablePagination
                                        currentPage={statusPage}
                                        totalPages={totalStatusPages}
                                        onPageChange={setStatusPage}
                                        totalItems={totalStatusItems}
                                        itemsPerPage={statusPerPage}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
