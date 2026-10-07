import type { DataSourceKey } from "@/lib/report-builder/data-sources"

export type Visualization = "table" | "bar" | "line" | "kpi"

export interface ReportBlock {
  id: string
  dataSource: DataSourceKey
  groupBy?: string
  visualization: Visualization
  title?: string
  /** react-grid-layout position/size, keyed by block id elsewhere -- kept
   * off this type itself since the grid library owns its own Layout[]
   * array; see builder-page.tsx. */
}
