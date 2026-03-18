// API Type Definitions for Dashboard App

export type MeterType = "DTX" | "FEEDERS_TRAFO" | "REGIONAL_BOUNDARY" | "DISTRICT_BOUNDARY" | "STANDARD"

export interface ConsumptionSummaryResponse {
  success: boolean
  data: {
    total_import_kwh: number
    total_export_kwh: number
    net_kwh: number
    active_meters: number
    total_meters: number
    date_range: {
      from: string
      to: string
    }
  }
}

export interface ConsumptionTimeseriesResponse {
  success: boolean
  data: {
    timeseries: Array<{
      date: string
      import_kwh: number
      export_kwh: number
      net_kwh: number
      meter_count: number
    }>
    date_range: {
      from: string
      to: string
    }
  }
}

export interface ConsumptionBreakdownResponse {
  success: boolean
  data: {
    breakdown: Array<{
      group_key: string
      import_kwh: number
      export_kwh: number
      net_kwh: number
      meter_count: number
    }>
    group_by: string
  }
}

export interface ConsumptionHeatmapResponse {
  success: boolean
  data: {
    heatmap: Array<{
      group_key: string
      date: string
      import_kwh: number
      export_kwh: number
      meter_count: number
    }>
    group_by: string
  }
}

export interface ConsumptionTimeseriesIndividualResponse {
  success: boolean
  data: {
    meters: Array<{
      meter_number: string
      meter_type: string
      region: string
      timeseries: Array<{
        date: string
        import_kwh: number
        export_kwh: number
      }>
    }>
    pagination: {
      page: number
      limit: number
      total: number
      total_pages: number
    }
  }
}

export interface ConsumptionMetersRankingResponse {
  success: boolean
  data: {
    meters: Array<{
      meter_number: string
      meter_type: string
      region: string
      district?: string
      total_import_kwh: number
      total_export_kwh: number
      net_kwh: number
      avg_daily_consumption: number
    }>
    pagination: {
      page: number
      limit: number
      total: number
      total_pages: number
    }
  }
}

export interface TopBottomConsumersResponse {
  success: boolean
  data: {
    top_consumers: Array<{
      meter_number: string
      meter_type: string
      region: string
      district?: string
      station?: string
      total_consumption: number
      rank: number
    }>
    bottom_consumers: Array<{
      meter_number: string
      meter_type: string
      region: string
      district?: string
      station?: string
      total_consumption: number
      rank: number
    }>
  }
}

export interface DistrictGeometriesResponse {
  success: boolean
  data: {
    districts: Array<{
      district_name: string
      region: string
      geometry: {
        type: string
        coordinates: number[][][]
      }
      center: {
        lat: number
        lng: number
      }
      bounds: {
        north: number
        south: number
        east: number
        west: number
      }
    }>
  }
}

export interface DistrictTimeseriesResponse {
  success: boolean
  data: {
    districts: Array<{
      district_name: string
      region: string
      timeseries: Array<{
        date: string
        import_kwh: number
        export_kwh: number
        meter_count: number
      }>
    }>
  }
}

export interface MeterReadingsResponse {
  success: boolean
  data: {
    meter_number: string
    readings: Array<{
      date: string
      import_kwh: number
      export_kwh: number
      day_start_reading: number
      day_end_reading: number
    }>
  }
}

export interface MetersResponse {
  success: boolean
  data: {
    data: Meter[]
    meta: {
      page: number
      limit: number
      total: number
      pages: number
    }
  }
}

export interface Meter {
  id: string
  meter_number: string
  meter_type: MeterType
  region: string
  district?: string
  station?: string
  location?: string
  boundary_metering_point?: string
  voltage_kv?: number
  status: "online" | "offline"
  last_reading_date?: string
  created_at: string
  updated_at: string
}

export interface MeterHealthSummaryResponse {
  success: boolean
  data: {
    excellent: number
    good: number
    fair: number
    poor: number
    critical: number
    total: number
    avg_health_score: number
  }
}

export interface MeterHealthDetailsResponse {
  success: boolean
  data: {
    meters: Array<{
      meter_number: string
      meter_type: string
      region: string
      district?: string
      station?: string
      health_category: string
      health_score: number
      uptime_percentage: number
      total_consumption_kwh: number
    }>
    pagination: {
      page: number
      limit: number
      total: number
      total_pages: number
    }
  }
}
