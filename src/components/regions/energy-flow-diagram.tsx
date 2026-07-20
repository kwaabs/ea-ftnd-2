"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatNumber } from "@/lib/utils";

const useIsomorphicLayoutEffect =
    typeof window !== "undefined" ? useLayoutEffect : useEffect;

type ColorKey = "emerald" | "blue" | "purple" | "slate";

const COLORS: Record<ColorKey, string> = {
    emerald: "#10b981",
    blue: "#3b82f6",
    purple: "#8b5cf6",
    slate: "#64748b",
};

const TINTS: Record<ColorKey, { bg: string; border: string; text: string }> = {
    emerald: { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700" },
    blue: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
    purple: { bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700" },
    slate: { bg: "bg-slate-50", border: "border-slate-300", text: "text-slate-700" },
};

interface DrillRow {
    label: string;
    sub?: string;
    value: number;
    href?: string;
    precise?: boolean;
    /** Nested breakdown (e.g. SLT types under AMR) */
    children?: DrillRow[];
}

interface EnergyFlowShape {
    bspImport: number;
    boundaryImport: number;
    boundaryExport: number;
    expressFeederInbound: number;
    expressFeederExport: number;
    availableSupply: number;
    dtxConsumption: number;
    customerSales: number;
}

interface BoundaryPartner {
    partner: string;
    value: number;
    locations: Map<string, { value: number; meters: Set<string> }>;
}

interface FeederLike {
    feederName: string;
    totalImport?: number;
    totalExport?: number;
    sendingMeter: {
        station: string;
        region: string;
        importKwh?: number;
        exportKwh?: number;
    };
    receivingMeter: {
        station: string;
        region: string;
        importKwh?: number;
        exportKwh?: number;
    };
}

interface EnergyFlowDiagramProps {
    region: string;
    energyFlow: EnergyFlowShape;
    netPosition: string;
    bspByStation: Map<string, { import: number; export: number; meters: Set<string> }>;
    dtxByDistrict: Map<string, { consumption: number; meters: Set<string> }>;
    boundaryImports: BoundaryPartner[];
    boundaryExports: BoundaryPartner[];
    expressInbound: FeederLike[];
    expressOutbound: FeederLike[];
    customerBySrc: Map<string, number>;
    /** When AMR is present, further drill into SLT type under the AMR row */
    amrBySltType?: Map<string, number>;
}

interface NodeConfig {
    id: string;
    title: string;
    value: number;
    color: ColorKey;
    sub?: string;
    rows: DrillRow[];
    leaves?: boolean;
    big?: boolean;
}

type Side = "l" | "r" | "t" | "b";

interface PipePath {
    id: string;
    d: string;
    color: string;
    width: number;
    tip: { x: number; y: number };
    angle: number;
}

interface LinkDef {
    from: string;
    to: string;
    color: ColorKey;
    volKey: keyof EnergyFlowShape;
    fromSide: Side;
    toSide: Side;
}

const LINKS: LinkDef[] = [
    { from: "bsp", to: "pool", color: "emerald", volKey: "bspImport", fromSide: "r", toSide: "l" },
    { from: "bnd", to: "pool", color: "blue", volKey: "boundaryImport", fromSide: "r", toSide: "l" },
    { from: "exp", to: "pool", color: "purple", volKey: "expressFeederInbound", fromSide: "r", toSide: "l" },
    { from: "pool", to: "dtx", color: "slate", volKey: "dtxConsumption", fromSide: "r", toSide: "l" },
    { from: "dtx", to: "cust", color: "emerald", volKey: "customerSales", fromSide: "r", toSide: "l" },
    // Exports leave the region — routed downward, crossing the region boundary
    { from: "pool", to: "bexp", color: "blue", volKey: "boundaryExport", fromSide: "b", toSide: "t" },
    { from: "pool", to: "xexp", color: "purple", volKey: "expressFeederExport", fromSide: "b", toSide: "t" },
];

export function EnergyFlowDiagram({
    region,
    energyFlow,
    netPosition,
    bspByStation,
    dtxByDistrict,
    boundaryImports,
    boundaryExports,
    expressInbound,
    expressOutbound,
    customerBySrc,
    amrBySltType,
}: EnergyFlowDiagramProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const headerRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const [paths, setPaths] = useState<PipePath[]>([]);
    const [dims, setDims] = useState({ w: 0, h: 0 });
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [showFootnote, setShowFootnote] = useState(false);

    const toggle = (id: string) =>
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const toggleRow = (id: string) =>
        setExpandedRows((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const pct = (v: number) =>
        energyFlow.availableSupply > 0
            ? `${formatNumber((v / energyFlow.availableSupply) * 100, 1)}%`
            : "0%";

    // ---- drill-down rows derived from the metrics passed in ----
    const bspRows: DrillRow[] = Array.from(bspByStation.entries())
        .sort((a, b) => b[1].import - a[1].import)
        .map(([station, data]) => ({
            label: station,
            sub: `${data.meters.size} meters`,
            value: data.import,
            href: `/stations/${encodeURIComponent(station.toLowerCase())}`,
        }));

    const dtxRows: DrillRow[] = Array.from(dtxByDistrict.entries())
        .sort((a, b) => b[1].consumption - a[1].consumption)
        .map(([district, data]) => ({
            label: district,
            sub: `${data.meters.size} meters`,
            value: data.consumption,
        }));

    // Boundary breakdowns are per-location: each location's exact kWh + share.
    const boundaryImportRows: DrillRow[] = boundaryImports
        .flatMap((p) =>
            Array.from(p.locations.entries()).map(([location, data]) => ({
                label: location,
                sub: `via ${p.partner}`,
                value: data.value,
                precise: true,
            })),
        )
        .sort((a, b) => b.value - a.value);

    const boundaryExportRows: DrillRow[] = boundaryExports
        .flatMap((p) =>
            Array.from(p.locations.entries()).map(([location, data]) => ({
                label: location,
                sub: `via ${p.partner}`,
                value: data.value,
                precise: true,
            })),
        )
        .sort((a, b) => b.value - a.value);

    // Inbound energy into the region = receiving meter's import_kwh
    const expressInRows: DrillRow[] = [...expressInbound]
        .map((f) => ({
            feeder: f,
            value: f.receivingMeter.importKwh ?? f.totalImport ?? 0,
        }))
        .sort((a, b) => b.value - a.value)
        .map(({ feeder: f, value }) => ({
            label: f.feederName,
            sub: `${f.sendingMeter.station} → ${f.receivingMeter.station}`,
            value,
            href: `/express-feeders/${encodeURIComponent(f.feederName)}`,
        }));

    // Outbound energy leaving the region = sending meter's export_kwh
    const expressOutRows: DrillRow[] = [...expressOutbound]
        .map((f) => ({
            feeder: f,
            value: f.sendingMeter.exportKwh ?? f.totalExport ?? 0,
        }))
        .sort((a, b) => b.value - a.value)
        .map(({ feeder: f, value }) => ({
            label: f.feederName,
            sub: `${f.sendingMeter.station} → ${f.receivingMeter.station}`,
            value,
            href: `/express-feeders/${encodeURIComponent(f.feederName)}`,
        }));

    const amrSltChildren: DrillRow[] = Array.from(amrBySltType?.entries() || [])
        .filter(([, kwh]) => kwh > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([slt, kwh]) => ({
            label: slt.replace(/_/g, " "),
            value: kwh,
        }));

    const formatCustomerSource = (src: string) => {
        const key = src.trim().toLowerCase();
        if (key === "amr" || key.startsWith("amr")) return "AMR";
        if (key === "zeus" || key.includes("zeus")) return "Zeus (Postpaid)";
        if (key === "mms" || key.includes("mms")) return "MMS (Prepaid)";
        return src;
    };

    const customerRows: DrillRow[] = Array.from(customerBySrc.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([src, kwh]) => {
            const label = formatCustomerSource(src);
            const isAmr = label === "AMR";
            return {
                label,
                value: kwh,
                sub: isAmr
                    ? amrSltChildren.length > 0
                        ? `${amrSltChildren.length} SLT type${amrSltChildren.length !== 1 ? "s" : ""}`
                        : undefined
                    : label.startsWith("Zeus")
                      ? "Postpaid billing"
                      : label.startsWith("MMS")
                        ? "Prepaid sales"
                        : undefined,
                children: isAmr && amrSltChildren.length > 0 ? amrSltChildren : undefined,
            };
        });

    const customerSourceSummary =
        customerRows.length === 0
            ? "no sources"
            : customerRows.map((r) => r.label).join(" + ");

    const nodeMap: Record<string, NodeConfig> = {
        bsp: { id: "bsp", title: "BSP Import", value: energyFlow.bspImport, color: "emerald", sub: `${bspByStation.size} stations`, rows: bspRows },
        bnd: { id: "bnd", title: "Boundary Import", value: energyFlow.boundaryImport, color: "blue", sub: `${boundaryImports.length} partners`, rows: boundaryImportRows },
        exp: { id: "exp", title: "Express Inbound", value: energyFlow.expressFeederInbound, color: "purple", sub: `${expressInbound.length} feeders`, rows: expressInRows },
        pool: { id: "pool", title: "Available Supply", value: energyFlow.availableSupply, color: "slate", sub: netPosition, rows: [], big: true },
        dtx: { id: "dtx", title: "DTX Distribution", value: energyFlow.dtxConsumption, color: "slate", sub: `${dtxByDistrict.size} districts`, rows: dtxRows },
        bexp: { id: "bexp", title: "Boundary Export", value: energyFlow.boundaryExport, color: "blue", sub: "out of region", rows: boundaryExportRows, leaves: true },
        xexp: { id: "xexp", title: "Express Export", value: energyFlow.expressFeederExport, color: "purple", sub: "out of region", rows: expressOutRows, leaves: true },
        cust: {
            id: "cust",
            title: "Customer Sales",
            value: energyFlow.customerSales,
            color: "emerald",
            sub: customerSourceSummary,
            rows: customerRows,
            big: true,
        },
    };

    // Required nodes always render. Express nodes also show when feeders exist
    // (even if kWh is currently 0) so EXPRESS_FEEDER meters are never hidden.
    const isVisible = (id: string) => {
        if (["bsp", "pool", "dtx", "cust"].includes(id)) return true;
        if (id === "exp") return nodeMap.exp.value > 0 || expressInbound.length > 0;
        if (id === "xexp") return nodeMap.xexp.value > 0 || expressOutbound.length > 0;
        return nodeMap[id].value > 0;
    };

    const showLeavesGroup = isVisible("bexp") || isVisible("xexp");
    const maxVol = Math.max(
        ...LINKS.map((l) => energyFlow[l.volKey] as number),
        1,
    );

    const recompute = useCallback(() => {
        const cont = containerRef.current;
        if (!cont) return;
        const cr = cont.getBoundingClientRect();
        setDims({ w: cr.width, h: cr.height });

        const anchor = (id: string, side: Side) => {
            const el = headerRefs.current[id];
            if (!el) return null;
            const r = el.getBoundingClientRect();
            const cx = r.left - cr.left + r.width / 2;
            const cy = r.top - cr.top + r.height / 2;
            switch (side) {
                case "r": return { x: r.right - cr.left, y: cy };
                case "l": return { x: r.left - cr.left, y: cy };
                case "t": return { x: cx, y: r.top - cr.top };
                case "b": return { x: cx, y: r.bottom - cr.top };
            }
        };

        const next: PipePath[] = [];
        for (const link of LINKS) {
            if (!isVisible(link.from) || !isVisible(link.to)) continue;
            const a = anchor(link.from, link.fromSide);
            const b = anchor(link.to, link.toSide);
            if (!a || !b) continue;
            const vol = energyFlow[link.volKey] as number;

            const vertical = link.fromSide === "b" || link.fromSide === "t" || link.toSide === "t" || link.toSide === "b";
            let d: string;
            let angle: number;
            if (vertical) {
                const dy = Math.max(30, (b.y - a.y) * 0.5);
                d = `M${a.x},${a.y} C${a.x},${a.y + dy} ${b.x},${b.y - dy} ${b.x},${b.y}`;
                angle = 90; // arrow points down
            } else {
                const dx = Math.max(40, (b.x - a.x) * 0.45);
                d = `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
                angle = 0; // arrow points right
            }

            next.push({
                id: `${link.from}-${link.to}`,
                d,
                color: COLORS[link.color],
                width: 3 + (vol / maxVol) * 13,
                tip: { x: b.x, y: b.y },
                angle,
            });
        }
        setPaths(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [energyFlow, maxVol]);

    useIsomorphicLayoutEffect(() => {
        recompute();
    }, [recompute, expanded, expandedRows, showLeavesGroup]);

    useEffect(() => {
        const cont = containerRef.current;
        if (!cont) return;
        const ro = new ResizeObserver(() => recompute());
        ro.observe(cont);
        window.addEventListener("resize", recompute);
        return () => {
            ro.disconnect();
            window.removeEventListener("resize", recompute);
        };
    }, [recompute]);

    const renderRows = (node: NodeConfig) => {
        const total = node.rows.reduce((s, r) => s + r.value, 0) || node.value || 1;
        return (
            <div className="mt-2 pt-2 border-t border-dashed border-current/20 space-y-1 max-h-80 overflow-y-auto">
                {node.rows.length === 0 && (
                    <p className="text-[11px] text-muted-foreground px-1 py-1">No breakdown available</p>
                )}
                {node.rows.map((row) => {
                    const rowKey = `${node.id}-${row.label}`;
                    const hasChildren = (row.children?.length ?? 0) > 0;
                    const rowOpen = expandedRows.has(rowKey);
                    const childTotal = row.children?.reduce((s, c) => s + c.value, 0) || row.value || 1;

                    const labelEl = row.href ? (
                        <Link
                            href={row.href}
                            className="font-medium text-primary hover:underline break-words"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {row.label}
                        </Link>
                    ) : (
                        <span className="font-medium break-words">{row.label}</span>
                    );

                    return (
                        <div key={rowKey}>
                            <div
                                className={`flex items-start justify-between gap-3 py-1.5 px-1.5 rounded hover:bg-background/60 text-xs ${hasChildren ? "cursor-pointer" : ""}`}
                                onClick={(e) => {
                                    if (!hasChildren) return;
                                    e.stopPropagation();
                                    toggleRow(rowKey);
                                }}
                            >
                                <div className="min-w-0 flex-1 flex items-start gap-1.5">
                                    {hasChildren && (
                                        <ChevronRight
                                            className={`h-3 w-3 shrink-0 mt-0.5 text-muted-foreground transition-transform ${rowOpen ? "rotate-90" : ""}`}
                                        />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        {labelEl}
                                        {row.sub && (
                                            <div className="text-muted-foreground text-[11px] mt-0.5">
                                                {row.sub}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="shrink-0 text-right leading-tight">
                                    <div className="text-muted-foreground tabular-nums whitespace-nowrap">
                                        {row.precise
                                            ? row.value.toLocaleString("en-US", { maximumFractionDigits: 4 })
                                            : formatNumber(row.value)}
                                        <span className="text-muted-foreground/70"> kWh</span>
                                    </div>
                                    <div className="font-semibold tabular-nums">
                                        {formatNumber((row.value / total) * 100, 1)}%
                                    </div>
                                </div>
                            </div>
                            {hasChildren && rowOpen && (
                                <div className="ml-4 mt-0.5 mb-1 border-l border-dashed border-current/20 pl-2 space-y-1">
                                    {row.children!.map((child) => (
                                        <div
                                            key={`${rowKey}-${child.label}`}
                                            className="flex items-start justify-between gap-3 py-1 px-1.5 rounded hover:bg-background/60 text-[11px]"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <span className="font-medium break-words">{child.label}</span>
                                                {child.sub && (
                                                    <div className="text-muted-foreground mt-0.5">
                                                        {child.sub}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="shrink-0 text-right leading-tight">
                                                <div className="text-muted-foreground tabular-nums whitespace-nowrap">
                                                    {formatNumber(child.value)}
                                                    <span className="text-muted-foreground/70"> kWh</span>
                                                </div>
                                                <div className="font-semibold tabular-nums">
                                                    {formatNumber((child.value / childTotal) * 100, 1)}%
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const NodeCard = ({ node }: { node: NodeConfig }) => {
        const tint = TINTS[node.color];
        const isOpen = expanded.has(node.id);
        const canDrill = node.rows.length > 0;

        if (node.big) {
            return (
                <div className="rounded-xl border-[3px] border-slate-800 bg-slate-50 dark:bg-slate-900/40 overflow-hidden shadow-sm">
                    <div
                        ref={(el) => { headerRefs.current[node.id] = el; }}
                        className={`p-5 text-center ${canDrill ? "cursor-pointer hover:bg-slate-100/60" : ""}`}
                        onClick={() => canDrill && toggle(node.id)}
                    >
                        <div className="text-xs font-semibold text-muted-foreground flex items-center justify-center gap-1">
                            {node.title}
                            {canDrill && (
                                <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                            )}
                        </div>
                        <div className="text-2xl lg:text-3xl font-extrabold mt-1 tabular-nums">{formatNumber(node.value)}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">kWh · {node.sub}</div>
                    </div>
                    {isOpen && <div className="px-4 pb-4">{renderRows(node)}</div>}
                </div>
            );
        }

        return (
            <div className={`rounded-lg border-2 ${tint.border} ${tint.bg} overflow-hidden ${node.leaves ? "border-dashed" : ""}`}>
                <div
                    ref={(el) => { headerRefs.current[node.id] = el; }}
                    className={`p-4 ${canDrill ? "cursor-pointer hover:brightness-[0.98]" : ""}`}
                    onClick={() => canDrill && toggle(node.id)}
                >
                    <div className="flex items-center justify-between">
                        <span className={`text-sm font-semibold ${tint.text}`}>{node.title}</span>
                        {node.leaves ? (
                            <span className="text-[10px] font-bold text-amber-700">↗ OUT</span>
                        ) : (
                            canDrill && (
                                <ChevronRight className={`h-3.5 w-3.5 ${tint.text} transition-transform ${isOpen ? "rotate-90" : ""}`} />
                            )
                        )}
                    </div>
                    <div className="text-lg lg:text-xl font-bold mt-1 tabular-nums">
                        {formatNumber(node.value)} <span className="text-[11px] font-normal text-muted-foreground">kWh</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                        {node.sub} · {pct(node.value)} of supply
                    </div>
                </div>
                {isOpen && canDrill && <div className="px-4 pb-4">{renderRows(node)}</div>}
            </div>
        );
    };

    return (
        <div className="w-full min-w-0">
            {/* min-w-0 + overflow-x-auto: keep BSP sources visible and scroll the diagram instead of crushing/clipping */}
            <div className="w-full min-w-0 overflow-x-auto overflow-y-hidden pt-4 pb-2">
            <div ref={containerRef} className="relative min-w-[1200px] pt-4">
                {/* Animated connector layer (behind cards) */}
                <svg
                    className="absolute inset-0"
                    style={{ zIndex: 0, pointerEvents: "none", width: dims.w, height: dims.h }}
                    viewBox={`0 0 ${dims.w} ${dims.h}`}
                >
                    {paths.map((p) => (
                        <g key={p.id}>
                            <path d={p.d} fill="none" stroke={p.color} strokeOpacity={0.18} strokeWidth={p.width} strokeLinecap="round" />
                            <path
                                d={p.d}
                                fill="none"
                                stroke={p.color}
                                strokeOpacity={0.9}
                                strokeWidth={Math.max(2, p.width * 0.5)}
                                strokeDasharray={`${Math.max(3, p.width * 0.5)} ${10 + p.width}`}
                                strokeLinecap="round"
                                className="energy-flow-pipe"
                            />
                            <polygon
                                points={`0,-${3 + p.width * 0.3} ${6 + p.width * 0.3},0 0,${3 + p.width * 0.3}`}
                                fill={p.color}
                                transform={`translate(${p.tip.x},${p.tip.y}) rotate(${p.angle})`}
                            />
                        </g>
                    ))}
                </svg>

                {/* Card layout */}
                <div className="relative flex gap-x-10 lg:gap-x-14 items-start" style={{ zIndex: 1 }}>
                    {/* Sources (external) — wide enough for full station names in BSP drill-down */}
                    <div className="w-[300px] shrink-0 flex flex-col">
                        <div className="text-center text-[11px] font-bold tracking-widest uppercase text-muted-foreground pb-3">
                            sources
                        </div>
                        <div className="space-y-6 flex-1 flex flex-col justify-center">
                            {isVisible("bsp") && <NodeCard node={nodeMap.bsp} />}
                            {isVisible("bnd") && <NodeCard node={nodeMap.bnd} />}
                            {isVisible("exp") && <NodeCard node={nodeMap.exp} />}
                        </div>
                    </div>

                    {/* In-region column: boundary box, with exports directly beneath it */}
                    <div className="min-w-[820px] flex-1 flex flex-col">
                        {/* Region boundary — encloses in-region pool, distribution & end use */}
                        <div className="relative rounded-2xl border-2 border-dashed border-slate-400/70 dark:border-slate-500/60 pt-9 pb-7 px-6 lg:px-10">
                            <span className="absolute -top-3 left-6 bg-card px-2.5 text-[11px] font-bold tracking-widest uppercase text-slate-500">
                                {region} region
                            </span>
                            <div
                                className="grid items-center gap-x-8 lg:gap-x-12"
                                style={{ gridTemplateColumns: "minmax(200px, 1fr) minmax(200px, 1fr) minmax(200px, 1fr)" }}
                            >
                                {["Available supply", "Distribution", "End use"].map((h) => (
                                    <div key={h} className="text-center text-[11px] font-bold tracking-widest uppercase text-muted-foreground pb-3">
                                        {h}
                                    </div>
                                ))}
                                <div className="flex justify-center"><div className="w-full"><NodeCard node={nodeMap.pool} /></div></div>
                                <div className="flex justify-center"><div className="w-full"><NodeCard node={nodeMap.dtx} /></div></div>
                                <div className="flex justify-center"><div className="w-full"><NodeCard node={nodeMap.cust} /></div></div>
                            </div>
                        </div>

                        {/* Out-of-region exports — full width so drill-downs aren't crushed */}
                        {showLeavesGroup && (
                            <div className="px-8 lg:px-12 mt-3">
                                <div className="rounded-xl bg-amber-50/50 border-2 border-dashed border-amber-300 p-4 space-y-3">
                                    <div className="text-[10px] font-bold tracking-wide uppercase text-amber-700 text-center">
                                        ↗ Leaves region · to neighbours
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {isVisible("bexp") && <NodeCard node={nodeMap.bexp} />}
                                        {isVisible("xexp") && <NodeCard node={nodeMap.xexp} />}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-6 pt-4 border-t text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm" style={{ background: COLORS.emerald }} />Supply / sales</span>
                <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm" style={{ background: COLORS.blue }} />Boundary</span>
                <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm" style={{ background: COLORS.purple }} />Express feeder</span>
                <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm" style={{ background: COLORS.slate }} />Distribution (DTX)</span>
                <span className="ml-auto">Pipe thickness ≈ volume · click a card to drill in</span>
            </div>

            {/* Calculation footnote */}
            <div className="mt-5 pt-4 border-t border-border/60">
                <button
                    onClick={() => setShowFootnote((v) => !v)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors w-full text-left"
                >
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showFootnote ? "rotate-180" : ""}`} />
                    How calculations work
                </button>
                {showFootnote && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-xs text-muted-foreground">
                        {/* Pool */}
                        <div className="md:col-span-2">
                            <span className="font-medium text-foreground">Pool — Available Supply</span>
                            <p className="mt-1 leading-relaxed font-mono bg-muted/50 rounded px-2 py-1 inline-block">
                                BSP Import &nbsp;+&nbsp; (Boundary Import &minus; Boundary Export) &nbsp;+&nbsp; (Express Feeder Inbound &minus; Express Feeder Outbound)
                            </p>
                            <p className="mt-1 leading-relaxed">
                                BSP Import is taken as a gross figure. Boundary and Express Feeder contributions are netted — only the difference between what flows in and what flows out is added to the pool.
                            </p>
                        </div>
                        {/* Sources */}
                        <div>
                            <span className="font-medium text-foreground">Source — Boundary Import</span>
                            <p className="mt-0.5 leading-relaxed">
                                Energy received from neighbouring regions through boundary metering points. Only the net of Boundary Import minus Boundary Export contributes to the pool — not the gross import figure shown in the diagram.
                            </p>
                        </div>
                        <div>
                            <span className="font-medium text-foreground">Source — Express Feeder Inbound</span>
                            <p className="mt-0.5 leading-relaxed">
                                Energy flowing into this region via express feeder lines from adjacent regions. Only the net of Inbound minus Outbound contributes to the pool — not the gross inbound figure shown in the diagram.
                            </p>
                        </div>
                        {/* Distribution */}
                        <div>
                            <span className="font-medium text-foreground">Distribution — Public DT (DTX Import)</span>
                            <p className="mt-0.5 leading-relaxed">
                                Total kWh drawn from the pool by all public Distribution Transformer (DTX) meters in the region, summed across all districts.
                            </p>
                        </div>
                        <div>
                            <span className="font-medium text-foreground">Distribution — Customer Sales</span>
                            <p className="mt-0.5 leading-relaxed">
                                Energy billed or metered to customers (Zeus, MMS, AMR), drawn from DTX distribution. Expand Customer Sales to see sources; when AMR is present, expand AMR further by SLT type. The gap between DTX Distribution and Customer Sales reflects unbilled energy and system losses.
                            </p>
                        </div>
                        <div>
                            <span className="font-medium text-foreground">Leaves region — Boundary Export</span>
                            <p className="mt-0.5 leading-relaxed">
                                Energy leaving this region to neighbouring regions via boundary meters. Subtracted from gross Boundary Import before the net is added to the pool.
                            </p>
                        </div>
                        <div>
                            <span className="font-medium text-foreground">Leaves region — Express Feeder Export</span>
                            <p className="mt-0.5 leading-relaxed">
                                Energy sent out of this region to adjacent regions via express feeder lines. Subtracted from gross Express Feeder Inbound before the net is added to the pool.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
