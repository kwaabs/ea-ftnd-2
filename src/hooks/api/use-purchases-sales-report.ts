"use client"

import { useMemo } from "react"
import { useQueries, useQuery } from "@tanstack/react-query"
import { normalizeRegionName, shortRegionLabel } from "@/hooks/use-resolved-region-name"
import { fetchWithTimeout, formatApiDate } from "@/lib/utils"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

// Same timeout every other aggregate hook in this codebase uses for a
// multi-dimension groupBy against a source with no pre-aggregated summary
// (see use-zeus-billing-aggregate-api.ts's own comment on this exact
// tradeoff) -- these raw fetches had none at all until a real hang was
// reported live, which a plain fetch() with no AbortController turns into
// "the page never finishes loading" instead of a bounded, visible error.
const REPORT_FETCH_TIMEOUT_MS = 100000

// ── Month range ──────────────────────────────────────────────────────────
// The Reports page's own date control operates in whole calendar months
// (per the "monthly mode" ask), independent of the app's global
// day-precision date-range picker — a purchases-vs-sales story only makes
// sense bucketed by billing month, and every source's own month dimension
// (Zeus's billingyear/billingmonth, the free-text billmonth label on
// BOT/BXC) is month-grained regardless of what day range you'd draw around
// it.

export interface MonthPoint {
  year: number
  month: number // 1-12
}

/** "2026-01" — the canonical key used to line up every source's month. */
export function monthKey(p: MonthPoint): string {
  return `${p.year}-${String(p.month).padStart(2, "0")}`
}

export function monthLabel(p: MonthPoint): string {
  return new Date(p.year, p.month - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  })
}

/** Trailing N months ending at (and including) the given month, oldest first. */
export function trailingMonths(end: MonthPoint, count: number): MonthPoint[] {
  const out: MonthPoint[] = []
  let y = end.year
  let m = end.month
  for (let i = 0; i < count; i++) {
    out.unshift({ year: y, month: m })
    m -= 1
    if (m < 1) {
      m = 12
      y -= 1
    }
  }
  return out
}

/** Every month from `from` to `to` inclusive, oldest first. Order-agnostic
 * (swaps if `to` is actually earlier than `from`) since this only ever
 * feeds a user-editable custom-range picker, where either end can be
 * changed independently. */
export function monthsInRange(from: MonthPoint, to: MonthPoint): MonthPoint[] {
  const fromIdx = from.year * 12 + from.month
  const toIdx = to.year * 12 + to.month
  const [startIdx, endIdx] = fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx]
  const out: MonthPoint[] = []
  for (let idx = startIdx; idx <= endIdx; idx++) {
    out.push({ year: Math.floor((idx - 1) / 12), month: ((idx - 1) % 12) + 1 })
  }
  return out
}

/** Parses an `<input type="month">` value ("2026-01") into a MonthPoint. */
export function parseMonthInputValue(value: string): MonthPoint | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value.trim())
  if (!m) return null
  const year = parseInt(m[1], 10)
  const month = parseInt(m[2], 10)
  if (month < 1 || month > 12) return null
  return { year, month }
}

export function currentMonthPoint(): MonthPoint {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

function monthBounds(p: MonthPoint): { dateFrom: string; dateTo: string } {
  const start = new Date(p.year, p.month - 1, 1)
  const end = new Date(p.year, p.month, 0) // day 0 of next month = last day of this one
  return { dateFrom: formatApiDate(start), dateTo: formatApiDate(end) }
}

// Month names/abbreviations this app's several legacy sources
// (BOT/BXC/PNS) use in their free-text "billmonth" label — mirrors
// ea-bknd-3's botconsumption/bxcconsumption monthByName maps exactly (see
// those packages' "trim billmonth"/"abbreviated month names" fixes) so a
// label like "JAN-2026" or "JAN-2026 " parses the same way here as it does
// server-side.
const MONTH_BY_NAME: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
}

function parseBillMonthLabel(raw: string | null | undefined): MonthPoint | null {
  if (!raw) return null
  const parts = raw.trim().split("-")
  if (parts.length !== 2) return null
  const month = MONTH_BY_NAME[parts[0].trim().toLowerCase()]
  const year = parseInt(parts[1].trim(), 10)
  if (!month || !Number.isFinite(year)) return null
  return { year, month }
}

