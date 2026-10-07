// Report Builder export types (Phase 2). One block on the canvas becomes
// one BuilderExportBlock: a bar/line block carries a captured chart
// image (same DOM-capture approach GenerateReportDialog already uses —
// see captureElementAsPngDataUrl), a table block carries its raw rows
// (rendered as a real table in the output, not a screenshot, so it stays
// text/selectable), and a kpi block carries the summed total. Kept
// separate from src/lib/report-export/build-report-data.ts's
// ReportExportData — that type is shaped around the fixed Executive/
// Detailed region->district->month report, which has nothing to do with
// an arbitrary user-composed set of blocks.
import type { Visualization } from "@/lib/report-builder/types"

export interface BuilderExportRow {
  label: string
  value: number
  secondary?: number
}

export interface BuilderExportBlock {
  title: string
  visualization: Visualization
  valueLabel: string
  secondaryLabel?: string
  image?: { dataUrl: string; width: number; height: number }
  rows?: BuilderExportRow[]
  /** A kpiOnly source (e.g. BSP Meter Status) -- a real numerator/
   * denominator, not just a summed total. */
  kpi?: { numerator: number; denominator: number; pct: number; extraLabel?: string }
  /** A regular (non-kpiOnly) source the user chose to view as a KPI --
   * just the summed total of its rows' values, same number the on-screen
   * card itself shows in that mode. Mutually exclusive with `kpi` above:
   * a block is always exactly one of image / rows / kpi / total. */
  total?: { value: number; groupCount: number }
}

export interface BuilderExportData {
  title: string
  periodLabel: string
  generatedAtLabel: string
  blocks: BuilderExportBlock[]
}
