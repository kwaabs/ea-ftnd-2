"use client"

import Link from "next/link"

import React, { useState, useMemo } from "react"
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import { useAppStore } from "@/stores/app-store"
import { formatNumber, formatApiDate } from "@/lib/utils"
import { useFeedersTrafoAggregate, useFeedersTrafoDaily } from "@/hooks/api/use-feeders-trafo-api"
import { useMeterStatusSummary, useStatusTimeline, useMeterStatusDetails } from "@/hooks/api/use-meter-status-api"
import { format, parseISO } from "date-fns"
import {
    Area,
    AreaChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    Legend, BarChart, Bar,
} from "recharts"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { ChevronDown, Circle, ChevronRight, ArrowUpDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { TablePagination } from "@/components/ui/table-pagination"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface FeedersTrafoTabProps {
    meterTypes?: string[]
}

// Utility to convert "accra west" to "Accra West"
const toProperCase = (str: string) => {
    return str
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ")
}

export function FeedersTrafoTab({ meterTypes = ["BSP"] }: FeedersTrafoTabProps) {
    const filters = useAppStore((state) => state.filters)
    const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set())
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
    const [currentPage, setCurrentPage] = useState(1)
    const [groupBy, setGroupBy] = useState<"none" | "region" | "station">("none")
    const [selectedChartRegions, setSelectedChartRegions] = useState<string[]>([])
    const [heatmapMetric, setHeatmapMetric] = useState<"supply" | "reverseFlow" | "net">("supply")
    const [chartRegionFilter, setChartRegionFilter] = useState("all")
    const [showCumulative, setShowCumulative] = useState(false)

    // Status table state
    const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all")
    const [statusPage, setStatusPage] = useState(1)
    const statusPerPage = 20
    const [meterStatusSearch, setMeterStatusSearch] = useState("")
    const [statusSortColumn, setStatusSortColumn] = useState<string>("consumption")
    const [statusSortDirection, setStatusSortDirection] = useState<"asc" | "desc">("desc")

    const params = useMemo(
        () => ({
            dateFrom: formatApiDate(filters.dateRange?.start),
            dateTo: formatApiDate(filters.dateRange?.end),
            regions: filters.regions,
            districts: filters.districts,
            stations: filters.stations,
            boundaryMeteringPoints: filters.boundaryMeteringPoints,
            meterTypes,
            voltages: filters.voltageKvs?.map((v) => Number.parseInt(v)),
        }),
        [filters, meterTypes],
    )

    const { data: aggregateData, isLoading: isLoadingAggregate } = useFeedersTrafoAggregate(params)
    const { data: dailyData, isLoading: isLoadingDaily } = useFeedersTrafoDaily(params)
    const { data: statusSummary, isLoading: isLoadingStatus } = useMeterStatusSummary(params)
    const { data: statusTimeline, isLoading: isLoadingTimeline } = useStatusTimeline(params)
    const { data: detailsData, isLoading: detailsLoading } = useMeterStatusDetails({
        ...params,
        status: statusFilter === "all" ? undefined : statusFilter,
        page: statusPage,
        limit: statusPerPage,
        search: meterStatusSearch,
        sortBy: statusSortColumn,
        sortOrder: statusSortDirection,
    })

    // Format status timeline data with readable dates
    const formattedStatusTimeline = useMemo(() => {
        if (!statusTimeline) return []

        return statusTimeline.map((item: any) => ({
            ...item,
            date: format(parseISO(item.date), "MMM d, yyyy"),
        }))
    }, [statusTimeline])

    // Process meter status table data
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
                record.last_reading_date || record.last_reading_time || record.last_reading || record.consumption_date || null,
            uptimePercentage: record.uptime_percentage || 0,
            days_offline: record.days_offline || 0,
        }))
    }, [detailsData])

    const totalStatusPages = detailsData?.pagination?.total_pages || 1
    const totalStatusItems = detailsData?.pagination?.total || 0

    const toggleRegion = (region: string) => {
        setExpandedRegions((prev) => {
            const next = new Set(prev)
            if (next.has(region)) {
                next.delete(region)
            } else {
                next.add(region)
            }
            return next
        })
    }

    const handleStatusSort = (column: string) => {
        if (statusSortColumn === column) {
            setStatusSortDirection(statusSortDirection === "asc" ? "desc" : "asc")
        } else {
            setStatusSortColumn(column)
            setStatusSortDirection("desc")
        }
    }

    // Get unique regions for dropdown
    const availableRegions = useMemo(() => {
        if (!dailyData) return []
        const regions = new Set<string>()
        dailyData.forEach((item: any) => {
            if (item.region) regions.add(item.region)
        })
        return Array.from(regions).sort()
    }, [dailyData])

    // Format chart data for multi-region line chart
    const chartData = useMemo(() => {
        if (!dailyData) return []

        // If no regions selected, show total aggregated data
        if (selectedChartRegions.length === 0) {
            const dateMap = new Map<string, number>()
            dailyData.forEach((item: any) => {
                const date = item.consumption_date?.split("T")[0]
                if (date) {
                    const current = dateMap.get(date) || 0
                    dateMap.set(date, current + (item.consumed_energy || 0))
                }
            })

            return Array.from(dateMap.entries())
                .map(([date, consumption]) => ({
                    date,
                    formattedDate: format(parseISO(date), "MMM d, yyyy"),
                    total: consumption,
                }))
                .sort((a, b) => a.date.localeCompare(b.date))
        }

        // Group by date and region for multi-line chart
        const dateRegionMap = new Map<string, Record<string, number>>()

        dailyData.forEach((item: any) => {
            const date = item.consumption_date?.split("T")[0]
            const region = item.region
            if (date && region && selectedChartRegions.includes(region)) {
                if (!dateRegionMap.has(date)) {
                    dateRegionMap.set(date, {})
                }
                const regionData = dateRegionMap.get(date)!
                regionData[region] = (regionData[region] || 0) + (item.consumed_energy || 0)
            }
        })

        // Convert to array and add cumulative total if needed
        return Array.from(dateRegionMap.entries())
            .map(([date, regions]) => {
                const result: any = {
                    date,
                    formattedDate: format(parseISO(date), "MMM d, yyyy"),
                    ...regions,
                }

                // Add cumulative total for all selected regions
                if (showCumulative && selectedChartRegions.length > 1) {
                    result.cumulative = selectedChartRegions.reduce((sum, region) => sum + (regions[region] || 0), 0)
                }

                return result
            })
            .sort((a, b) => a.date.localeCompare(b.date))
    }, [dailyData, selectedChartRegions, showCumulative])

    // Colors for region lines
    const regionColors: Record<string, string> = {
        "accra west": "#2563eb",
        "accra east": "#16a34a",
        "tema": "#dc2626",
        "ashanti west": "#9333ea",
        "ashanti east": "#ea580c",
        "ashanti south": "#ea8a0c",
        "western": "#0891b2",
        "central": "#4f46e5",
        "volta": "#be185d",
        "northern": "#65a30d",
        "upper east": "#b91c1c",
        "upper west": "#7c3aed",
    }

    const getRegionColor = (region: string) => {
        return regionColors[region.toLowerCase()] || `hsl(${Math.random() * 360}, 70%, 50%)`
    }

    // Group meter data for table
    const groupedMeterData = useMemo(() => {
        if (!dailyData || groupBy === "none") return null

        const grouped = new Map<string, any[]>()
        dailyData.forEach((meter: any) => {
            const key = groupBy === "region" ? meter.region : meter.station
            if (!grouped.has(key)) {
                grouped.set(key, [])
            }
            grouped.get(key)!.push(meter)
        })

        // Sort groups alphabetically
        return new Map(Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0])))
    }, [dailyData, groupBy])

    // Calculate unique meter counts from daily data (actual unique meters)
    const uniqueMeterCounts = useMemo(() => {
        if (!dailyData) return { total: 0, byGroup: new Map<string, number>() }

        const allUnique = new Set(dailyData.map((m: any) => m.meter_number))
        const byGroup = new Map<string, number>()

        if (groupBy !== "none" && groupedMeterData) {
            groupedMeterData.forEach((meters, groupName) => {
                const uniqueInGroup = new Set(meters.map((m: any) => m.meter_number))
                byGroup.set(groupName, uniqueInGroup.size)
            })
        }

        return { total: allUnique.size, byGroup }
    }, [dailyData, groupBy, groupedMeterData])

    // Calculate totals for regional breakdown
    const regionalTotals = useMemo(() => {
        if (!aggregateData?.byRegion) return null

        return aggregateData.byRegion.reduce(
            (acc, region: any) => ({
                supplyKwh: acc.supplyKwh + (region.supplyKwh || 0),
                reverseFlowKwh: acc.reverseFlowKwh + (region.reverseFlowKwh || 0),
                netSupplyKwh: acc.netSupplyKwh + (region.netSupplyKwh || 0),
                activeMeters: acc.activeMeters + (region.activeMeters || 0),
                totalMeters: acc.totalMeters + (region.totalMeters || 0),
            }),
            { supplyKwh: 0, reverseFlowKwh: 0, netSupplyKwh: 0, activeMeters: 0, totalMeters: 0 }
        )
    }, [aggregateData])

