// "BSP Imports" sheet (Report Builder Excel export) — a fixed, always-
// included sheet (same spirit as combined-sales.ts's "Combined" sheet),
// independent of whatever blocks are on the canvas. Kept separate from
// combined-sales.ts rather than folded into it: BSP incomer meters are
// grouped by region + STATION, not region + district like every sales
// source, so there's no shared row key to match them up against — this
// gets its own Region (subtotal) + Station layout instead.
//
// The BSP aggregate endpoint (unlike every other aggregate endpoint in
// this app) returns a raw, ungrouped-by-time array -- one row per
// (meter_type, region, station, day), via its group_period field -- not
// a {data: [...]} envelope. So this needs its own fetch rather than
// reusing combined-sales.ts's fetchJson, but it also means only ONE
// request covers the whole date range; the month breakdown is a client-
// side bucket of group_period, not N sequential per-month fetches like
// combined-sales.ts needs for sources whose aggregate endpoints have no
// day-level rows to bucket from.
import { fetchWithTimeout } from "@/lib/utils"
import { normalizeRegionName, shortRegionLabel } from "@/hooks/use-resolved-region-name"
import type { CombinedSalesFilters } from "@/lib/report-builder/combined-sales"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

interface RawBspRow {
  system_name: "import_kwh" | "export_kwh"
  region: string
  station: string
  meter_type: string
  group_period: string
  total_consumption: number
}

async function fetchBspRaw(filters: CombinedSalesFilters): Promise<RawBspRow[]> {
  const qs = new URLSearchParams({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    meterType: "BSP",
    group: "meter_type,region,station",
    ...(filters.region ? { region: filters.region } : {}),
    ...(filters.district ? { district: filters.district } : {}),
  })
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/meters/consumption/aggregate/bsp?${qs.toString()}`, 100000)
  if (!res.ok) throw new Error(`BSP aggregate failed: ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? (data as RawBspRow[]) : []
}

function monthInfoFromIso(iso: string): { label: string; sortKey: number } {
  const d = new Date(iso)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  return {
    label: new Date(Date.UTC(y, m, 1)).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
    sortKey: y * 100 + m,
  }
}

export interface BspStationRow {
  label: string
  importKwh: number
  exportKwh: number
  netKwh: number
}

export interface BspRegionRow {
  label: string
  importKwh: number
  exportKwh: number
  netKwh: number
  stations: BspStationRow[]
}

export interface MonthlyBspImports {
  month: string
  regions: BspRegionRow[]
}

export async function fetchBspImportsMonthly(filters: CombinedSalesFilters): Promise<MonthlyBspImports[]> {
  const raw = await fetchBspRaw(filters).catch((err) => {
    console.error("BSP imports: fetch failed", err)
    return [] as RawBspRow[]
  })

  interface StationAgg {
    label: string
    importKwh: number
    exportKwh: number
  }
  interface RegionAgg {
    label: string
    stations: Map<string, StationAgg>
  }
  const byMonth = new Map<number, { label: string; regions: Map<string, RegionAgg> }>()

  raw.forEach((row) => {
    if (row.meter_type !== "BSP") return
    if (row.system_name !== "import_kwh" && row.system_name !== "export_kwh") return

    const { label: monthLabel, sortKey } = monthInfoFromIso(row.group_period)
    let monthBucket = byMonth.get(sortKey)
    if (!monthBucket) {
      monthBucket = { label: monthLabel, regions: new Map() }
      byMonth.set(sortKey, monthBucket)
    }

    const regionRaw = row.region || "Unknown"
    const regionKey = normalizeRegionName(regionRaw)
    let region = monthBucket.regions.get(regionKey)
    if (!region) {
      region = { label: shortRegionLabel(regionRaw), stations: new Map() }
      monthBucket.regions.set(regionKey, region)
    }

    const stationRaw = row.station || "Unknown"
    const stationKey = stationRaw.trim().toLowerCase()
    let station = region.stations.get(stationKey)
    if (!station) {
      station = { label: stationRaw, importKwh: 0, exportKwh: 0 }
      region.stations.set(stationKey, station)
    }

    if (row.system_name === "import_kwh") station.importKwh += row.total_consumption || 0
    else station.exportKwh += row.total_consumption || 0
  })

  return Array.from(byMonth.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, monthBucket]) => {
      const regions: BspRegionRow[] = Array.from(monthBucket.regions.values())
        .map((region) => {
          const stations: BspStationRow[] = Array.from(region.stations.values())
            .map((s) => ({ label: s.label, importKwh: s.importKwh, exportKwh: s.exportKwh, netKwh: s.importKwh - s.exportKwh }))
            .sort((a, b) => b.importKwh - a.importKwh)
          const importKwh = stations.reduce((s, x) => s + x.importKwh, 0)
          const exportKwh = stations.reduce((s, x) => s + x.exportKwh, 0)
          return { label: region.label, importKwh, exportKwh, netKwh: importKwh - exportKwh, stations }
        })
        .sort((a, b) => b.importKwh - a.importKwh)
      return { month: monthBucket.label, regions }
    })
}
