// "BSP Imports" sheet (Report Builder Excel export) — a fixed, always-
// included sheet (same spirit as combined-sales.ts's "Combined" sheet),
// independent of whatever blocks are on the canvas. Kept separate from
// combined-sales.ts rather than folded into it: BSP incomer meters are
// grouped by region + STATION (+ now meter number), not region + district
// like every sales source, so there's no shared row key to match them up
// against -- this gets its own Region -> Station -> Meter layout instead.
//
// Meter-level rows come from TWO sources, not one:
//   1. The meter roster (GET /api/v1/meters?meter_type=BSP) -- the
//      infrastructure list of every BSP meter that exists, independent of
//      whether it reported any consumption. This is what guarantees every
//      meter shows up, with 0s, even for a month it reported nothing.
//   2. The BSP daily consumption endpoint -- real per-meter-per-day
//      import/export kWh, bucketed into months client-side the same way
//      the region/station version buckets group_period.
// A meter in the consumption data but missing from the roster (shouldn't
// happen, but seen elsewhere in this app as a real possibility) still
// gets a row, using whatever region/station its own consumption rows
// report, rather than being silently dropped.
import { fetchWithTimeout } from "@/lib/utils"
import { normalizeRegionName, shortRegionLabel } from "@/hooks/use-resolved-region-name"
import type { CombinedSalesFilters } from "@/lib/report-builder/combined-sales"
import { MAX_MONTHS, enumerateCalendarMonths } from "@/lib/report-builder/combined-sales"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

function meterKey(meterNumber: string): string {
  return (meterNumber || "").trim().toUpperCase()
}

// --- Meter roster (infrastructure list, not consumption) ---

interface RosterMeter {
  meterNumber: string
  region: string
  station: string
}