// Process heatmap data from daily data grouped by region and date
    const heatmapData = useMemo(() => {
        if (!dailyData || dailyData.length === 0) return { regions: [], dates: [], data: new Map(), maxValue: 0 }

        // Group by region and date
        const regionDateMap = new Map<string, Map<string, { supply: number; reverseFlow: number; net: number }>>()
        const allDates = new Set<string>()

        dailyData.forEach((item: any) => {
            const region = item.region
            const date = item.consumption_date?.split("T")[0]
            if (!region || !date) return

            allDates.add(date)

            if (!regionDateMap.has(region)) {
                regionDateMap.set(region, new Map())
            }
            const dateMap = regionDateMap.get(region)!
            if (!dateMap.has(date)) {
                dateMap.set(date, { supply: 0, reverseFlow: 0, net: 0 })
            }
            const dayData = dateMap.get(date)!

            // Check system_name to determine if it's import or export
            if (item.system_name === "import_kwh") {
                dayData.supply += item.consumed_energy || 0
            } else if (item.system_name === "export_kwh") {
                dayData.reverseFlow += item.consumed_energy || 0
            }
        })

        // Calculate net after all values are summed
        regionDateMap.forEach((dateMap) => {
            dateMap.forEach((dayData) => {
                dayData.net = dayData.supply - dayData.reverseFlow
            })
        })

        console.log("[v0] Heatmap data processed:", {
            regions: regionDateMap.size,
            metric: heatmapMetric,
            sampleData: Array.from(regionDateMap.entries()).slice(0, 2).map(([region, dateMap]) => ({
                region,
                dates: Array.from(dateMap.entries()).slice(0, 2)
            }))
        })

        const sortedDates = Array.from(allDates).sort()
        const sortedRegions = Array.from(regionDateMap.keys()).sort()

        // Calculate max value for color scaling
        let maxValue = 0
        regionDateMap.forEach((dateMap) => {
            dateMap.forEach((values) => {
                const value = heatmapMetric === "supply"
                    ? values.supply
                    : heatmapMetric === "reverseFlow"
                        ? values.reverseFlow
                        : Math.abs(values.net)
                if (value > maxValue) maxValue = value
            })
        })

        console.log("[v0] Heatmap max value:", { metric: heatmapMetric, maxValue })

        return {
            regions: sortedRegions,
            dates: sortedDates,
            data: regionDateMap,
            maxValue,
        }
    }, [dailyData, heatmapMetric])

    // Helper to get heatmap cell color
    const getHeatmapCellColor = (value: number, maxValue: number) => {
        if (value === 0 || maxValue === 0) return "transparent"
        const intensity = Math.min(Math.abs(value) / maxValue, 1)
        if (heatmapMetric === "supply") {
            // Green gradient for supply
            return `rgba(34, 197, 94, ${0.1 + intensity * 0.7})`
        } else if (heatmapMetric === "net") {
            // Purple gradient for net (147, 51, 234 is purple-600)
            return `rgba(147, 51, 234, ${0.1 + intensity * 0.7})`
        }
        // Blue gradient for reverse flow
        return `rgba(59, 130, 246, ${0.1 + intensity * 0.7})`
    }

    const groupMeterReadings = (meterData: any[]) => {
        const grouped = new Map<string, any>()

        meterData.forEach((meter: any) => {
            const key = `${meter.meter_number}-${meter.consumption_date?.split("T")[0]}`

            if (!grouped.has(key)) {
                grouped.set(key, {
                    ...meter,
                    import_kwh: 0,
                    export_kwh: 0,
                })
            }

            const existing = grouped.get(key)!
            if (meter.system_name === "import_kwh") {
                existing.import_kwh += meter.consumed_energy || 0
            } else if (meter.system_name === "export_kwh") {
                existing.export_kwh += meter.consumed_energy || 0
            }
        })

        return Array.from(grouped.values())
    }

    // Filtered data for selected group with pagination
    const filteredGroupData = useMemo(() => {
        if (!selectedGroup || !groupedMeterData) return null

        const groupData = groupedMeterData.get(selectedGroup)
        if (!groupData) return null

        // Group the readings by meter + date
        const grouped = groupMeterReadings(groupData)

        const startIdx = (currentPage - 1) * 10
        return {
            data: grouped.slice(startIdx, startIdx + 10),
            total: grouped.length,
            totalPages: Math.ceil(grouped.length / 10),
        }
    }, [selectedGroup, groupedMeterData, currentPage])

    // Paginated meter data for ungrouped view
    const paginatedMeterData = useMemo(() => {
        if (!dailyData) return []
        const grouped = groupMeterReadings(dailyData)
        const startIdx = (currentPage - 1) * 10
        return grouped.slice(startIdx, startIdx + 10)
    }, [dailyData, currentPage])

    // Reset pagination when group selection changes
    const handleGroupSelect = (groupName: string) => {
        setSelectedGroup(groupName === selectedGroup ? null : groupName)
        setCurrentPage(1)
    }

    if (isLoadingAggregate || isLoadingDaily || isLoadingStatus) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-muted-foreground">Loading...</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Total Supply (Import)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-600">{formatNumber(aggregateData?.totalSupplyKwh || 0)}</div>
                        <div className="h-px bg-border my-3"></div>
                        <p className="text-sm text-muted-foreground">kWh</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Reverse Flow (Export)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-600">{formatNumber(aggregateData?.totalReverseFlowKwh || 0)}</div>
                        <div className="h-px bg-border my-3"></div>
                        <p className="text-sm text-muted-foreground">kWh</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Net Supply</CardTitle>
                    </CardHeader>

                    <CardContent>
                        <div className="text-3xl font-bold text-[#800020]">{formatNumber(aggregateData?.netSupplyKwh || 0)}</div>
                        <div className="h-px bg-border my-3"></div>
                        <p className="text-sm text-muted-foreground">kWh</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Meter Health & Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold">
                            {formatNumber(statusSummary?.online || 0)} / {formatNumber(statusSummary?.total || 0)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
    <span className="flex items-center gap-1">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        {statusSummary?.online_percentage?.toFixed(1)}%
    </span>
                            <span className="flex items-center gap-1">
        <div className="w-2 h-2 rounded-full bg-red-500" />
                                {statusSummary?.offline_percentage?.toFixed(1)}%
    </span>
                            <span>| Avg Uptime: {statusSummary?.avg_uptime_percentage?.toFixed(1) ?? "—"}%</span>
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Status Timeline */}
            <Card>
                <CardHeader>
                    <CardTitle>Meter Status Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoadingTimeline ? (
                        <Skeleton className="h-[350px] w-full" />
                    ) : formattedStatusTimeline && formattedStatusTimeline.length > 0 ? (
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={formattedStatusTimeline}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="date"
                                    angle={-45}
                                    textAnchor="end"
                                    height={80}
                                />
                                <YAxis />
                                <Tooltip />
                                <Legend />

                                {/* Stacked Bars */}

                                <Bar dataKey="online" stackId="status" fill="hsl(142, 76%, 36%)" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="offline" stackId="status" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-64 text-muted-foreground">
                            No status timeline data available
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Meter Status Details Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Meter Status Details</CardTitle>
                    <CardDescription>Individual meter health and reporting status</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
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
                                onClick={() => {
                                    setStatusFilter("all")
                                    setStatusPage(1)
                                }}
                            >
                                All ({statusSummary?.total || 0})
                            </Button>
                            <Button
                                variant={statusFilter === "online" ? "default" : "outline"}
                                size="sm"
                                onClick={() => {
                                    setStatusFilter("online")
                                    setStatusPage(1)
                                }}
                            >
                                Online ({statusSummary?.online || 0})
                            </Button>
                            <Button
                                variant={statusFilter === "offline" ? "default" : "outline"}
                                size="sm"
                                onClick={() => {
                                    setStatusFilter("offline")
                                    setStatusPage(1)
                                }}
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
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="sticky left-0 z-10 bg-background">
                                            <Button variant="ghost" onClick={() => handleStatusSort("meter_number")} className="h-8 px-2">
                                                Meter Number
                                                <ArrowUpDown className="ml-2 h-4 w-4" />
                                            </Button>
                                        </TableHead>
                                        <TableHead className="sticky left-[180px] z-10 bg-background">Region/Station</TableHead>
                                        <TableHead className="sticky left-[360px] z-10 bg-background">
                                            <Button variant="ghost" onClick={() => handleStatusSort("status")} className="h-8 px-2">
                                                Status
                                                <ArrowUpDown className="ml-2 h-4 w-4" />
                                            </Button>
                                        </TableHead>
                                        <TableHead>
                                            <Button variant="ghost" onClick={() => handleStatusSort("last_reading")} className="h-8 px-2">
                                                Last Reading
                                                <ArrowUpDown className="ml-2 h-4 w-4" />
                                            </Button>
                                        </TableHead>
                                        <TableHead>
                                            <Button variant="ghost" onClick={() => handleStatusSort("consumption")} className="h-8 px-2">
                                                Total Consumption
                                                <ArrowUpDown className="ml-2 h-4 w-4" />
                                            </Button>
                                        </TableHead>
                                        <TableHead>
                                            <Button variant="ghost" onClick={() => handleStatusSort("uptime")} className="h-8 px-2">
                                                Uptime %
                                                <ArrowUpDown className="ml-2 h-4 w-4" />
                                            </Button>
                                        </TableHead>
                                        <TableHead>
                                            <Button variant="ghost" onClick={() => handleStatusSort("days_offline")} className="h-8 px-2">
                                                Days Offline
                                                <ArrowUpDown className="ml-2 h-4 w-4" />
                                            </Button>
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {meterStatusTableData.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                                No meter status data available
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        meterStatusTableData.map((meter) => (
                                            <TableRow key={meter.meter_number}>
                                                <TableCell className="sticky left-0 z-10 bg-background font-medium">
                                                    <Link href={`/meters/${meter.meter_number}`} className="hover:text-blue-200 hover:underline">
                                                        {meter.meter_number}
                                                    </Link>
                                                </TableCell>
                                                <TableCell className="sticky left-[180px] z-10 bg-background">
                                                    <div className="flex items-center gap-2">
                                                        <span>{meter.region || "—"}</span>
                                                        <span className="font-bold text-muted-foreground">•</span>
                                                        <span>
                                                          <Link
                                                              href={`/stations/${encodeURIComponent(meter.station?.toLowerCase() ?? "")}`}
                                                              className="font-medium truncate flex-1 text-primary hover:underline"
                                                          >
                                                            {meter.station || "—"}
                                                          </Link>
                                                        </span>

                                                    </div>
                                                </TableCell>
                                                <TableCell className="sticky left-[360px] z-10 bg-background">
                                                    <Badge variant={meter.status === "ONLINE" ? "default" : "destructive"}>
                                                        {meter.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {(() => {
                                                        const date = meter.last_reading_time ? new Date(meter.last_reading_time) : null;

                                                        // Check if date is missing or is the year 1900
                                                        if (!date || date.getFullYear() === 1900) {
                                                            return <span className="text-muted-foreground italic">Not available</span>;
                                                        }

                                                        return (
                                                            <>
                                                                <div>{date.toLocaleDateString()}</div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                            </>
                                                        );
                                                    })()}
                                                </TableCell>

                                                <TableCell>
                                                    {(meter.total_consumption ?? 0).toLocaleString(undefined, {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2
                                                    })} kWh
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
                                                <TableCell>{meter.days_offline > 0 ? meter.days_offline : "-"}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>

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

            {/* Daily Consumption Trend */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <CardTitle>Daily Consumption Trend</CardTitle>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm text-muted-foreground mr-2">Filter by Region:</span>
                                {availableRegions.map((region) => (
                                    <Button
                                        key={region}
                                        variant={selectedChartRegions.includes(region) ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => {
                                            setSelectedChartRegions((prev) =>
                                                prev.includes(region)
                                                    ? prev.filter((r) => r !== region)
                                                    : [...prev, region]
                                            )
                                        }}
                                        style={{
                                            backgroundColor: selectedChartRegions.includes(region)
                                                ? getRegionColor(region)
                                                : undefined,
                                            borderColor: getRegionColor(region),
                                            color: selectedChartRegions.includes(region) ? "white" : getRegionColor(region),
                                        }}
                                    >
                                        {toProperCase(region)}
                                    </Button>
                                ))}
                                {selectedChartRegions.length > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedChartRegions([])}
                                        className="text-muted-foreground"
                                    >
                                        Clear All
                                    </Button>
                                )}
                            </div>
                        </div>
                        {selectedChartRegions.length > 1 && (
                            <div className="flex items-center gap-2 border-t pt-3">
                                <Checkbox
                                    id="cumulative-toggle"
                                    checked={showCumulative}
                                    onCheckedChange={(checked) => setShowCumulative(!!checked)}
                                />
                                <Label htmlFor="cumulative-toggle" className="text-sm font-normal cursor-pointer">
                                    Show cumulative (combined) instead of individual regions
                                </Label>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={380}>
                        {selectedChartRegions.length === 0 ? (
                            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="formattedDate"
                                    angle={-45}
                                    textAnchor="end"
                                    height={80}
                                />
                                <YAxis
                                    tickFormatter={(value) => {
                                        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
                                        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
                                        return value.toString()
                                    }}
                                />
                                <Tooltip
                                    labelFormatter={(label) => label}
                                    formatter={(value: any) => [formatNumber(value) + " kWh", "Total"]}
                                />
                                <Legend />
                                <Area
                                    type="monotone"
                                    dataKey="total"
                                    stroke="#0088FE"
                                    fill="#0088FE"
                                    fillOpacity={0.6}
                                    name="Total Consumption"
                                />
                            </AreaChart>
                        ) : showCumulative && selectedChartRegions.length > 1 ? (
                            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="formattedDate"
                                    angle={-45}
                                    textAnchor="end"
                                    height={80}
                                />
                                <YAxis
                                    tickFormatter={(value) => {
                                        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
                                        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
                                        return value.toString()
                                    }}
                                />
                                <Tooltip
                                    labelFormatter={(label) => label}
                                    formatter={(value: any) => [formatNumber(value) + " kWh", "Combined Total"]}
                                />
                                <Legend />
                                <Area
                                    type="monotone"
                                    dataKey="cumulative"
                                    stroke="#8b5cf6"
                                    fill="#8b5cf6"
                                    fillOpacity={0.6}
                                    name={`Combined (${selectedChartRegions.length} regions)`}
                                />
                            </AreaChart>
                        ) : (
                            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="formattedDate"
                                    angle={-45}
                                    textAnchor="end"
                                    height={80}
                                />
                                <YAxis
                                    tickFormatter={(value) => {
                                        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
                                        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
                                        return value.toString()
                                    }}
                                />
                                <Tooltip
                                    labelFormatter={(label) => label}
                                    formatter={(value: any, name: string) => [
                                        formatNumber(value) + " kWh",
                                        toProperCase(name),
                                    ]}
                                />
                                <Legend formatter={(value) => toProperCase(value)} />
                                {selectedChartRegions.map((region) => (
                                    <Line
                                        key={region}
                                        type="monotone"
                                        dataKey={region}
                                        stroke={getRegionColor(region)}
                                        strokeWidth={2}
                                        dot={{ r: 3 }}
                                        activeDot={{ r: 5 }}
                                        name={region}
                                    />
                                ))}
                            </LineChart>
                        )}
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Regional Breakdown */}
            {aggregateData?.byRegion && aggregateData.byRegion.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Regional Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="font-semibold">Region</TableHead>
                                    <TableHead className="text-right font-semibold">Import (Supply) kWh</TableHead>
                                    <TableHead className="text-right font-semibold">Export (Reverse Flow) kWh</TableHead>
                                    <TableHead className="text-right font-semibold">Net Supply (kWh)</TableHead>
                                    <TableHead className="text-right font-semibold">% of Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {aggregateData.byRegion.map((regionData: any) => (
                                    <>
                                        <TableRow
                                            key={regionData.region}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => toggleRegion(regionData.region)}
                                        >
                                            <TableCell className="font-medium">
                                                {expandedRegions.has(regionData.region) ? (
                                                    <ChevronDown className="inline-block w-4 h-4 mr-2" />
                                                ) : (
                                                    <ChevronRight className="inline-block w-4 h-4 mr-2" />
                                                )}
                                                {toProperCase(regionData.region)}
                                            </TableCell>
                                            <TableCell className="text-green-600 text-right">{formatNumber(regionData.supplyKwh || 0, 2)}</TableCell>
                                            <TableCell className="text-blue-600 text-right">{formatNumber(regionData.reverseFlowKwh || 0,2)}</TableCell>
                                            <TableCell className="text-[#800020] text-right">{formatNumber(regionData.netSupplyKwh || 0,2)}</TableCell>
                                            <TableCell className="text-right">{regionData.percentOfTotal?.toFixed(2)}%</TableCell>
                                        </TableRow>
                                        {expandedRegions.has(regionData.region) &&
                                            regionData.stations?.map((stationData: any) => (
                                                <TableRow key={`${regionData.region}-${stationData.station}`} className="bg-muted/30">
                                                    <TableCell className="pl-8">



                                                        <Link
                                                            href={`/stations/${encodeURIComponent(stationData.station?.toLowerCase())}`}
                                                            className="font-medium truncate flex-1 text-primary hover:underline"
                                                        >
                                                            {toProperCase(stationData.station)}
                                                        </Link>


                                                    </TableCell>
                                                    <TableCell className="text-green-600 text-right">{formatNumber(stationData.supplyKwh || 0)}</TableCell>
                                                    <TableCell className="text-blue-600 text-right">
                                                        {formatNumber(stationData.reverseFlowKwh || 0)}
                                                    </TableCell>
                                                    <TableCell className="text-[#800020] text-right">
                                                        {formatNumber(stationData.netSupplyKwh || 0)}
                                                    </TableCell>
                                                    <TableCell className="text-right">-</TableCell>
                                                </TableRow>
                                            ))}
                                    </>
                                ))}
                                {/* Totals Row */}
                                {regionalTotals && (
                                    <TableRow className="bg-primary/10 font-semibold border-t-2">
                                        <TableCell>TOTAL</TableCell>
                                        <TableCell className="text-green-600 text-right">{formatNumber(regionalTotals.supplyKwh,2)}</TableCell>
                                        <TableCell className="text-blue-600 text-right">{formatNumber(regionalTotals.reverseFlowKwh,2)}</TableCell>
                                        <TableCell className="text-[#800020] text-right">{formatNumber(regionalTotals.netSupplyKwh,2)}</TableCell>
                                        <TableCell className="text-right">100.00%</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Regional Heat Map Table */}
            {heatmapData.regions.length > 0 && heatmapData.dates.length > 0 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Regional Energy Heat Map</CardTitle>
                                <CardDescription>
                                    Daily {heatmapMetric === "supply" ? "supply" : "reverse flow"} aggregates by region
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant={heatmapMetric === "supply" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setHeatmapMetric("supply")}
                                    className={
                                        heatmapMetric === "supply"
                                            ? "bg-green-600 hover:bg-green-700 text-white"
                                            : "border-green-600 text-green-600 hover:bg-green-50"
                                    }
                                >
                                    Import (Supply)
                                </Button>
                                <Button
                                    variant={heatmapMetric === "reverseFlow" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setHeatmapMetric("reverseFlow")}
                                    className={
                                        heatmapMetric === "reverseFlow"
                                            ? "bg-blue-600 hover:bg-blue-700 text-white"
                                            : "border-blue-600 text-blue-600 hover:bg-blue-50"
                                    }
                                >
                                    Reverse Flow (Export)
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => setHeatmapMetric("net")}
                                    className={
                                        heatmapMetric === "net"
                                            ? "bg-purple-700 text-white hover:bg-purple-700 border border-purple-600"
                                            : "bg-transparent text-purple-600 border border-purple-600 hover:bg-purple-50"
                                    }
                                >
                                    Net (Import - Export)
                                </Button>

                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="relative overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50%] font-semibold sticky left-0 bg-background z-10">
                                            Region
                                        </TableHead>
                                        {heatmapData.dates.map((date) => (
                                            <TableHead key={date} className="text-right text-xs">
                                                {format(parseISO(date), "MMM d")}
                                            </TableHead>
                                        ))}
                                        <TableHead className="text-right font-semibold bg-muted">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {heatmapData.regions.map((region) => {
                                        const regionData = heatmapData.data.get(region)
                                        let regionTotal = 0
                                        regionData?.forEach((dayData) => {
                                            regionTotal += heatmapMetric === "supply"
                                                ? dayData.supply
                                                : heatmapMetric === "reverseFlow"
                                                    ? dayData.reverseFlow
                                                    : dayData.net
                                        })

                                        return (
                                            <TableRow key={region}>
                                                <TableCell className="font-medium capitalize sticky left-0 bg-background z-10">
                                                    {toProperCase(region)}
                                                </TableCell>
                                                {heatmapData.dates.map((date) => {
                                                    const dayData = regionData?.get(date)
                                                    const value = dayData
                                                        ? heatmapMetric === "supply"
                                                            ? dayData.supply
                                                            : heatmapMetric === "reverseFlow"
                                                                ? dayData.reverseFlow
                                                                : dayData.net
                                                        : 0
                                                    return (
                                                        <TableCell
                                                            key={date}
                                                            className="text-right text-sm"
                                                            style={{ backgroundColor: getHeatmapCellColor(value, heatmapData.maxValue) }}
                                                        >
                                                            {value !== 0 ? formatNumber(value, 2) : "-"}
                                                        </TableCell>
                                                    )
                                                })}
                                                <TableCell className="text-right font-semibold bg-muted">
                                                    {formatNumber(regionTotal, 2)}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}

                                    {/* Totals Row */}
                                    <TableRow className="bg-muted font-semibold">
                                        <TableCell className="sticky left-0 bg-muted z-10 text-red-600 text-base">
                                            TOTAL
                                        </TableCell>
                                        {heatmapData.dates.map((date) => {
                                            let dateTotal = 0
                                            heatmapData.regions.forEach((region) => {
                                                const dayData = heatmapData.data.get(region)?.get(date)
                                                dateTotal += dayData
                                                    ? heatmapMetric === "supply"
                                                        ? dayData.supply
                                                        : dayData.reverseFlow
                                                    : 0
                                            })
                                            return (
                                                <TableCell key={date} className="text-right text-red-600 text-base">
                                                    {formatNumber(dateTotal, 2)}
                                                </TableCell>
                                            )
                                        })}
                                        <TableCell className="text-right bg-muted/80 text-red-600 text-base">
                                            {formatNumber(
                                                heatmapData.regions.reduce((total, region) => {
                                                    const regionData = heatmapData.data.get(region)
                                                    if (!regionData) return total
                                                    let regionSum = 0
                                                    regionData.forEach((values) => {
                                                        regionSum += heatmapMetric === "supply"
                                                            ? values.supply
                                                            : values.reverseFlow
                                                    })
                                                    return total + regionSum
                                                }, 0),
                                                2
                                            )}
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}




            {/* Meter Details Table */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Meter Daily Consumption Details</CardTitle>
                        <Select value={groupBy} onValueChange={(value: any) => {
                            setGroupBy(value)
                            setSelectedGroup(null)
                            setCurrentPage(1)
                        }}>
                            <SelectTrigger className="w-48">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No Grouping</SelectItem>
                                <SelectItem value="region">Group by Region</SelectItem>
                                <SelectItem value="station">Group by Station</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    {groupBy === "none" ? (
                        // Ungrouped view with pagination
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="font-semibold">Date</TableHead>
                                        <TableHead className="font-semibold">Meter Number</TableHead>
                                        <TableHead className="font-semibold">Region</TableHead>
                                        <TableHead className="font-semibold">Station</TableHead>
                                        <TableHead className="font-semibold">Feeder</TableHead>
                                        <TableHead className="text-right font-semibold">Import (kWh)</TableHead>
                                        <TableHead className="text-right font-semibold">Export (kWh)</TableHead>
                                        <TableHead className="text-right font-semibold">Net (kWh)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedMeterData.map((meter: any, idx: number) => {
                                        const importValue = meter.import_kwh || 0
                                        const exportValue = meter.export_kwh || 0
                                        const netValue = importValue - exportValue

                                        return (
                                            <TableRow key={idx}>
                                                <TableCell>{format(parseISO(meter.consumption_date?.split("T")[0]), "MMM d, yyyy")}</TableCell>
                                                <TableCell className="font-mono text-sm">
                                                    <Link href={`/meters/${meter.meter_number}`} className="hover:text-blue-200 hover:underline">
                                                        {meter.meter_number}
                                                    </Link>
                                                </TableCell>
                                                <TableCell>{toProperCase(meter.region)}</TableCell>
                                                <TableCell>



                                                    <Link
                                                        href={`/stations/${encodeURIComponent(meter.station?.toLowerCase())}`}
                                                        className="font-medium truncate flex-1 text-primary hover:underline"
                                                    >
                                                        {toProperCase(meter.station)}
                                                    </Link>

                                                </TableCell>
                                                <TableCell>{meter.feeder_panel_name}</TableCell>
                                                <TableCell className="text-right text-green-600">
                                                    {importValue > 0 ? formatNumber(importValue,2) : "—"}
                                                </TableCell>
                                                <TableCell className="text-right text-blue-600">
                                                    {exportValue > 0 ? formatNumber(exportValue,2) : "—"}
                                                </TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    {formatNumber(netValue,2)}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                            <div className="flex items-center justify-between mt-4">
                                <Button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                                    Previous
                                </Button>
                                <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {Math.ceil(groupMeterReadings(dailyData || []).length / 10)}
                    </span>
                                <Button
                                    onClick={() => setCurrentPage((p) => p + 1)}
                                    disabled={currentPage >= Math.ceil(groupMeterReadings(dailyData || []).length / 10)}
                                >
                                    Next
                                </Button>
                            </div>
                        </>
                    ) : (
                        // Grouped view - select a group to view with pagination
                        <div className="space-y-4">
                            {!selectedGroup && (
                                <p className="text-center text-muted-foreground py-4">
                                    Select a {groupBy} above to view its meter readings
                                </p>
                            )}

                            {/* Group Selection List with Numbering */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {groupedMeterData &&
                                    Array.from(groupedMeterData.entries()).map(([groupName, meters], index) => (
                                        <Button
                                            key={groupName}
                                            variant={selectedGroup === groupName ? "default" : "outline"}
                                            className="justify-start h-auto py-3"
                                            onClick={() => handleGroupSelect(groupName)}
                                        >
                                            <div className="flex items-start gap-3 w-full">
                                                {/* Numbering Badge */}
                                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                                                    {index + 1}
                                                </div>

                                                {/* Group Info */}
                                                <div className="flex flex-col items-start flex-1">
                                                    <span className="font-semibold">{toProperCase(groupName)}</span>
                                                    <span className="text-xs text-muted-foreground">
                                            {uniqueMeterCounts.byGroup.get(groupName) || 0} meters, {meters.length} readings
                                        </span>
                                                </div>
                                            </div>
                                        </Button>
                                    ))}
                            </div>

                            {/* Selected Group Data with Pagination */}
                            {selectedGroup && filteredGroupData && (
                                <div className="border rounded-lg p-4">
                                    <h3 className="text-lg font-semibold mb-4">{toProperCase(selectedGroup)}</h3>
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead className="font-semibold">Date</TableHead>
                                                <TableHead className="font-semibold">Meter Number</TableHead>
                                                {groupBy === "station" && <TableHead className="font-semibold">Region</TableHead>}
                                                {groupBy === "region" && <TableHead className="font-semibold">Station</TableHead>}
                                                <TableHead className="font-semibold">Feeder</TableHead>
                                                <TableHead className="text-right font-semibold">Import (kWh)</TableHead>
                                                <TableHead className="text-right font-semibold">Export (kWh)</TableHead>
                                                <TableHead className="text-right font-semibold">Net (kWh)</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredGroupData.data.map((meter: any, idx: number) => {
                                                const importValue = meter.import_kwh || 0
                                                const exportValue = meter.export_kwh || 0
                                                const netValue = importValue - exportValue

                                                return (
                                                    <TableRow key={idx}>
                                                        <TableCell>{format(parseISO(meter.consumption_date?.split("T")[0]), "MMM d, yyyy")}</TableCell>
                                                        <TableCell className="font-mono text-sm">{meter.meter_number}</TableCell>
                                                        {groupBy === "station" && <TableCell>{toProperCase(meter.region)}</TableCell>}
                                                        {groupBy === "region" && <TableCell>{toProperCase(meter.station)}</TableCell>}
                                                        <TableCell>{meter.feeder_panel_name}</TableCell>
                                                        <TableCell className="text-right text-green-600">
                                                            {importValue > 0 ? formatNumber(importValue) : "—"}
                                                        </TableCell>
                                                        <TableCell className="text-right text-blue-600">
                                                            {exportValue > 0 ? formatNumber(exportValue) : "—"}
                                                        </TableCell>
                                                        <TableCell className="text-right font-semibold">
                                                            {formatNumber(netValue)}
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                    <div className="flex items-center justify-between mt-4">
                                        <Button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                                            Previous
                                        </Button>
                                        <span className="text-sm text-muted-foreground">
                                Page {currentPage} of {filteredGroupData.totalPages}
                            </span>
                                        <Button
                                            onClick={() => setCurrentPage((p) => p + 1)}
                                            disabled={currentPage >= filteredGroupData.totalPages}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            )}


                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
