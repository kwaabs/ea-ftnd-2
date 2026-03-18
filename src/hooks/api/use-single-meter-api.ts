import { useQuery } from "@tanstack/react-query"
import { API_BASE_URL } from "@/lib/api-config"
import type { Meter } from "@/lib/types/api"

interface SingleMeterResponse {
  data: {
    data: Meter[]
    meta: {
      filters: Record<string, any>
      limit: number
      page: number
      pages: number
      total: number
    }
  }
}

export function useSingleMeter(meterNumber: string) {
  return useQuery<Meter | null>({
    queryKey: ["single-meter", meterNumber],
    queryFn: async () => {
      const params = new URLSearchParams({ search: meterNumber })
      const response = await fetch(`${API_BASE_URL}/meters?${params}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch meter: ${response.status}`)
      }

      const data: SingleMeterResponse = await response.json()
      
      // Return first meter from results or null
      return data.data.data[0] || null
    },
    enabled: !!meterNumber,
  })
}
