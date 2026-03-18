"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, WifiOff, CheckCircle2 } from "lucide-react"
import type { SingleMeterStatus } from "@/hooks/api/use-meter-status-api"
import { useMemo } from "react"

interface MeterStatusTrendProps {
  statusData: SingleMeterStatus[]
  isLoading?: boolean
}

export function MeterStatusTrend({ statusData, isLoading }: MeterStatusTrendProps) {
  const stats = useMemo(() => {
    if (!statusData || statusData.length === 0) return null

    // Group by date to avoid double-counting (import/export are separate entries)
    const byDate = new Map<string, { date: string; status: string; readingCount: number }>()
    statusData.forEach((item) => {
      const dateKey = item.consumption_date.split("T")[0] // Extract just the date part
      const existing = byDate.get(dateKey)
      const isOnline = item.status && !item.status.startsWith("OFFLINE")
      
      if (!existing || (!isOnline && existing.status.startsWith("OFFLINE"))) {
        // Keep online status if exists, use latest reading count
        byDate.set(dateKey, {
          date: dateKey,
          status: item.status || "UNKNOWN",
          readingCount: Math.max(existing?.readingCount || 0, item.reading_count)
        })
      }
    })

    const uniqueDays = Array.from(byDate.values())
    const totalDays = uniqueDays.length
    const onlineDays = uniqueDays.filter((d) => !d.status.startsWith("OFFLINE")).length
    const offlineDays = totalDays - onlineDays
    const uptimePercentage = totalDays > 0 ? (onlineDays / totalDays) * 100 : 0
    const downtimePercentage = totalDays > 0 ? (offlineDays / totalDays) * 100 : 0

    const totalReadings = uniqueDays.reduce((sum, d) => sum + d.readingCount, 0)
    const avgReadingsPerDay = totalDays > 0 ? totalReadings / totalDays : 0

    // Expected readings: 96 per day (15-minute intervals = 4 per hour * 24 hours)
    const expectedReadings = totalDays * 96
    const readingCompleteness = expectedReadings > 0 ? (totalReadings / expectedReadings) * 100 : 0

    console.log("[v0] Status & Health Stats:", {
      totalDays,
      onlineDays,
      offlineDays,
      uptimePercentage,
      totalReadings,
      avgReadingsPerDay,
      readingCompleteness,
    })

    return {
      totalDays,
      onlineDays,
      offlineDays,
      uptimePercentage,
      downtimePercentage,
      totalReadings,
      avgReadingsPerDay,
      readingCompleteness,
    }
  }, [statusData])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Status & Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 animate-pulse">
            <div className="h-20 bg-muted rounded" />
            <div className="h-20 bg-muted rounded" />
            <div className="h-20 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Status & Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">No status data available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Status & Health
        </CardTitle>
        <p className="text-xs text-muted-foreground">Last {stats.totalDays} days</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Uptime */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Uptime</span>
            </div>
            <span className="text-2xl font-bold">{stats.uptimePercentage.toFixed(1)}%</span>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
            {stats.onlineDays > 0 && (
              <div
                className="h-full bg-green-500 transition-all duration-500"
                style={{ width: `${stats.uptimePercentage}%` }}
                title={`${stats.onlineDays} days online`}
              />
            )}
            {stats.offlineDays > 0 && (
              <div
                className="h-full bg-red-500 transition-all duration-500"
                style={{ width: `${stats.downtimePercentage}%` }}
                title={`${stats.offlineDays} days offline`}
              />
            )}
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-green-600 font-medium">{stats.onlineDays} days online</span>
            <span className="text-red-600 font-medium">{stats.offlineDays} days offline</span>
          </div>
        </div>

        {/* Reading Completeness */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Data Completeness</span>
            </div>
            <span className="text-2xl font-bold">{stats.readingCompleteness.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
              style={{ width: `${Math.max(Math.min(stats.readingCompleteness, 100), 1)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {stats.totalReadings.toLocaleString()} readings collected ({stats.avgReadingsPerDay.toFixed(0)} avg/day)
          </p>
        </div>

        {/* Status indicator */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Current Status</span>
            {statusData[statusData.length - 1]?.status && !statusData[statusData.length - 1]?.status.startsWith("OFFLINE") ? (
              <div className="flex items-center gap-2 text-green-600">
                <div className="h-2 w-2 rounded-full bg-green-600 animate-pulse" />
                <span className="text-sm font-semibold">ONLINE</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-600">
                <WifiOff className="h-4 w-4" />
                <span className="text-sm font-semibold">OFFLINE</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
