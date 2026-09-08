"use client"

import { useMemo } from "react"
import { useQueries, useQuery } from "@tanstack/react-query"
import { useZeusBillingAggregate } from "@/hooks/api/use-zeus-billing-aggregate-api"
import { normalizeRegionName, shortRegionLabel } from "@/hooks/use-resolved-region-name"
import { formatApiDate } from "@/lib/utils"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

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

interface BotBxcRow {
  region?: string | null
  bill_month?: string | null
  sum_kwh: number
}

async function fetchBotBxcByRegionMonth(
  source: "bot-consumption" | "bxc-consumption",
  dateFrom: string,
  dateTo: string,
): Promise<BotBxcRow[]> {
  const qs = new URLSearchParams({ dateFrom, dateTo, groupBy: "region,billmonth" })
  const res = await fetch(`${API_BASE_URL}/api/v1/meters/consumption/${source}/aggregate?${qs}`)
  if (!res.ok) throw new Error(`Failed to fetch ${source} aggregate: ${res.status}`)
  const body = await res.json()
  return body.data ?? []
}

interface BspRow {
  system_name: "import_kwh" | "export_kwh"
  region: string
  group_period: string // month-truncated ISO date when groupBy=month
  total_consumption: number
}

async function fetchBspPurchasesByRegionMonth(dateFrom: string, dateTo: string): Promise<BspRow[]> {
  const qs = new URLSearchParams({ dateFrom, dateTo, groupBy: "month", group: "region" })
  const res = await fetch(`${API_BASE_URL}/api/v1/meters/consumption/aggregate/bsp?${qs}`)
  if (!res.ok) throw new Error(`Failed to fetch BSP aggregate: ${res.status}`)
  return res.json()
}

interface MmsRow {
  region?: string | null
  sum_last_month_kwh_read: number | null
}

async function fetchMmsByRegion(dateFrom: string, dateTo: string): Promise<MmsRow[]> {
  const qs = new URLSearchParams({ dateFrom, dateTo, groupBy: "region" })
  const res = await fetch(`${API_BASE_URL}/api/v1/meters/consumption/mms-customer-sales/aggregate?${qs}`)
  if (!res.ok) throw new Error(`Failed to fetch MMS aggregate: ${res.status}`)
  const body = await res.json()
  return body.data ?? []
}

// ── Public shape ─────────────────────────────────────────────────────────

export interface RegionMonthCell {
  purchasesKwh: number
  salesKwh: number
}

export interface RegionSeries {
  region: string // display label
  regionKey: string
  byMonth: Record<string, RegionMonthCell> // keyed by monthKey()
  totalPurchasesKwh: number
  totalSalesKwh: number
  lossKwh: number
  lossPct: number | null // null when purchases is 0 (undefined loss %, not a real 0%)
}

export interface NationalMonthPoint {
  month: string // monthKey
  label: string
  purchasesKwh: number
  salesKwh: number
  lossKwh: number
  lossPct: number | null
}

export interface PurchasesSalesReport {
  isLoading: boolean
  isError: boolean
  months: MonthPoint[]
  monthLabels: string[]
  regions: RegionSeries[] // sorted worst loss % first
  national: NationalMonthPoint[]
  nationalTotals: { purchasesKwh: number; salesKwh: number; lossKwh: number; lossPct: number | null }
  /** Regions where sales exceeded purchases in at least one month — a data-quality
   * flag (a region can't sell more than it bought), not a real negative loss. */
  anomalies: { region: string; month: string; label: string; purchasesKwh: number; salesKwh: number }[]
}

