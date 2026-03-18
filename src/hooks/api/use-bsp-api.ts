import { useQuery } from "@tanstack/react-query"
import { formatApiDate } from "@/lib/utils"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

interface BspAggregateParams {
  dateFrom?: string
  dateTo?: string
  region?: string[]
  district?: string[]
  station?: string[]
  boundaryMeteringPoint?: string[]
  meterType?: string[]
  voltage_kv?: number[]
}

interface BspDataPoint {
  system_name: "import_kwh" | "export_kwh"
  region: string
  station: string
  feeder_panel_name: string
  ic_og: "IC" | "OG" // Incomer or Outgoing categorization
  active_meters: number
  total_meter_count: number
  all_meters_count: number // Total meters in system for this meter_type
  meter_type: string
  group_period: string
  total_consumption: number
}

interface BspDailyRecord {
  meter_number: string
  consumption_date: string
  consumed_energy: number
  system_name: "import_kwh" | "export_kwh"
  region: string
  multiply_factor?: number
  station?: string
  feeder_panel_name?: string
  voltage_kv?: string
  meter_type: string
}

interface ProcessedBspData {
  totalSupplyKwh: number
  totalReverseFlowKwh: number
  netSupplyKwh: number
  totalActiveMeters: number
  totalMeterCount: number
  uniqueStations: number
  uniqueFeederPanels: number
  byRegion: {
    region: string
    supplyKwh: number
    reverseFlowKwh: number
    netSupplyKwh: number
    percentOfTotal: number
    activeMeters: number
    totalMeters: number
    stations: {
      station: string
      supplyKwh: number
      reverseFlowKwh: number
      netSupplyKwh: number
      activeMeters: number
      totalMeters: number
    }[]
  }[]
  byVoltage: {
    voltage: string
    supplyKwh: number
    reverseFlowKwh: number
    percentOfTotal: number
  }[]
  timeSeriesData: {
    date: string
    [key: string]: number | string
  }[]
  heatmapData: {
    region: string
    dailySupply: { date: string; supply: number; reverseFlow: number }[]
  }[]
  rawData: BspDataPoint[]
}

function buildQueryString(params: BspAggregateParams): string {
  const queryParams = new URLSearchParams()

  if (params.dateFrom) queryParams.append("dateFrom", formatApiDate(params.dateFrom))
  if (params.dateTo) queryParams.append("dateTo", formatApiDate(params.dateTo))

  if (params.region && params.region.length > 0) queryParams.append("region", params.region.join(","))
  if (params.district && params.district.length > 0) queryParams.append("district", params.district.join(","))
  if (params.station && params.station.length > 0) queryParams.append("station", params.station.join(","))
  if (params.boundaryMeteringPoint && params.boundaryMeteringPoint.length > 0)
    queryParams.append("boundaryMeteringPoint", params.boundaryMeteringPoint.join(","))
  if (params.meterType && params.meterType.length > 0) queryParams.append("meterType", params.meterType.join(","))
  if (params.voltage_kv && params.voltage_kv.length > 0)
    queryParams.append("voltage_kv", params.voltage_kv.map((v) => v.toString()).join(","))

  queryParams.append("group", "meter_type,region,station")

  return queryParams.toString()
}

function buildDailyQueryString(params: BspAggregateParams): string {
  const queryParams = new URLSearchParams()

  if (params.dateFrom) queryParams.append("dateFrom", formatApiDate(params.dateFrom))
  if (params.dateTo) queryParams.append("dateTo", formatApiDate(params.dateTo))

  if (params.region && params.region.length > 0) queryParams.append("region", params.region.join(","))
  if (params.district && params.district.length > 0) queryParams.append("district", params.district.join(","))
  if (params.station && params.station.length > 0) queryParams.append("station", params.station.join(","))
  if (params.boundaryMeteringPoint && params.boundaryMeteringPoint.length > 0)
    queryParams.append("boundaryMeteringPoint", params.boundaryMeteringPoint.join(","))
  if (params.meterType && params.meterType.length > 0) queryParams.append("meterType", params.meterType.join(","))
  if (params.voltage_kv && params.voltage_kv.length > 0)
    queryParams.append("voltage_kv", params.voltage_kv.map((v) => v.toString()).join(","))

  return queryParams.toString()
}

