import { useQuery } from "@tanstack/react-query"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

interface RegionalBoundaryAggregateParams {
  dateFrom?: string
  dateTo?: string
  regions?: string[]
  districts?: string[]
  stations?: string[]
  boundaryMeteringPoints?: string[]
  meterTypes?: string[]
  voltages?: number[]
  locations?: string[]
}

interface RegionalBoundaryDataPoint {
  boundary_metering_point: string
  system_name: "import_kwh" | "export_kwh"
  group_period: string
  total_consumption: number
  active_meters: number
}

interface RegionalBoundaryDailyRecord {
  meter_number: string
  consumption_date: string
  consumed_energy: number
  system_name: "import_kwh" | "export_kwh"
  boundary_metering_point: string
  region: string
  meter_type: string
}

interface ProcessedBoundaryData {
  totalImportKwh: number
  totalExportKwh: number
  netKwh: number
  activeMeters: number
  byBoundaryPoint: {
    boundaryPoint: string
    importKwh: number
    exportKwh: number
    netKwh: number
    activeMeters: number
  }[]
  timeSeriesData: {
    date: string
    [key: string]: number | string // Dynamic keys for each boundary point
  }[]
  rawData: RegionalBoundaryDataPoint[]
}

interface MeterStatusCounts {
  total: number
  online: number
  offline_no_data: number
  offline_no_record: number
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

function buildQueryString(params: RegionalBoundaryAggregateParams): string {
  const queryParams = new URLSearchParams()

  if (params.dateFrom) {
    const dateFrom = new Date(params.dateFrom).toISOString().split('T')[0]
    queryParams.append("dateFrom", dateFrom)
  }
  if (params.dateTo) {
    const dateTo = new Date(params.dateTo).toISOString().split('T')[0]
    queryParams.append("dateTo", dateTo)
  }
  // REGIONAL_BOUNDARY meters are not assigned to a single region — they sit between
  // two regions, identified by boundary_metering_point (e.g. "Accra West/Tema").
  // Filtering by region= returns nothing. Instead pass boundaryMeteringPoint=<region>
  // so the backend does: WHERE lower(mtr.boundary_metering_point) LIKE '%accra west%'
  if (params.regions && params.regions.length > 0) {
    queryParams.append("boundaryMeteringPoint", params.regions.map((r) => r.toLowerCase()).join(","))
  } else if (params.boundaryMeteringPoints && params.boundaryMeteringPoints.length > 0) {
    queryParams.append("boundaryMeteringPoint", params.boundaryMeteringPoints.join(","))
  }
  if (params.districts && params.districts.length > 0) {
    queryParams.append("district", params.districts.join(","))
  }
  if (params.stations && params.stations.length > 0) {
    queryParams.append("station", params.stations.join(","))
  }
  if (params.meterTypes && params.meterTypes.length > 0) {
    queryParams.append("meterType", params.meterTypes.join(","))
  }
  if (params.voltages && params.voltages.length > 0) {
    queryParams.append("voltage_kv", params.voltages.join(","))
  }
  if (params.locations && params.locations.length > 0) {
    queryParams.append("location", params.locations.join(","))
  }

  queryParams.append("group", "meter_type,region")

  return queryParams.toString()
}

function buildDailyQueryString(params: RegionalBoundaryAggregateParams): string {
  const queryParams = new URLSearchParams()

  if (params.dateFrom) {
    const dateFrom = new Date(params.dateFrom).toISOString().split('T')[0]
    queryParams.append("dateFrom", dateFrom)
  }
  if (params.dateTo) {
    const dateTo = new Date(params.dateTo).toISOString().split('T')[0]
    queryParams.append("dateTo", dateTo)
  }
  // Same boundaryMeteringPoint remapping as buildQueryString — see comment above
  if (params.regions && params.regions.length > 0) {
    queryParams.append("boundaryMeteringPoint", params.regions.map((r) => r.toLowerCase()).join(","))
  } else if (params.boundaryMeteringPoints && params.boundaryMeteringPoints.length > 0) {
    queryParams.append("boundaryMeteringPoint", params.boundaryMeteringPoints.join(","))
  }
  if (params.districts && params.districts.length > 0) {
    queryParams.append("district", params.districts.join(","))
  }
  if (params.stations && params.stations.length > 0) {
    queryParams.append("station", params.stations.join(","))
  }
  if (params.meterTypes && params.meterTypes.length > 0) {
    queryParams.append("meterType", params.meterTypes.join(","))
  }
  if (params.voltages && params.voltages.length > 0) {
    queryParams.append("voltage_kv", params.voltages.join(","))
  }
  if (params.locations && params.locations.length > 0) {
    queryParams.append("location", params.locations.join(","))
  }

  return queryParams.toString()
}

function processRegionalBoundaryData(data: RegionalBoundaryDataPoint[]): ProcessedBoundaryData {
  if (!Array.isArray(data) || data.length === 0) {
    return {
      totalImportKwh: 0,
      totalExportKwh: 0,
      netKwh: 0,
      activeMeters: 0,
      byBoundaryPoint: [],
      timeSeriesData: [],
      rawData: [],
    }
  }

  // Calculate totals
  const importData = data?.filter((d) => d.system_name === "import_kwh") ?? []
  const exportData = data?.filter((d) => d.system_name === "export_kwh") ?? []

  const totalImportKwh = importData?.reduce((sum, d) => sum + (d?.total_consumption ?? 0), 0) ?? 0
  const totalExportKwh = exportData?.reduce((sum, d) => sum + (d?.total_consumption ?? 0), 0) ?? 0
  const netKwh = totalImportKwh - totalExportKwh

  // Get unique active meters count
  const uniqueMeters = new Set(data?.map((d) => d.active_meters) ?? [])
  const activeMeters = Math.max(...Array.from(uniqueMeters), 0)

  // Group by boundary point
  const boundaryPointMap = new Map<string, { import: number; export: number; meters: number }>()

  data?.forEach((d) => {
    const point = d.boundary_metering_point
    if (!boundaryPointMap.has(point)) {
      boundaryPointMap.set(point, { import: 0, export: 0, meters: 0 })
    }
    const current = boundaryPointMap.get(point)!
    if (d.system_name === "import_kwh") {
      current.import += d.total_consumption
    } else {
      current.export += d.total_consumption
    }
    current.meters = Math.max(current.meters, d.active_meters)
  })

  const byBoundaryPoint =
    Array.from(boundaryPointMap.entries())?.map(([point, values]) => ({
      boundaryPoint: point,
      importKwh: values.import,
      exportKwh: values.export,
      netKwh: values.import - values.export,
      activeMeters: values.meters,
    })) ?? []

  // Create time series data
  const dateMap = new Map<string, Record<string, number>>()

  data?.forEach((d) => {
    const date = d.group_period.split("T")[0]
    if (!dateMap.has(date)) {
      dateMap.set(date, {})
    }
    const dateData = dateMap.get(date)!
    const key = `${d.boundary_metering_point}_${d.system_name}`
    dateData[key] = (dateData[key] || 0) + d.total_consumption
  })

  const timeSeriesData =
    Array.from(dateMap.entries())
      ?.map(([date, values]) => ({
        date,
        ...values,
      }))
      ?.sort((a, b) => a.date.localeCompare(b.date)) ?? []

  return {
    totalImportKwh,
    totalExportKwh,
    netKwh,
    activeMeters,
    byBoundaryPoint,
    timeSeriesData,
    rawData: data,
  }
}

export function useRegionalBoundaryAggregate(params: RegionalBoundaryAggregateParams) {
  const queryString = buildQueryString(params)

  return useQuery<ProcessedBoundaryData>({
    queryKey: [
      "regional-boundary-aggregate",
      params.dateFrom,
      params.dateTo,
      params.regions,
      params.districts,
      params.stations,
      params.boundaryMeteringPoints,
      params.meterTypes,
      params.voltages,
      params.locations,
    ],
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/meters/consumption/aggregate/regional?${queryString}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error("Failed to fetch regional boundary data")
      }
      const data = await response.json()
      return processRegionalBoundaryData(data)
    },
    enabled: !!params.dateFrom && !!params.dateTo,
  })
}

