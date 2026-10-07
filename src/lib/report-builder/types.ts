import type { DataSourceKey } from "@/lib/report-builder/data-sources"

export type Visualization = "table" | "bar" | "line" | "kpi"

export interface ReportBlock {
  id: string
  dataSource: DataSourceKey
  groupBy?: string
  visualization: Visualization
  title?: string
  /** Set by clicking a drillable bar/row (see GroupByOption.drillTo) --
   * overrides the canvas's global region filter for THIS block only,
   * scoping it to whatever was clicked, independent of whatever the
   * global Region filter is set to. Cleared via the block's own "Scoped
   * to: X" badge. */
  drillRegion?: string
  /** react-grid-layout position/size, keyed by block id elsewhere -- kept
   * off this type itself since the grid library owns its own Layout[]
   * array; see builder-page.tsx. */
}
