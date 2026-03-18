"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useBspAggregate, useBspDaily } from "@/hooks/api/use-bsp-api"
import { useDtxAggregate, useDtxDaily } from "@/hooks/api/use-dtx-api"
import { useRegionalBoundaryDaily } from "@/hooks/api/use-regional-boundary-api"
import { useAppStore } from "@/stores/app-store"
import { formatApiDate } from "@/lib/utils"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowDownIcon, ArrowUpIcon, ArrowRightLeft, ArrowRightIcon, TrendingUp, TrendingDown, Zap } from "lucide-react"
import {
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    BarChart,
    Bar,
    ComposedChart,
    Area,
} from "recharts"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"


export function RegionsView() {
    const router = useRouter()
    const filters = useAppStore((state) => state.filters)
    const setFilters = useAppStore((state) => state.setFilters)

    // On mount, clear all filters except date range and region so stale
    // district/station/meterType filters from other pages don't corrupt the data
    useEffect(() => {
        setFilters({
            districts: [],
            stations: [],
            locations: [],
            meterTypes: [],
            boundaryMeteringPoints: [],
            voltages: [],
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const [supplyMixFilter, setSupplyMixFilter] = useState<"all" | "bsp" | "dtx" | "crossBoundary">("all")
    const [visibleSeries, setVisibleSeries] = useState({
        bsp: true,
        dtx: true,
        crossBoundaryImport: true,
        crossBoundaryExport: true,
    })

    const toggleSeries = (series: keyof typeof visibleSeries) => {
        setVisibleSeries(prev => ({ ...prev, [series]: !prev[series] }))
    }

    const params = useMemo(() => {
        if (!filters.dateRange) return { dateFrom: "", dateTo: "" }

        return {
            dateFrom: formatApiDate(filters.dateRange.start),
            dateTo: formatApiDate(filters.dateRange.end),
            regions: filters.regions,
        }
    }, [
        filters.dateRange,
        filters.regions,
        filters.districts,
        filters.stations,
        filters.locations,
        filters.boundaryMeteringPoints,
        filters.meterTypes,
        filters.voltages,
    ])

    const { data: bspAggregateData, isLoading: summaryLoading } = useBspAggregate({
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        region: params.regions,
    })
    const { data: bspDailyData, isLoading: detailedLoading } = useBspDaily({
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        region: params.regions,
    })
    const { data: dtxAggregateData } = useDtxAggregate(params)
    const { data: dtxDailyData } = useDtxDaily(params)
    const { data: boundaryDailyData } = useRegionalBoundaryDaily(params)

    const selectedRegion = params.regions && params.regions.length === 1 ? params.regions[0] : undefined

    // Resolve boundary import/export from a daily record.
    //
    // API convention (matches region-detail.tsx lines 405-424):
    //   import_kwh = energy flowing Left → Right
    //   export_kwh = energy flowing Right → Left
    //
    //   LEFT  region: import_kwh = their EXPORT (pushing out), export_kwh = their IMPORT (receiving)
    //   RIGHT region: import_kwh = their IMPORT (receiving),   export_kwh = their EXPORT (pushing out)
    //
    // No region selected: sum import_kwh as import and export_kwh as export directly.
    // The backend already returns one record per meter per day (not duplicated per side).
    const resolveDirection = (record: any): { regionImport: number; regionExport: number } => {
        const bmp: string = record.boundary_metering_point || ""
        const parts = bmp.split("/")
        const leftRegion = parts[0]?.trim() || ""
        const rightRegion = parts[1]?.trim() || ""
        const consumption = record.consumed_energy || 0
        const systemName: string = record.system_name || ""

        if (selectedRegion) {
            const isLeft = leftRegion.toLowerCase() === selectedRegion.toLowerCase()
            const isRight = rightRegion.toLowerCase() === selectedRegion.toLowerCase()

            if (isLeft) {
                // LEFT: import_kwh = pushing out (export), export_kwh = receiving (import)
                return systemName === "import_kwh"
                    ? { regionImport: 0, regionExport: consumption }
                    : { regionImport: consumption, regionExport: 0 }
            } else if (isRight) {
                // RIGHT: import_kwh = receiving (import), export_kwh = pushing out (export)
                return systemName === "import_kwh"
                    ? { regionImport: consumption, regionExport: 0 }
                    : { regionImport: 0, regionExport: consumption }
            }
        }

        // No region selected — treat system_name at face value:
        // import_kwh = import, export_kwh = export
        return systemName === "import_kwh"
            ? { regionImport: consumption, regionExport: 0 }
            : { regionImport: 0, regionExport: consumption }
    }

    // Total Energy Summary
    const totalSummary = useMemo(() => {
        if (!bspAggregateData) return null

        const totals = {
            bspImport: bspAggregateData.totalSupplyKwh,
            dtxImport: 0,
            crossBoundary: 0,
        }

        let crossBoundaryImport = 0
        let crossBoundaryExport = 0

        if (boundaryDailyData && boundaryDailyData.length > 0) {
            boundaryDailyData.forEach((record: any) => {
                const { regionImport, regionExport } = resolveDirection(record)
                crossBoundaryImport += regionImport
                crossBoundaryExport += regionExport
            })
        }

        const netConsumption = totals.bspImport + crossBoundaryImport - crossBoundaryExport
        return { ...totals, crossBoundaryImport, crossBoundaryExport, netConsumption }
    }, [bspAggregateData, boundaryDailyData, selectedRegion])

    // Daily Energy Trends
    const dailyTrends = useMemo(() => {
        const dateMap: Record<string, { date: string; bsp: number; dtx: number; crossBoundaryImport: number; crossBoundaryExport: number }> = {}

        // BSP from bspDailyData
        if (bspDailyData && bspDailyData.length > 0) {
            bspDailyData.forEach((item) => {
                const date = item.consumption_date?.split("T")[0]
                if (!date) return
                if (!dateMap[date]) {
                    dateMap[date] = { date, bsp: 0, dtx: 0, crossBoundaryImport: 0, crossBoundaryExport: 0 }
                }
                if (item.system_name === "import_kwh") {
                    dateMap[date].bsp += item.consumed_energy || 0
                }
            })
        }

        // DTX from dtxDailyData
        if (dtxDailyData && dtxDailyData.length > 0) {
            dtxDailyData.forEach((item: any) => {
                const date = item.consumption_date?.split("T")[0]
                if (!date) return
                if (!dateMap[date]) {
                    dateMap[date] = { date, bsp: 0, dtx: 0, crossBoundaryImport: 0, crossBoundaryExport: 0 }
                }
                if (item.system_name === "import_kwh") {
                    dateMap[date].dtx += item.consumed_energy || 0
                }
            })
        }

        // Boundary import/export from boundaryDailyData — same source as region-detail
        if (boundaryDailyData && boundaryDailyData.length > 0) {
            boundaryDailyData.forEach((record: any) => {
                const date = record.consumption_date?.split("T")[0]
                if (!date) return
                if (!dateMap[date]) {
                    dateMap[date] = { date, bsp: 0, dtx: 0, crossBoundaryImport: 0, crossBoundaryExport: 0 }
                }
                const { regionImport, regionExport } = resolveDirection(record)
                dateMap[date].crossBoundaryImport += regionImport
                dateMap[date].crossBoundaryExport += regionExport
            })
        }

        return Object.values(dateMap)
            .map((d) => ({
                date: d.date,
                bspKWh: d.bsp,
                dtxKWh: d.dtx,
                crossBoundaryImportKWh: d.crossBoundaryImport,
                crossBoundaryExportKWh: d.crossBoundaryExport,
            }))
            .sort((a, b) => a.date.localeCompare(b.date))
    }, [bspDailyData, dtxDailyData, boundaryDailyData, selectedRegion])

    // Regional Consumption Rankings
    const regionalRankings = useMemo(() => {
        if (!bspAggregateData?.byRegion) return []

        // Build per-region boundary net from boundaryDailyData
        const boundaryNetByRegion: Record<string, number> = {}
        if (boundaryDailyData && boundaryDailyData.length > 0) {
            boundaryDailyData.forEach((record: any) => {
                const bmp: string = record.boundary_metering_point || ""
                const leftRegion = bmp.split("/")[0]?.trim().toLowerCase()
                if (!leftRegion) return
                const attributedRegion = selectedRegion ? selectedRegion.toLowerCase() : leftRegion
                const { regionImport, regionExport } = resolveDirection(record)
                if (!boundaryNetByRegion[attributedRegion]) boundaryNetByRegion[attributedRegion] = 0
                boundaryNetByRegion[attributedRegion] += regionImport - regionExport
            })
        }

        // Build DTX per-region lookup
        const dtxByRegion: Record<string, number> = {}
        if (dtxAggregateData?.regionalBreakdown) {
            dtxAggregateData.regionalBreakdown.forEach((r: any) => {
                if (r.region) dtxByRegion[r.region.toLowerCase()] = r.import || 0
            })
        }

        // Compute days in range for avg daily calculation
        const dayCount = filters.dateRange
            ? Math.max(1, Math.round((new Date(filters.dateRange.end).getTime() - new Date(filters.dateRange.start).getTime()) / 86400000) + 1)
            : 1

        return bspAggregateData.byRegion
            .map((r) => {
                const key = r.region.toLowerCase()
                const bspImport = r.netSupplyKwh
                const dtxImport = dtxByRegion[key] ?? 0
                const boundaryNet = boundaryNetByRegion[key] || 0
                const netConsumption = bspImport + boundaryNet
                return {
                    region: r.region,
                    bspImport,
                    dtxImport,
                    netConsumption,
                    avgDaily: netConsumption / dayCount,
                    boundaryNet,
                }
            })
            .filter((r) => r.bspImport > 0)
            .sort((a, b) => b.netConsumption - a.netConsumption)
    }, [bspAggregateData, boundaryDailyData, dtxAggregateData, selectedRegion, filters.dateRange])

    // Supply Source Breakdown per Region (from BSP aggregate)
    const supplySourcesByRegion = useMemo(() => {
        if (!bspAggregateData?.byRegion) return []

        // Build DTX per-region lookup
        const dtxByRegion: Record<string, number> = {}
        if (dtxAggregateData?.regionalBreakdown) {
            dtxAggregateData.regionalBreakdown.forEach((r: any) => {
                if (r.region) dtxByRegion[r.region.toLowerCase()] = r.import || 0
            })
        }

        // Build per-region boundary net for cross-boundary column
        const boundaryNetByRegion: Record<string, number> = {}
        if (boundaryDailyData && boundaryDailyData.length > 0) {
            boundaryDailyData.forEach((record: any) => {
                const bmp: string = record.boundary_metering_point || ""
                const leftRegion = bmp.split("/")[0]?.trim().toLowerCase()
                if (!leftRegion) return
                const attributedRegion = selectedRegion ? selectedRegion.toLowerCase() : leftRegion
                const { regionImport, regionExport } = resolveDirection(record)
                if (!boundaryNetByRegion[attributedRegion]) boundaryNetByRegion[attributedRegion] = 0
                boundaryNetByRegion[attributedRegion] += regionImport - regionExport
            })
        }

        return bspAggregateData.byRegion
            .map((r) => {
                const key = r.region.toLowerCase()
                const bsp = r.netSupplyKwh
                const dtx = dtxByRegion[key] ?? 0
                const crossBoundary = Math.abs(boundaryNetByRegion[key] || 0)
                const total = bsp + crossBoundary
                return {
                    region: r.region,
                    regionLabel: r.region.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
                    bsp,
                    dtx,
                    crossBoundary,
                    total,
                }
            })
            .filter((r) => r.total > 0)
            .sort((a, b) => b.total - a.total)
            .slice(0, 10)
    }, [bspAggregateData, dtxAggregateData, boundaryDailyData, selectedRegion])

    // Peak and Low Consumption Days
    const extremeDays = useMemo(() => {
        if (!dailyTrends.length) return { peak: null, low: null }

        const sorted = [...dailyTrends].sort((a, b) => b.bspKWh - a.bspKWh)
        return {
            peak: sorted[0],
            low: sorted[sorted.length - 1],
        }
    }, [dailyTrends])

    const isLoading = summaryLoading || detailedLoading

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Card key={i}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                            </CardHeader>
                            <CardContent>
                                <div className="h-8 w-32 bg-muted animate-pulse rounded mb-2" />
                                <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
                <div className="text-center text-muted-foreground py-8">Loading energy data...</div>
            </div>
        )
    }

    if (!bspAggregateData || !totalSummary) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-muted-foreground">No data available for the selected period</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Total Energy Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">BSP Supply (Import)</CardTitle>
                        <ArrowDownIcon className="h-5 w-5 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-600">
                            {regionalRankings.reduce((sum, r) => sum + r.bspImport, 0).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">kWh from Grid</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Inter-Regional Energy Exchange</CardTitle>
                        <ArrowRightLeft className="h-5 w-5 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-3">
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <ArrowDownIcon className="h-4 w-4 text-green-600" />
                                    <span className="text-2xl font-bold text-green-600">
                                        {totalSummary.crossBoundaryImport.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5">Import (kWh)</p>
                            </div>
                            <div className="h-8 w-px bg-border" />
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <ArrowUpIcon className="h-4 w-4 text-orange-500" />
                                    <span className="text-2xl font-bold text-orange-500">
                                        {totalSummary.crossBoundaryExport.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5">Export (kWh)</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Consumption</CardTitle>
                        <Zap className="h-5 w-5 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            {totalSummary.netConsumption.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">kWh (BSP Import + Boundary Import - Boundary Export)</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">DTX Supply (Import)</CardTitle>
                        <ArrowRightIcon className="h-5 w-5 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-600">
                            {(dtxAggregateData?.totalImportKwh ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}


                        </div>
                        <p className="text-xs text-muted-foreground mt-1">kWh distribution</p>
                    </CardContent>
                </Card>




            </div>

            {/* Row 1: Daily Trends + Peak/Low Days */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="md:col-span-2">
                    <CardHeader>
                        <div className="flex items-start justify-between">
                            <div>
                                <CardTitle>Daily Energy Flow Trends</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    BSP supply, DTX distribution, and cross-boundary import/export over time
                                </p>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="ml-auto bg-transparent">
                                        Types <ChevronDown className="ml-2 h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[200px]">
                                    <DropdownMenuCheckboxItem
                                        checked={visibleSeries.bsp}
                                        onCheckedChange={() => toggleSeries('bsp')}
                                    >
                                        BSP Supply
                                    </DropdownMenuCheckboxItem>
                                    <DropdownMenuCheckboxItem
                                        checked={visibleSeries.dtx}
                                        onCheckedChange={() => toggleSeries('dtx')}
                                    >
                                        DTX Distribution
                                    </DropdownMenuCheckboxItem>
                                    <DropdownMenuCheckboxItem
                                        checked={visibleSeries.crossBoundaryImport}
                                        onCheckedChange={() => toggleSeries('crossBoundaryImport')}
                                    >
                                        Cross-Boundary Import
                                    </DropdownMenuCheckboxItem>
                                    <DropdownMenuCheckboxItem
                                        checked={visibleSeries.crossBoundaryExport}
                                        onCheckedChange={() => toggleSeries('crossBoundaryExport')}
                                    >
                                        Cross-Boundary Export
                                    </DropdownMenuCheckboxItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {dailyTrends.length === 0 ? (
                            <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                                <div className="text-center">
                                    <p className="font-medium">No daily trend data available</p>
                                    <p className="text-sm mt-1">No BSP consumption records found for the selected period</p>
                                </div>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={400}>
                                <ComposedChart data={dailyTrends}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(date) =>
                                            new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                                        }
                                    />
                                    <YAxis
                                        label={{ value: "Energy (kWh)", angle: -90, position: "insideLeft" }}
                                        tickFormatter={(value) =>
                                            value.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 2 })
                                        }
                                    />
                                    <Tooltip
                                        labelFormatter={(date) => new Date(date).toLocaleDateString()}
                                        formatter={(value: number) => [
                                            value.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " kWh",
                                        ]}
                                    />
                                    <Legend />
                                    {visibleSeries.bsp && (
                                        <Area
                                            type="monotone"
                                            dataKey="bspKWh"
                                            fill="#22c55e"
                                            fillOpacity={0.3}
                                            stroke="#22c55e"
                                            strokeWidth={2}
                                            name="BSP Supply"
                                        />
                                    )}
                                    {visibleSeries.dtx && (
                                        <Line
                                            type="monotone"
                                            dataKey="dtxKWh"
                                            stroke="#3b82f6"
                                            strokeWidth={2}
                                            name="DTX Distribution"
                                            dot={{ fill: "#3b82f6", r: 3 }}
                                        />
                                    )}
                                    {visibleSeries.crossBoundaryImport && (
                                        <Line
                                            type="monotone"
                                            dataKey="crossBoundaryImportKWh"
                                            stroke="#16a34a"
                                            strokeWidth={2}
                                            name="Cross-Boundary Import"
                                            dot={{ fill: "#16a34a", r: 3 }}
                                            strokeDasharray="5 5"
                                        />
                                    )}
                                    {visibleSeries.crossBoundaryExport && (
                                        <Line
                                            type="monotone"
                                            dataKey="crossBoundaryExportKWh"
                                            stroke="#f97316"
                                            strokeWidth={2}
                                            name="Cross-Boundary Export"
                                            dot={{ fill: "#f97316", r: 3 }}
                                            strokeDasharray="5 5"
                                        />
                                    )}
                                </ComposedChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Energy Consumption Extremes</CardTitle>
                        <p className="text-sm text-muted-foreground">Peak and lowest energy consumption days</p>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {!extremeDays.peak && !extremeDays.low ? (
                            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                No daily data available
                            </div>
                        ) : (
                            <>
                                {extremeDays.peak && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="h-5 w-5 text-green-600" />
                                            <span className="font-semibold text-green-600">Peak Energy Consumption</span>
                                        </div>
                                        <div className="pl-7">
                                            <p className="text-2xl font-bold">
                                                {extremeDays.peak.bspKWh.toLocaleString(undefined, { maximumFractionDigits: 2 })} kWh
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {new Date(extremeDays.peak.date).toLocaleDateString(undefined, {
                                                    month: "long",
                                                    day: "numeric",
                                                    year: "numeric",
                                                })}
                                            </p>
                                            <div className="mt-2 text-xs space-y-0.5">
                                                <p>
                                                    DTX: {extremeDays.peak.dtxKWh.toLocaleString(undefined, { maximumFractionDigits: 2 })} kWh
                                                </p>
                                                <p className="text-green-600">
                                                    Import:{" "}
                                                    {extremeDays.peak.crossBoundaryImportKWh.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                                                    kWh
                                                </p>
                                                <p className="text-orange-500">
                                                    Export:{" "}
                                                    {extremeDays.peak.crossBoundaryExportKWh.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                                                    kWh
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {extremeDays.low && (
                                    <div className="space-y-2 pt-4 border-t">
                                        <div className="flex items-center gap-2">
                                            <TrendingDown className="h-5 w-5 text-blue-600" />
                                            <span className="font-semibold text-blue-600">Lowest Energy Consumption</span>
                                        </div>
                                        <div className="pl-7">
                                            <p className="text-2xl font-bold">
                                                {extremeDays.low.bspKWh.toLocaleString(undefined, { maximumFractionDigits: 2 })} kWh
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {new Date(extremeDays.low.date).toLocaleDateString(undefined, {
                                                    month: "long",
                                                    day: "numeric",
                                                    year: "numeric",
                                                })}
                                            </p>
                                            <div className="mt-2 text-xs space-y-0.5">
                                                <p>DTX: {extremeDays.low.dtxKWh.toLocaleString(undefined, { maximumFractionDigits: 2 })} kWh</p>
                                                <p className="text-green-600">
                                                    Import:{" "}
                                                    {extremeDays.low.crossBoundaryImportKWh.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                                                    kWh
                                                </p>
                                                <p className="text-orange-500">
                                                    Export:{" "}
                                                    {extremeDays.low.crossBoundaryExportKWh.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                                                    kWh
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Supply Sources by Region */}
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <CardTitle>Energy Supply Mix by Region</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Comparison of BSP, DTX, and cross-boundary energy sources across regions
                            </p>
                        </div>
                        <Select value={supplyMixFilter} onValueChange={(value: any) => setSupplyMixFilter(value)}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter by source" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Sources</SelectItem>
                                <SelectItem value="bsp">BSP Supply Only</SelectItem>
                                <SelectItem value="dtx">DTX Supply Only</SelectItem>
                                <SelectItem value="crossBoundary">Cross-Boundary Only</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={450}>
                        <BarChart
                            data={supplySourcesByRegion}
                            margin={{ top: 20, right: 30, left: 60, bottom: 10 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="regionLabel"
                                angle={-45}
                                textAnchor="end"
                                height={100}
                                interval={0}
                                tick={{ fontSize: 12 }}
                            />
                            <YAxis
                                label={{ value: "Energy (kWh)", angle: -90, position: "insideLeft", offset: -30 }}
                                tickFormatter={(value) =>
                                    value >= 1000000
                                        ? `${(value / 1000000).toFixed(1)}M`
                                        : value >= 1000
                                            ? `${(value / 1000).toFixed(0)}K`
                                            : value.toString()
                                }
                            />
                            <Tooltip
                                formatter={(value: number) => [
                                    value.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " kWh",
                                ]}
                                labelFormatter={(label) => label}
                            />
                            <Legend
                                wrapperStyle={{ paddingTop: "20px" }}
                                iconType="square"
                            />
                            {(supplyMixFilter === "all" || supplyMixFilter === "bsp") && (
                                <Bar
                                    dataKey="bsp"
                                    fill="#22c55e"
                                    name="BSP Supply"
                                    onClick={(data) => {
                                        if (data && data.activePayload && data.activePayload[0]) {
                                            router.push(`/regions/${data.activePayload[0].payload.region.toLowerCase().replace(/\s+/g, "-")}`)
                                        }
                                    }}
                                    cursor="pointer"
                                    radius={[4, 4, 0, 0]}
                                />
                            )}
                            {(supplyMixFilter === "all" || supplyMixFilter === "dtx") && (
                                <Bar
                                    dataKey="dtx"
                                    fill="#3b82f6"
                                    name="DTX Supply"
                                    onClick={(data) => {
                                        if (data && data.activePayload && data.activePayload[0]) {
                                            router.push(`/regions/${data.activePayload[0].payload.region.toLowerCase().replace(/\s+/g, "-")}`)
                                        }
                                    }}
                                    cursor="pointer"
                                    radius={[4, 4, 0, 0]}
                                />
                            )}
                            {(supplyMixFilter === "all" || supplyMixFilter === "crossBoundary") && (
                                <Bar
                                    dataKey="crossBoundary"
                                    fill="#a855f7"
                                    name="Cross-Boundary Net"
                                    onClick={(data) => {
                                        if (data && data.activePayload && data.activePayload[0]) {
                                            router.push(`/regions/${data.activePayload[0].payload.region.toLowerCase().replace(/\s+/g, "-")}`)
                                        }
                                    }}
                                    cursor="pointer"
                                    radius={[4, 4, 0, 0]}
                                />
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Regional Consumption Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Regional Energy Consumption Summary</CardTitle>
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">Ranked by total consumption (BSP Import + Boundary Net). DTX shown separately.</p>

                    </div>
                </CardHeader>
                <CardContent>
                    {regionalRankings.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">No regional data available</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Region</TableHead>
                                    <TableHead className="text-right">BSP Import</TableHead>
                                    <TableHead className="text-right">Boundary Net</TableHead>
                                    <TableHead className="text-right">Total Consumption</TableHead>

                                    <TableHead className="text-right">Avg Daily</TableHead>
                                    <TableHead className="text-right">DTX (Standalone)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {regionalRankings.map((region, index) => (
                                    <TableRow
                                        key={region.region}
                                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => router.push(`/regions/${region.region.toLowerCase().replace(/\s+/g, "-")}`)}
                                    >
                                        <TableCell className="font-medium">
                                            {region.region.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                        </TableCell>
                                        <TableCell className="text-right text-mauve-600 font-semibold">
                                            <div className="flex items-center justify-end gap-1">
                                                <ArrowDownIcon className="h-3 w-3 text-mauve-600" />
                                                {region.bspImport.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {region.boundaryNet >= 0 ? (
                                                    <ArrowDownIcon className="h-3 w-3 text-green-600" />
                                                ) : (
                                                    <ArrowUpIcon className="h-3 w-3 text-red-600" />
                                                )}
                                                <span className={region.boundaryNet >= 0 ? "text-green-600" : "text-red-600"}>
                                                    {region.boundaryNet.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-bold">
                                            {region.netConsumption.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {region.avgDaily.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="text-right text-blue-600">
                                            {region.dtxImport.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                        </TableCell>

                                    </TableRow>
                                ))}
                            </TableBody>

                        </Table>

                    )}
                    <div className={'flex border-t justify-end'}>
                        <div className="flex mt-6 items-center gap-4 text-xs">
                            <div className="flex items-center gap-1">
                                <ArrowDownIcon className="h-3 w-3 text-mauve-600" />
                                <span>BSP Import</span>
                            </div>

                            <div className="h-3 w-px bg-gray-300" />

                            <div className="flex items-center gap-1">
                                <ArrowDownIcon className="h-3 w-3 text-green-600" />
                                <span>Imported more than Export</span>
                            </div>

                            <div className="h-3 w-px bg-gray-300" />

                            <div className="flex items-center gap-1">
                                <ArrowUpIcon className="h-3 w-3 text-red-600" />
                                <span>Exported more than Import</span>
                            </div>

                            <div className="h-3 w-px bg-gray-300" />

                            <div className="flex items-center gap-1">
                                <ArrowRightIcon className="h-3 w-3 text-blue-600" />
                                <span>DTX Consumption</span>
                            </div>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                            * Avg Daily = Total Consumption (BSP Import + Boundary Net) divided by the number of days in the selected period
                            {filters.dateRange ? (() => {
                                const ms = new Date(filters.dateRange.end).getTime() - new Date(filters.dateRange.start).getTime()
                                const days = Math.max(1, Math.round(ms / 86400000) + 1)
                                return ` (${days} day${days !== 1 ? "s" : ""})`
                            })() : ""}.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
