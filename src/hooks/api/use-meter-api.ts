import { useQuery } from "@tanstack/react-query"
import { formatApiDate } from "@/lib/utils"
import type {
  MeterReadingsResponse,
  MeterType,
  MetersResponse, // Import new MetersResponse type
  Meter, // Import new Meter type
} from "@/lib/types/api"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

interface MetersParams {
  region?: string
  district?: string
  meter_type?: MeterType
  boundary_metering_point?: string
  status?: string
  search?: string // Added search parameter for meter number filtering
  sort_by?: string
  sort_dir?: "asc" | "desc"
  page?: number
  limit?: number
}

interface MeterReadingsParams {
  meter_number: string
  start_date: string
  end_date: string
}

function buildQueryString(params: Record<string, any> | null | undefined): string {
  if (!params) return ""
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") return

    if ((key === "start_date" || key === "end_date") && value) {
      const formattedDate = formatApiDate(value as string)
      if (formattedDate) {
        searchParams.append(key, formattedDate)
      }
      return
    }

    searchParams.append(key, String(value))
  })

  return searchParams.toString()
}

export function useMeters(params: MetersParams | null = {}) {
  const queryString = buildQueryString(params ?? {})

  return useQuery<MetersResponse>({
    queryKey: ["meters", queryString],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/meters?${queryString}`)
      if (!response.ok) throw new Error("Failed to fetch meters")
      return response.json()
    },
    enabled: params !== null,
    staleTime: 30 * 1000,
    refetchOnMount: true,
  })
}

export function useMeterDetails(id: string) {
  return useQuery<Meter>({
    queryKey: ["meter-details", id],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/meters/${id}`)
      if (!response.ok) throw new Error("Failed to fetch meter details")
      return response.json()
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes - meter details don't change often
  })
}

export function useMeterReadings(params: MeterReadingsParams) {
  const queryString = buildQueryString({ start_date: params.start_date, end_date: params.end_date })

  return useQuery<MeterReadingsResponse>({
    queryKey: ["meter-readings", params.meter_number, queryString],
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/vi/meters/${params.meter_number}/readings/daily?${queryString}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error("Failed to fetch meter readings")
      }

      const data = await response.json()
      return data
    },
    enabled: !!params.meter_number && !!params.start_date && !!params.end_date,
    staleTime: 0,
    refetchOnMount: true,
  })
}
