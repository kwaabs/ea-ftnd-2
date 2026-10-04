// Shapes a PurchasesSalesReport into a plain data structure the PDF and
// PPTX renderers both consume — one place that decides WHAT goes in an
// Executive vs Detailed report, independent of how each format lays it
// out. Always built from the full national report (report.regions /
// report.national), never the Reports page's own region/district filter —
// "all levels and sub-levels" means the whole network regardless of what's
// currently selected on screen.
import type { MonthPoint, NationalMonthPoint, PurchasesSalesReport, RegionSeries } from "@/hooks/api/use-purchases-sales-report"
import { monthLabel } from "@/hooks/api/use-purchases-sales-report"

export type ReportType = "executive" | "detailed"

export interface ReportTableRow {
  label: string
  purchasesKwh: number | null // null where purchases aren't tracked at this level (districts)
  salesKwh: number
  postpaidKwh: number
  prepaidKwh: number
  streetlightingKwh: number
  lossKwh: number | null
  lossPct: number | null
}

export interface DistrictSection {
  district: string
  totals: ReportTableRow
  monthly: ReportTableRow[]
}

export interface RegionSection {
  region: string
  totals: ReportTableRow
  monthly: ReportTableRow[]
  districts: DistrictSection[]
}

export interface ReportChartImage {
  label: string
  dataUrl: string
  width: number
  height: number
}

export interface RegionRankingRow {
  region: string
  districtCount: number
  purchasesKwh: number
  salesKwh: number
  streetlightingKwh: number
  lossKwh: number
  lossPct: number | null
}

export interface ReportExportData {
  reportType: ReportType
  title: string
  periodLabel: string
  generatedAtLabel: string
  national: {
    totals: ReportTableRow
    monthly: ReportTableRow[]
  }
  narrative: string
  regionRanking: RegionRankingRow[]
  regions: RegionSection[] // only populated for "detailed"
  anomalies: { region: string; purchasesKwh: number; salesKwh: number; monthsAffected: number }[]
  chartImages: ReportChartImage[]
}

function toRow(
  label: string,
  src: {
    purchasesKwh?: number | null
    salesKwh: number
    postpaidKwh: number
    prepaidKwh: number
    streetlightingKwh: number
    lossKwh?: number | null
    lossPct?: number | null
  },
): ReportTableRow {
  return {
    label,
    purchasesKwh: src.purchasesKwh ?? null,
    salesKwh: src.salesKwh,
    postpaidKwh: src.postpaidKwh,
    prepaidKwh: src.prepaidKwh,
    streetlightingKwh: src.streetlightingKwh,
    lossKwh: src.lossKwh ?? null,
    lossPct: src.lossPct ?? null,
}
}

/** Same first-half-vs-second-half loss % comparison the Reports page's own
 * narrative card uses — reproduced here (not imported from the component)
 * so it always runs against the full national scope, not whatever the
 * page's region/district filter currently narrows it to. */
function buildNarrative(national: NationalMonthPoint[], regions: RegionSeries[]): string {
  const withLoss = national.filter((n) => n.lossPct !== null)
  if (withLoss.length < 2) return "Not enough months with purchases data in this window to compare loss % trend."
  const mid = Math.floor(withLoss.length / 2)
  const avg = (rows: NationalMonthPoint[]) => rows.reduce((s, r) => s + (r.lossPct || 0), 0) / rows.length
  const firstAvg = avg(withLoss.slice(0, mid))
  const secondAvg = avg(withLoss.slice(mid))
  const delta = secondAvg - firstAvg
  const trend = delta > 0.5 ? `up ${Math.abs(delta).toFixed(1)} points` : delta < -0.5 ? `down ${Math.abs(delta).toFixed(1)} points` : "essentially flat"

  const worst = regions.length > 1 ? regions[0] : null
  const best = regions.length > 1 ? [...regions].reverse().find((r) => r.lossPct !== null) : null

  let text = `Network-wide losses averaged ${firstAvg.toFixed(1)}% in the first half of this window and ${secondAvg.toFixed(1)}% in the second half — ${trend}.`
  if (worst) {
    text += ` ${worst.region} has the highest loss rate over this window at ${worst.lossPct?.toFixed(1)}%`
    if (best && best.regionKey !== worst.regionKey) {
      text += `, while ${best.region} is tightest at ${best.lossPct?.toFixed(1)}%`
    }
    text += "."
  }
  return text
}

