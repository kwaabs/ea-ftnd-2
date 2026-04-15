"use client"

import { useMemo, useState, useEffect } from "react"
import Link from "next/link"
import { useAppStore } from "@/stores/app-store"
import { formatApiDate } from "@/lib/utils"
import {
    useExpressFeederAggregate,
    useExpressFeederDaily,
    type FeederDetail,
} from "@/hooks/api/use-express-feeder-api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
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
    ArrowDownCircle,
    ArrowUpCircle,
    Activity,
    Zap,
    TrendingUp,
    Radio,
    ArrowRight,
    ChevronRight,
    ChevronLeft,
    Gauge,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ChevronsUpDown, Check } from "lucide-react"
import { ExpressFeederDetail } from "@/components/dashboard/express-feeder-detail"
import { ExpressFeederNetworkMap } from "@/components/dashboard/express-feeder-network-map"
import { ExpressFeederMeterStatus } from "@/components/dashboard/express-feeder-meter-status"
import { ExpressFeederStationsTab } from "@/components/dashboard/express-feeder-stations-tab"

function formatRaw(value: number): string {
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function yAxisFormatter(value: number): string {
    if (value === 0) return "0"
    const abs = Math.abs(value)
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`
    return value.toFixed(0)
}

function SummaryCard({
                         title,
                         value,
                         unit,
                         icon: Icon,
                         color,
                         sub,
                     }: {
    title: string
    value: string
    unit?: string
    icon: React.ComponentType<{ className?: string }>
    color: string
    sub?: string
}) {
    return (
        <Card>
            <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-muted-foreground">{title}</p>
                        <p className={`text-2xl font-bold mt-1 tabular-nums ${color}`}>
                            {value}
                            {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
                        </p>
                        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
                    </div>
                    <div className="p-2 rounded-lg bg-muted">
                        <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

/** Two-row meter cell: shows import and export for one meter end */
function MeterCell({ label, importKwh, exportKwh, net }: { label: string; importKwh: number; exportKwh: number; net: number }) {
    return (
        <div className="space-y-0.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
            <div className="flex items-center gap-1">
                <span className="text-[11px] text-muted-foreground w-14">Import:</span>
                <span className="text-xs font-semibold text-green-700 tabular-nums">{formatRaw(importKwh)}</span>
            </div>
            <div className="flex items-center gap-1">
                <span className="text-[11px] text-muted-foreground w-14">Export:</span>
                <span className="text-xs font-semibold text-blue-700 tabular-nums">{formatRaw(exportKwh)}</span>
            </div>
            <div className="flex items-center gap-1">
                <span className="text-[11px] text-muted-foreground w-14">Net:</span>
                <span className={`text-xs font-bold tabular-nums ${net >= 0 ? "text-green-700" : "text-red-600"}`}>{formatRaw(net)}</span>
            </div>
        </div>
    )
}

export function ExpressFeederTab() {
    const { filters, updateFilter } = useAppStore()
    const [activeView, setActiveView] = useState<"overview" | "feeders" | "stations" | "map">("overview")
    const [selectedFeeder, setSelectedFeeder] = useState<FeederDetail | null>(null)

    useEffect(() => {
        updateFilter("activeTab", "express-feeders")
    }, [])

    const [pageSize, setPageSize] = useState(10)
    const [currentPage, setCurrentPage] = useState(1)

    // Feeder chart selector (Feeder Breakdown tab)
    const [selectedChartFeeders, setSelectedChartFeeders] = useState<Set<string>>(new Set())
    const [showCumulative, setShowCumulative] = useState(false)
    const [feederSelectorOpen, setFeederSelectorOpen] = useState(false)

    // Daily Trends filters
    const [trendSeriesMode, setTrendSeriesMode] = useState<"both" | "import" | "export">("both")
    const [trendFeeders, setTrendFeeders] = useState<Set<string>>(new Set())
    const [trendCumulative, setTrendCumulative] = useState(false)
    const [trendSelectorOpen, setTrendSelectorOpen] = useState(false)

    const toggleTrendFeeder = (name: string) => {
        setTrendFeeders((prev) => {
            const next = new Set(prev)
            if (next.has(name)) next.delete(name)
            else next.add(name)
            return next
        })
    }

    const params = useMemo(
        () => {
            const p = {
                dateFrom: filters.dateRange ? formatApiDate(filters.dateRange.start) : "",
                dateTo: filters.dateRange ? formatApiDate(filters.dateRange.end) : "",
                regions: filters.regions || [],
                districts: filters.districts || [],
                stations: filters.stations || [],
                boundaryMeteringPoints: filters.boundaryMeteringPoints || [],
                voltages: (filters.voltages || []).map(String),
            }
            return p
        },
        [filters],
    )

    const { data: aggregate, isLoading: aggregateLoading } = useExpressFeederAggregate(params)
    const { data: rawDaily, isLoading: dailyLoading } = useExpressFeederDaily(params)

    const dailyData: any[] = Array.isArray(rawDaily)
        ? rawDaily
        : Array.isArray((rawDaily as any)?.data)
            ? (rawDaily as any).data
            : []

    // Daily chart grouped by date — new API has nested sending_meter / receiving_meter objects
    const dailyChartData = useMemo(() => {
        const dateMap = new Map<string, { date: string; import: number; export: number; net: number }>()
        dailyData.forEach((record: any) => {
            const date = (record.consumption_date ?? record.group_period)?.split("T")[0]
            if (!date) return
            if (!dateMap.has(date)) dateMap.set(date, { date, import: 0, export: 0, net: 0 })
            const entry = dateMap.get(date)!
            entry.import += (record.sending_meter?.import_kwh || 0) + (record.receiving_meter?.import_kwh || 0)
            entry.export += (record.sending_meter?.export_kwh || 0) + (record.receiving_meter?.export_kwh || 0)
            entry.net = entry.import - entry.export
        })
        return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date))
    }, [dailyData])

    // Daily Trends chart data — filtered by feeder selection, cumulative, and series mode
    const trendChartData = useMemo(() => {
        const dateMap = new Map<string, { date: string; import: number; export: number; net: number }>()
        dailyData.forEach((record: any) => {
            const feederName = record.feeder_name
            // If feeders are selected, only include matching ones
            if (trendFeeders.size > 0 && !trendFeeders.has(feederName)) return
            const date = (record.consumption_date ?? record.group_period)?.split("T")[0]
            if (!date) return
            if (!dateMap.has(date)) dateMap.set(date, { date, import: 0, export: 0, net: 0 })
            const entry = dateMap.get(date)!
            entry.import += (record.sending_meter?.import_kwh || 0) + (record.receiving_meter?.import_kwh || 0)
            entry.export += (record.sending_meter?.export_kwh || 0) + (record.receiving_meter?.export_kwh || 0)
            entry.net = entry.import - entry.export
        })
        return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date))
    }, [dailyData, trendFeeders])

    // All feeder names for the selector
    const allFeederNames = useMemo(
        () => (aggregate?.feederBreakdown || []).map((f) => f.feederName),
        [aggregate]
    )

    const toggleChartFeeder = (name: string) => {
        setSelectedChartFeeders((prev) => {
            const next = new Set(prev)
            if (next.has(name)) next.delete(name)
            else next.add(name)
            return next
        })
    }

    // Feeder bar chart — filtered by selection (show all if none selected)
    const feederChartData = useMemo(() => {
        if (!aggregate?.feederBreakdown) return []
        const all = aggregate.feederBreakdown.map((f) => ({
            name: f.feederName,
            "Sending Import": f.sendingMeter.importKwh,
            "Sending Export": f.sendingMeter.exportKwh,
            "Receiving Import": f.receivingMeter.importKwh,
            "Receiving Export": f.receivingMeter.exportKwh,
        }))
        if (selectedChartFeeders.size === 0) return all
        return all.filter((d) => selectedChartFeeders.has(d.name))
    }, [aggregate, selectedChartFeeders])

    // Cumulative data: sum all selected feeders per day — separate import and export series
    const cumulativeChartData = useMemo(() => {
        if (!showCumulative || selectedChartFeeders.size < 2) return []
        const dateMap = new Map<string, { import: number; export: number }>()
        dailyData.forEach((r: any) => {
            const feederName = r.feeder_name
            if (!selectedChartFeeders.has(feederName)) return
            const date = (r.consumption_date ?? r.group_period)?.split("T")[0]
            if (!date) return
            if (!dateMap.has(date)) dateMap.set(date, { import: 0, export: 0 })
            const entry = dateMap.get(date)!
            entry.import += (r.sending_meter?.import_kwh || 0) + (r.receiving_meter?.import_kwh || 0)
            entry.export += (r.sending_meter?.export_kwh || 0) + (r.receiving_meter?.export_kwh || 0)
        })
        return Array.from(dateMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, v]) => ({ date, "Combined Import": v.import, "Combined Export": v.export }))
    }, [dailyData, selectedChartFeeders, showCumulative])



    const isLoading = aggregateLoading || dailyLoading

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i}>
                            <CardContent className="pt-6">
                                <Skeleton className="h-4 w-24 mb-2" />
                                <Skeleton className="h-8 w-32" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
                <Skeleton className="h-64 w-full" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard
                    title="Total Import"
                    value={formatRaw(aggregate?.totalImportKwh || 0)}
                    unit="kWh"
                    icon={ArrowDownCircle}
                    color="text-green-600"
                    sub="Across all feeder meters"
                />
                <SummaryCard
                    title="Total Export"
                    value={formatRaw(aggregate?.totalExportKwh || 0)}
                    unit="kWh"
                    icon={ArrowUpCircle}
                    color="text-blue-600"
                    sub="Across all feeder meters"
                />
                <SummaryCard
                    title="Net Energy"
                    value={formatRaw(aggregate?.netKwh || 0)}
                    unit="kWh"
                    icon={Activity}
                    color={(aggregate?.netKwh || 0) >= 0 ? "text-green-600" : "text-red-600"}
                    sub="Import minus export"
                />
                <SummaryCard
                    title="Unique Feeders"
                    value={`${aggregate?.uniqueFeederCount ?? 0}`}
                    unit="feeders"
                    icon={Radio}
                    color="text-orange-600"
                    sub={`${(aggregate?.uniqueFeederCount ?? 0) * 2} meters (2 per feeder)`}
                />
            </div>

            {/* Tabs */}
            <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)}>
                <TabsList>
                    <TabsTrigger value="overview">Daily Trends</TabsTrigger>
                    <TabsTrigger value="feeders">Feeder Breakdown</TabsTrigger>
                    <TabsTrigger value="stations">Station Breakdown</TabsTrigger>
                    <TabsTrigger value="map">Network Map</TabsTrigger>
                    <TabsTrigger value="status">Meter Status</TabsTrigger>
                </TabsList>

                {/* Daily Trends */}
                <TabsContent value="overview" className="mt-4 space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col gap-3">
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <TrendingUp className="h-4 w-4" />
                                            Daily Energy Flow Trends
                                        </CardTitle>
                                        <CardDescription className="mt-1">
                                            {trendFeeders.size === 0 ? "All feeders" : `${trendFeeders.size} feeder${trendFeeders.size > 1 ? "s" : ""} selected`}
                                            {" · "}
                                            {trendSeriesMode === "both" ? "Import & Export" : trendSeriesMode === "import" ? "Import only" : "Export only"}
                                        </CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {/* Import / Export toggle */}
                                        <div className="flex items-center border rounded-md overflow-hidden text-xs">
                                            {(["both", "import", "export"] as const).map((mode) => (
                                                <button
                                                    key={mode}
                                                    onClick={() => setTrendSeriesMode(mode)}
                                                    className={`px-3 py-1.5 font-medium transition-colors ${
                                                        trendSeriesMode === mode
                                                            ? "bg-primary text-primary-foreground"
                                                            : "hover:bg-muted text-muted-foreground"
                                                    }`}
                                                >
                                                    {mode === "both" ? "Both" : mode === "import" ? "Import" : "Export"}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Feeder multi-select */}
                                        <Popover open={trendSelectorOpen} onOpenChange={setTrendSelectorOpen}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" size="sm" className="min-w-40 justify-between shrink-0">
                          <span className="truncate text-xs">
                            {trendFeeders.size === 0
                                ? "All feeders"
                                : trendFeeders.size === 1
                                    ? Array.from(trendFeeders)[0]
                                    : `${trendFeeders.size} feeders`}
                          </span>
                                                    <ChevronsUpDown className="h-3.5 w-3.5 ml-2 opacity-50 shrink-0" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-72 p-2" align="end">
                                                <div className="flex items-center justify-between px-2 py-1 mb-1">
                                                    <span className="text-xs font-semibold text-muted-foreground">Filter feeders</span>
                                                    {trendFeeders.size > 0 && (
                                                        <button
                                                            className="text-xs text-muted-foreground hover:text-foreground underline"
                                                            onClick={() => setTrendFeeders(new Set())}
                                                        >
                                                            Clear all
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="max-h-64 overflow-y-auto space-y-0.5">
                                                    {allFeederNames.map((name) => (
                                                        <div
                                                            key={name}
                                                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                                                            onClick={() => toggleTrendFeeder(name)}
                                                        >
                                                            <Checkbox
                                                                checked={trendFeeders.has(name)}
                                                                onCheckedChange={() => toggleTrendFeeder(name)}
                                                                className="shrink-0"
                                                            />
                                                            <span className="text-sm truncate">{name}</span>
                                                            {trendFeeders.has(name) && <Check className="h-3.5 w-3.5 ml-auto shrink-0 text-primary" />}
                                                        </div>
                                                    ))}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>

                                {/* Cumulative toggle — only when 2+ feeders selected */}
                                {trendFeeders.size >= 2 && (
                                    <div className="flex items-center gap-2 border-t pt-3">
                                        <Checkbox
                                            id="trend-cumulate"
                                            checked={trendCumulative}
                                            onCheckedChange={(checked) => setTrendCumulative(!!checked)}
                                        />
                                        <Label htmlFor="trend-cumulate" className="text-sm font-normal cursor-pointer">
                                            Cumulative — combine selected feeders into a single daily total
                                        </Label>
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {trendChartData.length === 0 ? (
                                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                                    No daily data available for the selected filters.
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height={300}>
                                    <AreaChart data={trendChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                        <defs>
                                            <linearGradient id="efImportGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#16a34a" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="efExportGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                        <XAxis
                                            dataKey="date"
                                            className="text-xs"
                                            tickFormatter={(v) => {
                                                const d = new Date(v)
                                                return `${d.getDate()} ${d.toLocaleString("default", { month: "short" })}`
                                            }}
                                            interval="preserveStartEnd"
                                        />
                                        <YAxis className="text-xs" tickFormatter={yAxisFormatter} tickCount={5} domain={["auto", "auto"]} type="number" />
                                        <Tooltip
                                            formatter={(value: number, name: string) => [
                                                `${formatRaw(value)} kWh`,
                                                name === "import" ? "Import" : name === "export" ? "Export" : "Net",
                                            ]}
                                            labelFormatter={(label) => {
                                                const d = new Date(label)
                                                return d.toLocaleDateString("default", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
                                            }}
                                        />
                                        <Legend />
                                        {(trendSeriesMode === "both" || trendSeriesMode === "import") && (
                                            <Area type="monotone" dataKey="import" name="Import" stroke="#16a34a" strokeWidth={2} fill="url(#efImportGrad)" dot={false} />
                                        )}
                                        {(trendSeriesMode === "both" || trendSeriesMode === "export") && (
                                            <Area type="monotone" dataKey="export" name="Export" stroke="#2563eb" strokeWidth={2} fill="url(#efExportGrad)" dot={false} />
                                        )}
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Feeder Breakdown */}
                <TabsContent value="feeders" className="mt-4 space-y-4">
                    {/* Chart with feeder selector */}
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col gap-3">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Zap className="h-4 w-4" />
                                            All Feeders — Meter-Level Import / Export
                                        </CardTitle>
                                        <CardDescription className="mt-1">
                                            Select feeders to compare. Shows all feeders when none are selected.
                                        </CardDescription>
                                    </div>

                                    {/* Multi-select feeder dropdown */}
                                    <Popover open={feederSelectorOpen} onOpenChange={setFeederSelectorOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" size="sm" className="min-w-48 justify-between shrink-0">
                        <span className="truncate">
                          {selectedChartFeeders.size === 0
                              ? "All feeders"
                              : selectedChartFeeders.size === 1
                                  ? Array.from(selectedChartFeeders)[0]
                                  : `${selectedChartFeeders.size} feeders selected`}
                        </span>
                                                <ChevronsUpDown className="h-3.5 w-3.5 ml-2 opacity-50 shrink-0" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-72 p-2" align="end">
                                            <div className="flex items-center justify-between px-2 py-1 mb-1">
                                                <span className="text-xs font-semibold text-muted-foreground">Select feeders</span>
                                                {selectedChartFeeders.size > 0 && (
                                                    <button
                                                        className="text-xs text-muted-foreground hover:text-foreground underline"
                                                        onClick={() => setSelectedChartFeeders(new Set())}
                                                    >
                                                        Clear all
                                                    </button>
                                                )}
                                            </div>
                                            <div className="max-h-64 overflow-y-auto space-y-0.5">
                                                {allFeederNames.map((name) => (
                                                    <div
                                                        key={name}
                                                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                                                        onClick={() => toggleChartFeeder(name)}
                                                    >
                                                        <Checkbox
                                                            checked={selectedChartFeeders.has(name)}
                                                            onCheckedChange={() => toggleChartFeeder(name)}
                                                            className="shrink-0"
                                                        />
                                                        <span className="text-sm truncate">{name}</span>
                                                        {selectedChartFeeders.has(name) && (
                                                            <Check className="h-3.5 w-3.5 ml-auto shrink-0 text-primary" />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* Cumulate checkbox — only show when 2+ feeders selected */}
                                {selectedChartFeeders.size >= 2 && (
                                    <div className="flex items-center gap-2 border-t pt-3">
                                        <Checkbox
                                            id="feeder-cumulate"
                                            checked={showCumulative}
                                            onCheckedChange={(checked) => setShowCumulative(!!checked)}
                                        />
                                        <Label htmlFor="feeder-cumulate" className="text-sm font-normal cursor-pointer">
                                            Show cumulative (combined daily total) instead of individual feeders
                                        </Label>
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {/* Horizontal bar chart — feeder names on Y axis, values on X axis */}
                            {!showCumulative && (
                                feederChartData.length === 0 ? (
                                    <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                                        No feeder data available.
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={Math.max(300, feederChartData.length * 52 + 60)}>
                                        <BarChart
                                            data={feederChartData}
                                            layout="vertical"
                                            margin={{ top: 5, right: 30, left: 160, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                                            <XAxis type="number" className="text-xs" tickFormatter={yAxisFormatter} tickCount={5} />
                                            <YAxis type="category" dataKey="name" className="text-xs" tick={{ fontSize: 11 }} width={155} />
                                            <Tooltip formatter={(value: number, name: string) => [`${formatRaw(value)} kWh`, name]} />
                                            <Legend />
                                            <Bar dataKey="Sending Import" fill="#16a34a" radius={[0, 2, 2, 0]} />
                                            <Bar dataKey="Sending Export" fill="#86efac" radius={[0, 2, 2, 0]} />
                                            <Bar dataKey="Receiving Import" fill="#2563eb" radius={[0, 2, 2, 0]} />
                                            <Bar dataKey="Receiving Export" fill="#93c5fd" radius={[0, 2, 2, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )
                            )}

                            {/* 2+ feeders, cumulative — two area series: combined import + combined export */}
                            {selectedChartFeeders.size >= 2 && showCumulative && (
                                cumulativeChartData.length === 0 ? (
                                    <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                                        No daily data for selected feeders.
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={320}>
                                        <AreaChart data={cumulativeChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                            <defs>
                                                <linearGradient id="cumImportGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.25} />
                                                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="cumExportGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                                                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                            <XAxis
                                                dataKey="date"
                                                className="text-xs"
                                                tickFormatter={(v) => { const d = new Date(v); return `${d.getDate()} ${d.toLocaleString("default", { month: "short" })}` }}
                                                interval="preserveStartEnd"
                                            />
                                            <YAxis className="text-xs" tickFormatter={yAxisFormatter} tickCount={5} />
                                            <Tooltip
                                                formatter={(value: number, name: string) => [`${formatRaw(value)} kWh`, name]}
                                                labelFormatter={(l) => new Date(l).toLocaleDateString("default", { weekday: "short", day: "numeric", month: "short" })}
                                            />
                                            <Legend />
                                            <Area type="monotone" dataKey="Combined Import" stroke="#16a34a" strokeWidth={2} fill="url(#cumImportGrad)" dot={false} />
                                            <Area type="monotone" dataKey="Combined Export" stroke="#2563eb" strokeWidth={2} fill="url(#cumExportGrad)" dot={false} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )
                            )}


                        </CardContent>
                    </Card>

                    {/* Feeder table with per-meter columns */}
                    <Card>
                        <CardHeader>
                            <CardTitle>All Feeders</CardTitle>
                            <CardDescription>
                                Click a feeder row to view detailed meter-level insights. Each feeder has one sending meter and one receiving meter — each with import and export readings.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-auto max-h-[560px]">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-background z-10">
                                        <TableRow>
                                            <TableHead className="w-8">#</TableHead>
                                            <TableHead>Feeder</TableHead>
                                            <TableHead>Route</TableHead>
                                            <TableHead className="text-center border-l bg-green-50/50 dark:bg-green-950/20" colSpan={3}>
                                                <span className="text-green-800 dark:text-green-400 text-xs font-semibold">Sending Meter</span>
                                            </TableHead>
                                            <TableHead className="text-center border-l bg-blue-50/50 dark:bg-blue-950/20" colSpan={3}>
                                                <span className="text-blue-800 dark:text-blue-400 text-xs font-semibold">Receiving Meter</span>
                                            </TableHead>
                                            <TableHead className="w-8"></TableHead>
                                        </TableRow>
                                        <TableRow className="bg-muted/30">
                                            <TableHead />
                                            <TableHead />
                                            <TableHead />
                                            <TableHead className="text-right text-[11px] text-green-700 border-l">Import</TableHead>
                                            <TableHead className="text-right text-[11px] text-green-700">Export</TableHead>
                                            <TableHead className="text-right text-[11px] text-green-700">Net</TableHead>
                                            <TableHead className="text-right text-[11px] text-blue-700 border-l">Import</TableHead>
                                            <TableHead className="text-right text-[11px] text-blue-700">Export</TableHead>
                                            <TableHead className="text-right text-[11px] text-blue-700">Net</TableHead>
                                            <TableHead />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(aggregate?.feederBreakdown || [])
                                            .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                                            .map((feeder, idx) => (
                                                <TableRow
                                                    key={feeder.feederName}
                                                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                                                    onClick={() => setSelectedFeeder(feeder)}
                                                >
                                                    <TableCell className="text-muted-foreground text-sm">{(currentPage - 1) * pageSize + idx + 1}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-sm">{feeder.feederName}</span>
                                                            <Link
                                                                href={`/express-feeders/${encodeURIComponent(feeder.feederName)}`}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="text-xs text-blue-600 hover:underline shrink-0"
                                                            >
                                                                View
                                                            </Link>
                                                        </div>
                                                        {feeder.isCrossRegion && (
                                                            <Badge variant="secondary" className="text-xs mt-0.5">Cross-Region</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1 text-xs">
                                                            <div className="text-right">
                                                                <div className="font-medium">{feeder.sendingMeter.station}</div>
                                                                <div className="text-muted-foreground">{feeder.sendingMeter.region}</div>
                                                            </div>
                                                            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                                            <div>
                                                                <div className="font-medium">{feeder.receivingMeter.station}</div>
                                                                <div className="text-muted-foreground">{feeder.receivingMeter.region}</div>
                                                            </div>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground font-mono mt-1">
                                                            {feeder.sendingMeter.meterNumber || "NO METER"} / {feeder.receivingMeter.meterNumber || "NO METER"}
                                                        </div>
                                                    </TableCell>
                                                    {/* Sending meter readings */}
                                                    <TableCell className="text-right tabular-nums text-green-700 font-semibold border-l text-xs">
                                                        {formatRaw(feeder.sendingMeter.importKwh)}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums text-blue-700 font-semibold text-xs">
                                                        {formatRaw(feeder.sendingMeter.exportKwh)}
                                                    </TableCell>
                                                    <TableCell className={`text-right tabular-nums font-bold text-xs ${feeder.sendingMeter.netKwh >= 0 ? "text-green-700" : "text-red-600"}`}>
                                                        {formatRaw(feeder.sendingMeter.netKwh)}
                                                    </TableCell>
                                                    {/* Receiving meter readings */}
                                                    <TableCell className="text-right tabular-nums text-green-700 font-semibold border-l text-xs">
                                                        {formatRaw(feeder.receivingMeter.importKwh)}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums text-blue-700 font-semibold text-xs">
                                                        {formatRaw(feeder.receivingMeter.exportKwh)}
                                                    </TableCell>
                                                    <TableCell className={`text-right tabular-nums font-bold text-xs ${feeder.receivingMeter.netKwh >= 0 ? "text-green-700" : "text-red-600"}`}>
                                                        {formatRaw(feeder.receivingMeter.netKwh)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        {(aggregate?.feederBreakdown || []).length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                                                    No feeder data available.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination controls */}
                            {(aggregate?.feederBreakdown || []).length > 0 && (() => {
                                const total = aggregate!.feederBreakdown.length
                                const totalPages = Math.ceil(total / pageSize)
                                const start = (currentPage - 1) * pageSize + 1
                                const end = Math.min(currentPage * pageSize, total)
                                return (
                                    <div className="flex items-center justify-between px-4 py-3 border-t">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <span>Rows per page:</span>
                                            <Select
                                                value={String(pageSize)}
                                                onValueChange={(v) => {
                                                    setPageSize(Number(v))
                                                    setCurrentPage(1)
                                                }}
                                            >
                                                <SelectTrigger className="h-8 w-20">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {[10, 20, 50, 100].map((n) => (
                                                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground">
                        {start}–{end} of {total}
                      </span>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                    disabled={currentPage === 1}
                                                    onClick={() => setCurrentPage((p) => p - 1)}
                                                >
                                                    <ChevronLeft className="h-4 w-4" />
                                                </Button>
                                                <span className="text-muted-foreground px-1">
                          Page {currentPage} of {totalPages}
                        </span>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                    disabled={currentPage === totalPages}
                                                    onClick={() => setCurrentPage((p) => p + 1)}
                                                >
                                                    <ChevronRight className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })()}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Station Breakdown */}
                <TabsContent value="stations" className="mt-4">
                    <ExpressFeederStationsTab
                        aggregate={aggregate}
                        feeders={aggregate?.feederBreakdown || []}
                    />
                </TabsContent>

                {/* Network Map */}
                <TabsContent value="map" className="mt-4">
                    <ExpressFeederNetworkMap feeders={aggregate?.feederBreakdown || []} />
                </TabsContent>

                {/* Meter Status */}
                <TabsContent value="status" className="mt-4">
                    <ExpressFeederMeterStatus params={params} />
                </TabsContent>
            </Tabs>

            {/* Feeder Detail Dialog */}
            <Dialog open={!!selectedFeeder} onOpenChange={(open) => { if (!open) setSelectedFeeder(null) }}>
                <DialogContent className="!max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Gauge className="h-5 w-5 text-orange-600" />
                            {selectedFeeder?.feederName}
                        </DialogTitle>
                        <DialogDescription>
                            Meter-level detail for this express feeder — sending and receiving ends with import / export readings.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedFeeder && (
                        <ExpressFeederDetail feeder={selectedFeeder} dailyData={dailyData} />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
