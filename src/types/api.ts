// API Response Types for Electric Energy Accounting

export interface ConsumptionMeter {
  meter_number: string
  meter_type: string
  location: string
  region: string
  district: string
  metering_point: string
  incomer: string
  total_import_kwh: number
  total_export_kwh: number
  total_readings: number
  days_with_data: number
  avg_daily_import_kwh: number
  contribution_pct: number
}

export interface ConsumptionMetersResponse {
  filters: {
    start_date: string
    end_date: string
    region?: string
    meter_type?: string
  }
  data: ConsumptionMeter[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
  }
}

export interface ConsumptionSummary {
  total_import_kwh: number
  total_export_kwh: number
  total_import_kvah: number
  total_export_kvah: number
  net_consumption_kwh: number
  meter_count: number
  total_readings: number
  avg_daily_import_kwh: number
  peak_daily_import_kwh: number
  peak_date: string
}

export interface ConsumptionSummaryResponse {
  filters: {
    start_date: string
    end_date: string
    region?: string
    district?: string
    location?: string
    metering_point?: string
    boundary_metering_point?: string
    meter_type?: string
  }
  summary: ConsumptionSummary
}

export interface TimeseriesDataPoint {
  date: string
  import_kwh: number
  export_kwh: number
  net_kwh: number
  meter_count: number
  reading_count: number
}

export interface ConsumptionTimeseriesResponse {
  filters: {
    start_date: string
    end_date: string
    region?: string
    district?: string
    location?: string
    metering_point?: string
    boundary_metering_point?: string
    meter_type?: string
    group_by?: string
  }
  timeseries?: TimeseriesDataPoint[]
  aggregated?: TimeseriesDataPoint[]
}

export interface IndividualMeterTimeseries {
  date: string
  daily_import_kwh: number
  daily_export_kwh: number
  reading_count: number
}

export interface IndividualMeterData {
  meter_number: string
  meter_type: string
  location: string
  region: string
  district: string
  total_import_kwh: number
  total_export_kwh: number
  avg_daily_import_kwh: number
  days_with_data: number
  timeseries: IndividualMeterTimeseries[]
}

export interface ConsumptionTimeseriesIndividualResponse {
  view: "individual"
  filters: {
    start_date: string
    end_date: string
    region?: string
    district?: string
    location?: string
    meter_type?: string
  }
  individual: IndividualMeterData[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
  }
}

export interface ConsumptionTimeseriesAggregatedResponse {
  view: "aggregated"
  filters: {
    start_date: string
    end_date: string
    region?: string
    district?: string
    location?: string
    metering_point?: string
    boundary_metering_point?: string
    meter_type?: string
  }
  aggregated: TimeseriesDataPoint[]
}

export interface BreakdownItem {
  group_value: string
  import_kwh: number
  export_kwh: number
  net_kwh: number
  meter_count: number
  percentage: number
}

export interface ConsumptionBreakdownResponse {
  filters: {
    start_date: string
    end_date: string
    region?: string
    district?: string
    location?: string
    metering_point?: string
    boundary_metering_point?: string
    meter_type?: string
    group_by: string
  }
  breakdown: BreakdownItem[]
}

export interface HeatmapDataPoint {
  date: string
  values: Record<string, number>
}

export interface ConsumptionHeatmapResponse {
  filters: {
    start_date: string
    end_date: string
    region?: string
    district?: string
    location?: string
    metering_point?: string
    boundary_metering_point?: string
    meter_type?: string
    group_by: string
  }
  groups: string[]
  heatmap: HeatmapDataPoint[]
}

export type MeterType =
  | "BSP"
  | "PSS"
  | "Switching Station"
  | "Regional Boundary Metering"
  | "District Boundary Metering"
  | "Distribution Transformers"

export type DateRangePreset = "last_day" | "last_week" | "last_month" | "custom"

export interface MeterDetails {
  id: string
  meter_number: string
  meter_type: string
  spn: string
  meter_brand: string
  location: string
  digital_address: string
  status: string
  metering_point: string
  incomer: string
  region: string
  created_at: string
  updated_at: string
}

