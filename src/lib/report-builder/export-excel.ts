// Renders a BuilderExportData into a downloadable multi-sheet Excel
// workbook -- one sheet per block (its raw groupBy rows, or a single
// summary row for a kpiOnly source like BSP Meter Status), plus a
// Summary sheet naming the report/period/blocks up front. Unlike the
// PDF/PPTX exports, this never captures a chart as an image: a block
// shown on screen as a bar/line chart still exports its underlying
// numbers here, since that's what a spreadsheet is for.
import type { BuilderExportBlock, BuilderExportData } from "@/lib/report-builder/export-data"
import type { MonthlyCombinedSales } from "@/lib/report-builder/combined-sales"

// Excel sheet names: max 31 chars, none of \ / ? * [ ] : , and unique
// within the workbook (sheet "names" are compared case-insensitively).
function sheetNameFor(title: string, index: number, used: Set<string>): string {
  const base = title.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || `Block ${index + 1}`
  let name = base
  let n = 2
  while (used.has(name.toLowerCase())) {
    const suffix = ` (${n})`
    name = `${base.slice(0, 31 - suffix.length)}${suffix}`
    n += 1
  }
  used.add(name.toLowerCase())
  return name
}

function blockToRows(block: BuilderExportBlock): Record<string, string | number>[] {
  if (block.kpi) {
    return [
      {
        Metric: block.kpi.extraLabel || block.valueLabel,
        Numerator: block.kpi.numerator,
        Denominator: block.kpi.denominator,
        "Percent (%)": Math.round(block.kpi.pct * 100) / 100,
      },
    ]
  }
  if (block.total) {
    return [{ [block.valueLabel]: block.total.value, Groups: block.total.groupCount }]
  }
  const rows = block.rows || []
  if (rows.length === 0) return [{ "No data": "No data for this block in the selected range" }]
  return rows.map((r) => ({
    Group: r.label,
    [block.valueLabel]: r.value,
    ...(block.secondaryLabel && r.secondary !== undefined ? { [block.secondaryLabel]: r.secondary } : {}),
  }))
}

// "Combined" sheet rows -- one month block after another (chronological),
// each a region subtotal row (District left blank) immediately followed
// by its district rows (Region left blank), same grouped-outline
// convention region-detail.tsx uses on screen. Month is filled on every
// row (not left blank like Region/District's outline levels) so Excel's
// AutoFilter/pivot still works on it directly. SheetJS's community build
// (the version this project uses) can't apply cell styling (no bold) on
// write, so the blank-Region/blank-District alternation is what visually
// separates the two row kinds here instead.
function combinedSalesToRows(monthly: MonthlyCombinedSales[]): Record<string, string | number>[] {
  const rows: Record<string, string | number>[] = []
  monthly.forEach(({ month, result }) => {
    result.regions.forEach((region) => {
      const regionRow: Record<string, string | number> = { Month: month, Region: region.label, District: "" }
      result.sources.forEach((s) => {
        regionRow[`${s.label} (kWh)`] = region.bySource[s.key] || 0
      })
      regionRow["Total (kWh)"] = region.total
      rows.push(regionRow)

      region.districts.forEach((district) => {
        const districtRow: Record<string, string | number> = { Month: month, Region: "", District: district.label }
        result.sources.forEach((s) => {
          districtRow[`${s.label} (kWh)`] = district.bySource[s.key] || 0
        })
        districtRow["Total (kWh)"] = district.total
        rows.push(districtRow)
      })
    })
  })
  return rows
}

export async function downloadBuilderReportExcel(
  data: BuilderExportData,
  filename: string,
  combined?: MonthlyCombinedSales[],
) {
  const XLSX = await import("xlsx")
  const workbook = XLSX.utils.book_new()

  const summaryRows: Record<string, string>[] = [
    { Field: "Report", Value: data.title },
    { Field: "Period", Value: data.periodLabel },
    { Field: "Generated", Value: data.generatedAtLabel },
    { Field: "", Value: "" },
    { Field: "Blocks", Value: "" },
    ...data.blocks.map((b) => ({ Field: b.title, Value: "" })),
    ...(combined && combined.length > 0
      ? [
          { Field: "", Value: "" },
          { Field: `See "Combined" sheet -- every source matched up by month/region/district (${combined.length} month${combined.length === 1 ? "" : "s"}).`, Value: "" },
        ]
      : []),
  ]
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(summaryRows, { skipHeader: true }),
    "Summary",
  )

  const used = new Set<string>(["summary"])

  if (combined && combined.length > 0) {
    const sheet = XLSX.utils.json_to_sheet(combinedSalesToRows(combined))
    XLSX.utils.book_append_sheet(workbook, sheet, sheetNameFor("Combined", -1, used))
  }

  data.blocks.forEach((block, i) => {
    const sheet = XLSX.utils.json_to_sheet(blockToRows(block))
    XLSX.utils.book_append_sheet(workbook, sheet, sheetNameFor(block.title, i, used))
  })

  XLSX.writeFile(workbook, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`)
}