async function fetchAllBspMeters(filters: CombinedSalesFilters): Promise<RosterMeter[]> {
  const meters: RosterMeter[] = []
  const limit = 500
  let page = 1
  // Hard stop so a backend pagination bug can't loop forever.
  for (let guard = 0; guard < 200; guard += 1) {
    const qs = new URLSearchParams({
      meter_type: "BSP",
      page: String(page),
      limit: String(limit),
      ...(filters.region ? { region: filters.region } : {}),
      ...(filters.district ? { district: filters.district } : {}),
    })
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/meters?${qs.toString()}`, 60000)
    if (!res.ok) throw new Error(`BSP meter roster fetch failed: ${res.status}`)
    const json = (await res.json()) as {
      data?: { data?: { meter_number: string; region?: string; station?: string }[]; meta?: { pages?: number } }
    }
    const rows = json.data?.data || []
    rows.forEach((m) => {
      // A BSP meter with no region or no station assigned is excluded
      // entirely, not bucketed under "Unknown" -- per the explicit ask,
      // it doesn't belong on this sheet at all.
      if (!m.region?.trim() || !m.station?.trim()) return
      meters.push({ meterNumber: m.meter_number, region: m.region.trim(), station: m.station.trim() })
    })
    const pages = json.data?.meta?.pages || 1
    if (rows.length === 0 || page >= pages) break
    page += 1
  }
  return meters
}

// --- Daily consumption (real per-meter-per-day import/export kWh) ---

interface RawBspDailyRow {
  meter_number: string
  consumption_date: string
  consumed_energy: number
  system_name: "import_kwh" | "export_kwh"
  region?: string
  station?: string
  meter_type: string
}

async function fetchBspDailyRaw(filters: CombinedSalesFilters): Promise<RawBspDailyRow[]> {
  const qs = new URLSearchParams({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    meterType: "BSP",
    ...(filters.region ? { region: filters.region } : {}),
    ...(filters.district ? { district: filters.district } : {}),
  })
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/meters/consumption/daily/bsp?${qs.toString()}`, 100000)
  if (!res.ok) throw new Error(`BSP daily consumption fetch failed: ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? (data as RawBspDailyRow[]) : []
}

function monthSortKeyFromDateString(dateStr: string): number {
  const d = new Date(dateStr)
  return d.getUTCFullYear() * 100 + d.getUTCMonth()
}

export interface BspMeterRow {
  label: string
  importKwh: number
  exportKwh: number
  netKwh: number
}

export interface BspStationRow {
  label: string
  importKwh: number
  exportKwh: number
  netKwh: number
  meters: BspMeterRow[]
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
  const months = enumerateCalendarMonths(filters.dateFrom, filters.dateTo)
  if (months.length > MAX_MONTHS) {
    throw new Error(
      `BSP Imports meter-level breakdown would cover ${months.length} months (max ${MAX_MONTHS}) — narrow the date range and try again.`,
    )
  }

  const [roster, daily] = await Promise.all([
    fetchAllBspMeters(filters).catch((err) => {
      console.error("BSP imports: meter roster fetch failed", err)
      return [] as RosterMeter[]
    }),
    fetchBspDailyRaw(filters).catch((err) => {
      console.error("BSP imports: daily consumption fetch failed", err)
      return [] as RawBspDailyRow[]
    }),
  ])

  // Dedup the roster by meter number (first occurrence wins) -- a meter
  // shouldn't appear twice, but region/district-filtered pagination edge
  // cases are cheap to guard against here.
  const rosterByKey = new Map<string, RosterMeter>()
  roster.forEach((m) => {
    const key = meterKey(m.meterNumber)
    if (key && !rosterByKey.has(key)) rosterByKey.set(key, m)
  })

  // Per-month-per-meter consumption totals, plus each meter's own
  // region/station as reported by its consumption rows (fallback for a
  // meter missing from the roster).
  const perMonthMeter = new Map<number, Map<string, { importKwh: number; exportKwh: number }>>()
  const consumptionMeterLocation = new Map<string, { region: string; station: string }>()

  daily.forEach((row) => {
    if (row.meter_type !== "BSP") return
    if (row.system_name !== "import_kwh" && row.system_name !== "export_kwh") return
    const key = meterKey(row.meter_number)
    if (!key) return

    // Same exclusion rule as the roster: only record a location when both
    // region and station are present, so an orphan meter with neither
    // stays unplaceable below rather than falling back to "Unknown".
    if (!consumptionMeterLocation.has(key) && row.region?.trim() && row.station?.trim()) {
      consumptionMeterLocation.set(key, { region: row.region.trim(), station: row.station.trim() })
    }

    const sortKey = monthSortKeyFromDateString(row.consumption_date)
    let meterMap = perMonthMeter.get(sortKey)
    if (!meterMap) {
      meterMap = new Map()
      perMonthMeter.set(sortKey, meterMap)
    }
    const existing = meterMap.get(key) || { importKwh: 0, exportKwh: 0 }
    if (row.system_name === "import_kwh") existing.importKwh += row.consumed_energy || 0
    else existing.exportKwh += row.consumed_energy || 0
    meterMap.set(key, existing)
  })

  return months.map((month) => {
    const monthSortKey = monthSortKeyFromDateString(month.start)
    const meterConsumption = perMonthMeter.get(monthSortKey) || new Map<string, { importKwh: number; exportKwh: number }>()

    interface MeterAgg {
      label: string
      importKwh: number
      exportKwh: number
    }
    interface StationAgg {
      label: string
      meters: Map<string, MeterAgg>
    }
    interface RegionAgg {
      label: string
      stations: Map<string, StationAgg>
    }
    const regionMap = new Map<string, RegionAgg>()

    const placeMeter = (key: string, meterNumber: string, regionRaw: string, stationRaw: string) => {
      const regionKey = normalizeRegionName(regionRaw)
      let region = regionMap.get(regionKey)
      if (!region) {
        region = { label: shortRegionLabel(regionRaw), stations: new Map() }
        regionMap.set(regionKey, region)
      }
      const stationKey = stationRaw.trim().toLowerCase()
      let station = region.stations.get(stationKey)
      if (!station) {
        station = { label: stationRaw, meters: new Map() }
        region.stations.set(stationKey, station)
      }
      const consumption = meterConsumption.get(key) || { importKwh: 0, exportKwh: 0 }
      station.meters.set(key, { label: meterNumber, importKwh: consumption.importKwh, exportKwh: consumption.exportKwh })
    }

    // Every roster meter first -- guarantees a row even at 0/0 for this month.
    rosterByKey.forEach((m, key) => placeMeter(key, m.meterNumber, m.region, m.station))

    // Then any meter with consumption this month that the roster doesn't
    // know about, placed using its own reported region/station -- skipped
    // entirely if it has neither (same exclusion rule as the roster).
    meterConsumption.forEach((_, key) => {
      if (rosterByKey.has(key)) return
      const loc = consumptionMeterLocation.get(key)
      if (!loc) return
      placeMeter(key, key, loc.region, loc.station)
    })

    const regions: BspRegionRow[] = Array.from(regionMap.values())
      .map((region) => {
        const stations: BspStationRow[] = Array.from(region.stations.values())
          .map((station) => {
            const meters: BspMeterRow[] = Array.from(station.meters.values())
              .map((m) => ({ label: m.label, importKwh: m.importKwh, exportKwh: m.exportKwh, netKwh: m.importKwh - m.exportKwh }))
              .sort((a, b) => b.importKwh - a.importKwh)
            const importKwh = meters.reduce((s, x) => s + x.importKwh, 0)
            const exportKwh = meters.reduce((s, x) => s + x.exportKwh, 0)
            return { label: station.label, importKwh, exportKwh, netKwh: importKwh - exportKwh, meters }
          })
          .sort((a, b) => b.importKwh - a.importKwh)
        const importKwh = stations.reduce((s, x) => s + x.importKwh, 0)
        const exportKwh = stations.reduce((s, x) => s + x.exportKwh, 0)
        return { label: region.label, importKwh, exportKwh, netKwh: importKwh - exportKwh, stations }
      })
      .sort((a, b) => b.importKwh - a.importKwh)

    return { month: month.label, regions }
  })
}
