"use client"

import type React from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { useRegionalBoundaryAggregate, useRegionalBoundaryDaily } from "@/hooks/api/use-regional-boundary-api"
import { useMeterStatusSummary, useStatusTimeline, useMeterStatusDetails } from "@/hooks/api/use-meter-status-api"
import { TablePagination } from "@/components/ui/table-pagination"
import { formatNumber } from "@/lib/utils/date-helpers"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Legend, Line, LineChart } from "recharts"
import { ArrowLeftRight, TrendingUp, Activity, Database, ChevronDown, ChevronRight, ArrowRightLeft } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useState, useMemo, useRef, useEffect } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import Link from "next/link";
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/stores/app-store"
import { formatApiDate } from "@/lib/utils"

export function RegionalBoundaryTab() {
    const filters = useAppStore((state) => state.filters)

    const params = {
        dateFrom: filters.dateRange ? formatApiDate(filters.dateRange.start) : "",
        dateTo: filters.dateRange ? formatApiDate(filters.dateRange.end) : "",
        regions: filters.regions,
        districts: filters.districts,
        stations: filters.stations,
        boundaryMeteringPoints: filters.boundaryMeteringPoints,
        meterTypes: ["REGIONAL_BOUNDARY"],
        voltages: filters.voltages,
        locations: filters.locations,
    }

    console.log("[v0] Regional Boundary Filter Params:", params)

    const { data: boundaryData, isLoading } = useRegionalBoundaryAggregate(params)
    const { data: meterRecords } = useRegionalBoundaryDaily(params)

    console.log("[v0] Regional Boundary Aggregate Data:", boundaryData)
    console.log("[v0] Regional Boundary Daily Records:", meterRecords?.length, "records")

    const { data: summaryData, isLoading: isLoadingSummary } = useMeterStatusSummary(params)
    const { data: timelineData, isLoading: isLoadingTimeline } = useStatusTimeline(params)

    console.log("[v0] Regional Boundary Timeline Data:", timelineData)

    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [statusSearchTerm, setStatusSearchTerm] = useState("")
    const [statusCurrentPage, setStatusCurrentPage] = useState(1)
    const statusItemsPerPage = 20

    const [statusSortBy, setStatusSortBy] = useState<"meter" | "status" | "consumption" | "uptime">("meter")
    const [statusSortOrder, setStatusSortOrder] = useState<"asc" | "desc">("asc")

    const { data: detailsData, isLoading: isLoadingDetails } = useMeterStatusDetails({
        ...params,
        page: statusCurrentPage,
        limit: statusItemsPerPage,
        search: statusSearchTerm,
        status: statusFilter === "all" ? undefined : statusFilter,
        sortBy:
            statusSortBy === "meter" ? "meter_number" : statusSortBy === "consumption" ? "total_consumption" : statusSortBy,
        sortOrder: statusSortOrder,
    })

    const meterStats = useMemo(() => {
        if (!meterRecords || meterRecords.length === 0) return { active: 0, total: 0, coverage: 0 }

        const uniqueActiveMeters = new Set<string>()
        meterRecords.forEach((record) => {
            if (record.consumed_energy > 0 || record.consumed_energy < 0) {
                uniqueActiveMeters.add(record.meter_number)
            }
        })

        const totalActive = uniqueActiveMeters.size

        // Pick total_meter_count from any one record (they should all be the same)
        const totalMeters = boundaryData?.rawData?.[0]?.total_meter_count || 0

        const coverage = totalMeters > 0 ? (totalActive / totalMeters) * 100 : 0

        return { active: totalActive, total: totalMeters, coverage }
    }, [meterRecords, boundaryData?.rawData])

    const stats = [
        {
            title: "Total Import",
            value: boundaryData ? `${formatNumber(boundaryData.totalImportKwh,2)} kWh` : "—",
            subtitle: "Energy Imported",
            icon: ArrowLeftRight,
        },
        {
            title: "Total Export",
            value: boundaryData ? `${formatNumber(boundaryData.totalExportKwh, 2)} kWh` : "—",
            subtitle: "Energy Exported",
            icon: TrendingUp,
        },
        {
            title: "Net Transfer",
            value: boundaryData ? `${formatNumber(boundaryData.netKwh,2)} kWh` : "—",
            subtitle: boundaryData && boundaryData.netKwh > 0 ? "Net Import" : "Net Export",
            icon: Activity,
        },
        {
            title: "Boundary Points",
            value: boundaryData ? formatNumber(boundaryData.byBoundaryPoint.length, 0) : "—",
            subtitle: boundaryData
                ? `${formatNumber(meterStats.active, 0)} active / ${formatNumber(meterStats.total, 0)} total meters`
                : "Total metering points",
            thirdLine: boundaryData ? `Coverage: ${formatNumber(meterStats.coverage, 1)}%` : undefined,
            icon: Database,
        },
    ]

    const [showTrendsImport, setShowTrendsImport] = useState(true)
    const [showTrendsExport, setShowTrendsExport] = useState(true)
    const [showComparisonImport, setShowComparisonImport] = useState(true)
    const [showComparisonExport, setShowComparisonExport] = useState(true)

    const [selectedBoundaryPoints, setSelectedBoundaryPoints] = useState<string[]>([])
    const isInitializedRef = useRef(false)

    // Select all boundary points by default on initial load only
    useEffect(() => {
        console.log("[v0] Regional boundary - useEffect triggered", {
            hasBoundaryData: !!boundaryData?.byBoundaryPoint,
            isInitialized: isInitializedRef.current,
            currentSelection: selectedBoundaryPoints.length,
        })

        if (boundaryData?.byBoundaryPoint && !isInitializedRef.current) {
            console.log("[v0] Regional boundary - Auto-selecting all points")
            const allPoints = boundaryData.byBoundaryPoint.map((bp) => bp.boundaryPoint)
            setSelectedBoundaryPoints(allPoints)
            isInitializedRef.current = true
        }
    }, [boundaryData?.byBoundaryPoint])

    // Generate random colors for each boundary point
    const getRandomColor = (index: number, seed: string) => {
        // Use seed to generate consistent but varied colors
        const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
        const hue = ((hash + index * 137) % 360)
        const saturation = 65 + (index % 3) * 10
        const lightness = 45 + (index % 2) * 10
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`
    }

    const [expandedBoundaryPoints, setExpandedBoundaryPoints] = useState<Set<string>>(new Set())
    const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
    const [isFlowReversed, setIsFlowReversed] = useState(false)

    const toggleBoundaryPoint = (boundaryPoint: string) => {
        const newExpanded = new Set(expandedBoundaryPoints)
        if (newExpanded.has(boundaryPoint)) {
            newExpanded.delete(boundaryPoint)
        } else {
            newExpanded.add(boundaryPoint)
        }
        setExpandedBoundaryPoints(newExpanded)
    }

    const toggleDate = (dateKey: string, e: React.MouseEvent) => {
        e.stopPropagation()
        const newExpanded = new Set(expandedDates)
        if (newExpanded.has(dateKey)) {
            newExpanded.delete(dateKey) // FIX: boundaryPoint was undeclared and incorrectly used here. Corrected to dateKey.
        } else {
            newExpanded.add(dateKey)
        }
        setExpandedDates(newExpanded)
    }

    const dailyBreakdownByBoundaryPoint = useMemo(() => {
        if (!boundaryData?.rawData) return new Map()

        const breakdownMap = new Map<string, Array<{ date: string; import: number; export: number }>>()

        boundaryData.rawData.forEach((record) => {
            const bp = record.boundary_metering_point
            const date = record.group_period.split("T")[0]

            if (!breakdownMap.has(bp)) {
                breakdownMap.set(bp, [])
            }

            const existing = breakdownMap.get(bp)!.find((d) => d.date === date)
            if (existing) {
                if (record.system_name === "import_kwh") {
                    existing.import += record.total_consumption
                } else {
                    existing.export += record.total_consumption
                }
            } else {
                breakdownMap.get(bp)!.push({
                    date,
                    import: record.system_name === "import_kwh" ? record.total_consumption : 0,
                    export: record.system_name === "export_kwh" ? record.total_consumption : 0,
                })
            }
        })

        breakdownMap.forEach((breakdown) => {
            breakdown.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        })

        return breakdownMap
    }, [boundaryData?.rawData])

    const getMetersForDate = (boundaryPoint: string, date: string) => {
        if (!meterRecords) return []

        console.log("[v0] Getting meters for:", { boundaryPoint, date })
        console.log("[v0] Total meter records available:", meterRecords.length)

        const metersMap = new Map<string, { import: number; export: number }>()

        const matchingRecords = meterRecords.filter((record) => {
            const matchesDate = record.consumption_date.split("T")[0] === date
            const matchesBoundaryPoint = record.boundary_metering_point
                ? record.boundary_metering_point.trim() === boundaryPoint.trim()
                : true

            return matchesDate && matchesBoundaryPoint
        })

        console.log("[v0] Matching records after date/boundary filter:", matchingRecords.length)
        console.log("[v0] Sample matching records:", matchingRecords.slice(0, 3))

        matchingRecords.forEach((record) => {
            if (!metersMap.has(record.meter_number)) {
                metersMap.set(record.meter_number, { import: 0, export: 0 })
            }
            const meter = metersMap.get(record.meter_number)!
            if (record.system_name === "import_kwh") {
                meter.import += record.consumed_energy
            } else {
                meter.export += record.consumed_energy
            }
        })

        console.log("[v0] Unique meters before final filter:", metersMap.size)
        console.log("[v0] Meters map:", Array.from(metersMap.entries()).slice(0, 5))

        const finalMeters = Array.from(metersMap.entries())
            .map(([meterNumber, values]) => ({
                meterNumber,
                import: values.import,
                export: values.export,
                net: values.import - values.export,
            }))
            .filter((meter) => meter.import !== 0 || meter.export !== 0)

        console.log("[v0] Final meters after zero filter:", finalMeters.length)
        console.log("[v0] Final meters:", finalMeters)

        return finalMeters
    }

    const formatDateLocal = (dateString: string) => {
        const datePart = dateString.split("T")[0]
        const [year, month, day] = datePart.split("-")
        const date = new Date(Number.parseInt(year), Number.parseInt(month) - 1, Number.parseInt(day))
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    }

    const formatDateLocalFull = (dateString: string) => {
        const datePart = dateString.split("T")[0]
        const [year, month, day] = datePart.split("-")
        const date = new Date(Number.parseInt(year), Number.parseInt(month) - 1, Number.parseInt(day))
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    }

    const tableData = useMemo(() => {
        if (!meterRecords || meterRecords.length === 0) return []

        // Group by boundary point
        const boundaryPointMap = new Map<
            string,
            {
                boundaryPoint: string
                importKwh: number
                exportKwh: number
                dates: Map<
                    string,
                    {
                        import: number
                        export: number
                        meters: Map<string, { import: number; export: number; location: string | null }>
                    }
                >
            }
        >()

        meterRecords.forEach((record) => {
            const bp = record.boundary_metering_point?.trim() || "Unknown"
            const date = record.consumption_date.split("T")[0]
            const meterNumber = record.meter_number
            const location = record.location || null

            // Initialize boundary point if not exists
            if (!boundaryPointMap.has(bp)) {
                boundaryPointMap.set(bp, {
                    boundaryPoint: bp,
                    importKwh: 0,
                    exportKwh: 0,
                    dates: new Map(),
                })
            }

            const bpData = boundaryPointMap.get(bp)!

            // Initialize date if not exists
            if (!bpData.dates.has(date)) {
                bpData.dates.set(date, {
                    import: 0,
                    export: 0,
                    meters: new Map(),
                })
            }

            const dateData = bpData.dates.get(date)!

            // Initialize meter if not exists
            if (!dateData.meters.has(meterNumber)) {
                dateData.meters.set(meterNumber, { import: 0, export: 0, location })
            }

            const meterData = dateData.meters.get(meterNumber)!

            // Aggregate consumption
            if (record.system_name === "import_kwh") {
                bpData.importKwh += record.consumed_energy
                dateData.import += record.consumed_energy
                meterData.import += record.consumed_energy
            } else {
                bpData.exportKwh += record.consumed_energy
                dateData.export += record.consumed_energy
                meterData.export += record.consumed_energy
            }
        })

        // Convert to array, filter by selected boundary points, and sort
        return Array.from(boundaryPointMap.values())
            .filter((bp) => selectedBoundaryPoints.length === 0 || selectedBoundaryPoints.includes(bp.boundaryPoint))
            .map((bp) => ({
                ...bp,
                netKwh: bp.importKwh - bp.exportKwh,
                dates: Array.from(bp.dates.entries())
                    .map(([date, data]) => ({
                        date,
                        import: data.import,
                        export: data.export,
                        net: data.import - data.export,
                        meters: Array.from(data.meters.entries())
                            .map(([meterNumber, values]) => ({
                                meterNumber,
                                location: values.location,
                                import: values.import,
                                export: values.export,
                                net: values.import - values.export,
                            }))
                            .filter((meter) => meter.import !== 0 || meter.export !== 0)
                            .sort((a, b) => b.net - a.net),
                    }))
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
            }))
            .sort((a, b) => b.netKwh - a.netKwh)
    }, [meterRecords, selectedBoundaryPoints])

    const boundaryFlowData = useMemo(() => {
        if (!meterRecords || meterRecords.length === 0) return []

        const flowMap = new Map<
            string,
            {
                boundaryPoint: string
                leftRegion: string
                rightRegion: string
                flows: Array<{
                    meterNumber: string
                    location: string | null
                    import: number
                    export: number
                    net: number
                }>
            }
        >()

        meterRecords.forEach((record) => {
            const bp = record.boundary_metering_point?.trim() || "Unknown"
            const location = record.location || null
            const meterNumber = record.meter_number

            const parts = bp.split("/").map((p) => p.trim())
            if (parts.length !== 2) return

            const [leftRegion, rightRegion] = parts

            if (!flowMap.has(bp)) {
                flowMap.set(bp, {
                    boundaryPoint: bp,
                    leftRegion,
                    rightRegion,
                    flows: [],
                })
            }

            const flowData = flowMap.get(bp)!

            let meterFlow = flowData.flows.find((f) => f.meterNumber === meterNumber && f.location === location)

            if (!meterFlow) {
                meterFlow = {
                    meterNumber,
                    location,
                    import: 0,
                    export: 0,
                    net: 0,
                }
                flowData.flows.push(meterFlow)
            }

            // Aggregate consumption
            if (record.system_name === "import_kwh") {
                meterFlow.import += record.consumed_energy
            } else {
                meterFlow.export += record.consumed_energy
            }
        })

        // Calculate net flows and sort
        flowMap.forEach((bp) => {
            bp.flows.forEach((flow) => {
                flow.net = flow.import - flow.export
            })
            bp.flows.sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
        })

        return Array.from(flowMap.values()).sort((a, b) => a.boundaryPoint.localeCompare(b.boundaryPoint))
    }, [meterRecords])

    const displayFlowData = useMemo(() => {
        return boundaryFlowData
            .filter((bp) => selectedBoundaryPoints.length === 0 || selectedBoundaryPoints.includes(bp.boundaryPoint))
            .map((bp) => {
                const { leftRegion, rightRegion } = bp

                return {
                    ...bp,
                    flows: bp.flows.map((flow) => {
                        // Determine actual direction based on net flow
                        const isLeftToRight = flow.net > 0

                        if (isFlowReversed) {
                            // When flipped, reverse everything
                            return {
                                ...flow,
                                from: isLeftToRight ? rightRegion : leftRegion,
                                to: isLeftToRight ? leftRegion : rightRegion,
                                import: flow.export,
                                export: flow.import,
                                net: -flow.net,
                            }
                        } else {
                            // Normal view
                            return {
                                ...flow,
                                from: isLeftToRight ? leftRegion : rightRegion,
                                to: isLeftToRight ? rightRegion : leftRegion,
                            }
                        }
                    }),
                }
            })
    }, [boundaryFlowData, isFlowReversed, selectedBoundaryPoints])

    // Calculate totals for flow table
    const flowTotals = useMemo(() => {
        let totalImport = 0
        let totalExport = 0

        boundaryFlowData
            .filter((bp) => selectedBoundaryPoints.length === 0 || selectedBoundaryPoints.includes(bp.boundaryPoint))
            .forEach((bp) => {
                bp.flows.forEach((flow) => {
                    totalImport += flow.import
                    totalExport += flow.export
                })
            })

        return {
            import: totalImport,
            export: totalExport,
            net: totalImport - totalExport,
        }
    }, [boundaryFlowData, selectedBoundaryPoints])

    const meterHealthMetrics = useMemo(() => {
        if (!summaryData) {
            return {
                totalMeters: 0,
                onlineMeters: 0,
                offlineMeters: 0,
                offlineNoData: 0,
                offlineNoRecord: 0,
                onlinePercentage: 0,
                offlinePercentage: 0,
                avgUptime: 0,
            }
        }

        return {
            totalMeters: summaryData.total,
            onlineMeters: summaryData.online,
            offlineMeters: summaryData.total_offline,
            offlineNoData: summaryData.offline_no_data,
            offlineNoRecord: summaryData.offline_no_record,
            onlinePercentage: summaryData.online_percentage,
            offlinePercentage: summaryData.offline_percentage,
            avgUptime: summaryData.avg_uptime_percentage,
        }
    }, [summaryData])

    const statusTimelineData = useMemo(() => {
        if (!timelineData || timelineData?.length === 0) {
            console.log("[v0] No timeline data available")
            return []
        }

        return timelineData?.map((item: any) => ({
            date: item.date.split("T")[0],
            online: item.online || 0,
            offline: item.offline || 0,
        }))
    }, [timelineData])

    console.log("[v0] Regional Boundary Processed Timeline:", statusTimelineData)

    const meterStatusTableData = useMemo(() => {
        if (!detailsData?.data) return []

        return detailsData.data.map((record) => ({
            meter_number: record.meter_number,
            latestStatus: record.status,
            latestDate: record.last_reading_time || "",
            totalConsumption: record.total_consumption_kwh || 0,
            lastReadingTime: record.last_reading_time || "",
            daysOffline: record.days_offline || 0,
            daysOnline: record.days_online || 0,
            uptime: record.uptime_percentage || 0,
            boundary_metering_point: record.boundary_metering_point || "",
            location: record.location || "",
        }))
    }, [detailsData])

    const paginatedStatusData = meterStatusTableData
    const totalStatusPages = detailsData?.pagination?.total_pages || 1

    useMemo(() => {
        setStatusCurrentPage(1)
    }, [statusFilter, statusSearchTerm])

    const handleStatusSort = (column: "meter" | "status" | "consumption" | "uptime") => {
        if (statusSortBy === column) {
            setStatusSortOrder(statusSortOrder === "asc" ? "desc" : "asc")
        } else {
            setStatusSortBy(column)
            setStatusSortOrder("asc")
        }
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => {
                    const Icon = stat.icon
                    return (
                        <Card key={stat.title}>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                                <Icon className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <Skeleton className="h-8 w-24" />
                                ) : (
                                    <>
                                        <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                                        <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
                                        {stat.thirdLine && <p className="text-xs text-muted-foreground mt-0.5">{stat.thirdLine}</p>}
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Meter Health & Status</CardTitle>
                    <CardDescription>Real-time monitoring of meter reporting and data quality</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Total Meters</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{meterHealthMetrics.totalMeters}</div>
                                <p className="text-xs text-muted-foreground mt-1">Monitored devices</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Online Meters</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">{meterHealthMetrics.onlineMeters}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {meterHealthMetrics.totalMeters > 0
                                        ? `${formatNumber((meterHealthMetrics.onlineMeters / meterHealthMetrics.totalMeters) * 100, 1)}% of total`
                                        : "—"}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Offline Meters</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-600">{meterHealthMetrics.offlineMeters}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {meterHealthMetrics.totalMeters > 0
                                        ? `${formatNumber((meterHealthMetrics.offlineMeters / meterHealthMetrics.totalMeters) * 100, 1)}% • No Data: ${meterHealthMetrics.offlineNoData} • No Record: ${meterHealthMetrics.offlineNoRecord}`
                                        : "—"}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Meter Uptime</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div
                                    className={`text-2xl font-bold ${
                                        meterHealthMetrics.avgUptime >= 90
                                            ? "text-green-600"
                                            : meterHealthMetrics.avgUptime >= 70
                                                ? "text-yellow-600"
                                                : "text-red-600"
                                    }`}
                                >
                                    {meterHealthMetrics.avgUptime > 0 ? `${formatNumber(meterHealthMetrics.avgUptime, 1)}%` : "—"}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Average fleet uptime</p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Status Timeline</CardTitle>
                            <CardDescription>Daily online/offline meter count</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {!timelineData || statusTimelineData.length === 0 ? (
                                <div className="h-[320px] flex items-center justify-center text-muted-foreground">
                                    No status data available
                                </div>
                            ) : (
                                <ChartContainer
                                    config={{
                                        online: {
                                            label: "Online",
                                            color: "hsl(142, 76%, 36%)",
                                        },
                                        offline: {
                                            label: "Offline",
                                            color: "hsl(0, 84%, 60%)",
                                        },
                                    }}
                                    className="h-[320px] w-full"
                                >
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={statusTimelineData}>
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                            <XAxis dataKey="date" className="text-xs" tickFormatter={(value) => formatDateLocal(value)} />
                                            <YAxis className="text-xs" />
                                            <ChartTooltip
                                                content={<ChartTooltipContent />}
                                                labelFormatter={(value) => formatDateLocalFull(value)}
                                            />
                                            <Legend />
                                            <Bar dataKey="online" stackId="status" fill="hsl(142, 76%, 36%)" radius={[0, 0, 0, 0]} />
                                            <Bar dataKey="offline" stackId="status" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Meter Status Details</CardTitle>
                            <CardDescription>Individual meter health and reporting status</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant={statusFilter === "all" ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => {
                                            setStatusFilter("all")
                                            setStatusCurrentPage(1)
                                        }}
                                    >
                                        All ({meterHealthMetrics.totalMeters})
                                    </Button>
                                    <Button
                                        variant={statusFilter === "online" ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => {
                                            setStatusFilter("online")
                                            setStatusCurrentPage(1)
                                        }}
                                        className={
                                            statusFilter === "online"
                                                ? "bg-green-600 hover:bg-green-700"
                                                : "border-green-600 text-green-600 hover:bg-green-50"
                                        }
                                    >
                                        Online ({meterHealthMetrics.onlineMeters})
                                    </Button>
                                    <Button
                                        variant={statusFilter === "offline" ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => {
                                            setStatusFilter("offline")
                                            setStatusCurrentPage(1)
                                        }}
                                        className={
                                            statusFilter === "offline"
                                                ? "bg-red-600 hover:bg-red-700"
                                                : "border-red-600 text-red-600 hover:bg-red-50"
                                        }
                                    >
                                        Offline ({meterHealthMetrics.offlineMeters})
                                    </Button>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search meter number..."
                                    value={statusSearchTerm}
                                    onChange={(e) => setStatusSearchTerm(e.target.value)}
                                    className="px-3 py-2 text-sm border rounded-md w-64"
                                />
                            </div>

                            <div className="relative overflow-x-auto border rounded-lg">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleStatusSort("meter")}>
                                                <div className="flex items-center gap-2">
                                                    Meter Number
                                                    {statusSortBy === "meter" && (
                                                        <span className="text-xs">{statusSortOrder === "asc" ? "↑" : "↓"}</span>
                                                    )}
                                                </div>
                                            </TableHead>
                                            <TableHead>Boundary Point</TableHead>
                                            <TableHead>Location</TableHead>
                                            <TableHead
                                                className="cursor-pointer hover:bg-muted/50"
                                                onClick={() => handleStatusSort("status")}
                                            >
                                                <div className="flex items-center gap-2">
                                                    Status
                                                    {statusSortBy === "status" && (
                                                        <span className="text-xs">{statusSortOrder === "asc" ? "↑" : "↓"}</span>
                                                    )}
                                                </div>
                                            </TableHead>
                                            <TableHead>Last Reading</TableHead>
                                            <TableHead
                                                className="text-right cursor-pointer hover:bg-muted/50"
                                                onClick={() => handleStatusSort("consumption")}
                                            >
                                                <div className="flex items-center justify-end gap-2">
                                                    Total Consumption (kWh)
                                                    {statusSortBy === "consumption" && (
                                                        <span className="text-xs">{statusSortOrder === "asc" ? "↑" : "↓"}</span>
                                                    )}
                                                </div>
                                            </TableHead>
                                            <TableHead
                                                className="text-right cursor-pointer hover:bg-muted/50"
                                                onClick={() => handleStatusSort("uptime")}
                                            >
                                                <div className="flex items-center justify-end gap-2">
                                                    Uptime %
                                                    {statusSortBy === "uptime" && (
                                                        <span className="text-xs">{statusSortOrder === "asc" ? "↑" : "↓"}</span>
                                                    )}
                                                </div>
                                            </TableHead>
                                            {/*<TableHead>Last Reading Time</TableHead>*/}
                                            <TableHead className="text-right">Days Offline</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedStatusData.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                                    No meters found matching the selected filters
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            paginatedStatusData.map((meter) => (
                                                <TableRow key={meter.meter_number}>
                                                    <TableCell className="font-mono text-sm">
                                                        <Link href={`/meters/${meter.meter_number}`} className="hover:text-blue-200 hover:underline">
                                                        {meter.meter_number}
                                                    </Link></TableCell>
                                                    <TableCell className="text-sm">{meter.boundary_metering_point || "—"}</TableCell>
                                                    <TableCell className="text-sm">{meter.location || "—"}</TableCell>
                                                    <TableCell>
                            <span
                                className={cn(
                                    "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                                    meter.latestStatus === "OFFLINE - No Data" || meter.latestStatus.startsWith("OFFLINE")
                                        ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                                        : "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
                                )}
                            >
                              {meter.latestStatus.startsWith("OFFLINE") ? "OFFLINE" : "ONLINE"}
                            </span>
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        <div className="flex flex-col">
                                                            <span>{formatDateLocal(meter.latestDate)}</span>
                                                            <span className="text-xs text-muted-foreground font-mono">
                                {new Date(meter.lastReadingTime).toLocaleTimeString("en-US", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                              </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">{formatNumber(meter.totalConsumption, 2)}</TableCell>
                                                    <TableCell className="text-right">
                            <span
                                className={`font-medium ${
                                    meter.uptime >= 90
                                        ? "text-green-600"
                                        : meter.uptime >= 70
                                            ? "text-yellow-600"
                                            : "text-red-600"
                                }`}
                            >
                              {formatNumber(meter.uptime, 1)}%
                            </span>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {meter.daysOffline > 0 ? (
                                                            <span className="text-red-600 font-medium">{meter.daysOffline}</span>
                                                        ) : (
                                                            <span className="text-muted-foreground">-</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {totalStatusPages > 1 && (
                                <TablePagination
                                    currentPage={statusCurrentPage}
                                    totalPages={totalStatusPages}
                                    onPageChange={setStatusCurrentPage}
                                />
                            )}
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                <Card className="md:col-span-2">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Regional Energy Transfer Trends</CardTitle>
                                <CardDescription>Import and export patterns across boundary points over time for selected period</CardDescription>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Checkbox id="trends-import" checked={showTrendsImport} onCheckedChange={setShowTrendsImport} />
                                    <Label htmlFor="trends-import" className="text-sm font-normal cursor-pointer">
                                        Import
                                    </Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Checkbox id="trends-export" checked={showTrendsExport} onCheckedChange={setShowTrendsExport} />
                                    <Label htmlFor="trends-export" className="text-sm font-normal cursor-pointer">
                                        Export
                                    </Label>
                                </div>
                            </div>
                        </div>
                        <div className="mt-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm text-muted-foreground mr-2">Filter by Boundary Point:</span>
                                {boundaryData?.byBoundaryPoint.map((bp) => (
                                    <Button
                                        key={bp.boundaryPoint}
                                        variant={selectedBoundaryPoints.includes(bp.boundaryPoint) ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => {
                                            setSelectedBoundaryPoints((prev) =>
                                                prev.includes(bp.boundaryPoint)
                                                    ? prev.filter((p) => p !== bp.boundaryPoint)
                                                    : [...prev, bp.boundaryPoint]
                                            )
                                        }}
                                        style={{
                                            backgroundColor: selectedBoundaryPoints.includes(bp.boundaryPoint)
                                                ? getRandomColor(
                                                    boundaryData.byBoundaryPoint.findIndex((b) => b.boundaryPoint === bp.boundaryPoint),
                                                    bp.boundaryPoint,
                                                )
                                                : undefined,
                                            borderColor: getRandomColor(
                                                boundaryData.byBoundaryPoint.findIndex((b) => b.boundaryPoint === bp.boundaryPoint),
                                                bp.boundaryPoint,
                                            ),
                                            color: selectedBoundaryPoints.includes(bp.boundaryPoint)
                                                ? "white"
                                                : getRandomColor(
                                                    boundaryData.byBoundaryPoint.findIndex((b) => b.boundaryPoint === bp.boundaryPoint),
                                                    bp.boundaryPoint,
                                                ),
                                        }}
                                    >
                                        {bp.boundaryPoint}
                                    </Button>
                                ))}
                                {selectedBoundaryPoints.length > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            console.log("[v0] Regional boundary - Clear All clicked")
                                            setSelectedBoundaryPoints([])
                                        }}
                                        className="text-muted-foreground"
                                    >
                                        Clear All
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-[350px] w-full" />
                        ) : !boundaryData?.timeSeriesData || boundaryData.timeSeriesData.length === 0 ? (
                            <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                                No data available for the selected filters
                            </div>
                        ) : (
                            <ChartContainer
                                config={{
                                    import: {
                                        label: "Import (kWh)",
                                        color: "hsl(142, 76%, 36%)",
                                    },
                                    export: {
                                        label: "Export (kWh)",
                                        color: "hsl(221, 83%, 53%)",
                                    },
                                }}
                                className="h-[350px] w-full"
                            >
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={boundaryData.timeSeriesData}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis dataKey="date" className="text-xs" tickFormatter={(value) => formatDateLocal(value)} />
                                        <YAxis
                                            className="text-xs"
                                            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                                            domain={[0, "auto"]}
                                        />
                                        <ChartTooltip
                                            content={<ChartTooltipContent />}
                                            labelFormatter={(value) => formatDateLocalFull(value)}
                                        />
                                        {/*<Legend />*/}
                                        {showTrendsImport &&
                                            boundaryData.byBoundaryPoint
                                                .filter((bp) => selectedBoundaryPoints.includes(bp.boundaryPoint))
                                                .map((bp, idx) => {
                                                    return (
                                                        <Line
                                                            key={`${bp.boundaryPoint}_import`}
                                                            type="monotone"
                                                            dataKey={`${bp.boundaryPoint}_import_kwh`}
                                                            stackId="import"
                                                            stroke={getRandomColor(idx, bp.boundaryPoint + '_import')}
                                                            strokeWidth={2}
                                                            strokeDasharray=""
                                                            dot={false}
                                                            name={`${bp.boundaryPoint} Import`}
                                                        />
                                                    )
                                                })}
                                        {showTrendsExport &&
                                            boundaryData.byBoundaryPoint
                                                .filter((bp) => selectedBoundaryPoints.includes(bp.boundaryPoint))
                                                .map((bp, idx) => {
                                                    return (
                                                        <Line
                                                            key={`${bp.boundaryPoint}_export`}
                                                            type="monotone"
                                                            dataKey={`${bp.boundaryPoint}_export_kwh`}
                                                            stackId="export"
                                                            stroke={getRandomColor(idx, bp.boundaryPoint + '_export')}
                                                            strokeWidth={2}
                                                            strokeDasharray="5 5"
                                                            dot={false}
                                                            name={`${bp.boundaryPoint} Export`}
                                                        />
                                                    )
                                                })}
                                    </LineChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        )}
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Boundary Point Comparison</CardTitle>
                                <CardDescription>Energy transfer by boundary metering point</CardDescription>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="comparison-import"
                                        checked={showComparisonImport}
                                        onCheckedChange={setShowComparisonImport}
                                    />
                                    <Label htmlFor="comparison-import" className="text-sm font-normal cursor-pointer">
                                        Import
                                    </Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="comparison-export"
                                        checked={showComparisonExport}
                                        onCheckedChange={setShowComparisonExport}
                                    />
                                    <Label htmlFor="comparison-export" className="text-sm font-normal cursor-pointer">
                                        Export
                                    </Label>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-[300px] w-full" />
                        ) : (
                            <ChartContainer
                                config={{
                                    importKwh: {
                                        label: "Import (kWh)",
                                        color: "hsl(142, 76%, 36%)",
                                    },
                                    exportKwh: {
                                        label: "Export (kWh)",
                                        color: "hsl(221, 83%, 53%)",
                                    },
                                }}
                                className="h-[300px] w-full"
                            >
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={boundaryData?.byBoundaryPoint || []}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis dataKey="boundaryPoint" className="text-xs" angle={-45} textAnchor="end" height={100} />
                                        <YAxis className="text-xs" tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                                        <ChartTooltip content={<ChartTooltipContent />} />
                                        <Legend />
                                        {showComparisonImport && (
                                            <Bar dataKey="importKwh" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} name="Import (kWh)" />
                                        )}
                                        {showComparisonExport && (
                                            <Bar dataKey="exportKwh" fill="hsl(221, 83%, 53%)" radius={[4, 4, 0, 0]} name="Export (kWh)" />
                                        )}
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        )}
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Boundary Point Details</CardTitle>
                        <CardDescription>
                            Detailed breakdown of energy transfers by boundary point (click to expand)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {!meterRecords ? (
                            <Skeleton className="h-[400px] w-full" />
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead className="w-[40%]">Boundary Point / Date / Meter</TableHead>
                                            <TableHead className="text-right w-[20%]">Import (kWh)</TableHead>
                                            <TableHead className="text-right w-[20%]">Export (kWh)</TableHead>
                                            <TableHead className="text-right w-[20%]">Net (kWh)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {tableData.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                                    No data available for the selected filters
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            tableData.map((bp) => {
                                                const isExpanded = expandedBoundaryPoints.has(bp.boundaryPoint)

                                                return (
                                                    <>
                                                        <TableRow
                                                            key={bp.boundaryPoint}
                                                            className="cursor-pointer hover:bg-muted/50 border-b-2"
                                                            onClick={() => toggleBoundaryPoint(bp.boundaryPoint)}
                                                        >
                                                            <TableCell className="font-semibold">
                                                                <div className="flex items-center gap-2">
                                                                    {isExpanded ? (
                                                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                                    ) : (
                                                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                                    )}
                                                                    <Link href={`/regional-boundary/${encodeURIComponent(bp.boundaryPoint)}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                                                                        {bp.boundaryPoint}
                                                                    </Link>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right text-green-600 font-medium">
                                                                {formatNumber(bp.importKwh,2)}
                                                            </TableCell>
                                                            <TableCell className="text-right text-blue-600 font-medium">
                                                                {formatNumber(bp.exportKwh,2)}
                                                            </TableCell>
                                                            <TableCell className="text-right font-medium">
                                <span className={bp.netKwh > 0 ? "text-green-600" : "text-red-600"}>
                                  {formatNumber(bp.netKwh,2)}
                                </span>
                                                            </TableCell>
                                                        </TableRow>

                                                        {isExpanded &&
                                                            bp.dates.map((day) => {
                                                                const dateKey = `${bp.boundaryPoint}_${day.date}`
                                                                const isDateExpanded = expandedDates.has(dateKey)

                                                                return (
                                                                    <>
                                                                        <TableRow
                                                                            key={dateKey}
                                                                            className="bg-muted/20 cursor-pointer hover:bg-muted/30"
                                                                            onClick={(e) => toggleDate(dateKey, e)}
                                                                        >
                                                                            <TableCell className="text-sm">
                                                                                <div className="flex items-center gap-2 pl-6">
                                                                                    {isDateExpanded ? (
                                                                                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                                                                    ) : (
                                                                                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                                                                    )}
                                                                                    <span className="font-medium">{formatDateLocalFull(day.date)}</span>
                                                                                </div>
                                                                            </TableCell>
                                                                            <TableCell className="text-right text-green-600 text-sm">
                                                                                {formatNumber(day.import)}
                                                                            </TableCell>
                                                                            <TableCell className="text-right text-blue-600 text-sm">
                                                                                {formatNumber(day.export)}
                                                                            </TableCell>
                                                                            <TableCell className="text-right text-sm">
                                        <span className={day.net > 0 ? "text-green-600" : "text-red-600"}>
                                          {formatNumber(day.net)}
                                        </span>
                                                                            </TableCell>
                                                                        </TableRow>

                                                                        {isDateExpanded &&
                                                                            day.meters.map((meter) => (
                                                                                <TableRow
                                                                                    key={`${dateKey}_${meter.meterNumber}`}
                                                                                    className="bg-muted/10 hover:bg-muted/15"
                                                                                >
                                                                                    <TableCell className="text-xs">
                                                                                        <div className="pl-12 flex items-center gap-2">
                                              <span className="text-muted-foreground font-mono">
                                                <Link href={`/meters/${meter.meterNumber}`} className="hover:text-blue-200 hover:underline">
                                                        {meter.meterNumber}
                                                    </Link>
                                              </span>
                                                                                            {meter.location && (
                                                                                                <>
                                                                                                    <span className="text-muted-foreground/50">•</span>
                                                                                                    <span className="text-muted-foreground">{meter.location}</span>
                                                                                                </>
                                                                                            )}
                                                                                        </div>
                                                                                    </TableCell>
                                                                                    <TableCell className="text-right text-green-600 text-xs">
                                                                                        {formatNumber(meter.import)}
                                                                                    </TableCell>
                                                                                    <TableCell className="text-right text-blue-600 text-xs">
                                                                                        {formatNumber(meter.export)}
                                                                                    </TableCell>
                                                                                    <TableCell className="text-right text-xs">
                                            <span className={meter.net > 0 ? "text-green-600" : "text-red-600"}>
                                              {formatNumber(meter.net)}
                                            </span>
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            ))}
                                                                    </>
                                                                )
                                                            })}
                                                    </>
                                                )
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Boundary Flow Analysis</CardTitle>
                            <CardDescription>Bidirectional energy flows between regions with location-level detail</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setIsFlowReversed(!isFlowReversed)} className="gap-2">
                            <ArrowRightLeft className="h-4 w-4" />
                            {isFlowReversed ? "Show Default View" : "Flip Direction"}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {!meterRecords ? (
                        <Skeleton className="h-[400px] w-full" />
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="w-[18%]">Boundary Point</TableHead>
                                        <TableHead className="w-[12%]">Meter Number</TableHead>
                                        <TableHead className="w-[12%]">From</TableHead>
                                        <TableHead className="w-[12%]">To</TableHead>
                                        <TableHead className="w-[12%]">Location</TableHead>
                                        <TableHead className="text-right w-[11%]">Import (kWh)</TableHead>
                                        <TableHead className="text-right w-[11%]">Export (kWh)</TableHead>
                                        <TableHead className="text-right w-[12%]">Net Flow (kWh)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {displayFlowData.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                                No data available for the selected filters
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        <>
                                            {displayFlowData.map((bp) =>
                                                bp.flows.map((flow, idx) => (
                                                    <TableRow key={`${bp.boundaryPoint}_${flow.meterNumber}_${flow.location || "null"}_${idx}`}>
                                                        <TableCell className="font-medium">
                                                            <Link href={`/regional-boundary/${encodeURIComponent(bp.boundaryPoint)}`} className="text-primary hover:underline">
                                                                {bp.boundaryPoint}
                                                            </Link>
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground font-mono text-xs">
                                                            <Link href={`/meters/${flow.meterNumber}`} className="hover:text-blue-200 hover:underline">
                                                                {flow.meterNumber}
                                                            </Link>
                                                        </TableCell>
                                                        <TableCell>{flow.from}</TableCell>
                                                        <TableCell>{flow.to}</TableCell>
                                                        <TableCell className="text-muted-foreground">{flow.location || "—"}</TableCell>
                                                        <TableCell className="text-right text-green-600 font-medium">
                                                            {formatNumber(flow.import,2)}
                                                        </TableCell>
                                                        <TableCell className="text-right text-blue-600 font-medium">
                                                            {formatNumber(flow.export,2)}
                                                        </TableCell>
                                                        <TableCell className="text-right font-medium">
                                                            {flow.net > 0 ? (
                                                                <span className="text-green-600">{formatNumber(flow.net,2)} →</span>
                                                            ) : flow.net < 0 ? (
                                                                <span className="text-blue-600">{formatNumber(Math.abs(flow.net),2)} ←</span>
                                                            ) : (
                                                                <span className="text-muted-foreground">0</span>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                )),
                                            )}
                                            <TableRow className="bg-muted/50 border-t-2 font-bold">
                                                <TableCell colSpan={5} className="text-red-600">
                                                    Total
                                                </TableCell>
                                                <TableCell className="text-right text-green-600">{formatNumber(flowTotals.import,2)}</TableCell>
                                                <TableCell className="text-right text-blue-600">{formatNumber(flowTotals.export,2)}</TableCell>
                                                <TableCell className="text-right">
                                                    {(isFlowReversed ? -flowTotals.net : flowTotals.net) > 0 ? (
                                                        <span className="text-green-600">
                              {formatNumber(Math.abs(isFlowReversed ? -flowTotals.net : flowTotals.net),2)} →
                            </span>
                                                    ) : (isFlowReversed ? -flowTotals.net : flowTotals.net) < 0 ? (
                                                        <span className="text-blue-600">
                              {formatNumber(Math.abs(isFlowReversed ? -flowTotals.net : flowTotals.net),2)} ←
                            </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">0</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        </>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>


        </div>
    )
}
