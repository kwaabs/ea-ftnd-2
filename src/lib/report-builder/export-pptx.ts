// Renders a BuilderExportData into a downloadable PPTX. Mirrors
// pptx-renderer.ts's one-slide-per-block convention (normal deck
// style) rather than pdf-renderer.ts's continuous flow -- a slide deck
// doesn't have the "half-empty page" problem a flowing PDF layout exists
// to solve, so each block just gets its own slide here, same as the
// Executive/Detailed export already does for its charts/tables.
import type PptxGenJS from "pptxgenjs"
import type { BuilderExportBlock, BuilderExportData } from "@/lib/report-builder/export-data"

const BRAND_BLUE = "1D4ED8"
const INK = "0F172A"
const MUTED = "64748B"
const SLIDE_W = 13.33
const SLIDE_H = 7.5
const MARGIN = 0.5

function formatVal(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}M`
  if (abs >= 1_000) return `${(v / 1_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}k`
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 })
}

function addTitleSlide(pptx: PptxGenJS, data: BuilderExportData) {
  const slide = pptx.addSlide()
  slide.background = { color: "FFFFFF" }
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: SLIDE_W, h: 0.12, fill: { color: BRAND_BLUE } })
  slide.addText(data.title, { x: MARGIN, y: 2.4, w: SLIDE_W - MARGIN * 2, h: 1, fontSize: 32, bold: true, color: INK })
  slide.addText(data.periodLabel, { x: MARGIN, y: 3.3, w: SLIDE_W - MARGIN * 2, h: 0.5, fontSize: 16, color: MUTED })
  slide.addText(`Generated ${data.generatedAtLabel}`, { x: MARGIN, y: 3.8, w: SLIDE_W - MARGIN * 2, h: 0.4, fontSize: 12, color: MUTED })
}

function addImageSlide(pptx: PptxGenJS, block: BuilderExportBlock) {
  if (!block.image) return
  const slide = pptx.addSlide()
  slide.addText(block.title, { x: MARGIN, y: 0.3, w: SLIDE_W - MARGIN * 2, h: 0.5, fontSize: 18, bold: true, color: INK })

  const maxW = SLIDE_W - MARGIN * 2
  const maxH = SLIDE_H - 1.1 - MARGIN
  const aspect = block.image.height / block.image.width
  let w = maxW
  let h = w * aspect
  if (h > maxH) {
    h = maxH
    w = h / aspect
  }
  const x = MARGIN + (maxW - w) / 2
  slide.addImage({ data: block.image.dataUrl, x, y: 1.0, w, h })
}

function addTableSlide(pptx: PptxGenJS, block: BuilderExportBlock) {
  const rows = block.rows || []
  const slide = pptx.addSlide()
  slide.addText(block.title, { x: MARGIN, y: 0.3, w: SLIDE_W - MARGIN * 2, h: 0.5, fontSize: 18, bold: true, color: INK })

  const head = ["Group", block.valueLabel, ...(block.secondaryLabel ? [block.secondaryLabel] : [])]
  const headerRow: PptxGenJS.TableRow = head.map((text) => ({
    text,
    options: { bold: true, color: "FFFFFF", fill: { color: BRAND_BLUE }, fontSize: 9 },
  }))
  const bodyRows: PptxGenJS.TableRow[] = rows.map((r) =>
    [r.label, formatVal(r.value), ...(block.secondaryLabel ? [r.secondary !== undefined ? formatVal(r.secondary) : "—"] : [])].map((text) => ({
      text,
      options: { fontSize: 8 },
    })),
  )

  slide.addTable([headerRow, ...bodyRows], {
    x: MARGIN,
    y: 1.0,
    w: SLIDE_W - MARGIN * 2,
    fontSize: 8,
    border: { type: "solid", color: "E2E8F0", pt: 0.5 },
    autoPage: true,
    autoPageRepeatHeader: true,
    autoPageSlideStartY: 0.6,
  })
}

function addTotalSlide(pptx: PptxGenJS, block: BuilderExportBlock) {
  if (!block.total) return
  const slide = pptx.addSlide()
  slide.addText(block.title, { x: MARGIN, y: 0.3, w: SLIDE_W - MARGIN * 2, h: 0.5, fontSize: 18, bold: true, color: INK })
  slide.addText(formatVal(block.total.value), {
    x: MARGIN,
    y: 2.6,
    w: SLIDE_W - MARGIN * 2,
    h: 1,
    fontSize: 40,
    bold: true,
    color: INK,
  })
  slide.addText(`${block.valueLabel} total · ${block.total.groupCount} group(s)`, {
    x: MARGIN,
    y: 3.7,
    w: SLIDE_W - MARGIN * 2,
    h: 0.5,
    fontSize: 16,
    color: MUTED,
  })
}

function addKpiSlide(pptx: PptxGenJS, block: BuilderExportBlock) {
  if (!block.kpi) return
  const slide = pptx.addSlide()
  slide.addText(block.title, { x: MARGIN, y: 0.3, w: SLIDE_W - MARGIN * 2, h: 0.5, fontSize: 18, bold: true, color: INK })
  slide.addText(`${block.kpi.numerator.toLocaleString()} / ${block.kpi.denominator.toLocaleString()}`, {
    x: MARGIN,
    y: 2.6,
    w: SLIDE_W - MARGIN * 2,
    h: 1,
    fontSize: 40,
    bold: true,
    color: INK,
  })
  const extra = [`${block.kpi.pct.toFixed(1)}%`, block.kpi.extraLabel].filter(Boolean).join(" · ")
  slide.addText(extra, { x: MARGIN, y: 3.7, w: SLIDE_W - MARGIN * 2, h: 0.5, fontSize: 16, color: MUTED })
}

export async function renderBuilderReportPptx(data: BuilderExportData): Promise<PptxGenJS> {
  const PptxGenJSCtor = (await import("pptxgenjs")).default
  const pptx = new PptxGenJSCtor()
  pptx.defineLayout({ name: "WIDE", width: SLIDE_W, height: SLIDE_H })
  pptx.layout = "WIDE"

  addTitleSlide(pptx, data)

  data.blocks.forEach((block) => {
    if (block.image) {
      addImageSlide(pptx, block)
    } else if (block.kpi) {
      addKpiSlide(pptx, block)
    } else if (block.total) {
      addTotalSlide(pptx, block)
    } else {
      addTableSlide(pptx, block)
    }
  })

  return pptx
}

export async function downloadBuilderReportPptx(data: BuilderExportData, filename: string) {
  const pptx = await renderBuilderReportPptx(data)
  await pptx.writeFile({ fileName: filename.endsWith(".pptx") ? filename : `${filename}.pptx` })
}
