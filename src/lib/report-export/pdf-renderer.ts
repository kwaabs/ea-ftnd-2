// Renders a ReportExportData into a downloadable PDF via jsPDF +
// jspdf-autotable. Kept separate from build-report-data.ts (the content
// decision) and pptx-renderer.ts (the other output format) so each file
// only deals with one concern: this one is purely "given the data, lay
// it out on A4 pages."
//
// Layout model: a single running `y` cursor flows continuously down the
// document: every block (a chart image, a section heading + table) is
// placed right after the previous one and only pushed to a fresh page via
// ensureSpace when it genuinely wouldn't fit in what's left of the current
// one. Nothing gets a page to itself just because it's "a new section" --
// a chart image is naturally wide-and-short (capped by page width, so its
// height is whatever the aspect ratio gives), and a one-image-per-page /
// one-table-per-page model left most of every page blank. The title page
// is the one deliberate exception (a report's cover page is conventionally
// its own page).
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { DistrictSection, ReportExportData, RegionSection, ReportTableRow } from "./build-report-data"
import { formatKwhPlain, formatPctPlain } from "./format"

export const PAGE_MARGIN = 40
const BRAND_BLUE = "#1d4ed8"
export const INK = "#0f172a"
export const MUTED = "#64748b"
export const BLOCK_GAP = 22 // vertical gap left after each flowed block

function regionRow(r: ReportTableRow): (string | number)[] {
  return [r.label, formatKwhPlain(r.purchasesKwh), formatKwhPlain(r.salesKwh), formatKwhPlain(r.postpaidKwh), formatKwhPlain(r.prepaidKwh), formatKwhPlain(r.streetlightingKwh), formatKwhPlain(r.lossKwh), formatPctPlain(r.lossPct)]
}

function districtRow(r: ReportTableRow): (string | number)[] {
  return [r.label, formatKwhPlain(r.salesKwh), formatKwhPlain(r.postpaidKwh), formatKwhPlain(r.prepaidKwh), formatKwhPlain(r.streetlightingKwh)]
}

export function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages()
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(MUTED)
    doc.text("Energy Accounting and Monitoring — ECG", PAGE_MARGIN, h - 20)
    doc.text(`Page ${i} of ${pageCount}`, w - PAGE_MARGIN, h - 20, { align: "right" })
  }
}

/** Starts a fresh page (resetting y to the top margin) only if `neededHeight`
 * of content wouldn't fit below the current `y` on the current page --
 * the one primitive the whole flowing layout is built from. */
export function ensureSpace(doc: jsPDF, y: number, neededHeight: number): number {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (y + neededHeight > pageHeight - PAGE_MARGIN) {
    doc.addPage()
    return PAGE_MARGIN
  }
  return y
}

/** A table's height isn't known until jspdf-autotable actually lays it
 * out (word-wrap, row striping, etc. all affect it), so this is a
 * deliberately conservative estimate used only to decide whether a
 * heading would otherwise be stranded alone at the bottom of a page --
 * not an exact figure. A table longer than fits on the remainder of a
 * page still paginates correctly mid-table via autoTable's own built-in
 * page-break handling; this estimate only ever needs to be "right enough"
 * to avoid an orphaned heading. */
export function estimateTableHeight(rowCount: number, rowHeight = 17): number {
  const headerHeight = 22
  return headerHeight + Math.min(rowCount, 5) * rowHeight + 10
}

export function addSectionHeading(doc: jsPDF, text: string, y: number): number {
  doc.setFontSize(14)
  doc.setTextColor(INK)
  doc.setFont("helvetica", "bold")
  doc.text(text, PAGE_MARGIN, y)
  doc.setFont("helvetica", "normal")
  return y + 18
}

function regionTable(doc: jsPDF, startY: number, rows: ReportTableRow[]) {
  autoTable(doc, {
    startY,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    head: [["Month", "Purchases", "Sales", "Postpaid", "Prepaid", "Streetlighting", "Loss", "Loss %"]],
    body: rows.map(regionRow),
    headStyles: { fillColor: [29, 78, 216] },
    styles: { fontSize: 8, cellPadding: 4 },
    theme: "grid",
  })
}

function districtTable(doc: jsPDF, startY: number, rows: ReportTableRow[]) {
  autoTable(doc, {
    startY,
    margin: { left: PAGE_MARGIN + 16, right: PAGE_MARGIN },
    head: [["Month", "Sales", "Postpaid", "Prepaid", "Streetlighting"]],
    body: rows.map(districtRow),
    headStyles: { fillColor: [100, 116, 139] },
    styles: { fontSize: 7.5, cellPadding: 3 },
    theme: "grid",
  })
}

