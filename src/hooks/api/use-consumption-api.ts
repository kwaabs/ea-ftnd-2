import { useQuery } from "@tanstack/react-query"
import { formatApiDate } from "@/lib/utils"
import type {
  ConsumptionSummaryResponse,
  ConsumptionTimeseriesResponse,
  ConsumptionBreakdownResponse,
  ConsumptionHeatmapResponse,
  ConsumptionTimeseriesIndividualResponse,
  ConsumptionMetersRankingResponse,
  MeterType,
  TopBottomConsumersResponse,
  DistrictGeometriesResponse,
  DistrictTimeseriesResponse,
} from "@/lib/types/api"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

interface ConsumptionParams {
  start_date: string
  end_date: string
  region?: string
  district?: string
  location?: string
  metering_point?: string
  boundary_metering_point?: string
  meter_type?: MeterType
}

interface BreakdownParams extends ConsumptionParams {
  group_by: "region" | "district" | "meter_type" | "metering_point" | "boundary_metering_point"
  meter_type_view?: boolean
}

interface HeatmapParams extends ConsumptionParams {
  group_by: "region" | "district" | "meter_type"
}

interface TimeseriesIndividualParams extends ConsumptionParams {
  view: "individual"
  sort_by?: string
  sort_dir?: "asc" | "desc"
  page?: number
  limit?: number
}

interface ConsumptionMetersParams extends ConsumptionParams {
  sort_by?: string
  sort_dir?: "asc" | "desc"
  page?: number
  limit?: number
}

function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) return

    if ((key === "dateFrom" || key === "dateTo" || key === "start_date" || key === "end_date") && value) {
      const formattedDate = formatApiDate(value as string)
      if (formattedDate) {
        searchParams.append(key, formattedDate)
      }
      return
    }

    // Handle arrays by joining with commas
    if (Array.isArray(value)) {
      searchParams.append(key, value.join(","))
    } else {
      searchParams.append(key, String(value))
    }
  })

  return searchParams.toString()
}

export function useConsumptionSummary(params: ConsumptionParams) {
  const queryString = buildQueryString(params)

  return useQuery<ConsumptionSummaryResponse>({
    queryKey: ["consumption-summary", queryString],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/consumption/summary?${queryString}`)
      if (!response.ok) throw new Error("Failed to fetch consumption summary")
      return response.json()
    },
    enabled: !!params.start_date && !!params.end_date,
    staleTime: 0,
    refetchOnMount: true,
  })
}

export function useConsumptionTimeseries(params: ConsumptionParams) {
  const queryString = buildQueryString(params)

  return useQuery<ConsumptionTimeseriesResponse>({
    queryKey: ["consumption-timeseries", queryString],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/consumption/timeseries?${queryString}`)
      if (!response.ok) throw new Error("Failed to fetch consumption timeseries")
      return response.json()
    },
    enabled: !!params.start_date && !!params.end_date,
    staleTime: 0,
    refetchOnMount: true,
  })
}

export function useConsumptionBreakdown(params: BreakdownParams) {
  const queryString = buildQueryString(params)

  return useQuery<ConsumptionBreakdownResponse>({
    queryKey: ["consumption-breakdown", queryString],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/consumption/breakdown?${queryString}`)
      if (!response.ok) throw new Error("Failed to fetch consumption breakdown")
      return response.json()
    },
    enabled: !!params.start_date && !!params.end_date,
    staleTime: 0,
    refetchOnMount: true,
  })
}

export function useConsumptionHeatmap(params: HeatmapParams) {
  const queryString = buildQueryString(params)

  return useQuery<ConsumptionHeatmapResponse>({
    queryKey: ["consumption-heatmap", queryString],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/consumption/heatmap?${queryString}`)
      if (!response.ok) throw new Error("Failed to fetch consumption heatmap")
      return response.json()
    },
    enabled: !!params.start_date && !!params.end_date,
    staleTime: 0,
    refetchOnMount: true,
  })
}

