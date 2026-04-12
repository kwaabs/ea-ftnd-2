"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    ReferenceLine,
    Legend,
} from "recharts"
import {
    MapPin,
    ArrowRight,
    TrendingUp,
    TrendingDown,
    Search,
    ChevronDown,
    ChevronUp,
    ChevronsUpDown,
    ArrowUpDown,
} from "lucide-react"
import type { ExpressFeederAggregateResult, FeederDetail } from "@/hooks/api/use-express-feeder-api"

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(v: number) {
    return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtShort(v: number) {
    const abs = Math.abs(v)
    if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}K`
    return v.toFixed(1)
}

type SortDir = "asc" | "desc"
type StationSort = "name" | "import" | "export" | "net" | "feeders"

interface Props {
    aggregate: ExpressFeederAggregateResult | undefined
    feeders: FeederDetail[]
}

// ─── KPI card ───────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
    return (
        <div className="rounded-lg border p-4 flex flex-col gap-1" style={{ borderColor: `${color}30`, background: `${color}06` }}>
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
            <span className="text-xl font-bold tabular-nums" style={{ color }}>{value}</span>
            {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
        </div>
    )
}

// ─── Sortable column header ──────────────────────────────────────────────────

function SortHeader({
                        label, col, sort, dir, onClick,
                    }: { label: string; col: StationSort; sort: StationSort; dir: SortDir; onClick: () => void }) {
    const active = sort === col
    return (
        <TableHead
            className="cursor-pointer select-none hover:text-foreground text-right"
            onClick={onClick}
        >
      <span className="inline-flex items-center gap-1 justify-end">
        {label}
          {active ? (
              dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
          ) : (
              <ChevronsUpDown className="h-3 w-3 opacity-30" />
          )}
      </span>
        </TableHead>
    )
}

// ─── Expandable station row ──────────────────────────────────────────────────

function StationRow({
                        idx, station, region, district, importKwh, exportKwh, net, feederCount, feedersForStation, side,
                    }: {
    idx: number
    station: string
    region: string
    district?: string
    importKwh: number
    exportKwh: number
    net: number
    feederCount: number
    feedersForStation: FeederDetail[]
    side: "sending" | "receiving"
}) {
    const [open, setOpen] = useState(false)
    const maxImport = Math.max(...feedersForStation.map(f =>
        side === "sending" ? f.sendingMeter.importKwh : f.receivingMeter.importKwh
    ), 1)

    return (
        <>
            <TableRow
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setOpen((o) => !o)}
            >
                <TableCell className="text-muted-foreground text-xs w-8">{idx + 1}</TableCell>
                <TableCell>
                    <div className="font-medium text-sm">{station}</div>
                    <div className="text-[10px] text-muted-foreground">{district ? `${district}, ` : ""}{region}</div>
                </TableCell>
                <TableCell className="text-right">
                    <Badge variant="outline" className="text-xs">{feederCount}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums text-green-700 font-medium text-xs">{fmt(importKwh)}</TableCell>
                <TableCell className="text-right tabular-nums text-blue-700 font-medium text-xs">{fmt(exportKwh)}</TableCell>
                <TableCell className={`text-right tabular-nums font-bold text-xs ${net >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {net >= 0 ? "+" : ""}{fmt(net)}
                </TableCell>
                <TableCell className="w-8">
                    {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </TableCell>
            </TableRow>

            {open && feedersForStation.length > 0 && (
                <TableRow className="bg-muted/10 hover:bg-muted/10">
                    <TableCell colSpan={7} className="p-0">
                        <div className="px-6 py-3 space-y-2">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                Feeders from {station}
                            </p>
                            {feedersForStation.map((f) => {
                                const meter = side === "sending" ? f.sendingMeter : f.receivingMeter
                                const otherStation = side === "sending" ? f.receivingMeter.station : f.sendingMeter.station
                                const barPct = (meter.importKwh / maxImport) * 100

                                return (
                                    <div key={f.feederName} className="rounded-md border bg-background p-2.5 space-y-1.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className="font-semibold text-xs truncate">{f.feederName}</span>
                                                {f.isCrossRegion && (
                                                    <Badge variant="secondary" className="text-[8px] px-1 py-0 bg-orange-500/10 text-orange-600">X-Region</Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                                                {side === "sending" ? (
                                                    <><span className="font-medium text-foreground">{station}</span><ArrowRight className="h-3 w-3" /><span>{otherStation}</span></>
                                                ) : (
                                                    <><span>{otherStation}</span><ArrowRight className="h-3 w-3" /><span className="font-medium text-foreground">{station}</span></>
                                                )}
                                            </div>
                                        </div>
                                        {/* mini bar */}
                                        <div className="flex items-center gap-2 text-[10px]">
                                            <span className="text-muted-foreground w-10 shrink-0">Import</span>
                                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                                <div className="h-full rounded-full bg-green-500" style={{ width: `${barPct}%` }} />
                                            </div>
                                            <span className="tabular-nums text-green-700 font-medium w-20 text-right">{fmtShort(meter.importKwh)} kWh</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px]">
                                            <span className="text-muted-foreground w-10 shrink-0">Export</span>
                                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                                <div className="h-full rounded-full bg-blue-500" style={{ width: `${(meter.exportKwh / maxImport) * 100}%` }} />
                                            </div>
                                            <span className="tabular-nums text-blue-700 font-medium w-20 text-right">{fmtShort(meter.exportKwh)} kWh</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ExpressFeederStationsTab({ aggregate, feeders }: Props) {
    const [search, setSearch] = useState("")
    const [sortSend, setSortSend] = useState<StationSort>("net")
    const [dirSend, setDirSend] = useState<SortDir>("desc")
    const [sortRecv, setSortRecv] = useState<StationSort>("net")
    const [dirRecv, setDirRecv] = useState<SortDir>("desc")

    const sending = aggregate?.sendingStationBreakdown ?? []
    const receiving = aggregate?.receivingStationBreakdown ?? []

    // ── Region-level rollup ────────────────────────────────────────────────────
    const regionRollup = useMemo(() => {
        const map = new Map<string, { region: string; import: number; export: number; net: number; stations: Set<string> }>()
        ;[...sending, ...receiving].forEach((s) => {
            if (!map.has(s.region)) map.set(s.region, { region: s.region, import: 0, export: 0, net: 0, stations: new Set() })
            const r = map.get(s.region)!
            r.import += s.import; r.export += s.export; r.net += s.net; r.stations.add(s.station)
        })
        return Array.from(map.values()).sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
    }, [sending, receiving])

    // ── Net flow ranking (all stations merged) ─────────────────────────────────
    const netFlowRanking = useMemo(() => {
        const map = new Map<string, { station: string; net: number; role: string }>()
        sending.forEach((s) => {
            map.set(s.station, { station: s.station, net: s.net, role: "Sending" })
        })
        receiving.forEach((s) => {
            if (map.has(s.station)) {
                map.get(s.station)!.role = "Relay"
                map.get(s.station)!.net += s.net
            } else {
                map.set(s.station, { station: s.station, net: s.net, role: "Receiving" })
            }
        })
        return Array.from(map.values()).sort((a, b) => b.net - a.net)
    }, [sending, receiving])

    // ── Cross-region stats ─────────────────────────────────────────────────────
    const crossRegionFeeders = feeders.filter((f) => f.isCrossRegion)
    const crossRegionRoutes = useMemo(() => {
        const map = new Map<string, { from: string; to: string; count: number; totalNet: number }>()
        crossRegionFeeders.forEach((f) => {
            const key = `${f.sendingMeter.region}→${f.receivingMeter.region}`
            if (!map.has(key)) map.set(key, { from: f.sendingMeter.region, to: f.receivingMeter.region, count: 0, totalNet: 0 })
            const r = map.get(key)!
            r.count++
            r.totalNet += f.sendingMeter.netKwh + f.receivingMeter.netKwh
        })
        return Array.from(map.values()).sort((a, b) => b.count - a.count)
    }, [crossRegionFeeders])

    // ── Transfer delta (sending → receiving discrepancy) ───────────────────────
    const transferDeltas = useMemo(() => {
        return feeders.map((f) => {
            const sent = f.sendingMeter.importKwh - f.sendingMeter.exportKwh
            const received = f.receivingMeter.importKwh - f.receivingMeter.exportKwh
            const delta = sent - received
            const deltaPct = sent !== 0 ? (delta / sent) * 100 : 0
            return {
                feeder: f.feederName,
                from: f.sendingMeter.station,
                to: f.receivingMeter.station,
                sent,
                received,
                delta,
                deltaPct,
                isCrossRegion: f.isCrossRegion,
            }
        }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    }, [feeders])

    // ── Sort helpers ─────────────────────────────────────────────────────────
    function sortStations<T extends { station: string; import: number; export: number; net: number; feederCount: number; district?: string }>(
        list: T[], col: StationSort, dir: SortDir
    ) {
        return [...list].filter((s) => s.station.toLowerCase().includes(search.toLowerCase())).sort((a, b) => {
            let va: number | string = 0, vb: number | string = 0
            if (col === "name") { va = a.station; vb = b.station }
            else if (col === "import") { va = a.import; vb = b.import }
            else if (col === "export") { va = a.export; vb = b.export }
            else if (col === "net") { va = a.net; vb = b.net }
            else if (col === "feeders") { va = a.feederCount; vb = b.feederCount }
            if (typeof va === "string") return dir === "asc" ? va.localeCompare(vb as string) : (vb as string).localeCompare(va)
            return dir === "asc" ? (va - vb) : (vb - va)
        })
    }

    function toggleSort(col: StationSort, cur: StationSort, dir: SortDir, setCol: any, setDir: any) {
        if (cur === col) setDir((d: SortDir) => d === "asc" ? "desc" : "asc")
        else { setCol(col); setDir("desc") }
    }

    const sortedSending = useMemo(() => sortStations(sending, sortSend, dirSend), [sending, sortSend, dirSend, search])
    // Cast receiving to add optional district so it satisfies the generic constraint
    const sortedReceiving = useMemo(
        () => sortStations(receiving.map(r => ({ ...r, district: undefined })), sortRecv, dirRecv),
        [receiving, sortRecv, dirRecv, search]
    )

    const totalStations = new Set([...sending.map(s => s.station), ...receiving.map(s => s.station)]).size
    const relayStations = sending.filter(s => receiving.some(r => r.station === s.station)).length
    const totalNet = netFlowRanking.reduce((sum, s) => sum + s.net, 0)

    return (
        <div className="space-y-5">

            {/* ── KPI strip ───────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard label="Total Stations" value={String(totalStations)} sub="unique in dataset" color="#64748b" />
                <KpiCard label="Sending Stations" value={String(sending.length)} sub="origin points" color="#16a34a" />
                <KpiCard label="Receiving Stations" value={String(receiving.length)} sub="destination points" color="#2563eb" />
                <KpiCard label="Relay Stations" value={String(relayStations)} sub="send & receive" color="#9333ea" />
                <KpiCard label="Cross-Region Feeders" value={String(crossRegionFeeders.length)} sub={`of ${feeders.length} total`} color="#f97316" />
                <KpiCard
                    label="Total Net Flow"
                    value={`${fmtShort(totalNet)} kWh`}
                    sub={totalNet >= 0 ? "net import" : "net export"}
                    color={totalNet >= 0 ? "#16a34a" : "#dc2626"}
                />
            </div>

            {/* ── Net Flow Ranking ────────────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                        Net Flow Ranking — All Stations
                    </CardTitle>
                    <CardDescription>
                        Stations sorted by net kWh. Positive = net importer. Negative = net exporter. Center line is zero.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {netFlowRanking.length === 0 ? (
                        <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No data.</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={Math.max(280, netFlowRanking.length * 30 + 60)}>
                            <BarChart
                                data={netFlowRanking}
                                layout="vertical"
                                margin={{ top: 5, right: 80, left: 10, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                                <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 10 }} />
                                <YAxis type="category" dataKey="station" tick={{ fontSize: 10 }} width={110} />
                                <Tooltip
                                    formatter={(v: number) => [`${fmt(v)} kWh`, "Net Flow"]}
                                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                                />
                                <ReferenceLine x={0} stroke="hsl(var(--border))" strokeWidth={2} />
                                <Bar dataKey="net" radius={[0, 3, 3, 0]} maxBarSize={20}>
                                    {netFlowRanking.map((entry, i) => (
                                        <Cell key={i} fill={entry.net >= 0 ? "#16a34a" : "#dc2626"} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>

            {/* ── Region Rollup ───────────────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        Region-Level Energy Summary
                    </CardTitle>
                    <CardDescription>
                        Aggregate import, export and net flow grouped by region across all stations and feeders.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {regionRollup.length === 0 ? (
                        <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">No data.</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={Math.max(200, regionRollup.length * 48 + 60)}>
                            <BarChart data={regionRollup} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="region" tick={{ fontSize: 10 }} />
                                <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10 }} />
                                <Tooltip
                                    formatter={(v: number, name: string) => [`${fmt(v)} kWh`, name]}
                                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                                />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Bar dataKey="import" name="Import" fill="#16a34a" radius={[3, 3, 0, 0]} />
                                <Bar dataKey="export" name="Export" fill="#2563eb" radius={[3, 3, 0, 0]} />
                                <Bar dataKey="net" name="Net" fill="#f97316" radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>

            {/* ── Cross-region routes ─────────────────────────────────────────── */}
            {crossRegionRoutes.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ArrowRight className="h-4 w-4 text-orange-500" />
                            Cross-Region Energy Routes
                        </CardTitle>
                        <CardDescription>
                            Feeders that cross regional boundaries, grouped by route. Shows how many feeders operate on each corridor.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {crossRegionRoutes.map((r) => (
                                <div key={`${r.from}-${r.to}`} className="rounded-lg border p-3 space-y-2 bg-orange-500/5 border-orange-500/20">
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="font-semibold truncate">{r.from}</span>
                                        <ArrowRight className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                                        <span className="font-semibold truncate">{r.to}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>{r.count} {r.count === 1 ? "feeder" : "feeders"}</span>
                                        <span className={`font-semibold tabular-nums ${r.totalNet >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {r.totalNet >= 0 ? "+" : ""}{fmtShort(r.totalNet)} kWh net
                    </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Transfer delta ──────────────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-muted-foreground" />
                        Energy Transfer Delta per Feeder
                    </CardTitle>
                    <CardDescription>
                        Difference between energy sent and energy received at the other end of each feeder. A positive delta indicates losses or measurement discrepancy.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-auto max-h-96">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10">
                                <TableRow>
                                    <TableHead className="w-8">#</TableHead>
                                    <TableHead>Feeder</TableHead>
                                    <TableHead>Route</TableHead>
                                    <TableHead className="text-right">Sent (kWh)</TableHead>
                                    <TableHead className="text-right">Received (kWh)</TableHead>
                                    <TableHead className="text-right">Delta (kWh)</TableHead>
                                    <TableHead className="text-right">Delta %</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transferDeltas.map((row, idx) => (
                                    <TableRow key={row.feeder}>
                                        <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                                        <TableCell>
                                            <div className="font-medium text-sm">{row.feeder}</div>
                                            {row.isCrossRegion && (
                                                <Badge variant="secondary" className="text-[8px] px-1 py-0 bg-orange-500/10 text-orange-600 mt-0.5">X-Region</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <span>{row.from}</span>
                                                <ArrowRight className="h-3 w-3 shrink-0" />
                                                <span>{row.to}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-xs font-medium">{fmt(row.sent)}</TableCell>
                                        <TableCell className="text-right tabular-nums text-xs font-medium">{fmt(row.received)}</TableCell>
                                        <TableCell className={`text-right tabular-nums text-xs font-bold ${row.delta >= 0 ? "text-red-600" : "text-green-700"}`}>
                                            {row.delta >= 0 ? "+" : ""}{fmt(row.delta)}
                                        </TableCell>
                                        <TableCell className={`text-right tabular-nums text-xs font-bold ${row.deltaPct >= 0 ? "text-red-600" : "text-green-700"}`}>
                                            {row.deltaPct >= 0 ? "+" : ""}{row.deltaPct.toFixed(1)}%
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {transferDeltas.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-sm">No feeder data.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* ── Sending & Receiving station tables ────────────────────────── */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Filter stations..."
                        className="pl-9 h-9 text-sm"
                    />
                </div>
                {search && (
                    <span className="text-xs text-muted-foreground">
            {sortedSending.length} sending, {sortedReceiving.length} receiving matched
          </span>
                )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* Sending stations table */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-green-600" />
                            Sending Stations
                        </CardTitle>
                        <CardDescription>
                            Click a row to expand and see individual feeder details.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-auto max-h-[520px]">
                            <Table>
                                <TableHeader className="sticky top-0 bg-background z-10">
                                    <TableRow>
                                        <TableHead className="w-8">#</TableHead>
                                        <TableHead
                                            className="cursor-pointer select-none hover:text-foreground"
                                            onClick={() => toggleSort("name", sortSend, dirSend, setSortSend, setDirSend)}
                                        >
                      <span className="inline-flex items-center gap-1">
                        Station {sortSend === "name" ? (dirSend === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-30" />}
                      </span>
                                        </TableHead>
                                        <SortHeader label="Feeders" col="feeders" sort={sortSend} dir={dirSend} onClick={() => toggleSort("feeders", sortSend, dirSend, setSortSend, setDirSend)} />
                                        <SortHeader label="Import" col="import" sort={sortSend} dir={dirSend} onClick={() => toggleSort("import", sortSend, dirSend, setSortSend, setDirSend)} />
                                        <SortHeader label="Export" col="export" sort={sortSend} dir={dirSend} onClick={() => toggleSort("export", sortSend, dirSend, setSortSend, setDirSend)} />
                                        <SortHeader label="Net kWh" col="net" sort={sortSend} dir={dirSend} onClick={() => toggleSort("net", sortSend, dirSend, setSortSend, setDirSend)} />
                                        <TableHead className="w-8" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedSending.map((s, idx) => (
                                        <StationRow
                                            key={s.station}
                                            idx={idx}
                                            station={s.station}
                                            region={s.region}
                                            district={s.district}
                                            importKwh={s.import}
                                            exportKwh={s.export}
                                            net={s.net}
                                            feederCount={s.feederCount}
                                            feedersForStation={feeders.filter(f => f.sendingMeter.station === s.station)}
                                            side="sending"
                                        />
                                    ))}
                                    {sortedSending.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-sm">No stations found.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                {/* Receiving stations table */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <TrendingDown className="h-4 w-4 text-blue-600" />
                            Receiving Stations
                        </CardTitle>
                        <CardDescription>
                            Click a row to expand and see individual feeder details.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-auto max-h-[520px]">
                            <Table>
                                <TableHeader className="sticky top-0 bg-background z-10">
                                    <TableRow>
                                        <TableHead className="w-8">#</TableHead>
                                        <TableHead
                                            className="cursor-pointer select-none hover:text-foreground"
                                            onClick={() => toggleSort("name", sortRecv, dirRecv, setSortRecv, setDirRecv)}
                                        >
                      <span className="inline-flex items-center gap-1">
                        Station {sortRecv === "name" ? (dirRecv === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-30" />}
                      </span>
                                        </TableHead>
                                        <SortHeader label="Feeders" col="feeders" sort={sortRecv} dir={dirRecv} onClick={() => toggleSort("feeders", sortRecv, dirRecv, setSortRecv, setDirRecv)} />
                                        <SortHeader label="Import" col="import" sort={sortRecv} dir={dirRecv} onClick={() => toggleSort("import", sortRecv, dirRecv, setSortRecv, setDirRecv)} />
                                        <SortHeader label="Export" col="export" sort={sortRecv} dir={dirRecv} onClick={() => toggleSort("export", sortRecv, dirRecv, setSortRecv, setDirRecv)} />
                                        <SortHeader label="Net kWh" col="net" sort={sortRecv} dir={dirRecv} onClick={() => toggleSort("net", sortRecv, dirRecv, setSortRecv, setDirRecv)} />
                                        <TableHead className="w-8" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedReceiving.map((s, idx) => (
                                        <StationRow
                                            key={s.station}
                                            idx={idx}
                                            station={s.station}
                                            region={s.region}
                                            importKwh={s.import}
                                            exportKwh={s.export}
                                            net={s.net}
                                            feederCount={s.feederCount}
                                            feedersForStation={feeders.filter(f => f.receivingMeter.station === s.station)}
                                            side="receiving"
                                        />
                                    ))}
                                    {sortedReceiving.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-sm">No stations found.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
