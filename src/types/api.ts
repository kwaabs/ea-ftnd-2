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

export type DateRangePreset = "last_week" | "last_month" | "custom"

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

export interface CustomerConsumptionAggregateItem {
  regionname?: string
  districtname?: string
  contractstatus?: string
  servicetype?: string
  serviceclass?: string
  tariffclasscode?: string
  customertype?: string
  accounttype?: string
  mda?: string
  customer_count: number
  sum_lastbillamount: number
  sum_lastbillconsumption: number | null
  sum_currentbalance: number
  data_src?: string | null
}

export interface CustomerConsumptionAggregateResponse {
  data: CustomerConsumptionAggregateItem[]
  total: number
}

export interface CustomerConsumptionDetail {
  regionname: string
  districtname: string
  servicetype: string
  serviceclass: string
  tariffclasscode: string
  tariffclassname: string
  fullname: string
  servicepointnumber: string
  accountnumber: string
  contractstatus: string
  activity: string
  subactivity: string
  customertype: string
  lastreadingvalue: number | null
  geocode: string
  plotcode: string
  ministry: string | null
  mda: string
  lastreadingdate: string | null
  lastbillamount: number
  lastbillconsumption: number | null
  lastpaymentdate: string | null
  lastpaymentamount: number | null
  currentbalance: number | null
  accounttype: string
  isamr: boolean
  ministrycode: string | null
  ministryname: string | null
  mdacode: string | null
  mdaname: string | null
  lastbilldate: string | null
  billmonth: string
  createdat: string
  data_src?: string
}

// ─────────────────────────────────────────────────
// MMS Customer Sales Types
// ─────────────────────────────────────────────────

export interface MmsCustomerSalesAggregateItem {
  data_src: string
  region?: string | null
  district?: string | null
  contract_type?: string | null
  tariff?: string | null
  manufacturer?: string | null
  model?: string | null
  customer_count: number
  sum_credit_balance_remaining: number
  sum_last_month_credit_read: number
  sum_last_month_kwh_read: number | null
}

export interface MmsCustomerSalesAggregateResponse {
  data: MmsCustomerSalesAggregateItem[]
  total: number
}

export interface MmsCustomerSalesDetail {
  meter_number: string
  manufacturer: string
  model: string
  installation_date: string
  removal_date: string | null
  customer_name: string
  contract_code: string
  contract_type: string
  service_commencement_date: string
  service_termination_date: string | null
  account_number: string
  tariff: string
  usage_point: string
  geocode: string
  region: string
  district: string
  address: string
  latitude: number | null
  longitude: number | null
  meter_serial_number: string
  sts_credit_balance_remaining: number
  sts_last_month_credit_read: number
  sts_last_month_kwh_read: number
  date_time: string
  data_src: string
}

export interface MmsCustomerSalesDetailResponse {
  data: MmsCustomerSalesDetail[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export interface CustomerConsumptionDetailResponse {
  data: CustomerConsumptionDetail[]
  total: number
  page: number
  limit: number
  total_pages: number
}

// ─────────────────────────────────────────────────
// AMR Consumption Types (Automated Meter Reading)
// ─────────────────────────────────────────────────

export interface AmrConsumptionAggregateItem {
  group_period: string
  system_name: "export_kwh" | "import_kwh"
  region: string
  district?: string
  community?: string
  tariff_class?: string
  customer_type?: string
  slt_type?: string
  total_consumption: number
  active_meters: number
  total_meter_count: number
  data_src?: "AMR"
}

export interface AmrConsumptionAggregateResponse {
  data: AmrConsumptionAggregateItem[]
}

export interface AmrConsumptionDaily {
  consumption_date: string
  meter_number: string
  day_start_reading: number
  day_end_reading: number
  consumed_energy: number
  system_name: "export_kwh" | "import_kwh"
  region: string
  district: string
  community: string
  customer_name: string
  account_no: string
  spn: string
  tariff_class: string
  customer_type: string
  account_type: string
  contract_status: string
  meter_phase: string
  service_type: string
  slt_type: string
  multiply_factor: number
  data_src?: "AMR"
}

export interface AmrConsumptionDailyResponse {
  data: AmrConsumptionDaily[]
  page?: number
  limit?: number
  total?: number
  total_pages?: number
}
