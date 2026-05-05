"use client"

import { useMemo, useState } from "react"
import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

import {
    useRegionalBoundaryAggregate,
    useRegionalBoundaryDaily,
} from "@/hooks/api/use-regional-boundary-api"
import {
    useDistrictBoundaryAggregate,
    useDistrictBoundaryDaily,
} from "@/hooks/api/use-district-boundary-api"
import { useMeters } from "@/hooks/api/use-meter-api"
import { useMeterStatusSummary, useStatusTimeline, useMeterStatusDetails } from "@/hooks/api/use-meter-status-api"
import { useAppStore } from "@/stores/app-store"
import { formatNumber, toProperCase } from "@/lib/utils"
import {
    ArrowLeft,
    TrendingDown,
    TrendingUp,
    Zap,
    Activity,
    ArrowRightLeft,
    Trophy,
    Percent,
    Globe,
    MapPin,
    ArrowRight,
} from "lucide-react"
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell,
} from "recharts"

interface BoundaryDetailProps {
    boundaryMeteringPoint: string
    type: "REGIONAL_BOUNDARY" | "DISTRICT_BOUNDARY"
}

export function BoundaryDetail({ boundaryMeteringPoint, type }: BoundaryDetailProps) {
    const { filters } = useAppStore()
    const [rankingSort, setRankingSort] = useState<"import" | "export">("import")
    const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all")
    const [statusPage, setStatusPage] = useState(1)
    const [statusSearch, setStatusSearch] = useState("")

    // Use boundary metering point as-is (already decoded in page component)
    const bmpProperCase = boundaryMeteringPoint
    const dateRange = {
        start: filters.dateRange?.start,
        end: filters.dateRange?.end,
    }

    const isRegional = type === "REGIONAL_BOUNDARY"
    const typeLabel = isRegional ? "Regional Boundary" : "District Boundary"
    const baseRoute = isRegional ? "/regional-boundary" : "/district-boundary"

    // Parse the boundary point name into two sides (e.g. "Tema/Accra East" -> ["Tema", "Accra East"])
    const [sideA, sideB] = useMemo(() => {
        const parts = bmpProperCase.split("/")
        return parts.length >= 2 ? [parts[0].trim(), parts.slice(1).join("/").trim()] : [bmpProperCase, ""]
    }, [bmpProperCase])

    // Fetch this boundary point's data
    const useAggregate = isRegional ? useRegionalBoundaryAggregate : useDistrictBoundaryAggregate
    const useDaily = isRegional ? useRegionalBoundaryDaily : useDistrictBoundaryDaily

    const { data: pointData, isLoading: pointLoading } = useAggregate({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        boundaryMeteringPoints: [bmpProperCase],
    })

    const { data: dailyData, isLoading: dailyLoading } = useDaily({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        boundaryMeteringPoints: [bmpProperCase],
    })

    // Fetch meters at this boundary point
    const { data: metersData, isLoading: metersLoading } = useMeters({
        boundary_metering_point: bmpProperCase,
        meter_type: type,
        limit: 5000,
    })

    // Fetch meter status data
    const { data: statusSummary, isLoading: statusSummaryLoading } = useMeterStatusSummary({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        boundaryMeteringPoints: [bmpProperCase],
        meterTypes: [type],
    })

    const { data: statusTimeline, isLoading: statusTimelineLoading } = useStatusTimeline({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        boundaryMeteringPoints: [bmpProperCase],
        meterTypes: [type],
    })

    // Fetch meter status details with pagination and filtering
    const { data: statusDetails, isLoading: statusDetailsLoading } = useMeterStatusDetails({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        boundaryMeteringPoints: [bmpProperCase],
        meterTypes: [type],
        page: statusPage,
        limit: 10,
    })

    // Fetch all boundary points for ranking/comparison
    const { data: allPointsData, isLoading: allLoading } = useAggregate({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
    })


    // Process daily data for chart
    const chartData = useMemo(() => {
        if (!dailyData || !Array.isArray(dailyData)) return []
        const dateMap = new Map<string, { date: string; import: number; export: number }>()
        dailyData.forEach((record: any) => {
            const date = record.consumption_date?.split("T")[0] || record.consumption_date
            if (!dateMap.has(date)) {
                dateMap.set(date, { date, import: 0, export: 0 })
            }
            const entry = dateMap.get(date)!
            if (record.system_name === "import_kwh") {
                entry.import += record.consumed_energy || 0
            } else {
                entry.export += record.consumed_energy || 0
            }
        })
        return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date))
    }, [dailyData])

