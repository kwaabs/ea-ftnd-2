"use client"

import { useMemo } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { BarChart3, LineChart as LineChartIcon, Table2, Gauge, X, GripVertical } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DATA_SOURCES } from "@/lib/report-builder/data-sources"
import type { ReportBlock, Visualization } from "@/lib/report-builder/types"
import { useReportBuilderData, type ReportBuilderFilters } from "@/hooks/api/use-report-builder-data"

// Tailwind only resolves classes it can see as complete literal strings in
// source -- a template like `text-${color}-700` is invisible to its
// scanner and silently renders unstyled. Every color this file can hit
// (data-sources.ts's DataSourceDef.color values) is spelled out here so
// the real classes ship in the build.
const COLOR_CLASSES: Record<string, { border: string; text: string; bg: string; fill: string }> = {
  blue: { border: "border-blue-300", text: "text-blue-700", bg: "bg-blue-50", fill: "#2563eb" },
  indigo: { border: "border-indigo-300", text: "text-indigo-700", bg: "bg-indigo-50", fill: "#4f46e5" },
  violet: { border: "border-violet-300", text: "text-violet-700", bg: "bg-violet-50", fill: "#7c3aed" },
  cyan: { border: "border-cyan-300", text: "text-cyan-700", bg: "bg-cyan-50", fill: "#0891b2" },
  green: { border: "border-green-300", text: "text-green-700", bg: "bg-green-50", fill: "#16a34a" },
  amber: { border: "border-amber-300", text: "text-amber-700", bg: "bg-amber-50", fill: "#d97706" },
  purple: { border: "border-purple-300", text: "text-purple-700", bg: "bg-purple-50", fill: "#9333ea" },
  teal: { border: "border-teal-300", text: "text-teal-700", bg: "bg-teal-50", fill: "#0d9488" },
  orange: { border: "border-orange-300", text: "text-orange-700", bg: "bg-orange-50", fill: "#ea580c" },
  rose: { border: "border-rose-300", text: "text-rose-700", bg: "bg-rose-50", fill: "#e11d48" },
  fuchsia: { border: "border-fuchsia-300", text: "text-fuchsia-700", bg: "bg-fuchsia-50", fill: "#c026d3" },
  sky: { border: "border-sky-300", text: "text-sky-700", bg: "bg-sky-50", fill: "#0284c7" },
  slate: { border: "border-slate-300", text: "text-slate-700", bg: "bg-slate-50", fill: "#475569" },
  emerald: { border: "border-emerald-300", text: "text-emerald-700", bg: "bg-emerald-50", fill: "#059669" },
  lime: { border: "border-lime-300", text: "text-lime-700", bg: "bg-lime-50", fill: "#65a30d" },
}

function formatValue(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}M`
  if (abs >= 1_000) return `${(value / 1_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}k`
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 })
}

const VIZ_ICON: Record<Visualization, typeof Table2> = {
  table: Table2,
  bar: BarChart3,
  line: LineChartIcon,
  kpi: Gauge,
}

interface ReportBlockCardProps {
  block: ReportBlock
  filters: ReportBuilderFilters
  onChange: (patch: Partial<ReportBlock>) => void
  onRemove: () => void
  /** Drag handle class react-grid-layout targets via draggableHandle -- see builder-page.tsx. */
  dragHandleClassName: string
}

export function ReportBlockCard({ block, filters, onChange, onRemove, dragHandleClassName }: ReportBlockCardProps) {
  const def = DATA_SOURCES[block.dataSource]
  const colors = COLOR_CLASSES[def.color] ?? COLOR_CLASSES.slate
  const data = useReportBuilderData(block.dataSource, filters, block.groupBy)

  const chartRows = useMemo(() => data.rows.slice(0, 20), [data.rows])
  const kpiTotal = useMemo(() => data.rows.reduce((s, r) => s + r.value, 0), [data.rows])

  const VizIcon = VIZ_ICON[block.visualization]

  return (
    <Card className={`h-full flex flex-col ${colors.border} border-2`}>
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className={`flex items-center gap-1.5 shrink-0 cursor-move ${dragHandleClassName}`}>
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-semibold ${colors.text} truncate`}>{def.label}</div>
            <div className="text-[11px] text-muted-foreground truncate">{def.description}</div>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 text-muted-foreground hover:text-red-600"
            title="Remove block"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {!def.kpiOnly && def.groupByOptions.length > 0 && (
            <Select value={block.groupBy || def.defaultGroupBy} onValueChange={(v) => onChange({ groupBy: v })}>
              <SelectTrigger className="h-7 text-xs w-[130px]">
                <SelectValue placeholder="Group by" />
              </SelectTrigger>
              <SelectContent>
                {def.groupByOptions.map((g) => (
                  <SelectItem key={g.value} value={g.value} className="text-xs">
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {!def.kpiOnly && (
            <Select value={block.visualization} onValueChange={(v) => onChange({ visualization: v as Visualization })}>
              <SelectTrigger className="h-7 text-xs w-[110px]">
                <VizIcon className="h-3.5 w-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="table" className="text-xs">Table</SelectItem>
                <SelectItem value="bar" className="text-xs">Bar chart</SelectItem>
                <SelectItem value="line" className="text-xs">Line chart</SelectItem>
                <SelectItem value="kpi" className="text-xs">KPI</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-hidden pb-3">
        {data.isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : data.isError ? (
          <p className="text-xs text-red-600 py-4">Failed to load this block&apos;s data.</p>
        ) : def.kpiOnly ? (
          data.kpi ? (
            <div className="h-full flex flex-col items-center justify-center">
              <div className={`text-3xl font-bold ${colors.text}`}>
                {data.kpi.numerator}
                <span className="text-lg font-semibold text-muted-foreground">/{data.kpi.denominator}</span>
              </div>
              <div className={`text-sm ${colors.text} mt-1`}>
                {data.kpi.pct.toFixed(1)}% {data.kpi.extraLabel ? `· ${data.kpi.extraLabel}` : ""}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-4 text-center">No data for this window.</p>
          )
        ) : chartRows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No data for this window/filter.</p>
        ) : block.visualization === "kpi" ? (
          <div className="h-full flex flex-col items-center justify-center">
            <div className={`text-3xl font-bold ${colors.text}`}>{formatValue(kpiTotal)}</div>
            <div className="text-xs text-muted-foreground mt-1">{def.valueLabel} total · {data.rows.length} group(s)</div>
          </div>
        ) : block.visualization === "bar" ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 8, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" angle={-30} textAnchor="end" tick={{ fontSize: 10 }} interval={0} />
              <YAxis tickFormatter={formatValue} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [formatValue(v), def.valueLabel]} />
              <Bar dataKey="value" fill={colors.fill} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        ) : block.visualization === "line" ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartRows} margin={{ top: 8, right: 8, left: 8, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" angle={-30} textAnchor="end" tick={{ fontSize: 10 }} interval={0} />
              <YAxis tickFormatter={formatValue} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [formatValue(v), def.valueLabel]} />
              <Line type="monotone" dataKey="value" stroke={colors.fill} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Group</TableHead>
                  <TableHead className="text-xs text-right">{def.valueLabel}</TableHead>
                  {def.secondaryLabel && <TableHead className="text-xs text-right">{def.secondaryLabel}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow key={r.label}>
                    <TableCell className="text-xs">{r.label}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{formatValue(r.value)}</TableCell>
                    {def.secondaryLabel && (
                      <TableCell className="text-xs text-right tabular-nums">
                        {r.secondary !== undefined ? formatValue(r.secondary) : "—"}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
