import { useQuery } from "@tanstack/react-query"
import { formatApiDate } from "@/lib/utils"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8780"

export interface SsDailyParams {
  dateFrom: string
  dateTo: string
  region?: string[]
  district?: string[]
  station?: string[]
  boundaryMeteringPoint?: string[]
  meterType?: string[]
  voltageKv?: string[]
}

export interface SsAggregateParams {
  dateFrom: string
  dateTo: string
  group?: string
  region?: string[]
  district?: string[]
  station?: string[]
  boundaryMeteringPoint?: string[]
  meterType?: string[]
  voltageKv?: string[]
}

export interface SsDailyRecord {
  consumption_date: string
  meter_number: string
  day_start_reading: number
  day_end_reading: number
  consumed_energy: number
  system_name: "import_kwh" | "export_kwh"
  region: string
  district?: string
  station?: string
  boundary_metering_point?: string
  meter_type: string
  voltage_kv?: string
}

export interface SsAggregateRecord {
  system_name: "import_kwh" | "export_kwh"
  region?: string
  district?: string
  station?: string
  boundary_metering_point?: string
  feeder_panel_name?: string
  active_meters: number
  meter_type?: string
  voltage_kv?: string
  group_period: string
  total_consumption: number
}

function buildQueryString(params: Record<string, any>): string {
  const queryParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if ((key === "dateFrom" || key === "dateTo") && value) {
        const formattedDate = formatApiDate(value as string)
        if (formattedDate) {
          queryParams.append(key, formattedDate)
        }
        return
      }

      if (Array.isArray(value) && value.length > 0) {
        value.forEach((v) => queryParams.append(key, v))
      } else if (!Array.isArray(value)) {
        queryParams.append(key, String(value))
      }
    }
  })

  return queryParams.toString()
}

export function useSsDaily(params: SsDailyParams) {
  return useQuery({
    queryKey: ["ss-daily", params],
    queryFn: async () => {
      const queryString = buildQueryString(params)
      const response = await fetch(`${API_BASE_URL}/api/v1/meters/consumption/daily/ss?${queryString}`)

      if (!response.ok) {
        throw new Error("Failed to fetch SS daily consumption data")
      }

      const data: SsDailyRecord[] = await response.json()
      return data
    },
    enabled: !!params.dateFrom && !!params.dateTo,
  })
}

export function useSsAggregate(params: SsAggregateParams) {
  return useQuery({
    queryKey: ["ss-aggregate", params],
    queryFn: async () => {
      const queryString = buildQueryString(params)
      const response = await fetch(`${API_BASE_URL}/api/v1/meters/consumption/aggregate/ss?${queryString}`)

      if (!response.ok) {
        throw new Error("Failed to fetch SS aggregate consumption data")
      }

      const data: SsAggregateRecord[] = await response.json()

      // Process the data to calculate totals
      const totalImportKwh = data
        .filter((d) => d.system_name === "import_kwh")
        .reduce((sum, d) => sum + d.total_consumption, 0)

      const totalExportKwh = data
        .filter((d) => d.system_name === "export_kwh")
        .reduce((sum, d) => sum + d.total_consumption, 0)

      const netKwh = totalImportKwh - totalExportKwh

      const activeMeters = data.reduce((sum, d) => sum + d.active_meters, 0)

      return {
        totalImportKwh,
        totalExportKwh,
        netKwh,
        activeMeters,
        rawData: data,
      }
    },
    enabled: !!params.dateFrom && !!params.dateTo,
  })
}
