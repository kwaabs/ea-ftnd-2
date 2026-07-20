"use client"

import { useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { ExportButton } from "@/components/ui/export-button"

import { useDtxAggregate, useDtxDaily } from "@/hooks/api/use-dtx-api"
import { useDistrictBoundaryAggregate, useDistrictBoundaryDaily } from "@/hooks/api/use-district-boundary-api"
import { useDistrictGeometry, useDistrictsByRegion } from "@/hooks/api/use-districts-geometry-api"
import { useMeters } from "@/hooks/api/use-meter-api"
import { useMeterStatusSummary, useStatusTimeline, useMeterStatusDetails } from "@/hooks/api/use-meter-status-api"
import { useAppStore } from "@/stores/app-store"
import { formatNumber } from "@/lib/utils"
import {
    ArrowLeft,
    ChevronDown,
    ChevronRight,
    TrendingDown,
    TrendingUp,
    Zap,
    Building2,
    ArrowRightLeft,
    MapPin,
    Activity,
    Trophy,
    AlertTriangle,
    Calendar,
} from "lucide-react"
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts"
import { format, parseISO } from "date-fns"
import Link from "next/link"
import React from "react"
import { DistrictMiniMap } from "./district-mini-map"

interface DistrictDetailProps {
    district: string
}

export function DistrictDetail({ district }: DistrictDetailProps) {
    const { filters } = useAppStore()
    const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(new Set(["dtx"]))
    const [cumulateMetrics, setCumulateMetrics] = useState(false)
    const [metricsDropdownOpen, setMetricsDropdownOpen] = useState(false)
    const trendChartRef = useRef<HTMLDivElement>(null)
    const healthChartRef = useRef<HTMLDivElement>(null)

    const METRIC_OPTIONS = [
        { key: "dtx", label: "DTX", color: "#3b82f6" },
        { key: "boundaryImport", label: "Import", color: "#16a34a" },
        { key: "boundaryExport", label: "Export", color: "#ea580c" },
        { key: "net", label: "Net Supply", color: "#8b5cf6" },
    ]

    const toggleMetric = (key: string) => {
        setSelectedMetrics(prev => {
            const next = new Set(prev)
            if (next.has(key) && next.size === 1) return prev // keep at least one
            if (next.has(key)) { next.delete(key) } else { next.add(key) }
            if (next.size < 2) setCumulateMetrics(false)
            return next
        })
    }
    const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set())
    const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all")
    const [performanceView, setPerformanceView] = useState<"top" | "attention" | "all">("top")
    const [datePreset, setDatePreset] = useState<"7d" | "30d" | "90d" | "custom">("30d")

    const dateRange = useMemo(() => {
        const formatDateToString = (date: Date | string | undefined, fallback: string): string => {
            if (!date) return fallback
            if (date instanceof Date) {
                return date.toISOString().split("T")[0]
            }
            if (typeof date === "string") {
                return date.includes("T") ? date.split("T")[0] : date
            }
            return fallback
        }

        const defaultStart = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0]
        const defaultEnd = new Date().toISOString().split("T")[0]

        return {
            start: formatDateToString(filters.dateRange?.start, defaultStart),
            end: formatDateToString(filters.dateRange?.end, defaultEnd),
        }
    }, [filters.dateRange])

    // Fetch THIS district's geometry to get its parent region
    const { data: districtGeo, isLoading: districtGeoLoading } = useDistrictGeometry(district)
    const parentRegion = districtGeo?.data?.districts?.[0]?.region

    // Fetch DTX consumption (meters IN this district)
    const { data: dtxAggregate, isLoading: dtxAggregateLoading } = useDtxAggregate({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        districts: [district],
        meterTypes: ["DTX"],
    })

    const { data: dtxDaily, isLoading: dtxDailyLoading } = useDtxDaily({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        districts: [district],
    })

    // Fetch DISTRICT_BOUNDARY data to find imports/exports
    const { data: boundaryAggregate, isLoading: boundaryAggregateLoading } = useDistrictBoundaryAggregate({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
    })

    const { data: boundaryDaily, isLoading: boundaryDailyLoading } = useDistrictBoundaryDaily({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
    })

    // Fetch related districts in the same region
    const { data: relatedDistrictsData, isLoading: relatedDistrictsLoading } = useDistrictsByRegion(parentRegion || "")

    // Fetch all DTX meters in this district
    const { data: dtxMetersData, isLoading: dtxMetersLoading } = useMeters({
        district: district,
        meter_type: "DTX",
        limit: 5000,
    })

    // Calculate boundary metering points that involve this district
    const relevantBoundaryPoints = useMemo(() => {
        if (!boundaryAggregate?.byBoundaryPoint) return []

        return boundaryAggregate.byBoundaryPoint
            .map((bp: any) => bp.boundaryPoint)
            .filter((bmp: string) => {
                const parts = bmp.split("/").map((p: string) => p.trim())
                return parts.length === 2 && (parts[0] === district || parts[1] === district)
            })
    }, [boundaryAggregate, district])

    // Fetch DISTRICT_BOUNDARY meters for this district (for map display)
    const { data: boundaryMetersData, isLoading: boundaryMetersLoading } = useMeters({
        meter_type: "DISTRICT_BOUNDARY",
        boundary_metering_points: relevantBoundaryPoints,
        limit: 5000,
    })

    // Fetch meter status data for DTX meters in this district
    const { data: dtxStatusSummary } = useMeterStatusSummary({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        districts: [district],
        meterTypes: ["DTX"],
    })

    const { data: dtxStatusTimeline } = useStatusTimeline({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        districts: [district],
        meterTypes: ["DTX"],
    })

    const { data: dtxStatusDetails } = useMeterStatusDetails({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        districts: [district],
        meterTypes: ["DTX"],
        limit: 10,
    })

    // Fetch meter status data for DISTRICT_BOUNDARY meters at this district
    // Only fetch if we have relevant boundary points
    const shouldFetchBoundaryStatus = relevantBoundaryPoints.length > 0

    const { data: boundaryStatusSummary } = useMeterStatusSummary({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        boundaryMeteringPoints: relevantBoundaryPoints,
        meterTypes: ["DISTRICT_BOUNDARY"],
        enabled: shouldFetchBoundaryStatus,
    } as any)

    const { data: boundaryStatusTimeline } = useStatusTimeline({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        boundaryMeteringPoints: relevantBoundaryPoints,
        meterTypes: ["DISTRICT_BOUNDARY"],
        enabled: shouldFetchBoundaryStatus,
    } as any)

    const { data: boundaryStatusDetails } = useMeterStatusDetails({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        boundaryMeteringPoints: relevantBoundaryPoints,
        meterTypes: ["DISTRICT_BOUNDARY"],
        limit: 10,
        enabled: shouldFetchBoundaryStatus,
    } as any)

    // Combine DTX and boundary status data (only if we have relevant boundary points)
    const statusSummary = useMemo(() => {
        if (!dtxStatusSummary) return null

        // Only include boundary data if we have relevant boundary points
        if (!shouldFetchBoundaryStatus || !boundaryStatusSummary) {
            return dtxStatusSummary
        }

        const dtx = dtxStatusSummary
        const boundary = boundaryStatusSummary

        const total = dtx.total + boundary.total
        const online = dtx.online + boundary.online
        const offline_no_data = dtx.offline_no_data + boundary.offline_no_data
        const offline_no_record = dtx.offline_no_record + boundary.offline_no_record

        return {
            total,
            online,
            offline_no_data,
            offline_no_record,
            total_offline: offline_no_data + offline_no_record,
            online_percentage: total > 0 ? (online / total) * 100 : 0,
            offline_percentage: total > 0 ? ((offline_no_data + offline_no_record) / total) * 100 : 0,
            avg_uptime_percentage: total > 0 ? ((dtx.avg_uptime_percentage * dtx.total) + (boundary.avg_uptime_percentage * boundary.total)) / total : 0,
            total_consumption_kwh: dtx.total_consumption_kwh + boundary.total_consumption_kwh,
        }
    }, [dtxStatusSummary, boundaryStatusSummary, shouldFetchBoundaryStatus])

    const statusTimeline = useMemo(() => {
        if (!dtxStatusTimeline) return null

        // Only merge boundary data if we have relevant boundary points
        if (!shouldFetchBoundaryStatus || !boundaryStatusTimeline) {
            return dtxStatusTimeline
        }

        const dtxData = dtxStatusTimeline
        const boundaryData = boundaryStatusTimeline

        // Merge by date
        const dateMap = new Map()

        dtxData.forEach((d: any) => {
            dateMap.set(d.date, { date: d.date, online: d.online, offline: d.offline })
        })

        boundaryData.forEach((d: any) => {
            if (dateMap.has(d.date)) {
                const existing = dateMap.get(d.date)
                existing.online += d.online
                existing.offline += d.offline
            } else {
                dateMap.set(d.date, { date: d.date, online: d.online, offline: d.offline })
            }
        })

        return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date))
    }, [dtxStatusTimeline, boundaryStatusTimeline, shouldFetchBoundaryStatus])

    const statusDetails = useMemo(() => {
        if (!dtxStatusDetails) return null

        const dtxData = dtxStatusDetails?.data || []

        // Only include boundary data if we have relevant boundary points
        if (!shouldFetchBoundaryStatus || !boundaryStatusDetails) {
            return dtxStatusDetails
        }

        const boundaryData = boundaryStatusDetails?.data || []

        return {
            data: [...dtxData, ...boundaryData].sort((a: any, b: any) => (a.uptime_percentage || 0) - (b.uptime_percentage || 0)),
            pagination: dtxStatusDetails?.pagination || { page: 1, limit: 10, total: 0, total_pages: 1 }
        }
    }, [dtxStatusDetails, boundaryStatusDetails, shouldFetchBoundaryStatus])

    // Fetch all districts DTX data for ranking
    const { data: allDistrictsAggregate } = useDtxAggregate({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        meterTypes: ["DTX"],
    })

    // Parse boundary points to find imports/exports for this district
    const boundaryExchanges = useMemo(() => {
        if (!boundaryAggregate?.byBoundaryPoint) return { imports: [], exports: [], totalImport: 0, totalExport: 0 }

        const imports: { from: string; import: number; export: number }[] = []
        const exports: { to: string; import: number; export: number }[] = []

        boundaryAggregate.byBoundaryPoint.forEach((bp: any) => {
            const bmp = bp.boundaryPoint || ""
            const parts = bmp.split("/").map((p: string) => p.trim())

            if (parts.length === 2) {
                const [district1, district2] = parts

                // If this district is the first part, it's importing FROM district2
                if (district1 === district) {
                    imports.push({
                        from: district2,
                        import: bp.importKwh || 0,
                        export: bp.exportKwh || 0,
                    })
                }
                // If this district is the second part, it's exporting TO district1
                else if (district2 === district) {
                    exports.push({
                        to: district1,
                        import: bp.exportKwh || 0,
                        export: bp.importKwh || 0,
                    })
                }
            }
        })

        const totalImport = imports.reduce((sum, i) => sum + i.import, 0)
        const totalExport = exports.reduce((sum, e) => sum + e.export, 0)

        return { imports, exports, totalImport, totalExport }
    }, [boundaryAggregate, district])

    // Get related districts from region API + boundary partners
    const relatedDistricts = useMemo(() => {
        const districtsInSameRegion = relatedDistrictsData?.data?.districts || []

        // Get districts that share boundary points (e.g., Achimota/Legon means Legon is related to Achimota)
        const boundaryPartners: string[] = []
        if (boundaryAggregate?.byBoundaryPoint) {
            boundaryAggregate.byBoundaryPoint.forEach((bp: any) => {
                const parts = bp.boundaryPoint.split("/").map((p: string) => p.trim())
                if (parts.length === 2) {
                    // If this district is in the boundary point, the other part is a partner
                    if (parts[0] === district) {
                        boundaryPartners.push(parts[1])
                    } else if (parts[1] === district) {
                        boundaryPartners.push(parts[0])
                    }
                }
            })
        }

        // Combine districts from same region and boundary partners
        const allRelated = new Map()

        // Add districts from same region
        districtsInSameRegion.forEach((d) => {
            if (d.district.toLowerCase() !== district.toLowerCase()) {
                allRelated.set(d.district, d)
            }
        })

        // Add boundary partners (create district objects for them)
        boundaryPartners.forEach((partnerName) => {
            if (partnerName.toLowerCase() !== district.toLowerCase() && !allRelated.has(partnerName)) {
                allRelated.set(partnerName, { district: partnerName, region: "Via Boundary" })
            }
        })

        return Array.from(allRelated.values())
    }, [relatedDistrictsData, district, boundaryAggregate])

    // Get unique DTX meter count
    const totalDtxMeters = useMemo(() => {
        if (!dtxMetersData?.data?.data) return 0
        const uniqueMeters = new Set(dtxMetersData.data.data.map((m: any) => m.meter_number))
        return uniqueMeters.size
    }, [dtxMetersData])

    // Get unique boundary meter count (filtered to this district only)
    const boundaryMeterCount = useMemo(() => {
        if (!boundaryMetersData?.data?.data) return 0

        console.log("[v0] District Boundary Meters - Raw API data count:", boundaryMetersData.data.data.length)

        // Filter to only meters where boundary_metering_point contains this district
        const filteredMeters = boundaryMetersData.data.data.filter((m: any) => {
            const boundaryPoint = m.boundary_metering_point || ""
            const parts = boundaryPoint.split("/").map((p: string) => p.trim())
            return parts.some((part: string) => part.toLowerCase() === district.toLowerCase())
        })

        console.log("[v0] District Boundary Meters - After filtering by district:", filteredMeters.length)

        const uniqueMeters = new Set(filteredMeters.map((m: any) => m.meter_number))

        console.log("[v0] District Boundary Meters - Unique count for this district:", uniqueMeters.size)
        console.log("[v0] District Boundary Meters - Duplicate count:", filteredMeters.length - uniqueMeters.size)

        // Show sample of boundary points
        const sampleBoundaryPoints = new Set(
            filteredMeters.slice(0, 10).map((m: any) => m.boundary_metering_point)
        )
        console.log("[v0] Sample boundary metering points (first 10 meters):", Array.from(sampleBoundaryPoints))

        return uniqueMeters.size
    }, [boundaryMetersData, district])

    // Extract meter coordinates for map display
    const meterCoordinates = useMemo(() => {
        const coords: Array<{ lat: number; lng: number; type: string; meter_number: string; brand?: string }> = []

        // Add DTX meters
        if (dtxMetersData?.data?.data) {
            dtxMetersData.data.data.forEach((meter: any) => {
                if (meter.latitude && meter.longitude) {
                    coords.push({
                        lat: meter.latitude,
                        lng: meter.longitude,
                        type: 'DTX',
                        meter_number: meter.meter_number,
                        brand: meter.meter_brand,
                    })
                }
            })
        }

        // Add DISTRICT_BOUNDARY meters (filtered to this district only)
        if (boundaryMetersData?.data?.data) {
            boundaryMetersData.data.data.forEach((meter: any) => {
                // Client-side filter: only include meters where boundary_metering_point contains this district
                const boundaryPoint = meter.boundary_metering_point || ""
                const parts = boundaryPoint.split("/").map((p: string) => p.trim())
                const belongsToDistrict = parts.some((part: string) => part.toLowerCase() === district.toLowerCase())

                if (!belongsToDistrict) {
                    return // Skip this meter - it belongs to the other district in the boundary
                }

                if (meter.latitude && meter.longitude) {
                    coords.push({
                        lat: meter.latitude,
                        lng: meter.longitude,
                        type: 'DISTRICT_BOUNDARY',
                        meter_number: meter.meter_number,
                        brand: meter.meter_brand,
                    })
                }
            })
        }

        return coords
    }, [dtxMetersData, boundaryMetersData])

    // Create meter lookup map from useMeters data to get brand and other details
    const meterLookup = useMemo(() => {
        const lookup = new Map()
        if (dtxMetersData?.data?.data) {
            dtxMetersData.data.data.forEach((meter: any) => {
                lookup.set(meter.meter_number, {
                    brand: meter.meter_brand,
                    location: meter.location || meter.station,
                    district: meter.district,
                })
            })
        }
        // Add boundary meters to lookup
        if (boundaryMetersData?.data?.data) {
            boundaryMetersData.data.data.forEach((meter: any) => {
                lookup.set(meter.meter_number, {
                    brand: meter.meter_brand,
                    location: meter.location || meter.station,
                    boundary_metering_point: meter.boundary_metering_point,
                })
            })
        }
        return lookup
    }, [dtxMetersData, boundaryMetersData])

    // Get all DTX meters for this district (client-side filtered)
    const allDtxMeters = useMemo(() => {
        if (!dtxMetersData?.data?.data) return []

        // Client-side filter: ensure meters belong to this district
        return dtxMetersData.data.data
            .filter((meter: any) => {
                const meterDistrict = meter.district || ""
                return meterDistrict.toLowerCase() === district.toLowerCase()
            })
            .map((meter: any) => ({
                meter: meter.meter_number,
                location: meter.location || meter.station || "Unknown",
                meter_brand: meter.meter_brand || "Unknown",
                district: meter.district,
                consumption: 0 // Will be populated from consumption data if available
            }))
    }, [dtxMetersData, district])

    // Calculate top/bottom performing DTX meters
    const meterPerformance = useMemo(() => {
        if (!dtxDaily || !Array.isArray(dtxDaily)) return { top: [], bottom: [], all: [] }

        const meterMap = new Map<string, { meter: string; consumption: number; location: string; meter_brand: string; }>()

        dtxDaily.forEach((record: any) => {
            const meter = record.meter_number
            if (!meter) return

            if (!meterMap.has(meter)) {
                // Get meter details from meterLookup (from useMeters hook)
                const meterDetails = meterLookup.get(meter)

                meterMap.set(meter, {
                    meter,
                    consumption: 0,
                    location: meterDetails?.location || record.location || record.station || "Unknown",
                    meter_brand: meterDetails?.brand || "Unknown"
                })
            }

            if (record.system_name === "import_kwh") {
                meterMap.get(meter)!.consumption += record.consumed_energy || 0
            }
        })

        const meters = Array.from(meterMap.values())
        const sorted = meters.sort((a, b) => b.consumption - a.consumption)

        return {
            top: sorted.slice(0, 5),
            bottom: sorted.slice(-5).reverse(),
            all: sorted,
        }
    }, [dtxDaily, meterLookup])

    // Calculate district ranking
    const districtRanking = useMemo(() => {
        if (!allDistrictsAggregate?.byDistrict) return null

        const districts = allDistrictsAggregate.byDistrict
            .map((d: any) => ({
                district: d.district,
                consumption: d.importKwh || 0,
                meters: d.activeMeters || 0,
            }))
            .sort((a, b) => b.consumption - a.consumption)

        const currentIndex = districts.findIndex((d) => d.district === district)
        const currentDistrict = districts[currentIndex]

        return {
            rank: currentIndex + 1,
            total: districts.length,
            consumption: currentDistrict?.consumption || 0,
            percentile: ((districts.length - currentIndex) / districts.length) * 100,
            topDistricts: districts.slice(0, 5),
        }
    }, [allDistrictsAggregate, district])

    // Prepare daily chart data
    const chartData = useMemo(() => {
        const dateMap = new Map<string, any>()

        // Add DTX data
        if (dtxDaily && Array.isArray(dtxDaily)) {
            dtxDaily.forEach((record: any) => {
                const date = record.consumption_date?.split("T")[0]
                if (!date) return

                if (!dateMap.has(date)) {
                    dateMap.set(date, { date, dtx: 0, boundaryImport: 0, boundaryExport: 0 })
                }

                const day = dateMap.get(date)!
                if (record.system_name === "import_kwh") {
                    day.dtx += record.consumed_energy || 0
                }
            })
        }

        // Add boundary data
        if (boundaryDaily && Array.isArray(boundaryDaily)) {
            boundaryDaily.forEach((record: any) => {
                const date = record.consumption_date?.split("T")[0]
                if (!date) return

                if (!dateMap.has(date)) {
                    dateMap.set(date, { date, dtx: 0, boundaryImport: 0, boundaryExport: 0 })
                }

                const day = dateMap.get(date)!
                const bmp = record.boundary_metering_point || ""
                const parts = bmp.split("/").map((p: string) => p.trim())

                if (parts.length === 2) {
                    const [district1, district2] = parts

                    if (district1 === district && record.system_name === "import_kwh") {
                        day.boundaryImport += record.consumed_energy || 0
                    } else if (district2 === district && record.system_name === "import_kwh") {
                        day.boundaryExport += record.consumed_energy || 0
                    }
                }
            })
        }

        return Array.from(dateMap.values())
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((d) => ({
                ...d,
                net: d.dtx + d.boundaryImport - d.boundaryExport,
            }))
    }, [dtxDaily, boundaryDaily, district])

    const totalDtxConsumption = dtxAggregate?.totalImportKwh || 0
    const totalBoundaryImport = boundaryExchanges.totalImport
    const totalBoundaryExport = boundaryExchanges.totalExport
    const availableSupply = totalDtxConsumption + totalBoundaryImport - totalBoundaryExport

    const exportSlug = district.replace(/\s+/g, "-").toLowerCase()

    const exportDatasets = useMemo(() => {
        const summary = [
            { metric: "DTX Consumption", value_kwh: totalDtxConsumption, meters: totalDtxMeters },
            { metric: "Boundary Import", value_kwh: totalBoundaryImport },
            { metric: "Boundary Export", value_kwh: totalBoundaryExport },
            { metric: "Available Supply", value_kwh: availableSupply },
            { metric: "DTX Meters", value_kwh: totalDtxMeters },
            { metric: "Boundary Meters", value_kwh: boundaryMeterCount },
        ]

        const dailyTrend = chartData.map((d) => ({
            date: d.date,
            dtx_kwh: d.dtx,
            boundary_import_kwh: d.boundaryImport,
            boundary_export_kwh: d.boundaryExport,
            net_kwh: d.net,
        }))

        const boundaryImports = boundaryExchanges.imports.map((imp) => ({
            direction: "import",
            partner: imp.from,
            import_kwh: imp.import,
            export_kwh: imp.export,
        }))

        const boundaryExports = boundaryExchanges.exports.map((exp) => ({
            direction: "export",
            partner: exp.to,
            import_kwh: exp.import,
            export_kwh: exp.export,
        }))

        const meterPerf = meterPerformance.all.map((m) => ({
            meter: m.meter,
            location: m.location,
            meter_brand: m.meter_brand,
            consumption_kwh: m.consumption,
        }))

        const ranking = (districtRanking?.topDistricts || []).map((d, idx) => ({
            rank: idx + 1,
            district: d.district,
            consumption_kwh: d.consumption,
            meters: d.meters,
            is_current: d.district === district,
        }))

        const healthTimeline = (statusTimeline || []).map((d: any) => ({
            date: d.date,
            online: d.online,
            offline: d.offline,
        }))

        return {
            summary,
            dailyTrend,
            boundaryAll: [...boundaryImports, ...boundaryExports],
            meterPerf,
            ranking,
            healthTimeline,
        }
    }, [
        totalDtxConsumption,
        totalBoundaryImport,
        totalBoundaryExport,
        availableSupply,
        totalDtxMeters,
        boundaryMeterCount,
        chartData,
        boundaryExchanges,
        meterPerformance,
        districtRanking,
        district,
        statusTimeline,
    ])

    const isLoading = dtxAggregateLoading || dtxDailyLoading || boundaryAggregateLoading || boundaryDailyLoading

    if (isLoading) {
        return (
            <div className="space-y-6 pb-16">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-9 w-9 rounded-md" />
                            <Skeleton className="h-9 w-48" />
                        </div>
                        <Skeleton className="h-4 w-64" />
                    </div>
                </div>

                {/* 4 summary metric cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i}>
                            <CardHeader className="pb-3">
                                <Skeleton className="h-4 w-32" />
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Skeleton className="h-9 w-40" />
                                <Skeleton className="h-3 w-24" />
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Map + chart row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-5 w-32" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-64 w-full rounded-md" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-5 w-40" />
                            <Skeleton className="h-4 w-56" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-64 w-full rounded-md" />
                        </CardContent>
                    </Card>
                </div>

                {/* Meters table card */}
                <Card>
                    <CardHeader>
                        <Skeleton className="h-5 w-36" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Skeleton key={i} className="h-10 w-full rounded-md" />
                        ))}
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-16">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <div className="flex items-center gap-3 mb-2">

                        {parentRegion && (
                            <Link href={`/regions/${encodeURIComponent(parentRegion)}`}>
                                <Button variant="ghost" size="icon">
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                            </Link>
                        )}
                        <h1 className="text-3xl font-bold">{district}</h1>
                    </div>
                    <p className="text-muted-foreground">District overview and consumption analysis</p>
                </div>
                <ExportButton
                    data={exportDatasets.summary}
                    filename={`${exportSlug}-summary`}
                />
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Zap className="h-4 w-4 text-blue-600" />
                            DTX Consumption
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-10 w-32" />
                        ) : (
                            <>
                                <div className="text-3xl font-bold">{formatNumber(totalDtxConsumption)} kWh</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {totalDtxMeters} DTX meters
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-green-600" />
                            Boundary Import
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-10 w-32" />
                        ) : (
                            <>
                                <div className="text-3xl font-bold text-green-600">
                                    {formatNumber(totalBoundaryImport)} kWh
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">From other districts</p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <TrendingDown className="h-4 w-4 text-orange-600" />
                            Boundary Export
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-10 w-32" />
                        ) : (
                            <>
                                <div className="text-3xl font-bold text-orange-600">
                                    {formatNumber(totalBoundaryExport)} kWh
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">To other districts</p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-purple-600" />
                            Available Supply
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-10 w-32" />
                        ) : (
                            <>
                                <div className="text-3xl font-bold">{formatNumber(availableSupply)} kWh</div>
                                <p className="text-xs text-muted-foreground mt-1">Net available energy</p>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* District Profile & Map */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* District Profile */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5" />
                            District Profile
                        </CardTitle>
                        <CardDescription>Meter infrastructure and coverage details</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {/* Region Info */}
                            {parentRegion && (
                                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">Parent Region</span>
                                    </div>
                                    <Link href={`/regions/${encodeURIComponent(parentRegion)}`} className="text-sm text-primary hover:underline">
                                        {parentRegion}
                                    </Link>
                                </div>
                            )}

                            {/* Meter Counts */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                    <div>
                                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">DTX Meters</p>
                                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Distribution transformers in this district</p>
                                    </div>
                                    <div className="text-3xl font-bold text-blue-600">{totalDtxMeters}</div>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                                    <div>
                                        <p className="text-sm font-medium text-purple-900 dark:text-purple-100">District Boundary Meters</p>
                                        <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                                            Meters at boundaries involving this district
                                        </p>
                                    </div>
                                    <div className="text-3xl font-bold text-purple-600">{boundaryMeterCount}</div>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
                                    <div>
                                        <p className="text-sm font-medium">Total Meters</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Combined infrastructure</p>
                                    </div>
                                    <div className="text-3xl font-bold">{totalDtxMeters + boundaryMeterCount}</div>
                                </div>
                            </div>

                            {/* Boundary Points */}
                            {relevantBoundaryPoints.length > 0 && (
                                <div className="pt-3 border-t">
                                    <p className="text-sm font-medium mb-2">Connected Districts</p>
                                    <div className="flex flex-wrap gap-2">
                                        {relevantBoundaryPoints.map((bp) => (
                                            <Badge key={bp} variant="outline" className="text-xs">
                                                {bp}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* District Map */}
                <DistrictMiniMap
                    districtName={district}
                    geometry={districtGeo?.data?.districts?.[0]?.geojson?.geometry}
                    meterCoordinates={meterCoordinates}
                />
            </div>

            {/* Meter Health Dashboard - MOVED UP */}
            {statusSummary && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Activity className="h-5 w-5" />
                                    Meter Health Status
                                </CardTitle>
                                <CardDescription>Real-time monitoring of all meters in this district</CardDescription>
                            </div>
                            <ExportButton
                                data={exportDatasets.healthTimeline}
                                filename={`${exportSlug}-meter-health`}
                                chartRef={healthChartRef}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div ref={healthChartRef}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            {/* Visual Health Indicator */}
                            <div className="flex items-center gap-6">
                                <div className="relative">
                                    <svg className="w-32 h-32 transform -rotate-90">
                                        <circle
                                            cx="64"
                                            cy="64"
                                            r="56"
                                            stroke="currentColor"
                                            strokeWidth="12"
                                            fill="none"
                                            className="text-gray-200"
                                        />
                                        <circle
                                            cx="64"
                                            cy="64"
                                            r="56"
                                            stroke="currentColor"
                                            strokeWidth="12"
                                            fill="none"
                                            strokeDasharray={`${2 * Math.PI * 56}`}
                                            strokeDashoffset={`${2 * Math.PI * 56 * (1 - (statusSummary.online_percentage / 100))}`}
                                            className="text-green-600 transition-all duration-1000"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-green-600">
                                                {statusSummary.online_percentage.toFixed(0)}%
                                            </div>
                                            <div className="text-xs text-muted-foreground">Online</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full bg-green-500" />
                                        <div>
                                            <p className="text-sm font-medium">Online: {statusSummary.online}</p>
                                            <p className="text-xs text-muted-foreground">{statusSummary.online_percentage.toFixed(1)}%</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full bg-orange-500" />
                                        <div>
                                            <p className="text-sm font-medium">No Data: {statusSummary.offline_no_data}</p>
                                            <p className="text-xs text-muted-foreground">Missing recent readings</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full bg-red-500" />
                                        <div>
                                            <p className="text-sm font-medium">No Record: {statusSummary.offline_no_record}</p>
                                            <p className="text-xs text-muted-foreground">Never reported</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                    <p className="text-sm text-muted-foreground mb-1">Total Online</p>
                                    <p className="text-3xl font-bold text-green-600">{statusSummary.online}</p>
                                </div>
                                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                                    <p className="text-sm text-muted-foreground mb-1">Total Offline</p>
                                    <p className="text-3xl font-bold text-red-600">{statusSummary.total_offline}</p>
                                </div>
                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                    <p className="text-sm text-muted-foreground mb-1">Avg Uptime</p>
                                    <p className="text-3xl font-bold text-blue-600">{statusSummary.avg_uptime_percentage.toFixed(1)}%</p>
                                </div>
                                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                                    <p className="text-sm text-muted-foreground mb-1">Total Meters</p>
                                    <p className="text-3xl font-bold text-purple-600">{statusSummary.total}</p>
                                </div>
                            </div>
                        </div>

                        {/* Status Timeline Chart */}
                        {statusTimeline && statusTimeline.length > 0 && (
                            <div className="mt-6">
                                <h4 className="text-sm font-medium mb-3">Status Timeline</h4>
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={statusTimeline}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis
                                            dataKey="date"
                                            className="text-xs"
                                            tickFormatter={(val) => format(parseISO(val), "MMM dd")}
                                        />
                                        <YAxis className="text-xs" />
                                        <Tooltip
                                            content={({ active, payload }) => {
                                                if (!active || !payload) return null
                                                return (
                                                    <div className="bg-background border rounded-lg shadow-lg p-3">
                                                        <p className="font-medium mb-1 text-sm">
                                                            {format(parseISO(payload[0]?.payload?.date), "MMM dd, yyyy")}
                                                        </p>
                                                        {payload.map((entry) => (
                                                            <div key={entry.name} className="flex items-center justify-between gap-4 text-sm">
                                                                <span style={{ color: entry.fill }}>{entry.name}:</span>
                                                                <span className="font-medium">{entry.value}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )
                                            }}
                                        />
                                        <Legend />
                                        <Bar dataKey="online" stackId="status" fill="hsl(142, 76%, 36%)" name="Online" />
                                        <Bar dataKey="offline" stackId="status" fill="hsl(0, 84%, 60%)" name="Offline" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Consumption Trend */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                            <CardTitle>Consumption Trend</CardTitle>
                            <CardDescription>Daily consumption breakdown over selected period</CardDescription>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <Button variant="outline" size="sm" disabled>
                                <Calendar className="h-4 w-4 mr-2" />
                                {dateRange.start} - {dateRange.end}
                            </Button>
                            <ExportButton
                                data={exportDatasets.dailyTrend}
                                filename={`${exportSlug}-consumption-trend`}
                                chartRef={trendChartRef}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-3 mb-4">
                        {/* Multi-select dropdown */}
                        <div className="relative">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setMetricsDropdownOpen(o => !o)}
                                className="min-w-[160px] justify-between"
                            >
                                <span className="truncate">
                                    {Array.from(selectedMetrics)
                                        .map(k => METRIC_OPTIONS.find(o => o.key === k)?.label)
                                        .join(", ")}
                                </span>
                                <ChevronDown className="h-4 w-4 ml-2 shrink-0" />
                            </Button>
                            {metricsDropdownOpen && (
                                <div className="absolute z-50 top-full mt-1 left-0 bg-background border rounded-md shadow-md p-1 min-w-[160px]">
                                    {METRIC_OPTIONS.map(opt => (
                                        <button
                                            key={opt.key}
                                            onClick={() => toggleMetric(opt.key)}
                                            className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-muted text-left"
                                        >
                                            <div className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 ${selectedMetrics.has(opt.key) ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                                                {selectedMetrics.has(opt.key) && (
                                                    <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <polyline points="1.5,5 4,7.5 8.5,2.5" />
                                                    </svg>
                                                )}
                                            </div>
                                            <span className="flex items-center gap-1.5">
                                                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                                                {opt.label}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Cumulate checkbox — only when 2+ metrics selected */}
                        {selectedMetrics.size >= 2 && (
                            <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground border-l pl-3">
                                <input
                                    type="checkbox"
                                    checked={cumulateMetrics}
                                    onChange={e => setCumulateMetrics(e.target.checked)}
                                    className="h-3.5 w-3.5 accent-primary"
                                />
                                Cumulate
                            </label>
                        )}
                    </div>

                    <div ref={trendChartRef}>
                    {(() => {
                        const activeMetrics = METRIC_OPTIONS.filter(o => selectedMetrics.has(o.key))
                        const cumulatedLabel = activeMetrics.map(o => o.label).join(", ")

                        // When cumulating: merge all selected metrics into one "cumulated" key per date
                        const displayData = cumulateMetrics && selectedMetrics.size >= 2
                            ? chartData.map((d: any) => ({
                                ...d,
                                cumulated: activeMetrics.reduce((sum, o) => sum + (d[o.key] || 0), 0),
                            }))
                            : chartData

                        return (
                            <ResponsiveContainer width="100%" height={350}>
                                <AreaChart data={displayData}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis dataKey="date" className="text-xs" tickFormatter={(val) => format(parseISO(val), "MMM dd")} />
                                    <YAxis className="text-xs" />
                                    <Tooltip
                                        content={({ active, payload }) => {
                                            if (!active || !payload || payload.length === 0) return null
                                            const d = payload[0].payload
                                            return (
                                                <div className="bg-background border rounded-lg shadow-lg p-3">
                                                    <p className="font-medium mb-2">{format(parseISO(d.date), "MMM dd, yyyy")}</p>
                                                    <div className="space-y-1 text-sm">
                                                        {cumulateMetrics && selectedMetrics.size >= 2 ? (
                                                            <div className="flex justify-between gap-4">
                                                                <span className="text-muted-foreground truncate max-w-[180px]">{cumulatedLabel}:</span>
                                                                <span className="font-bold">{formatNumber(d.cumulated)} kWh</span>
                                                            </div>
                                                        ) : (
                                                            activeMetrics.map(o => (
                                                                <div key={o.key} className="flex justify-between gap-4">
                                                                    <span style={{ color: o.color }}>{o.label}:</span>
                                                                    <span className="font-medium">{formatNumber(d[o.key])} kWh</span>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        }}
                                    />
                                    <Legend />
                                    {cumulateMetrics && selectedMetrics.size >= 2 ? (
                                        <Area type="monotone" dataKey="cumulated" fill="#3b82f6" stroke="#3b82f6" name={cumulatedLabel} fillOpacity={0.2} />
                                    ) : (
                                        activeMetrics.map(o => (
                                            <Area key={o.key} type="monotone" dataKey={o.key} fill={o.color} stroke={o.color} name={o.label} fillOpacity={0.2} />
                                        ))
                                    )}
                                </AreaChart>
                            </ResponsiveContainer>
                        )
                    })()}
                    </div>
                </CardContent>
            </Card>

            {/* Boundary Exchanges */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-green-600" />
                                    <CardTitle className="text-base">Imports from Other Districts</CardTitle>
                                </div>
                                <CardDescription>Energy received from neighboring districts</CardDescription>
                            </div>
                            <ExportButton
                                data={exportDatasets.boundaryAll.filter((r) => r.direction === "import")}
                                filename={`${exportSlug}-boundary-imports`}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        {boundaryExchanges.imports.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No import data available</p>
                        ) : (
                            <div className="space-y-2">
                                {boundaryExchanges.imports.map((imp) => (
                                    <div key={imp.from} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                        <div>
                                            <p className="font-medium">From {imp.from}</p>
                                            <p className="text-xs text-muted-foreground">
                                                Boundary: {district}/{imp.from}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-green-600">{formatNumber(imp.import)} kWh</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                                <div className="flex items-center gap-2">
                                    <TrendingDown className="h-5 w-5 text-orange-600" />
                                    <CardTitle className="text-base">Exports to Other Districts</CardTitle>
                                </div>
                                <CardDescription>Energy sent to neighboring districts</CardDescription>
                            </div>
                            <ExportButton
                                data={exportDatasets.boundaryAll.filter((r) => r.direction === "export")}
                                filename={`${exportSlug}-boundary-exports`}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        {boundaryExchanges.exports.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No export data available</p>
                        ) : (
                            <div className="space-y-2">
                                {boundaryExchanges.exports.map((exp) => (
                                    <div key={exp.to} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                        <div>
                                            <p className="font-medium">To {exp.to}</p>
                                            <p className="text-xs text-muted-foreground">
                                                Boundary: {exp.to}/{district}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-orange-600">{formatNumber(exp.export)} kWh</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Meter Performance - CONSOLIDATED WITH TABS */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                            <CardTitle>Meter Performance (Distribution Transformers)</CardTitle>
                            <CardDescription>Performance analysis of meters in this district</CardDescription>
                        </div>
                        <ExportButton
                            data={exportDatasets.meterPerf}
                            filename={`${exportSlug}-meter-performance`}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs value={performanceView} onValueChange={(v) => setPerformanceView(v as any)}>
                        <TabsList className="grid w-full grid-cols-3 mb-6">
                            <TabsTrigger value="top" className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                Top Performers
                            </TabsTrigger>
                            <TabsTrigger value="attention" className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                Needs Attention
                            </TabsTrigger>
                            <TabsTrigger value="all">All Meters</TabsTrigger>
                        </TabsList>

                        <TabsContent value="top" className="space-y-3">
                            {meterPerformance.top.length === 0 ? (
                                <p className="text-muted-foreground text-sm">No meter data available</p>
                            ) : (
                                meterPerformance.top.map((meter, idx) => (
                                    <div key={meter.meter} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600 font-bold">
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Link
                                                    href={`/meters/${meter.meter}`}
                                                    className="text-sm font-medium hover:underline text-primary truncate"
                                                >
                                                    {meter.meter}
                                                </Link>
                                                {meter.meter_brand && (
                                                    <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                                                        {meter.meter_brand}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground">{meter.location || meter.district}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-green-600">{formatNumber(meter.consumption)} kWh</p>
                                            <p className="text-xs text-muted-foreground">Total consumption</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </TabsContent>

                        <TabsContent value="attention" className="space-y-3">
                            {!statusDetails?.data || statusDetails.data.length === 0 ? (
                                <p className="text-muted-foreground text-sm">No status data available</p>
                            ) : (
                                statusDetails.data
                                    .filter((m: any) => m.uptime_percentage < 90)
                                    .slice(0, 10)
                                    .map((meter: any, idx: number) => (
                                        <div key={meter.meter_number} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-600 font-bold">
                                                {idx + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Link
                                                        href={`/meters/${meter.meter_number}`}
                                                        className="text-sm font-medium hover:underline text-primary truncate"
                                                    >
                                                        {meter.meter_number}
                                                    </Link>
                                                    {meter.meter_brand && (
                                                        <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                                                            {meter.meter_brand}
                                                        </Badge>
                                                    )}
                                                    {meter.boundary_metering_point && (
                                                        <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                                                            Boundary
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    {meter.location || "Unknown"}{meter.boundary_metering_point ? ` • ${meter.boundary_metering_point}` : ""}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-orange-600">
                                                    {meter.uptime_percentage?.toFixed(1) ?? 0}%
                                                </p>
                                                <p className="text-xs text-muted-foreground">{meter.days_offline ?? 0}d offline</p>
                                            </div>
                                        </div>
                                    ))
                            )}
                        </TabsContent>

                        <TabsContent value="all" className="space-y-3">
                            {allDtxMeters.length === 0 ? (
                                <p className="text-muted-foreground text-sm">No meters found for this district</p>
                            ) : (
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {allDtxMeters.map((meter, idx) => (
                                        <div key={meter.meter} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-medium text-sm">
                                                {idx + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <Link
                                                    href={`/meters/${meter.meter}`}
                                                    className="text-sm font-medium hover:underline text-primary truncate block"
                                                >
                                                    {meter.meter}
                                                </Link>
                                                <p className="text-xs text-muted-foreground">{meter.location}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-muted-foreground">{meter.meter_brand}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* District Performance Ranking */}
            {districtRanking && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                                <div className="flex items-center gap-2">
                                    <Trophy className="h-5 w-5 text-yellow-600"/>
                                    <CardTitle>District Performance Ranking</CardTitle>
                                </div>
                                <CardDescription>How this district compares to others in the region</CardDescription>
                            </div>
                            <ExportButton
                                data={exportDatasets.ranking}
                                filename={`${exportSlug}-district-ranking`}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="text-center p-4 bg-muted rounded-lg">
                                <p className="text-sm text-muted-foreground mb-1">Rank</p>
                                <p className="text-3xl font-bold">
                                    #{districtRanking.rank}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    out of {districtRanking.total} districts
                                </p>
                            </div>
                            <div className="text-center p-4 bg-muted rounded-lg">
                                <p className="text-sm text-muted-foreground mb-1">Consumption</p>
                                <p className="text-3xl font-bold text-blue-600">
                                    {formatNumber(districtRanking.consumption)}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">kWh</p>
                            </div>
                            <div className="text-center p-4 bg-muted rounded-lg">
                                <p className="text-sm text-muted-foreground mb-1">Percentile</p>
                                <p className="text-3xl font-bold text-green-600">
                                    {districtRanking.percentile.toFixed(0)}%
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">top performing</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-sm font-medium mb-2">Top 5 Districts</p>
                            {districtRanking.topDistricts.map((d, idx) => (
                                <div
                                    key={d.district}
                                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                                        d.district === district ? "bg-primary/10 border-primary" : "bg-background hover:bg-muted/50"
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold text-sm">
                                            {idx + 1}
                                        </div>
                                        <Link
                                            href={`/districts/${encodeURIComponent(d.district)}`}
                                            className="font-medium hover:underline text-primary"
                                        >
                                            {d.district}
                                        </Link>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold">{formatNumber(d.consumption)} kWh</p>
                                        <p className="text-xs text-muted-foreground">{d.meters} meters</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Related Districts - MOVED TO BOTTOM */}
            {relatedDistricts.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Related Districts</CardTitle>
                        <CardDescription>
                            {parentRegion ? `Districts in ${parentRegion} or sharing boundary connections` : "Districts sharing boundary connections"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {relatedDistricts.map((d) => {
                                const displayName = d.district.replace(/\s+District$/i, '')
                                return (
                                    <Link key={d.district} href={`/districts/${encodeURIComponent(displayName)}`}>
                                        <Card className="hover:shadow-md transition-all cursor-pointer hover:border-primary">
                                            <CardContent className="p-4">
                                                <p className="font-medium text-sm truncate">{displayName}</p>
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                                    <span>View details</span>
                                                    <ChevronRight className="h-3 w-3" />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
