// "Combined" sheet (Report Builder Excel export) — every region/district-
// having sales source matched up side by side in one table, rather than
// one sheet per source. Deliberately NOT built from whatever blocks
// happen to be on the canvas: this is a fixed set of 9 sources, fetched
// directly here regardless of what the user has dragged on. The sources
// left out (PNS, Alpha, BSP, Meter Health) have no real region/district
// to join on -- PNS's region/district are opaque codes with no name
// lookup, Alpha has neither, and BSP/Meter Health are meter-status/health
// figures, not sales.
//
// Plain fetch(), not React Query hooks: this only ever runs once, at
// "Export as Excel" click time, not on every render -- there's nothing to
// cache or keep live, so a hook (and the rules-of-hooks gymnastics
// use-report-builder-data.ts needs) would be pure overhead here.
import { fetchWithTimeout } from "@/lib/utils"
import { normalizeRegionName, shortRegionLabel } from "@/hooks/use-resolved-region-name"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

export interface CombinedSalesFilters {
  dateFrom: string
  dateTo: string
  region?: string
  district?: string
}

interface RawRow {
  region: string
  district: string
  kwh: number
}

async function fetchJson(url: string): Promise<{ data?: unknown[] }> {
  const res = await fetchWithTimeout(url, 100000)
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json()
}

async function fetchZeus(filters: CombinedSalesFilters, extraParams: Record<string, string>): Promise<RawRow[]> {
  const qs = new URLSearchParams({
    billDateFrom: filters.dateFrom,
    billDateTo: filters.dateTo,
    groupBy: "regionname,districtname",
    ...(filters.region ? { region: filters.region } : {}),
    ...(filters.district ? { district: filters.district } : {}),
    ...extraParams,
  })
  const json = await fetchJson(`${API_BASE_URL}/api/v1/meters/consumption/zeus-billing/aggregate?${qs.toString()}`)
  return (json.data || []).map((r) => {
    const row = r as { regionname?: string | null; districtname?: string | null; sum_billconsumptionvalue?: number | null }
    return { region: row.regionname || "", district: row.districtname || "", kwh: row.sum_billconsumptionvalue || 0 }
  })
}

async function fetchSimple(path: string, filters: CombinedSalesFilters, kwhField: string): Promise<RawRow[]> {
  const qs = new URLSearchParams({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    groupBy: "region,district",
    ...(filters.region ? { region: filters.region } : {}),
    ...(filters.district ? { district: filters.district } : {}),
  })
  const json = await fetchJson(`${API_BASE_URL}${path}?${qs.toString()}`)
  return (json.data || []).map((r) => {
    const row = r as Record<string, unknown>
    return {
      region: (row.region as string | null) || "",
      district: (row.district as string | null) || "",
      kwh: (row[kwhField] as number | null) || 0,
    }
  })
}

interface CombinedSourceDef {
  key: string
  label: string
  fetch: (filters: CombinedSalesFilters) => Promise<RawRow[]>
}

const COMBINED_SOURCES: CombinedSourceDef[] = [
  { key: "zeus-postpaid", label: "Zeus — Non-AMR Postpaid", fetch: (f) => fetchZeus(f, { meterModelType: "Postpaid" }) },
  { key: "zeus-amr", label: "Zeus — AMR Postpaid", fetch: (f) => fetchZeus(f, { meterModelType: "AMR" }) },
  // Deduped against MMS (excludeMmsDuplicates) -- same precedence rule as
  // every other Postpaid/Prepaid combined figure in this app: a meter MMS
  // already has is counted from MMS, not from Zeus, so this and MMS below
  // never double-count the same meter's kWh.
  { key: "zeus-prepaid", label: "Zeus — Prepaid", fetch: (f) => fetchZeus(f, { meterModelType: "Prepaid", excludeMmsDuplicates: "true" }) },
  { key: "streetlighting", label: "Streetlighting", fetch: (f) => fetchZeus(f, { tariffClassCode: "E03" }) },
  { key: "mms", label: "MMS", fetch: (f) => fetchSimple("/api/v1/meters/consumption/mms-customer-sales/aggregate", f, "sum_last_month_kwh_read") },
  { key: "bot", label: "BOT", fetch: (f) => fetchSimple("/api/v1/meters/consumption/bot-consumption/aggregate", f, "sum_kwh") },
  { key: "bxc", label: "BXC", fetch: (f) => fetchSimple("/api/v1/meters/consumption/bxc-consumption/aggregate", f, "sum_kwh") },
  { key: "holley", label: "Holley", fetch: (f) => fetchSimple("/api/v1/meters/consumption/holley-consumption/aggregate", f, "sum_kwh") },
  { key: "ecash4", label: "ECASH 4", fetch: (f) => fetchSimple("/api/v1/meters/consumption/ecash4-consumption/aggregate", f, "sum_kwh") },
]

export interface CombinedDistrictRow {
  label: string
  bySource: Record<string, number>
  total: number
}

export interface CombinedRegionRow {
  label: string
  bySource: Record<string, number>
  total: number
  districts: CombinedDistrictRow[]
}

export interface CombinedSalesResult {
  sources: { key: string; label: string }[]
  regions: CombinedRegionRow[]
}

export async function fetchCombinedSalesByRegionDistrict(filters: CombinedSalesFilters): Promise<CombinedSalesResult> {
  const perSource = await Promise.all(
    COMBINED_SOURCES.map((s) =>
      s.fetch(filters).catch((err) => {
        console.error(`Combined sales: ${s.label} failed`, err)
        return [] as RawRow[]
      }),
    ),
  )

  interface Bucket {
    label: string
    districts: Map<string, { label: string; bySource: Record<string, number> }>
  }
  const regionMap = new Map<string, Bucket>()

  COMBINED_SOURCES.forEach((source, i) => {
    perSource[i].forEach((row) => {
      const regionRaw = row.region || "Unknown"
      const districtRaw = row.district || "Unknown"
      const regionKey = normalizeRegionName(regionRaw)
      const districtKey = normalizeRegionName(districtRaw)

      let region = regionMap.get(regionKey)
      if (!region) {
        region = { label: shortRegionLabel(regionRaw), districts: new Map() }
        regionMap.set(regionKey, region)
      }
      let district = region.districts.get(districtKey)
      if (!district) {
        district = { label: shortRegionLabel(districtRaw), bySource: {} }
        region.districts.set(districtKey, district)
      }
      district.bySource[source.key] = (district.bySource[source.key] || 0) + row.kwh
    })
  })

  const regions: CombinedRegionRow[] = Array.from(regionMap.values())
    .map((region) => {
      const districts: CombinedDistrictRow[] = Array.from(region.districts.values())
        .map((d) => {
          const total = COMBINED_SOURCES.reduce((s, src) => s + (d.bySource[src.key] || 0), 0)
          return { label: d.label, bySource: d.bySource, total }
        })
        .sort((a, b) => b.total - a.total)

      const bySource: Record<string, number> = {}
      COMBINED_SOURCES.forEach((src) => {
        bySource[src.key] = districts.reduce((s, d) => s + (d.bySource[src.key] || 0), 0)
      })
      const total = districts.reduce((s, d) => s + d.total, 0)
      return { label: region.label, bySource, total, districts }
    })
    .sort((a, b) => b.total - a.total)

  return { sources: COMBINED_SOURCES.map((s) => ({ key: s.key, label: s.label })), regions }
}
