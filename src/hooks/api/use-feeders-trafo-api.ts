// "use client"
// import { useQuery } from "@tanstack/react-query"
//
// interface FeedersTrafoRecord {
//   consumption_date: string
//   meter_number: string
//   day_start_reading: number
//   day_end_reading: number
//   consumed_energy: number
//   system_name: "import_kwh" | "export_kwh"
//   ic_og: "IC" | "OG"
//   region: string
//   station: string
//   feeder_panel_name: string
//   voltage_kv?: string
// }
//
// interface FeedersTrafoAggregate {
//   group_period: string
//   meter_type: string
//   region: string
//   station: string
//   ic_og: "IC" | "OG"
//   active_meters: number
//   total_meter_count: number
//   all_meters_count: number
//   total_consumption: number
//   system_name: "import_kwh" | "export_kwh"
// }
//
// interface ProcessedAggregate {
//   totalSupplyKwh: number
//   totalReverseFlowKwh: number
//   netSupplyKwh: number
//   totalActiveMeters: number
//   totalMeterCount: number
//   uniqueStations: number
//   uniqueFeederPanels: number
//   byRegion: Array<{
//     region: string
//     supplyKwh: number
//     reverseFlowKwh: number
//     netSupplyKwh: number
//     percentOfTotal: number
//     activeMeters: number
//     totalMeters: number
//     stations: Array<{
//       station: string
//       supplyKwh: number
//       reverseFlowKwh: number
//       netSupplyKwh: number
//       activeMeters: number
//       totalMeters: number
//     }>
//   }>
//   timeSeriesData: Array<{ date: string; [key: string]: any }>
//   heatmapData: Array<{
//     region: string
//     dailySupply: Array<{ date: string; supply: number; reverseFlow: number }>
//   }>
//   rawData: FeedersTrafoAggregate[]
// }
//
// interface MeterStatusRecord {
//   consumption_date: string
//   meter_number: string
//   status: string
//   consumption: number
//   reading_count: number
//   day_start_time: string
//   day_end_time: string
// }
//
// interface MeterStatusCounts {
//   offline_no_data: number
//   offline_no_record: number
//   online: number
//   total: number
// }
//
// const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780/api/v1"
//
// function buildQueryString(params: {
//   dateFrom: string
//   dateTo: string
//   region?: string[]
//   district?: string[]
//   station?: string[]
//   boundaryMeteringPoints?: string[]
//   meterType?: string[]
//   voltage_kv?: number[]
// }): string {
//   const queryParams = new URLSearchParams()
//
//   queryParams.append("dateFrom", params.dateFrom)
//   queryParams.append("dateTo", params.dateTo)
//   queryParams.append("group", "meter_type,region,station")
//
//   if (params.region && params.region.length > 0) {
//     queryParams.append("region", params.region.join(","))
//   }
//   if (params.district && params.district.length > 0) {
//     queryParams.append("district", params.district.join(","))
//   }
//   if (params.station && params.station.length > 0) {
//     queryParams.append("station", params.station.join(","))
//   }
//   if (params.boundaryMeteringPoints && params.boundaryMeteringPoints.length > 0) {
//     queryParams.append("boundaryMeteringPoint", params.boundaryMeteringPoints.join(","))
//   }
//   if (params.meterType && params.meterType.length > 0) {
//     queryParams.append("meterType", params.meterType.join(","))
//   }
//   if (params.voltage_kv && params.voltage_kv.length > 0) {
//     queryParams.append("voltage_kv", params.voltage_kv.map((v) => v.toString()).join(","))
//   }
//
//   return queryParams.toString()
// }
//
// function buildDailyQueryString(params: {
//   dateFrom: string
//   dateTo: string
//   region?: string[]
//   district?: string[]
//   station?: string[]
//   boundaryMeteringPoints?: string[]
//   meterType?: string[]
//   voltage_kv?: number[]
// }): string {
//   const queryParams = new URLSearchParams()
//
//   queryParams.append("dateFrom", params.dateFrom)
//   queryParams.append("dateTo", params.dateTo)
//
//   if (params.region && params.region.length > 0) {
//     queryParams.append("region", params.region.join(","))
//   }
//   if (params.district && params.district.length > 0) {
//     queryParams.append("district", params.district.join(","))
//   }
//   if (params.station && params.station.length > 0) {
//     queryParams.append("station", params.station.join(","))
//   }
//   if (params.boundaryMeteringPoints && params.boundaryMeteringPoints.length > 0) {
//     queryParams.append("boundaryMeteringPoint", params.boundaryMeteringPoints.join(","))
//   }
//   if (params.meterType && params.meterType.length > 0) {
//     queryParams.append("meterType", params.meterType.join(","))
//   }
//   if (params.voltage_kv && params.voltage_kv.length > 0) {
//     queryParams.append("voltage_kv", params.voltage_kv.map((v) => v.toString()).join(","))
//   }
//
//   return queryParams.toString()
// }
//
// function processFeedersTrafoData(data: FeedersTrafoAggregate[]): ProcessedAggregate {
//   if (!Array.isArray(data) || data.length === 0) {
//     return {
//       totalSupplyKwh: 0,
//       totalReverseFlowKwh: 0,
//       netSupplyKwh: 0,
//       totalActiveMeters: 0,
//       totalMeterCount: 0,
//       uniqueStations: 0,
//       uniqueFeederPanels: 0,
//       byRegion: [],
//       timeSeriesData: [],
//       heatmapData: [],
//       rawData: [],
//     }
//   }
//
//   const normalizeRegion = (region: string) => region.toLowerCase().trim()
//
//   const supplyData = data.filter((d) => d.system_name === "import_kwh")
//   const reverseFlowData = data.filter((d) => d.system_name === "export_kwh")
//
//   const totalSupplyKwh = supplyData.reduce((sum, d) => sum + d.total_consumption, 0)
//   const totalReverseFlowKwh = reverseFlowData.reduce((sum, d) => sum + d.total_consumption, 0)
//   const netSupplyKwh = totalSupplyKwh - totalReverseFlowKwh
//
//   const totalActiveMeters = data.reduce((sum, d) => sum + d.active_meters, 0)
//   const totalMeterCount = data.reduce((sum, d) => sum + d.total_meter_count, 0)
//   const uniqueStations = new Set(data.map((d) => d.station)).size
//   const uniqueFeederPanels = new Set(data.map((d) => `${d.station}-${d.region}`)).size
//
//   // Group by region
//   const regionMap = new Map<
//     string,
//     {
//       supply: number
//       reverseFlow: number
//       activeMeters: number
//       totalMeters: number
//       stations: Map<string, { supply: number; reverseFlow: number; activeMeters: number; totalMeters: number }>
//     }
//   >()
//
//   data.forEach((d) => {
//     const region = normalizeRegion(d.region)
//     const station = d.station || "Unknown Station"
//
//     if (!regionMap.has(region)) {
//       regionMap.set(region, { supply: 0, reverseFlow: 0, activeMeters: 0, totalMeters: 0, stations: new Map() })
//     }
//     const regionData = regionMap.get(region)!
//
//     if (!regionData.stations.has(station)) {
//       regionData.stations.set(station, { supply: 0, reverseFlow: 0, activeMeters: 0, totalMeters: 0 })
//     }
//     const stationData = regionData.stations.get(station)!
//
//     if (d.system_name === "import_kwh") {
//       regionData.supply += d.total_consumption
//       stationData.supply += d.total_consumption
//     } else {
//       regionData.reverseFlow += d.total_consumption
//       stationData.reverseFlow += d.total_consumption
//     }
//
//     regionData.activeMeters += d.active_meters
//     regionData.totalMeters += d.total_meter_count
//     stationData.activeMeters += d.active_meters
//     stationData.totalMeters += d.total_meter_count
//   })
//
//   const byRegion = Array.from(regionMap.entries()).map(([region, values]) => ({
//     region,
//     supplyKwh: values.supply,
//     reverseFlowKwh: values.reverseFlow,
//     netSupplyKwh: values.supply - values.reverseFlow,
//     percentOfTotal: totalSupplyKwh > 0 ? (values.supply / totalSupplyKwh) * 100 : 0,
//     activeMeters: values.activeMeters,
//     totalMeters: values.totalMeters,
//     stations: Array.from(values.stations.entries()).map(([station, stationValues]) => ({
//       station,
//       supplyKwh: stationValues.supply,
//       reverseFlowKwh: stationValues.reverseFlow,
//       netSupplyKwh: stationValues.supply - stationValues.reverseFlow,
//       activeMeters: stationValues.activeMeters,
//       totalMeters: stationValues.totalMeters,
//     })),
//   }))
//
//   // Create heatmap data
//   const heatmapMap = new Map<string, Map<string, { supply: number; reverseFlow: number }>>()
//
//   supplyData.forEach((d) => {
//     const region = normalizeRegion(d.region)
//     const date = d.group_period.split("T")[0]
//
//     if (!heatmapMap.has(region)) {
//       heatmapMap.set(region, new Map())
//     }
//     const regionDates = heatmapMap.get(region)!
//
//     if (!regionDates.has(date)) {
//       regionDates.set(date, { supply: 0, reverseFlow: 0 })
//     }
//     const dateData = regionDates.get(date)!
//     dateData.supply += d.total_consumption
//   })
//
//   reverseFlowData.forEach((d) => {
//     const region = normalizeRegion(d.region)
//     const date = d.group_period.split("T")[0]
//
//     if (!heatmapMap.has(region)) {
//       heatmapMap.set(region, new Map())
//     }
//     const regionDates = heatmapMap.get(region)!
//
//     if (!regionDates.has(date)) {
//       regionDates.set(date, { supply: 0, reverseFlow: 0 })
//     }
//     const dateData = regionDates.get(date)!
//     dateData.reverseFlow += d.total_consumption
//   })
//
//   const heatmapData = Array.from(heatmapMap.entries()).map(([region, dates]) => ({
//     region,
//     dailySupply: Array.from(dates.entries())
//       .map(([date, values]) => ({
//         date,
//         supply: values.supply,
//         reverseFlow: values.reverseFlow,
//       }))
//       .sort((a, b) => a.date.localeCompare(b.date)),
//   }))
//
//   const dateMap = new Map<string, Record<string, number>>()
//
//   data.forEach((d) => {
//     const date = d.group_period.split("T")[0]
//     const region = normalizeRegion(d.region)
//
//     if (!dateMap.has(date)) {
//       dateMap.set(date, {})
//     }
//     const dateData = dateMap.get(date)!
//     const key = `${region}_${d.system_name}`
//     dateData[key] = (dateData[key] || 0) + d.total_consumption
//   })
//
//   const timeSeriesData = Array.from(dateMap.entries())
//     .map(([date, values]) => ({
//       date,
//       ...values,
//     }))
//     .sort((a, b) => a.date.localeCompare(b.date))
//
//   return {
//     totalSupplyKwh,
//     totalReverseFlowKwh,
//     netSupplyKwh,
//     totalActiveMeters,
//     totalMeterCount,
//     uniqueStations,
//     uniqueFeederPanels,
//     byRegion,
//     timeSeriesData,
//     heatmapData,
//     rawData: data,
//   }
// }
//
// export function useFeedersTrafoAggregate(params: {
//   dateFrom: string
//   dateTo: string
//   region?: string[]
//   district?: string[]
//   station?: string[]
//   boundaryMeteringPoints?: string[]
//   meterType?: string[]
//   voltage_kv?: number[]
// }) {
//   const queryString = buildQueryString(params)
//
//   return useQuery<ProcessedAggregate>({
//     queryKey: [
//       "feeders-trafo-aggregate",
//       params.dateFrom,
//       params.dateTo,
//       params.region?.join(","),
//       params.district?.join(","),
//       params.station?.join(","),
//       params.boundaryMeteringPoints?.join(","),
//       params.meterType?.join(","),
//       params.voltage_kv?.map((v) => v.toString()).join(","),
//     ],
//     queryFn: async () => {
//       const response = await fetch(`${API_BASE}/api/v1/meters/consumption/aggregate/feeder-trafo?${queryString}`)
//       if (!response.ok) throw new Error("Failed to fetch feeder-trafo aggregate data")
//
//       const records: FeedersTrafoAggregate[] = await response.json()
//       return processFeedersTrafoData(records)
//     },
//     enabled: !!params.dateFrom && !!params.dateTo,
//   })
// }
//
// export function useFeedersTrafoDaily(params: {
//   dateFrom: string
//   dateTo: string
//   region?: string[]
//   district?: string[]
//   station?: string[]
//   boundaryMeteringPoints?: string[]
//   meterType?: string[]
//   voltage_kv?: number[]
// }) {
//   const queryString = buildDailyQueryString(params)
//
//   return useQuery<FeedersTrafoRecord[]>({
//     queryKey: [
//       "feeders-trafo-daily",
//       params.dateFrom,
//       params.dateTo,
//       params.region?.join(","),
//       params.district?.join(","),
//       params.station?.join(","),
//       params.boundaryMeteringPoints?.join(","),
//       params.meterType?.join(","),
//       params.voltage_kv?.map((v) => v.toString()).join(","),
//     ],
//     queryFn: async () => {
//       const response = await fetch(`${API_BASE}/api/v1/meters/consumption/daily/feeder-trafo?${queryString}`)
//       if (!response.ok) throw new Error("Failed to fetch feeder-trafo daily data")
//
//       const records: FeedersTrafoRecord[] = await response.json()
//       return records
//     },
//     enabled: !!params.dateFrom && !!params.dateTo,
//   })
// }
//
// export function useFeedersTrafoMeterStatus(params: {
//   dateFrom: string
//   dateTo: string
//   region?: string[]
//   district?: string[]
//   station?: string[]
//   meterType?: string[]
// }) {
//   const queryString = buildDailyQueryString(params)
//
//   console.log("[v0] useFeedersTrafoMeterStatus params:", params)
//   console.log("[v0] useFeedersTrafoMeterStatus queryString:", queryString)
//   console.log("[v0] useFeedersTrafoMeterStatus URL:", `${API_BASE}/api/v1/meters/status?${queryString}`)
//
//   return useQuery<MeterStatusRecord[]>({
//     queryKey: [
//       "feeders-trafo-meter-status",
//       params.dateFrom,
//       params.dateTo,
//       params.region?.join(","),
//       params.district?.join(","),
//       params.station?.join(","),
//       params.meterType?.join(","),
//     ],
//     queryFn: async () => {
//       const response = await fetch(`${API_BASE}/api/v1/meters/status?${queryString}`)
//       if (!response.ok) throw new Error("Failed to fetch meter status data")
//
//       const records: MeterStatusRecord[] = await response.json()
//       console.log("[v0] useFeedersTrafoMeterStatus returned records count:", records.length)
//       return records
//     },
//     enabled: !!params.dateFrom && !!params.dateTo,
//   })
// }
//
// export function useFeedersTrafoMeterStatusCounts(params: {
//   dateFrom: string
//   dateTo: string
//   region?: string[]
//   district?: string[]
//   station?: string[]
//   meterType?: string[]
// }) {
//   const queryString = buildDailyQueryString(params)
//
//   console.log("[v0] useFeedersTrafoMeterStatusCounts params:", params)
//   console.log("[v0] useFeedersTrafoMeterStatusCounts queryString:", queryString)
//
//   return useQuery<MeterStatusCounts>({
//     queryKey: [
//       "feeders-trafo-meter-status-counts",
//       params.dateFrom,
//       params.dateTo,
//       params.region?.join(","),
//       params.district?.join(","),
//       params.station?.join(","),
//       params.meterType?.join(","),
//     ],
//     queryFn: async () => {
//       const response = await fetch(`${API_BASE}/api/v1/meters/status/counts?${queryString}`)
//       if (!response.ok) throw new Error("Failed to fetch meter status counts")
//
//       const counts: MeterStatusCounts = await response.json()
//       return counts
//     },
//     enabled: !!params.dateFrom && !!params.dateTo,
//   })
// }

