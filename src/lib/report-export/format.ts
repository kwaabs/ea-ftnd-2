// Plain-text number formatting shared by the PDF and PPTX renderers --
// deliberately not reusing report-format.ts's formatKwh/formatPct, which
// return JSX-adjacent strings tuned for the on-screen table; a printed
// report reads better with units spelled out per cell rather than
// GWh/MWh/kWh auto-scaling per value (auto-scaling makes a column of
// numbers hard to compare at a glance on paper).

export function formatKwhPlain(value: number | null): string {
  if (value === null) return "—"
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 0 })} kWh`
}

export function formatPctPlain(value: number | null): string {
  if (value === null) return "—"
  return `${value.toFixed(1)}%`
}