export function useConsumptionTimeseriesIndividual(params: TimeseriesIndividualParams) {
  const queryString = buildQueryString(params)

  return useQuery<ConsumptionTimeseriesIndividualResponse>({
    queryKey: ["consumption-timeseries-individual", queryString],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/consumption/timeseries?${queryString}`)
      if (!response.ok) throw new Error("Failed to fetch individual meter timeseries")
      return response.json()
    },
    enabled: !!params.start_date && !!params.end_date && params.view === "individual",
    staleTime: 0,
    refetchOnMount: true,
  })
}

export function useConsumptionMetersRanking(params: ConsumptionMetersParams) {
  const queryString = buildQueryString(params)

  return useQuery<ConsumptionMetersRankingResponse>({
    queryKey: ["consumption-meters-ranking", queryString],
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/consumption/meters?${queryString}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error("Failed to fetch consumption meters")
      }

      const data = await response.json()
      return data
    },
    enabled: !!params.start_date && !!params.end_date,
    staleTime: 0,
    refetchOnMount: true,
  })
}

export function useTopBottomConsumers(params: {
  dateFrom: string
  dateTo: string
  regions?: string[]
  districts?: string[]
  stations?: string[]
  boundaryMeteringPoints?: string[]
  meterTypes?: string[]
  voltages?: string[]
}) {
  console.log("[v0] useTopBottomConsumers hook called with params:", params)

  const queryString = buildQueryString({
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    region: params.regions,
    district: params.districts,
    station: params.stations,
    boundaryMeteringPoint: params.boundaryMeteringPoints,
    meter_type: params.meterTypes,
    voltage_kv: params.voltages,
  })

  console.log("[v0] Query string built:", queryString)
  console.log("[v0] Query enabled:", !!params.dateFrom && !!params.dateTo)

  return useQuery<TopBottomConsumersResponse>({
    queryKey: ["top-bottom-consumers", queryString],
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/meters/consumption/top-bottom-consumers?${queryString}`
      console.log("[v0] Fetching top/bottom consumers from:", url)
      const response = await fetch(url)

      if (!response.ok) {
        console.error("[v0] API request failed:", response.status, response.statusText)
        throw new Error("Failed to fetch top/bottom consumers")
      }

      const data = await response.json()
      console.log("[v0] API response received:", data)
      return data
    },
    enabled: !!params.dateFrom && !!params.dateTo,
    staleTime: 0,
    refetchOnMount: true,
  })
}

export function useDistrictGeometries(params: {
  region?: string
  district?: string
}) {
  const queryString = buildQueryString({
    region: params.region,
    district: params.district,
  })

  return useQuery<DistrictGeometriesResponse>({
    queryKey: ["district-geometries", queryString],
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/meters/geometries/districts?${queryString}`
      console.log("[v0] Fetching district geometries from:", url)

      try {
        const response = await fetch(url)
        console.log("[v0] District geometries response status:", response.status)
        console.log("[v0] District geometries response ok:", response.ok)

        if (!response.ok) {
          const errorText = await response.text()
          console.error("[v0] District geometries API failed:", response.status, response.statusText, errorText)
          throw new Error(`Failed to fetch district geometries: ${response.status} ${errorText}`)
        }

        const data = await response.json()
        console.log("[v0] District geometries received - success:", data?.success)
        console.log("[v0] District geometries received - districts count:", data?.data?.districts?.length)
        console.log("[v0] District geometries raw data:", JSON.stringify(data).substring(0, 500))
        return data
      } catch (error) {
        console.error("[v0] District geometries fetch error:", error)
        throw error
      }
    },
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 24 * 60 * 60 * 1000,
  })
}

export function useDistrictTimeseries(params: {
  dateFrom: string
  dateTo: string
  region?: string
  district?: string
  meterType?: string
}) {
  const queryString = buildQueryString({
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    region: params.region,
    district: params.district,
    meterType: params.meterType,
  })

  return useQuery<DistrictTimeseriesResponse>({
    queryKey: ["district-timeseries", queryString],
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/meters/consumption/districts-timeseries?${queryString}`
      console.log("[v0] Fetching district timeseries from:", url)

      try {
        const response = await fetch(url)
        console.log("[v0] District timeseries response status:", response.status)
        console.log("[v0] District timeseries response ok:", response.ok)

        if (!response.ok) {
          const errorText = await response.text()
          console.error("[v0] District timeseries API failed:", response.status, response.statusText, errorText)
          throw new Error(`Failed to fetch district timeseries: ${response.status} ${errorText}`)
        }

        const data = await response.json()
        console.log("[v0] District timeseries received - success:", data?.success)
        console.log("[v0] District timeseries received - districts count:", data?.data?.districts?.length)
        console.log("[v0] District timeseries raw data:", JSON.stringify(data).substring(0, 500))
        return data
      } catch (error) {
        console.error("[v0] District timeseries fetch error:", error)
        throw error
      }
    },
    enabled: !!params.dateFrom && !!params.dateTo,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
  })
}