// ── Fetch helpers (raw fetch, not the existing typed hooks) ────────────
// BOT/BXC/BSP need param shapes (multi-dimension groupBy, groupBy=month
// period) the existing per-page hooks don't expose, and MMS needs one
// request per month since its aggregate endpoint has no month dimension
// at all (unlike every other source here) -- see this hook's own report
// generation comment below for why that gap isn't worth a backend change
// just for this page. Kept as plain fetches rather than growing those
// other hooks' public param types for a shape only this page needs.
//
// Zeus is fetched one request per month too (raw, not via
// useZeusBillingAggregate), for a performance reason confirmed against
// ea-bknd-3/internal/zeusbilling/service.go's own routing logic, NOT just
// consistency with MMS: that service's Aggregate() only uses its fast
// zeus_sales_period_summary/zeus_customer_roster tables for customer_count
// when groupBy does NOT include billingyear/billingmonth
// (groupsIncludePeriod()) -- the roster stores one [first,last] active
// window per customer, not per-period membership, so "distinct customers
// in period X" structurally can't be answered from it and falls back to
// scanning the raw 18M-row zeus_sales table instead. A single request
// spanning the whole window with billingyear/billingmonth in groupBy (the
// original shape here) hit that fallback on every load -- for a
// customer_count field this report doesn't even use. Scoping each
// request's dateFrom/dateTo to exactly one month and dropping
// billingyear/billingmonth from groupBy entirely (attributing the whole
// response to that request's own month, same as fetchMmsByRegion below)
// keeps every request on the fast summary/roster path.

interface ZeusRow {
  regionname?: string | null
  districtname?: string | null
  metermodeltype?: string | null
  sum_billconsumptionvalue: number
}

async function fetchZeusPostpaidAmrByMonth(dateFrom: string, dateTo: string): Promise<ZeusRow[]> {
  const qs = new URLSearchParams({
    billDateFrom: dateFrom,
    billDateTo: dateTo,
    groupBy: "regionname,districtname,metermodeltype",
  })
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/api/v1/meters/consumption/zeus-billing/aggregate?${qs}`,
    REPORT_FETCH_TIMEOUT_MS,
  )
  if (!res.ok) throw new Error(`Failed to fetch zeus billing aggregate: ${res.status}`)
  const body = await res.json()
  return body.data ?? []
}

async function fetchZeusPrepaidDedupedByMonth(dateFrom: string, dateTo: string): Promise<ZeusRow[]> {
  const qs = new URLSearchParams({
    billDateFrom: dateFrom,
    billDateTo: dateTo,
    groupBy: "regionname,districtname",
    meterModelType: "Prepaid",
    excludeMmsDuplicates: "true",
  })
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/api/v1/meters/consumption/zeus-billing/aggregate?${qs}`,
    REPORT_FETCH_TIMEOUT_MS,
  )
  if (!res.ok) throw new Error(`Failed to fetch zeus billing aggregate (prepaid): ${res.status}`)
  const body = await res.json()
  return body.data ?? []
}

interface BotBxcRow {
  region?: string | null
  district?: string | null
  bill_month?: string | null
  sum_kwh: number
}

async function fetchBotBxcByRegionMonth(
  source: "bot-consumption" | "bxc-consumption",
  dateFrom: string,
  dateTo: string,
): Promise<BotBxcRow[]> {
  const qs = new URLSearchParams({ dateFrom, dateTo, groupBy: "region,district,billmonth" })
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/api/v1/meters/consumption/${source}/aggregate?${qs}`,
    REPORT_FETCH_TIMEOUT_MS,
  )
  if (!res.ok) throw new Error(`Failed to fetch ${source} aggregate: ${res.status}`)
  const body = await res.json()
  return body.data ?? []
}

interface BspRow {
  system_name: "import_kwh" | "export_kwh"
  region: string
  station?: string | null
  group_period: string // month-truncated ISO date when groupBy=month
  total_consumption: number
}

// BSP incomer meters are grouped by station, not district -- a purchase
// happens at a physical substation, and that substation's own `district`
// column on app.meters is almost always blank (unlike district on
// customer-sales meters, which is populated). Grouping by district here
// used to dump nearly every kWh into a single "Unknown" district bucket.
// Station is the real, populated dimension purchases naturally break down
// by, so that's what's requested and shown instead.
async function fetchBspPurchasesByRegionMonth(dateFrom: string, dateTo: string): Promise<BspRow[]> {
  const qs = new URLSearchParams({ dateFrom, dateTo, groupBy: "month", group: "region,station" })
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/api/v1/meters/consumption/aggregate/bsp?${qs}`,
    REPORT_FETCH_TIMEOUT_MS,
  )
  if (!res.ok) throw new Error(`Failed to fetch BSP aggregate: ${res.status}`)
  return res.json()
}

interface MmsRow {
  region?: string | null
  district?: string | null
  sum_last_month_kwh_read: number | null
}