"use client"
import { useQuery } from "@tanstack/react-query"

interface FeedersTrafoRecord {
  consumption_date: string
  meter_number: string
  day_start_reading: number
  day_end_reading: number
  consumed_energy: number
  system_name: "import_kwh" | "export_kwh"
  ic_og: "IC" | "OG"
  region: string
  station: string
  multiply_factor? : number
  feeder_panel_name: string
  voltage_kv?: string
}

interface FeedersTrafoAggregate {
  group_period: string
  meter_type: string
  region: string
  station: string
  ic_og: "IC" | "OG"
  active_meters: number
  total_meter_count: number
  all_meters_count: number
  total_consumption: number
  system_name: "import_kwh" | "export_kwh"
}

interface ProcessedAggregate {
  totalSupplyKwh: number
  totalReverseFlowKwh: number
  netSupplyKwh: number
  totalActiveMeters: number
  totalMeterCount: number
  uniqueStations: number
  uniqueFeederPanels: number
  byRegion: Array<{
    region: string
    supplyKwh: number
    reverseFlowKwh: number
    netSupplyKwh: number
    percentOfTotal: number
    activeMeters: number
    totalMeters: number
    stations: Array<{
      station: string
      supplyKwh: number
      reverseFlowKwh: number
      netSupplyKwh: number
      activeMeters: number
      totalMeters: number
    }>
  }>
  timeSeriesData: Array<{ date: string; [key: string]: any }>
  heatmapData: Array<{
    region: string
    dailySupply: Array<{ date: string; supply: number; reverseFlow: number }>
  }>
  rawData: FeedersTrafoAggregate[]
}