export function useRegionalBoundaryDaily(params: RegionalBoundaryAggregateParams) {
  const queryString = buildDailyQueryString(params)

  return useQuery<RegionalBoundaryDailyRecord[]>({
    queryKey: [
      "regional-boundary-daily",
      params.dateFrom,
      params.dateTo,
      params.regions,
      params.districts,
      params.stations,
      params.boundaryMeteringPoints,
      params.meterTypes,
      params.voltages,
      params.locations,
    ],
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/meters/consumption/daily/regional?${queryString}`
      console.log("[v0] Regional Boundary Daily URL:", url)
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error("Failed to fetch regional boundary daily data")
      }
      const data = await response.json()
      console.log("[v0] Regional Boundary Daily Data:", {
        recordCount: data?.length,
        sampleRecord: data?.[0],
        hasBoundaryMeteringPoint: data?.[0]?.boundary_metering_point,
      })
      return data
    },
    enabled: !!params.dateFrom && !!params.dateTo,
  })
}

export function useRegionalBoundaryMeterStatusCounts(params: RegionalBoundaryAggregateParams) {
  const queryParams = new URLSearchParams()

  if (params.dateFrom) queryParams.append("dateFrom", params.dateFrom)
  if (params.dateTo) queryParams.append("dateTo", params.dateTo)

  queryParams.append("meterType", "REGIONAL_BOUNDARY")

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
  if (params.voltages && params.voltages.length > 0) {
    queryParams.append("voltage_kv", params.voltages.join(","))
  }
  if (params.locations && params.locations.length > 0) {
    queryParams.append("location", params.locations.join(","))
  }

  const queryString = queryParams.toString()

  return useQuery<MeterStatusCounts>({
    queryKey: [
      "regional-boundary-meter-status-counts",
      params.dateFrom,
      params.dateTo,
      params.regions,
      params.districts,
      params.stations,
      params.boundaryMeteringPoints,
      params.voltages,
      params.locations,
    ],
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/meters/status/counts?${queryString}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error("Failed to fetch regional boundary meter status counts")
      }
      const data = await response.json()
      return data
    },
    enabled: !!params.dateFrom && !!params.dateTo,
  })
}

export function useRegionalBoundaryMeterStatus(params: RegionalBoundaryAggregateParams) {
  const queryParams = new URLSearchParams()

  if (params.dateFrom) queryParams.append("dateFrom", params.dateFrom)
  if (params.dateTo) queryParams.append("dateTo", params.dateTo)

  queryParams.append("meterType", "REGIONAL_BOUNDARY")

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
  if (params.voltages && params.voltages.length > 0) {
    queryParams.append("voltage_kv", params.voltages.join(","))
  }
  if (params.locations && params.locations.length > 0) {
    queryParams.append("location", params.locations.join(","))
  }

  const queryString = queryParams.toString()

  return useQuery<MeterStatusRecord[]>({
    queryKey: [
      "regional-boundary-meter-status",
      params.dateFrom,
      params.dateTo,
      params.regions,
      params.districts,
      params.stations,
      params.boundaryMeteringPoints,
      params.meterTypes,
      params.voltages,
      params.locations,
    ],
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/meters/status?${queryString}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error("Failed to fetch regional boundary meter status")
      }
      const data = await response.json()
      return data
    },
    enabled: !!params.dateFrom && !!params.dateTo,
  })
}