async function fetchMmsByRegion(dateFrom: string, dateTo: string): Promise<MmsRow[]> {
  const qs = new URLSearchParams({ dateFrom, dateTo, groupBy: "region,district" })
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/api/v1/meters/consumption/mms-customer-sales/aggregate?${qs}`,
    REPORT_FETCH_TIMEOUT_MS,
  )
  if (!res.ok) throw new Error(`Failed to fetch MMS aggregate: ${res.status}`)
  const body = await res.json()
  return body.data ?? []
}

interface HolleyEcash4Row {
  region?: string | null
  district?: string | null
  sum_kwh: number
}

// HOLLEY and ECASH4 both have real, human-readable region/district names
// (unlike PNS below) and neither's Aggregate supports a month/period
// groupBy dimension (region/district/tariff only) -- same "one request per
// month, scoped via dateFrom/dateTo" shape as fetchMmsByRegion, reusing
// that month's own request rather than reading a period back out of the
// row.
async function fetchHolleyByMonth(dateFrom: string, dateTo: string): Promise<HolleyEcash4Row[]> {
  const qs = new URLSearchParams({ dateFrom, dateTo, groupBy: "region,district" })
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/api/v1/meters/consumption/holley-consumption/aggregate?${qs}`,
    REPORT_FETCH_TIMEOUT_MS,
  )
  if (!res.ok) throw new Error(`Failed to fetch HOLLEY aggregate: ${res.status}`)
  const body = await res.json()
  return body.data ?? []
}

async function fetchEcash4ByMonth(dateFrom: string, dateTo: string): Promise<HolleyEcash4Row[]> {
  const qs = new URLSearchParams({ dateFrom, dateTo, groupBy: "region,district" })
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/api/v1/meters/consumption/ecash4-consumption/aggregate?${qs}`,
    REPORT_FETCH_TIMEOUT_MS,
  )
  if (!res.ok) throw new Error(`Failed to fetch ECASH4 aggregate: ${res.status}`)
  const body = await res.json()
  return body.data ?? []
}

interface PnsRow {
  sum_energy_kwh: number
}

// PNS's region/district are opaque numeric codes with no name lookup yet
// (ea-bknd-3/internal/pnsconsumption's package doc comment) -- same reason
// this report's existing BOT/BXC sum already excludes PNS from the
// per-region breakdown below. It still belongs in the national Sales
// total though (ea-bknd-3's salessummary package counts it, and so does
// customer-sales-overview.tsx's Legacy figure), so this fetch asks for no
// groupBy override and sums every row's sum_energy_kwh -- the exact
// region/district split doesn't matter here, only the month's grand
// total does.
async function fetchPnsNationalByMonth(dateFrom: string, dateTo: string): Promise<number> {
  const qs = new URLSearchParams({ dateFrom, dateTo })
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/api/v1/meters/consumption/pns-consumption/aggregate?${qs}`,
    REPORT_FETCH_TIMEOUT_MS,
  )
  if (!res.ok) throw new Error(`Failed to fetch PNS aggregate: ${res.status}`)
  const body = await res.json()
  const rows: PnsRow[] = body.data ?? []
  return rows.reduce((s, r) => s + (r.sum_energy_kwh || 0), 0)
}

interface ZeusStreetlightingRow {
  regionname?: string | null
  districtname?: string | null
  sum_billconsumptionvalue: number
}

