import { useQuery } from "@tanstack/react-query"
import { formatApiDate } from "@/lib/utils"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

interface DtxDailyParams {
  dateFrom: string
  dateTo: string
  regions?: string[]
  districts?: string[]
  stations?: string[]
  boundaryMeteringPoints?: string[]
  voltages?: string[]
}

interface DtxAggregateParams {
  dateFrom: string
  dateTo: string
  group?: string
  regions?: string[]
  districts?: string[]
  stations?: string[]
  boundaryMeteringPoints?: string[]
  voltages?: string[]
}

interface DtxDailyRecord {
  consumption_date: string
  meter_number: string
  day_start_reading: number
  day_end_reading: number
  consumed_energy: number
  system_name: "import_kwh" | "export_kwh"
  region: string
  multiply_factor?: number
  district?: string
  meter_type: string
  station?: string
  voltage_kv?: string
}

interface DtxAggregateRecord {
  system_name: "import_kwh" | "export_kwh"
  region: string
  district?: string
  station?: string
  feeder_panel_name?: string
  active_meters: number
  total_meter_count: number
  total_meters_by_region?: number
  total_meters_by_district?: number
  meter_type: string
  group_period: string
  total_consumption: number
}

interface MeterStatusCountsResponse {
  online: number
  offline_no_data: number
  offline_no_record: number
  total: number
}

interface MeterStatusRecord {
  consumption_date: string
  meter_number: string
  status: string
  consumption: number
  reading_count: number
  day_start_time?: string
  day_end_time?: string
}

function buildQueryString(params: DtxDailyParams | DtxAggregateParams): string {
  const queryParams = new URLSearchParams()

  queryParams.append("dateFrom", formatApiDate(params.dateFrom))
  queryParams.append("dateTo", formatApiDate(params.dateTo))

  if ("group" in params && params.group) {
    queryParams.append("group", params.group)
  }

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

  return queryParams.toString()
}

export function useDtxDaily(params: DtxDailyParams) {
  return useQuery({
    queryKey: ["dtx-daily", params],
    queryFn: async () => {
      const queryString = buildQueryString(params)
      const url = `${API_BASE_URL}/api/v1/meters/consumption/daily/dtx?${queryString}`

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error("Failed to fetch DTX daily consumption data")
      }

      const data: DtxDailyRecord[] = await response.json()

      return data
    },
    enabled: !!params.dateFrom && !!params.dateTo,
  })
}

export function useDtxAggregate(params: DtxAggregateParams) {
  const dailyParams: DtxDailyParams = {
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    regions: params.regions,
    districts: params.districts,
    stations: params.stations,
    boundaryMeteringPoints: params.boundaryMeteringPoints,
    voltages: params.voltages,
  }

  return useQuery({
    queryKey: ["dtx-aggregate", params],
    queryFn: async () => {
      const queryString = buildQueryString(params)
      const url = `${API_BASE_URL}/api/v1/meters/consumption/aggregate/dtx?${queryString}`

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error("Failed to fetch DTX aggregate data")
      }

      const data: DtxAggregateRecord[] = await response.json()

      const dailyQueryString = buildQueryString(dailyParams)
      const dailyUrl = `${API_BASE_URL}/api/v1/meters/consumption/daily/dtx?${dailyQueryString}`
      const dailyResponse = await fetch(dailyUrl)

      let activeMeters = 0
      if (dailyResponse.ok) {
        const dailyData: DtxDailyRecord[] = await dailyResponse.json()
        // Count unique meter numbers with consumption
        const uniqueActiveMeters = new Set(
          dailyData.filter((record) => record.consumed_energy > 0).map((record) => record.meter_number),
        )
        activeMeters = uniqueActiveMeters.size
      }

      const totalImportKwh = data
        .filter((d) => d.system_name === "import_kwh")
        .reduce((sum, d) => sum + d.total_consumption, 0)

      const totalExportKwh = data
        .filter((d) => d.system_name === "export_kwh")
        .reduce((sum, d) => sum + d.total_consumption, 0)

      const importRecords = data.filter((d) => d.system_name === "import_kwh")
      const totalMeters = importRecords.length > 0 ? importRecords[0].total_meter_count : 0

      const regionMap = new Map<
        string,
        {
          region: string
          activeMeters: number
          totalMetersByRegion: number
          import: number
          export: number
        }
      >()

      data.forEach((record) => {
        if (!record.region) return

        if (!regionMap.has(record.region)) {
          regionMap.set(record.region, {
            region: record.region,
            activeMeters: 0,
            totalMetersByRegion: record.total_meters_by_region || 0,
            import: 0,
            export: 0,
          })
        }

        const entry = regionMap.get(record.region)!
        // Only count meters once from import records
        if (record.system_name === "import_kwh") {
          entry.activeMeters = record.active_meters
          entry.totalMetersByRegion = record.total_meters_by_region || 0
        }

        if (record.system_name === "import_kwh") {
          entry.import += record.total_consumption
        } else {
          entry.export += record.total_consumption
        }
      })

      const districtMap = new Map<
        string,
        {
          district: string
          region: string
          activeMeters: number
          totalMeters: number
          totalMetersByDistrict: number
          import: number
          export: number
        }
      >()

      data.forEach((record) => {
        if (!record.district) return

        const key = `${record.region}_${record.district}`
        if (!districtMap.has(key)) {
          districtMap.set(key, {
            district: record.district,
            region: record.region,
            activeMeters: record.active_meters,
            totalMeters: record.total_meter_count,
            totalMetersByDistrict: record.total_meters_by_district || 0,
            import: 0,
            export: 0,
          })
        }

        const entry = districtMap.get(key)!
        if (record.system_name === "import_kwh") {
          entry.import += record.total_consumption
        } else {
          entry.export += record.total_consumption
        }
      })

      return {
        totalImportKwh,
        totalExportKwh,
        netKwh: totalImportKwh - totalExportKwh,
        activeMeters,
        totalMeters,
        meterHealth: totalMeters > 0 ? (activeMeters / totalMeters) * 100 : 0,
        rawData: data,
        regionalBreakdown: Array.from(regionMap.values()),
        districtBreakdown: Array.from(districtMap.values()),
      }
    },
    enabled: !!params.dateFrom && !!params.dateTo,
  })
}

export function useDtxMeterStatusCounts(params: DtxDailyParams) {
  return useQuery({
    queryKey: ["dtx-meter-status-counts", params],
    queryFn: async () => {
      const queryParams = new URLSearchParams()

      queryParams.append("dateFrom", formatApiDate(params.dateFrom))
      queryParams.append("dateTo", formatApiDate(params.dateTo))
      queryParams.append("meterType", "DTX")

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

      const url = `${API_BASE_URL}/api/v1/meters/status/counts?${queryParams.toString()}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error("Failed to fetch DTX meter status counts")
      }

      const data: MeterStatusCountsResponse = await response.json()
      return data
    },
    enabled: !!params.dateFrom && !!params.dateTo,
  })
}

export function useDtxMeterStatus(params: DtxDailyParams) {
  return useQuery({
    queryKey: ["dtx-meter-status", params],
    queryFn: async () => {
      const queryParams = new URLSearchParams()

      queryParams.append("dateFrom", formatApiDate(params.dateFrom))
      queryParams.append("dateTo", formatApiDate(params.dateTo))
      queryParams.append("meterType", "DTX")

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

      const url = `${API_BASE_URL}/api/v1/meters/status?${queryParams.toString()}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error("Failed to fetch DTX meter status data")
      }

      const data: MeterStatusRecord[] = await response.json()
      return data
    },
    enabled: !!params.dateFrom && !!params.dateTo,
  })
}
