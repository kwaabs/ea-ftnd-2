// Shared formatting/color helpers for the Reports page's components
// (purchases-sales-report-view.tsx and purchases-sales-loss-map.tsx) — one
// source of truth so the color ramp and number formatting can't drift
// between the heat map, the ranking table, and the loss map.
import type { RegionMonthCell } from "@/hooks/api/use-purchases-sales-report"

export function formatKwh(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000)
    return `${(value / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GWh`
  if (abs >= 1_000)
    return `${(value / 1_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MWh`
  return `${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh`
}

export function formatPct(value: number | null): string {
  if (value === null) return "—"
  return `${value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

// Explicit unit suffix (GWh/MWh/kWh), not a bare "M"/"k" -- this is
// electricity data and an unlabeled "89M" doesn't say 89M of what.
export function formatAxisKwh(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} GWh`
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1)} MWh`
  return `${v.toFixed(0)} kWh`
}

/** Severity relative to the network's own average loss % this period, not an
 * asserted industry-standard threshold — a region well above the network's
 * own average is the meaningful "worse than normal for this data" signal. */
export function lossSeverityClass(lossPct: number | null, nationalAvgPct: number | null): string {
  if (lossPct === null) return "text-muted-foreground"
  if (nationalAvgPct === null || nationalAvgPct <= 0) return "text-foreground"
  if (lossPct > nationalAvgPct * 1.25) return "text-red-700 font-semibold"
  if (lossPct > nationalAvgPct * 0.9) return "text-amber-700 font-medium"
  return "text-emerald-700"
}

export function mixRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}
export function rgbToCss([r, g, b]: [number, number, number]): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
}

// Absolute loss % bands, used by the heat map and the loss map. This used
// to be relative to a supplied national average, but that average can
// itself be zero or negative in a given month (net sales briefly exceeding
// net purchases network-wide) -- dividing by that collapsed every single
// cell to one flat color whenever it happened, which is common enough in
// this data to make the whole table look broken. Fixed reference bands
// keep showing real region-to-region variation regardless of what any one
// month's national number does. Returns RGB (not a CSS string) so the same
// value can drive both a fill color and its text-color contrast decision
// without re-parsing a string.
export function lossHeatRgb(lossPct: number | null): [number, number, number] {
  const NO_DATA: [number, number, number] = [241, 245, 249] // slate-100
  // Sold more than it bought -- a data/timing mismatch between sources
  // (flagged explicitly in the anomalies card), not genuine over-performance,
  // so it gets its own color rather than reading as "great, deep green".
  const ANOMALY: [number, number, number] = [124, 58, 237] // violet-600
  const GREEN: [number, number, number] = [5, 150, 105] // emerald-600
  const AMBER: [number, number, number] = [245, 158, 11] // amber-500
  const RED: [number, number, number] = [185, 28, 28] // red-700
  if (lossPct === null) return NO_DATA
  if (lossPct < 0) return ANOMALY
  if (lossPct <= 10) return mixRgb(GREEN, AMBER, lossPct / 10)
  if (lossPct <= 30) return mixRgb(AMBER, RED, (lossPct - 10) / 20)
  return RED
}

// Per-metric hue for the single-quantity heat maps (Purchases/Prepaid/
// Postpaid/Streetlighting) — reuses this app's own already-established
// per-source colors (the same blue/emerald/indigo/amber used throughout
// the dashboard, customer-sales views, and this report's own trend chart)
// rather than introducing a fresh palette, so a color still means the same
// thing everywhere in the app.
export const METRIC_HEAT_HUES: Record<"purchases" | "prepaid" | "postpaid" | "streetlighting", [number, number, number]> = {
  purchases: [29, 78, 216], // blue-700 — matches this report's own Purchases series color (#1d4ed8)
  prepaid: [5, 150, 105], // emerald-600 — matches Sales/MMS Prepaid elsewhere in the app
  postpaid: [79, 70, 229], // indigo-600 — matches AMR/Postpaid elsewhere in the app
  streetlighting: [202, 138, 4], // amber-600 — matches Streetlighting everywhere in the app
}

/** Sequential (one hue, light→dark) magnitude heat color — unlike
 * lossHeatRgb's diverging green/amber/red severity scale, a single-quantity
 * map (how much kWh, not how bad a %) has no "good/bad" polarity, so it
 * gets one hue ramped by share of the table's own max value instead.
 * sqrt(t) spreads the low-to-mid range out more than a linear ramp would —
 * this data is typically a few big regions and many small ones, and a
 * linear ramp would leave most cells looking identically pale. */
export function magnitudeHeatRgb(value: number, maxValue: number, hue: [number, number, number]): [number, number, number] {
  const NO_DATA: [number, number, number] = [241, 245, 249] // slate-100, same treatment as lossHeatRgb
  if (value <= 0 || maxValue <= 0) return NO_DATA
  const LIGHT: [number, number, number] = [248, 250, 252] // slate-50 — near-surface tint for "near zero"
  const t = Math.sqrt(Math.min(1, value / maxValue))
  return mixRgb(LIGHT, hue, t)
}

/** Readable text color (near-black vs near-white) against a given heat
 * color background, so labels stay legible across the whole green-to-red
 * range instead of assuming one fixed text color works everywhere. */
export function readableTextOn([r, g, b]: [number, number, number]): string {
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? "#1e293b" : "#ffffff"
}

/** Loss % for a single region-month cell — shared by the heat map and the
 * per-region trend indicator so the formula can't drift between them. */
export function cellLossPct(cell: RegionMonthCell | undefined): number | null {
  if (!cell || cell.purchasesKwh <= 0) return null
  return ((cell.purchasesKwh - cell.salesKwh) / cell.purchasesKwh) * 100
}

/** First-half vs second-half average loss % for one region across the
 * selected window — the same "is this getting better or worse" question
 * the page's national narrative already answers, just per region so the
 * ranking table (and the loss map's side panel) can show it inline instead
 * of making you read the headline sentence for the network as a whole and
 * guess whether it applies to the region you're actually looking at. */
export function regionTrendDelta(byMonth: Record<string, RegionMonthCell>, monthKeys: string[]): number | null {
  const withLoss = monthKeys.map((k) => cellLossPct(byMonth[k])).filter((v): v is number => v !== null)
  if (withLoss.length < 2) return null
  const mid = Math.floor(withLoss.length / 2)
  const avg = (vals: number[]) => vals.reduce((s, v) => s + v, 0) / vals.length
  return avg(withLoss.slice(mid)) - avg(withLoss.slice(0, mid))
}