function processBspData(data: BspDataPoint[]): ProcessedBspData {
  if (!Array.isArray(data) || data.length === 0) {
    return {
      totalSupplyKwh: 0,
      totalReverseFlowKwh: 0,
      netSupplyKwh: 0,
      totalActiveMeters: 0,
      totalMeterCount: 0,
      uniqueStations: 0,
      uniqueFeederPanels: 0,
      byRegion: [],
      byVoltage: [],
      timeSeriesData: [],
      heatmapData: [],
      rawData: [],
    }
  }

  // Normalize region names (handle inconsistent casing)
  const normalizeRegion = (region: string) => {
    return region.toLowerCase().trim()
  }

  // Calculate totals
  const supplyData = data?.filter((d) => d.system_name === "import_kwh") ?? []
  const reverseFlowData = data?.filter((d) => d.system_name === "export_kwh") ?? []

  const totalSupplyKwh = supplyData?.reduce((sum, d) => sum + (d?.total_consumption ?? 0), 0) ?? 0
  const totalReverseFlowKwh = reverseFlowData?.reduce((sum, d) => sum + (d?.total_consumption ?? 0), 0) ?? 0
  const netSupplyKwh = totalSupplyKwh - totalReverseFlowKwh

  const totalActiveMeters = data?.reduce((sum, d) => sum + (d?.active_meters ?? 0), 0) ?? 0
  const totalMeterCount = data?.reduce((sum, d) => sum + (d?.total_meter_count ?? 0), 0) ?? 0
  const uniqueStations = new Set(data.map((d) => d.station)).size
  const uniqueFeederPanels = new Set(data.map((d) => d.feeder_panel_name)).size

  // Group by region and station
  const regionMap = new Map<
    string,
    {
      supply: number
      reverseFlow: number
      activeMeters: number
      totalMeters: number
      stations: Map<string, { supply: number; reverseFlow: number; activeMeters: number; totalMeters: number }>
    }
  >()

  data?.forEach((d) => {
    const region = normalizeRegion(d.region)
    const station = d.station || "Unknown Station"

    if (!regionMap.has(region)) {
      regionMap.set(region, { supply: 0, reverseFlow: 0, activeMeters: 0, totalMeters: 0, stations: new Map() })
    }
    const regionData = regionMap.get(region)!

    if (!regionData.stations.has(station)) {
      regionData.stations.set(station, { supply: 0, reverseFlow: 0, activeMeters: 0, totalMeters: 0 })
    }
    const stationData = regionData.stations.get(station)!

    if (d.system_name === "import_kwh") {
      regionData.supply += d.total_consumption
      stationData.supply += d.total_consumption
    } else {
      regionData.reverseFlow += d.total_consumption
      stationData.reverseFlow += d.total_consumption
    }

    regionData.activeMeters += d.active_meters
    regionData.totalMeters += d.total_meter_count
    stationData.activeMeters += d.active_meters
    stationData.totalMeters += d.total_meter_count
  })

  const byRegion = Array.from(regionMap.entries()).map(([region, values]) => ({
    region,
    supplyKwh: values.supply,
    reverseFlowKwh: values.reverseFlow,
    netSupplyKwh: values.supply - values.reverseFlow,
    percentOfTotal: totalSupplyKwh > 0 ? (values.supply / totalSupplyKwh) * 100 : 0,
    activeMeters: values.activeMeters,
    totalMeters: values.totalMeters,
    stations: Array.from(values.stations.entries()).map(([station, stationValues]) => ({
      station,
      supplyKwh: stationValues.supply,
      reverseFlowKwh: stationValues.reverseFlow,
      netSupplyKwh: stationValues.supply - stationValues.reverseFlow,
      activeMeters: stationValues.activeMeters,
      totalMeters: stationValues.totalMeters,
    })),
  }))

  // Create time series data for percentage stacked chart (by region)
  const dateMap = new Map<string, Record<string, number>>()

  data?.forEach((d) => {
    const date = d.group_period.split("T")[0]
    const region = normalizeRegion(d.region)

    if (!dateMap.has(date)) {
      dateMap.set(date, {})
    }
    const dateData = dateMap.get(date)!
    const key = `${region}_${d.system_name}`
    dateData[key] = (dateData[key] || 0) + d.total_consumption
  })

  const timeSeriesData = Array.from(dateMap.entries())
    .map(([date, values]) => ({
      date,
      ...values,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Create heatmap data (by region) with both supply and reverse flow
  const heatmapMap = new Map<string, Map<string, { supply: number; reverseFlow: number }>>()

  // Process supply data (import_kwh)
  supplyData?.forEach((d) => {
    const region = normalizeRegion(d.region)
    const date = d.group_period.split("T")[0]

    if (!heatmapMap.has(region)) {
      heatmapMap.set(region, new Map())
    }
    const regionDates = heatmapMap.get(region)!

    if (!regionDates.has(date)) {
      regionDates.set(date, { supply: 0, reverseFlow: 0 })
    }
    const dateData = regionDates.get(date)!
    dateData.supply += d.total_consumption
  })

  // Process reverse flow data (export_kwh)
  reverseFlowData?.forEach((d) => {
    const region = normalizeRegion(d.region)
    const date = d.group_period.split("T")[0]

    if (!heatmapMap.has(region)) {
      heatmapMap.set(region, new Map())
    }
    const regionDates = heatmapMap.get(region)!

    if (!regionDates.has(date)) {
      regionDates.set(date, { supply: 0, reverseFlow: 0 })
    }
    const dateData = regionDates.get(date)!
    dateData.reverseFlow += d.total_consumption
  })

  const heatmapData = Array.from(heatmapMap.entries()).map(([region, dates]) => ({
    region,
    dailySupply: Array.from(dates.entries())
      .map(([date, values]) => ({
        date,
        supply: values.supply,
        reverseFlow: values.reverseFlow,
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  }))

  return {
    totalSupplyKwh,
    totalReverseFlowKwh,
    netSupplyKwh,
    totalActiveMeters,
    totalMeterCount,
    uniqueStations,
    uniqueFeederPanels,
    byRegion,
    byVoltage: [],
    timeSeriesData,
    heatmapData,
    rawData: data,
  }
}

export function useBspAggregate(params: BspAggregateParams) {
  const queryString = buildQueryString(params)

  return useQuery<ProcessedBspData>({
    queryKey: [
      "bsp-aggregate",
      params.dateFrom,
      params.dateTo,
      params.region?.join(","),
      params.district?.join(","),
      params.station?.join(","),
      params.boundaryMeteringPoint?.join(","),
      params.meterType?.join(","),
      params.voltage_kv?.map((v) => v.toString()).join(","),
    ],
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/meters/consumption/aggregate/bsp?${queryString}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error("Failed to fetch BSP data")
      }
      const data = await response.json()
      return processBspData(data)
    },
    enabled: !!params.dateFrom && !!params.dateTo,
  })
}

export function useBspDaily(params: BspAggregateParams) {
  const queryString = buildDailyQueryString(params)

  return useQuery<BspDailyRecord[]>({
    queryKey: [
      "bsp-daily",
      params.dateFrom,
      params.dateTo,
      params.region?.join(","),
      params.district?.join(","),
      params.station?.join(","),
      params.boundaryMeteringPoint?.join(","),
      params.meterType?.join(","),
      params.voltage_kv?.map((v) => v.toString()).join(","),
    ],
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/meters/consumption/daily/bsp?${queryString}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error("Failed to fetch BSP daily data")
      }
      const data = await response.json()
      return data
    },
    enabled: !!params.dateFrom && !!params.dateTo,
  })
}
