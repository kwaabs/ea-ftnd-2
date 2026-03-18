import { useQuery } from "@tanstack/react-query"
import { formatApiDate } from "@/lib/utils"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

interface AggregateDataPoint {
  system_name: "export_kwh" | "import_kwh"
  active_meters: number
  total_meter_count: number
  group_period: string
  total_consumption: number
}

interface GroupedAggregateDataPoint {
  system_name: "export_kwh" | "import_kwh"
  region?: string
  active_meters: number
  total_meter_count: number
  meter_type?: string
  group_period: string
  total_consumption: number
}

interface AggregateParams {
  dateFrom: string | Date
  dateTo: string | Date
  group?: string
  region?: string
  district?: string
  station?: string
  boundaryMeteringPoint?: string
  meterType?: string
  voltage_kv?: number
}

interface GroupedAggregateParams extends AggregateParams {
  group: string // e.g., "meter_type" or "meter_type,region"
}

interface ProcessedAggregateData {
  totalImportKwh: number
  totalExportKwh: number
  netKwh: number
  activeMeters: number
  totalMeters: number
  rawData: AggregateDataPoint[]
}

function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") return

    if ((key === "dateFrom" || key === "dateTo") && value) {
      const formattedDate = formatApiDate(value)
      if (formattedDate) {
        searchParams.append(key, formattedDate)
      }
      return
    }

    // Handle arrays by joining with commas
    if (Array.isArray(value) && value.length > 0) {
      searchParams.append(key, value.join(","))
    } else if (!Array.isArray(value)) {
      searchParams.append(key, String(value))
    }
  })

  return searchParams.toString()
}

function processAggregateData(data: AggregateDataPoint[] | null | undefined): ProcessedAggregateData {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return {
      totalImportKwh: 0,
      totalExportKwh: 0,
      netKwh: 0,
      activeMeters: 0,
      totalMeters: 0,
      rawData: [],
    }
  }

  const importData = data?.filter((d) => d?.system_name === "import_kwh") ?? []
  const exportData = data?.filter((d) => d?.system_name === "export_kwh") ?? []

  const totalImportKwh = importData?.reduce((sum, d) => sum + (d?.total_consumption ?? 0), 0) ?? 0
  const totalExportKwh = exportData?.reduce((sum, d) => sum + (d?.total_consumption ?? 0), 0) ?? 0
  const netKwh = totalImportKwh - totalExportKwh

  // Get unique active meters (use the maximum active_meters count across all periods)
  const allActiveMeters = [...(importData ?? []), ...(exportData ?? [])]?.map((d) => d?.active_meters ?? 0) ?? []
  const activeMeters = allActiveMeters.length > 0 ? Math.max(...allActiveMeters) : 0

  // Get total meters (should be consistent across all records)
  const totalMeters = data?.[0]?.total_meter_count ?? 0

  return {
    totalImportKwh,
    totalExportKwh,
    netKwh,
    activeMeters,
    totalMeters,
    rawData: data,
  }
}

export function useConsumptionAggregate(params: AggregateParams) {
  const queryString = buildQueryString(params)

  console.log("[v0] useConsumptionAggregate called with params:", params)
  console.log("[v0] useConsumptionAggregate queryString:", queryString)
  console.log("[v0] useConsumptionAggregate enabled:", !!params.dateFrom && !!params.dateTo)

  return useQuery<ProcessedAggregateData>({
    queryKey: [
      "consumption-aggregate",
      params.dateFrom,
      params.dateTo,
      // Use stable serialization for arrays/objects
      params.region ? (Array.isArray(params.region) ? params.region.sort().join(",") : params.region) : "",
      params.district ? (Array.isArray(params.district) ? params.district.sort().join(",") : params.district) : "",
      params.station ? (Array.isArray(params.station) ? params.station.sort().join(",") : params.station) : "",
      params.boundaryMeteringPoint ? (Array.isArray(params.boundaryMeteringPoint) ? params.boundaryMeteringPoint.sort().join(",") : params.boundaryMeteringPoint) : "",
      params.meterType ? (Array.isArray(params.meterType) ? params.meterType.sort().join(",") : params.meterType) : "",
      params.voltage_kv ? (Array.isArray(params.voltage_kv) ? params.voltage_kv.sort().join(",") : String(params.voltage_kv)) : "",
    ],
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/meters/consumption/aggregate?${queryString}`

      console.log("[v0] useConsumptionAggregate fetching from URL:", url)

      try {
        const response = await fetch(url)
        console.log("[v0] useConsumptionAggregate response status:", response.status)

        if (!response.ok) {
          const errorText = await response.text()
          console.error("[v0] useConsumptionAggregate API error:", errorText)
          throw new Error(`Failed to fetch consumption aggregate data: ${response.status}`)
        }

        const jsonData = await response.json()
        console.log("[v0] useConsumptionAggregate raw JSON response:", jsonData)
        console.log("[v0] useConsumptionAggregate response type:", typeof jsonData)
        console.log("[v0] useConsumptionAggregate is array?:", Array.isArray(jsonData))

        // Check if response has a data wrapper
        const data: AggregateDataPoint[] = jsonData?.data || jsonData
        console.log("[v0] useConsumptionAggregate extracted data:", data)
        console.log("[v0] useConsumptionAggregate data length:", data?.length)

        const processed = processAggregateData(data)
        console.log("[v0] useConsumptionAggregate processed data:", processed)

        return processed
      } catch (error) {
        console.error("[v0] useConsumptionAggregate error:", error)
        throw error
      }
    },
    enabled: !!params.dateFrom && !!params.dateTo,
    staleTime: 0,
    refetchOnMount: true,
  })
}

export function useGroupedConsumptionAggregate(params: GroupedAggregateParams) {
  const queryString = buildQueryString(params)

  return useQuery<GroupedAggregateDataPoint[]>({
    queryKey: [
      "consumption-aggregate-grouped",
      params.group,
      params.dateFrom,
      params.dateTo,
      // Use stable serialization for arrays/objects
      params.region ? (Array.isArray(params.region) ? params.region.sort().join(",") : params.region) : "",
      params.district ? (Array.isArray(params.district) ? params.district.sort().join(",") : params.district) : "",
      params.station ? (Array.isArray(params.station) ? params.station.sort().join(",") : params.station) : "",
      params.boundaryMeteringPoint ? (Array.isArray(params.boundaryMeteringPoint) ? params.boundaryMeteringPoint.sort().join(",") : params.boundaryMeteringPoint) : "",
      params.meterType ? (Array.isArray(params.meterType) ? params.meterType.sort().join(",") : params.meterType) : "",
      params.voltage_kv ? (Array.isArray(params.voltage_kv) ? params.voltage_kv.sort().join(",") : String(params.voltage_kv)) : "",
    ],
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/meters/consumption/aggregate?${queryString}`

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error("Failed to fetch grouped consumption aggregate data")
      }
      const data: GroupedAggregateDataPoint[] = await response.json()

      return data
    },
    enabled: !!params.dateFrom && !!params.dateTo && !!params.group,
    staleTime: 0,
    refetchOnMount: true,
  })
}