interface MeterStatusRecord {
  consumption_date: string
  meter_number: string
  status: string
  consumption: number
  reading_count: number
  day_start_time: string
  day_end_time: string
}

interface MeterStatusCounts {
  offline_no_data: number
  offline_no_record: number
  online: number
  total: number
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780/api/v1"

function buildQueryString(params: {
  dateFrom: string
  dateTo: string
  regions?: string[]
  districts?: string[]
  stations?: string[]
  boundaryMeteringPoints?: string[]
  meterTypes?: string[]
  voltages?: number[]
}): string {
  const queryParams = new URLSearchParams()

  queryParams.append("dateFrom", params.dateFrom)
  queryParams.append("dateTo", params.dateTo)
  queryParams.append("group", "meter_type,region,station")

  if (params.regions && params.regions.length > 0) {
    queryParams.append("region", params.regions.join(","))
  }
  if (params.districts && params.districts.length > 0) {
    queryParams.append("district", params.districts.join(","))
  }
  if (params.stations && params.stations.length > 0) {
    queryParams.append("station", params.stations.join(","))
  }
  if (params.boundaryMeteringPoints && params.boundaryMeteringPoints.length > 0) {
    queryParams.append("boundaryMeteringPoint", params.boundaryMeteringPoints.join(","))
  }
  if (params.meterTypes && params.meterTypes.length > 0) {
    queryParams.append("meterType", params.meterTypes.join(","))
  }
  if (params.voltages && params.voltages.length > 0) {
    queryParams.append("voltage_kv", params.voltages.map((v) => v.toString()).join(","))
  }

  return queryParams.toString()
}

function buildDailyQueryString(params: {
  dateFrom: string
  dateTo: string
  regions?: string[]
  districts?: string[]
  stations?: string[]
  boundaryMeteringPoints?: string[]
  meterTypes?: string[]
  voltages?: number[]
}): string {
  const queryParams = new URLSearchParams()

  queryParams.append("dateFrom", params.dateFrom)
  queryParams.append("dateTo", params.dateTo)

  if (params.regions && params.regions.length > 0) {
    queryParams.append("region", params.regions.join(","))
  }
  if (params.districts && params.districts.length > 0) {
    queryParams.append("district", params.districts.join(","))
  }
  if (params.stations && params.stations.length > 0) {
    queryParams.append("station", params.stations.join(","))
  }
  if (params.boundaryMeteringPoints && params.boundaryMeteringPoints.length > 0) {
    queryParams.append("boundaryMeteringPoint", params.boundaryMeteringPoints.join(","))
  }
  if (params.meterTypes && params.meterTypes.length > 0) {
    queryParams.append("meterType", params.meterTypes.join(","))
  }
  if (params.voltages && params.voltages.length > 0) {
    queryParams.append("voltage_kv", params.voltages.map((v) => v.toString()).join(","))
  }

  return queryParams.toString()
}

function processFeedersTrafoData(data: FeedersTrafoAggregate[]): ProcessedAggregate {
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
      timeSeriesData: [],
      heatmapData: [],
      rawData: [],
    }
  }

  const normalizeRegion = (region: string) => region.toLowerCase().trim()

  const supplyData = data.filter((d) => d.system_name === "import_kwh")
  const reverseFlowData = data.filter((d) => d.system_name === "export_kwh")

  const totalSupplyKwh = supplyData.reduce((sum, d) => sum + d.total_consumption, 0)
  const totalReverseFlowKwh = reverseFlowData.reduce((sum, d) => sum + d.total_consumption, 0)
  const netSupplyKwh = totalSupplyKwh - totalReverseFlowKwh

  const totalActiveMeters = data.reduce((sum, d) => sum + d.active_meters, 0)
  const totalMeterCount = data.reduce((sum, d) => sum + d.total_meter_count, 0)
  const uniqueStations = new Set(data.map((d) => d.station)).size
  const uniqueFeederPanels = new Set(data.map((d) => `${d.station}-${d.region}`)).size

  // Group by region
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

  data.forEach((d) => {
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

  // Create heatmap data
  const heatmapMap = new Map<string, Map<string, { supply: number; reverseFlow: number }>>()

  supplyData.forEach((d) => {
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

  reverseFlowData.forEach((d) => {
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

  const dateMap = new Map<string, Record<string, number>>()

  data.forEach((d) => {
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

  return {
    totalSupplyKwh,
    totalReverseFlowKwh,
    netSupplyKwh,
    totalActiveMeters,
    totalMeterCount,
    uniqueStations,
    uniqueFeederPanels,
    byRegion,
    timeSeriesData,
    heatmapData,
    rawData: data,
  }
}

export function useFeedersTrafoAggregate(params: {
  dateFrom: string
  dateTo: string
  regions?: string[]
  districts?: string[]
  stations?: string[]
  boundaryMeteringPoints?: string[]
  meterTypes?: string[]
  voltages?: number[]
}) {
  const queryString = buildQueryString(params)

  return useQuery<ProcessedAggregate>({
    queryKey: [
      "feeders-trafo-aggregate",
      params.dateFrom,
      params.dateTo,
      params.regions?.join(","),
      params.districts?.join(","),
      params.stations?.join(","),
      params.boundaryMeteringPoints?.join(","),
      params.meterTypes?.join(","),
      params.voltages?.map((v) => v.toString()).join(","),
    ],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/v1/meters/consumption/aggregate/feeder-trafo?${queryString}`)
      if (!response.ok) throw new Error("Failed to fetch feeder-trafo aggregate data")

      const records: FeedersTrafoAggregate[] = await response.json()
      return processFeedersTrafoData(records)
    },
    enabled: !!params.dateFrom && !!params.dateTo,
  })
}

export function useFeedersTrafoDaily(params: {
  dateFrom: string
  dateTo: string
  regions?: string[]
  districts?: string[]
  stations?: string[]
  boundaryMeteringPoints?: string[]
  meterTypes?: string[]
  voltages?: number[]
}) {
  const queryString = buildDailyQueryString(params)

  return useQuery<FeedersTrafoRecord[]>({
    queryKey: [
      "feeders-trafo-daily",
      params.dateFrom,
      params.dateTo,
      params.regions?.join(","),
      params.districts?.join(","),
      params.stations?.join(","),
      params.boundaryMeteringPoints?.join(","),
      params.meterTypes?.join(","),
      params.voltages?.map((v) => v.toString()).join(","),
    ],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/v1/meters/consumption/daily/feeder-trafo?${queryString}`)
      if (!response.ok) throw new Error("Failed to fetch feeder-trafo daily data")

      const records: FeedersTrafoRecord[] = await response.json()
      return records
    },
    enabled: !!params.dateFrom && !!params.dateTo,
  })
}

export function useFeedersTrafoMeterStatus(params: {
  dateFrom: string
  dateTo: string
  regions?: string[]
  districts?: string[]
  stations?: string[]
  meterTypes?: string[]
}) {
  const queryString = buildDailyQueryString(params)

  console.log("[v0] useFeedersTrafoMeterStatus params:", params)
  console.log("[v0] useFeedersTrafoMeterStatus queryString:", queryString)
  console.log("[v0] useFeedersTrafoMeterStatus URL:", `${API_BASE}/api/v1/meters/status?${queryString}`)

  return useQuery<MeterStatusRecord[]>({
    queryKey: [
      "feeders-trafo-meter-status",
      params.dateFrom,
      params.dateTo,
      params.regions?.join(","),
      params.districts?.join(","),
      params.stations?.join(","),
      params.meterTypes?.join(","),
    ],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/v1/meters/status?${queryString}`)
      if (!response.ok) throw new Error("Failed to fetch meter status data")

      const records: MeterStatusRecord[] = await response.json()
      console.log("[v0] useFeedersTrafoMeterStatus returned records count:", records.length)
      return records
    },
    enabled: !!params.dateFrom && !!params.dateTo,
  })
}

export function useFeedersTrafoMeterStatusCounts(params: {
  dateFrom: string
  dateTo: string
  regions?: string[]
  districts?: string[]
  stations?: string[]
  meterTypes?: string[]
}) {
  const queryString = buildDailyQueryString(params)

  console.log("[v0] useFeedersTrafoMeterStatusCounts params:", params)
  console.log("[v0] useFeedersTrafoMeterStatusCounts queryString:", queryString)

  return useQuery<MeterStatusCounts>({
    queryKey: [
      "feeders-trafo-meter-status-counts",
      params.dateFrom,
      params.dateTo,
      params.regions?.join(","),
      params.districts?.join(","),
      params.stations?.join(","),
      params.meterTypes?.join(","),
    ],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/v1/meters/status/counts?${queryString}`)
      if (!response.ok) throw new Error("Failed to fetch meter status counts")

      const counts: MeterStatusCounts = await response.json()
      return counts
    },
    enabled: !!params.dateFrom && !!params.dateTo,
  })
}