export function finalY(doc: jsPDF): number {
  // jspdf-autotable augments the doc instance with lastAutoTable at
  // runtime -- not in its published types, hence the cast.
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
}

/** Fits an image to the given max width, scaling further down only if
 * that would still overflow maxHeight (e.g. a page fresh out of ensureSpace
 * is still too short for it) -- otherwise the image keeps its natural,
 * width-constrained height rather than being stretched to fill unrelated
 * vertical space. */
export function fitImageSize(pxWidth: number, pxHeight: number, maxW: number, maxH: number): { w: number; h: number } {
  const aspect = pxHeight / pxWidth
  let w = maxW
  let h = w * aspect
  if (h > maxH) {
    h = maxH
    w = h / aspect
  }
  return { w, h }
}

function renderRegionSection(doc: jsPDF, region: RegionSection, y: number): number {
  y = ensureSpace(doc, y, 18 + 14 + estimateTableHeight(region.monthly.length))
  y = addSectionHeading(doc, region.region, y)
  doc.setFontSize(9)
  doc.setTextColor(MUTED)
  doc.text(
    `Purchases ${formatKwhPlain(region.totals.purchasesKwh)} · Sales ${formatKwhPlain(region.totals.salesKwh)} · Streetlighting ${formatKwhPlain(region.totals.streetlightingKwh)} · Loss ${formatPctPlain(region.totals.lossPct)} · ${region.districts.length} district${region.districts.length === 1 ? "" : "s"}`,
    PAGE_MARGIN,
    y,
  )
  y += 12
  regionTable(doc, y, region.monthly)
  y = finalY(doc) + 20

  region.districts.forEach((d: DistrictSection) => {
    y = ensureSpace(doc, y, 20 + estimateTableHeight(d.monthly.length))
    doc.setFontSize(11)
    doc.setTextColor(INK)
    doc.setFont("helvetica", "bold")
    doc.text(d.district, PAGE_MARGIN + 16, y)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(MUTED)
    doc.text(
      `Sales ${formatKwhPlain(d.totals.salesKwh)} · Streetlighting ${formatKwhPlain(d.totals.streetlightingKwh)} (purchases/loss % aren't tracked at district level)`,
      PAGE_MARGIN + 16,
      y + 12,
    )
    y += 20
    districtTable(doc, y, d.monthly)
    y = finalY(doc) + 16
  })

  return y + 6
}

