"use client"

import { ChartTooltipContent } from "@/components/ui/chart"
import { ChartTooltip } from "@/components/ui/chart"
import { ChartContainer } from "@/components/ui/chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,

    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useDtxDaily, useDtxAggregate } from "@/hooks/api/use-dtx-api"
import { useMeterStatusSummary, useStatusTimeline, useMeterStatusDetails } from "@/hooks/api/use-meter-status-api"
import { useAppStore } from "@/stores/app-store"
import { formatApiDate } from "@/lib/utils"
import { TrendingUp, TrendingDown, Zap, Building2, CheckCircle2, Activity, AlertCircle, Database, ChevronRight } from "lucide-react"
import {AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, BarChart, Bar} from "recharts"
import React, { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ArrowUpDown } from "lucide-react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { TablePagination } from "@/components/ui/table-pagination"

interface DtxTabProps {
    meterTypes: string[]
}

export function DtxTab({ meterTypes }: DtxTabProps) {
    const filters = useAppStore((state) => state.filters)

    const [showImport, setShowImport] = useState(true)
    const [showExport, setShowExport] = useState(true)
    const [showCumulative, setShowCumulative] = useState(false)
    const [sortColumn, setSortColumn] = useState<string>("totalConsumption")
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
    const [meterPage, setMeterPage] = useState(1)
    const metersPerPage = 20
    const [meterNumberFilter, setMeterNumberFilter] = useState("")
    const [chartSelectedRegions, setChartSelectedRegions] = useState<string[]>([])
    const [districtSortColumn, setDistrictSortColumn] = useState<string>("totalConsumption")

    // Helper function to get consistent color per region
    const getRegionColor = (region: string) => {
        const index = availableRegions.indexOf(region)
        const hue = (index * 137) % 360
        const saturation = 65 + (index % 3) * 10
        const lightness = 45 + (index % 2) * 10
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`
    }
    const [districtSortDirection, setDistrictSortDirection] = useState<"asc" | "desc">("desc")
    const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set())
    const [expandedDistricts, setExpandedDistricts] = useState<Set<string>>(new Set())
    const [breakdownView, setBreakdownView] = useState<"region" | "district">("region")

    const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all")
    const [statusPage, setStatusPage] = useState(1)
    const statusPerPage = 20
    const [meterStatusSearch, setMeterStatusSearch] = useState("")
    const [statusSortColumn, setStatusSortColumn] = useState<string>("consumption")
    const [statusSortDirection, setStatusSortDirection] = useState<"asc" | "desc">("desc")

    const [expandedMeterGroups, setExpandedMeterGroups] = useState<Set<string>>(new Set())
    const [breakdownMeterFilter, setBreakdownMeterFilter] = useState("")
    const [breakdownDateSort, setBreakdownDateSort] = useState<"asc" | "desc">("asc")

    const params = {
        dateFrom: filters.dateRange ? formatApiDate(filters.dateRange.start) : "",
        dateTo: filters.dateRange ? formatApiDate(filters.dateRange.end) : "",
        regions: filters.regions || [],
        districts: filters.districts || [],
        stations: filters.stations || [],
        boundaryMeteringPoints: filters.boundaryMeteringPoints || [],
        feeders: filters.feeders || [],
        voltages: filters.voltages || [],
        meterTypes: ["DTX"],
    }


    const { data: aggregateData, isLoading: aggregateLoading } = useDtxAggregate(params)
    const { data: dailyData, isLoading: dailyLoading } = useDtxDaily(params)
    const { data: summaryData, isLoading: summaryLoading } = useMeterStatusSummary(params)
    const { data: timelineData, isLoading: timelineLoading } = useStatusTimeline(params)
    const { data: detailsData, isLoading: detailsLoading } = useMeterStatusDetails({
        ...params,
        status: statusFilter === "all" ? undefined : statusFilter,
        page: statusPage,
        limit: statusPerPage,
        search: meterStatusSearch,
        sortBy: statusSortColumn,
        sortOrder: statusSortDirection,

    })

    const meterHealthMetrics = useMemo(() => {
        if (!summaryData) {
            return {
                totalMeters: 0,
                onlineMeters: 0,
                offlineMeters: 0,
                onlinePercentage: 0,
                offlinePercentage: 0,
                avgUptimePercentage: 0,
            }
        }

        return {
            totalMeters: summaryData.total,
            onlineMeters: summaryData.online,
            offlineMeters: summaryData.total_offline,
            onlinePercentage: summaryData.online_percentage,
            offlinePercentage: summaryData.offline_percentage,
            avgUptimePercentage: summaryData.avg_uptime_percentage,
        }
    }, [summaryData])

    const statusTimelineData = useMemo(() => {
        if (!timelineData || timelineData?.length === 0) {
            return []
        }

        return timelineData?.map((item) => ({
            date: item.date.split("T")[0],
            online: item.online,
            offline: item.offline,
        }))
    }, [timelineData])

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



    const regionalBreakdown = useMemo(() => {
        if (!aggregateData || !aggregateData.regionalBreakdown) return []
        return aggregateData.regionalBreakdown
    }, [aggregateData])

    const topMeters = useMemo(() => {
        if (!dailyData) return []

        const meterMap = new Map<
            string,
            {
                meter_number: string
                region: string
                district: string
                import: number
                export: number
            }
        >()

        dailyData.forEach((record) => {
            if (!record.region) return

            if (!meterMap.has(record.meter_number)) {
                meterMap.set(record.meter_number, {
                    meter_number: record.meter_number,
                    region: record.region,
                    district: record.district || "-",
                    import: 0,
                    export: 0,
                })
            }

            const entry = meterMap.get(record.meter_number)!
            if (record.system_name === "import_kwh") {
                entry.import += record.consumed_energy
            } else {
                entry.export += record.consumed_energy
            }
        })

        return Array.from(meterMap.values())
            .map((m) => ({ ...m, net: m.import - m.export }))
            .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
    }, [dailyData])

    const sortedRegions = useMemo(() => {
        const sorted = [...regionalBreakdown]
        sorted.sort((a, b) => {
            let aVal: number, bVal: number

            switch (sortColumn) {
                case "region":
                    return sortDirection === "asc" ? a.region.localeCompare(b.region) : b.region.localeCompare(a.region)
                case "activeMeters":
                    aVal = a.activeMeters
                    bVal = b.activeMeters
                    break
                case "totalMeters":
                    aVal = a.totalMetersByRegion
                    bVal = b.totalMetersByRegion
                    break
                case "health":
                    aVal = a.totalMetersByRegion > 0 ? (a.activeMeters / a.totalMetersByRegion) * 100 : 0
                    bVal = b.totalMetersByRegion > 0 ? (b.activeMeters / b.totalMetersByRegion) * 100 : 0
                    break
                case "totalConsumption":
                default:
                    aVal = a.import - a.export
                    bVal = b.import - b.export
                    break
            }

            return sortDirection === "asc" ? aVal - bVal : bVal - aVal
        })

        return sorted
    }, [regionalBreakdown, sortColumn, sortDirection])

    const sortedDistricts = useMemo(() => {
        if (!aggregateData?.districtBreakdown) return []

        const sorted = [...aggregateData.districtBreakdown]
        sorted.sort((a, b) => {
            let aVal: number, bVal: number

            switch (districtSortColumn) {
                case "district":
                    return districtSortDirection === "asc"
                        ? a.district.localeCompare(b.district)
                        : b.district.localeCompare(a.district)
                case "region":
                    return districtSortDirection === "asc" ? a.region.localeCompare(b.region) : b.region.localeCompare(a.region)
                case "activeMeters":
                    aVal = a.activeMeters
                    bVal = b.activeMeters
                    break
                case "totalMeters":
                    aVal = a.totalMetersByDistrict
                    bVal = b.totalMetersByDistrict
                    break
                case "health":
                    aVal = a.totalMetersByDistrict > 0 ? (a.activeMeters / a.totalMetersByDistrict) * 100 : 0
                    bVal = b.totalMetersByDistrict > 0 ? (b.activeMeters / b.totalMetersByDistrict) * 100 : 0
                    break
                case "totalConsumption":
                default:
                    aVal = a.import - a.export
                    bVal = b.import - b.export
                    break
            }

            return districtSortDirection === "asc" ? aVal - bVal : bVal - aVal
        })

        return sorted
    }, [aggregateData?.districtBreakdown, districtSortColumn, districtSortDirection])

    const filteredTopMeters = useMemo(() => {
        if (!meterNumberFilter) return topMeters
        return topMeters.filter((meter) => meter.meter_number.toLowerCase().includes(meterNumberFilter.toLowerCase()))
    }, [topMeters, meterNumberFilter])

    const paginatedMeters = useMemo(() => {
        const start = (meterPage - 1) * metersPerPage
        return filteredTopMeters.slice(start, start + metersPerPage)
    }, [filteredTopMeters, meterPage])

    const totalMeterPages = Math.ceil(filteredTopMeters.length / metersPerPage)


// REPLACE the availableRegions useMemo with this fixed version:

    const availableRegions = useMemo(() => {
        if (!dailyData) return []

        const regions = new Set<string>()

        // ✅ FIX: Get regions directly from dailyData, NOT from regionalTrendData
        dailyData.forEach((record) => {
            if (record.region) {
                regions.add(record.region)
            }
        })

        return Array.from(regions).sort()
    }, [dailyData]) // ✅ Only depend on dailyData, NOT chartSelectedRegions


// Keep the regionalTrendData as is - it's correct:
    const regionalTrendData = useMemo(() => {
        if (!dailyData) return []

        const dateRegionMap = new Map<string, Map<string, { import: number; export: number }>>()

        dailyData.forEach((record) => {
            if (!record.region) return

            const date = new Date(record.consumption_date).toISOString().split("T")[0]

            if (!dateRegionMap.has(date)) {
                dateRegionMap.set(date, new Map())
            }

            const regionMap = dateRegionMap.get(date)!
            if (!regionMap.has(record.region)) {
                regionMap.set(record.region, { import: 0, export: 0 })
            }

            const entry = regionMap.get(record.region)!
            if (record.system_name === "import_kwh") {
                entry.import += record.consumed_energy
            } else {
                entry.export += record.consumed_energy
            }
        })

        const result: any[] = []

        dateRegionMap.forEach((regionMap, date) => {
            const dataPoint: any = { date }

            regionMap.forEach((values, region) => {
                // Filter by selected regions OR show all if none selected
                if (chartSelectedRegions.length === 0 || chartSelectedRegions.includes(region)) {
                    dataPoint[`${region}_import`] = values.import
                    dataPoint[`${region}_export`] = values.export
                }
            })

            result.push(dataPoint)
        })

        return result.sort((a, b) => a.date.localeCompare(b.date))
    }, [dailyData, chartSelectedRegions])


    // Chart config with unique colors per region
    const chartConfig = useMemo(() => {
        const config: Record<string, { label: string; color: string }> = {}

        // Use selected regions if any, otherwise all available regions
        const regionsToShow = chartSelectedRegions.length > 0 ? chartSelectedRegions : availableRegions

        regionsToShow.forEach((region) => {
            const baseColor = getRegionColor(region)
            config[`${region}_import`] = {
                label: `${region} Import`,
                color: baseColor,
            }
            config[`${region}_export`] = {
                label: `${region} Export`,
                color: baseColor,
            }
        })

        return config
    }, [availableRegions, chartSelectedRegions])


    const uniqueRegions = new Set(regionalBreakdown.map((r) => r.region)).size
    const uniqueDistricts = sortedDistricts.length

    // Get top meters for a specific region
    const getTopMetersByRegion = (region: string, limit = 10) => {
        if (!dailyData || !Array.isArray(dailyData)) return []

        return dailyData
            .filter((record: any) => record.region?.toLowerCase() === region.toLowerCase())
            .sort((a: any, b: any) => (b.consumed_energy || 0) - (a.consumed_energy || 0))
            .slice(0, limit)
    }

    // Get top meters for a specific district
    const getTopMetersByDistrict = (district: string, limit = 10) => {
        if (!dailyData || !Array.isArray(dailyData)) return []

        return dailyData
            .filter((record: any) => record.district?.toLowerCase() === district.toLowerCase())
            .sort((a: any, b: any) => (b.consumed_energy || 0) - (a.consumed_energy || 0))
            .slice(0, limit)
    }

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc")
        } else {
            setSortColumn(column)
            setSortDirection("desc")
        }
    }

    const handleDistrictSort = (column: string) => {
        if (districtSortColumn === column) {
            setDistrictSortDirection(districtSortDirection === "asc" ? "desc" : "asc")
        } else {
            setDistrictSortColumn(column)
            setDistrictSortDirection("desc")
        }
    }

    const handleStatusSort = (column: string) => {
        if (statusSortColumn === column) {
            setStatusSortDirection(statusSortDirection === "asc" ? "desc" : "asc")
        } else {
            setStatusSortColumn(column)
            setStatusSortDirection("desc")
        }
    }

    const toggleRegionExpansion = (regionName: string) => {
        setExpandedRegions((prev) => {
            const next = new Set(prev)
            if (next.has(regionName)) {
                next.delete(regionName)
            } else {
                next.add(regionName)
            }
            return next
        })
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

    const hierarchicalBreakdown = useMemo(() => {
        if (!dailyData || !Array.isArray(dailyData)) return new Map()

        const hierarchy = new Map<string, Map<string, any[]>>()

        // Group meter readings first
        const groupedMeters = groupMeterReadings(dailyData)

        // Filter by meter number if filter is active
        const filteredMeters = breakdownMeterFilter
            ? groupedMeters.filter((meter) =>
                meter.meter_number?.toLowerCase().includes(breakdownMeterFilter.toLowerCase())
            )
            : groupedMeters

        filteredMeters.forEach((meter) => {
            const region = meter.region
            const district = meter.district || "Unknown District"

            if (!region) return

            // Initialize region if not exists
            if (!hierarchy.has(region)) {
                hierarchy.set(region, new Map())
            }

            const regionMap = hierarchy.get(region)!

            // Initialize district if not exists
            if (!regionMap.has(district)) {
                regionMap.set(district, [])
            }

            // Add meter to district
            regionMap.get(district)!.push(meter)
        })

        return hierarchy
    }, [dailyData, breakdownMeterFilter])

    const toggleMeterGroup = (key: string) => {
        setExpandedMeterGroups((prev) => {
            const newSet = new Set(prev)
            if (newSet.has(key)) {
                newSet.delete(key)
            } else {
                newSet.add(key)
            }
            return newSet
        })
    }

    const handleBreakdownDateSort = () => {
        setBreakdownDateSort((prev) => (prev === "asc" ? "desc" : "asc"))
    }

    return (
        <div className="space-y-6">
            {/* Stat cards with loading skeletons */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Import</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        {aggregateLoading ? (
                            <>
                                <Skeleton className="h-8 w-32 mb-2" />
                                <Skeleton className="h-4 w-24" />
                            </>
                        ) : (
                            <>
                                <div className="text-2xl font-bold text-green-600">
                                    {(aggregateData?.totalImportKwh || 0).toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                    })} kWh
                                </div>
                                <p className="text-xs text-muted-foreground">Selected period</p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Export</CardTitle>
                        <TrendingDown className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        {aggregateLoading ? (
                            <>
                                <Skeleton className="h-8 w-32 mb-2" />
                                <Skeleton className="h-4 w-24" />
                            </>
                        ) : (
                            <>
                                <div className="text-2xl font-bold text-blue-600">
                                    {(aggregateData?.totalExportKwh || 0).toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                    })} kWh
                                </div>
                                <p className="text-xs text-muted-foreground">Selected period</p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Net Consumption</CardTitle>
                        <Zap className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        {aggregateLoading ? (
                            <>
                                <Skeleton className="h-8 w-32 mb-2" />
                                <Skeleton className="h-4 w-24" />
                            </>
                        ) : (
                            <>
                                <div className="text-2xl font-bold text-orange-600">
                                    {(aggregateData?.netKwh || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh
                                </div>
                                <p className="text-xs text-muted-foreground">Import - Export</p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium">Coverage</CardTitle>
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        {aggregateLoading ? (
                            <>
                                <Skeleton className="h-8 w-24 mb-2" />
                                <Skeleton className="h-4 w-32" />
                            </>
                        ) : (
                            <>
                                <div className="text-2xl font-bold">{uniqueRegions} regions</div>
                                <p className="text-xs text-muted-foreground">{uniqueDistricts} districts reporting</p>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Meter Health & Status Section */}
            <div>
                <div className="mb-6">
                    <h2 className="text-2xl font-semibold">Meter Health & Status</h2>
                    <p className="text-sm text-muted-foreground">Real-time monitoring of meter reporting and data quality</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Meters</CardTitle>
                            <Database className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            {summaryLoading ? (
                                <>
                                    <Skeleton className="h-8 w-20 mb-2" />
                                    <Skeleton className="h-4 w-24" />
                                </>
                            ) : (
                                <>
                                    <div className="text-2xl font-bold">{meterHealthMetrics.totalMeters}</div>
                                    <p className="text-xs text-muted-foreground">Monitored devices</p>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Online Meters</CardTitle>
                            <Activity className="h-4 w-4 text-green-600" />
                        </CardHeader>
                        <CardContent>
                            {summaryLoading ? (
                                <>
                                    <Skeleton className="h-8 w-20 mb-2" />
                                    <Skeleton className="h-4 w-24" />
                                </>
                            ) : (
                                <>
                                    <div className="text-2xl font-bold text-green-600">{meterHealthMetrics.onlineMeters}</div>
                                    <p className="text-xs text-muted-foreground">
                                        {meterHealthMetrics.onlinePercentage.toFixed(1)}% of total
                                    </p>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Offline Meters</CardTitle>
                            <AlertCircle className="h-4 w-4 text-red-600" />
                        </CardHeader>
                        <CardContent>
                            {summaryLoading ? (
                                <>
                                    <Skeleton className="h-8 w-20 mb-2" />
                                    <Skeleton className="h-4 w-24" />
                                </>
                            ) : (
                                <>
                                    <div className="text-2xl font-bold text-red-600">{meterHealthMetrics.offlineMeters}</div>
                                    <p className="text-xs text-muted-foreground">
                                        {meterHealthMetrics.offlinePercentage.toFixed(1)}% of total
                                    </p>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Meter Uptime</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            {summaryLoading ? (
                                <>
                                    <Skeleton className="h-8 w-20 mb-2" />
                                    <Skeleton className="h-4 w-32" />
                                </>
                            ) : (
                                <>
                                    <div className="text-2xl font-bold">{meterHealthMetrics.avgUptimePercentage.toFixed(1)}%</div>
                                    <p className="text-xs text-muted-foreground">Average meter availability</p>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Status Timeline</CardTitle>
                        <CardDescription>Daily online and offline meter counts</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {timelineLoading ? (
                            <div className="h-[360px] flex items-center justify-center">
                                <Skeleton className="h-full w-full" />
                            </div>
                        ) : statusTimelineData.length === 0 ? (
                            <div className="h-[360px] flex items-center justify-center">
                                <p className="text-muted-foreground">No timeline data available</p>
                            </div>
                        ) : (
                            <ChartContainer
                                config={{
                                    online: { label: "Online", color: "hsl(142, 76%, 36%)" },
                                    offline: { label: "Offline", color: "hsl(0, 84%, 60%)" },
                                }}
                                className="h-[360px] w-full"
                            >
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={statusTimelineData}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />

                                        <XAxis
                                            dataKey="date"
                                            className="text-xs"
                                            tickFormatter={(value) =>
                                                new Date(value).toLocaleDateString("en-US", {
                                                    month: "short",
                                                    day: "numeric",
                                                })
                                            }
                                        />

                                        <YAxis className="text-xs" />

                                        <ChartTooltip content={<ChartTooltipContent />} />
                                        <Legend />

                                        <Bar
                                            dataKey="online"
                                            stackId="status"
                                            fill="hsl(142, 76%, 36%)"
                                            name="Online"
                                        />

                                        <Bar
                                            dataKey="offline"
                                            stackId="status"
                                            fill="hsl(0, 84%, 60%)"
                                            name="Offline"
                                        />
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
                                    All ({summaryData?.total || 0})
                                </Button>
                                <Button
                                    variant={statusFilter === "online" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => {
                                        setStatusFilter("online")
                                        setStatusPage(1)
                                    }}
                                >
                                    Online ({summaryData?.online || 0})
                                </Button>
                                <Button
                                    variant={statusFilter === "offline" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => {
                                        setStatusFilter("offline")
                                        setStatusPage(1)
                                    }}
                                >
                                    Offline ({summaryData?.total_offline || 0})
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
                                            <TableHead>
                                                <Button variant="ghost" onClick={() => handleStatusSort("meter_number")} className="h-8 px-2">
                                                    Meter Number
                                                    <ArrowUpDown className="ml-2 h-4 w-4" />
                                                </Button>
                                            </TableHead>
                                            <TableHead>Region</TableHead>


                                            <TableHead>
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
                                        {meterStatusTableData.map((meter) => (
                                            <TableRow key={meter.meter_number}>
                                                <TableCell className="font-medium"><Link href={`/meters/${meter.meter_number}`} className="hover:text-blue-200 hover:underline">
                                                    {meter.meter_number}
                                                </Link></TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <span>{meter.region || "—"}</span>
                                                        <span className="font-bold text-muted-foreground">•</span>
                                                        <span>{meter.district || "—"}</span>
                                                    </div>
                                                </TableCell>


                                                <TableCell>
                                                    <Badge variant={meter.status === "ONLINE" ? "default" : "destructive"}>{meter.status}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {(() => {
                                                        const is1900 = meter.last_reading_time && new Date(meter.last_reading_time).getFullYear() === 1900
                                                        if (!meter.last_reading_time || is1900) {
                                                            return <span className="text-muted-foreground text-xs">Not Available</span>
                                                        }
                                                        return (
                                                            <div>
                                                                <div>{new Date(meter.last_reading_time).toLocaleDateString()}</div>
                                                                <div className="text-xs text-muted-foreground">{new Date(meter.last_reading_time).toLocaleTimeString()}</div>
                                                            </div>
                                                        )
                                                    })()}
                                                </TableCell>
                                                <TableCell>{meter.total_consumption.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh</TableCell>
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
                                                    {meter.last_reading_time && new Date(meter.last_reading_time).getFullYear() === 1900
                                                        ? <span className="text-muted-foreground text-xs">Not Available</span>
                                                        : meter.days_offline > 0 ? meter.days_offline : "-"
                                                    }
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>

                                <div className="mt-4">
                                    <TablePagination
                                        currentPage={statusPage}
                                        totalPages={totalStatusPages}
                                        totalItems={totalStatusItems}
                                        itemsPerPage={statusPerPage}
                                        onPageChange={setStatusPage}
                                    />
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>


            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                            {/* Left: Title */}
                            <div>
                                <CardTitle>Daily Consumption Trend</CardTitle>
                                <CardDescription>
                                    Distribution Transformer consumption by region over selected period
                                </CardDescription>
                            </div>

                            {/* Right: Import / Export toggles */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="show-import"
                                        checked={showImport}
                                        onCheckedChange={(v) => setShowImport(Boolean(v))}
                                    />
                                    <Label htmlFor="show-import" className="text-sm text-green-600">
                                        Import
                                    </Label>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="show-export"
                                        checked={showExport}
                                        onCheckedChange={(v) => setShowExport(Boolean(v))}
                                    />
                                    <Label htmlFor="show-export" className="text-sm text-blue-600">
                                        Export
                                    </Label>
                                </div>
                            </div>
                        </div>

                        {/* Region filter buttons */}
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-muted-foreground mr-2">Filter by Region:</span>
                            {availableRegions.map((region) => {
                                const color = getRegionColor(region)

                                return (
                                    <Button
                                        key={region}
                                        variant={chartSelectedRegions.includes(region) ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => {
                                            setChartSelectedRegions((prev) =>
                                                prev.includes(region)
                                                    ? prev.filter((r) => r !== region)
                                                    : [...prev, region]
                                            )
                                        }}
                                        style={{
                                            backgroundColor: chartSelectedRegions.includes(region)
                                                ? color
                                                : undefined,
                                            borderColor: color,
                                            color: chartSelectedRegions.includes(region) ? "white" : color,
                                        }}
                                    >
                                        {region}
                                    </Button>
                                )
                            })}
                            {chartSelectedRegions.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setChartSelectedRegions([])
                                        setShowImport(false)
                                        setShowExport(false)
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
                    {dailyLoading ? (
                        <Skeleton className="h-[400px] w-full" />
                    ) : (
                        <ChartContainer config={chartConfig} className="h-[400px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={regionalTrendData}>
                                    {/* REMOVED the <defs> section with linearGradient */}

                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis
                                        dataKey="date"
                                        className="text-xs"
                                        tickFormatter={(value) =>
                                            new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                                        }
                                    />
                                    <YAxis className="text-xs" />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    {/*<Legend />*/}
                                    {Object.keys(chartConfig).map((key) => {
                                        const isImport = key.endsWith("_import")
                                        const isExport = key.endsWith("_export")

                                        if ((isImport && !showImport) || (isExport && !showExport)) {
                                            return null
                                        }

                                        // Use solid line for import, dashed for export
                                        const strokeDasharray = isExport ? "5 5" : ""

                                        return (
                                            <Area
                                                key={key}
                                                type="monotone"
                                                dataKey={key}
                                                stroke={chartConfig[key].color}
                                                strokeDasharray={strokeDasharray}
                                                fill="none"
                                                strokeWidth={2}
                                                name={chartConfig[key].label}
                                            />
                                        )
                                    })}
                                </AreaChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    )}
                </CardContent>
            </Card>

            {/* Merged Regional & District Breakdown */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        {/* Left: Title + Description */}
                        <div className="flex-1">
                            <CardTitle>Regional & District Breakdown</CardTitle>
                            <CardDescription>
                                Hierarchical DTX meter distribution: Region → District → Meter
                            </CardDescription>
                        </div>

                        {/* Right: Filter */}
                        <div className="ml-auto flex items-center gap-2">
                            <Input
                                placeholder="Filter by meter number..."
                                value={breakdownMeterFilter}
                                onChange={(e) => setBreakdownMeterFilter(e.target.value)}
                                className="w-[220px]"
                            />

                            {breakdownMeterFilter && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setBreakdownMeterFilter("")}
                                    className="text-muted-foreground"
                                >
                                    Clear
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>

                <CardContent>
                    {aggregateLoading || dailyLoading ? (
                        <div className="space-y-3">
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : hierarchicalBreakdown.size === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground">
                                {breakdownMeterFilter
                                    ? `No meters found matching "${breakdownMeterFilter}"`
                                    : "No data available"}
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[300px]">Region / District / Meter</TableHead>
                                    <TableHead className="text-right text-green-600">Import (kWh)</TableHead>
                                    <TableHead className="text-right text-blue-600">Export (kWh)</TableHead>
                                    <TableHead className="text-right">Net (kWh)</TableHead>
                                    <TableHead className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleBreakdownDateSort}
                                            className="h-8 px-2 -mr-2"
                                        >
                                            Date
                                            <ArrowUpDown className="ml-2 h-4 w-4" />
                                        </Button>
                                    </TableHead>
                                    <TableHead className="text-right">Count</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Array.from(hierarchicalBreakdown.entries())
                                    .sort((a, b) => a[0].localeCompare(b[0]))
                                    .map(([regionName, districtMap]) => {
                                        const isRegionExpanded = expandedRegions.has(regionName)

                                        // Calculate region totals
                                        let regionImport = 0
                                        let regionExport = 0
                                        let regionMeterCount = 0

                                        districtMap.forEach((meters) => {
                                            meters.forEach((meter) => {
                                                regionImport += meter.import_kwh || 0
                                                regionExport += meter.export_kwh || 0
                                                regionMeterCount++
                                            })
                                        })

                                        const regionNet = regionImport - regionExport

                                        return (
                                            <>
                                                {/* REGION ROW */}
                                                <TableRow
                                                    key={regionName}
                                                    className="cursor-pointer hover:bg-muted/50 font-semibold bg-muted/30"
                                                    onClick={() => toggleRegionExpansion(regionName)}
                                                >
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <ChevronRight
                                                                className={`h-4 w-4 transition-transform ${isRegionExpanded ? 'rotate-90' : ''}`}
                                                            />
                                                            {/*<Link*/}
                                                            {/*    href={`/meters/region/${encodeURIComponent(regionName)}`}*/}
                                                            {/*    className="text-blue-600 hover:underline"*/}
                                                            {/*    onClick={(e) => e.stopPropagation()}*/}
                                                            {/*>*/}
                                                            {/*    {regionName}*/}
                                                            {/*</Link>*/}
                                                            {regionName}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right text-green-600">
                                                        {regionImport.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell className="text-right text-blue-600">
                                                        {regionExport.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold text-orange-600">
                                                        {regionNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell className="text-right text-muted-foreground">
                                                        -
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge variant="outline">{regionMeterCount} readings</Badge>
                                                    </TableCell>
                                                </TableRow>

                                                {/* DISTRICT ROWS */}
                                                {isRegionExpanded && Array.from(districtMap.entries())
                                                    .sort((a, b) => a[0].localeCompare(b[0]))
                                                    .map(([districtName, meters]) => {
                                                        const districtKey = `${regionName}-${districtName}`
                                                        const isDistrictExpanded = expandedMeterGroups.has(districtKey)

                                                        // Calculate district totals
                                                        let districtImport = 0
                                                        let districtExport = 0

                                                        meters.forEach((meter) => {
                                                            districtImport += meter.import_kwh || 0
                                                            districtExport += meter.export_kwh || 0
                                                        })

                                                        const districtNet = districtImport - districtExport

                                                        return (
                                                            <>
                                                                <TableRow
                                                                    key={districtKey}
                                                                    className="cursor-pointer hover:bg-muted/50 bg-muted/20"
                                                                    onClick={() => toggleMeterGroup(districtKey)}
                                                                >
                                                                    <TableCell className="pl-8">
                                                                        <div className="flex items-center gap-2">
                                                                            <ChevronRight
                                                                                className={`h-4 w-4 transition-transform ${isDistrictExpanded ? 'rotate-90' : ''}`}
                                                                            />
                                                                            <span className="font-medium">{districtName}</span>
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="text-right text-green-600">
                                                                        {districtImport.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </TableCell>
                                                                    <TableCell className="text-right text-blue-600">
                                                                        {districtExport.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-medium text-orange-600">
                                                                        {districtNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </TableCell>
                                                                    <TableCell className="text-right text-muted-foreground">
                                                                        -
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        <Badge variant="outline">{meters.length} readings</Badge>
                                                                    </TableCell>
                                                                </TableRow>

                                                                {/* METER ROWS */}
                                                                {isDistrictExpanded && meters
                                                                    .sort((a, b) => {
                                                                        // Sort by date
                                                                        const aDate = a.consumption_date ? new Date(a.consumption_date).getTime() : 0
                                                                        const bDate = b.consumption_date ? new Date(b.consumption_date).getTime() : 0
                                                                        return breakdownDateSort === "asc" ? aDate - bDate : bDate - aDate
                                                                    })
                                                                    .map((meter, idx) => {
                                                                        const meterImport = meter.import_kwh || 0
                                                                        const meterExport = meter.export_kwh || 0
                                                                        const meterNet = meterImport - meterExport
                                                                        const date = meter.consumption_date
                                                                            ? new Date(meter.consumption_date).toLocaleDateString()
                                                                            : "N/A"

                                                                        return (
                                                                            <TableRow key={`${meter.meter_number}-${idx}`} className="text-sm">
                                                                                <TableCell className="pl-16 ml-5 font-mono text-xs">

                                                                                    <Link href={`/meters/${meter.meter_number}`} className="hover:text-blue-200 hover:underline">
                                                                                        {meter.meter_number}
                                                                                    </Link>
                                                                                </TableCell>
                                                                                <TableCell className="text-right text-green-600">
                                                                                    {meterImport > 0 ? meterImport.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                                                                                </TableCell>
                                                                                <TableCell className="text-right text-blue-600">
                                                                                    {meterExport > 0 ? meterExport.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                                                                                </TableCell>
                                                                                <TableCell className="text-right font-semibold">
                                                                                    {meterNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                </TableCell>
                                                                                <TableCell className="text-right text-muted-foreground">
                                                                                    {date}
                                                                                </TableCell>
                                                                                <TableCell className="text-right">
                                                                                    -
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        )
                                                                    })}
                                                            </>
                                                        )
                                                    })}
                                            </>
                                        )
                                    })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>


        </div>
    )
}
