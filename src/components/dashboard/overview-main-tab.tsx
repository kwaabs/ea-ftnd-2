"use client"

import { Badge } from "@/components/ui/badge"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useConsumptionAggregate, useGroupedConsumptionAggregate } from "@/lib/hooks/use-consumption-aggregate-api"
import { useDailyConsumption } from "@/lib/hooks/use-daily-consumption-api"
import { useConsumptionBreakdown } from "@/lib/hooks/use-consumption-api"
import { formatNumber, formatDate, formatDateLocal, formatTime } from "@/lib/utils/date-helpers"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Legend } from "recharts"
import {
  Activity,
  Zap,
  TrendingUp,
  Database,
  ListFilter,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Search,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useState, useMemo } from "react"
import React from "react"
import { useRouter } from "next/navigation"
import { useMeterStatusSummary, useStatusTimeline, useMeterStatusDetails } from "@/lib/hooks/use-meter-status-api"
import { TablePagination } from "@/components/ui/table-pagination"

interface OverviewMainTabProps {
  dateRange: { start: string; end: string }
  regions?: string[]
  districts?: string[]
  stations?: string[]
  boundaryMeteringPoints?: string[]
  meterTypes?: string[]
  voltages?: number[]
  location?: string
  feeders?: string[] // Added feeders to the interface
}