export function renderReportPdf(data: ReportExportData): jsPDF {
  // compress: true enables Flate compression on streams (off by default) --
  // without it, each embedded chart PNG is stored essentially raw, which
  // alone was ballooning an executive report (5 chart images) to 20MB+.
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true })
  const pageWidth = doc.internal.pageSize.getWidth()
  const contentWidth = pageWidth - PAGE_MARGIN * 2

  // -- Title page --
  doc.setFillColor(BRAND_BLUE)
  doc.rect(0, 0, pageWidth, 8, "F")

  let titleY = 100
  if (data.logo) {
    const logoSize = 56
    const aspect = data.logo.height / data.logo.width
    const logoW = logoSize
    const logoH = logoSize * aspect
    doc.addImage(data.logo.dataUrl, "JPEG", PAGE_MARGIN, 32, logoW, logoH)
    titleY = 32 + logoH + 36
  }

  doc.setFontSize(22)
  doc.setTextColor(INK)
  doc.setFont("helvetica", "bold")
  doc.text(data.title, PAGE_MARGIN, titleY)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(12)
  doc.setTextColor(MUTED)
  doc.text(data.periodLabel, PAGE_MARGIN, titleY + 24)
  doc.text(`Generated ${data.generatedAtLabel}`, PAGE_MARGIN, titleY + 42)

  let y = titleY + 80
  if (data.national) {
    y = addSectionHeading(doc, "National summary", y)
    autoTable(doc, {
      startY: y,
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
      body: [
        ["Purchases", formatKwhPlain(data.national.totals.purchasesKwh)],
        ["Sales (Postpaid + Prepaid)", formatKwhPlain(data.national.totals.salesKwh)],
        ["Loss", `${formatKwhPlain(data.national.totals.lossKwh)}  (${formatPctPlain(data.national.totals.lossPct)})`],
        ["Streetlighting", `${formatKwhPlain(data.national.totals.streetlightingKwh)}  (tracked separately, not included in Sales)`],
      ],
      styles: { fontSize: 10, cellPadding: 5 },
      theme: "plain",
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 180 } },
    })
    y = finalY(doc) + 16

    if (data.narrative) {
      doc.setFontSize(9.5)
      doc.setTextColor(INK)
      const narrativeLines = doc.splitTextToSize(data.narrative, contentWidth)
      doc.text(narrativeLines, PAGE_MARGIN, y)
      y += narrativeLines.length * 12 + 16
    }
  }

  // -- From here on: one continuous flow (chart images, then the national
  // monthly table, region ranking, and anomalies), each block placed right
  // after the last and only pushed to a new page when it doesn't fit. --
  doc.addPage()
  y = PAGE_MARGIN

  data.chartImages.forEach((img) => {
    // Compute the image's own natural (width-constrained) size first so
    // ensureSpace can reserve exactly what it needs -- not a guess.
    const natural = fitImageSize(img.width, img.height, contentWidth, Number.POSITIVE_INFINITY)
    const neededHeight = 16 + natural.h
    y = ensureSpace(doc, y, neededHeight)
    // ensureSpace may have just started a fresh page -- re-fit against
    // that page's full available height in case the image is tall enough
    // to still overflow even a blank page (rare, but cheap to guard).
    const pageHeight = doc.internal.pageSize.getHeight()
    const { w, h } = fitImageSize(img.width, img.height, contentWidth, pageHeight - PAGE_MARGIN - y - 16)

    doc.setFontSize(11)
    doc.setTextColor(INK)
    doc.setFont("helvetica", "bold")
    doc.text(img.label, PAGE_MARGIN, y)
    doc.setFont("helvetica", "normal")
    y += 16
    doc.addImage(img.dataUrl, "PNG", PAGE_MARGIN, y, w, h)
    y += h + BLOCK_GAP
  })

  if (data.national) {
    y = ensureSpace(doc, y, 18 + estimateTableHeight(data.national.monthly.length))
    y = addSectionHeading(doc, "National — month by month", y)
    regionTable(doc, y, data.national.monthly)
    y = finalY(doc) + BLOCK_GAP
  }

  if (data.regionRanking.length > 0) {
    y = ensureSpace(doc, y, 18 + estimateTableHeight(data.regionRanking.length))
    y = addSectionHeading(doc, "Region ranking — highest loss % first", y)
    autoTable(doc, {
      startY: y,
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
      head: [["Region", "Districts", "Purchases", "Sales", "Streetlighting", "Loss", "Loss %"]],
      body: data.regionRanking.map((r) => [
        r.region,
        r.districtCount,
        formatKwhPlain(r.purchasesKwh),
        formatKwhPlain(r.salesKwh),
        formatKwhPlain(r.streetlightingKwh),
        formatKwhPlain(r.lossKwh),
        formatPctPlain(r.lossPct),
      ]),
      headStyles: { fillColor: [29, 78, 216] },
      styles: { fontSize: 9, cellPadding: 5 },
      theme: "grid",
    })
    y = finalY(doc) + BLOCK_GAP
  }

  if (data.anomalies.length > 0) {
    y = ensureSpace(doc, y, 18 + estimateTableHeight(data.anomalies.length))
    y = addSectionHeading(doc, "Anomalies — sold more than purchased", y)
    autoTable(doc, {
      startY: y,
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
      head: [["Region", "Purchases", "Sales", "Months affected"]],
      body: data.anomalies.map((a) => [a.region, formatKwhPlain(a.purchasesKwh), formatKwhPlain(a.salesKwh), a.monthsAffected]),
      headStyles: { fillColor: [124, 58, 237] },
      styles: { fontSize: 9, cellPadding: 5 },
      theme: "grid",
    })
    y = finalY(doc) + BLOCK_GAP
  }

  // -- Full region + district drill-down (detailed only) -- continues the
  // same flow; a region only starts a fresh page if it genuinely doesn't
  // fit in what's left, not automatically. --
  if (data.reportType === "detailed") {
    data.regions.forEach((region) => {
      y = renderRegionSection(doc, region, y)
    })
  }

  addFooter(doc)
  return doc
}

export function downloadReportPdf(data: ReportExportData, filename: string) {
  const doc = renderReportPdf(data)
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`)
}
