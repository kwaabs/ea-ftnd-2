// Renders a BuilderExportData (an arbitrary, user-composed list of
// blocks) into a downloadable PDF. Reuses pdf-renderer.ts's generic
// flowing-layout primitives (ensureSpace/fitImageSize/estimateTableHeight/
// finalY/addSectionHeading/addFooter) rather than re-implementing them —
// those were always generic, just not exported until this needed them.
// Same continuous-flow model as the Executive/Detailed report: a block is
// only pushed to a fresh page when it genuinely wouldn't fit in what's
// left of the current one, not automatically.
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import {
  PAGE_MARGIN,
  INK,
  MUTED,
  BLOCK_GAP,
  ensureSpace,
  estimateTableHeight,
  fitImageSize,
  finalY,
  addSectionHeading,
  addFooter,
} from "@/lib/report-export/pdf-renderer"
import type { BuilderExportBlock, BuilderExportData } from "@/lib/report-builder/export-data"

function formatVal(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}M`
  if (abs >= 1_000) return `${(v / 1_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}k`
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 })
}

function renderImageBlock(doc: jsPDF, block: BuilderExportBlock, y: number, contentWidth: number): number {
  if (!block.image) return y
  const natural = fitImageSize(block.image.width, block.image.height, contentWidth, Number.POSITIVE_INFINITY)
  y = ensureSpace(doc, y, 16 + natural.h)
  const pageHeight = doc.internal.pageSize.getHeight()
  const { w, h } = fitImageSize(block.image.width, block.image.height, contentWidth, pageHeight - PAGE_MARGIN - y - 16)

  doc.setFontSize(11)
  doc.setTextColor(INK)
  doc.setFont("helvetica", "bold")
  doc.text(block.title, PAGE_MARGIN, y)
  doc.setFont("helvetica", "normal")
  y += 16
  doc.addImage(block.image.dataUrl, "PNG", PAGE_MARGIN, y, w, h)
  return y + h + BLOCK_GAP
}

function renderTableBlock(doc: jsPDF, block: BuilderExportBlock, y: number): number {
  const rows = block.rows || []
  y = ensureSpace(doc, y, 18 + estimateTableHeight(rows.length))
  y = addSectionHeading(doc, block.title, y)

  const head = [["Group", block.valueLabel, ...(block.secondaryLabel ? [block.secondaryLabel] : [])]]
  const body = rows.map((r) => [r.label, formatVal(r.value), ...(block.secondaryLabel ? [r.secondary !== undefined ? formatVal(r.secondary) : "—"] : [])])

  autoTable(doc, {
    startY: y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    head,
    body,
    headStyles: { fillColor: [29, 78, 216] },
    styles: { fontSize: 8, cellPadding: 4 },
    theme: "grid",
  })
  return finalY(doc) + BLOCK_GAP
}

function renderTotalBlock(doc: jsPDF, block: BuilderExportBlock, y: number): number {
  if (!block.total) return y
  y = ensureSpace(doc, y, 60)
  y = addSectionHeading(doc, block.title, y)
  doc.setFontSize(20)
  doc.setTextColor(INK)
  doc.setFont("helvetica", "bold")
  doc.text(formatVal(block.total.value), PAGE_MARGIN, y + 10)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(MUTED)
  doc.text(`${block.valueLabel} total · ${block.total.groupCount} group(s)`, PAGE_MARGIN, y + 28)
  return y + 48 + BLOCK_GAP
}

function renderKpiBlock(doc: jsPDF, block: BuilderExportBlock, y: number): number {
  if (!block.kpi) return y
  y = ensureSpace(doc, y, 60)
  y = addSectionHeading(doc, block.title, y)
  doc.setFontSize(20)
  doc.setTextColor(INK)
  doc.setFont("helvetica", "bold")
  doc.text(`${block.kpi.numerator.toLocaleString()} / ${block.kpi.denominator.toLocaleString()}`, PAGE_MARGIN, y + 10)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(MUTED)
  const extra = [`${block.kpi.pct.toFixed(1)}%`, block.kpi.extraLabel].filter(Boolean).join(" · ")
  doc.text(extra, PAGE_MARGIN, y + 28)
  return y + 48 + BLOCK_GAP
}

export function renderBuilderReportPdf(data: BuilderExportData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true })
  const pageWidth = doc.internal.pageSize.getWidth()
  const contentWidth = pageWidth - PAGE_MARGIN * 2

  doc.setFontSize(22)
  doc.setTextColor(INK)
  doc.setFont("helvetica", "bold")
  doc.text(data.title, PAGE_MARGIN, 100)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(12)
  doc.setTextColor(MUTED)
  doc.text(data.periodLabel, PAGE_MARGIN, 124)
  doc.text(`Generated ${data.generatedAtLabel}`, PAGE_MARGIN, 142)

  doc.addPage()
  let y = PAGE_MARGIN

  data.blocks.forEach((block) => {
    if (block.image) {
      y = renderImageBlock(doc, block, y, contentWidth)
    } else if (block.kpi) {
      y = renderKpiBlock(doc, block, y)
    } else if (block.total) {
      y = renderTotalBlock(doc, block, y)
    } else {
      y = renderTableBlock(doc, block, y)
    }
  })

  addFooter(doc)
  return doc
}

export function downloadBuilderReportPdf(data: BuilderExportData, filename: string) {
  const doc = renderBuilderReportPdf(data)
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`)
}
