// Renders a ReportExportData into a downloadable PPTX via pptxgenjs.
// Mirrors pdf-renderer.ts's structure (title / national summary / charts /
// national table / region ranking / anomalies / full region+district
// drill-down for detailed) so the two formats carry the same content, just
// laid out for their own medium -- slides here, paginated A4 there.
import type PptxGenJS from "pptxgenjs"
import type { DistrictSection, ReportExportData, RegionSection, ReportTableRow } from "./build-report-data"
import { formatKwhPlain, formatPctPlain } from "./format"

const BRAND_BLUE = "1D4ED8"
const INK = "0F172A"
const MUTED = "64748B"
const SLIDE_W = 13.33 // 16:9 widescreen, inches
const SLIDE_H = 7.5
const MARGIN = 0.5

type TableRow = PptxGenJS.TableRow

function headerRow(cells: string[]): TableRow {
  return cells.map((text) => ({
    text,
    options: { bold: true, color: "FFFFFF", fill: { color: BRAND_BLUE }, fontSize: 9 },
  }))
}

function regionRowCells(r: ReportTableRow): TableRow {
  return [r.label, formatKwhPlain(r.purchasesKwh), formatKwhPlain(r.salesKwh), formatKwhPlain(r.postpaidKwh), formatKwhPlain(r.prepaidKwh), formatKwhPlain(r.streetlightingKwh), formatKwhPlain(r.lossKwh), formatPctPlain(r.lossPct)].map(
    (text) => ({ text, options: { fontSize: 8 } }),
  )
}

function districtRowCells(r: ReportTableRow): TableRow {
  return [r.label, formatKwhPlain(r.salesKwh), formatKwhPlain(r.postpaidKwh), formatKwhPlain(r.prepaidKwh), formatKwhPlain(r.streetlightingKwh)].map((text) => ({
    text,
    options: { fontSize: 8 },
  }))
}

function addTitleSlide(pptx: PptxGenJS, data: ReportExportData) {
  const slide = pptx.addSlide()
  slide.background = { color: "FFFFFF" }
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: SLIDE_W, h: 0.12, fill: { color: BRAND_BLUE } })
  slide.addText(data.title, { x: MARGIN, y: 2.4, w: SLIDE_W - MARGIN * 2, h: 1, fontSize: 32, bold: true, color: INK })
  slide.addText(data.periodLabel, { x: MARGIN, y: 3.3, w: SLIDE_W - MARGIN * 2, h: 0.5, fontSize: 16, color: MUTED })
  slide.addText(`Generated ${data.generatedAtLabel}`, { x: MARGIN, y: 3.8, w: SLIDE_W - MARGIN * 2, h: 0.4, fontSize: 12, color: MUTED })
}

function addNationalSummarySlide(pptx: PptxGenJS, data: ReportExportData) {
  const slide = pptx.addSlide()
  slide.addText("National summary", { x: MARGIN, y: 0.3, w: SLIDE_W - MARGIN * 2, h: 0.5, fontSize: 20, bold: true, color: INK })

  const kpis: { label: string; value: string }[] = [
    { label: "Purchases", value: formatKwhPlain(data.national.totals.purchasesKwh) },
    { label: "Sales (Postpaid + Prepaid)", value: formatKwhPlain(data.national.totals.salesKwh) },
    { label: "Loss", value: `${formatKwhPlain(data.national.totals.lossKwh)}  (${formatPctPlain(data.national.totals.lossPct)})` },
    { label: "Streetlighting (separate from Sales)", value: formatKwhPlain(data.national.totals.streetlightingKwh) },
  ]
  const kpiW = (SLIDE_W - MARGIN * 2 - 0.3 * 3) / 4
  kpis.forEach((kpi, i) => {
    const x = MARGIN + i * (kpiW + 0.3)
    slide.addShape(pptx.ShapeType.roundRect, { x, y: 1.0, w: kpiW, h: 1.3, fill: { color: "F1F5F9" }, line: { color: "E2E8F0", width: 1 }, rectRadius: 0.08 })
    slide.addText(kpi.label, { x: x + 0.12, y: 1.12, w: kpiW - 0.24, h: 0.4, fontSize: 9, color: MUTED })
    slide.addText(kpi.value, { x: x + 0.12, y: 1.5, w: kpiW - 0.24, h: 0.6, fontSize: 13, bold: true, color: INK })
  })

  slide.addText(data.narrative, { x: MARGIN, y: 2.6, w: SLIDE_W - MARGIN * 2, h: 1.5, fontSize: 12, color: INK, valign: "top" })
}