// Replace the current meterData useMemo with this:
    const meterData = useMemo(() => {
        if (!metersData?.data?.data) return []

        // Create a map of consumption data from dailyData
        const consumptionMap = new Map<string, { import: number; export: number }>()

        if (dailyData && Array.isArray(dailyData)) {
            dailyData.forEach((record: any) => {
                const meter = record.meter_number
                if (!consumptionMap.has(meter)) {
                    consumptionMap.set(meter, { import: 0, export: 0 })
                }
                const entry = consumptionMap.get(meter)!
                if (record.system_name === "import_kwh") {
                    entry.import += record.consumed_energy || 0
                } else {
                    entry.export += record.consumed_energy || 0
                }
            })
        }

        // Map all meters from the API with their consumption data
        return metersData.data.data.map((meter: any) => {
            const consumption = consumptionMap.get(meter.meter_number) || { import: 0, export: 0 }
            return {
                meter: meter.meter_number,
                import: consumption.import,
                export: consumption.export,
                region: meter.region || meter.location || "",
                status: meter.status || "Unknown",
                location: meter.location || "",
            }
        }).sort((a, b) => (b.import + b.export) - (a.import + a.export)) // Sort by total consumption
    }, [metersData, dailyData])

    // Calculate metrics for this boundary point
    const metrics = useMemo(() => {
        if (!pointData) return null
        const point = pointData.byBoundaryPoint.find(
            (bp) => bp.boundaryPoint.toLowerCase() === bmpProperCase.toLowerCase()
        )

        // Count meters with actual consumption from meterData (the table data)
        const metersWithConsumption = meterData.filter(m => m.import > 0 || m.export > 0).length

        return {
            totalImport: point?.importKwh ?? pointData.totalImportKwh,
            totalExport: point?.exportKwh ?? pointData.totalExportKwh,
            netKwh: (point?.importKwh ?? pointData.totalImportKwh) - (point?.exportKwh ?? pointData.totalExportKwh),
            totalMeters: metersData?.data?.data?.length ?? 0,
            activeMetersWithConsumption: metersWithConsumption, // Changed this line
            efficiency: (point?.importKwh ?? pointData.totalImportKwh) > 0
                ? (((point?.exportKwh ?? pointData.totalExportKwh) / (point?.importKwh ?? pointData.totalImportKwh)) * 100)
                : 0,
        }
    }, [pointData, bmpProperCase, metersData, meterData]) // Added meterData dependency


    // Ranking among all boundary points
    const ranking = useMemo(() => {
        if (!allPointsData || !metrics) return null
        const allPoints = allPointsData.byBoundaryPoint
            .map((bp) => ({
                name: bp.boundaryPoint,
                import: bp.importKwh,
                export: bp.exportKwh,
                net: bp.netKwh,
            }))
            .sort((a, b) => rankingSort === "import" ? b.import - a.import : b.export - a.export)

        const currentIndex = allPoints.findIndex(
            (p) => p.name.toLowerCase() === bmpProperCase.toLowerCase()
        )
        const totalPoints = allPoints.length
        const rank = currentIndex >= 0 ? currentIndex + 1 : null

        // System average
        const avgImport = allPoints.reduce((s, p) => s + p.import, 0) / (totalPoints || 1)
        const avgExport = allPoints.reduce((s, p) => s + p.export, 0) / (totalPoints || 1)
        const totalSystemImport = allPoints.reduce((s, p) => s + p.import, 0)
        const totalSystemExport = allPoints.reduce((s, p) => s + p.export, 0)
        const contributionImport = totalSystemImport > 0 ? (metrics.totalImport / totalSystemImport) * 100 : 0
        const contributionExport = totalSystemExport > 0 ? (metrics.totalExport / totalSystemExport) * 100 : 0

        return {
            rank,
            totalPoints,
            allPoints,
            avgImport,
            avgExport,
            contributionImport,
            contributionExport,
            vsAvgImport: avgImport > 0 ? ((metrics.totalImport - avgImport) / avgImport) * 100 : 0,
            vsAvgExport: avgExport > 0 ? ((metrics.totalExport - avgExport) / avgExport) * 100 : 0,
        }
    }, [allPointsData, metrics, rankingSort, bmpProperCase])

    // Flow direction
    const flowDirection = useMemo(() => {
        if (!metrics) return null
        if (metrics.netKwh > 0) {
            return { from: sideA, to: sideB, label: "Net flow direction", netValue: metrics.netKwh }
        } else if (metrics.netKwh < 0) {
            return { from: sideB, to: sideA, label: "Net flow direction", netValue: Math.abs(metrics.netKwh) }
        }
        return { from: sideA, to: sideB, label: "Balanced", netValue: 0 }
    }, [metrics, sideA, sideB])

    const isLoading = pointLoading || dailyLoading

    if (isLoading) {
        return (
            <div className="space-y-6 p-6">
                <Skeleton className="h-10 w-64" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
                </div>
                <Skeleton className="h-80" />
            </div>
        )
    }

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => window.history.back()} className="bg-transparent">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold capitalize">{bmpProperCase}</h1>
                        <Badge variant="outline">{typeLabel}</Badge>
                        {ranking?.rank && (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                                <Trophy className="h-3 w-3 mr-1" />
                                #{ranking.rank} of {ranking.totalPoints}
                            </Badge>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                        Boundary exchange point between <span className={'capitalize'}>{sideA}</span> and <span className={'capitalize'}>{sideB}</span>
                    </p>
                </div>
            </div>

            {/* Flow Direction Visual */}
            {flowDirection && sideB && (
                <Card>
                    <CardContent className="py-6">
                        <div className="flex items-center justify-center gap-6">
                            <div className="text-center p-4 rounded-lg bg-green-500/10 border-2 border-green-500 min-w-[160px]">
                                <div className="text-xs font-medium text-muted-foreground mb-1">{sideA}</div>
                                <div className="text-lg font-bold text-green-600">{formatNumber(metrics?.totalImport ?? 0)}</div>
                                <div className="text-xs text-muted-foreground">kWh Import</div>
                            </div>

                            <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center gap-2">
                                    <div className="h-0.5 w-12 bg-green-500" />
                                    <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
                                    <div className="h-0.5 w-12 bg-blue-500" />
                                </div>
                                <div className="text-xs text-muted-foreground font-medium">
                                    Net: {formatNumber(flowDirection.netValue)} kWh
                                </div>
                                <div className="flex items-center gap-1 text-xs">
                                    <ArrowRight className="h-3 w-3" />
                                    <span>{flowDirection.from} to {flowDirection.to}</span>
                                </div>
                            </div>

                            <div className="text-center p-4 rounded-lg bg-blue-500/10 border-2 border-blue-500 min-w-[160px]">
                                <div className="text-xs font-medium text-muted-foreground mb-1">{sideB}</div>
                                <div className="text-lg font-bold text-blue-600">{formatNumber(metrics?.totalExport ?? 0)}</div>
                                <div className="text-xs text-muted-foreground">kWh Export</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-green-600" />
                            Total Import
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-600">{formatNumber(metrics?.totalImport ?? 0)}</div>
                        <p className="text-xs text-muted-foreground mt-1">kWh</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <TrendingDown className="h-4 w-4 text-blue-600" />
                            Total Export
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-600">{formatNumber(metrics?.totalExport ?? 0)}</div>
                        <p className="text-xs text-muted-foreground mt-1">kWh</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Zap className="h-4 w-4 text-amber-600" />
                            Net Transfer
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-3xl font-bold ${(metrics?.netKwh ?? 0) >= 0 ? "text-green-600" : "text-blue-600"}`}>
                            {formatNumber(metrics?.netKwh ?? 0)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            kWh ({(metrics?.netKwh ?? 0) >= 0 ? "Net Importer" : "Net Exporter"})
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Activity className="h-4 w-4 text-purple-600" />
                            Total Meters
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{metrics?.totalMeters ?? 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">meters at this point</p>
                        <p className="text-xs text-green-600 mt-1">{metrics?.activeMetersWithConsumption ?? 0} with consumption</p>
                    </CardContent>
                </Card>
            </div>

            {/* vs System Average + Contribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* vs System Average */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            vs System Average
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-muted-foreground">Import</span>
                                <span className="font-medium">
                                    {ranking ? (
                                        <span className={ranking.vsAvgImport >= 0 ? "text-green-600" : "text-red-600"}>
                                            {ranking.vsAvgImport >= 0 ? "+" : ""}{ranking.vsAvgImport.toFixed(1)}% vs avg
                                        </span>
                                    ) : "-"}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex-1">
                                    <div className="text-xs text-muted-foreground mb-1">This point: {formatNumber(metrics?.totalImport ?? 0)} kWh</div>
                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-green-500 rounded-full"
                                            style={{
                                                width: `${Math.min(((metrics?.totalImport ?? 0) / Math.max(ranking?.avgImport ?? 1, metrics?.totalImport ?? 1)) * 50, 100)}%`
                                            }}
                                        />
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">Avg: {formatNumber(ranking?.avgImport ?? 0)} kWh</div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-muted-foreground">Export</span>
                                <span className="font-medium">
                                    {ranking ? (
                                        <span className={ranking.vsAvgExport >= 0 ? "text-blue-600" : "text-red-600"}>
                                            {ranking.vsAvgExport >= 0 ? "+" : ""}{ranking.vsAvgExport.toFixed(1)}% vs avg
                                        </span>
                                    ) : "-"}
                                </span>
                            </div>
                            <div className="flex-1">
                                <div className="text-xs text-muted-foreground mb-1">This point: {formatNumber(metrics?.totalExport ?? 0)} kWh</div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 rounded-full"
                                        style={{
                                            width: `${Math.min(((metrics?.totalExport ?? 0) / Math.max(ranking?.avgExport ?? 1, metrics?.totalExport ?? 1)) * 50, 100)}%`
                                        }}
                                    />
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">Avg: {formatNumber(ranking?.avgExport ?? 0)} kWh</div>
                            </div>
                        </div>
                        <div className="pt-2 border-t">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Export/Import Ratio</span>
                                <span className="font-medium">{metrics?.efficiency.toFixed(1)}%</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Contribution */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Percent className="h-4 w-4" />
                            System Contribution
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-muted-foreground">Import Share</span>
                                <span className="font-bold text-green-600">{ranking?.contributionImport.toFixed(1) ?? 0}%</span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.max(ranking?.contributionImport ?? 0, 1)}%` }}
                                />
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                of all {typeLabel.toLowerCase()} import
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-muted-foreground">Export Share</span>
                                <span className="font-bold text-blue-600">{ranking?.contributionExport.toFixed(1) ?? 0}%</span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.max(ranking?.contributionExport ?? 0, 1)}%` }}
                                />
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                of all {typeLabel.toLowerCase()} export
                            </div>
                        </div>
                        <div className="pt-2 border-t">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Total meters</span>
                                <span className="font-medium">{metrics?.totalMeters ?? 0}</span>
                            </div>
                            <div className="flex justify-between text-sm mt-1">
                                <span className="text-muted-foreground text-xs">With consumption</span>
                                <span className="font-medium text-xs text-green-600">{metrics?.activeMetersWithConsumption ?? 0}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Meter Status Summary */}
            {statusSummary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Online</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">{statusSummary.online ?? 0}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {statusSummary.online_percentage?.toFixed(1) ?? 0}% online
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Offline (No Data)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-orange-600">{statusSummary.offline_no_data ?? 0}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Offline (No Record)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">{statusSummary.offline_no_record ?? 0}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Uptime</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-600">
                                {statusSummary.avg_uptime_percentage?.toFixed(1) ?? 0}%
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Meter Status Timeline */}
            {statusTimeline && statusTimeline.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Meter Status Timeline</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={statusTimeline}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis
                                    dataKey="date"
                                    className="text-xs"
                                    tickFormatter={(val) => {
                                        const d = new Date(val)
                                        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
                                    }}
                                />
                                <YAxis className="text-xs" />
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (!active || !payload) return null
                                        return (
                                            <div className="bg-background border rounded-lg shadow-lg p-3">
                                                <p className="font-medium mb-1 text-sm">
                                                    {new Date(payload[0]?.payload?.date).toLocaleDateString("en-GB", {
                                                        day: "2-digit",
                                                        month: "short",
                                                        year: "numeric",
                                                    })}
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
                                <Bar dataKey="online" stackId="status" fill="hsl(142, 76%, 36%)" name="Online" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="offline" stackId="status" fill="hsl(0, 84%, 60%)" name="Offline" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Meter Status Details */}
            <Card>
                <CardHeader>
                    <CardTitle>Meter Status Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <Button
                                variant={statusFilter === "all" ? "default" : "outline"}
                                size="sm"
                                onClick={() => {
                                    setStatusFilter("all")
                                    setStatusPage(1)
                                }}
                            >
                                All ({statusSummary?.online + statusSummary?.offline_no_data + statusSummary?.offline_no_record || 0})
                            </Button>
                            <Button
                                variant={statusFilter === "online" ? "default" : "outline"}
                                size="sm"
                                onClick={() => {
                                    setStatusFilter("online")
                                    setStatusPage(1)
                                }}
                                className={
                                    statusFilter === "online"
                                        ? "bg-green-600 hover:bg-green-700"
                                        : "border-green-600 text-green-600 hover:bg-green-50"
                                }
                            >
                                Online ({statusSummary?.online ?? 0})
                            </Button>
                            <Button
                                variant={statusFilter === "offline" ? "default" : "outline"}
                                size="sm"
                                onClick={() => {
                                    setStatusFilter("offline")
                                    setStatusPage(1)
                                }}
                                className={
                                    statusFilter === "offline"
                                        ? "bg-red-600 hover:bg-red-700"
                                        : "border-red-600 text-red-600 hover:bg-red-50"
                                }
                            >
                                Offline ({(statusSummary?.offline_no_data ?? 0) + (statusSummary?.offline_no_record ?? 0)})
                            </Button>
                        </div>
                        <input
                            type="text"
                            placeholder="Search meter number..."
                            value={statusSearch}
                            onChange={(e) => setStatusSearch(e.target.value)}
                            className="px-3 py-2 text-sm border rounded-md w-64"
                        />
                    </div>

                    <div className="relative overflow-x-auto border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Meter Number</TableHead>
                                    <TableHead>Location</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Last Reading</TableHead>
                                    <TableHead className="text-right">Total Consumption (kWh)</TableHead>
                                    <TableHead className="text-right">Uptime %</TableHead>
                                    <TableHead className="text-right">Days Offline</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {statusDetailsLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8">
                                            <Skeleton className="h-8 w-full" />
                                        </TableCell>
                                    </TableRow>
                                ) : statusDetails?.data?.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                            No meters found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    statusDetails?.data
                                        ?.filter((m: any) =>
                                            statusSearch ? m.meter_number?.toLowerCase().includes(statusSearch.toLowerCase()) : true
                                        )
                                        .filter((m: any) => {
                                            if (statusFilter === "all") return true
                                            if (statusFilter === "online") return m.status === "ONLINE"
                                            if (statusFilter === "offline") return m.status !== "ONLINE"
                                            return true
                                        })
                                        .map((meter: any) => (
                                            <TableRow key={meter.meter_number}>
                                                <TableCell>
                                                    <Link
                                                        href={`/meters/${meter.meter_number}`}
                                                        className="text-primary hover:underline font-medium"
                                                    >
                                                        {meter.meter_number}
                                                    </Link>
                                                </TableCell>
                                                <TableCell>{meter.location || "-"}</TableCell>
                                                <TableCell>
                                                    <Badge variant={meter.status === "ONLINE" ? "default" : "destructive"}>
                                                        {meter.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {(() => {
                                                        if (!meter.last_reading_time) return "—";

                                                        const date = new Date(meter.last_reading_time);

                                                        if (date.getFullYear() <= 1900) {
                                                            return <span className="text-muted-foreground italic">Not yet available</span>;
                                                        }

                                                        return date.toLocaleDateString("en-GB", {
                                                            day: "2-digit",
                                                            month: "short",
                                                            year: "numeric",
                                                        });
                                                    })()}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formatNumber(meter.total_consumption_kwh ?? 0)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span
                                                        className={
                                                            meter.uptime_percentage >= 90
                                                                ? "text-green-600"
                                                                : meter.uptime_percentage >= 50
                                                                    ? "text-orange-600"
                                                                    : "text-red-600"
                                                        }
                                                    >
                                                        {meter.uptime_percentage?.toFixed(1) ?? 0}%
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span className={meter.days_offline > 7 ? "text-red-600" : "text-muted-foreground"}>
                                                        {meter.days_offline ?? 0}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {statusDetails?.pagination && statusDetails.pagination.total_pages > 1 && (
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                Page {statusDetails.pagination.page} of {statusDetails.pagination.total_pages}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setStatusPage((p) => Math.max(1, p - 1))}
                                    disabled={statusPage === 1}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setStatusPage((p) => p + 1)}
                                    disabled={!statusDetails.pagination.has_more}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Top & Bottom Performing Meters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Top Consumers */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-green-600" />
                            Top 5 Consuming Meters
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {meterData
                                .sort((a, b) => b.import - a.import)
                                .slice(0, 5)
                                .map((meter, idx) => (
                                    <div
                                        key={meter.meter}
                                        className="flex items-center gap-3"
                                    >
                                        {/* Rank badge */}
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 font-bold text-sm">
                                            {idx + 1}
                                        </div>

                                        {/* Meter info */}
                                        <div className="flex-1 min-w-0">
                                            <Link
                                                href={`/meters/${meter.meter}`}
                                                className="text-sm font-medium text-primary hover:underline truncate block"
                                            >
                                                {meter.meter}
                                            </Link>
                                            <p className="text-xs text-muted-foreground">
                                                {meter.region || "Unknown"}
                                            </p>
                                        </div>

                                        {/* Import / Export */}
                                        <div className="text-right flex flex-col items-end">
                                            <p className="text-sm font-bold">
              <span className="text-green-600">
                {formatNumber(meter.import)} kWh
              </span>
                                                <span className="mx-1 text-black">·</span>
                                                <span className="text-blue-600">
                {formatNumber(meter.export)} kWh
              </span>
                                            </p>

                                            <p className="text-xs text-muted-foreground">
                                                Net:{" "}
                                                <span
                                                    className={
                                                        meter.import - meter.export >= 0
                                                            ? "text-green-600"
                                                            : "text-red-600"
                                                    }
                                                >
                {formatNumber(meter.import - meter.export)}
              </span>
                                            </p>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </CardContent>

                </Card>

                {/* Worst Uptime */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <TrendingDown className="h-4 w-4 text-red-600"/>
                            Meters with Lowest Uptime
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {statusDetails?.data
                                ?.sort((a: any, b: any) => (a.uptime_percentage ?? 0) - (b.uptime_percentage ?? 0))
                                .slice(0, 5)
                                .map((meter: any, idx: number) => (
                                    <div key={meter.meter_number} className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 font-bold text-sm">
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <Link
                                                href={`/meters/${meter.meter_number}`}
                                                className="text-sm font-medium hover:underline text-primary truncate block"
                                            >
                                                {meter.meter_number}
                                            </Link>
                                            <p className="text-xs text-muted-foreground">{meter.location || "Unknown"}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-red-600">
                                                {meter.uptime_percentage?.toFixed(1) ?? 0}%
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {meter.days_offline ?? 0} days offline
                                            </p>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/*/!* Location-based Breakdown *!/*/}
            {/*{meterData.length > 0 && (*/}
            {/*    <Card>*/}
            {/*        <CardHeader>*/}
            {/*            <CardTitle className="text-base flex items-center gap-2">*/}
            {/*                <MapPin className="h-4 w-4" />*/}
            {/*                Consumption by Location*/}
            {/*            </CardTitle>*/}
            {/*        </CardHeader>*/}
            {/*        <CardContent>*/}
            {/*            <div className="space-y-2">*/}
            {/*                {Object.entries(*/}
            {/*                    meterData.reduce((acc, m) => {*/}
            {/*                        const location =*/}
            {/*                            metersData?.data?.data?.find((md: any) => md.meter_number === m.meter)?.location ||*/}
            {/*                            m.region ||*/}
            {/*                            "Unknown"*/}
            {/*                        if (!acc[location]) acc[location] = { import: 0, export: 0, count: 0 }*/}
            {/*                        acc[location].import += m.import*/}
            {/*                        acc[location].export += m.export*/}
            {/*                        acc[location].count += 1*/}
            {/*                        return acc*/}
            {/*                    }, {} as Record<string, { import: number; export: number; count: number }>)*/}
            {/*                )*/}
            {/*                    .sort(([, a], [, b]) => b.import - a.import)*/}
            {/*                    .slice(0, 8)*/}
            {/*                    .map(([location, data]) => {*/}
            {/*                        const maxImport = Math.max(...Object.values(meterData).map((m) => m.import))*/}
            {/*                        const percentage = (data.import / maxImport) * 100*/}
            {/*                        return (*/}
            {/*                            <div key={location} className="space-y-1">*/}
            {/*                                <div className="flex items-center justify-between text-sm">*/}
            {/*                                    <span className="font-medium">{location}</span>*/}
            {/*                                    <div className="flex items-center gap-3">*/}
            {/*                                        <span className="text-muted-foreground text-xs">{data.count} meters</span>*/}
            {/*                                        <span className="text-green-600 font-medium">*/}
            {/*                                            {formatNumber(data.import)} kWh*/}
            {/*                                        </span>*/}
            {/*                                    </div>*/}
            {/*                                </div>*/}
            {/*                                <div className="h-2 bg-muted rounded-full overflow-hidden">*/}
            {/*                                    <div*/}
            {/*                                        className="h-full bg-green-600 rounded-full transition-all"*/}
            {/*                                        style={{ width: `${percentage}%` }}*/}
            {/*                                    />*/}
            {/*                                </div>*/}
            {/*                            </div>*/}
            {/*                        )*/}
            {/*                    })}*/}
            {/*            </div>*/}
            {/*        </CardContent>*/}
            {/*    </Card>*/}
            {/*)}*/}

            {/* Daily Consumption Trend */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Daily Import / Export Trend</CardTitle>
                </CardHeader>
                <CardContent>
                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={350}>
                            <AreaChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={(val) => {
                                        const d = new Date(val)
                                        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
                                    }}
                                    fontSize={11}
                                />
                                <YAxis fontSize={11} tickFormatter={(val) => formatNumber(val)} />
                                <Tooltip
                                    formatter={(value: number) => [formatNumber(value) + " kWh"]}
                                    labelFormatter={(label) => {
                                        const d = new Date(label)
                                        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                                    }}
                                />
                                <Legend />
                                <Area
                                    type="monotone"
                                    dataKey="import"
                                    name="Import"
                                    stroke="#22c55e"
                                    fill="#22c55e"
                                    fillOpacity={0.2}
                                    strokeWidth={2}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="export"
                                    name="Export"
                                    stroke="#3b82f6"
                                    fill="#3b82f6"
                                    fillOpacity={0.2}
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-48 text-muted-foreground">
                            No daily data available for the selected period
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Ranking Bar Chart */}
            {ranking && ranking.allPoints.length > 1 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Trophy className="h-4 w-4" />
                                {typeLabel} Point Ranking
                            </CardTitle>
                            <div className="flex items-center gap-2">
                                <Tabs value={rankingSort} onValueChange={(v: any) => setRankingSort(v)}>
                                    <TabsList>
                                        <TabsTrigger value="import">By Import</TabsTrigger>
                                        <TabsTrigger value="export">By Export</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="sm" className="bg-transparent">View All</Button>
                                    </DialogTrigger>
                                    <DialogContent
                                        className="max-h-[80vh] overflow-y-auto"
                                        style={{ maxWidth: '800px' }} // Manually set the width here
                                    >
                                        <DialogHeader>
                                            <DialogTitle>All {typeLabel} Points - Ranked by {rankingSort === "import" ? "Import" : "Export"}</DialogTitle>
                                        </DialogHeader>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-12">#</TableHead>
                                                    <TableHead>Boundary Point</TableHead>
                                                    <TableHead className="text-right">Import (kWh)</TableHead>
                                                    <TableHead className="text-right">Export (kWh)</TableHead>
                                                    <TableHead className="text-right">Net (kWh)</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {ranking.allPoints.map((point, idx) => {
                                                    const isCurrent = point.name.toLowerCase() === bmpProperCase.toLowerCase()
                                                    return (
                                                        <TableRow key={point.name} className={isCurrent ? "bg-green-50 dark:bg-green-950/30 font-semibold" : ""}>
                                                            <TableCell>{idx + 1}</TableCell>
                                                            <TableCell>
                                                                {isCurrent ? (
                                                                    <span className="flex items-center gap-2">
                                                                        <MapPin className="h-3 w-3 text-green-600" />
                                                                        {point.name}
                                                                    </span>
                                                                ) : (
                                                                    <Link
                                                                        href={`${baseRoute}/${encodeURIComponent(point.name.toLowerCase())}`}
                                                                        className="text-primary hover:underline"
                                                                    >
                                                                        {point.name}
                                                                    </Link>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-right text-green-600">{formatNumber(point.import)}</TableCell>
                                                            <TableCell className="text-right text-blue-600">{formatNumber(point.export)}</TableCell>
                                                            <TableCell className={`text-right ${point.net >= 0 ? "text-green-600" : "text-blue-600"}`}>
                                                                {formatNumber(point.net)}
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={Math.min(ranking.allPoints.length * 40 + 40, 500)}>
                            <BarChart
                                data={ranking.allPoints.slice(0, 15)}
                                layout="vertical"
                                margin={{ left: 120, right: 20 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
                                <XAxis type="number" fontSize={11} tickFormatter={(val) => formatNumber(val)} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    fontSize={11}
                                    width={110}
                                    tick={({ x, y, payload }: any) => {
                                        const isCurrent = payload.value.toLowerCase() === bmpProperCase.toLowerCase()
                                        return (
                                            <text x={x} y={y} dy={4} textAnchor="end" fontSize={11} fontWeight={isCurrent ? 700 : 400} fill={isCurrent ? "#22c55e" : "#888"}>
                                                {payload.value.length > 18 ? payload.value.slice(0, 18) + "..." : payload.value}
                                            </text>
                                        )
                                    }}
                                />
                                <Tooltip formatter={(value: number) => [formatNumber(value) + " kWh"]} />
                                <Bar dataKey={rankingSort} radius={[0, 4, 4, 0]}>
                                    {ranking.allPoints.slice(0, 15).map((entry) => (
                                        <Cell
                                            key={entry.name}
                                            fill={
                                                entry.name.toLowerCase() === bmpProperCase.toLowerCase()
                                                    ? rankingSort === "import" ? "#22c55e" : "#3b82f6"
                                                    : "#d1d5db"
                                            }
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Meter Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Meters at this Boundary Point</CardTitle>
                </CardHeader>
                <CardContent>
                    {meterData.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Meter Number</TableHead>
                                    <TableHead>Location</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Import (kWh)</TableHead>
                                    <TableHead className="text-right">Export (kWh)</TableHead>
                                    <TableHead className="text-right">Net (kWh)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {metersLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8">
                                            <Skeleton className="h-8 w-full" />
                                        </TableCell>
                                    </TableRow>
                                ) : meterData.map((meter) => {
                                    const meterInfo = metersData?.data?.data?.find((m: any) => m.meter_number === meter.meter)
                                    return (
                                        <TableRow key={meter.meter}>
                                            <TableCell>
                                                <Link href={`/meters/${meter.meter}`} className="text-primary hover:underline font-medium">
                                                    {meter.meter}
                                                </Link>
                                            </TableCell>
                                            <TableCell>{meterInfo?.location || meter.region || "-"}</TableCell>
                                            <TableCell>
                                                <Badge variant={meterInfo?.status === "Operational" ? "default" : "secondary"}>
                                                    {meterInfo?.status || "Unknown"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right text-green-600">{formatNumber(meter.import)}</TableCell>
                                            <TableCell className="text-right text-blue-600">{formatNumber(meter.export)}</TableCell>
                                            <TableCell className={`text-right ${(meter.import - meter.export) >= 0 ? "text-green-600" : "text-blue-600"}`}>
                                                {formatNumber(meter.import - meter.export)}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="flex items-center justify-center h-24 text-muted-foreground">
                            No meter data available
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
