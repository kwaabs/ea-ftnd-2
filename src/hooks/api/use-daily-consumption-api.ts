import { useQuery } from "@tanstack/react-query"
import { formatApiDate } from "@/lib/utils"

interface DailyConsumptionRecord {
  consumption_date: string
  meter_number: string
  day_start_reading: number
  day_end_reading: number
  consumed_energy: number
  system_name: "import_kwh" | "export_kwh"
  region: string
  multiply_factor?: number
  meter_type: string
  district?: string
  station?: string
  boundary_metering_point?: string
  voltage_kv?: number
}

interface MeterRanking {
  meter_number: string
  region: string
  meter_type: string
  district?: string
  station?: string
  total_import_kwh: number
  total_export_kwh: number
  net_kwh: number
  avg_daily_import: number
  avg_daily_export: number
  days_count: number
  import_rank?: number
  export_rank?: number
}

interface DailyConsumptionParams {
  dateFrom?: string
  dateTo?: string
  region?: string | string[]
  district?: string | string[]
  station?: string | string[]
  boundaryMeteringPoint?: string | string[]
  meterType?: string | string[]
  voltage_kv?: number | number[]
  meterNumber?: string
  regions?: string[]
  districts?: string[]
  stations?: string[]
  boundaryMeteringPoints?: string[]
  meterTypes?: string[]
  voltages?: number[]
}

interface DailyConsumptionResult {
  rankings: MeterRanking[]
  rawData: DailyConsumptionRecord[]
}

function buildQueryString(params: DailyConsumptionParams): string {
  const queryParams = new URLSearchParams()

  if (params.dateFrom) queryParams.append("dateFrom", formatApiDate(params.dateFrom))
  if (params.dateTo) queryParams.append("dateTo", formatApiDate(params.dateTo))

  // Handle both singular and plural param names, and arrays by joining with commas
  const region = params.regions || params.region
  if (region) {
    const value = Array.isArray(region) ? region.join(",") : region
    if (value) queryParams.append("region", value)
  }
  
  const district = params.districts || params.district
  if (district) {
    const value = Array.isArray(district) ? district.join(",") : district
    if (value) queryParams.append("district", value)
  }
  
  const station = params.stations || params.station
  if (station) {
    const value = Array.isArray(station) ? station.join(",") : station
    if (value) queryParams.append("station", value)
  }
  
  const boundaryMeteringPoint = params.boundaryMeteringPoints || params.boundaryMeteringPoint
  if (boundaryMeteringPoint) {
    const value = Array.isArray(boundaryMeteringPoint) ? boundaryMeteringPoint.join(",") : boundaryMeteringPoint
    if (value) queryParams.append("boundaryMeteringPoint", value)
  }
  
  const meterType = params.meterTypes || params.meterType
  if (meterType) {
    const value = Array.isArray(meterType) ? meterType.join(",") : meterType
    if (value) queryParams.append("meterType", value)
  }
  
  const voltage = params.voltages || params.voltage_kv
  if (voltage) {
    const value = Array.isArray(voltage) ? voltage.join(",") : voltage.toString()
    if (value) queryParams.append("voltage_kv", value)
  }
  
  if (params.meterNumber) queryParams.append("meterNumber", params.meterNumber)

  return queryParams.toString()
}

function processDailyConsumption(data: DailyConsumptionRecord[]): MeterRanking[] {
  if (!Array.isArray(data) || data.length === 0) {
    return []
  }

  // Group by meter_number
  const meterMap = new Map<
    string,
    {
      meter_number: string
      region: string
      meter_type: string
      district?: string
      station?: string
      import_kwh: number
      export_kwh: number
      dates: Set<string>
    }
  >()

  data.forEach((record) => {
    const { meter_number, region, meter_type, district, station, consumed_energy, system_name, consumption_date } =
      record

    if (!meterMap.has(meter_number)) {
      meterMap.set(meter_number, {
        meter_number,
        region,
        meter_type,
        district,
        station,
        import_kwh: 0,
        export_kwh: 0,
        dates: new Set(),
      })
    }

    const meterData = meterMap.get(meter_number)!
    meterData.dates.add(consumption_date.split("T")[0])

    if (system_name === "import_kwh") {
      meterData.import_kwh += consumed_energy
    } else if (system_name === "export_kwh") {
      meterData.export_kwh += consumed_energy
    }
  })

  // Convert to array and calculate metrics
  const rankings: MeterRanking[] = Array.from(meterMap.values()).map((meter) => ({
    meter_number: meter.meter_number,
    region: meter.region,
    meter_type: meter.meter_type,
    district: meter.district,
    station: meter.station,
    total_import_kwh: meter.import_kwh,
    total_export_kwh: meter.export_kwh,
    net_kwh: meter.import_kwh - meter.export_kwh,
    days_count: meter.dates.size,
    avg_daily_import: meter.dates.size > 0 ? meter.import_kwh / meter.dates.size : 0,
    avg_daily_export: meter.dates.size > 0 ? meter.export_kwh / meter.dates.size : 0,
  }))

  // Sort by import and assign import ranks
  const sortedByImport = [...rankings].sort((a, b) => b.total_import_kwh - a.total_import_kwh)
  sortedByImport.forEach((meter, index) => {
    if (meter.total_import_kwh > 0) {
      meter.import_rank = index + 1
    }
  })

  // Sort by export and assign export ranks
  const sortedByExport = [...rankings].sort((a, b) => b.total_export_kwh - a.total_export_kwh)
  sortedByExport.forEach((meter, index) => {
    if (meter.total_export_kwh > 0) {
      meter.export_rank = index + 1
    }
  })

  return rankings
}

export function useDailyConsumption(params: DailyConsumptionParams) {
  const queryString = buildQueryString(params)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

  console.log("[v0] useDailyConsumption params:", params)
  console.log("[v0] useDailyConsumption URL:", `${apiUrl}/api/v1/meters/consumption/daily?${queryString}`)

  return useQuery<DailyConsumptionResult>({
    queryKey: [
      "daily-consumption",
      params.dateFrom,
      params.dateTo,
      // Use stable serialization for arrays
      (() => { const v = params.regions || params.region; return v ? (Array.isArray(v) ? v.sort().join(",") : v) : "" })(),
      (() => { const v = params.districts || params.district; return v ? (Array.isArray(v) ? v.sort().join(",") : v) : "" })(),
      (() => { const v = params.stations || params.station; return v ? (Array.isArray(v) ? v.sort().join(",") : v) : "" })(),
      (() => { const v = params.boundaryMeteringPoints || params.boundaryMeteringPoint; return v ? (Array.isArray(v) ? v.sort().join(",") : v) : "" })(),
      (() => { const v = params.meterTypes || params.meterType; return v ? (Array.isArray(v) ? v.sort().join(",") : v) : "" })(),
      (() => { const v = params.voltages || params.voltage_kv; return v ? (Array.isArray(v) ? v.sort().join(",") : String(v)) : "" })(),
      params.meterNumber || "",
    ],
    queryFn: async () => {
      const response = await fetch(`${apiUrl}/api/v1/meters/consumption/daily?${queryString}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch daily consumption: ${response.statusText}`)
      }

      const data: DailyConsumptionRecord[] = await response.json()
      console.log("[v0] useDailyConsumption raw data count:", data?.length)

      const processed = processDailyConsumption(data)
      console.log("[v0] useDailyConsumption processed rankings count:", processed?.length)

      return {
        rankings: processed,
        rawData: data,
      }
    },
    enabled: !!params.dateFrom && !!params.dateTo,
  })
}