function addImageSlide(pptx: PptxGenJS, label: string, dataUrl: string, pxWidth: number, pxHeight: number) {
  const slide = pptx.addSlide()
  slide.addText(label, { x: MARGIN, y: 0.3, w: SLIDE_W - MARGIN * 2, h: 0.5, fontSize: 18, bold: true, color: INK })

  const maxW = SLIDE_W - MARGIN * 2
  const maxH = SLIDE_H - 1.1 - MARGIN
  const aspect = pxHeight / pxWidth
  let w = maxW
  let h = w * aspect
  if (h > maxH) {
    h = maxH
    w = h / aspect
  }
  const x = MARGIN + (maxW - w) / 2
  slide.addImage({ data: dataUrl, x, y: 1.0, w, h })
}

function addTable(pptx: PptxGenJS, title: string, head: string[], rows: TableRow[], colW?: number[]) {
  const slide = pptx.addSlide()
  slide.addText(title, { x: MARGIN, y: 0.3, w: SLIDE_W - MARGIN * 2, h: 0.5, fontSize: 18, bold: true, color: INK })
  slide.addTable([headerRow(head), ...rows], {
    x: MARGIN,
    y: 1.0,
    w: SLIDE_W - MARGIN * 2,
    colW,
    fontSize: 8,
    border: { type: "solid", color: "E2E8F0", pt: 0.5 },
    autoPage: true,
    autoPageRepeatHeader: true,
    autoPageSlideStartY: 0.6,
  })
}

function addRegionDrillDown(pptx: PptxGenJS, region: RegionSection) {
  const header = pptx.addSlide()
  header.addText(region.region, { x: MARGIN, y: 0.4, w: SLIDE_W - MARGIN * 2, h: 0.7, fontSize: 26, bold: true, color: INK })
  header.addText(
    `Purchases ${formatKwhPlain(region.totals.purchasesKwh)} · Sales ${formatKwhPlain(region.totals.salesKwh)} · Streetlighting ${formatKwhPlain(region.totals.streetlightingKwh)} · Loss ${formatPctPlain(region.totals.lossPct)} · ${region.districts.length} district${region.districts.length === 1 ? "" : "s"}`,
    { x: MARGIN, y: 1.3, w: SLIDE_W - MARGIN * 2, h: 0.6, fontSize: 13, color: MUTED },
  )

  addTable(
    pptx,
    `${region.region} — month by month`,
    ["Month", "Purchases", "Sales", "Postpaid", "Prepaid", "Streetlighting", "Loss", "Loss %"],
    region.monthly.map(regionRowCells),
  )

  region.districts.forEach((d: DistrictSection) => {
    addTable(pptx, `${region.region} — ${d.district}`, ["Month", "Sales", "Postpaid", "Prepaid", "Streetlighting"], d.monthly.map(districtRowCells))
  })
}

export async function renderReportPptx(data: ReportExportData): Promise<PptxGenJS> {
  const PptxGenJSCtor = (await import("pptxgenjs")).default
  const pptx = new PptxGenJSCtor()
  pptx.defineLayout({ name: "WIDE", width: SLIDE_W, height: SLIDE_H })
  pptx.layout = "WIDE"

  addTitleSlide(pptx, data)
  addNationalSummarySlide(pptx, data)

  data.chartImages.forEach((img) => addImageSlide(pptx, img.label, img.dataUrl, img.width, img.height))

  addTable(pptx, "National — month by month", ["Month", "Purchases", "Sales", "Postpaid", "Prepaid", "Streetlighting", "Loss", "Loss %"], data.national.monthly.map(regionRowCells))

  addTable(
    pptx,
    "Region ranking — highest loss % first",
    ["Region", "Districts", "Purchases", "Sales", "Streetlighting", "Loss", "Loss %"],
    data.regionRanking.map((r) =>
      [r.region, String(r.districtCount), formatKwhPlain(r.purchasesKwh), formatKwhPlain(r.salesKwh), formatKwhPlain(r.streetlightingKwh), formatKwhPlain(r.lossKwh), formatPctPlain(r.lossPct)].map(
        (text) => ({ text, options: { fontSize: 8 } }),
      ),
    ),
  )

  if (data.anomalies.length > 0) {
    addTable(
      pptx,
      "Anomalies — sold more than purchased",
      ["Region", "Purchases", "Sales", "Months affected"],
      data.anomalies.map((a) => [a.region, formatKwhPlain(a.purchasesKwh), formatKwhPlain(a.salesKwh), String(a.monthsAffected)].map((text) => ({ text, options: { fontSize: 9 } }))),
    )
  }

  if (data.reportType === "detailed") {
    data.regions.forEach((region) => addRegionDrillDown(pptx, region))
  }

  return pptx
}

export async function downloadReportPptx(data: ReportExportData, filename: string) {
  const pptx = await renderReportPptx(data)
  await pptx.writeFile({ fileName: filename.endsWith(".pptx") ? filename : `${filename}.pptx` })
}
