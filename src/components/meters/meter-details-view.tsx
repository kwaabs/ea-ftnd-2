"use client"
// MeterDetailsView - meter detail page component
import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format, parseISO, subDays, subMonths } from "date-fns"
import { ArrowLeft, MapPin, Zap, Activity, Calendar, Hash, Building2, Network } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"

import { useSingleMeter } from "@/hooks/api/use-single-meter-api"
import { useMeterConsumption } from "@/hooks/api/use-meter-consumption-api"
import { useSingleMeterStatus } from "@/hooks/api/use-meter-status-api"
import { useMeters } from "@/hooks/api/use-meter-api"
import { useAppStore } from "@/stores/app-store"
import { formatNumber } from "@/lib/utils"

import { MeterConsumptionChart } from "./meter-consumption-chart"
import { MeterStatusTrend } from "./meter-status-trend"
import { MeterInsightsCharts } from "./meter-insights-charts"
import { RelatedMeters } from "./related-meters"

interface MeterDetailsViewProps {
    meterNumber: string
}

export function MeterDetailsView({ meterNumber }: MeterDetailsViewProps) {
    const router = useRouter()
    const { filters } = useAppStore()
    const [comparisonMode, setComparisonMode] = useState<"week" | "month">("week")

    // Date range from filters or default to last 30 days
    const dateRange = useMemo(() => {
        const formatDate = (date: Date | string | undefined, fallback: Date): string => {
            if (!date) return fallback.toISOString().split("T")[0]
            if (date instanceof Date) return date.toISOString().split("T")[0]
            return typeof date === "string" && date.includes("T") ? date.split("T")[0] : (date as string)
        }
        const defaultEnd = new Date()
        const defaultStart = subDays(defaultEnd, 30)
        return {
            start: formatDate(filters.dateRange?.start, defaultStart),
            end: formatDate(filters.dateRange?.end, defaultEnd),
        }
    }, [filters.dateRange])

    // Comparison period (previous week or previous month)
    const comparisonRange = useMemo(() => {
        try {
            const start = parseISO(dateRange.start)
            const end = parseISO(dateRange.end)
            if (comparisonMode === "week") {
                return {
                    start: subDays(start, 7).toISOString().split("T")[0],
                    end: subDays(end, 7).toISOString().split("T")[0],
                }
            }
            return {
                start: subMonths(start, 1).toISOString().split("T")[0],
                end: subMonths(end, 1).toISOString().split("T")[0],
            }
        } catch (error) {
            console.error("Error calculating comparison range:", error)
            return {
                start: dateRange.start,
                end: dateRange.end,
            }
        }
    }, [dateRange, comparisonMode])

    // Fetch meter details
    const { data: meter, isLoading: meterLoading } = useSingleMeter(meterNumber)

    // Fetch consumption data
    const { data: rawConsumptionData, isLoading: consumptionLoading } = useMeterConsumption({
        meterNumber,
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
    })

    // Safely process consumption data
    const consumptionData: any[] = useMemo(() => {
        if (!rawConsumptionData) return []

        // Handle array response
        if (Array.isArray(rawConsumptionData)) {
            return rawConsumptionData.filter(item => item != null)
        }

        // Handle object with data property
        if (rawConsumptionData && typeof rawConsumptionData === 'object') {
            const data = (rawConsumptionData as any).data
            if (Array.isArray(data)) {
                return data.filter(item => item != null)
            }
        }

        return []
    }, [rawConsumptionData])

    // Fetch comparison period data
    const { data: rawComparisonData } = useMeterConsumption({
        meterNumber,
        dateFrom: comparisonRange.start,
        dateTo: comparisonRange.end,
    })

    // Safely process comparison data
    const comparisonData: any[] = useMemo(() => {
        if (!rawComparisonData) return []

        if (Array.isArray(rawComparisonData)) {
            return rawComparisonData.filter(item => item != null)
        }

        if (rawComparisonData && typeof rawComparisonData === 'object') {
            const data = (rawComparisonData as any).data
            if (Array.isArray(data)) {
                return data.filter(item => item != null)
            }
        }

        return []
    }, [rawComparisonData])

    // Fetch status data
    const { data: rawStatusData = [], isLoading: statusLoading } = useSingleMeterStatus({
        meterNumber,
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
    })

    // Safely process status data
    const statusData = useMemo(() => {
        if (!rawStatusData) return []
        return Array.isArray(rawStatusData) ? rawStatusData.filter(item => item != null) : []
    }, [rawStatusData])

    // Fetch related meters (same station/boundary/district)
    const relatedParams = useMemo(() => {
        if (!meter) return null
        if (meter.station) return { station: meter.station, limit: 10 }
        if (meter.boundary_metering_point) return { boundary_metering_point: meter.boundary_metering_point, limit: 10 }
        if (meter.district) return { district: meter.district, limit: 10 }
        return null
    }, [meter])

    const { data: relatedMetersData } = useMeters(
        relatedParams
            ? {
                ...relatedParams,
                meter_type: meter?.meter_type,
            }
            : null,
    )

    const relatedMeters = useMemo(() => {
        const list = relatedMetersData?.data?.data
        if (!Array.isArray(list)) return []
        return list.filter((m: any) => m && m.meter_number !== meterNumber)
    }, [relatedMetersData, meterNumber])

    const relatedFilterType: "station" | "boundary" | "district" = meter?.station
        ? "station"
        : meter?.boundary_metering_point
            ? "boundary"
            : "district"

    // Consumption summary stats with null handling
    const stats = useMemo(() => {
        let totalImport = 0
        let totalExport = 0
        const days = new Set<string>()

        if (!consumptionData || consumptionData.length === 0) {
            return {
                totalImport: 0,
                totalExport: 0,
                net: 0,
                avgDailyImport: 0,
                dayCount: 0,
            }
        }

        consumptionData.forEach((row: any) => {
            if (!row) return

            const date = row.consumption_date?.split("T")[0]
            if (date) days.add(date)

            const energy = row.consumed_energy || 0
            if (row.system_name === "import_kwh") totalImport += energy
            else if (row.system_name === "export_kwh") totalExport += energy
        })

        const dayCount = days.size || 1
        return {
            totalImport,
            totalExport,
            net: totalImport - totalExport,
            avgDailyImport: totalImport / dayCount,
            dayCount,
        }
    }, [consumptionData])

    const isLoading = meterLoading

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-28" />
                    ))}
                </div>
                <Skeleton className="h-96" />
            </div>
        )
    }

    if (!meter) {
        return (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <Activity className="h-16 w-16 text-muted-foreground opacity-30" />
                <p className="text-xl font-semibold">Meter not found</p>
                <p className="text-sm text-muted-foreground">No meter found with number {meterNumber}</p>
                <Button variant="outline" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Go Back
                </Button>
            </div>
        )
    }

    const meterTypeLabel: Record<string, string> = {
        BSP: "BSP Incomer",
        DTX: "Distribution Transformer",
        REGIONAL_BOUNDARY: "Regional Boundary",
        DISTRICT_BOUNDARY: "District Boundary",
        FEEDERS_TRAFO: "Feeder Transformer",
        STANDARD: "Standard",
    }

    const meterTypeBadgeColor: Record<string, string> = {
        BSP: "bg-blue-100 text-blue-800",
        DTX: "bg-purple-100 text-purple-800",
        REGIONAL_BOUNDARY: "bg-green-100 text-green-800",
        DISTRICT_BOUNDARY: "bg-orange-100 text-orange-800",
        FEEDERS_TRAFO: "bg-yellow-100 text-yellow-800",
        STANDARD: "bg-gray-100 text-gray-800",
    }

    // Safely determine status display
    const status = meter.status || "Unknown"
    const isOnline = status.toLowerCase() === "online" || status.toLowerCase() === "operational"

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold font-mono">{meter.meter_number || meterNumber}</h1>
                            <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${meterTypeBadgeColor[meter.meter_type] || meterTypeBadgeColor.STANDARD}`}
                            >
                                {meterTypeLabel[meter.meter_type] || meter.meter_type || "Unknown"}
                            </span>
                            <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    isOnline
                                        ? "bg-green-100 text-green-800"
                                        : "bg-red-100 text-red-800"
                                }`}
                            >
                                {status}
                            </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                            {meter.region && (
                                <Link
                                    href={`/regions/${meter.region.toLowerCase().replace(/\s+/g, "-")}`}
                                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                                >
                                    <MapPin className="h-3.5 w-3.5" />
                                    {meter.region}
                                </Link>
                            )}
                            {meter.district && (
                                <span className="flex items-center gap-1">
                                    <Building2 className="h-3.5 w-3.5" />
                                    {meter.district}
                                </span>
                            )}
                            {meter.station && (
                                <Link
                                    href={`/stations/${encodeURIComponent(meter.station)}`}
                                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                                >
                                    <Zap className="h-3.5 w-3.5" />
                                    {meter.station}
                                </Link>
                            )}
                            {meter.boundary_metering_point && (
                                <span className="flex items-center gap-1">
                                    <Network className="h-3.5 w-3.5" />
                                    {meter.boundary_metering_point}
                                </span>
                            )}
                            {meter.location && (
                                <span className="flex items-center gap-1">
                                    <Hash className="h-3.5 w-3.5" />
                                    {meter.location}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                        {format(parseISO(dateRange.start), "MMM d")} – {format(parseISO(dateRange.end), "MMM d, yyyy")}
                    </span>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Import</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {consumptionLoading ? (
                            <Skeleton className="h-8 w-32" />
                        ) : (
                            <>
                                <p className="text-2xl font-bold text-green-600">{formatNumber(stats.totalImport, 2)}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {stats.dayCount > 0 ? `kWh over ${stats.dayCount} days` : "No data available"}
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Export</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {consumptionLoading ? (
                            <Skeleton className="h-8 w-32" />
                        ) : (
                            <>
                                <p className="text-2xl font-bold text-blue-600">{formatNumber(stats.totalExport, 2)}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {stats.totalExport > 0 ? "kWh reverse flow" : "No reverse flow"}
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Net Consumption</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {consumptionLoading ? (
                            <Skeleton className="h-8 w-32" />
                        ) : (
                            <>
                                <p className={`text-2xl font-bold ${stats.net >= 0 ? "text-foreground" : "text-blue-600"}`}>
                                    {formatNumber(stats.net, 2)}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {stats.net >= 0 ? "kWh net import" : "kWh net export"}
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Avg Daily Import</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {consumptionLoading ? (
                            <Skeleton className="h-8 w-32" />
                        ) : (
                            <>
                                <p className="text-2xl font-bold">{formatNumber(stats.avgDailyImport, 2)}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {stats.dayCount > 0 ? "kWh / day" : "No data available"}
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Left: Tabs */}
                <div className="lg:col-span-3 space-y-4">
                    <Tabs defaultValue="consumption">
                        <div className="flex items-center justify-between">
                            <TabsList>
                                <TabsTrigger value="consumption">Consumption</TabsTrigger>
                                <TabsTrigger value="insights">Insights</TabsTrigger>
                            </TabsList>

                            {/* Comparison toggle */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Compare vs:</span>
                                <div className="flex gap-1">
                                    <Button
                                        variant={comparisonMode === "week" ? "default" : "outline"}
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => setComparisonMode("week")}
                                    >
                                        Prev Week
                                    </Button>
                                    <Button
                                        variant={comparisonMode === "month" ? "default" : "outline"}
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => setComparisonMode("month")}
                                    >
                                        Prev Month
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <TabsContent value="consumption" className="mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Daily Consumption</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {consumptionLoading ? (
                                        <Skeleton className="h-96" />
                                    ) : (
                                        <MeterConsumptionChart
                                            data={consumptionData}
                                            comparisonData={comparisonData}
                                            comparisonMode={comparisonMode}
                                            filenamePrefix={meterNumber}
                                        />
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="insights" className="mt-4">
                            {consumptionLoading || statusLoading ? (
                                <Skeleton className="h-96" />
                            ) : (
                                <MeterInsightsCharts
                                    consumptionData={consumptionData}
                                    statusData={statusData}
                                    filenamePrefix={meterNumber}
                                />
                            )}
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Right: Status + Related */}
                <div className="space-y-4">
                    <MeterStatusTrend
                        statusData={statusData}
                        isLoading={statusLoading}
                        filenamePrefix={meterNumber}
                    />

                    {relatedMeters.length > 0 && (
                        <RelatedMeters
                            meters={relatedMeters}
                            currentMeterType={meter.meter_type}
                            filterType={relatedFilterType}
                            filenamePrefix={meterNumber}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}