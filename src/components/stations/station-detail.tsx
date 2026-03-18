"use client"

import { useMemo, useState } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

import { useBspDaily, useBspAggregate } from "@/hooks/api/use-bsp-api"
import { usePssDaily } from "@/hooks/api/use-pss-api"
import { useSsDaily, type SsDailyParams } from "@/hooks/api/use-ss-api"
import { useAppStore } from "@/stores/app-store"
import { formatNumber, toProperCase } from "@/lib/utils"
import {
    ArrowLeft,
    TrendingDown,
    TrendingUp,
    Zap,
    Activity,
    BarChart3,
    Trophy,
    Percent,
    ArrowUpDown,
    Globe,
    MapPin, Star,
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
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
} from "recharts"
import { format, parseISO } from "date-fns"
import Link from "next/link"

interface StationDetailProps {
    station: string
}

export function StationDetail({ station }: StationDetailProps) {
    const { filters } = useAppStore()
    const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["totalImport", "totalExport"])
    const [rankingSort, setRankingSort] = useState<"import" | "export">("import")
    const [stationFilter, setStationFilter] = useState("")

    const stationProperCase = toProperCase(station)

    const dateRange = useMemo(() => {
        const formatDateToString = (date: Date | string | undefined, fallback: string): string => {
            if (!date) return fallback
            if (date instanceof Date) return date.toISOString().split("T")[0]
            if (typeof date === "string") return date.includes("T") ? date.split("T")[0] : date
            return fallback
        }

        const defaultStart = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0]
        const defaultEnd = new Date().toISOString().split("T")[0]

        return {
            start: formatDateToString(filters.dateRange?.start, defaultStart),
            end: formatDateToString(filters.dateRange?.end, defaultEnd),
        }
    }, [filters.dateRange])

    // Fetch BSP daily data for this station
    const { data: bspDailyData, isLoading: bspLoading } = useBspDaily({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        station: [stationProperCase],
    })

    // Fetch PSS daily data for this station
    const { data: pssDailyData, isLoading: pssLoading } = usePssDaily({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        station: [stationProperCase],
    })

    // Fetch SS daily data for this station
    const { data: ssDailyData, isLoading: ssLoading } = useSsDaily({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        station: [stationProperCase],
    } as SsDailyParams)

    // Fetch ALL BSP aggregate (no region filter) for global comparison
    const { data: globalBspAggregate } = useBspAggregate({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
    })

    // Process BSP metrics - flat table with feeder + meter
    const bspMetrics = useMemo(() => {
        if (!bspDailyData || !Array.isArray(bspDailyData)) {
            return { import: 0, export: 0, net: 0, uniqueMeters: new Set<string>(), meterRows: [] as { feeder: string; meterNumber: string; import: number; export: number }[], region: "" }
        }

        let totalImport = 0
        let totalExport = 0
        const uniqueMeters = new Set<string>()
        const meterMap = new Map<string, { feeder: string; meterNumber: string; import: number; export: number }>()
        let region = ""

        bspDailyData.forEach((record: any) => {
            const feeder = record.feeder_panel_name || "Unknown Feeder"
            const meterNumber = record.meter_number || "Unknown"
            const consumption = record.consumed_energy || 0
            const key = `${feeder}|${meterNumber}`

            if (record.region && !region) region = record.region

            if (!meterMap.has(key)) {
                meterMap.set(key, { feeder, meterNumber, import: 0, export: 0 })
            }
            const row = meterMap.get(key)!

            if (record.system_name === "import_kwh") {
                totalImport += consumption
                row.import += consumption
            } else if (record.system_name === "export_kwh") {
                totalExport += consumption
                row.export += consumption
            }

            if (meterNumber !== "Unknown") uniqueMeters.add(meterNumber)
        })

        const meterRows = Array.from(meterMap.values()).sort((a, b) => b.import - a.import)

        return { import: totalImport, export: totalExport, net: totalImport - totalExport, uniqueMeters, meterRows, region }
    }, [bspDailyData])

    // Process PSS metrics
    const pssMetrics = useMemo(() => {
        if (!pssDailyData || !Array.isArray(pssDailyData)) {
            return { import: 0, export: 0, net: 0, uniqueMeters: new Set<string>(), meterRows: [] as { feeder: string; meterNumber: string; import: number; export: number }[] }
        }

        let totalImport = 0
        let totalExport = 0
        const uniqueMeters = new Set<string>()
        const meterMap = new Map<string, { feeder: string; meterNumber: string; import: number; export: number }>()

        pssDailyData.forEach((record: any) => {
            const feeder = record.feeder_panel_name || "Unknown Feeder"
            const meterNumber = record.meter_number || "Unknown"
            const consumption = record.consumed_energy || 0
            const key = `${feeder}|${meterNumber}`

            if (!meterMap.has(key)) {
                meterMap.set(key, { feeder, meterNumber, import: 0, export: 0 })
            }
            const row = meterMap.get(key)!

            if (record.system_name === "import_kwh") {
                totalImport += consumption
                row.import += consumption
            } else if (record.system_name === "export_kwh") {
                totalExport += consumption
                row.export += consumption
            }

            if (meterNumber !== "Unknown") uniqueMeters.add(meterNumber)
        })

        const meterRows = Array.from(meterMap.values()).sort((a, b) => b.import - a.import)

        return { import: totalImport, export: totalExport, net: totalImport - totalExport, uniqueMeters, meterRows }
    }, [pssDailyData])

    // Process SS metrics
    const ssMetrics = useMemo(() => {
        if (!ssDailyData || !Array.isArray(ssDailyData)) {
            return { import: 0, export: 0, net: 0, uniqueMeters: new Set<string>(), meterRows: [] as { meterNumber: string; import: number; export: number }[] }
        }

        let totalImport = 0
        let totalExport = 0
        const uniqueMeters = new Set<string>()
        const meterMap = new Map<string, { meterNumber: string; import: number; export: number }>()

        ssDailyData.forEach((record: any) => {
            const meterNumber = record.meter_number || "Unknown"
            const consumption = record.consumed_energy || 0

            if (!meterMap.has(meterNumber)) {
                meterMap.set(meterNumber, { meterNumber, import: 0, export: 0 })
            }
            const row = meterMap.get(meterNumber)!

            if (record.system_name === "import_kwh") {
                totalImport += consumption
                row.import += consumption
            } else if (record.system_name === "export_kwh") {
                totalExport += consumption
                row.export += consumption
            }

            if (meterNumber !== "Unknown") uniqueMeters.add(meterNumber)
        })

        const meterRows = Array.from(meterMap.values()).sort((a, b) => b.import - a.import)

        return { import: totalImport, export: totalExport, net: totalImport - totalExport, uniqueMeters, meterRows }
    }, [ssDailyData])

    // Combined station totals
    const stationTotals = useMemo(() => {
        const totalImport = bspMetrics.import + pssMetrics.import + ssMetrics.import
        const totalExport = bspMetrics.export + pssMetrics.export + ssMetrics.export
        const totalMeters = bspMetrics.uniqueMeters.size + pssMetrics.uniqueMeters.size + ssMetrics.uniqueMeters.size

        return {
            totalImport,
            totalExport,
            net: totalImport - totalExport,
            totalMeters,
        }
    }, [bspMetrics, pssMetrics, ssMetrics])

    // Global + regional station ranking from aggregate data
    const stationAnalytics = useMemo(() => {
        if (!globalBspAggregate?.byRegion) return null

        // Collect ALL stations across ALL regions
        const allStationsGlobal: { station: string; region: string; supplyKwh: number; reverseFlowKwh: number; netSupplyKwh: number }[] = []
        let stationRegionData: { regionName: string; stationData: any; regionTotal: number; regionExport: number } | null = null

        for (const regionData of globalBspAggregate.byRegion) {
            if (regionData.stations) {
                for (const s of regionData.stations) {
                    allStationsGlobal.push({
                        station: s.station,
                        region: regionData.region,
                        supplyKwh: s.supplyKwh,
                        reverseFlowKwh: s.reverseFlowKwh,
                        netSupplyKwh: s.netSupplyKwh || (s.supplyKwh - s.reverseFlowKwh),
                    })
                    if (s.station.toLowerCase() === stationProperCase.toLowerCase()) {
                        stationRegionData = {
                            regionName: regionData.region,
                            stationData: s,
                            regionTotal: regionData.supplyKwh,
                            regionExport: regionData.reverseFlowKwh,
                        }
                    }
                }
            }
        }

        if (!stationRegionData) return null

        // Global rankings
        const globalByImport = [...allStationsGlobal].sort((a, b) => b.supplyKwh - a.supplyKwh)
        const globalByExport = [...allStationsGlobal].sort((a, b) => b.reverseFlowKwh - a.reverseFlowKwh)
        const globalImportRank = globalByImport.findIndex((s) => s.station.toLowerCase() === stationProperCase.toLowerCase()) + 1
        const globalExportRank = globalByExport.findIndex((s) => s.station.toLowerCase() === stationProperCase.toLowerCase()) + 1
        const totalStationsGlobal = allStationsGlobal.length

        // Region rankings
        const regionStations = allStationsGlobal.filter((s) => s.region === stationRegionData!.regionName)
        const regionByImport = [...regionStations].sort((a, b) => b.supplyKwh - a.supplyKwh)
        const regionByExport = [...regionStations].sort((a, b) => b.reverseFlowKwh - a.reverseFlowKwh)
        const regionImportRank = regionByImport.findIndex((s) => s.station.toLowerCase() === stationProperCase.toLowerCase()) + 1
        const regionExportRank = regionByExport.findIndex((s) => s.station.toLowerCase() === stationProperCase.toLowerCase()) + 1
        const totalStationsInRegion = regionStations.length

        // Region contribution percentages
        const percentOfRegionImport = stationRegionData.regionTotal > 0
            ? (stationRegionData.stationData.supplyKwh / stationRegionData.regionTotal) * 100
            : 0
        const percentOfRegionExport = stationRegionData.regionExport > 0
            ? (stationRegionData.stationData.reverseFlowKwh / stationRegionData.regionExport) * 100
            : 0

        // Global contribution
        const globalTotalImport = globalBspAggregate.totalSupplyKwh || 0
        const globalTotalExport = globalBspAggregate.totalReverseFlowKwh || 0
        const percentOfGlobalImport = globalTotalImport > 0
            ? (stationRegionData.stationData.supplyKwh / globalTotalImport) * 100
            : 0
        const percentOfGlobalExport = globalTotalExport > 0
            ? (stationRegionData.stationData.reverseFlowKwh / globalTotalExport) * 100
            : 0

        // Average station import/export globally
        const avgGlobalImport = totalStationsGlobal > 0 ? globalTotalImport / totalStationsGlobal : 0
        const avgGlobalExport = totalStationsGlobal > 0 ? globalTotalExport / totalStationsGlobal : 0
        const vsAvgImport = avgGlobalImport > 0
            ? ((stationRegionData.stationData.supplyKwh - avgGlobalImport) / avgGlobalImport) * 100
            : 0
        const vsAvgExport = avgGlobalExport > 0
            ? ((stationRegionData.stationData.reverseFlowKwh - avgGlobalExport) / avgGlobalExport) * 100
            : 0

        // Efficiency: export as % of import
        const efficiency = stationRegionData.stationData.supplyKwh > 0
            ? (stationRegionData.stationData.reverseFlowKwh / stationRegionData.stationData.supplyKwh) * 100
            : 0

        // Top 10 stations for the ranking chart
        const topStationsImport = globalByImport.slice(0, Math.min(15, globalByImport.length)).map((s) => ({
            name: s.station,
            region: s.region,
            import: s.supplyKwh,
            export: s.reverseFlowKwh,
            isCurrentStation: s.station.toLowerCase() === stationProperCase.toLowerCase(),
        }))
        const topStationsExport = globalByExport.slice(0, Math.min(15, globalByExport.length)).map((s) => ({
            name: s.station,
            region: s.region,
            import: s.supplyKwh,
            export: s.reverseFlowKwh,
            isCurrentStation: s.station.toLowerCase() === stationProperCase.toLowerCase(),
        }))

        return {
            globalImportRank,
            globalExportRank,
            totalStationsGlobal,
            regionImportRank,
            regionExportRank,
            totalStationsInRegion,
            regionName: stationRegionData.regionName,
            regionTotal: stationRegionData.regionTotal,
            regionExportTotal: stationRegionData.regionExport,
            percentOfRegionImport,
            percentOfRegionExport,
            percentOfGlobalImport,
            percentOfGlobalExport,
            globalTotalImport,
            globalTotalExport,
            vsAvgImport,
            vsAvgExport,
            avgGlobalImport,
            avgGlobalExport,
            efficiency,
            topStationsImport,
            topStationsExport,
            allStationsGlobal: allStationsGlobal.sort((a, b) => b.supplyKwh - a.supplyKwh),
        }
    }, [globalBspAggregate, stationProperCase])

    // Import/Export balance per meter type for horizontal bar chart
    const meterTypeBalance = useMemo(() => {
        const data = []
        if (bspMetrics.import > 0 || bspMetrics.export > 0) {
            data.push({ name: "BSP", import: bspMetrics.import, export: bspMetrics.export })
        }
        if (pssMetrics.import > 0 || pssMetrics.export > 0) {
            data.push({ name: "PSS", import: pssMetrics.import, export: pssMetrics.export })
        }
        if (ssMetrics.import > 0 || ssMetrics.export > 0) {
            data.push({ name: "SS", import: ssMetrics.import, export: ssMetrics.export })
        }
        return data
    }, [bspMetrics, pssMetrics, ssMetrics])

    // Meter type breakdown for pie chart
    const meterTypeBreakdown = useMemo(() => {
        const data = []
        if (bspMetrics.import > 0) data.push({ name: "BSP", value: bspMetrics.import, fill: "#10b981" })
        if (pssMetrics.import > 0) data.push({ name: "PSS", value: pssMetrics.import, fill: "#f59e0b" })
        if (ssMetrics.import > 0) data.push({ name: "SS", value: ssMetrics.import, fill: "#8b5cf6" })
        return data
    }, [bspMetrics, pssMetrics, ssMetrics])

    // Daily trend data combining all meter types
    const dailyData = useMemo(() => {
        const dateMap = new Map<string, { bspImport: number; bspExport: number; pssImport: number; pssExport: number; ssImport: number; ssExport: number }>()

        const processRecords = (records: any[], prefix: "bsp" | "pss" | "ss") => {
            if (!records || !Array.isArray(records)) return
            records.forEach((record: any) => {
                const date = (record.consumption_date || "").split("T")[0]
                if (!date) return

                if (!dateMap.has(date)) {
                    dateMap.set(date, { bspImport: 0, bspExport: 0, pssImport: 0, pssExport: 0, ssImport: 0, ssExport: 0 })
                }
                const dayData = dateMap.get(date)!
                const consumption = record.consumed_energy || 0

                if (record.system_name === "import_kwh") {
                    dayData[`${prefix}Import` as keyof typeof dayData] += consumption
                } else if (record.system_name === "export_kwh") {
                    dayData[`${prefix}Export` as keyof typeof dayData] += consumption
                }
            })
        }

        processRecords(bspDailyData as any[], "bsp")
        processRecords(pssDailyData as any[], "pss")
        processRecords(ssDailyData as any[], "ss")

        return Array.from(dateMap.entries())
            .map(([date, data]) => ({
                date,
                formattedDate: format(parseISO(date), "MMM d"),
                bspImport: data.bspImport,
                bspExport: data.bspExport,
                pssImport: data.pssImport,
                pssExport: data.pssExport,
                ssImport: data.ssImport,
                ssExport: data.ssExport,
                totalImport: data.bspImport + data.pssImport + data.ssImport,
                totalExport: data.bspExport + data.pssExport + data.ssExport,
            }))
            .sort((a, b) => a.date.localeCompare(b.date))
    }, [bspDailyData, pssDailyData, ssDailyData])

    // Peak analysis
    const peakAnalysis = useMemo(() => {
        if (dailyData.length === 0) return { peakImportDay: null, peakExportDay: null }

        let peakImportDay: { date: string; value: number } | null = null
        let peakExportDay: { date: string; value: number } | null = null

        dailyData.forEach((day) => {
            if (!peakImportDay || day.totalImport > peakImportDay.value) {
                peakImportDay = { date: day.date, value: day.totalImport }
            }
            if (!peakExportDay || day.totalExport > peakExportDay.value) {
                peakExportDay = { date: day.date, value: day.totalExport }
            }
        })

        return { peakImportDay, peakExportDay }
    }, [dailyData])

    // Top contributing meters across all types
    const topContributingMeters = useMemo(() => {
        const allMeters: { meterNumber: string; type: string; import: number; export: number }[] = []

        bspMetrics.meterRows.forEach((row) => {
            allMeters.push({ meterNumber: row.meterNumber, type: "BSP", import: row.import, export: row.export })
        })
        pssMetrics.meterRows.forEach((row) => {
            allMeters.push({ meterNumber: row.meterNumber, type: "PSS", import: row.import, export: row.export })
        })
        ssMetrics.meterRows.forEach((row) => {
            allMeters.push({ meterNumber: row.meterNumber, type: "SS", import: row.import, export: row.export })
        })

        return allMeters.sort((a, b) => b.import - a.import).slice(0, 5)
    }, [bspMetrics, pssMetrics, ssMetrics])

    const toggleMetric = (metric: string) => {
        setSelectedMetrics((prev) =>
            prev.includes(metric) ? prev.filter((m) => m !== metric) : [...prev, metric]
        )
    }

    const isLoading = bspLoading || pssLoading || ssLoading

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-96 w-full" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <Link href={bspMetrics.region ? `/regions/${encodeURIComponent(bspMetrics.region.toLowerCase())}` : "/regions"}>
                        <Button variant="outline" size="sm" className="mb-2 bg-transparent">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to {bspMetrics.region ? toProperCase(bspMetrics.region) : "Regions"}
                        </Button>
                    </Link>
                    <h1 className="text-3xl font-bold">{toProperCase(station)}</h1>
                    <p className="text-muted-foreground">

                        {bspMetrics.region && <span className="ml-0.5">{toProperCase(bspMetrics.region)} Region</span>}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {stationAnalytics && (
                        <>
                            <Badge variant="secondary" className="text-sm px-3 py-1.5">
                                <Globe className="h-3.5 w-3.5 mr-1.5" />
                                #{stationAnalytics.globalImportRank} of {stationAnalytics.totalStationsGlobal} nationally
                            </Badge>
                            <Badge variant="outline" className="text-sm px-3 py-1.5">
                                <MapPin className="h-3.5 w-3.5 mr-1.5" />
                                #{stationAnalytics.regionImportRank} of {stationAnalytics.totalStationsInRegion} in {toProperCase(stationAnalytics.regionName)}
                            </Badge>
                        </>
                    )}
                    <Badge variant="outline" className="text-lg px-4 py-2">
                        {stationTotals.totalMeters} Meters
                    </Badge>
                </div>
            </div>

            {/* Summary Metrics */}
            <Card>
                <CardContent className="pt-6">
                    <Tabs defaultValue="summary" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-6">
                            <TabsTrigger value="summary">Summary Metrics</TabsTrigger>
                            <TabsTrigger value="peaks">Peak Analysis</TabsTrigger>
                        </TabsList>

                        <TabsContent value="summary">
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                            <TrendingUp className="h-4 w-4 text-green-600" />
                                            Total Import
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold text-green-600">{formatNumber(stationTotals.totalImport)}</div>
                                        <div className="h-px bg-border my-2" />
                                        <p className="text-xs text-muted-foreground">kWh | All meter types</p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                            <TrendingDown className="h-4 w-4 text-blue-600" />
                                            Total Export
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold text-blue-600">{formatNumber(stationTotals.totalExport)}</div>
                                        <div className="h-px bg-border my-2" />
                                        <p className="text-xs text-muted-foreground">kWh | All meter types</p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                            <Zap className="h-4 w-4 text-yellow-600" />
                                            Net Consumption
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold flex items-center gap-2">
                                            {stationTotals.net >= 0 ? (
                                                <TrendingUp className="h-5 w-5 text-green-600" />
                                            ) : (
                                                <TrendingDown className="h-5 w-5 text-blue-600" />
                                            )}
                                            {formatNumber(stationTotals.net)}
                                        </div>
                                        <div className="h-px bg-border my-2" />
                                        <p className="text-xs text-muted-foreground">kWh | Import - Export</p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                            <Activity className="h-4 w-4 text-purple-600" />
                                            Active Meters
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{stationTotals.totalMeters}</div>
                                        <div className="h-px bg-border my-2" />
                                        <p className="text-xs text-muted-foreground">
                                            BSP: {bspMetrics.uniqueMeters.size} | PSS: {pssMetrics.uniqueMeters.size} | SS: {ssMetrics.uniqueMeters.size}
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        <TabsContent value="peaks">
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">Peak Import Day</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold text-green-600">{formatNumber(peakAnalysis.peakImportDay?.value || 0)} kWh</div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {peakAnalysis.peakImportDay ? format(parseISO(peakAnalysis.peakImportDay.date), "MMM d, yyyy") : "N/A"}
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">Peak Export Day</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold text-blue-600">{formatNumber(peakAnalysis.peakExportDay?.value || 0)} kWh</div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {peakAnalysis.peakExportDay ? format(parseISO(peakAnalysis.peakExportDay.date), "MMM d, yyyy") : "N/A"}
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">Avg Daily Import</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold text-green-600">
                                            {dailyData.length > 0 ? formatNumber(stationTotals.totalImport / dailyData.length) : "0"} kWh
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">Over {dailyData.length} days</p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">Avg Daily Export</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold text-blue-600">
                                            {dailyData.length > 0 ? formatNumber(stationTotals.totalExport / dailyData.length) : "0"} kWh
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">Over {dailyData.length} days</p>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Station Insights Row: Comparison to Average + Efficiency + Top Meters */}
            {stationAnalytics && (
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Comparison to System Average */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <ArrowUpDown className="h-4 w-4" />
                                vs System Average
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <div className="flex items-center justify-between text-sm mb-1">
                                    <span className="text-muted-foreground">Import</span>
                                    <span className={`font-bold ${stationAnalytics.vsAvgImport >= 0 ? "text-green-600" : "text-red-600"}`}>
                                        {stationAnalytics.vsAvgImport >= 0 ? "+" : ""}{stationAnalytics.vsAvgImport.toFixed(1)}%
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Station: {formatNumber(bspMetrics.import)} kWh vs Avg: {formatNumber(stationAnalytics.avgGlobalImport)} kWh
                                </p>
                            </div>
                            <div className="h-px bg-border" />
                            <div>
                                <div className="flex items-center justify-between text-sm mb-1">
                                    <span className="text-muted-foreground">Export</span>
                                    <span className={`font-bold ${stationAnalytics.vsAvgExport >= 0 ? "text-blue-600" : "text-red-600"}`}>
                                        {stationAnalytics.vsAvgExport >= 0 ? "+" : ""}{stationAnalytics.vsAvgExport.toFixed(1)}%
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Station: {formatNumber(bspMetrics.export)} kWh vs Avg: {formatNumber(stationAnalytics.avgGlobalExport)} kWh
                                </p>
                            </div>
                            <div className="h-px bg-border" />
                            <div>
                                <div className="flex items-center justify-between text-sm mb-1">
                                    <span className="text-muted-foreground">Export/Import Ratio</span>
                                    <span className="font-bold">{stationAnalytics.efficiency.toFixed(2)}%</span>
                                </div>
                                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-1">
                                    <div
                                        className="h-full bg-blue-500 rounded-full transition-all duration-700"
                                        style={{ width: `${Math.min(stationAnalytics.efficiency, 100)}%` }}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {stationAnalytics.efficiency < 1 ? "Very low reverse flow" : stationAnalytics.efficiency < 5 ? "Low reverse flow" : "Significant reverse flow"}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Contribution Breakdown */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Percent className="h-4 w-4" />
                                Contribution
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Regional contribution */}
                            <div>
                                <div className="text-xs font-medium text-muted-foreground mb-2">Region: {toProperCase(stationAnalytics.regionName)}</div>
                                <div className="flex items-center justify-between text-sm mb-1">
                                    <span className="text-green-600">Import</span>
                                    <span className="font-bold text-green-600">{stationAnalytics.percentOfRegionImport.toFixed(1)}%</span>
                                </div>
                                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
                                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(stationAnalytics.percentOfRegionImport, 100)}%` }} />
                                </div>
                                <div className="flex items-center justify-between text-sm mb-1">
                                    <span className="text-blue-600">Export</span>
                                    <span className="font-bold text-blue-600">{stationAnalytics.percentOfRegionExport.toFixed(1)}%</span>
                                </div>
                                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(stationAnalytics.percentOfRegionExport, 100)}%` }} />
                                </div>
                            </div>
                            <div className="h-px bg-border" />
                            {/* Global contribution */}
                            <div>
                                <div className="text-xs font-medium text-muted-foreground mb-2">National (All Regions)</div>
                                <div className="flex items-center justify-between text-sm mb-1">
                                    <span className="text-green-600">Import</span>
                                    <span className="font-bold text-green-600">{stationAnalytics.percentOfGlobalImport.toFixed(2)}%</span>
                                </div>
                                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
                                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.max(stationAnalytics.percentOfGlobalImport * 5, 1)}%` }} />
                                </div>
                                <div className="flex items-center justify-between text-sm mb-1">
                                    <span className="text-blue-600">Export</span>
                                    <span className="font-bold text-blue-600">{stationAnalytics.percentOfGlobalExport.toFixed(2)}%</span>
                                </div>
                                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.max(stationAnalytics.percentOfGlobalExport * 5, 1)}%` }} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Top Contributing Meters */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Trophy className="h-4 w-4" />
                                Top Meters at Station
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {topContributingMeters.length > 0 ? (
                                <div className="space-y-3">
                                    {topContributingMeters.map((meter, index) => {
                                        const maxImport = topContributingMeters[0]?.import || 1
                                        const barWidth = (meter.import / maxImport) * 100
                                        return (
                                            <div key={meter.meterNumber}>
                                                <div className="flex items-center justify-between text-sm mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-muted-foreground w-5">#{index + 1}</span>
                                                        <Link href={`/meters/${meter.meterNumber}`} className="text-primary hover:underline text-xs font-medium">
                                                            {meter.meterNumber}
                                                        </Link>
                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{meter.type}</Badge>
                                                    </div>
                                                    <span className="text-xs font-medium text-green-600">{formatNumber(meter.import)}</span>
                                                </div>
                                                <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${barWidth}%` }} />
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="h-[200px] flex items-center justify-center text-muted-foreground">No data available</div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Station Ranking + Import/Export by Meter Type */}
            {stationAnalytics && (
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Global Station Ranking Chart */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <BarChart3 className="h-4 w-4" />
                                    Station Ranking (All Regions)
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant={rankingSort === "import" ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setRankingSort("import")}
                                    >
                                        Import
                                    </Button>
                                    <Button
                                        variant={rankingSort === "export" ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setRankingSort("export")}
                                    >
                                        Export
                                    </Button>
                                    {/* Full Ranking Dialog */}

                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm">View All</Button>
                                        </DialogTrigger>
                                        <DialogContent
                                            className="max-h-[80vh] overflow-y-auto"
                                            style={{ maxWidth: '800px' }}
                                        >
                                            <DialogHeader>
                                                <DialogTitle>All Station Rankings - By {rankingSort === "import" ? "Import" : "Export"}</DialogTitle>
                                            </DialogHeader>

                                            {/* Filter input */}
                                            <div className="flex items-center gap-4 py-4">
                                                <div className="relative flex-1">
                                                    <input
                                                        type="text"
                                                        placeholder="Filter by station name or region."
                                                        value={stationFilter}
                                                        onChange={(e) => setStationFilter(e.target.value)}
                                                        className="w-full px-4 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                                                    />
                                                    {stationFilter && (
                                                        <button
                                                            onClick={() => setStationFilter("")}
                                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-12">Rank</TableHead>
                                                        <TableHead>Station</TableHead>
                                                        <TableHead>Region</TableHead>
                                                        <TableHead className="text-right">Import (kWh)</TableHead>
                                                        <TableHead className="text-right">Export (kWh)</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {[...stationAnalytics.allStationsGlobal]
                                                        .sort((a, b) => rankingSort === "import" ? b.supplyKwh - a.supplyKwh : b.reverseFlowKwh - a.reverseFlowKwh)
                                                        .filter((s) => {
                                                            if (!stationFilter) return true
                                                            const searchTerm = stationFilter.toLowerCase()
                                                            return (
                                                                s.station.toLowerCase().includes(searchTerm) ||
                                                                s.region.toLowerCase().includes(searchTerm)
                                                            )
                                                        })
                                                        .map((s, index) => {
                                                            const isCurrent = s.station.toLowerCase() === stationProperCase.toLowerCase()
                                                            return (
                                                                <TableRow key={s.station} className={isCurrent ? "bg-green-50 dark:bg-green-950 font-bold" : ""}>
                                                                    <TableCell className="font-bold">{index + 1}</TableCell>
                                                                    <TableCell>
                                                                        {isCurrent ? (
                                                                            <span className="text-green-600 flex items-center gap-1 capitalize">
                                            <Star className="h-3.5 w-3.5" />
                                                                                {s.station}
                                        </span>
                                                                        ) : (
                                                                            <Link href={`/stations/${encodeURIComponent(s.station.toLowerCase())}`} className="text-primary capitalize hover:underline">
                                                                                {s.station}
                                                                            </Link>
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="capitalize">{s.region}</TableCell>
                                                                    <TableCell className="text-right text-green-600">{formatNumber(s.supplyKwh)}</TableCell>
                                                                    <TableCell className="text-right text-blue-600">{formatNumber(s.reverseFlowKwh)}</TableCell>
                                                                </TableRow>
                                                            )
                                                        })}
                                                    {stationFilter && [...stationAnalytics.allStationsGlobal].filter((s) =>
                                                        s.station.toLowerCase().includes(stationFilter.toLowerCase()) ||
                                                        s.region.toLowerCase().includes(stationFilter.toLowerCase())
                                                    ).length === 0 && (
                                                        <TableRow>
                                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                                No stations found matching "{stationFilter}"
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                            <div className="text-xs text-muted-foreground text-right">
                                                Showing {[...stationAnalytics.allStationsGlobal].filter((s) =>
                                                !stationFilter ||
                                                s.station.toLowerCase().includes(stationFilter.toLowerCase()) ||
                                                s.region.toLowerCase().includes(stationFilter.toLowerCase())
                                            ).length} of {stationAnalytics.allStationsGlobal.length} stations
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div style={{ width: "100%", height: 400 }}>
                                <ResponsiveContainer>
                                    <BarChart
                                        data={rankingSort === "import" ? stationAnalytics.topStationsImport : stationAnalytics.topStationsExport}
                                        layout="vertical"
                                    >
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                                        <XAxis type="number" className="text-xs" tickFormatter={(v) => formatNumber(v)} />
                                        <YAxis
                                            dataKey="name"
                                            type="category"
                                            className="text-xs"
                                            width={100}
                                            tickFormatter={(str) => str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())}
                                        />
                                        <Tooltip
                                            formatter={(value: number) => `${formatNumber(value)} kWh`}
                                            labelFormatter={(label) => label.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())}
                                        />
                                        <Bar dataKey={rankingSort} name={rankingSort === "import" ? "Import" : "Export"} radius={[0, 4, 4, 0]}>
                                            {(rankingSort === "import" ? stationAnalytics.topStationsImport : stationAnalytics.topStationsExport).map((entry: any, index: number) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={entry.isCurrentStation ? (rankingSort === "import" ? "#10b981" : "#3b82f6") : "#d1d5db"}
                                                    stroke={entry.isCurrentStation ? (rankingSort === "import" ? "#059669" : "#2563eb") : "none"}
                                                    strokeWidth={entry.isCurrentStation ? 2 : 0}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>


                            </div>
                            <p className="text-xs text-muted-foreground text-center mt-2">
                                Top {(rankingSort === "import" ? stationAnalytics.topStationsImport : stationAnalytics.topStationsExport).length} stations nationally by BSP {rankingSort}. Current station highlighted.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Import vs Export by Meter Type + Pie */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Energy Breakdown</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Pie Chart */}
                            {meterTypeBreakdown.length > 0 && (
                                <div>
                                    <div className="text-sm text-muted-foreground mb-2 font-medium">Import by Meter Type</div>
                                    <div className="flex items-center gap-4">
                                        <div style={{ width: 160, height: 160 }}>
                                            <ResponsiveContainer>
                                                <PieChart>
                                                    <Pie
                                                        data={meterTypeBreakdown}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={40}
                                                        outerRadius={70}
                                                        paddingAngle={2}
                                                        dataKey="value"
                                                    >
                                                        {meterTypeBreakdown.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip formatter={(value: number) => `${formatNumber(value)} kWh`} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="space-y-2 flex-1">
                                            {meterTypeBreakdown.map((item) => (
                                                <div key={item.name} className="flex items-center justify-between text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }} />
                                                        <span>{item.name}</span>
                                                    </div>
                                                    <span className="font-medium">{formatNumber(item.value)} kWh</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Import vs Export bar chart */}
                            {meterTypeBalance.length > 0 && (
                                <div>
                                    <div className="text-sm text-muted-foreground mb-2 font-medium">Import vs Export by Meter Type</div>
                                    <div style={{ width: "100%", height: 140 }}>
                                        <ResponsiveContainer>
                                            <BarChart data={meterTypeBalance} layout="vertical">
                                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                                                <XAxis type="number" className="text-xs" tickFormatter={(v) => formatNumber(v)} />
                                                <YAxis dataKey="name" type="category" className="text-xs" width={40} />
                                                <Tooltip formatter={(value: number) => `${formatNumber(value)} kWh`} />
                                                <Bar dataKey="import" fill="#10b981" name="Import" radius={[0, 4, 4, 0]} />
                                                <Bar dataKey="export" fill="#3b82f6" name="Export" radius={[0, 4, 4, 0]} />
                                                <Legend />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Consumption Trend Chart */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-base">Daily Consumption Trend</CardTitle>
                        <div className="flex gap-2 flex-wrap">
                            {[
                                { key: "totalImport", label: "Total Import", color: "#10b981" },
                                { key: "totalExport", label: "Total Export", color: "#3b82f6" },
                                { key: "bspImport", label: "BSP Import", color: "#059669" },
                                { key: "bspExport", label: "BSP Export", color: "#2563eb" },
                                { key: "pssImport", label: "PSS Import", color: "#34d399" },
                                { key: "pssExport", label: "PSS Export", color: "#60a5fa" },
                                { key: "ssImport", label: "SS Import", color: "#6ee7b7" },
                                { key: "ssExport", label: "SS Export", color: "#93c5fd" },
                            ].map((item) => (
                                <label key={item.key} className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedMetrics.includes(item.key)}
                                        onChange={() => toggleMetric(item.key)}
                                        className="w-3 h-3 rounded"
                                    />
                                    <span className="text-xs font-medium" style={{ color: item.color }}>{item.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {dailyData.length > 0 ? (
                        <div style={{ width: "100%", height: 300 }}>
                            <ResponsiveContainer>
                                <AreaChart data={dailyData}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis dataKey="formattedDate" className="text-xs" interval="preserveStartEnd" />
                                    <YAxis className="text-xs" />
                                    <Tooltip
                                        formatter={(value: number, name: string) => [`${formatNumber(value)} kWh`, name]}
                                        labelFormatter={(label) => `Date: ${label}`}
                                    />
                                    {selectedMetrics.includes("totalImport") && (
                                        <Area type="monotone" dataKey="totalImport" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} name="Total Import" />
                                    )}
                                    {selectedMetrics.includes("totalExport") && (
                                        <Area type="monotone" dataKey="totalExport" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} name="Total Export" />
                                    )}
                                    {selectedMetrics.includes("bspImport") && (
                                        <Area type="monotone" dataKey="bspImport" stroke="#059669" fill="#059669" fillOpacity={0.1} name="BSP Import" />
                                    )}
                                    {selectedMetrics.includes("bspExport") && (
                                        <Area type="monotone" dataKey="bspExport" stroke="#2563eb" fill="#2563eb" fillOpacity={0.1} name="BSP Export" />
                                    )}
                                    {selectedMetrics.includes("pssImport") && (
                                        <Area type="monotone" dataKey="pssImport" stroke="#34d399" fill="#34d399" fillOpacity={0.1} name="PSS Import" />
                                    )}
                                    {selectedMetrics.includes("pssExport") && (
                                        <Area type="monotone" dataKey="pssExport" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.1} name="PSS Export" />
                                    )}
                                    {selectedMetrics.includes("ssImport") && (
                                        <Area type="monotone" dataKey="ssImport" stroke="#6ee7b7" fill="#6ee7b7" fillOpacity={0.1} name="SS Import" />
                                    )}
                                    {selectedMetrics.includes("ssExport") && (
                                        <Area type="monotone" dataKey="ssExport" stroke="#93c5fd" fill="#93c5fd" fillOpacity={0.1} name="SS Export" />
                                    )}
                                    <Legend />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data available</div>
                    )}
                </CardContent>
            </Card>

            {/* BSP Meter Details - Flat Table */}
            {bspMetrics.meterRows.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                            BSP Meters ({bspMetrics.uniqueMeters.size})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Feeder Panel</TableHead>
                                    <TableHead>Meter Number</TableHead>
                                    <TableHead className="text-right">Import (kWh)</TableHead>
                                    <TableHead className="text-right">Export (kWh)</TableHead>
                                    <TableHead className="text-right">Net (kWh)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {bspMetrics.meterRows.map((row) => (
                                    <TableRow key={`bsp-${row.feeder}-${row.meterNumber}`}>
                                        <TableCell className="font-medium">{row.feeder}</TableCell>
                                        <TableCell>
                                            <Link href={`/meters/${row.meterNumber}`} className="text-primary hover:underline">
                                                {row.meterNumber}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-right text-green-600 font-medium">{formatNumber(row.import,2)}</TableCell>
                                        <TableCell className="text-right text-blue-600 font-medium">{formatNumber(row.export,2)}</TableCell>
                                        <TableCell className="text-right font-medium">{formatNumber(row.import - row.export,2)}</TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="font-bold border-t-2">
                                    <TableCell colSpan={2}>Totals</TableCell>
                                    <TableCell className="text-right text-lg text-green-600">{formatNumber(bspMetrics.import,2)}</TableCell>
                                    <TableCell className="text-right text-lg text-blue-600">{formatNumber(bspMetrics.export,2)}</TableCell>
                                    <TableCell className="text-right text-lg">{formatNumber(bspMetrics.net,2)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* PSS Meter Details - Flat Table */}
            {pssMetrics.meterRows.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-amber-500" />
                            PSS Meters ({pssMetrics.uniqueMeters.size})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Feeder Panel</TableHead>
                                    <TableHead>Meter Number</TableHead>
                                    <TableHead className="text-right">Import (kWh)</TableHead>
                                    <TableHead className="text-right">Export (kWh)</TableHead>
                                    <TableHead className="text-right">Net (kWh)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pssMetrics.meterRows.map((row) => (
                                    <TableRow key={`pss-${row.feeder}-${row.meterNumber}`}>
                                        <TableCell className="font-medium">{row.feeder}</TableCell>
                                        <TableCell>
                                            <Link href={`/meters/${row.meterNumber}`} className="text-primary hover:underline">
                                                {row.meterNumber}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-right text-green-600 font-medium">{formatNumber(row.import)}</TableCell>
                                        <TableCell className="text-right text-blue-600 font-medium">{formatNumber(row.export)}</TableCell>
                                        <TableCell className="text-right font-medium">{formatNumber(row.import - row.export)}</TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="font-bold border-t-2">
                                    <TableCell colSpan={2}>Total PSS</TableCell>
                                    <TableCell className="text-right text-green-600">{formatNumber(pssMetrics.import)}</TableCell>
                                    <TableCell className="text-right text-blue-600">{formatNumber(pssMetrics.export)}</TableCell>
                                    <TableCell className="text-right">{formatNumber(pssMetrics.net)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* SS Meter Details - Flat Table */}
            {ssMetrics.meterRows.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-purple-500" />
                            SS Meters ({ssMetrics.uniqueMeters.size})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Meter Number</TableHead>
                                    <TableHead className="text-right">Import (kWh)</TableHead>
                                    <TableHead className="text-right">Export (kWh)</TableHead>
                                    <TableHead className="text-right">Net (kWh)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {ssMetrics.meterRows.map((row) => (
                                    <TableRow key={`ss-${row.meterNumber}`}>
                                        <TableCell>
                                            <Link href={`/meters/${row.meterNumber}`} className="text-primary hover:underline">
                                                {row.meterNumber}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-right text-green-600 font-medium">{formatNumber(row.import)}</TableCell>
                                        <TableCell className="text-right text-blue-600 font-medium">{formatNumber(row.export)}</TableCell>
                                        <TableCell className="text-right font-medium">{formatNumber(row.import - row.export)}</TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="font-bold border-t-2">
                                    <TableCell>Total SS</TableCell>
                                    <TableCell className="text-right text-green-600">{formatNumber(ssMetrics.import)}</TableCell>
                                    <TableCell className="text-right text-blue-600">{formatNumber(ssMetrics.export)}</TableCell>
                                    <TableCell className="text-right">{formatNumber(ssMetrics.net)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
