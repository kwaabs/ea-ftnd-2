"use client"

import { Button } from "@/components/ui/button"
import { ExportButton } from "@/components/ui/export-button"

import { useState, useRef } from "react"

import { useMemo } from "react"
import { format, parseISO, getDay, getISOWeek, getYear } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, LineChart, ReferenceLine } from "recharts"
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from "lucide-react"

interface ConsumptionData {
    consumption_date: string
    meter_number: string
    consumed_energy: number
    system_name: "import_kwh" | "export_kwh"
    day_start_reading: number
    day_end_reading: number
}

interface StatusData {
    consumption_date: string
    meter_number: string
    status: "ONLINE" | "OFFLINE"
    consumption: number
    reading_count: number
    day_start_time: string
    day_end_time: string
}

interface MeterInsightsChartsProps {
    consumptionData: ConsumptionData[]
    statusData: StatusData[]
    filenamePrefix?: string
}

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function MeterInsightsCharts({ consumptionData, statusData, filenamePrefix = "meter" }: MeterInsightsChartsProps) {
    const [weeklyGrowthView, setWeeklyGrowthView] = useState<"import" | "export">("import")
    const [weeklyPatternView, setWeeklyPatternView] = useState<"import" | "export" | "both">("both")
    const balanceChartRef = useRef<HTMLDivElement>(null)
    const dowChartRef = useRef<HTMLDivElement>(null)
    const qualityChartRef = useRef<HTMLDivElement>(null)
    const varianceChartRef = useRef<HTMLDivElement>(null)
    const wowChartRef = useRef<HTMLDivElement>(null)
    console.log("[v0] MeterInsightsCharts - Data received:", {
        consumptionDataLength: consumptionData.length,
        statusDataLength: statusData.length,
        sampleConsumption: consumptionData[0],
        sampleStatus: statusData[0]
    })

    // 1. Import/Export Balance
    const balanceData = useMemo(() => {
        let totalImport = 0
        let totalExport = 0

        consumptionData.forEach((item) => {
            if (item.system_name === "import_kwh") {
                totalImport += item.consumed_energy
            } else if (item.system_name === "export_kwh") {
                totalExport += item.consumed_energy
            }
        })

        console.log("[v0] Balance data calculated:", { totalImport, totalExport })

        return [
            { name: "Import", value: totalImport, fill: "#10b981" },
            { name: "Export", value: totalExport, fill: "#3b82f6" },
        ]
    }, [consumptionData])

    const netFlow = balanceData[0]?.value - balanceData[1]?.value

    // Number formatting helper
    const formatNumber = (num: number, decimals = 2) => {
        return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    }

    // 2. Day of Week Pattern
    const weekdayPattern = useMemo(() => {
        const byWeekday = Array(7).fill(0).map((_, i) => ({
            day: WEEKDAY_NAMES[i],
            importTotal: 0,
            exportTotal: 0,
            count: 0,
            avgImport: 0,
            avgExport: 0
        }))

        consumptionData.forEach((item) => {
            const dayOfWeek = getDay(parseISO(item.consumption_date))
            if (item.system_name === "import_kwh") {
                byWeekday[dayOfWeek].importTotal += item.consumed_energy
                byWeekday[dayOfWeek].count++
            } else if (item.system_name === "export_kwh") {
                byWeekday[dayOfWeek].exportTotal += item.consumed_energy
            }
        })

        const result = byWeekday.map((item) => ({
            ...item,
            avgImport: item.count > 0 ? item.importTotal / item.count : 0,
            avgExport: item.count > 0 ? item.exportTotal / item.count : 0,
        }))

        console.log("[v0] Weekday pattern calculated:", result)
        return result
    }, [consumptionData])

    // 3. Reading Quality - Deduplicate by date (statusData has import/export as separate entries)
    const readingQuality = useMemo(() => {
        const byDate = new Map<string, { readingCount: number; status: string }>()

        statusData.forEach((item) => {
            const existing = byDate.get(item.consumption_date)
            if (!existing || existing.status === "OFFLINE") {
                byDate.set(item.consumption_date, {
                    readingCount: Math.max(existing?.readingCount || 0, item.reading_count),
                    status: item.status
                })
            }
        })

        const result = Array.from(byDate.entries()).map(([date, data]) => ({
            date: format(parseISO(date), "MMM dd"),
            readingCount: data.readingCount,
            expected: 96, // 15-min intervals = 4 per hour * 24 hours
            completeness: (data.readingCount / 96) * 100,
            status: data.status,
        }))

        console.log("[v0] Reading quality calculated:", result)
        return result
    }, [statusData])

    const avgCompleteness = readingQuality.length > 0
        ? readingQuality.reduce((sum, item) => sum + item.completeness, 0) / readingQuality.length
        : 0

    // 4. Consumption Variance & Anomalies
    const varianceData = useMemo(() => {
        const daily = new Map<string, number>()

        consumptionData.forEach((item) => {
            if (item.system_name === "import_kwh") {
                const date = format(parseISO(item.consumption_date), "yyyy-MM-dd")
                daily.set(date, item.consumed_energy)
            }
        })

        const values = Array.from(daily.values())
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length
        const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length
        const stdDev = Math.sqrt(variance)

        const result = Array.from(daily.entries()).map(([date, value]) => {
            const zScore = (value - avg) / stdDev
            const isAnomaly = Math.abs(zScore) > 2

            return {
                date: format(parseISO(date), "MMM dd"),
                value,
                avg,
                isAnomaly,
                zScore,
                upper: avg + 2 * stdDev,
                lower: Math.max(0, avg - 2 * stdDev),
            }
        })

        console.log("[v0] Variance data calculated:", result)
        return result
    }, [consumptionData])

    const anomalyCount = varianceData.filter((d) => d.isAnomaly).length

    // 5. Week-over-Week Growth (using ISO weeks)
    const weeklyGrowth = useMemo(() => {
        const weeks = new Map<number, { import: number; export: number; dates: string[]; isoWeek: number; year: number }>()

        consumptionData.forEach((item) => {
            const date = parseISO(item.consumption_date)
            const isoWeek = getISOWeek(date)
            const year = getYear(date)
            const weekKey = year * 100 + isoWeek // e.g., 202436 for week 36 of 2024

            if (!weeks.has(weekKey)) {
                weeks.set(weekKey, { import: 0, export: 0, dates: [], isoWeek, year })
            }

            const week = weeks.get(weekKey)!
            if (item.system_name === "import_kwh") {
                week.import += item.consumed_energy
            } else if (item.system_name === "export_kwh") {
                week.export += item.consumed_energy
            }

            if (!week.dates.includes(format(date, "MMM dd"))) {
                week.dates.push(format(date, "MMM dd"))
            }
        })

        const sorted = Array.from(weeks.entries()).sort((a, b) => a[0] - b[0])

        const result = sorted.map(([weekKey, data], index) => {
            const currentValue = weeklyGrowthView === "import" ? data.import : data.export
            const prevValue = index > 0
                ? (weeklyGrowthView === "import" ? sorted[index - 1][1].import : sorted[index - 1][1].export)
                : 0
            const growth = prevValue > 0 ? ((currentValue - prevValue) / prevValue) * 100 : 0

            return {
                week: `W${data.isoWeek}`,
                weekLabel: `Week ${data.isoWeek}, ${data.year}`,
                dateRange: `${data.dates[0]} - ${data.dates[data.dates.length - 1]}`,
                total: currentValue,
                growth,
            }
        })

        // Skip first week if we have more than one (no previous to compare)
        const finalResult = sorted.length > 1 ? result.slice(1) : result
        console.log("[v0] Weekly growth calculated:", finalResult)
        return finalResult
    }, [consumptionData, weeklyGrowthView])

    return (
        <div className="space-y-6">
            {/* Row 1: Balance & Day Pattern */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Import/Export Balance */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <CardTitle className="text-base">Import/Export Balance</CardTitle>
                            <ExportButton
                                data={balanceData.map((d) => ({ type: d.name, kwh: d.value }))}
                                filename={`${filenamePrefix}-import-export-balance`}
                                chartRef={balanceChartRef}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div ref={balanceChartRef} className="flex items-center gap-6 bg-background rounded-md p-2">
                            <div style={{ width: '50%', height: 180 }}>
                                <ResponsiveContainer>
                                    <PieChart>
                                        <Pie
                                            data={balanceData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={70}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {balanceData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value: number) => `${formatNumber(value)} kWh`}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <div className="text-xs text-muted-foreground">Total Import</div>
                                    <div className="text-lg font-bold text-green-600">{formatNumber(balanceData[0].value)} kWh</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Total Export</div>
                                    <div className="text-lg font-bold text-blue-600">{formatNumber(balanceData[1].value)} kWh</div>
                                </div>
                                <div className="pt-2 border-t">
                                    <div className="text-xs text-muted-foreground">Net Flow</div>
                                    <div className={`text-lg font-bold ${netFlow > 0 ? "text-green-600" : "text-blue-600"}`}>
                                        {netFlow > 0 ? "+" : ""}{formatNumber(netFlow)} kWh
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Day of Week Pattern */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-base">D-O-W Consumption Pattern</CardTitle>
                        <div className="flex gap-2 flex-wrap items-center">
                            <ExportButton
                                data={weekdayPattern.map((d) => ({
                                    day: d.day,
                                    avg_import_kwh: d.avgImport,
                                    avg_export_kwh: d.avgExport,
                                }))}
                                filename={`${filenamePrefix}-dow-pattern`}
                                chartRef={dowChartRef}
                            />
                            <Button
                                variant={weeklyPatternView === "both" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setWeeklyPatternView("both")}
                            >
                                Both
                            </Button>
                            <Button
                                variant={weeklyPatternView === "import" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setWeeklyPatternView("import")}
                            >
                                Import
                            </Button>
                            <Button
                                variant={weeklyPatternView === "export" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setWeeklyPatternView("export")}
                            >
                                Export
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {weekdayPattern && weekdayPattern.length > 0 ? (
                            <div ref={dowChartRef} className="bg-background rounded-md p-2" style={{ width: '100%', height: 180 }}>
                                <ResponsiveContainer>
                                    <BarChart data={weekdayPattern}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis dataKey="day" className="text-xs" />
                                        <YAxis className="text-xs" />
                                        <Tooltip
                                            formatter={(value: number) => `${formatNumber(value)} kWh`}
                                            labelFormatter={(label) => `Average on ${label}`}
                                        />
                                        {(weeklyPatternView === "both" || weeklyPatternView === "import") && (
                                            <Bar dataKey="avgImport" fill="#10b981" radius={[4, 4, 0, 0]} name="Import" />
                                        )}
                                        {(weeklyPatternView === "both" || weeklyPatternView === "export") && (
                                            <Bar dataKey="avgExport" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Export" />
                                        )}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-[180px] flex items-center justify-center text-muted-foreground">No data available</div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Row 2: Reading Quality & Variance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Reading Quality */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-wrap gap-2">
                        <CardTitle className="text-base">Data Quality & Completeness</CardTitle>
                        <div className="flex items-center gap-2">
                            <ExportButton
                                data={readingQuality.map((d) => ({
                                    date: d.date,
                                    reading_count: d.readingCount,
                                    expected: d.expected,
                                    completeness_pct: d.completeness,
                                    status: d.status,
                                }))}
                                filename={`${filenamePrefix}-data-quality`}
                                chartRef={qualityChartRef}
                            />
                            {avgCompleteness >= 95 ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            )}
                            <span className="text-sm font-semibold">{avgCompleteness.toFixed(1)}%</span>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {readingQuality && readingQuality.length > 0 ? (
                            <div ref={qualityChartRef} className="bg-background rounded-md p-2" style={{ width: '100%', height: 180 }}>
                                <ResponsiveContainer>
                                    <BarChart data={readingQuality}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis dataKey="date" className="text-xs" />
                                        <YAxis className="text-xs" />
                                        <Tooltip formatter={(value: number, name: string) => {
                                            if (name === "completeness") return `${value.toFixed(1)}%`
                                            return value
                                        }} />
                                        <Bar dataKey="readingCount" fill="#10b981" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="expected" fill="#e5e7eb" radius={[4, 4, 0, 0]} opacity={0.3} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-[180px] flex items-center justify-center text-muted-foreground">No data available</div>
                        )}
                    </CardContent>
                </Card>

                {/* Consumption Variance & Anomalies */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-wrap gap-2">
                        <div className="flex-1">
                            <CardTitle className="text-base">Consumption Variability</CardTitle>
                            <p className="text-xs text-muted-foreground mt-1">
                                {(() => {
                                    const values = varianceData.map(d => d.value)
                                    const avg = values.reduce((sum, v) => sum + v, 0) / values.length
                                    const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length)
                                    const coefficientOfVariation = (stdDev / avg) * 100
                                    
                                    if (coefficientOfVariation < 15) {
                                        return `Very stable consumption (CV: ${coefficientOfVariation.toFixed(1)}%). Predictable usage pattern.`
                                    } else if (coefficientOfVariation < 30) {
                                        return `Moderate variability (CV: ${coefficientOfVariation.toFixed(1)}%). Normal fluctuations.`
                                    } else if (coefficientOfVariation < 50) {
                                        return `High variability (CV: ${coefficientOfVariation.toFixed(1)}%). Significant daily swings detected.`
                                    } else {
                                        return `Extreme variability (CV: ${coefficientOfVariation.toFixed(1)}%). Unstable consumption pattern - investigate.`
                                    }
                                })()}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <ExportButton
                                data={varianceData.map((d) => ({
                                    date: d.date,
                                    import_kwh: d.value,
                                    avg_kwh: d.avg,
                                    upper_bound: d.upper,
                                    lower_bound: d.lower,
                                    is_anomaly: d.isAnomaly,
                                }))}
                                filename={`${filenamePrefix}-variability`}
                                chartRef={varianceChartRef}
                            />
                            {anomalyCount > 0 && (
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                                    <span className="text-sm font-semibold">{anomalyCount} outliers</span>
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {varianceData && varianceData.length > 0 ? (
                            <div ref={varianceChartRef} className="bg-background rounded-md p-2" style={{ width: '100%', height: 180 }}>
                                <ResponsiveContainer>
                                    <AreaChart data={varianceData}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis dataKey="date" className="text-xs" />
                                        <YAxis className="text-xs" />
                                        <Tooltip formatter={(value: number) => `${formatNumber(value)} kWh`} />
                                        <Area type="monotone" dataKey="upper" stroke="none" fill="#fbbf24" fillOpacity={0.1} />
                                        <Area type="monotone" dataKey="lower" stroke="none" fill="#fbbf24" fillOpacity={0.1} />
                                        <Line type="monotone" dataKey="avg" stroke="#6b7280" strokeWidth={2} dot={false} />
                                        <Line
                                            type="monotone"
                                            dataKey="value"
                                            stroke="#3b82f6"
                                            strokeWidth={2}
                                            dot={(props: unknown) => {
                                                const { cx, cy, payload } = props as { cx: number; cy: number; payload: { isAnomaly: boolean } }
                                                if (payload.isAnomaly) {
                                                    return <circle cx={cx} cy={cy} r={4} fill="#f97316" stroke="#fff" strokeWidth={2} />
                                                }
                                                return null
                                            }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-[180px] flex items-center justify-center text-muted-foreground">No data available</div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Row 3: Week-over-Week Growth */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-base">Week-over-Week Growth Trend</CardTitle>
                    <div className="flex gap-2 flex-wrap items-center">
                        <ExportButton
                            data={weeklyGrowth.map((d) => ({
                                week: d.week,
                                week_label: d.weekLabel,
                                date_range: d.dateRange,
                                total_kwh: d.total,
                                growth_pct: d.growth,
                                metric: weeklyGrowthView,
                            }))}
                            filename={`${filenamePrefix}-wow-growth`}
                            chartRef={wowChartRef}
                        />
                        <Button
                            variant={weeklyGrowthView === "import" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setWeeklyGrowthView("import")}
                        >
                            Import
                        </Button>
                        <Button
                            variant={weeklyGrowthView === "export" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setWeeklyGrowthView("export")}
                        >
                            Export
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {weeklyGrowth && weeklyGrowth.length > 0 ? (
                        <div ref={wowChartRef} className="bg-background rounded-md p-2" style={{ width: '100%', height: 180 }}>
                            <ResponsiveContainer>
                                <LineChart data={weeklyGrowth}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis dataKey="week" className="text-xs" />
                                    <YAxis className="text-xs" label={{ value: "Growth %", angle: -90, position: "insideLeft" }} />
                                    <Tooltip
                                        content={({ active, payload }) => {
                                            if (!active || !payload || payload.length === 0) return null
                                            const data = payload[0]?.payload
                                            if (!data) return null

                                            return (
                                                <div className="bg-background/95 backdrop-blur-sm border-2 rounded-lg p-3 shadow-xl">
                                                    <p className="font-bold text-sm mb-2">{data.weekLabel}</p>
                                                    <p className="text-xs text-muted-foreground mb-2">{data.dateRange}</p>
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between gap-4">
                                                            <span className="text-xs text-muted-foreground">Consumption:</span>
                                                            <span className="text-xs font-semibold">{formatNumber(data.total)} kWh</span>
                                                        </div>
                                                        <div className="flex justify-between gap-4">
                                                            <span className="text-xs text-muted-foreground">Growth:</span>
                                                            <span className={`text-xs font-semibold ${data.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {data.growth > 0 ? "+" : ""}{data.growth.toFixed(1)}%
                                </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        }}
                                    />
                                    <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" />
                                    <Line
                                        type="monotone"
                                        dataKey="growth"
                                        stroke="#3b82f6"
                                        strokeWidth={2}
                                        dot={{ r: 4, fill: "#3b82f6" }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[180px] flex items-center justify-center text-muted-foreground">No data available</div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