export function buildReportExportData(params: {
  report: PurchasesSalesReport
  reportType: ReportType
  chartImages: ReportChartImage[]
}): ReportExportData {
  const { report, reportType, chartImages } = params

  const months: MonthPoint[] = report.months
  const monthKeys = months.map((m) => `${m.year}-${String(m.month).padStart(2, "0")}`)
  const periodLabel =
    months.length === 1 ? monthLabel(months[0]) : `${monthLabel(months[0])} – ${monthLabel(months[months.length - 1])}`

  const national = {
    totals: toRow("Total", report.nationalTotals),
    monthly: report.national.map((n) => toRow(n.label, n)),
  }

  const regionRanking: RegionRankingRow[] = report.regions.map((r) => ({
    region: r.region,
    districtCount: r.districts.length,
    purchasesKwh: r.totalPurchasesKwh,
    salesKwh: r.totalSalesKwh,
    streetlightingKwh: r.totalStreetlightingKwh,
    lossKwh: r.lossKwh,
    lossPct: r.lossPct,
  }))

  const regions: RegionSection[] =
    reportType === "detailed"
      ? report.regions.map((r) => ({
          region: r.region,
          totals: toRow("Total", {
            purchasesKwh: r.totalPurchasesKwh,
            salesKwh: r.totalSalesKwh,
            postpaidKwh: r.totalPostpaidKwh,
            prepaidKwh: r.totalPrepaidKwh,
            streetlightingKwh: r.totalStreetlightingKwh,
            lossKwh: r.lossKwh,
            lossPct: r.lossPct,
          }),
          monthly: monthKeys.map((mKey, idx) => {
            const cell = r.byMonth[mKey]
            const purchasesKwh = cell?.purchasesKwh ?? 0
            const salesKwh = cell?.salesKwh ?? 0
            return toRow(report.monthLabels[idx], {
              purchasesKwh,
              salesKwh,
              postpaidKwh: cell?.postpaidKwh ?? 0,
              prepaidKwh: cell?.prepaidKwh ?? 0,
              streetlightingKwh: cell?.streetlightingKwh ?? 0,
              lossKwh: cell ? purchasesKwh - salesKwh : null,
              lossPct: cell && purchasesKwh > 0 ? ((purchasesKwh - salesKwh) / purchasesKwh) * 100 : null,
            })
          }),
          districts: r.districts.map((d) => ({
            district: d.district,
            // Purchases (BSP) aren't tracked at district granularity, so a
            // district has no honest loss % of its own — purchasesKwh/
            // lossKwh/lossPct stay null here rather than showing a 0 that
            // would read as "no losses," which isn't a claim this data
            // supports.
            totals: toRow("Total", {
              salesKwh: d.totalSalesKwh,
              postpaidKwh: d.totalPostpaidKwh,
              prepaidKwh: d.totalPrepaidKwh,
              streetlightingKwh: d.totalStreetlightingKwh,
            }),
            monthly: monthKeys.map((mKey, idx) => {
              const cell = d.byMonth[mKey]
              return toRow(report.monthLabels[idx], {
                salesKwh: cell?.salesKwh ?? 0,
                postpaidKwh: cell?.postpaidKwh ?? 0,
                prepaidKwh: cell?.prepaidKwh ?? 0,
                streetlightingKwh: cell?.streetlightingKwh ?? 0,
              })
            }),
          })),
        }))
      : []

  return {
    reportType,
    title: reportType === "executive" ? "Energy Accounting — Executive Report" : "Energy Accounting — Detailed Report",
    periodLabel,
    generatedAtLabel: new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
    national,
    narrative: buildNarrative(report.national, report.regions),
    regionRanking,
    regions,
    anomalies: report.anomalies,
    chartImages,
  }
}