// Streetlighting (Zeus tariffclasscode E03) -- flat-rate, MDA-billed
// consumption, kept as its own tracked quantity rather than folded into
// Sales, same Category split as ea-bknd-3/internal/salessummary and every
// other Streetlighting view in this app (dashboard, customer-sales
// overview, the dedicated hub page). Same per-month request shape as
// fetchZeusPostpaidAmrByMonth for the same fast-path reason (see that
// function's comment) -- billDateFrom/billDateTo scoped to exactly one
// month, no billingyear/billingmonth in groupBy.
async function fetchZeusStreetlightingByMonth(dateFrom: string, dateTo: string): Promise<ZeusStreetlightingRow[]> {
  const qs = new URLSearchParams({
    billDateFrom: dateFrom,
    billDateTo: dateTo,
    groupBy: "regionname,districtname",
    tariffClassCode: "E03",
  })
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/api/v1/meters/consumption/zeus-billing/aggregate?${qs}`,
    REPORT_FETCH_TIMEOUT_MS,
  )
  if (!res.ok) throw new Error(`Failed to fetch zeus billing aggregate (streetlighting): ${res.status}`)
  const body = await res.json()
  return body.data ?? []
}

// ── Public shape ─────────────────────────────────────────────────────────

export interface RegionMonthCell {
  purchasesKwh: number
  // salesKwh = postpaidKwh + prepaidKwh, kept as its own stored field
  // (not a derived getter) since every existing chart/table on this page
  // already reads it directly -- postpaidKwh/prepaidKwh are additive, new
  // fields alongside it for the comparison module (see
  // purchases-sales-report-view.tsx), not a replacement.
  salesKwh: number
  postpaidKwh: number
  prepaidKwh: number
  // Streetlighting (Zeus tariffclasscode E03) is tracked separately from
  // salesKwh entirely -- it's its own top-level category everywhere else
  // in this app (ea-bknd-3/internal/salessummary, the dashboard, customer-
  // sales overview), not a Postpaid/Prepaid bucket.
  streetlightingKwh: number
}

// Sales-only -- purchases (BSP) aren't tracked at district granularity, only
// down to station (see StationSeries below), so a district has no honest
// purchases/loss figure of its own.
export interface DistrictSeries {
  district: string // display label
  districtKey: string
  byMonth: Record<string, RegionMonthCell> // salesKwh only; purchasesKwh always 0 here
  totalSalesKwh: number
  totalPostpaidKwh: number
  totalPrepaidKwh: number
  totalStreetlightingKwh: number
}

export interface StationSeries {
  station: string // display label
  stationKey: string
  totalPurchasesKwh: number
}

export interface RegionSeries {
  region: string // display label
  regionKey: string
  byMonth: Record<string, RegionMonthCell> // keyed by monthKey()
  totalPurchasesKwh: number
  totalSalesKwh: number
  totalPostpaidKwh: number
  totalPrepaidKwh: number
  totalStreetlightingKwh: number
  lossKwh: number
  lossPct: number | null // null when purchases is 0 (undefined loss %, not a real 0%)
  districts: DistrictSeries[] // sorted highest sales first
  stations: StationSeries[] // sorted highest purchases first
}

export interface NationalMonthPoint {
  month: string // monthKey
  label: string
  purchasesKwh: number
  salesKwh: number
  postpaidKwh: number
  prepaidKwh: number
  streetlightingKwh: number
  lossKwh: number
  lossPct: number | null
}

export interface PurchasesSalesReport {
  isLoading: boolean
  isError: boolean
  /** Which source(s) actually failed (timed out or errored) — named
   * explicitly rather than folded into one flat boolean, so a failure is
   * self-diagnosable from the UI instead of needing a console/network
   * inspection every time. */
  erroredSources: string[]
  months: MonthPoint[]
  monthLabels: string[]
  regions: RegionSeries[] // sorted worst loss % first
  national: NationalMonthPoint[]
  nationalTotals: {
    purchasesKwh: number
    salesKwh: number
    postpaidKwh: number
    prepaidKwh: number
    streetlightingKwh: number
    lossKwh: number
    lossPct: number | null
  }
  /** Regions where sales exceeded purchases across the selected window as a
   * whole — a data-quality flag (a region can't sell more than it bought),
   * not a real negative loss. One entry per region (see the anomalies
   * computation below for why), with monthsAffected saying how many months
   * within the window contributed to it. */
  anomalies: { region: string; purchasesKwh: number; salesKwh: number; monthsAffected: number }[]
}

export function usePurchasesSalesReport(months: MonthPoint[]): PurchasesSalesReport {
  const first = months[0]
  const last = months[months.length - 1]
  const rangeFrom = first ? monthBounds(first).dateFrom : undefined
  const rangeTo = last ? monthBounds(last).dateTo : undefined
  const enabled = Boolean(rangeFrom && rangeTo)

  // Sales: Non-AMR + AMR Postpaid, and deduped Zeus Prepaid -- one request
  // per month for both (see fetchZeusPostpaidAmrByMonth's comment above for
  // why: keeps every request on Zeus's fast summary/roster path instead of
  // the 18M-row raw-table fallback that billingyear/billingmonth in a
  // single whole-window groupBy used to force). Same Zeus-Prepaid-
  // precedence-over-MMS rule already established on the Region Breakdown
  // table.
  const zeusPostAmrQueries = useQueries({
    queries: months.map((m) => {
      const { dateFrom, dateTo } = monthBounds(m)
      return {
        queryKey: ["report-zeus-postamr", dateFrom, dateTo],
        queryFn: () => fetchZeusPostpaidAmrByMonth(dateFrom, dateTo),
        enabled,
      }
    }),
  })
  const zeusPrepaidQueries = useQueries({
    queries: months.map((m) => {
      const { dateFrom, dateTo } = monthBounds(m)
      return {
        queryKey: ["report-zeus-prepaid", dateFrom, dateTo],
        queryFn: () => fetchZeusPrepaidDedupedByMonth(dateFrom, dateTo),
        enabled,
      }
    }),
  })
  const zeusPostAmrLoading = zeusPostAmrQueries.some((q) => q.isLoading)
  const zeusPostAmrError = zeusPostAmrQueries.some((q) => q.isError)
  const zeusPrepaidLoading = zeusPrepaidQueries.some((q) => q.isLoading)
  const zeusPrepaidError = zeusPrepaidQueries.some((q) => q.isError)

  const {
    data: botData,
    isLoading: botLoading,
    isError: botError,
  } = useQuery({
    queryKey: ["report-bot", rangeFrom, rangeTo],
    queryFn: () => fetchBotBxcByRegionMonth("bot-consumption", rangeFrom!, rangeTo!),
    enabled,
  })
  const {
    data: bxcData,
    isLoading: bxcLoading,
    isError: bxcError,
  } = useQuery({
    queryKey: ["report-bxc", rangeFrom, rangeTo],
    queryFn: () => fetchBotBxcByRegionMonth("bxc-consumption", rangeFrom!, rangeTo!),
    enabled,
  })
  const {
    data: bspData,
    isLoading: bspLoading,
    isError: bspError,
  } = useQuery({
    queryKey: ["report-bsp", rangeFrom, rangeTo],
    queryFn: () => fetchBspPurchasesByRegionMonth(rangeFrom!, rangeTo!),
    enabled,
  })

  // MMS has no month dimension server-side (see this file's fetchMmsByRegion
  // comment) -- one request per month, each scoped to just that month's
  // bounds, run in parallel via useQueries.
  const mmsQueries = useQueries({
    queries: months.map((m) => {
      const { dateFrom, dateTo } = monthBounds(m)
      return {
        queryKey: ["report-mms", dateFrom, dateTo],
        queryFn: () => fetchMmsByRegion(dateFrom, dateTo),
        enabled,
      }
    }),
  })
  const mmsLoading = mmsQueries.some((q) => q.isLoading)
  const mmsError = mmsQueries.some((q) => q.isError)

  // HOLLEY, ECASH4, PNS, and Streetlighting -- same per-month-scoped
  // useQueries shape as MMS above, run in parallel.
  const holleyQueries = useQueries({
    queries: months.map((m) => {
      const { dateFrom, dateTo } = monthBounds(m)
      return {
        queryKey: ["report-holley", dateFrom, dateTo],
        queryFn: () => fetchHolleyByMonth(dateFrom, dateTo),
        enabled,
      }
    }),
  })
  const holleyLoading = holleyQueries.some((q) => q.isLoading)
  const holleyError = holleyQueries.some((q) => q.isError)

  const ecash4Queries = useQueries({
    queries: months.map((m) => {
      const { dateFrom, dateTo } = monthBounds(m)
      return {
        queryKey: ["report-ecash4", dateFrom, dateTo],
        queryFn: () => fetchEcash4ByMonth(dateFrom, dateTo),
        enabled,
      }
    }),
  })
  const ecash4Loading = ecash4Queries.some((q) => q.isLoading)
  const ecash4Error = ecash4Queries.some((q) => q.isError)

  const pnsQueries = useQueries({
    queries: months.map((m) => {
      const { dateFrom, dateTo } = monthBounds(m)
      return {
        queryKey: ["report-pns", dateFrom, dateTo],
        queryFn: () => fetchPnsNationalByMonth(dateFrom, dateTo),
        enabled,
      }
    }),
  })
  const pnsLoading = pnsQueries.some((q) => q.isLoading)
  const pnsError = pnsQueries.some((q) => q.isError)

  const streetlightingQueries = useQueries({
    queries: months.map((m) => {
      const { dateFrom, dateTo } = monthBounds(m)
      return {
        queryKey: ["report-streetlighting", dateFrom, dateTo],
        queryFn: () => fetchZeusStreetlightingByMonth(dateFrom, dateTo),
        enabled,
      }
    }),
  })
  const streetlightingLoading = streetlightingQueries.some((q) => q.isLoading)
  const streetlightingError = streetlightingQueries.some((q) => q.isError)

  const isLoading =
    zeusPostAmrLoading ||
    zeusPrepaidLoading ||
    botLoading ||
    bxcLoading ||
    bspLoading ||
    mmsLoading ||
    holleyLoading ||
    ecash4Loading ||
    pnsLoading ||
    streetlightingLoading
  const erroredSources = [
    zeusPostAmrError && "Zeus (Postpaid/AMR)",
    zeusPrepaidError && "Zeus (Prepaid, deduped)",
    botError && "BOT",
    bxcError && "BXC",
    bspError && "BSP",
    mmsError && "MMS",
    holleyError && "HOLLEY",
    ecash4Error && "ECASH4",
    pnsError && "PNS",
    streetlightingError && "Zeus (Streetlighting)",
  ].filter((s): s is string => Boolean(s))
  const isError = erroredSources.length > 0

  const report = useMemo(() => {
    // Sources store region/district/station names in inconsistent case
    // ("ashanti west", "ASHANTI WEST", "Ashanti West"...) -- shortRegionLabel
    // deliberately preserves whatever case it's given (see its own docs),
    // so this report proper-cases on top of it for a display label that
    // reads consistently everywhere it shows up (ranking table, heat map,
    // trend chart, loss map, filter dropdowns).
    const properCase = (name: string): string => name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

    interface WorkingDistrict {
      district: string
      districtKey: string
      byMonth: Record<string, RegionMonthCell>
    }
    interface WorkingStation {
      station: string
      stationKey: string
      byMonth: Record<string, RegionMonthCell>
    }
    interface WorkingRegion {
      region: string
      regionKey: string
      byMonth: Record<string, RegionMonthCell>
      districts: Map<string, WorkingDistrict>
      stations: Map<string, WorkingStation>
    }

    const seriesByKey = new Map<string, WorkingRegion>()
    const ensure = (raw: string): WorkingRegion => {
      const key = normalizeRegionName(raw || "Unknown")
      if (!seriesByKey.has(key)) {
        seriesByKey.set(key, {
          region: properCase(shortRegionLabel(raw || "Unknown")),
          regionKey: key,
          byMonth: {},
          districts: new Map(),
          stations: new Map(),
        })
      }
      return seriesByKey.get(key)!
    }
    const ensureDistrict = (region: WorkingRegion, rawDistrict: string | null | undefined): WorkingDistrict => {
      const label = rawDistrict && rawDistrict.trim() ? rawDistrict.trim() : "Unknown"
      const key = normalizeRegionName(label)
      if (!region.districts.has(key)) {
        region.districts.set(key, { district: properCase(shortRegionLabel(label)), districtKey: key, byMonth: {} })
      }
      return region.districts.get(key)!
    }
    const ensureStation = (region: WorkingRegion, rawStation: string | null | undefined): WorkingStation => {
      const label = rawStation && rawStation.trim() ? rawStation.trim() : "Unknown"
      const key = normalizeRegionName(label)
      if (!region.stations.has(key)) {
        region.stations.set(key, { station: properCase(shortRegionLabel(label)), stationKey: key, byMonth: {} })
      }
      return region.stations.get(key)!
    }
    const cell = (byMonth: Record<string, RegionMonthCell>, mKey: string): RegionMonthCell => {
      if (!byMonth[mKey])
        byMonth[mKey] = { purchasesKwh: 0, salesKwh: 0, postpaidKwh: 0, prepaidKwh: 0, streetlightingKwh: 0 }
      return byMonth[mKey]
    }
    // Adds to both the region's own total and its district breakdown in one
    // call -- region totals stay a direct sum of every raw row regardless
    // of whether that row's district was recognized, while districts is an
    // independent, additional drill-down (an unrecognized/blank district
    // lands in an "Unknown" bucket rather than being silently dropped).
    // category also increments postpaidKwh/prepaidKwh alongside the
    // existing blended salesKwh -- additive fields for the comparison
    // module, not a replacement for what every existing chart/table here
    // already reads.
    const addSale = (
      regionRaw: string,
      districtRaw: string | null | undefined,
      mKey: string,
      kwh: number,
      category: "postpaid" | "prepaid",
    ) => {
      const series = ensure(regionRaw)
      const regionCell = cell(series.byMonth, mKey)
      regionCell.salesKwh += kwh
      regionCell[category === "postpaid" ? "postpaidKwh" : "prepaidKwh"] += kwh
      const districtCell = cell(ensureDistrict(series, districtRaw).byMonth, mKey)
      districtCell.salesKwh += kwh
      districtCell[category === "postpaid" ? "postpaidKwh" : "prepaidKwh"] += kwh
    }
    // Purchases break down by station, not district (see
    // fetchBspPurchasesByRegionMonth's comment) -- same shape as addSale,
    // just against the station map instead of the district one.
    const addPurchase = (regionRaw: string, stationRaw: string | null | undefined, mKey: string, kwh: number) => {
      const series = ensure(regionRaw)
      cell(series.byMonth, mKey).purchasesKwh += kwh
      cell(ensureStation(series, stationRaw).byMonth, mKey).purchasesKwh += kwh
    }
    // Streetlighting is tracked in its own field, never salesKwh -- see
    // RegionMonthCell's doc comment.
    const addStreetlighting = (
      regionRaw: string,
      districtRaw: string | null | undefined,
      mKey: string,
      kwh: number,
    ) => {
      const series = ensure(regionRaw)
      cell(series.byMonth, mKey).streetlightingKwh += kwh
      cell(ensureDistrict(series, districtRaw).byMonth, mKey).streetlightingKwh += kwh
    }

    // Purchases (BSP): net = import - export, same convention use-bsp-api.ts
    // already uses for "net supply" elsewhere in the app.
    ;(bspData || []).forEach((r) => {
      const mp = { year: new Date(r.group_period).getUTCFullYear(), month: new Date(r.group_period).getUTCMonth() + 1 }
      const delta = r.system_name === "import_kwh" ? r.total_consumption : -r.total_consumption
      addPurchase(r.region, r.station, monthKey(mp), delta || 0)
    })

    // Sales: Non-AMR + AMR Postpaid (all metermodeltype values except
    // Prepaid, which comes from the deduped fetch below). Each query is
    // already scoped to exactly one month via dateFrom/dateTo, so that
    // month is attributed directly rather than read back out of the row
    // (billingyear/billingmonth are no longer requested -- see
    // fetchZeusPostpaidAmrByMonth's comment).
    zeusPostAmrQueries.forEach((q, idx) => {
      const mKey = monthKey(months[idx])
      ;(q.data || []).forEach((r) => {
        const type = (r.metermodeltype || "").trim().toLowerCase()
        if (type !== "postpaid" && type !== "amr") return
        addSale(r.regionname || "Unknown", r.districtname, mKey, r.sum_billconsumptionvalue || 0, "postpaid")
      })
    })
    // Sales: Zeus Prepaid (deduped against MMS) + MMS, blended into one
    // Prepaid figure -- MMS takes precedence on any meter it already has.
    zeusPrepaidQueries.forEach((q, idx) => {
      const mKey = monthKey(months[idx])
      ;(q.data || []).forEach((r) => {
        addSale(r.regionname || "Unknown", r.districtname, mKey, r.sum_billconsumptionvalue || 0, "prepaid")
      })
    })
    mmsQueries.forEach((q, idx) => {
      const mKey = monthKey(months[idx])
      ;(q.data || []).forEach((r) => {
        addSale(r.region || "Unknown", r.district, mKey, r.sum_last_month_kwh_read || 0, "prepaid")
      })
    })
    // Sales: Legacy (BOT + BXC + HOLLEY + ECASH4), all Prepaid -- PNS
    // excluded here, same reason as the Region Breakdown table: its
    // region is an opaque code, not a real name, so it can't be placed in
    // a per-region row. PNS still counts toward the national total below
    // (pnsNationalKwhByMonth), same precedent as ea-ftnd-2's
    // customer-sales-overview.tsx and ea-bknd-3's salessummary package.
    ;[...(botData || []), ...(bxcData || [])].forEach((r) => {
      const mp = parseBillMonthLabel(r.bill_month)
      if (!mp) return
      addSale(r.region || "Unknown", r.district, monthKey(mp), r.sum_kwh || 0, "prepaid")
    })
    holleyQueries.forEach((q, idx) => {
      const mKey = monthKey(months[idx])
      ;(q.data || []).forEach((r) => {
        addSale(r.region || "Unknown", r.district, mKey, r.sum_kwh || 0, "prepaid")
      })
    })
    ecash4Queries.forEach((q, idx) => {
      const mKey = monthKey(months[idx])
      ;(q.data || []).forEach((r) => {
        addSale(r.region || "Unknown", r.district, mKey, r.sum_kwh || 0, "prepaid")
      })
    })
    // PNS: national-only, keyed by month, added into national/nationalTotals
    // below (never into a region's byMonth, per the opaque-region-code
    // reasoning above).
    const pnsNationalKwhByMonth: Record<string, number> = {}
    pnsQueries.forEach((q, idx) => {
      pnsNationalKwhByMonth[monthKey(months[idx])] = q.data || 0
    })

    // Streetlighting (Zeus tariffclasscode E03) -- own field, not folded
    // into Sales/Postpaid/Prepaid (see addStreetlighting above).
    streetlightingQueries.forEach((q, idx) => {
      const mKey = monthKey(months[idx])
      ;(q.data || []).forEach((r) => {
        addStreetlighting(r.regionname || "Unknown", r.districtname, mKey, r.sum_billconsumptionvalue || 0)
      })
    })

    const monthLabels = months.map((m) => monthLabel(m))
    const monthKeys = months.map((m) => monthKey(m))

    const totalsFor = (byMonth: Record<string, RegionMonthCell>) => {
      let purchases = 0
      let sales = 0
      let postpaid = 0
      let prepaid = 0
      let streetlighting = 0
      monthKeys.forEach((mKey) => {
        const c = byMonth[mKey]
        if (c) {
          purchases += c.purchasesKwh
          sales += c.salesKwh
          postpaid += c.postpaidKwh
          prepaid += c.prepaidKwh
          streetlighting += c.streetlightingKwh
        }
      })
      const lossKwh = purchases - sales
      return {
        purchases,
        sales,
        postpaid,
        prepaid,
        streetlighting,
        lossKwh,
        lossPct: purchases > 0 ? (lossKwh / purchases) * 100 : null,
      }
    }
    // Worst (highest) loss % first -- entries with no purchases data
    // (lossPct === null) sort last rather than masquerading as 0% loss.
    const byWorstLoss = <T extends { lossPct: number | null }>(a: T, b: T) => {
      if (a.lossPct === null && b.lossPct === null) return 0
      if (a.lossPct === null) return 1
      if (b.lossPct === null) return -1
      return b.lossPct - a.lossPct
    }

    const regions = [...seriesByKey.values()]
      .map((series) => {
        const t = totalsFor(series.byMonth)
        // Sales-only, so there's no loss % to rank by -- highest sales
        // first is the closest equivalent ("biggest first") for a table
        // that no longer has a severity dimension of its own.
        const districts = [...series.districts.values()]
          .map((d) => {
            const dt = totalsFor(d.byMonth)
            return {
              district: d.district,
              districtKey: d.districtKey,
              byMonth: d.byMonth,
              totalSalesKwh: dt.sales,
              totalPostpaidKwh: dt.postpaid,
              totalPrepaidKwh: dt.prepaid,
              totalStreetlightingKwh: dt.streetlighting,
            }
          })
          .sort((a, b) => b.totalSalesKwh - a.totalSalesKwh)
        const stations = [...series.stations.values()]
          .map((s) => ({
            station: s.station,
            stationKey: s.stationKey,
            totalPurchasesKwh: totalsFor(s.byMonth).purchases,
          }))
          .sort((a, b) => b.totalPurchasesKwh - a.totalPurchasesKwh)
        return {
          region: series.region,
          regionKey: series.regionKey,
          byMonth: series.byMonth,
          totalPurchasesKwh: t.purchases,
          totalSalesKwh: t.sales,
          totalPostpaidKwh: t.postpaid,
          totalPrepaidKwh: t.prepaid,
          totalStreetlightingKwh: t.streetlighting,
          lossKwh: t.lossKwh,
          lossPct: t.lossPct,
          districts,
          stations,
        }
      })
      .sort(byWorstLoss)

    const national: NationalMonthPoint[] = months.map((m, idx) => {
      const mKey = monthKeys[idx]
      let purchases = 0
      let sales = 0
      let postpaid = 0
      let prepaid = 0
      let streetlighting = 0
      seriesByKey.forEach((series) => {
        const c = series.byMonth[mKey]
        if (c) {
          purchases += c.purchasesKwh
          sales += c.salesKwh
          postpaid += c.postpaidKwh
          prepaid += c.prepaidKwh
          streetlighting += c.streetlightingKwh
        }
      })
      // PNS tops up the national/Prepaid totals only -- never a region's
      // own byMonth (see pnsNationalKwhByMonth above).
      const pnsKwh = pnsNationalKwhByMonth[mKey] || 0
      sales += pnsKwh
      prepaid += pnsKwh
      const lossKwh = purchases - sales
      return {
        month: mKey,
        label: monthLabels[idx],
        purchasesKwh: purchases,
        salesKwh: sales,
        postpaidKwh: postpaid,
        prepaidKwh: prepaid,
        streetlightingKwh: streetlighting,
        lossKwh,
        lossPct: purchases > 0 ? (lossKwh / purchases) * 100 : null,
      }
    })

    const nationalPurchases = national.reduce((s, n) => s + n.purchasesKwh, 0)
    const nationalSales = national.reduce((s, n) => s + n.salesKwh, 0)
    const nationalPostpaid = national.reduce((s, n) => s + n.postpaidKwh, 0)
    const nationalPrepaid = national.reduce((s, n) => s + n.prepaidKwh, 0)
    const nationalStreetlighting = national.reduce((s, n) => s + n.streetlightingKwh, 0)
    const nationalLoss = nationalPurchases - nationalSales

    // One entry per REGION, not per region-month -- a region is the same
    // region regardless of how many months it shows this issue in, so it's
    // evaluated (and counted) once, on its own window totals, same as every
    // other figure this report shows for a region. monthsAffected says how
    // many of the selected months contributed, without turning this back
    // into a per-month list.
    const anomalies: PurchasesSalesReport["anomalies"] = []
    regions.forEach((series) => {
      if (series.totalPurchasesKwh > 0 && series.totalSalesKwh > series.totalPurchasesKwh) {
        const monthsAffected = monthKeys.filter((mKey) => {
          const c = series.byMonth[mKey]
          return c && c.purchasesKwh > 0 && c.salesKwh > c.purchasesKwh
        }).length
        anomalies.push({
          region: series.region,
          purchasesKwh: series.totalPurchasesKwh,
          salesKwh: series.totalSalesKwh,
          monthsAffected,
        })
      }
    })

    return {
      months,
      monthLabels,
      regions,
      national,
      nationalTotals: {
        purchasesKwh: nationalPurchases,
        salesKwh: nationalSales,
        postpaidKwh: nationalPostpaid,
        prepaidKwh: nationalPrepaid,
        streetlightingKwh: nationalStreetlighting,
        lossKwh: nationalLoss,
        lossPct: nationalPurchases > 0 ? (nationalLoss / nationalPurchases) * 100 : null,
      },
      anomalies,
    }
  }, [
    zeusPostAmrQueries,
    zeusPrepaidQueries,
    botData,
    bxcData,
    bspData,
    mmsQueries,
    holleyQueries,
    ecash4Queries,
    pnsQueries,
    streetlightingQueries,
    months,
  ])

  return { ...report, isLoading, isError, erroredSources }
}
