"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useCustomerConsumptionDetail } from "@/hooks/api/use-customer-consumption-detail-api"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

interface RegionalCustomerSalesTrendProps {
  region: string
  dateRange: { start: string; end: string }
}

const COLORS = {
  Zeus: "#3b82f6",
  SAP: "#10b981",
  Oracle: "#f59e0b",
  Unknown: "#8b5cf6",
}

export function RegionalCustomerSalesTrend({ region, dateRange }: RegionalCustomerSalesTrendProps) {
  const { data: detailData } = useCustomerConsumptionDetail({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    region,
    limit: 10000,
    page: 1,
  })

  const chartData = useMemo(() => {
    const records = detailData?.data || []
    const dataByMonth = new Map<string, Map<string, number>>()

    // Group by month and source
    records.forEach((record: any) => {
      const date = record.lastbilldate ? new Date(record.lastbilldate) : null
      if (!date) return

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      const src = record.data_src || "Unknown"
      const kwh = record.lastbillconsumption || 0

      if (!dataByMonth.has(monthKey)) {
        dataByMonth.set(monthKey, new Map())
      }
      const srcMap = dataByMonth.get(monthKey)!
      srcMap.set(src, (srcMap.get(src) || 0) + kwh)
    })

    // Convert to array and sort by month
    const sorted = Array.from(dataByMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, srcMap]) => {
        const item: any = { month }
        srcMap.forEach((kwh, src) => {
          item[src] = kwh
        })
        return item
      })

    return sorted
  }, [detailData])

  const uniqueSources = useMemo(() => {
    const sources = new Set<string>()
    chartData.forEach((item) => {
      Object.keys(item).forEach((key) => {
        if (key !== "month") sources.add(key)
      })
    })
    return Array.from(sources).sort()
  }, [chartData])

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Consumption Trend</CardTitle>
          <CardDescription>Monthly consumption by data source</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">No data available for the selected period</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consumption Trend</CardTitle>
        <CardDescription>Monthly consumption by data source ({uniqueSources.length} source{uniqueSources.length !== 1 ? "s" : ""})</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const [year, month] = value.split("-")
                  const date = new Date(parseInt(year), parseInt(month) - 1)
                  return date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" })
                }}
              />
              <YAxis
                label={{ value: "Consumption (kWh)", angle: -90, position: "insideLeft" }}
                tickFormatter={(value) => (value / 1000000).toFixed(1) + "M"}
              />
              <Tooltip
                formatter={(value) => {
                  if (typeof value === "number") {
                    return [value.toLocaleString("en-US", { maximumFractionDigits: 0 }) + " kWh", ""]
                  }
                  return value
                }}
                labelFormatter={(label) => `Month: ${label}`}
              />
              <Legend />
              {uniqueSources.map((src) => (
                <Line
                  key={src}
                  type="monotone"
                  dataKey={src}
                  stroke={COLORS[src as keyof typeof COLORS] || COLORS.Unknown}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