export function OverviewMainTab({
  dateRange,
  regions,
  districts,
  stations,
  boundaryMeteringPoints,
  meterTypes: meterTypesProp,
  voltages,
  location,
  feeders, // Added feeders to the props
}: OverviewMainTabProps) {
  const [selectedMetrics, setSelectedMetrics] = useState({
    import_kwh: true,
    export_kwh: true,
    net_kwh: false,
    import_kvah: false,
    export_kvah: false,
    net_kvah: false,
  })
  const [categoryMetrics, setCategoryMetrics] = useState({
    import_kwh: true,
    export_kwh: true,
  })
  const [regionMetrics, setRegionMetrics] = useState({
    import_kwh: true,
    export_kwh: false,
  })
  const [rankingColumns, setRankingColumns] = useState({
    showNetKwh: false,
    showAvgDaily: false,
  })
  const [trendView, setTrendView] = useState<"aggregate" | "individual">("aggregate")
  const [individualMetrics, setIndividualMetrics] = useState({
    showImport: true,
    showExport: true,
    showNet: false,
  })
  const [topNMeters, setTopNMeters] = useState<string>("10")
  const [drillDownOpen, setDrillDownOpen] = useState(false)
  const [groupBy, setGroupBy] = useState<"none" | "meter_type" | "location" | "region" | "district" | "station">("none")
  const [sortColumn, setSortColumn] = useState<"import_rank" | "export_rank" | "import_kwh" | "export_kwh">(
    "import_rank",
  )
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const [individualMetricTab, setIndividualMetricTab] = useState<"import" | "export" | "net">("import")
  const [meterSearchQuery, setMeterSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const metersPerPage = 20

  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all")
  const [statusSortColumn, setStatusSortColumn] = useState<
    "meter_number" | "meter_type" | "status" | "consumption" | "reading_count" | "last_reading" | "uptime"
  >("meter_number")
  const [statusSortDirection, setStatusSortDirection] = useState<"asc" | "desc">("asc")
  const statusPageSize = 50
  const [statusPage, setStatusPage] = useState(1)
  const [statusSearchQuery, setStatusSearchQuery] = useState("")

  const router = useRouter()

  const params = {
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    regions: regions && regions.length > 0 ? regions : undefined,
    districts: districts && districts.length > 0 ? districts : undefined,
    stations: stations && stations.length > 0 ? stations : undefined,
    // Add feeders to params
    feeders: feeders && feeders.length > 0 ? feeders : undefined,
    meterTypes: meterTypesProp && meterTypesProp.length > 0 ? meterTypesProp : undefined,
    voltages: voltages && voltages.length > 0 ? voltages : undefined,
    boundaryMeteringPoints:
      boundaryMeteringPoints && boundaryMeteringPoints.length > 0 ? boundaryMeteringPoints : undefined,
    voltage_kv: voltages && voltages.length > 0 ? voltages : undefined,
  }

  const aggregateParams = {
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    region: regions && regions.length > 0 ? regions[0] : undefined,
    district: districts && districts.length > 0 ? districts[0] : undefined,
    station: stations && stations.length > 0 ? stations[0] : undefined,
    boundaryMeteringPoint:
      boundaryMeteringPoints && boundaryMeteringPoints.length > 0 ? boundaryMeteringPoints[0] : undefined,
    meterType: meterTypesProp && meterTypesProp.length > 0 ? meterTypesProp[0] : undefined,
    voltage_kv: voltages && voltages.length > 0 ? voltages[0] : undefined,
  }

  const { data: aggregateData, isLoading: aggregateLoading } = useConsumptionAggregate(aggregateParams)

  const { data: categoryData, isLoading: categoryLoading } = useGroupedConsumptionAggregate({
    ...aggregateParams,
    group: "meter_type",
  })

  const { data: regionData, isLoading: regionDataLoading } = useGroupedConsumptionAggregate({
    ...aggregateParams,
    group: "meter_type,region",
  })

  // const { data: timeseries, isLoading: timeseriesLoading, error: timeseriesError } = useConsumptionTimeseries(params)

  const { data: meterTypeBreakdown, isLoading: meterTypeLoading } = useConsumptionBreakdown({
    ...params,
    group_by: "meter_type",
  })
  const { data: regionBreakdown, isLoading: regionLoading } = useConsumptionBreakdown({
    ...params,
    group_by: "region",
    meter_type_view: true,
  })
  const { data: meterRankings, isLoading: rankingsLoading } = useDailyConsumption(aggregateParams)

  console.log("[v0] Overview - aggregateParams:", aggregateParams)
  console.log("[v0] Overview - meterRankings:", meterRankings)
  console.log("[v0] Overview - rankingsLoading:", rankingsLoading)

  // const meterStatusParams = {
  //   dateFrom: dateRange.start,
  //   dateTo: dateRange.end,
  //   region: regions && regions.length > 0 ? regions : undefined,
  //   district: districts && districts.length > 0 ? districts : undefined,
  //   station: stations && stations.length > 0 ? stations : undefined,
  //   boundaryMeteringPoints:
  //     boundaryMeteringPoints && boundaryMeteringPoints.length > 0 ? boundaryMeteringPoints : undefined,
  //   meterType: meterTypesProp && meterTypesProp.length > 0 ? meterTypesProp : undefined,
  //   voltage_kv: voltages && voltages.length > 0 ? voltages : undefined,
  // }

  // const { data: meterStatusCounts, isLoading: isLoadingStatusCounts } = useOverviewMeterStatusCounts(meterStatusParams)
  // const { data: meterStatusData, isLoading: isLoadingStatusData } = useOverviewMeterStatus(meterStatusParams)
  const { data: meterStatusSummary, isLoading: isLoadingSummary } = useMeterStatusSummary(params)
  const { data: statusTimelineData, isLoading: isLoadingTimeline } = useStatusTimeline(params)
  const {
    data: meterStatusDetails,
    isLoading: isLoadingDetails,
    error: detailsError,
  } = useMeterStatusDetails({
    ...params,
    page: statusPage,
    limit: statusPageSize,
    search: statusSearchQuery || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    sortBy: statusSortColumn,
    sortOrder: statusSortDirection,
  })

  const { data: allMetersForBreakdown } = useMeterStatusDetails({
    ...params,
    page: 1,
    limit: 5000, // Fetch all meters to aggregate by type
  })

  const dateFrom = dateRange.start
  const dateTo = dateRange.end

  const daysInRange = useMemo(() => {
    if (!dateFrom || !dateTo) return 0
    const start = new Date(dateFrom)
    const end = new Date(dateTo)
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }, [dateFrom, dateTo])

  // The following useMemo hook was moved down to ensure processedStatusData is declared first.
  // const meterUptime = useMemo(() => {
  //   if (!meterStatusData || processedStatusData.length === 0 || daysInRange === 0) return 0

  //   const totalUptime = processedStatusData.reduce((sum, meter) => {
  //     const onlineDays = new Set<string>()
  //     const allDays = new Set<string>()

  //     meterStatusData
  //       .filter((r) => r.meter_number === meter.meter_number)
  //       .forEach((record) => {
  //         const date = new Date(record.consumption_date).toISOString().split("T")[0]
  //         allDays.add(date)
  //         if (record.status === "ONLINE") {
  //           onlineDays.add(date)
  //         }
  //       })

  //     const meterUptime = allDays.size > 0 ? (onlineDays.size / allDays.size) * 100 : 0
  //     return sum + meterUptime
  //   }, 0)

  //   return processedStatusData.length > 0 ? totalUptime / processedStatusData.length : 0
  // }, [meterStatusData, processedStatusData, daysInRange])

  const chartData = useMemo(() => {
    if (!aggregateData?.rawData || aggregateData.rawData.length === 0) {
      return []
    }

    // Group data by date
    const dateMap = new Map<string, { date: string; import_kwh: number; export_kwh: number }>()

    aggregateData.rawData.forEach((item) => {
      const date = item.group_period.split("T")[0] // Extract date part

      if (!dateMap.has(date)) {
        dateMap.set(date, {
          date,
          import_kwh: 0,
          export_kwh: 0,
        })
      }

      const entry = dateMap.get(date)!

      if (item.system_name === "import_kwh") {
        entry.import_kwh += item.total_consumption
      } else if (item.system_name === "export_kwh") {
        entry.export_kwh += item.total_consumption
      }
    })

    // Convert to array and add calculated fields
    return Array.from(dateMap.values())
      .map((item) => ({
        ...item,
        net_kwh: item.import_kwh - item.export_kwh,
        // Add kvah fields as 0 for now (can be added later if API provides them)
        import_kvah: 0,
        export_kvah: 0,
        net_kvah: 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date)) // Sort by date ascending
  }, [aggregateData])

  const individualMeterChartData = useMemo(() => {
    console.log("[v0] Calculating individualMeterChartData")
    console.log("[v0] meterRankings?.rankings length:", meterRankings?.rankings?.length)
    console.log("[v0] meterRankings?.rawData length:", meterRankings?.rawData?.length)

    if (!meterRankings?.rankings || !meterRankings?.rawData) {
      console.log("[v0] No meterRankings data available")
      return []
    }

    const topMeters = meterRankings.rankings.slice(0, Number(topNMeters))
    console.log("[v0] Top meters selected:", topMeters.length)

    const meterNumbers = topMeters.map((m) => m.meter_number)

    const dateMap = new Map<string, any>()

    meterRankings.rawData.forEach((record) => {
      if (!meterNumbers.includes(record.meter_number)) return
      if (!record.consumption_date) return

      const date = record.consumption_date.split("T")[0]
      if (!dateMap.has(date)) {
        dateMap.set(date, { date })
      }

      const entry = dateMap.get(date)!
      const meterKey = record.meter_number

      if (record.system_name === "import_kwh") {
        entry[`${meterKey}_import`] = (entry[`${meterKey}_import`] || 0) + record.consumed_energy
      } else if (record.system_name === "export_kwh") {
        entry[`${meterKey}_export`] = (entry[`${meterKey}_export`] || 0) + record.consumed_energy
      }
    })

    const result = Array.from(dateMap.values())
    result.forEach((entry) => {
      meterNumbers.forEach((meter) => {
        const importVal = entry[`${meter}_import`] || 0
        const exportVal = entry[`${meter}_export`] || 0
        entry[`${meter}_net`] = importVal - exportVal
      })
    })

    const sorted = result.sort((a, b) => a.date.localeCompare(b.date))
    console.log("[v0] individualMeterChartData calculated:", sorted.length, "data points")
    return sorted
  }, [meterRankings, topNMeters])

  const topMetersForChart = useMemo(() => {
    return meterRankings?.rankings?.slice(0, Number(topNMeters)) || []
  }, [meterRankings, topNMeters])

  const METER_COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "#8b5cf6",
    "#ec4899",
    "#f59e0b",
    "#10b981",
    "#06b6d4",
  ]

  const meterTypes = meterTypesProp ?? []

  const { groupedMeters, sortedMeters } = React.useMemo(() => {
    if (!meterRankings?.rankings || meterRankings.rankings.length === 0)
      return { groupedMeters: new Map(), sortedMeters: [] }

    const sorted = [...meterRankings.rankings].sort((a, b) => {
      let aValue, bValue

      switch (sortColumn) {
        case "import_rank":
          aValue = a?.import_rank ?? 999999
          bValue = b?.import_rank ?? 999999
          break
        case "export_rank":
          aValue = a?.export_rank ?? 999999
          bValue = b?.export_rank ?? 999999
          break
        case "import_kwh":
          aValue = a?.total_import_kwh ?? 0
          bValue = b?.total_import_kwh ?? 0
          break
        case "export_kwh":
          aValue = a?.total_export_kwh ?? 0
          bValue = b?.total_export_kwh ?? 0
          break
        default:
          aValue = Math.min(a?.import_rank ?? 999999, a?.export_rank ?? 999999)
          bValue = Math.min(b?.import_rank ?? 999999, b?.export_rank ?? 999999)
      }

      return sortDirection === "asc" ? aValue - bValue : bValue - aValue
    })

    if (groupBy === "none") {
      return { groupedMeters: new Map(), sortedMeters: sorted }
    }

    const grouped = new Map<string, typeof sortedMeters>()
    sorted?.forEach((meter) => {
      const groupKey = meter?.[groupBy] ?? "Unknown"
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, [])
      }
      grouped.get(groupKey)!.push(meter)
    })

    return { groupedMeters: grouped, sortedMeters: [] }
  }, [meterRankings, groupBy, sortColumn, sortDirection])

  const toggleMetric = (metric: keyof typeof selectedMetrics) => {
    setSelectedMetrics((prev) => ({ ...prev, [metric]: !prev[metric] }))
  }

  const toggleCategoryMetric = (metric: keyof typeof categoryMetrics) => {
    setCategoryMetrics((prev) => ({ ...prev, [metric]: !prev[metric] }))
  }

  const toggleRegionMetric = (metric: keyof typeof regionMetrics) => {
    setRegionMetrics((prev) => ({ ...prev, [metric]: !prev[metric] }))
  }

  const toggleRankingColumn = (column: keyof typeof rankingColumns) => {
    setRankingColumns((prev) => ({ ...prev, [column]: !prev[column] }))
  }

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      return next
    })
  }

  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  const calculateGroupTotals = (meters: typeof sortedMeters) => {
    return {
      totalImport: meters?.reduce((sum, m) => sum + (m?.total_import_kwh ?? 0), 0) ?? 0,
      totalExport: meters?.reduce((sum, m) => sum + (m?.total_export_kwh ?? 0), 0) ?? 0,
      count: meters?.length ?? 0,
    }
  }

  const regionStackedData = useMemo(() => {
    if (!regionBreakdown?.breakdown) return []

    const regionMap = new Map<string, any>()

    regionBreakdown?.breakdown?.forEach((item: any) => {
      const regionName = item?.region
      if (!regionMap.has(regionName)) {
        regionMap.set(regionName, { region: regionName })
      }

      const regionData = regionMap.get(regionName)
      regionData[`${item?.meter_type}_import`] = item?.import_kwh
      regionData[`${item?.meter_type}_export`] = item?.export_kwh
    })

    return Array.from(regionMap.values())
  }, [regionBreakdown])

  const categoryChartData = useMemo(() => {
    if (!categoryData || categoryData.length === 0) return []

    const meterTypeMap = new Map<string, { meter_type: string; import_kwh: number; export_kwh: number }>()

    categoryData.forEach((item) => {
      const meterType = item.meter_type || "Unknown"

      if (!meterTypeMap.has(meterType)) {
        meterTypeMap.set(meterType, {
          meter_type: meterType,
          import_kwh: 0,
          export_kwh: 0,
        })
      }

      const entry = meterTypeMap.get(meterType)!

      if (item.system_name === "import_kwh") {
        entry.import_kwh += item.total_consumption
      } else if (item.system_name === "export_kwh") {
        entry.export_kwh += item.total_consumption
      }
    })

    return Array.from(meterTypeMap.values()).sort((a, b) => b.import_kwh - a.import_kwh)
  }, [categoryData])

  const regionChartData = useMemo(() => {
    if (!regionData || regionData.length === 0) return []

    const regionMap = new Map<string, any>()

    regionData.forEach((item) => {
      const regionName = item.region || "Unknown"
      const meterType = item.meter_type || "Unknown"

      if (!regionMap.has(regionName)) {
        regionMap.set(regionName, { region: regionName })
      }

      const entry = regionMap.get(regionName)!

      if (item.system_name === "import_kwh") {
        entry[`${meterType}_import`] = (entry[`${meterType}_import`] || 0) + item.total_consumption
      } else if (item.system_name === "export_kwh") {
        entry[`${meterType}_export`] = (entry[`${meterType}_export`] || 0) + item.total_consumption
      }
    })

    return Array.from(regionMap.values()).sort((a, b) => {
      const aTotal = Object.keys(a)
        .filter((k) => k.includes("_import"))
        .reduce((sum, k) => sum + (a[k] || 0), 0)
      const bTotal = Object.keys(b)
        .filter((k) => k.includes("_import"))
        .reduce((sum, k) => sum + (b[k] || 0), 0)
      return bTotal - aTotal
    })
  }, [regionData])

  const uniqueMeterTypes = useMemo(() => {
    if (!regionData || regionData.length === 0) return []
    const types = new Set<string>()
    regionData.forEach((item) => {
      if (item.meter_type) {
        types.add(item.meter_type)
      }
    })
    return Array.from(types)
  }, [regionData])

  const meterTypeColors: Record<string, string> = {
    BSP: "hsl(221, 83%, 53%)",
    PSS: "hsl(142, 76%, 36%)",
    REGIONAL_BOUNDARY: "hsl(25, 95%, 53%)",
    DISTRICT_BOUNDARY: "hsl(271, 81%, 56%)",
    FEEDER: "hsl(0, 59%, 41%)",
    SUBSTATION: "hsl(280, 67%, 47%)",
  }

  const meterTypeCountBreakdown = useMemo(() => {
    if (!allMetersForBreakdown?.data) return {}

    const breakdown: Record<string, { online: Set<string>; total: Set<string> }> = {}

    allMetersForBreakdown.data.forEach((meter) => {
      const meterType = meter.meter_type || "Unknown"
      const meterNumber = meter.meter_number

      if (!breakdown[meterType]) {
        breakdown[meterType] = {
          online: new Set<string>(),
          total: new Set<string>(),
        }
      }

      breakdown[meterType].total.add(meterNumber)

      if (meter.status === "online" || meter.status === "ONLINE") {
        breakdown[meterType].online.add(meterNumber)
      }
    })

    // Convert Sets to counts
    const result: Record<string, { online: number; total: number }> = {}
    Object.keys(breakdown).forEach((meterType) => {
      result[meterType] = {
        online: breakdown[meterType].online.size,
        total: breakdown[meterType].total.size,
      }
    })

    return result
  }, [allMetersForBreakdown])

  const infoCards = useMemo(() => {
    const meterTypeBreakdown = categoryData?.reduce(
      (acc, item) => {
        const meterType = item.meter_type || "Unknown"
        if (!acc[meterType]) {
          acc[meterType] = { import: 0, export: 0 }
        }
        if (item.system_name === "import_kwh") {
          acc[meterType].import += item.total_consumption
        } else if (item.system_name === "export_kwh") {
          acc[meterType].export += item.total_consumption
        }
        return acc
      },
      {} as Record<string, { import: number; export: number }>,
    )

    return [
      {
        title: "Total Import",
        value: aggregateData ? formatNumber(aggregateData.totalImportKwh ?? 0) : "—",
        unit: "kWh imported",
        icon: Zap,
        breakdown: meterTypeBreakdown,
        metric: "import",
      },
      {
        title: "Total Export",
        value: aggregateData ? formatNumber(aggregateData.totalExportKwh ?? 0) : "—",
        unit: "kWh exported",
        icon: TrendingUp,
        breakdown: meterTypeBreakdown,
        metric: "export",
      },
      {
        title: "Net Consumption",
        value: aggregateData ? formatNumber(aggregateData.netKwh ?? 0) : "—",
        unit: "kWh net (import - export)",
        icon: Activity,
        breakdown: meterTypeBreakdown,
        metric: "net",
      },
      {
        title: "Meters",
        value: meterStatusSummary
          ? `${Math.round(meterStatusSummary.online ?? 0)} / ${Math.round(meterStatusSummary.total ?? 0)}`
          : "—",
        unit: "Online / Total meters",
        icon: Database,
        breakdown: meterTypeCountBreakdown,
        metric: "meters",
      },
    ]
  }, [aggregateData, categoryData, meterStatusSummary, meterTypeCountBreakdown])

  const individualMeterTableData = useMemo(() => {
    console.log("[v0] Calculating individualMeterTableData")
    console.log("[v0] meterRankings?.rankings length:", meterRankings?.rankings?.length)
    console.log("[v0] meterRankings?.rawData length:", meterRankings?.rawData?.length)

    if (!meterRankings?.rankings || !meterRankings?.rawData) {
      console.log("[v0] No meterRankings data available")
      return { allDates: [], meterRows: [], totals: {} }
    }

    // Get all unique dates from raw data
    const allDates = Array.from(
      new Set(
        meterRankings.rawData.filter((r) => r.consumption_date).map((record) => record.consumption_date.split("T")[0]),
      ),
    ).sort()

    console.log("[v0] All dates:", allDates.length)

    // Create a map of meter -> date -> {import, export}
    const meterDateMap = new Map<string, Map<string, { import: number; export: number }>>()

    meterRankings.rawData.forEach((record) => {
      if (!record.consumption_date) return

      const meterNumber = record.meter_number
      const date = record.consumption_date.split("T")[0]

      if (!meterDateMap.has(meterNumber)) {
        meterDateMap.set(meterNumber, new Map())
      }

      const dateMap = meterDateMap.get(meterNumber)!
      if (!dateMap.has(date)) {
        dateMap.set(date, { import: 0, export: 0 })
      }

      const dayData = dateMap.get(date)!
      if (record.system_name === "import_kwh") {
        dayData.import += record.consumed_energy
      } else if (record.system_name === "export_kwh") {
        dayData.export += record.consumed_energy
      }
    })

    // Create rows for each meter
    const meterRows = meterRankings.rankings.map((meter) => {
      const dateMap = meterDateMap.get(meter.meter_number) || new Map()

      const dailyValues = allDates.map((date) => {
        const dayData = dateMap.get(date) || { import: 0, export: 0 }
        return {
          date,
          import: dayData.import,
          export: dayData.export,
          net: dayData.import - dayData.export,
        }
      })

      return {
        meterNumber: meter.meter_number,
        meterType: meter.meter_type,
        region: meter.region,
        station: meter.station,
        dailyValues,
        totalImport: meter.total_import_kwh || 0,
        totalExport: meter.total_export_kwh || 0,
        totalNet: (meter.total_import_kwh || 0) - (meter.total_export_kwh || 0),
      }
    })

    // Calculate totals for each date
    const totals = allDates.reduce(
      (acc, date) => {
        acc[date] = { import: 0, export: 0, net: 0 }
        return acc
      },
      {} as Record<string, { import: number; export: number; net: number }>,
    )

    meterRows.forEach((row) => {
      row.dailyValues.forEach((day) => {
        totals[day.date].import += day.import
        totals[day.date].export += day.export
        totals[day.date].net += day.net
      })
    })

    console.log("[v0] individualMeterTableData calculated:", meterRows.length, "meters")
    return { allDates, meterRows, totals }
  }, [meterRankings])

  const filteredAndPaginatedMeters = useMemo(() => {
    let filtered = individualMeterTableData.meterRows

    // Apply search filter
    if (meterSearchQuery.trim()) {
      const query = meterSearchQuery.toLowerCase()
      filtered = filtered.filter(
        (meter) =>
          meter.meterNumber.toLowerCase().includes(query) ||
          meter.meterType?.toLowerCase().includes(query) ||
          meter.region?.toLowerCase().includes(query) ||
          meter.station?.toLowerCase().includes(query),
      )
    }

    // Calculate pagination
    const totalPages = Math.ceil(filtered.length / metersPerPage)
    const startIndex = (currentPage - 1) * metersPerPage
    const endIndex = startIndex + metersPerPage
    const paginated = filtered.slice(startIndex, endIndex)

    return {
      meters: paginated,
      totalMeters: filtered.length,
      totalPages,
      currentPage,
    }
  }, [individualMeterTableData.meterRows, meterSearchQuery, currentPage])

  const maxIndividualValue = useMemo(() => {
    if (individualMeterTableData.meterRows.length === 0) return 0

    let max = 0
    individualMeterTableData.meterRows.forEach((row) => {
      row.dailyValues.forEach((day) => {
        const value = Math.abs(day[individualMetricTab])
        if (value > max) max = value
      })
    })
    return max
  }, [individualMeterTableData.meterRows, individualMetricTab])

  const getIndividualCellColor = (value: number) => {
    if (value === 0) return "transparent"

    const intensity = Math.min(Math.abs(value) / maxIndividualValue, 1)

    if (individualMetricTab === "import") {
      return `rgba(34, 197, 94, ${intensity * 0.6})` // Green for import
    } else if (individualMetricTab === "export") {
      return `rgba(59, 130, 246, ${intensity * 0.6})` // Blue for export
    } else {
      // Net: green for positive, red for negative
      return value >= 0 ? `rgba(34, 197, 94, ${intensity * 0.6})` : `rgba(239, 68, 68, ${intensity * 0.6})`
    }
  }

  const meterStatusTableData = useMemo(() => {
    if (!meterStatusDetails?.data) return []

    return meterStatusDetails.data.map((meter) => ({
      meter_number: meter.meter_number,
      meter_type: meter.meter_type || "—",
      region: meter.region || "—",
      district: meter.district || "—",
      station: meter.station || "—",
      feeder_panel_name: meter.feeder_panel_name || "—",
      location: meter.location || "—",
      boundary_point: meter.boundary_point || "—",
      voltage_kv: (meter as any).voltage_kv || "—", // Accessing potentially non-standard field
      status: meter.status,
      total_consumption: meter.total_consumption_kwh || 0,
      last_reading_date: meter.last_reading_time,
      last_reading_time: meter.last_reading_time,
      uptimePercentage: meter.uptime_percentage || 0,
      daysOffline: meter.days_offline || 0,
    }))
  }, [meterStatusDetails])

  const meterHealthMetrics = useMemo(() => {
    console.log("[v0] meterHealthMetrics - meterStatusSummary:", meterStatusSummary)

    if (!meterStatusSummary) {
      return {
        totalMeters: 0,
        onlineMeters: 0,
        offlineMeters: 0,
        offlineNoData: 0,
        offlineNoRecord: 0,
        onlinePercentage: 0,
        offlinePercentage: 0,
        avgUptime: 0,
      }
    }

    const total = meterStatusSummary.total || 0
    const online = meterStatusSummary.online || 0
    const offline = meterStatusSummary.total_offline || 0

    return {
      totalMeters: Math.round(total),
      onlineMeters: Math.round(online),
      offlineMeters: Math.round(offline),
      offlineNoData: Math.round(meterStatusSummary.offline_no_data || 0),
      offlineNoRecord: Math.round(meterStatusSummary.offline_no_record || 0),
      onlinePercentage: meterStatusSummary.online_percentage || 0,
      offlinePercentage: meterStatusSummary.offline_percentage || 0,
      avgUptime: meterStatusSummary.avg_uptime_percentage || 0,
    }
  }, [meterStatusSummary])

  // const meterUptime = useMemo(() => {
  //   if (!meterStatusData || processedStatusData.length === 0 || daysInRange === 0) return 0

  //   const totalUptime = processedStatusData.reduce((sum, meter) => {
  //     const onlineDays = new Set<string>()
  //     const allDays = new Set<string>()

  //     meterStatusData
  //       .filter((r) => r.meter_number === meter.meter_number)
  //       .forEach((record) => {
  //         if (!record.consumption_date) return
  //         const date = record.consumption_date.split("T")[0]
  //         allDays.add(date)
  //         if (record.status === "ONLINE") {
  //           onlineDays.add(date)
  //         }
  //       })

  //     const meterUptime = allDays.size > 0 ? (onlineDays.size / allDays.size) * 100 : 0
  //     return sum + meterUptime
  //   }, 0)

  //   return processedStatusData.length > 0 ? totalUptime / processedStatusData.length : 0
  // }, [meterStatusData, processedStatusData, daysInRange])

  // const meterStatusTableData = useMemo(() => {
  //   if (!meterStatusData || processedStatusData.length === 0) return []

  //   return processedStatusData.map((meter) => {
  //     const onlineDays = new Set<string>()
  //     const allDays = new Set<string>()

  //     meterStatusData
  //       .filter((r) => r.meter_number === meter.meter_number)
  //       .forEach((record) => {
  //         if (!record.last_consumption_date) return

  //         const date = new Date(record.last_consumption_date).toISOString().split("T")[0]
  //         allDays.add(date)
  //         if (record.status === "ONLINE") {
  //           onlineDays.add(date)
  //         }
  //       })

  //     const uptimePercentage = allDays.size > 0 ? (onlineDays.size / allDays.size) * 100 : 0

  //     return {
  //       ...meter,
  //       uptimePercentage,
  //     }
  //   })
  // }, [meterStatusData, processedStatusData])

  // const filteredMeterStatus = useMemo(() => {
  //   let filtered = processedStatusData

  //   // Apply status filter
  //   if (statusFilter !== "all") {
  //     filtered = filtered.filter((meter) => {
  //       if (statusFilter === "online") return meter.status.includes("ONLINE")
  //       if (statusFilter === "offline") return meter.status.startsWith("OFFLINE") // Use startsWith for OFFLINE
  //       return true
  //     })
  //   }

  //   // Apply search filter
  //   if (statusSearchQuery.trim()) {
  //     const query = statusSearchQuery.toLowerCase()
  //     filtered = filtered.filter(
  //       (meter) => meter.meter_number.toLowerCase().includes(query) || meter.meter_type?.toLowerCase().includes(query),
  //     )
  //   }

  //   // Apply sorting
  //   filtered.sort((a, b) => {
  //     let aValue: any, bValue: any

  //     switch (statusSortColumn) {
  //       case "meter_number":
  //         aValue = a.meter_number
  //         bValue = b.meter_number
  //         break
  //       case "meter_type": // Added sorting for meter_type
  //         aValue = a.meter_type
  //         bValue = b.meter_type
  //         break
  //       case "status":
  //         aValue = a.status
  //         bValue = b.status
  //         break
  //       case "consumption":
  //         aValue = a.total_consumption
  //         bValue = b.total_consumption
  //         break
  //       case "reading_count":
  //         aValue = a.total_reading_count
  //         bValue = b.total_reading_count
  //         break
  //       case "last_reading":
  //         aValue = new Date(a.last_reading_time)
  //         bValue = new Date(b.last_reading_time)
  //         break
  //       case "uptime":
  //         const aMeterData = meterStatusTableData.find((m) => m.meter_number === a.meter_number)
  //         const bMeterData = meterStatusTableData.find((m) => m.meter_number === b.meter_number)
  //         aValue = aMeterData?.uptimePercentage ?? 0
  //         bValue = bMeterData?.uptimePercentage ?? 0
  //         break
  //       default:
  //         return 0
  //     }

  //     if (typeof aValue === "string" && typeof bValue === "string") {
  //       return statusSortDirection === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
  //     } else if (aValue instanceof Date && bValue instanceof Date) {
  //       return statusSortDirection === "asc" ? aValue.getTime() - bValue.getTime() : bValue.getTime() - aValue.getTime()
  //     }

  //     return statusSortDirection === "asc" ? Number(aValue) - Number(bValue) : Number(bValue) - Number(aValue)
  //   })

  //   // Paginate
  //   const totalPages = Math.ceil(filtered.length / metersPerPage)
  //   const startIndex = (statusPage - 1) * metersPerPage
  //   const endIndex = startIndex + metersPerPage
  //   const paginated = filtered.slice(startIndex, endIndex)

  //   return {
  //     meters: paginated,
  //     totalMeters: filtered.length,
  //     totalPages,
  //     currentPage: statusPage,
  //   }
  // }, [
  //   processedStatusData,
  //   statusFilter,
  //   statusSearchQuery,
  //   statusSortColumn,
  //   statusSortDirection,
  //   statusPage,
  //   meterStatusTableData,
  // ])

  const handleStatusSort = (column: typeof statusSortColumn) => {
    if (statusSortColumn === column) {
      setStatusSortDirection(statusSortDirection === "asc" ? "desc" : "asc")
    } else {
      setStatusSortColumn(column)
      setStatusSortDirection("asc")
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {infoCards.map((card, index) => {
          const Icon = card.icon
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {aggregateLoading && card.title !== "Meters" ? (
                  <Skeleton className="h-8 w-24" />
                ) : isLoadingSummary && card.title === "Meters" ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <>
                    <div className="text-2xl font-bold text-foreground">{card.value}</div>
                    {card.unit && <p className="text-xs text-muted-foreground mt-1">{card.unit}</p>}

                    {card.breakdown && Object.keys(card.breakdown).length > 0 && (
                      <div className="mt-3 pt-3 border-t space-y-1.5">
                        {Object.entries(card.breakdown)
                          .sort((a, b) => {
                            if (card.metric === "meters") {
                              // For meters, sort by total count descending
                              return (b[1] as any).total - (a[1] as any).total
                            } else {
                              // For import/export, sort by import value
                              return (b[1] as any).import - (a[1] as any).import
                            }
                          })
                          .map(([meterType, values]) => {
                            if (card.metric === "import") {
                              const importVal = (values as any).import || 0
                              return (
                                <div key={meterType} className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">{meterType}</span>
                                  <span className="font-medium">{formatNumber(importVal)} kWh</span>
                                </div>
                              )
                            } else if (card.metric === "export") {
                              const exportVal = (values as any).export || 0
                              return (
                                <div key={meterType} className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">{meterType}</span>
                                  <span className="font-medium">{formatNumber(exportVal)} kWh</span>
                                </div>
                              )
                            } else if (card.metric === "net") {
                              const importVal = (values as any).import || 0
                              const exportVal = (values as any).export || 0
                              const netVal = importVal - exportVal
                              return (
                                <div key={meterType} className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">{meterType}</span>
                                  <span className="font-medium">{formatNumber(netVal)} kWh</span>
                                </div>
                              )
                            } else if (card.metric === "meters") {
                              const online = (values as any).online || 0
                              const total = (values as any).total || 0
                              return (
                                <div key={meterType} className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">{meterType}</span>
                                  <span className="font-medium">
                                    {online} / {total}
                                  </span>
                                </div>
                              )
                            }
                            return null
                          })}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>
                  {trendView === "aggregate" ? "Consumption Trend" : "Individual Meter Consumption Breakdown"}
                </CardTitle>
                <CardDescription>
                  {trendView === "aggregate"
                    ? "Daily consumption over selected period"
                    : `All ${filteredAndPaginatedMeters.totalMeters} meters with daily breakdown`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                {trendView === "aggregate" ? (
                  <Button variant="outline" size="sm" onClick={() => setTrendView("individual")}>
                    <ListFilter className="h-4 w-4 mr-2" />
                    View Individual Meters
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setTrendView("aggregate")}>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Back to Aggregate
                  </Button>
                )}

                {trendView === "aggregate" ? (
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="import_kwh"
                        checked={selectedMetrics.import_kwh}
                        onCheckedChange={() => toggleMetric("import_kwh")}
                      />
                      <Label htmlFor="import_kwh" className="cursor-pointer">
                        Import kWh
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="export_kwh"
                        checked={selectedMetrics.export_kwh}
                        onCheckedChange={() => toggleMetric("export_kwh")}
                      />
                      <Label htmlFor="export_kwh" className="cursor-pointer">
                        Export kWh
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="net_kwh"
                        checked={selectedMetrics.net_kwh}
                        onCheckedChange={() => toggleMetric("net_kwh")}
                      />
                      <Label htmlFor="net_kwh" className="cursor-pointer">
                        Net kWh
                      </Label>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                      <Button
                        variant={individualMetricTab === "import" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setIndividualMetricTab("import")}
                        className="h-8"
                      >
                        Import
                      </Button>
                      <Button
                        variant={individualMetricTab === "export" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setIndividualMetricTab("export")}
                        className="h-8"
                      >
                        Export
                      </Button>
                      <Button
                        variant={individualMetricTab === "net" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setIndividualMetricTab("net")}
                        className="h-8"
                      >
                        Net
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {trendView === "aggregate" ? (
              // Aggregate view (existing chart)
              aggregateLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : chartData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center border border-dashed rounded-lg">
                  <div className="text-center">
                    <p className="text-muted-foreground mb-2">No consumption data available</p>
                    <p className="text-sm text-muted-foreground">Try adjusting your filters or date range.</p>
                  </div>
                </div>
              ) : (
                <ChartContainer
                  config={{
                    import_kwh: {
                      label: "Import (kWh)",
                      color: "hsl(142, 76%, 36%)",
                    },
                    export_kwh: {
                      label: "Export (kWh)",
                      color: "hsl(221, 83%, 53%)",
                    },
                    net_kwh: {
                      label: "Net (kWh)",
                      color: "hsl(0, 59%, 41%)",
                    },
                  }}
                  className="h-[300px] w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorImportKwh" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorExportKwh" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorNetKwh" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(0, 59%, 41%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(0, 59%, 41%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tickFormatter={formatDate} className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      {selectedMetrics.import_kwh && (
                        <Area
                          type="monotone"
                          dataKey="import_kwh"
                          stroke="hsl(142, 76%, 36%)"
                          fill="url(#colorImportKwh)"
                          strokeWidth={2}
                          name="Import kWh"
                        />
                      )}
                      {selectedMetrics.export_kwh && (
                        <Area
                          type="monotone"
                          dataKey="export_kwh"
                          stroke="hsl(221, 83%, 53%)"
                          fill="url(#colorExportKwh)"
                          strokeWidth={2}
                          name="Export kWh"
                        />
                      )}
                      {selectedMetrics.net_kwh && (
                        <Area
                          type="monotone"
                          dataKey="net_kwh"
                          stroke="hsl(0, 59%, 41%)"
                          fill="url(#colorNetKwh)"
                          strokeWidth={2}
                          name="Net kWh"
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              )
            ) : rankingsLoading ? (
              <Skeleton className="h-[400px] w-full" />
            ) : individualMeterTableData.meterRows.length === 0 ? (
              <div className="h-[400px] flex items-center justify-center border border-dashed rounded-lg">
                <div className="text-center">
                  <p className="text-muted-foreground mb-2">No meter data available</p>
                  <p className="text-sm text-muted-foreground">
                    {!meterRankings?.rankings || meterRankings.rankings.length === 0
                      ? "No meter rankings found for the selected filters and date range."
                      : !meterRankings?.rawData || meterRankings.rawData.length === 0
                        ? "No daily consumption data found for meters."
                        : "Try adjusting your filters or date range."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Search and pagination controls */}
                <div className="flex items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search meters..."
                      value={meterSearchQuery}
                      onChange={(e) => {
                        setMeterSearchQuery(e.target.value)
                        setCurrentPage(1) // Reset to first page on search
                      }}
                      className="pl-9"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      Showing {filteredAndPaginatedMeters.meters.length} of {filteredAndPaginatedMeters.totalMeters}{" "}
                      meters
                    </span>
                  </div>
                </div>

                {/* Table */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead className="sticky left-0 bg-background z-20 min-w-[120px]">Meter Number</TableHead>
                          <TableHead className="min-w-[100px]">Type</TableHead>
                          <TableHead className="min-w-[120px]">Region</TableHead>
                          <TableHead className="min-w-[120px]">Station</TableHead>
                          {individualMeterTableData.allDates.map((date) => (
                            <TableHead key={date} className="text-right text-xs min-w-[80px]">
                              {formatDateLocal(date)}
                            </TableHead>
                          ))}
                          <TableHead className="text-right font-semibold min-w-[100px] sticky right-0 bg-background z-20">
                            Total
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAndPaginatedMeters.meters.map((meter) => (
                          <TableRow key={meter.meterNumber} className="hover:bg-muted/50">
                            <TableCell className="sticky left-0 bg-background z-10 font-mono text-xs">
                              <div className="flex items-center gap-2">
                                <span>{meter.meterNumber}</span>
                                <a
                                  href={`/meters/${meter.meterNumber}`}
                                  className="text-primary hover:text-primary/80 transition-colors"
                                  title="View meter details"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">{meter.meterType || "—"}</TableCell>
                            <TableCell className="text-xs">{meter.region || "—"}</TableCell>
                            <TableCell className="text-xs">{meter.station || "—"}</TableCell>
                            {meter.dailyValues.map((day) => {
                              const value = day[individualMetricTab]
                              return (
                                <TableCell
                                  key={day.date}
                                  className="text-right text-xs tabular-nums"
                                  style={{
                                    backgroundColor: getIndividualCellColor(value),
                                  }}
                                >
                                  {value === 0 ? "—" : formatNumber(value, 0)}
                                </TableCell>
                              )
                            })}
                            <TableCell className="text-right font-semibold sticky right-0 bg-background z-10">
                              {formatNumber(
                                individualMetricTab === "import"
                                  ? meter.totalImport
                                  : individualMetricTab === "export"
                                    ? meter.totalExport
                                    : meter.totalNet,
                                0,
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Totals row */}
                        <TableRow className="bg-muted/50 font-semibold border-t-2">
                          <TableCell className="sticky left-0 bg-muted/50 z-10" colSpan={4}>
                            Total
                          </TableCell>
                          {individualMeterTableData.allDates.map((date) => {
                            const value = individualMeterTableData.totals[date]?.[individualMetricTab] || 0
                            return (
                              <TableCell key={date} className="text-right tabular-nums">
                                {formatNumber(value, 0)}
                              </TableCell>
                            )
                          })}
                          <TableCell className="text-right sticky right-0 bg-muted/50 z-10">
                            {formatNumber(
                              individualMeterTableData.allDates.reduce(
                                (sum, date) =>
                                  sum + (individualMeterTableData.totals[date]?.[individualMetricTab] || 0),
                                0,
                              ),
                              0,
                            )}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Pagination */}
                {filteredAndPaginatedMeters.totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">
                        Page {currentPage} of {filteredAndPaginatedMeters.totalPages}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(filteredAndPaginatedMeters.totalPages, p + 1))}
                      disabled={currentPage === filteredAndPaginatedMeters.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>By Meter Category</CardTitle>
                <CardDescription>Consumption breakdown by category</CardDescription>
              </div>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="category_import_kwh"
                    checked={categoryMetrics.import_kwh}
                    onCheckedChange={() => toggleCategoryMetric("import_kwh")}
                  />
                  <Label htmlFor="category_import_kwh" className="cursor-pointer">
                    Import kWh
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="category_export_kwh"
                    checked={categoryMetrics.export_kwh}
                    onCheckedChange={() => toggleCategoryMetric("export_kwh")}
                  />
                  <Label htmlFor="category_export_kwh" className="cursor-pointer">
                    Export kWh
                  </Label>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {categoryLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : categoryChartData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center border border-dashed rounded-lg">
                <div className="text-center">
                  <p className="text-muted-foreground mb-2">No category data available</p>
                  <p className="text-sm text-muted-foreground">Try adjusting your filters or date range.</p>
                </div>
              </div>
            ) : (
              <ChartContainer
                config={{
                  import_kwh: {
                    label: "Import (kWh)",
                    color: "hsl(142, 76%, 36%)",
                  },
                  export_kwh: {
                    label: "Export (kWh)",
                    color: "hsl(221, 83%, 53%)",
                  },
                }}
                className="h-[300px] w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      type="number"
                      className="text-xs"
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      type="category"
                      dataKey="meter_type"
                      className="text-xs"
                      width={150}
                      tick={{ fill: "hsl(var(--foreground))", cursor: "pointer" }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    {categoryMetrics.import_kwh && (
                      <Bar dataKey="import_kwh" fill="hsl(142, 76%, 36%)" radius={[0, 4, 4, 0]} name="Import kWh" />
                    )}
                    {categoryMetrics.export_kwh && (
                      <Bar dataKey="export_kwh" fill="hsl(221, 83%, 53%)" radius={[0, 4, 4, 0]} name="Export kWh" />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>By Region</CardTitle>
                <CardDescription>Regional consumption by meter type</CardDescription>
              </div>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="region_import_kwh"
                    checked={regionMetrics.import_kwh}
                    onCheckedChange={() => toggleRegionMetric("import_kwh")}
                  />
                  <Label htmlFor="region_import_kwh" className="cursor-pointer">
                    Import kWh
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="region_export_kwh"
                    checked={regionMetrics.export_kwh}
                    onCheckedChange={() => toggleRegionMetric("export_kwh")}
                  />
                  <Label htmlFor="region_export_kwh" className="cursor-pointer">
                    Export kWh
                  </Label>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {regionDataLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : regionChartData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center border border-dashed rounded-lg">
                <div className="text-center">
                  <p className="text-muted-foreground mb-2">No regional data available</p>
                  <p className="text-sm text-muted-foreground">Try adjusting your filters or date range.</p>
                </div>
              </div>
            ) : (
              <ChartContainer
                config={
                  uniqueMeterTypes?.reduce?.(
                    (acc, type) => {
                      acc[`${type}_import`] = {
                        label: `${type} Import`,
                        color: meterTypeColors[type] || "hsl(var(--chart-1))",
                      }
                      acc[`${type}_export`] = {
                        label: `${type} Export`,
                        color: meterTypeColors[type] || "hsl(var(--chart-1))",
                      }
                      return acc
                    },
                    {} as Record<string, any>,
                  ) ?? {}
                }
                className="h-[300px] w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={regionChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="region"
                      className="text-xs"
                      tick={{ fill: "hsl(var(--foreground))", fontSize: 11, cursor: "pointer" }}
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      interval={0}
                      onClick={(data) => {
                        if (data?.value) {
                          router.push(`/meters/region/${encodeURIComponent(data.value)}`)
                        }
                      }}
                    />
                    <YAxis className="text-xs" tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    {regionMetrics.import_kwh &&
                      uniqueMeterTypes?.map?.((type) => (
                        <Bar
                          key={`${type}_import`}
                          dataKey={`${type}_import`}
                          stackId="import"
                          fill={meterTypeColors[type] || "hsl(var(--chart-1))"}
                          name={`${type} Import`}
                          onClick={(data) => {
                            if (data?.region) {
                              router.push(`/meters/region/${encodeURIComponent(data.region)}`)
                            }
                          }}
                          className="cursor-pointer"
                        />
                      ))}
                    {regionMetrics.export_kwh &&
                      uniqueMeterTypes?.map?.((type) => (
                        <Bar
                          key={`${type}_export`}
                          dataKey={`${type}_export`}
                          stackId="export"
                          fill={meterTypeColors[type] || "hsl(var(--chart-1))"}
                          name={`${type} Export`}
                          onClick={(data) => {
                            if (data?.region) {
                              router.push(`/meters/region/${encodeURIComponent(data.region)}`)
                            }
                          }}
                          className="cursor-pointer"
                        />
                      ))}
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Full Meters Ranking</CardTitle>
                <CardDescription>Complete import and export rankings for all meters</CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="show_net_kwh"
                      checked={rankingColumns.showNetKwh}
                      onCheckedChange={() => toggleRankingColumn("showNetKwh")}
                    />
                    <Label htmlFor="show_net_kwh" className="cursor-pointer">
                      Net kWh
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="show_avg_daily"
                      checked={rankingColumns.showAvgDaily}
                      onCheckedChange={() => toggleRankingColumn("showAvgDaily")}
                    />
                    <Label htmlFor="show_avg_daily" className="cursor-pointer">
                      Avg Daily
                    </Label>
                  </div>
                </div>
                <Select value={groupBy} onValueChange={(value: any) => setGroupBy(value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Group by..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Grouping</SelectItem>
                    <SelectItem value="meter_type">Group by Type</SelectItem>
                    <SelectItem value="region">Group by Region</SelectItem>
                    <SelectItem value="district">Group by District</SelectItem>
                    <SelectItem value="station">Group by Station</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {rankingsLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : !meterRankings?.rankings || meterRankings.rankings.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center border border-dashed rounded-lg">
                <div className="text-center">
                  <p className="text-muted-foreground mb-2">No ranking data available</p>
                  <p className="text-sm text-muted-foreground">Try adjusting your filters or date range.</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background border-b z-10">
                    <TableRow>
                      <th className="text-left py-2 px-4 font-medium text-muted-foreground bg-muted/50">
                        Meter Number
                      </th>
                      <th className="text-left py-2 px-4 font-medium text-muted-foreground bg-muted/50">Type</th>
                      <th className="text-left py-2 px-4 font-medium text-muted-foreground bg-muted/50">Region</th>
                      <th
                        className="text-right py-2 px-4 font-medium text-muted-foreground cursor-pointer hover:text-foreground bg-muted/50"
                        onClick={() => handleSort("import_kwh")}
                      >
                        Import (kWh) {sortColumn === "import_kwh" && (sortDirection === "asc" ? "↑" : "↓")}
                      </th>
                      <th
                        className="text-center py-2 px-4 font-medium text-muted-foreground cursor-pointer hover:text-foreground bg-muted/50"
                        onClick={() => handleSort("import_rank")}
                      >
                        Import Rank {sortColumn === "import_rank" && (sortDirection === "asc" ? "↑" : "↓")}
                      </th>
                      <th
                        className="text-right py-2 px-4 font-medium text-muted-foreground cursor-pointer hover:text-foreground bg-muted/50"
                        onClick={() => handleSort("export_kwh")}
                      >
                        Export (kWh) {sortColumn === "export_kwh" && (sortDirection === "asc" ? "↑" : "↓")}
                      </th>
                      <th
                        className="text-center py-2 px-4 font-medium text-muted-foreground cursor-pointer hover:text-foreground bg-muted/50"
                        onClick={() => handleSort("export_rank")}
                      >
                        Export Rank {sortColumn === "export_rank" && (sortDirection === "asc" ? "↑" : "↓")}
                      </th>
                      {rankingColumns.showNetKwh && (
                        <th className="text-right py-2 px-4 font-medium text-muted-foreground bg-muted/50">
                          Net (kWh)
                        </th>
                      )}
                      {rankingColumns.showAvgDaily && (
                        <th className="text-right py-2 px-4 font-medium text-muted-foreground bg-muted/50">
                          Avg Daily
                        </th>
                      )}
                    </TableRow>
                  </thead>
                  <tbody>
                    {groupBy === "none"
                      ? sortedMeters.map((meter) => (
                          <tr key={meter.meter_number} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-4 font-mono text-xs">
                              <div className="flex items-center gap-2">
                                <span>{meter.meter_number}</span>
                                {/* TODO: Update to use meter.id once the daily consumption API includes it */}
                                <a
                                  href={`/meters/${meter.meter_number}`}
                                  className="text-primary hover:text-primary/80 transition-colors"
                                  title="View meter details"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </div>
                            </td>
                            <td className="py-2 px-4">{meter.meter_type}</td>
                            <td className="py-2 px-4">{meter.region}</td>
                            <td className="py-2 px-4 text-right font-semibold">
                              {meter.total_import_kwh ? formatNumber(meter.total_import_kwh) : "—"}
                            </td>
                            <td className="py-2 px-4 text-center">
                              {meter.import_rank ? (
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-chart-1/10 text-chart-1 font-semibold">
                                  {meter.import_rank}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="py-2 px-4 text-right font-semibold">
                              {meter.total_export_kwh ? formatNumber(meter.total_export_kwh) : "—"}
                            </td>
                            <td className="py-2 px-4 text-center">
                              {meter.export_rank ? (
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-chart-2/10 text-chart-2 font-semibold">
                                  {meter.export_rank}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            {rankingColumns.showNetKwh && (
                              <td className="py-2 px-4 text-right">{formatNumber(meter.net_kwh)}</td>
                            )}
                            {rankingColumns.showAvgDaily && (
                              <td className="py-2 px-4 text-right text-muted-foreground">
                                {formatNumber(meter.avg_daily_import)}
                              </td>
                            )}
                          </tr>
                        ))
                      : Array.from(groupedMeters.entries()).map(([groupKey, meters]) => {
                          const isExpanded = expandedGroups.has(groupKey)
                          const totals = calculateGroupTotals(meters)

                          return (
                            <React.Fragment key={groupKey}>
                              <tr
                                className="bg-muted/30 border-b cursor-pointer hover:bg-muted/50"
                                onClick={() => toggleGroup(groupKey)}
                              >
                                <td colSpan={3} className="py-3 px-4 font-semibold">
                                  <div className="flex items-center gap-2">
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                    {groupKey} ({totals.count} meters)
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-right font-semibold text-primary">
                                  {formatNumber(totals.totalImport)}
                                </td>
                                <td className="py-3 px-4 text-center text-muted-foreground">—</td>
                                <td className="py-3 px-4 text-right font-semibold text-primary">
                                  {formatNumber(totals.totalExport)}
                                </td>
                                <td className="py-3 px-4 text-center text-muted-foreground">—</td>
                                {rankingColumns.showNetKwh && (
                                  <td className="py-3 px-4 text-right font-semibold">
                                    {formatNumber(totals.totalImport - totals.totalExport)}
                                  </td>
                                )}
                                {rankingColumns.showAvgDaily && (
                                  <td className="py-3 px-4 text-right text-muted-foreground">—</td>
                                )}
                              </tr>
                              {isExpanded &&
                                meters.map((meter) => (
                                  <tr key={meter.meter_number} className="border-b hover:bg-muted/50">
                                    <td className="py-2 px-4 pl-8 font-mono text-xs">
                                      <div className="flex items-center gap-2">
                                        <span>{meter.meter_number}</span>
                                        {/* TODO: Update to use meter.id once the daily consumption API includes it */}
                                        <a
                                          href={`/meters/${meter.meter_number}`}
                                          className="text-primary hover:text-primary/80 transition-colors"
                                          title="View meter details"
                                        >
                                          <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                      </div>
                                    </td>
                                    <td className="py-2 px-4">{meter.meter_type}</td>
                                    <td className="py-2 px-4">{meter.region}</td>
                                    <td className="py-2 px-4 text-right font-semibold">
                                      {meter.total_import_kwh ? formatNumber(meter.total_import_kwh) : "—"}
                                    </td>
                                    <td className="py-2 px-4 text-center">
                                      {meter.import_rank ? (
                                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-chart-1/10 text-chart-1 font-semibold">
                                          {meter.import_rank}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      )}
                                    </td>
                                    <td className="py-2 px-4 text-right font-semibold">
                                      {meter.total_export_kwh ? formatNumber(meter.total_export_kwh) : "—"}
                                    </td>
                                    <td className="py-2 px-4 text-center">
                                      {meter.export_rank ? (
                                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-chart-2/10 text-chart-2 font-semibold">
                                          {meter.export_rank}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      )}
                                    </td>
                                    {rankingColumns.showNetKwh && (
                                      <td className="py-2 px-4 text-right">{formatNumber(meter.net_kwh)}</td>
                                    )}
                                    {rankingColumns.showAvgDaily && (
                                      <td className="py-2 px-4 text-right text-muted-foreground">
                                        {formatNumber(meter.avg_daily_import)}
                                      </td>
                                    )}
                                  </tr>
                                ))}
                            </React.Fragment>
                          )
                        })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Removed the MeterDrillDownModal as the button now navigates to a drill-down page */}

      {/* Meter Health & Status Section */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Meter Health & Status</h2>
          <p className="text-muted-foreground">Real-time monitoring of meter reporting and data quality</p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Meters</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{meterHealthMetrics.totalMeters}</div>
                  <p className="text-xs text-muted-foreground">All meters in system</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Online Meters</CardTitle>
              <Activity className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-green-600">{meterHealthMetrics.onlineMeters}</div>
                  <p className="text-xs text-muted-foreground">
                    {meterHealthMetrics.onlinePercentage.toFixed(1)}% of total
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Offline Meters</CardTitle>
              <Activity className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-red-600">{meterHealthMetrics.offlineMeters}</div>
                  <p className="text-xs text-muted-foreground">
                    {meterHealthMetrics.offlinePercentage.toFixed(1)}% • No Data: {meterHealthMetrics.offlineNoData} •
                    No Record: {meterHealthMetrics.offlineNoRecord}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Meter Uptime</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div
                    className={`text-2xl font-bold ${
                      meterHealthMetrics.avgUptime >= 90
                        ? "text-green-600"
                        : meterHealthMetrics.avgUptime >= 70
                          ? "text-yellow-600"
                          : "text-red-600"
                    }`}
                  >
                    {meterHealthMetrics.avgUptime.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">Average meter availability</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Status Timeline Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Meter Status Timeline</CardTitle>
            <p className="text-sm text-muted-foreground">
              Daily online vs offline meter count over the selected period
            </p>
          </CardHeader>
          <CardContent>
            {isLoadingTimeline ? (
              <Skeleton className="h-[300px] w-full" />
            ) : statusTimelineData && statusTimelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={statusTimelineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <ChartTooltip />
                  <Legend />
                  <Area type="monotone" dataKey="online" stackId="1" stroke="#22c55e" fill="#22c55e" name="Online" />
                  <Area type="monotone" dataKey="offline" stackId="1" stroke="#ef4444" fill="#ef4444" name="Offline" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                No timeline data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Meter Status Details Table */}
        <Card>
          <CardHeader>
            <CardTitle>Meter Status Details</CardTitle>
            <p className="text-sm text-muted-foreground">Individual meter health and reporting status</p>
          </CardHeader>
          <CardContent>
            {/* Filter Buttons and Search */}
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2">
                <Button
                  variant={statusFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setStatusFilter("all")
                    setStatusPage(1)
                  }}
                >
                  All ({meterHealthMetrics.totalMeters})
                </Button>
                <Button
                  variant={statusFilter === "online" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setStatusFilter("online")
                    setStatusPage(1)
                  }}
                  className={statusFilter === "online" ? "bg-green-600 hover:bg-green-700" : ""}
                >
                  Online ({meterHealthMetrics.onlineMeters})
                </Button>
                <Button
                  variant={statusFilter === "offline" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setStatusFilter("offline")
                    setStatusPage(1)
                  }}
                  className={statusFilter === "offline" ? "bg-red-600 hover:bg-red-700" : ""}
                >
                  Offline ({meterHealthMetrics.offlineMeters})
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search meter number..."
                  value={statusSearchQuery}
                  onChange={(e) => {
                    setStatusSearchQuery(e.target.value)
                    setStatusPage(1)
                  }}
                  className="pl-8 w-full sm:w-[250px]"
                />
              </div>
            </div>

            {/* Table */}
            {isLoadingDetails ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : meterStatusTableData.length > 0 ? (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Meter Number</TableHead>
                        <TableHead>Meter Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total Consumption (kWh)</TableHead>
                        <TableHead className="text-right">Uptime %</TableHead>
                        <TableHead>Last Reading</TableHead>
                        <TableHead className="text-right">Days Offline</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {meterStatusTableData.map((meter) => (
                        <TableRow key={meter.meter_number}>
                          <TableCell className="font-medium">{meter.meter_number}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span>{meter.meter_type}</span>
                              {meter.meter_type === "BSP" && (
                                <span className="text-xs text-muted-foreground">
                                  {meter.region} • {meter.station} • {meter.feeder_panel_name} • {meter.voltage_kv} kV
                                </span>
                              )}
                              {(meter.meter_type === "DISTRICT_BOUNDARY" ||
                                meter.meter_type === "REGIONAL_BOUNDARY") && (
                                <span className="text-xs text-muted-foreground">
                                  {meter.boundary_point} • {meter.location} • {meter.voltage_kv} kV
                                </span>
                              )}
                              {meter.meter_type === "DTX" && (
                                <span className="text-xs text-muted-foreground">
                                  {meter.region} • {meter.district} • {meter.voltage_kv} kV
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={meter.status === "ONLINE" ? "default" : "destructive"}
                              className={meter.status === "ONLINE" ? "bg-green-600" : ""}
                            >
                              {meter.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatNumber(meter.total_consumption)}</TableCell>
                          <TableCell className="text-right">
                            <span
                              className={`font-medium ${
                                meter.uptimePercentage >= 90
                                  ? "text-green-600"
                                  : meter.uptimePercentage >= 70
                                    ? "text-yellow-600"
                                    : "text-red-600"
                              }`}
                            >
                              {meter.uptimePercentage.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell>
                            {meter.last_reading_date ? (
                              <div className="text-sm">
                                <div>{formatDateLocal(meter.last_reading_date)}</div>
                                <div className="text-muted-foreground">{formatTime(meter.last_reading_time)}</div>
                              </div>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {meter.daysOffline > 0 ? (
                              <span className="text-red-600 font-medium">{meter.daysOffline} days</span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <TablePagination
                  currentPage={meterStatusDetails?.pagination.page || 1}
                  totalPages={meterStatusDetails?.pagination.total_pages || 1}
                  totalItems={meterStatusDetails?.pagination.total || 0}
                  pageSize={statusPageSize}
                  onPageChange={setStatusPage}
                />
              </>
            ) : (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                No meters found matching the selected filters
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
