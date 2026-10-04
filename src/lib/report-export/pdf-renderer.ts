// Renders a ReportExportData into a downloadable PDF via jsPDF +
// jspdf-autotable. Kept separate from build-report-data.ts (the content
// decision) and pptx-renderer.ts (the other output format) so each file
// only deals with one concern: this one is purely "given the data, lay
// it out on A4 pages."
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { DistrictSection, ReportExportData, RegionSection, ReportTableRow } from "./build-report-data"
import { formatKwhPlain, formatPctPlain } from "./format"

const PAGE_MARGIN = 40
const BRAND_BLUE = "#1d4ed8"
const INK = "#0f172a"
const MUTED = "#64748b"

function regionRow(r: ReportTableRow): (string | number)[] {
  return [r.label, formatKwhPlain(r.purchasesKwh), formatKwhPlain(r.salesKwh), formatKwhPlain(r.postpaidKwh), formatKwhPlain(r.prepaidKwh), formatKwhPlain(r.streetlightingKwh), formatKwhPlain(r.lossKwh), formatPctPlain(r.lossPct)]
}

function districtRow(r: ReportTableRow): (string | number)[] {
  return [r.label, formatKwhPlain(r.salesKwh), formatKwhPlain(r.postpaidKwh), formatKwhPlain(r.prepaidKwh), formatKwhPlain(r.streetlightingKwh)]
}

function addFooter(doc: jsPDF) {
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

function addImageFitted(doc: jsPDF, dataUrl: string, pxWidth: number, pxHeight: number, y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const maxW = pageWidth - PAGE_MARGIN * 2
  const maxAvailableH = pageHeight - PAGE_MARGIN - y
  const aspect = pxHeight / pxWidth
  let w = maxW
  let h = w * aspect
  if (h > maxAvailableH) {
    h = maxAvailableH
    w = h / aspect
  }
  doc.addImage(dataUrl, "PNG", PAGE_MARGIN, y, w, h)
  return y + h
}

function addSectionHeading(doc: jsPDF, text: string, y: number): number {
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

function finalY(doc: jsPDF): number {
  // jspdf-autotable augments the doc instance with lastAutoTable at
  // runtime -- not in its published types, hence the cast.
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
}

function renderRegionSection(doc: jsPDF, region: RegionSection) {
  doc.addPage()
  let y = PAGE_MARGIN
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
    const estRows = d.monthly.length + 2
    const estHeight = estRows * 16 + 40
    if (y + estHeight > doc.internal.pageSize.getHeight() - PAGE_MARGIN) {
      doc.addPage()
      y = PAGE_MARGIN
    }
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
}

export function renderReportPdf(data: ReportExportData): jsPDF {
  // compress: true enables Flate compression on streams (off by default) --
  // without it, each embedded chart PNG is stored essentially raw, which
  // alone was ballooning an executive report (5 chart images) to 20MB+.
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true })
  const pageWidth = doc.internal.pageSize.getWidth()

  // -- Title page --
  doc.setFillColor(BRAND_BLUE)
  doc.rect(0, 0, pageWidth, 8, "F")
  doc.setFontSize(22)
  doc.setTextColor(INK)
  doc.setFont("helvetica", "bold")
  doc.text(data.title, PAGE_MARGIN, 100)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(12)
  doc.setTextColor(MUTED)
  doc.text(data.periodLabel, PAGE_MARGIN, 124)
  doc.text(`Generated ${data.generatedAtLabel}`, PAGE_MARGIN, 142)

  let y = 180
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

  doc.setFontSize(9.5)
  doc.setTextColor(INK)
  const narrativeLines = doc.splitTextToSize(data.narrative, pageWidth - PAGE_MARGIN * 2)
  doc.text(narrativeLines, PAGE_MARGIN, y)
  y += narrativeLines.length * 12 + 16

  // -- Chart images (one per page from here, each sized to fit) --
  data.chartImages.forEach((img) => {
    doc.addPage()
    let iy = PAGE_MARGIN
    doc.setFontSize(11)
    doc.setTextColor(INK)
    doc.setFont("helvetica", "bold")
    doc.text(img.label, PAGE_MARGIN, iy)
    doc.setFont("helvetica", "normal")
    iy += 16
    addImageFitted(doc, img.dataUrl, img.width, img.height, iy)
  })

  // -- National monthly table --
  doc.addPage()
  y = PAGE_MARGIN
  y = addSectionHeading(doc, "National — month by month", y)
  regionTable(doc, y, data.national.monthly)

  // -- Region ranking (always included, executive stops here) --
  doc.addPage()
  y = PAGE_MARGIN
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
  y = finalY(doc) + 20

  if (data.anomalies.length > 0) {
    if (y > doc.internal.pageSize.getHeight() - 120) {
      doc.addPage()
      y = PAGE_MARGIN
    }
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
  }

  // -- Full region + district drill-down (detailed only) --
  if (data.reportType === "detailed") {
    data.regions.forEach((region) => renderRegionSection(doc, region))
  }

  addFooter(doc)
  return doc
}

export function downloadReportPdf(data: ReportExportData, filename: string) {
  const doc = renderReportPdf(data)
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`)
}