export type MeterDetailsResponse = Meter

export interface MeterDailyReading {
  day: string
  daily_import_kwh: number
  daily_export_kwh: number
  daily_import_kvah: number
  daily_export_kvah: number
  reading_count: number
  poor_quality_count: number
  first_reading: string
  last_reading: string
  import_kwh_start: number
  import_kwh_end: number
  export_kwh_start: number
  export_kwh_end: number
}

export type MeterReadingsResponse = MeterDailyReading[]

export interface Meter {
  id: string
  meter_number: string
  meter_type: string
  spn: string
  meter_brand: string
  location: string
  digital_address: string
  status: string
  metering_point: string
  incomer: string
  region: string
  latitude: number | null
  longitude: number | null
  district?: string
  station?: string
  feeder_panel_name?: string
  voltage_kv?: string
  ic_og?: "IC" | "OG"
  created_at: string
  updated_at: string
}

export interface MetersResponse {
  data: Meter[]
  pagination: {
    total: number
    page: number
    limit: number
    total_pages: number
  }
}

export type ConsumptionMetersRankingResponse = ConsumptionMetersResponse

export interface TopBottomConsumer {
  meter_number: string
  meter_type: string
  location: string
  region: string
  district?: string
  station?: string
  metering_point: string
  feeder_panel_name?: string
  voltage_kv?: string
  total_import_kwh: number
  total_export_kwh: number
  reading_count: number
}

export interface MeterTypeTopBottomConsumers {
  meter_type: string
  meter_count: number
  top_import_consumer: TopBottomConsumer
  bottom_import_consumer: TopBottomConsumer
  top_export_consumer: TopBottomConsumer
  bottom_export_consumer: TopBottomConsumer
}

export type TopBottomConsumersResponse = MeterTypeTopBottomConsumers[]

export interface MeterHealthSummary {
  total_meters: number
  online_meters: number
  offline_meters: number
  health_percentage: number
  average_uptime_percentage: number
  by_meter_type: Array<{
    meter_type: string
    total: number
    online: number
    offline: number
    avg_uptime: number
  }>
  uptime_distribution: {
    excellent: number
    good: number
    poor: number
    critical: number
  }
}

export interface MeterHealthSummaryResponse {
  success: boolean
  data: MeterHealthSummary
}

export interface MeterHealthDetail {
  meter_number: string
  meter_type: string
  region: string
  district: string | null
  station: string
  location: string
  status: "ONLINE" | "OFFLINE"
  health_category: "Excellent" | "Good" | "Poor" | "Critical"
  uptime_percentage: number
  days_online: number
  days_offline: number
  last_seen: string
  total_consumption_kwh: number
}

export interface MeterHealthDetailsResponse {
  success: boolean
  summary: MeterHealthSummary
  data: MeterHealthDetail[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
  }
}

export interface DistrictGeometry {
  district: string
  region: string
  center_lat: number
  center_lng: number
  geojson: {
    type: "Feature"
    properties: {
      district: string
      region: string
    }
    geometry: {
      type: "Polygon"
      coordinates: number[][][]
    }
  }
}

export interface DistrictGeometriesResponse {
  success: boolean
  version: string
  data: {
    districts: DistrictGeometry[]
  }
}

export interface DistrictTimeseriesDataPoint {
  timestamp: string
  total_import_kwh: number
  total_export_kwh: number
  net_consumption_kwh: number
}

export interface DistrictTimeseries {
  district: string
  region: string
  timeseries: DistrictTimeseriesDataPoint[]
}

export interface DistrictTimeseriesResponse {
  success: boolean
  data: {
    districts: DistrictTimeseries[]
  }
}

export interface DistrictMapData {
  district: string
  region: string
  geojson: {
    type: "Feature"
    properties: {
      name: string
      region: string
    }
    geometry: {
      type: "Polygon"
      coordinates: number[][][]
    }
  }
  timeseries: DistrictTimeseriesDataPoint[]
}

export interface RegionalMapResponse {
  success: boolean
  data: {
    districts: DistrictMapData[]
  }
}
