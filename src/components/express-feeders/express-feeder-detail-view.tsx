"use client"

import { useMemo, useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { subDays, format, parseISO } from "date-fns"
import {
    ArrowLeft,
    Zap,
    ArrowRight,
    Calendar,
    MapPin,
    Cpu,
    PlugZap,
    Activity,
    TrendingUp,
    TrendingDown,
    Minus,
    Building2,
    Network,
    AlertTriangle,
    CheckCircle2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
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

import {
    useExpressFeederAggregate,
    useExpressFeederDaily,
    type FeederDetail,
} from "@/hooks/api/use-express-feeder-api"
import { useAppStore } from "@/stores/app-store"
import { formatNumber } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(v: number) {
    return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function yAxisFmt(v: number) {
    const abs = Math.abs(v)
    if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}k`
    return v.toFixed(0)
}

function NetIcon({ value }: { value: number }) {
    if (value > 0) return <TrendingUp className="h-4 w-4 text-green-600" />
    if (value < 0) return <TrendingDown className="h-4 w-4 text-red-600" />
    return <Minus className="h-4 w-4 text-muted-foreground" />
}

function netCls(v: number) {
    return v > 0 ? "text-green-700" : v < 0 ? "text-red-600" : "text-muted-foreground"
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({
                     label,
                     value,
                     unit,
                     sub,
                     color,
                     icon,
                 }: {
    label: string
    value: string
    unit?: string
    sub?: string
    color?: string
    icon?: React.ReactNode
}) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    {icon}
                    {label}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className={`text-2xl font-bold tabular-nums ${color ?? ""}`}>{value}</p>
                {unit && <p className="text-xs text-muted-foreground mt-1">{unit}{sub ? ` — ${sub}` : ""}</p>}
            </CardContent>
        </Card>
    )
}

function StationPanel({
                          role,
                          meter,
                          accentClass,
                      }: {
    role: "Sending" | "Receiving"
    meter: FeederDetail["sendingMeter"]
    accentClass: string
}) {
    return (
        <Card className={`border-l-4 ${accentClass}`}>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Cpu className="h-4 w-4" />
              {role} Meter
          </span>
                    <Badge variant="outline" className="font-mono text-xs">{meter.stationCode || meter.sapVersion || "—"}</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Station identity */}
                <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                        <Link
                            href={`/stations/${encodeURIComponent(meter.station)}`}
                            className="font-semibold text-sm hover:underline text-foreground"
                        >
                            {meter.station}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {meter.stationType}{meter.stationCode ? ` · ${meter.stationCode}` : ""}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {meter.region && (
                        <Link
                            href={`/regions/${meter.region.toLowerCase().replace(/\s+/g, "-")}`}
                            className="flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                            <Building2 className="h-3.5 w-3.5" />
                            {meter.region}
                        </Link>
                    )}
                    {meter.district && (
                        <span className="flex items-center gap-1">
              <Network className="h-3.5 w-3.5" />
                            {meter.district}
            </span>
                    )}
                </div>

                <Separator />

                {/* Readings grid */}
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">Import</p>
                        <p className="text-sm font-bold text-green-700 tabular-nums">{fmt(meter.importKwh)}</p>
                        <p className="text-[10px] text-muted-foreground">kWh</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">Export</p>
                        <p className="text-sm font-bold text-blue-700 tabular-nums">{fmt(meter.exportKwh)}</p>
                        <p className="text-[10px] text-muted-foreground">kWh</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">Net</p>
                        <p className={`text-sm font-bold tabular-nums ${netCls(meter.netKwh)}`}>{fmt(meter.netKwh)}</p>
                        <p className="text-[10px] text-muted-foreground">kWh</p>
                    </div>
                </div>

                {/* Meter number */}
                {meter.meterNumber && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <PlugZap className="h-3 w-3 shrink-0" />
                        <span>Meter No:</span>
                        <span className="font-mono font-semibold text-foreground">{meter.meterNumber}</span>
                    </div>
                )}

                {/* Import share bar */}
                {(meter.importKwh + meter.exportKwh) > 0 && (
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Import share</span>
                            <span className="font-semibold">
                {((meter.importKwh / (meter.importKwh + meter.exportKwh)) * 100).toFixed(1)}%
              </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-blue-200 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-green-500"
                                style={{ width: `${(meter.importKwh / (meter.importKwh + meter.exportKwh)) * 100}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span className="text-green-700">Import</span>
                            <span className="text-blue-700">Export</span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

interface ExpressFeederDetailViewProps {
    feederName: string
}

export function ExpressFeederDetailView({ feederName }: ExpressFeederDetailViewProps) {
    const router = useRouter()
    const { filters, updateFilter } = useAppStore()
    const [activeTab, setActiveTab] = useState("overview")

    useEffect(() => {
        updateFilter("activeTab", "express-feeder-detail")
    }, [])

    const dateRange = useMemo(() => {
        const fmt = (d: Date | string | undefined, fallback: Date): string => {
            if (!d) return fallback.toISOString().split("T")[0]
            if (d instanceof Date) return d.toISOString().split("T")[0]
            return typeof d === "string" && d.includes("T") ? d.split("T")[0] : (d as string)
        }
        const defaultEnd = new Date()
        const defaultStart = subDays(defaultEnd, 30)
        return {
            start: fmt(filters.dateRange?.start, defaultStart),
            end: fmt(filters.dateRange?.end, defaultEnd),
        }
    }, [filters.dateRange])

    const decodedName = decodeURIComponent(feederName)

    const { data: aggregateData, isLoading: aggregateLoading } = useExpressFeederAggregate({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
    })

    const { data: dailyRaw = [], isLoading: dailyLoading } = useExpressFeederDaily({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
    })

    const feeder = useMemo(() => {
        if (!aggregateData?.feederBreakdown) return null
        return (
            aggregateData.feederBreakdown.find(
                (f) => f.feederName.toLowerCase() === decodedName.toLowerCase()
            ) ?? null
        )
    }, [aggregateData, decodedName])

    // Build daily chart data for this feeder — new API: one record per feeder per day
    // with nested sending_meter / receiving_meter objects
    const dailyChartData = useMemo(() => {
        if (!feeder) return []
        // Match by feeder_name (new API key)
        const filtered = dailyRaw.filter((r: any) =>
            r.feeder_name === feeder.feederName
        )

        const dateMap = new Map<string, { date: string; sendingImport: number; sendingExport: number; receivingImport: number; receivingExport: number; netFlow: number }>()

        filtered.forEach((r: any) => {
            const date = (r.consumption_date ?? r.group_period)?.split("T")[0]
            if (!date) return
            if (!dateMap.has(date)) dateMap.set(date, { date, sendingImport: 0, sendingExport: 0, receivingImport: 0, receivingExport: 0, netFlow: 0 })
            const e = dateMap.get(date)!
            e.sendingImport += r.sending_meter?.import_kwh || 0
            e.sendingExport += r.sending_meter?.export_kwh || 0
            e.receivingImport += r.receiving_meter?.import_kwh || 0
            e.receivingExport += r.receiving_meter?.export_kwh || 0
        })

        return Array.from(dateMap.values())
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((d) => ({ ...d, netFlow: d.sendingImport - d.receivingImport }))
    }, [dailyRaw, feeder])

    // Imbalance metrics
    const imbalance = useMemo(() => {
        if (!feeder) return null
        const importGap = feeder.sendingMeter.importKwh - feeder.receivingMeter.importKwh
        const exportGap = feeder.sendingMeter.exportKwh - feeder.receivingMeter.exportKwh
        const lossPercent = feeder.sendingMeter.importKwh > 0
            ? (importGap / feeder.sendingMeter.importKwh) * 100
            : 0
        const avgDailyImport = dailyChartData.length > 0
            ? feeder.totalImport / dailyChartData.length
            : 0
        return { importGap, exportGap, lossPercent, avgDailyImport }
    }, [feeder, dailyChartData])

    // Comparison bar data
    const comparisonData = feeder
        ? [
            { name: "Import kWh", Sending: feeder.sendingMeter.importKwh, Receiving: feeder.receivingMeter.importKwh },
            { name: "Export kWh", Sending: feeder.sendingMeter.exportKwh, Receiving: feeder.receivingMeter.exportKwh },
            { name: "Net kWh", Sending: feeder.sendingMeter.netKwh, Receiving: feeder.receivingMeter.netKwh },
        ]
        : []

    const isLoading = aggregateLoading || dailyLoading

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-start gap-4">
                <Button variant="outline" size="sm" onClick={() => router.back()} className="mt-0.5 shrink-0">
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back
                </Button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Zap className="h-5 w-5 text-yellow-500 shrink-0" />
                        <h1 className="text-2xl font-bold truncate">{decodedName}</h1>
                        {feeder && (
                            <Badge variant={feeder.isCrossRegion ? "default" : "secondary"} className="shrink-0">
                                {feeder.isCrossRegion ? "Cross-Region" : "Internal"}
                            </Badge>
                        )}
                    </div>
                    {feeder && (
                        <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground flex-wrap">
                            <Link
                                href={`/stations/${encodeURIComponent(feeder.sendingMeter.station)}`}
                                className="font-medium text-foreground hover:underline"
                            >
                                {feeder.sendingMeter.station}
                            </Link>
                            <span className="text-xs">({feeder.sendingMeter.region})</span>
                            <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                            <Link
                                href={`/stations/${encodeURIComponent(feeder.receivingMeter.station)}`}
                                className="font-medium text-foreground hover:underline"
                            >
                                {feeder.receivingMeter.station}
                            </Link>
                            <span className="text-xs">({feeder.receivingMeter.region})</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
              {format(parseISO(dateRange.start), "MMM d, yyyy")} — {format(parseISO(dateRange.end), "MMM d, yyyy")}
            </span>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Skeleton className="h-64 rounded-lg" />
                        <Skeleton className="h-64 rounded-lg" />
                    </div>
                    <Skeleton className="h-72 rounded-lg" />
                </div>
            ) : !feeder ? (
                <Card>
                    <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
                        No data found for feeder &quot;{decodedName}&quot; in the selected date range.
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* KPI summary row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        <KpiCard
                            label="Total Import"
                            value={formatNumber(feeder.totalImport, 2)}
                            unit="kWh (both meters)"
                            color="text-green-700"
                            icon={<TrendingUp className="h-3.5 w-3.5" />}
                        />
                        <KpiCard
                            label="Total Export"
                            value={formatNumber(feeder.totalExport, 2)}
                            unit="kWh (both meters)"
                            color="text-blue-700"
                            icon={<TrendingDown className="h-3.5 w-3.5" />}
                        />
                        <KpiCard
                            label="Net kWh"
                            value={fmt(feeder.netKwh)}
                            unit={feeder.netKwh >= 0 ? "net import" : "net export"}
                            color={netCls(feeder.netKwh)}
                            icon={<NetIcon value={feeder.netKwh} />}
                        />
                        <KpiCard
                            label="Avg Daily Import"
                            value={imbalance ? formatNumber(imbalance.avgDailyImport, 2) : "—"}
                            unit="kWh / day"
                            icon={<Activity className="h-3.5 w-3.5" />}
                        />
                        <KpiCard
                            label="Import Imbalance"
                            value={imbalance ? `${Math.abs(imbalance.lossPercent).toFixed(2)}%` : "—"}
                            unit={
                                imbalance
                                    ? imbalance.lossPercent > 0
                                        ? "apparent loss"
                                        : imbalance.lossPercent < 0
                                            ? "apparent gain"
                                            : "balanced"
                                    : undefined
                            }
                            color={
                                imbalance && Math.abs(imbalance.lossPercent) > 2
                                    ? "text-amber-600"
                                    : "text-green-700"
                            }
                            icon={
                                imbalance && Math.abs(imbalance.lossPercent) > 2
                                    ? <AlertTriangle className="h-3.5 w-3.5" />
                                    : <CheckCircle2 className="h-3.5 w-3.5" />
                            }
                        />
                    </div>

                    {/* Tabs */}
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList>
                            <TabsTrigger value="overview">Station Overview</TabsTrigger>
                            <TabsTrigger value="trends">Daily Trends</TabsTrigger>
                            <TabsTrigger value="analysis">Meter Analysis</TabsTrigger>
                        </TabsList>

                        {/* ---- Overview ---- */}
                        <TabsContent value="overview" className="mt-4 space-y-4">
                            {/* Route visualiser */}
                            <Card>
                                <CardContent className="pt-5 pb-5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 p-3 rounded-lg bg-green-50 border border-green-200 text-center">
                                            <p className="text-xs text-muted-foreground mb-1">Sending Station</p>
                                            <Link
                                                href={`/stations/${encodeURIComponent(feeder.sendingMeter.station)}`}
                                                className="font-bold text-sm hover:underline"
                                            >
                                                {feeder.sendingMeter.station}
                                            </Link>
                                            <p className="text-xs text-muted-foreground">{feeder.sendingMeter.stationType}</p>
                                            <p className="text-xs text-muted-foreground">{feeder.sendingMeter.region}</p>
                                            {(feeder.sendingMeter.stationCode || feeder.sendingMeter.sapVersion) && (
                                                <Badge variant="outline" className="mt-1 text-xs font-mono">
                                                    {feeder.sendingMeter.stationCode || feeder.sendingMeter.sapVersion}
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="flex flex-col items-center gap-1 shrink-0">
                                            <div className="h-px w-12 bg-border relative">
                                                <ArrowRight className="h-3 w-3 absolute -right-1 -top-1.5 text-muted-foreground" />
                                            </div>
                                            {feeder.isCrossRegion && (
                                                <Badge variant="secondary" className="text-[10px]">Cross-Region</Badge>
                                            )}
                                            <p className="text-[10px] text-muted-foreground text-center">
                                                {formatNumber(feeder.totalImport, 0)} kWh
                                            </p>
                                        </div>

                                        <div className="flex-1 p-3 rounded-lg bg-blue-50 border border-blue-200 text-center">
                                            <p className="text-xs text-muted-foreground mb-1">Receiving Station</p>
                                            <Link
                                                href={`/stations/${encodeURIComponent(feeder.receivingMeter.station)}`}
                                                className="font-bold text-sm hover:underline"
                                            >
                                                {feeder.receivingMeter.station}
                                            </Link>
                                            <p className="text-xs text-muted-foreground">{feeder.receivingMeter.stationType}</p>
                                            <p className="text-xs text-muted-foreground">{feeder.receivingMeter.region}</p>
                                            {(feeder.receivingMeter.stationCode || feeder.receivingMeter.sapVersion) && (
                                                <Badge variant="outline" className="mt-1 text-xs font-mono">
                                                    {feeder.receivingMeter.stationCode || feeder.receivingMeter.sapVersion}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Per-meter detail panels */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <StationPanel role="Sending" meter={feeder.sendingMeter} accentClass="border-l-green-500" />
                                <StationPanel role="Receiving" meter={feeder.receivingMeter} accentClass="border-l-blue-500" />
                            </div>
                        </TabsContent>

                        {/* ---- Daily Trends ---- */}
                        <TabsContent value="trends" className="mt-4 space-y-4">
                            {dailyChartData.length === 0 ? (
                                <Card>
                                    <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
                                        No daily data available for this feeder in the selected date range.
                                    </CardContent>
                                </Card>
                            ) : (
                                <>
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm flex items-center gap-2">
                                                <TrendingUp className="h-4 w-4" />
                                                Daily Import / Export by Meter
                                            </CardTitle>
                                            <CardDescription>Sending (green) vs receiving (blue) meter readings per day</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <ResponsiveContainer width="100%" height={280}>
                                                <AreaChart data={dailyChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                                    <defs>
                                                        <linearGradient id="gSI" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#16a34a" stopOpacity={0.25} />
                                                            <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                                                        </linearGradient>
                                                        <linearGradient id="gRI" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                                                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                                    <XAxis
                                                        dataKey="date"
                                                        tick={{ fontSize: 11 }}
                                                        tickFormatter={(v) => {
                                                            const d = new Date(v)
                                                            return `${d.getDate()} ${d.toLocaleString("default", { month: "short" })}`
                                                        }}
                                                        interval="preserveStartEnd"
                                                    />
                                                    <YAxis tick={{ fontSize: 11 }} tickFormatter={yAxisFmt} tickCount={5} />
                                                    <Tooltip
                                                        formatter={(v: number, name: string) => [`${fmt(v)} kWh`, name]}
                                                        labelFormatter={(l) => format(parseISO(l), "d MMM yyyy")}
                                                    />
                                                    <Legend />
                                                    <Area type="monotone" dataKey="sendingImport" name="Sending Import" stroke="#16a34a" strokeWidth={1.5} fill="url(#gSI)" dot={false} />
                                                    <Area type="monotone" dataKey="receivingImport" name="Receiving Import" stroke="#2563eb" strokeWidth={1.5} fill="url(#gRI)" dot={false} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm flex items-center gap-2">
                                                <Activity className="h-4 w-4" />
                                                Daily Import by Meter End
                                            </CardTitle>
                                            <CardDescription>
                                                Grouped by day — sending meter (green) vs receiving meter (blue). Values should be close; gaps indicate line loss or metering errors.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <ResponsiveContainer width="100%" height={240}>
                                                <BarChart data={dailyChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                                    <XAxis
                                                        dataKey="date"
                                                        tick={{ fontSize: 11 }}
                                                        tickFormatter={(v) => {
                                                            const d = new Date(v)
                                                            return `${d.getDate()} ${d.toLocaleString("default", { month: "short" })}`
                                                        }}
                                                        interval="preserveStartEnd"
                                                    />
                                                    <YAxis tick={{ fontSize: 11 }} tickFormatter={yAxisFmt} tickCount={5} />
                                                    <Tooltip
                                                        formatter={(v: number, name: string) => [`${fmt(v)} kWh`, name]}
                                                        labelFormatter={(l) => format(parseISO(l), "d MMM yyyy")}
                                                    />
                                                    <Legend />
                                                    <Bar dataKey="sendingImport" name="Sending Import" fill="#16a34a" radius={[3, 3, 0, 0]} />
                                                    <Bar dataKey="receivingImport" name="Receiving Import" fill="#2563eb" radius={[3, 3, 0, 0]} />
                                                    <Bar dataKey="sendingExport" name="Sending Export" fill="#86efac" radius={[3, 3, 0, 0]} />
                                                    <Bar dataKey="receivingExport" name="Receiving Export" fill="#93c5fd" radius={[3, 3, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>
                                </>
                            )}
                        </TabsContent>

                        {/* ---- Meter Analysis ---- */}
                        <TabsContent value="analysis" className="mt-4 space-y-4">
                            {/* Imbalance card */}
                            {imbalance && (
                                <Card className={Math.abs(imbalance.lossPercent) > 2 ? "border-amber-300" : ""}>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <Activity className="h-4 w-4 text-amber-600" />
                                            Meter Imbalance Analysis
                                        </CardTitle>
                                        <CardDescription>
                                            Sending and receiving meters should record equal values. Any gap indicates line losses, reactive power, or metering errors.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div className="rounded-lg bg-muted/50 p-4 space-y-1">
                                                <p className="text-xs text-muted-foreground">Import Imbalance</p>
                                                <p className={`text-lg font-bold tabular-nums ${imbalance.importGap > 0 ? "text-amber-600" : imbalance.importGap < 0 ? "text-red-600" : "text-green-600"}`}>
                                                    {fmt(imbalance.importGap)} kWh
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {imbalance.lossPercent > 0
                                                        ? `${imbalance.lossPercent.toFixed(2)}% apparent loss`
                                                        : imbalance.lossPercent < 0
                                                            ? `${Math.abs(imbalance.lossPercent).toFixed(2)}% apparent gain`
                                                            : "Balanced"}
                                                </p>
                                            </div>
                                            <div className="rounded-lg bg-muted/50 p-4 space-y-1">
                                                <p className="text-xs text-muted-foreground">Export Imbalance</p>
                                                <p className={`text-lg font-bold tabular-nums ${imbalance.exportGap !== 0 ? "text-amber-600" : "text-green-600"}`}>
                                                    {fmt(imbalance.exportGap)} kWh
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {imbalance.exportGap === 0 ? "Balanced" : `Δ ${formatNumber(Math.abs(imbalance.exportGap))} kWh`}
                                                </p>
                                            </div>
                                            <div className="rounded-lg bg-muted/50 p-4 space-y-1">
                                                <p className="text-xs text-muted-foreground">Efficiency Indicator</p>
                                                <p className={`text-lg font-bold ${Math.abs(imbalance.lossPercent) < 1 ? "text-green-600" : Math.abs(imbalance.lossPercent) < 3 ? "text-amber-600" : "text-red-600"}`}>
                                                    {Math.abs(imbalance.lossPercent) < 1 ? "Good" : Math.abs(imbalance.lossPercent) < 3 ? "Monitor" : "Investigate"}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {Math.abs(imbalance.lossPercent) < 1
                                                        ? "< 1% imbalance — within tolerance"
                                                        : Math.abs(imbalance.lossPercent) < 3
                                                            ? "1–3% imbalance — worth monitoring"
                                                            : "> 3% imbalance — investigate meter readings"}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Comparison bar chart */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <PlugZap className="h-4 w-4" />
                                        Sending vs Receiving Meter Comparison
                                    </CardTitle>
                                    <CardDescription>Side-by-side comparison of import, export and net kWh for each meter end</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart data={comparisonData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                            <YAxis tick={{ fontSize: 11 }} tickFormatter={yAxisFmt} tickCount={4} />
                                            <Tooltip formatter={(v: number, name: string) => [`${fmt(v)} kWh`, name]} />
                                            <Legend />
                                            <Bar dataKey="Sending" fill="#16a34a" radius={[3, 3, 0, 0]} />
                                            <Bar dataKey="Receiving" fill="#2563eb" radius={[3, 3, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </>
            )}
        </div>
    )
}