export function usePurchasesSalesReport(months: MonthPoint[]): PurchasesSalesReport {
  const first = months[0]
  const last = months[months.length - 1]
  const rangeFrom = first ? monthBounds(first).dateFrom : undefined
  const rangeTo = last ? monthBounds(last).dateTo : undefined
  const enabled = Boolean(rangeFrom && rangeTo)

  // Sales: Non-AMR + AMR Postpaid, and deduped Zeus Prepaid, both
  // region+month grouped in one call each (Zeus supports a 4-way groupBy
  // natively) -- same Zeus-Prepaid-precedence-over-MMS rule already
  // established on the Region Breakdown table.
  const { data: zeusPostAmrData, isLoading: zeusPostAmrLoading, isError: zeusPostAmrError } =
    useZeusBillingAggregate({
      dateFrom: rangeFrom,
      dateTo: rangeTo,
      groupBy: ["regionname", "metermodeltype", "billingyear", "billingmonth"],
      enabled,
    })
  const { data: zeusPrepaidData, isLoading: zeusPrepaidLoading, isError: zeusPrepaidError } =
    useZeusBillingAggregate({
      dateFrom: rangeFrom,
      dateTo: rangeTo,
      groupBy: ["regionname", "billingyear", "billingmonth"],
      meterModelType: "Prepaid",
      excludeMmsDuplicates: true,
      enabled,
    })

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

  const isLoading =
    zeusPostAmrLoading || zeusPrepaidLoading || botLoading || bxcLoading || bspLoading || mmsLoading
  const isError = zeusPostAmrError || zeusPrepaidError || botError || bxcError || bspError || mmsError

  const report = useMemo(() => {
    const seriesByKey = new Map<string, RegionSeries>()
    const ensure = (raw: string): RegionSeries => {
      const key = normalizeRegionName(raw || "Unknown")
      if (!seriesByKey.has(key)) {
        seriesByKey.set(key, {
          region: shortRegionLabel(raw || "Unknown"),
          regionKey: key,
          byMonth: {},
          totalPurchasesKwh: 0,
          totalSalesKwh: 0,
          lossKwh: 0,
          lossPct: null,
        })
      }
      return seriesByKey.get(key)!
    }
    const cell = (series: RegionSeries, mKey: string): RegionMonthCell => {
      if (!series.byMonth[mKey]) series.byMonth[mKey] = { purchasesKwh: 0, salesKwh: 0 }
      return series.byMonth[mKey]
    }

    // Purchases (BSP): net = import - export, same convention use-bsp-api.ts
    // already uses for "net supply" elsewhere in the app.
    ;(bspData || []).forEach((r) => {
      const mp = { year: new Date(r.group_period).getUTCFullYear(), month: new Date(r.group_period).getUTCMonth() + 1 }
      const mKey = monthKey(mp)
      const series = ensure(r.region)
      const c = cell(series, mKey)
      const delta = r.system_name === "import_kwh" ? r.total_consumption : -r.total_consumption
      c.purchasesKwh += delta || 0
    })

    // Sales: Non-AMR + AMR Postpaid (all metermodeltype values except
    // Prepaid, which comes from the deduped fetch below).
    ;(zeusPostAmrData || []).forEach((r) => {
      const type = (r.metermodeltype || "").trim().toLowerCase()
      if (type !== "postpaid" && type !== "amr") return
      if (!r.billingyear || !r.billingmonth) return
      const mKey = monthKey({ year: r.billingyear, month: r.billingmonth })
      const series = ensure(r.regionname || "Unknown")
      cell(series, mKey).salesKwh += r.sum_billconsumptionvalue || 0
    })
    // Sales: Zeus Prepaid (deduped against MMS) + MMS, blended into one
    // Prepaid figure -- MMS takes precedence on any meter it already has.
    ;(zeusPrepaidData || []).forEach((r) => {
      if (!r.billingyear || !r.billingmonth) return
      const mKey = monthKey({ year: r.billingyear, month: r.billingmonth })
      const series = ensure(r.regionname || "Unknown")
      cell(series, mKey).salesKwh += r.sum_billconsumptionvalue || 0
    })
    mmsQueries.forEach((q, idx) => {
      const mKey = monthKey(months[idx])
      ;(q.data || []).forEach((r) => {
        const series = ensure(r.region || "Unknown")
        cell(series, mKey).salesKwh += r.sum_last_month_kwh_read || 0
      })
    })
    // Sales: Legacy (BOT + BXC) -- PNS excluded, same reason as the Region
    // Breakdown table: its region is an opaque code, not a real name, so
    // it can't be placed in a per-region row here.
    ;[...(botData || []), ...(bxcData || [])].forEach((r) => {
      const mp = parseBillMonthLabel(r.bill_month)
      if (!mp) return
      const mKey = monthKey(mp)
      const series = ensure(r.region || "Unknown")
      cell(series, mKey).salesKwh += r.sum_kwh || 0
    })

    const monthLabels = months.map((m) => monthLabel(m))
    const monthKeys = months.map((m) => monthKey(m))

    const regions = [...seriesByKey.values()]
      .map((series) => {
        let totalPurchases = 0
        let totalSales = 0
        monthKeys.forEach((mKey) => {
          const c = series.byMonth[mKey]
          if (c) {
            totalPurchases += c.purchasesKwh
            totalSales += c.salesKwh
          }
        })
        const lossKwh = totalPurchases - totalSales
        const lossPct = totalPurchases > 0 ? (lossKwh / totalPurchases) * 100 : null
        return { ...series, totalPurchasesKwh: totalPurchases, totalSalesKwh: totalSales, lossKwh, lossPct }
      })
      // Worst (highest) loss % first -- regions with no purchases data
      // (lossPct === null) sort last rather than masquerading as 0% loss.
      .sort((a, b) => {
        if (a.lossPct === null && b.lossPct === null) return 0
        if (a.lossPct === null) return 1
        if (b.lossPct === null) return -1
        return b.lossPct - a.lossPct
      })

    const national: NationalMonthPoint[] = months.map((m, idx) => {
      const mKey = monthKeys[idx]
      let purchases = 0
      let sales = 0
      seriesByKey.forEach((series) => {
        const c = series.byMonth[mKey]
        if (c) {
          purchases += c.purchasesKwh
          sales += c.salesKwh
        }
      })
      const lossKwh = purchases - sales
      return {
        month: mKey,
        label: monthLabels[idx],
        purchasesKwh: purchases,
        salesKwh: sales,
        lossKwh,
        lossPct: purchases > 0 ? (lossKwh / purchases) * 100 : null,
      }
    })

    const nationalPurchases = national.reduce((s, n) => s + n.purchasesKwh, 0)
    const nationalSales = national.reduce((s, n) => s + n.salesKwh, 0)
    const nationalLoss = nationalPurchases - nationalSales

    const anomalies: PurchasesSalesReport["anomalies"] = []
    regions.forEach((series) => {
      monthKeys.forEach((mKey, idx) => {
        const c = series.byMonth[mKey]
        if (c && c.purchasesKwh > 0 && c.salesKwh > c.purchasesKwh) {
          anomalies.push({
            region: series.region,
            month: mKey,
            label: monthLabels[idx],
            purchasesKwh: c.purchasesKwh,
            salesKwh: c.salesKwh,
          })
        }
      })
    })

    return {
      months,
      monthLabels,
      regions,
      national,
      nationalTotals: {
        purchasesKwh: nationalPurchases,
        salesKwh: nationalSales,
        lossKwh: nationalLoss,
        lossPct: nationalPurchases > 0 ? (nationalLoss / nationalPurchases) * 100 : null,
      },
      anomalies,
    }
  }, [zeusPostAmrData, zeusPrepaidData, botData, bxcData, bspData, mmsQueries, months])

  return { ...report, isLoading, isError }
}
