"use client"

import { useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { TrendingUp, TrendingDown, Zap, BarChart3, LineChart as LineChartIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ConsumptionData {
  consumption_date: string
  meter_number: string
  consumed_energy: number
  system_name: "import_kwh" | "export_kwh"
}

interface MeterConsumptionChartProps {
  data: ConsumptionData[]
  comparisonData?: ConsumptionData[]
  comparisonMode: "week" | "month"
}

export function MeterConsumptionChart({ data, comparisonData, comparisonMode }: MeterConsumptionChartProps) {
  const [visibleSeries, setVisibleSeries] = useState<("import" | "export" | "net")[]>(["import", "export", "net"])

  const chartData = useMemo(() => {
    const grouped = new Map<string, { date: string; import: number; export: number; net: number; peak?: boolean }>()

    data.forEach((item) => {
      const dateKey = format(parseISO(item.consumption_date), "yyyy-MM-dd")
      const existing = grouped.get(dateKey) || { date: dateKey, import: 0, export: 0, net: 0 }

      if (item.system_name === "import_kwh") {
        existing.import += item.consumed_energy // Use consumed_energy directly (it's already the daily consumption)
      } else if (item.system_name === "export_kwh") {
        existing.export += item.consumed_energy
      }

      existing.net = existing.import - existing.export
      grouped.set(dateKey, existing)
    })

    const result = Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date))

    // Mark peak demand day
    if (result.length > 0) {
      const maxImport = Math.max(...result.map((d) => d.import))
      const peakDay = result.find((d) => d.import === maxImport)
      if (peakDay) {
        peakDay.peak = true
      }
    }

    return result
  }, [data])

  const comparisonChartData = useMemo(() => {
    if (!comparisonData) return []

    const grouped = new Map<string, { date: string; prevImport: number; prevExport: number; prevNet: number }>()

    comparisonData.forEach((item) => {
      const dateKey = format(parseISO(item.consumption_date), "yyyy-MM-dd")
      const existing = grouped.get(dateKey) || { date: dateKey, prevImport: 0, prevExport: 0, prevNet: 0 }

      if (item.system_name === "import_kwh") {
        existing.prevImport = item.consumed_energy
      } else if (item.system_name === "export_kwh") {
        existing.prevExport = item.consumed_energy
      }

      existing.prevNet = existing.prevImport - existing.prevExport
      grouped.set(dateKey, existing)
    })

    return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [comparisonData])

  const { peakValue, averageImport, totalImport, totalExport } = useMemo(() => {
    const peakValue = Math.max(...chartData.map((d) => d.import), 0)
    const totalImport = chartData.reduce((sum, d) => sum + d.import, 0)
    const totalExport = chartData.reduce((sum, d) => sum + d.export, 0)
    const averageImport = chartData.length > 0 ? totalImport / chartData.length : 0

    return { peakValue, averageImport, totalImport, totalExport }
  }, [chartData])

  const comparisonMetrics = useMemo(() => {
    if (!comparisonChartData || comparisonChartData.length === 0) return null

    const prevTotalImport = comparisonChartData.reduce((sum, d) => sum + d.prevImport, 0)
    const prevTotalExport = comparisonChartData.reduce((sum, d) => sum + d.prevExport, 0)
    const prevAverage = comparisonChartData.length > 0 ? prevTotalImport / comparisonChartData.length : 0

    const importChange = totalImport - prevTotalImport
    // Handle division by zero
    const importChangePercent = prevTotalImport > 0 ? (importChange / prevTotalImport) * 100 : (totalImport > 0 ? 100 : 0)
    
    const exportChange = totalExport - prevTotalExport
    // Handle division by zero - if both are 0, show 0% not NaN
    const exportChangePercent = prevTotalExport > 0 ? (exportChange / prevTotalExport) * 100 : (totalExport > 0 ? 100 : 0)

    return {
      prevTotalImport,
      prevTotalExport,
      prevAverage,
      importChange,
      importChangePercent,
      exportChange,
      exportChangePercent,
    }
  }, [comparisonChartData, totalImport, totalExport])
  
  // Number formatting helper
  const formatNumber = (num: number, decimals = 2) => {
    return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  }

  if (chartData.length === 0) {
    return (
      <div className="h-[500px] flex flex-col items-center justify-center text-muted-foreground">
        <Activity className="h-16 w-16 mb-4 opacity-20" />
        <p className="text-lg font-semibold">No consumption data available</p>
        <p className="text-sm">Try selecting a different date range</p>
      </div>
    )
  }

  const toggleSeries = (series: "import" | "export" | "net") => {
    setVisibleSeries(prev => 
      prev.includes(series) 
        ? prev.filter(s => s !== series)
        : [...prev, series]
    )
  }

  return (
    <div className="space-y-4">
      {/* Series Selection */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground">Display:</span>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={visibleSeries.includes("import")}
              onChange={() => toggleSeries("import")}
              className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            <span className="text-sm font-medium">Import Energy</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={visibleSeries.includes("export")}
              onChange={() => toggleSeries("export")}
              className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm font-medium">Export Energy</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={visibleSeries.includes("net")}
              onChange={() => toggleSeries("net")}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium">Net Consumption</span>
          </label>
        </div>
      </div>

      {/* Main Chart */}
      <div className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <defs>
              <linearGradient id="importGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="exportGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(parseISO(value), "MMM dd")}
              className="text-xs"
              stroke="currentColor"
            />
            <YAxis 
              className="text-xs" 
              stroke="currentColor"
              label={{ value: "Energy (kWh)", angle: -90, position: "insideLeft", style: { textAnchor: "middle" } }} 
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null

                const data = payload[0]?.payload
                if (!data) return null

                return (
                  <div className="bg-background/95 backdrop-blur-sm border-2 rounded-lg p-4 shadow-xl min-w-[240px]">
                    <p className="font-bold text-base mb-3 flex items-center justify-between">
                      {format(parseISO(data.date), "EEEE, MMM dd")}
                      {data.peak && (
                        <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-500 text-xs">
                          <Zap className="h-3 w-3 fill-current" />
                          Peak
                        </span>
                      )}
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-500" />
                          <span className="text-sm text-muted-foreground">Import</span>
                        </div>
                        <span className="text-sm font-bold">{data.import.toFixed(2)} kWh</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500" />
                          <span className="text-sm text-muted-foreground">Export</span>
                        </div>
                        <span className="text-sm font-bold">{data.export.toFixed(2)} kWh</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 pt-2 border-t">
                        <span className="text-sm text-muted-foreground font-semibold">Net</span>
                        <span className="text-sm font-bold">{data.net.toFixed(2)} kWh</span>
                      </div>
                    </div>
                  </div>
                )
              }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: "20px" }}
              iconType="circle"
            />

            {/* Peak demand reference line */}
            {peakValue > 0 && (
              <ReferenceLine
                y={peakValue}
                stroke="#eab308"
                strokeDasharray="5 5"
                strokeWidth={2}
              />
            )}

            {/* Average reference line */}
            {averageImport > 0 && (
              <ReferenceLine
                y={averageImport}
                stroke="#3b82f6"
                strokeDasharray="3 3"
                strokeWidth={1.5}
              />
            )}

            {visibleSeries.includes("import") && (
              <Area
                type="monotone"
                dataKey="import"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#importGradient)"
                dot={false}
                name="Import Energy"
              />
            )}
            {visibleSeries.includes("export") && (
              <Area
                type="monotone"
                dataKey="export"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#exportGradient)"
                dot={false}
                name="Export Energy"
              />
            )}
            {visibleSeries.includes("net") && (
              <Line
                type="monotone"
                dataKey="net"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
                name="Net Consumption"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Comparison Summary */}
      {comparisonMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Current Period vs {comparisonMode === "week" ? "Previous Period" : "Previous Month"}
            </p>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Import Energy</span>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{formatNumber(totalImport)} kWh</p>
                  <p className="text-xs text-muted-foreground">vs {formatNumber(comparisonMetrics.prevTotalImport)} kWh</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium">Export Energy</span>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{formatNumber(totalExport)} kWh</p>
                  <p className="text-xs text-muted-foreground">vs {formatNumber(comparisonMetrics.prevTotalExport)} kWh</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Change Analysis</p>
            
            <div className="space-y-2">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Import Change</span>
                  <div className={`flex items-center gap-1 font-bold text-sm ${comparisonMetrics.importChangePercent >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {comparisonMetrics.importChangePercent >= 0 ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    {Math.abs(comparisonMetrics.importChangePercent).toFixed(1)}%
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {comparisonMetrics.importChange >= 0 ? "+" : ""}{formatNumber(comparisonMetrics.importChange)} kWh difference
                </p>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Export Change</span>
                  <div className={`flex items-center gap-1 font-bold text-sm ${comparisonMetrics.exportChangePercent >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {comparisonMetrics.exportChangePercent >= 0 ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    {comparisonMetrics.exportChangePercent === 0 ? "0.0" : Math.abs(comparisonMetrics.exportChangePercent).toFixed(1)}%
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {comparisonMetrics.exportChange >= 0 ? "+" : ""}{comparisonMetrics.exportChange.toFixed(2)} kWh difference
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Activity({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  )
}

function Label({ value, position, fill, style }: any) {
  return null // Recharts will handle this
}
