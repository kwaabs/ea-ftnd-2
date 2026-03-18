import { useQuery } from "@tanstack/react-query"
import { API_BASE_URL } from "@/lib/api-config"

interface MeterConsumption {
  consumption_date: string
  meter_number: string
  day_start_reading: number
  day_end_reading: number
  consumed_energy: number
  system_name: "import_kwh" | "export_kwh"
  location: string
  meter_type: string
}

interface MeterConsumptionParams {
  meterNumber: string
  dateFrom: string
  dateTo: string
}

export function useMeterConsumption({ meterNumber, dateFrom, dateTo }: MeterConsumptionParams) {
  return useQuery<MeterConsumption[]>({
    queryKey: ["meter-consumption", meterNumber, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({
        meterNumber,
        dateFrom,
        dateTo,
      })
      const response = await fetch(`${API_BASE_URL}/meters/consumption/daily?${params}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch meter consumption: ${response.status}`)
      }

      return response.json()
    },
    enabled: !!meterNumber && !!dateFrom && !!dateTo,
  })
}
