"use client"

import { useMemo } from "react"
import { type FeederDetail } from "@/hooks/api/use-express-feeder-api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
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
    RadarChart,
    Radar,
    PolarGrid,
    PolarAngleAxis,
} from "recharts"
import {
    ArrowDownCircle,
    ArrowUpCircle,
    Activity,
    ArrowRight,
    MapPin,
    Cpu,
    PlugZap,
    TrendingUp,
    TrendingDown,
    Minus,
} from "lucide-react"

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

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

function NetIcon({ value }: { value: number }) {
    if (value > 0) return <TrendingUp className="h-4 w-4 text-green-600" />
    if (value < 0) return <TrendingDown className="h-4 w-4 text-red-600" />
    return <Minus className="h-4 w-4 text-muted-foreground" />
}

function netColor(value: number): string {
    if (value > 0) return "text-green-700"
    if (value < 0) return "text-red-600"
    return "text-muted-foreground"
}

// -------------------------------------------------------------------------
// Sub-components
// -------------------------------------------------------------------------

function MeterCard({
                       label,
                       sapVersion,
                       meterNumber,
                       station,
                       stationType,
                       stationCode,
                       region,
                       district,
                       importKwh,
                       exportKwh,
                       netKwh,
                       accentColor,
                   }: {
    label: string
    sapVersion: string
    meterNumber?: string
    station: string
    stationType: string
    stationCode: string
    region: string
    district: string
    importKwh: number
    exportKwh: number
    netKwh: number
    accentColor: string
}) {
    const efficiency = importKwh > 0 ? ((importKwh - Math.abs(exportKwh)) / importKwh) * 100 : 0

    return (
        <Card className={`border-l-4 ${accentColor}`}>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <Cpu className="h-4 w-4" />
              {label}
          </span>
                    <div className="flex items-center gap-1">
                        {meterNumber && <Badge variant="secondary" className="font-mono text-xs">{meterNumber}</Badge>}
                        <Badge variant="outline" className="font-mono text-xs">{sapVersion || "—"}</Badge>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Station info */}
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <div>
                        <p className="font-semibold text-foreground text-sm">{station}</p>
                        <p>{stationType} — {stationCode}</p>
                        {district && <p>{district}, {region}</p>}
                        {!district && <p>{region}</p>}
                    </div>
                </div>

                <Separator />

                {/* Readings */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                            <ArrowDownCircle className="h-3.5 w-3.5 text-green-600" />
                            <span className="text-xs text-muted-foreground">Import</span>
                        </div>
                        <p className="text-sm font-bold text-green-700 tabular-nums">{formatRaw(importKwh)}</p>
                        <p className="text-[10px] text-muted-foreground">kWh</p>
                    </div>
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                            <ArrowUpCircle className="h-3.5 w-3.5 text-blue-600" />
                            <span className="text-xs text-muted-foreground">Export</span>
                        </div>
                        <p className="text-sm font-bold text-blue-700 tabular-nums">{formatRaw(exportKwh)}</p>
                        <p className="text-[10px] text-muted-foreground">kWh</p>
                    </div>
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                            <NetIcon value={netKwh} />
                            <span className="text-xs text-muted-foreground">Net</span>
                        </div>
                        <p className={`text-sm font-bold tabular-nums ${netColor(netKwh)}`}>{formatRaw(netKwh)}</p>
                        <p className="text-[10px] text-muted-foreground">kWh</p>
                    </div>
                </div>

                {/* Meter number info */}
                {meterNumber && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>Meter No:</span>
                        <span className="font-mono font-semibold text-foreground">{meterNumber}</span>
                    </div>
                )}

                {/* Import-to-export ratio bar */}
                {(importKwh + exportKwh) > 0 && (
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Import share</span>
                            <span className="font-semibold">{((importKwh / (importKwh + exportKwh)) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-blue-200 dark:bg-blue-900 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-green-500 transition-all"
                                style={{ width: `${(importKwh / (importKwh + exportKwh)) * 100}%` }}
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

// -------------------------------------------------------------------------
// Main component
// -------------------------------------------------------------------------

interface ExpressFeederDetailProps {
    feeder: FeederDetail
    dailyData: any[]
}

export function ExpressFeederDetail({ feeder, dailyData }: ExpressFeederDetailProps) {
    // Filter daily records for this feeder by feeder_name
    const feederDailyData = useMemo(() => {
        return dailyData.filter((r: any) => r.feeder_name === feeder.feederName)
    }, [dailyData, feeder])

    // Build daily chart grouped by date using the new nested sending_meter / receiving_meter structure
    const dailyChartData = useMemo(() => {
        const dateMap = new Map<
            string,
            {
                date: string
                sendingImport: number
                sendingExport: number
                receivingImport: number
                receivingExport: number
            }
        >()

        feederDailyData.forEach((record: any) => {
            const date = (record.consumption_date ?? record.group_period)?.split("T")[0]
            if (!date) return
            if (!dateMap.has(date)) {
                dateMap.set(date, { date, sendingImport: 0, sendingExport: 0, receivingImport: 0, receivingExport: 0 })
            }
            const entry = dateMap.get(date)!
            entry.sendingImport += record.sending_meter?.import_kwh || 0
            entry.sendingExport += record.sending_meter?.export_kwh || 0
            entry.receivingImport += record.receiving_meter?.import_kwh || 0
            entry.receivingExport += record.receiving_meter?.export_kwh || 0
        })

        return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date))
    }, [feederDailyData, feeder])

    // Radar chart data — compare the two meters
    const radarData = [
        {
            metric: "Import",
            Sending: feeder.sendingMeter.importKwh,
            Receiving: feeder.receivingMeter.importKwh,
        },
        {
            metric: "Export",
            Sending: feeder.sendingMeter.exportKwh,
            Receiving: feeder.receivingMeter.exportKwh,
        },
        {
            metric: "Net (abs)",
            Sending: Math.abs(feeder.sendingMeter.netKwh),
            Receiving: Math.abs(feeder.receivingMeter.netKwh),
        },
    ]

    // Comparison bar data
    const comparisonData = [
        {
            name: "Import kWh",
            Sending: feeder.sendingMeter.importKwh,
            Receiving: feeder.receivingMeter.importKwh,
        },
        {
            name: "Export kWh",
            Sending: feeder.sendingMeter.exportKwh,
            Receiving: feeder.receivingMeter.exportKwh,
        },
        {
            name: "Net kWh",
            Sending: feeder.sendingMeter.netKwh,
            Receiving: feeder.receivingMeter.netKwh,
        },
    ]

    // Imbalance: difference between sending meter import and receiving meter import
    // Ideally they should be equal; a gap indicates line losses or measurement error.
    const importImbalance = feeder.sendingMeter.importKwh - feeder.receivingMeter.importKwh
    const exportImbalance = feeder.sendingMeter.exportKwh - feeder.receivingMeter.exportKwh
    const lossPercent =
        feeder.sendingMeter.importKwh > 0
            ? (importImbalance / feeder.sendingMeter.importKwh) * 100
            : 0

    return (
        <div className="mt-6 space-y-6">
            {/* Route header */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="text-center">
                    <p className="text-xs text-muted-foreground">Sending</p>
                    <p className="font-semibold text-sm">{feeder.sendingMeter.station}</p>
                    <p className="text-xs text-muted-foreground">{feeder.sendingMeter.region}</p>
                </div>
                <div className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full h-px bg-border relative">
                        <ArrowRight className="h-3.5 w-3.5 absolute right-0 -top-1.5 text-muted-foreground" />
                    </div>
                    {feeder.isCrossRegion && (
                        <Badge variant="secondary" className="text-xs">Cross-Region Express Feeder</Badge>
                    )}
                </div>
                <div className="text-center">
                    <p className="text-xs text-muted-foreground">Receiving</p>
                    <p className="font-semibold text-sm">{feeder.receivingMeter.station}</p>
                    <p className="text-xs text-muted-foreground">{feeder.receivingMeter.region}</p>
                </div>
            </div>

            {/* Feeder totals */}
            <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Total Import</p>
                    <p className="text-base font-bold text-green-700 tabular-nums">{formatRaw(feeder.totalImport)}</p>
                    <p className="text-[10px] text-muted-foreground">kWh (both meters)</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Total Export</p>
                    <p className="text-base font-bold text-blue-700 tabular-nums">{formatRaw(feeder.totalExport)}</p>
                    <p className="text-[10px] text-muted-foreground">kWh (both meters)</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Net kWh</p>
                    <p className={`text-base font-bold tabular-nums ${netColor(feeder.netKwh)}`}>{formatRaw(feeder.netKwh)}</p>
                    <p className="text-[10px] text-muted-foreground">Import − Export</p>
                </div>
            </div>

            {/* Per-meter cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <MeterCard
                    label="Sending Meter"
                    sapVersion={feeder.sendingMeter.sapVersion}
                    station={feeder.sendingMeter.station}
                    stationType={feeder.sendingMeter.stationType}
                    stationCode={feeder.sendingMeter.stationCode}
                    region={feeder.sendingMeter.region}
                    district={feeder.sendingMeter.district}
                    importKwh={feeder.sendingMeter.importKwh}
                    exportKwh={feeder.sendingMeter.exportKwh}
                    netKwh={feeder.sendingMeter.netKwh}
                    meterNumber={feeder.sendingMeter.meterNumber}
                    accentColor="border-l-green-500"
                />
                <MeterCard
                    label="Receiving Meter"
                    sapVersion={feeder.receivingMeter.sapVersion}
                    meterNumber={feeder.receivingMeter.meterNumber}
                    station={feeder.receivingMeter.station}
                    stationType={feeder.receivingMeter.stationType}
                    stationCode={feeder.receivingMeter.stationCode}
                    region={feeder.receivingMeter.region}
                    district={feeder.receivingMeter.district || ""}
                    importKwh={feeder.receivingMeter.importKwh}
                    exportKwh={feeder.receivingMeter.exportKwh}
                    netKwh={feeder.receivingMeter.netKwh}
                    accentColor="border-l-blue-500"
                />
            </div>

            {/* Imbalance insight */}
            <Card className={importImbalance !== 0 ? "border-amber-300 dark:border-amber-700" : ""}>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Activity className="h-4 w-4 text-amber-600" />
                        Meter Imbalance Analysis
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                        Ideally, the sending and receiving meters should record the same values. Any difference indicates line losses, reactive power, or metering errors.
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-md bg-muted/50 p-3 space-y-1">
                            <p className="text-muted-foreground">Import Imbalance</p>
                            <p className={`font-bold tabular-nums text-sm ${importImbalance > 0 ? "text-amber-600" : importImbalance < 0 ? "text-red-600" : "text-green-600"}`}>
                                {formatRaw(importImbalance)} kWh
                            </p>
                            <p className="text-muted-foreground">
                                {lossPercent > 0 ? `${lossPercent.toFixed(2)}% apparent loss` : lossPercent < 0 ? `${Math.abs(lossPercent).toFixed(2)}% apparent gain` : "Balanced"}
                            </p>
                        </div>
                        <div className="rounded-md bg-muted/50 p-3 space-y-1">
                            <p className="text-muted-foreground">Export Imbalance</p>
                            <p className={`font-bold tabular-nums text-sm ${exportImbalance !== 0 ? "text-amber-600" : "text-green-600"}`}>
                                {formatRaw(exportImbalance)} kWh
                            </p>
                            <p className="text-muted-foreground">
                                {exportImbalance === 0 ? "Balanced" : `Δ ${Math.abs(exportImbalance).toLocaleString()} kWh`}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Meter comparison bar chart */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <PlugZap className="h-4 w-4" />
                        Sending vs Receiving Meter Comparison
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={comparisonData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="name" className="text-xs" />
                            <YAxis className="text-xs" tickFormatter={yAxisFormatter} tickCount={4} />
                            <Tooltip
                                formatter={(value: number, name: string) => [`${formatRaw(value)} kWh`, name]}
                            />
                            <Legend />
                            <Bar dataKey="Sending" fill="#16a34a" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="Receiving" fill="#2563eb" radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Daily trends for this feeder — only if daily data available */}
            {dailyChartData.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            Daily Meter Readings
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={240}>
                            <AreaChart data={dailyChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="dSendImp" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#16a34a" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="dSendExp" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#86efac" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#86efac" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="dRecvImp" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="dRecvExp" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#93c5fd" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#93c5fd" stopOpacity={0} />
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
                                <YAxis className="text-xs" tickFormatter={yAxisFormatter} tickCount={5} />
                                <Tooltip
                                    formatter={(value: number, name: string) => [`${formatRaw(value)} kWh`, name]}
                                    labelFormatter={(label) => {
                                        const d = new Date(label)
                                        return d.toLocaleDateString("default", { day: "numeric", month: "short", year: "numeric" })
                                    }}
                                />
                                <Legend />
                                <Area type="monotone" dataKey="sendingImport" name="Sending Import" stroke="#16a34a" strokeWidth={1.5} fill="url(#dSendImp)" dot={false} />
                                <Area type="monotone" dataKey="sendingExport" name="Sending Export" stroke="#86efac" strokeWidth={1.5} fill="url(#dSendExp)" dot={false} />
                                <Area type="monotone" dataKey="receivingImport" name="Receiving Import" stroke="#2563eb" strokeWidth={1.5} fill="url(#dRecvImp)" dot={false} />
                                <Area type="monotone" dataKey="receivingExport" name="Receiving Export" stroke="#93c5fd" strokeWidth={1.5} fill="url(#dRecvExp)" dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
