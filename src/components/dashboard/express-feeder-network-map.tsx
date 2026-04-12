"use client"

import { useMemo, useState } from "react"
import ReactFlow, {
    Node,
    Edge,
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    Handle,
    Position,
    MarkerType,
    EdgeProps,
    getBezierPath,
    BaseEdge,
    EdgeLabelRenderer,
} from "reactflow"
import "reactflow/dist/style.css"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Zap, ChevronDown, ChevronRight, GitBranch, ArrowRight, Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import type { FeederDetail } from "@/hooks/api/use-express-feeder-api"

interface ExpressFeederNetworkMapProps {
    feeders: FeederDetail[]
}

// ---------------------------------------------------------------------------
// Custom feeder edge — uses getBezierPath with a curvatureOffset so parallel
// feeders between the same two stations each get their own distinct arc.
// ---------------------------------------------------------------------------
function FeederEdge({
                        id,
                        sourceX,
                        sourceY,
                        targetX,
                        targetY,
                        sourcePosition,
                        targetPosition,
                        style,
                        markerEnd,
                        data,
                        label,
                        labelStyle,
                    }: EdgeProps) {
    const offset = data?.curvatureOffset ?? 0

    // Perpendicular unit vector to the line connecting source → target
    const dx = targetX - sourceX
    const dy = targetY - sourceY
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const px = -dy / len
    const py = dx / len

    // Two separate control points — one at 1/3, one at 2/3 along the line,
    // both offset perpendicularly by the same amount. This produces a smooth
    // arc rather than a sharp bump.
    const cp1x = sourceX + dx * 0.33 + px * offset
    const cp1y = sourceY + dy * 0.33 + py * offset
    const cp2x = sourceX + dx * 0.67 + px * offset
    const cp2y = sourceY + dy * 0.67 + py * offset

    const customPath = `M${sourceX},${sourceY} C${cp1x},${cp1y} ${cp2x},${cp2y} ${targetX},${targetY}`

    // Label sits at the midpoint of the arc
    const labelX = sourceX + dx * 0.5 + px * offset * 0.9
    const labelY = sourceY + dy * 0.5 + py * offset * 0.9

    return (
        <>
            <BaseEdge id={id} path={customPath} style={style} markerEnd={markerEnd} />
            {label && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: "absolute",
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                            pointerEvents: "all",
                            fontSize: labelStyle?.fontSize ?? 9,
                            fontWeight: labelStyle?.fontWeight ?? 600,
                            color: style?.stroke as string,
                            background: "hsl(var(--background))",
                            padding: "2px 6px",
                            borderRadius: 4,
                            border: `1px solid ${style?.stroke}40`,
                            whiteSpace: "nowrap",
                        }}
                        className="nodrag nopan"
                    >
                        {label as string}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    )
}

// ---------------------------------------------------------------------------
// Chain detection algorithm
// ---------------------------------------------------------------------------
function buildGraph(feeders: FeederDetail[]) {
    // outgoing: station -> list of stations it sends to
    const outgoing = new Map<string, Set<string>>()
    // incoming: station -> list of stations it receives from
    const incoming = new Map<string, Set<string>>()
    // all stations
    const allStations = new Set<string>()

    feeders.forEach((f) => {
        const s = f.sendingMeter.station
        const r = f.receivingMeter.station
        allStations.add(s)
        allStations.add(r)
        if (!outgoing.has(s)) outgoing.set(s, new Set())
        if (!incoming.has(r)) incoming.set(r, new Set())
        outgoing.get(s)!.add(r)
        incoming.get(r)!.add(s)
    })

    return { outgoing, incoming, allStations }
}

function detectChains(feeders: FeederDetail[]): { hasChains: boolean; depthMap: Map<string, number> } {
    const { outgoing, incoming, allStations } = buildGraph(feeders)

    // A relay station appears in BOTH outgoing (sends) and incoming (receives)
    const relayStations = new Set<string>()
    allStations.forEach((station) => {
        if (outgoing.has(station) && incoming.has(station)) {
            relayStations.add(station)
        }
    })

    const hasChains = relayStations.size > 0

    // BFS from all source stations (stations that only send, never receive)
    const depthMap = new Map<string, number>()

    if (hasChains) {
        const sources = Array.from(allStations).filter(
            (s) => outgoing.has(s) && !incoming.has(s)
        )
        // Also add relay stations that aren't reachable from pure sources
        // (e.g. isolated sub-chains)
        const visited = new Set<string>()

        const bfs = (start: string, startDepth: number) => {
            const queue: Array<{ station: string; depth: number }> = [{ station: start, depth: startDepth }]
            while (queue.length > 0) {
                const { station, depth } = queue.shift()!
                // Assign max depth if station is reachable from multiple paths
                if (!depthMap.has(station) || depthMap.get(station)! < depth) {
                    depthMap.set(station, depth)
                }
                if (visited.has(station)) continue
                visited.add(station)
                const neighbors = outgoing.get(station)
                if (neighbors) {
                    neighbors.forEach((neighbor) => {
                        queue.push({ station: neighbor, depth: depth + 1 })
                    })
                }
            }
        }

        // Start BFS from pure sources first
        sources.forEach((s) => bfs(s, 0))

        // Any stations not yet visited (isolated relay chains) — start from them
        allStations.forEach((s) => {
            if (!visited.has(s)) {
                // Find the earliest point of this sub-chain
                bfs(s, 0)
            }
        })
    }

    return { hasChains, depthMap }
}

// ---------------------------------------------------------------------------
// Generate distinct colors for feeders across the full hue spectrum
// ---------------------------------------------------------------------------
function generateFeederColor(index: number, total: number): string {
    const hue = (index * (360 / Math.max(total, 1))) % 360
    const saturation = 65 + (index % 3) * 8
    const lightness = 45 + (index % 4) * 4
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

// ---------------------------------------------------------------------------
// Station Node - works in both bipartite and chain mode
// ---------------------------------------------------------------------------
function StationNode({ data }: { data: any }) {
    const [isExpanded, setIsExpanded] = useState(false)

    return (
        <div
            className="bg-card rounded-lg border-2 transition-all hover:shadow-lg"
            style={{
                borderColor: data.color,
                minWidth: isExpanded ? 280 : 160,
                maxWidth: isExpanded ? 320 : 200,
            }}
        >
            {/* Header */}
            <div
                className="px-4 py-2.5 cursor-pointer hover:bg-accent/20 transition-colors flex items-center justify-between gap-2 rounded-t-lg"
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    background: `linear-gradient(135deg, ${data.color}10 0%, transparent 100%)`,
                }}
            >
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs text-foreground truncate">{data.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{data.region}</div>
                    {data.role && (
                        <div
                            className="text-[9px] font-semibold mt-0.5 uppercase tracking-wide"
                            style={{ color: data.color }}
                        >
                            {data.role}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <Badge
                        variant="secondary"
                        className="text-[9px] px-1.5 py-0.5 font-semibold"
                        style={{ backgroundColor: `${data.color}15`, color: data.color }}
                    >
                        {data.feederCount}
                    </Badge>
                    {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" style={{ color: data.color }} />
                    ) : (
                        <ChevronRight className="h-3.5 w-3.5" style={{ color: data.color }} />
                    )}
                </div>
            </div>

            {/* Expanded feeder/meter drill-down */}
            {isExpanded && data.feeders && data.feeders.length > 0 && (
                <div className="border-t px-2.5 py-2 space-y-1.5 max-h-64 overflow-y-auto bg-muted/5">
                    {data.feeders.map((feeder: any, idx: number) => (
                        <div key={idx} className="bg-background rounded-md px-2.5 py-2 text-[10px] border">
                            <div className="font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                                <span className="truncate flex-1">{feeder.name}</span>
                                {feeder.isCrossRegion && (
                                    <Badge variant="secondary" className="text-[8px] px-1 py-0 bg-orange-500/10 text-orange-600">
                                        X-Region
                                    </Badge>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[9px]">
                                <div className="space-y-0.5">
                                    <div className="font-semibold text-green-600 dark:text-green-400 mb-1">Sending Meter</div>
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>Import:</span>
                                        <span className="font-medium text-foreground">{feeder.sendingImport.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>Export:</span>
                                        <span className="font-medium text-foreground">{feeder.sendingExport.toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="space-y-0.5">
                                    <div className="font-semibold text-blue-600 dark:text-blue-400 mb-1">Receiving Meter</div>
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>Import:</span>
                                        <span className="font-medium text-foreground">{feeder.receivingImport.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>Export:</span>
                                        <span className="font-medium text-foreground">{feeder.receivingExport.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Handles - relay stations need both source and target */}
            {(data.side === "sending" || data.role === "source" || data.role === "relay") && (
                <Handle
                    type="source"
                    position={Position.Right}
                    className="w-2 h-2 border-2 border-background"
                    style={{ backgroundColor: data.color }}
                />
            )}
            {(data.side === "receiving" || data.role === "sink" || data.role === "relay") && (
                <Handle
                    type="target"
                    position={Position.Left}
                    className="w-2 h-2 border-2 border-background"
                    style={{ backgroundColor: data.color }}
                />
            )}
        </div>
    )
}

const nodeTypes = { station: StationNode }
const edgeTypes = { feederEdge: FeederEdge }

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function ExpressFeederNetworkMap({ feeders }: ExpressFeederNetworkMapProps) {
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
    const [searchInput, setSearchInput] = useState("")
    const [filterTags, setFilterTags] = useState<string[]>([])

    const addTag = () => {
        const val = searchInput.trim()
        if (!val || filterTags.includes(val)) return
        setFilterTags((prev) => [...prev, val])
        setSearchInput("")
        setSelectedEdgeId(null)
    }

    const removeTag = (tag: string) => {
        setFilterTags((prev) => prev.filter((t) => t !== tag))
    }

    const { initialNodes, initialEdges, hasChains, layoutInfo } = useMemo(() => {
        if (feeders.length === 0) return { initialNodes: [], initialEdges: [], hasChains: false, layoutInfo: {} }

        const { hasChains, depthMap } = detectChains(feeders)

        // -------------------------------------------------------------------------
        // Build per-station feeder lists (used for drill-down in both modes)
        // -------------------------------------------------------------------------
        const stationFeeders = new Map<string, any[]>()
        feeders.forEach((f) => {
            const feederData = {
                name: f.feederName,
                isCrossRegion: f.isCrossRegion,
                sendingImport: f.sendingMeter.importKwh,
                sendingExport: f.sendingMeter.exportKwh,
                receivingImport: f.receivingMeter.importKwh,
                receivingExport: f.receivingMeter.exportKwh,
            }
            // Attach to sending station
            if (!stationFeeders.has(f.sendingMeter.station)) stationFeeders.set(f.sendingMeter.station, [])
            stationFeeders.get(f.sendingMeter.station)!.push(feederData)
            // Attach to receiving station
            if (!stationFeeders.has(f.receivingMeter.station)) stationFeeders.set(f.receivingMeter.station, [])
            stationFeeders.get(f.receivingMeter.station)!.push(feederData)
        })

        const nodes: Node[] = []
        const edges: Edge[] = []

        // -------------------------------------------------------------------------
        // CHAIN MODE: column layout by depth
        // -------------------------------------------------------------------------
        if (hasChains) {
            // Group stations by depth column
            const columnMap = new Map<number, string[]>()
            depthMap.forEach((depth, station) => {
                if (!columnMap.has(depth)) columnMap.set(depth, [])
                columnMap.get(depth)!.push(station)
            })

            const totalColumns = Math.max(...Array.from(columnMap.keys())) + 1
            const columnSpacing = Math.max(280, 1000 / Math.max(totalColumns, 1))
            const verticalSpacing = 130

            // Use actual graph edges to determine role — not just depth position.
            // A station is a SOURCE if it never receives, SINK if it never sends,
            // RELAY if it does both. This is correct even after filtering.
            const { outgoing: actualOutgoing, incoming: actualIncoming } = buildGraph(feeders)

            const getNodeRole = (station: string) => {
                const sends = actualOutgoing.has(station)
                const receives = actualIncoming.has(station)
                if (sends && !receives) return "source"
                if (receives && !sends) return "sink"
                return "relay"
            }

            const getNodeColor = (station: string) => {
                const role = getNodeRole(station)
                if (role === "source") return "#16a34a"
                if (role === "sink") return "#2563eb"
                const depth = depthMap.get(station) ?? 0
                return `hsl(${260 + (depth / totalColumns) * 40}, 70%, 55%)`
            }

            // Build station metadata from feeders
            const stationMeta = new Map<string, { region: string; district: string }>()
            feeders.forEach((f) => {
                stationMeta.set(f.sendingMeter.station, { region: f.sendingMeter.region, district: f.sendingMeter.district || "" })
                stationMeta.set(f.receivingMeter.station, { region: f.receivingMeter.region, district: "" })
            })

            columnMap.forEach((stations, depth) => {
                stations.forEach((station, rowIdx) => {
                    const meta = stationMeta.get(station) || { region: "", district: "" }
                    const role = getNodeRole(station)
                    const color = getNodeColor(station)
                    const feedersForStation = stationFeeders.get(station) || []

                    nodes.push({
                        id: `station-${station}`,
                        type: "station",
                        position: { x: depth * columnSpacing + 50, y: rowIdx * verticalSpacing + 50 },
                        data: {
                            label: station,
                            region: meta.region,
                            district: meta.district,
                            feederCount: feedersForStation.length,
                            feeders: feedersForStation,
                            role,
                            color,
                        },
                    })
                })
            })

            // Track how many feeders share the same source-target pair so we can fan them out
            const pairCount = new Map<string, number>()
            const pairIndex = new Map<string, number>()
            feeders.forEach((feeder) => {
                const key = `${feeder.sendingMeter.station}--${feeder.receivingMeter.station}`
                pairCount.set(key, (pairCount.get(key) || 0) + 1)
            })

            // Edges: one per feeder, curved to separate parallel connections
            feeders.forEach((feeder, idx) => {
                const netFlow =
                    feeder.sendingMeter.importKwh - feeder.sendingMeter.exportKwh +
                    (feeder.receivingMeter.importKwh - feeder.receivingMeter.exportKwh)

                const baseColor = feeder.isCrossRegion ? "#f97316" : generateFeederColor(idx, feeders.length)
                const strokeWidth = Math.max(1.5, Math.min(4, Math.abs(netFlow) / 600000))

                const key = `${feeder.sendingMeter.station}--${feeder.receivingMeter.station}`
                const count = pairCount.get(key) || 1
                const current = pairIndex.get(key) || 0
                pairIndex.set(key, current + 1)

                // Fan out parallel feeders evenly. Spread scales with feeder count
                // so denser groups still stay readable.
                const spread = Math.min(50 + count * 20, 140)
                const curvatureOffset = count === 1 ? 0 : -spread + (current / (count - 1)) * spread * 2

                edges.push({
                    id: `feeder-${idx}`,
                    source: `station-${feeder.sendingMeter.station}`,
                    target: `station-${feeder.receivingMeter.station}`,
                    type: "feederEdge",
                    animated: feeder.isCrossRegion,
                    label: feeder.feederName,
                    labelStyle: { fontSize: 9, fontWeight: 600, fill: baseColor },
                    data: {
                        feederName: feeder.feederName,
                        baseColor,
                        curvatureOffset,
                        sendingImport: feeder.sendingMeter.importKwh,
                        sendingExport: feeder.sendingMeter.exportKwh,
                        receivingImport: feeder.receivingMeter.importKwh,
                        receivingExport: feeder.receivingMeter.exportKwh,
                    },
                    style: { stroke: baseColor, strokeWidth },
                    markerEnd: { type: MarkerType.ArrowClosed, color: baseColor, width: 16, height: 16 },
                })
            })

            return {
                initialNodes: nodes,
                initialEdges: edges,
                hasChains: true,
                layoutInfo: { totalColumns, totalStations: depthMap.size },
            }
        }

        // -------------------------------------------------------------------------
        // BIPARTITE MODE (fallback): sending left, receiving right
        // -------------------------------------------------------------------------
        const sendingStations = new Map<string, { region: string; district: string }>()
        const receivingStations = new Map<string, { region: string; district: string }>()

        feeders.forEach((f) => {
            if (!sendingStations.has(f.sendingMeter.station)) {
                sendingStations.set(f.sendingMeter.station, {
                    region: f.sendingMeter.region,
                    district: f.sendingMeter.district || "",
                })
            }
            if (!receivingStations.has(f.receivingMeter.station)) {
                receivingStations.set(f.receivingMeter.station, {
                    region: f.receivingMeter.region,
                    district: "",
                })
            }
        })

        const verticalSpacing = 120

        Array.from(sendingStations.entries()).forEach(([station, meta], idx) => {
            nodes.push({
                id: `sending-${station}`,
                type: "station",
                position: { x: 50, y: idx * verticalSpacing + 50 },
                data: {
                    label: station,
                    region: meta.region,
                    district: meta.district,
                    feederCount: (stationFeeders.get(station) || []).length,
                    feeders: stationFeeders.get(station) || [],
                    side: "sending",
                    color: "#16a34a",
                },
            })
        })

        Array.from(receivingStations.entries()).forEach(([station, meta], idx) => {
            nodes.push({
                id: `receiving-${station}`,
                type: "station",
                position: { x: 800, y: idx * verticalSpacing + 50 },
                data: {
                    label: station,
                    region: meta.region,
                    district: meta.district,
                    feederCount: (stationFeeders.get(station) || []).length,
                    feeders: stationFeeders.get(station) || [],
                    side: "receiving",
                    color: "#2563eb",
                },
            })
        })

        // Track parallel feeders between same station pair for bipartite mode
        const bpPairCount = new Map<string, number>()
        const bpPairIndex = new Map<string, number>()
        feeders.forEach((feeder) => {
            const key = `${feeder.sendingMeter.station}--${feeder.receivingMeter.station}`
            bpPairCount.set(key, (bpPairCount.get(key) || 0) + 1)
        })

        feeders.forEach((feeder, idx) => {
            const netFlow =
                feeder.sendingMeter.importKwh - feeder.sendingMeter.exportKwh +
                (feeder.receivingMeter.importKwh - feeder.receivingMeter.exportKwh)

            const baseColor = feeder.isCrossRegion ? "#f97316" : generateFeederColor(idx, feeders.length)
            const strokeWidth = Math.max(1.5, Math.min(4, Math.abs(netFlow) / 600000))

            const key = `${feeder.sendingMeter.station}--${feeder.receivingMeter.station}`
            const count = bpPairCount.get(key) || 1
            const current = bpPairIndex.get(key) || 0
            bpPairIndex.set(key, current + 1)
            const spread = Math.min(50 + count * 20, 140)
            const curvatureOffset = count === 1 ? 0 : -spread + (current / (count - 1)) * spread * 2

            edges.push({
                id: `feeder-${idx}`,
                source: `sending-${feeder.sendingMeter.station}`,
                target: `receiving-${feeder.receivingMeter.station}`,
                type: "feederEdge",
                animated: feeder.isCrossRegion,
                label: feeder.feederName,
                labelStyle: { fontSize: 9, fontWeight: 600, fill: baseColor },
                data: {
                    feederName: feeder.feederName,
                    baseColor,
                    curvatureOffset,
                    sendingImport: feeder.sendingMeter.importKwh,
                    sendingExport: feeder.sendingMeter.exportKwh,
                    receivingImport: feeder.receivingMeter.importKwh,
                    receivingExport: feeder.receivingMeter.exportKwh,
                },
                style: { stroke: baseColor, strokeWidth },
                markerEnd: { type: MarkerType.ArrowClosed, color: baseColor, width: 16, height: 16 },
            })
        })

        return {
            initialNodes: nodes,
            initialEdges: edges,
            hasChains: false,
            layoutInfo: {
                sendingCount: sendingStations.size,
                receivingCount: receivingStations.size,
            },
        }
    }, [feeders])

    const [nodes, , onNodesChange] = useNodesState(initialNodes)
    const [edges, , onEdgesChange] = useEdgesState(initialEdges)

    // Determine which nodes and edges match ALL active filter tags (union — any tag matches)
    const { matchedNodeIds, matchedEdgeIds } = useMemo(() => {
        if (filterTags.length === 0) return { matchedNodeIds: new Set<string>(), matchedEdgeIds: new Set<string>() }
        const queries = filterTags.map((t) => t.toLowerCase())
        const nodeIds = new Set<string>()
        const edgeIds = new Set<string>()
        const nodeMatches = (label: string) => queries.some((q) => label.toLowerCase().includes(q))
        nodes.forEach((n) => {
            if (nodeMatches(n.data?.label ?? "")) nodeIds.add(n.id)
        })
        edges.forEach((e) => {
            const feederMatch = queries.some((q) => e.data?.feederName?.toLowerCase().includes(q))
            const srcLabel = nodes.find((n) => n.id === e.source)?.data?.label ?? ""
            const tgtLabel = nodes.find((n) => n.id === e.target)?.data?.label ?? ""
            if (feederMatch || nodeMatches(srcLabel) || nodeMatches(tgtLabel)) {
                edgeIds.add(e.id)
                if (e.source) nodeIds.add(e.source)
                if (e.target) nodeIds.add(e.target)
            }
        })
        return { matchedNodeIds: nodeIds, matchedEdgeIds: edgeIds }
    }, [filterTags, nodes, edges])

    const hasSearch = filterTags.length > 0
    const hasEdgeClick = !!selectedEdgeId

    // Styled edges: edge-click takes priority over search
    const styledEdges = useMemo(() => {
        if (!hasSearch && !hasEdgeClick) return edges
        return edges.map((edge) => {
            const baseColor = edge.data?.baseColor || "#64748b"
            let isHighlighted = false
            if (hasEdgeClick) isHighlighted = edge.id === selectedEdgeId
            else if (hasSearch) isHighlighted = matchedEdgeIds.has(edge.id)
            const dimmed = hasEdgeClick || hasSearch
            return {
                ...edge,
                style: {
                    ...edge.style,
                    stroke: baseColor,
                    strokeWidth: isHighlighted ? (edge.style?.strokeWidth as number || 2) * 2.5 : edge.style?.strokeWidth,
                    opacity: dimmed ? (isHighlighted ? 1 : 0.08) : 1,
                },
                markerEnd: { ...edge.markerEnd, color: baseColor },
                labelStyle: { ...edge.labelStyle, opacity: dimmed ? (isHighlighted ? 1 : 0.08) : 1 },
                animated: isHighlighted || edge.animated,
            }
        })
    }, [edges, selectedEdgeId, hasSearch, hasEdgeClick, matchedEdgeIds])

    // Styled nodes: dim non-matching when searching
    const styledNodes = useMemo(() => {
        if (!hasSearch) return nodes
        return nodes.map((node) => ({
            ...node,
            style: {
                ...node.style,
                opacity: matchedNodeIds.has(node.id) ? 1 : 0.1,
            },
        }))
    }, [nodes, hasSearch, matchedNodeIds])

    const handleEdgeClick = (_: React.MouseEvent, edge: Edge) => {
        setSelectedEdgeId(selectedEdgeId === edge.id ? null : edge.id)
    }

    const handlePaneClick = () => setSelectedEdgeId(null)

    if (feeders.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5" />
                        Express Feeder Network Map
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[600px] flex items-center justify-center text-muted-foreground text-sm">
                        No feeder data available.
                    </div>
                </CardContent>
            </Card>
        )
    }

    const totalStations = new Set([
        ...feeders.map((f) => f.sendingMeter.station),
        ...feeders.map((f) => f.receivingMeter.station),
    ]).size

    return (
        <Card className="shadow-lg">
            <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <CardTitle className="flex items-center gap-2.5 text-xl">
                            <div className="p-2 rounded-lg bg-primary/10">
                                <Zap className="h-5 w-5 text-primary" />
                            </div>
                            Express Feeder Network Map
                        </CardTitle>
                        <CardDescription className="mt-2 leading-relaxed">
              <span className="font-semibold text-foreground/80">
                {totalStations} stations • {feeders.length} feeders
                  {hasChains && layoutInfo.totalColumns && ` • ${layoutInfo.totalColumns} chain depth`}
              </span>
                            <span className="block text-xs mt-1.5 text-muted-foreground">
                {hasChains
                    ? "Chain layout detected — stations ordered by flow depth. "
                    : "Bipartite layout — sending left, receiving right. "}
                                Click stations to drill into feeders & meters • Click edges to highlight • Scroll to zoom
              </span>
                        </CardDescription>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                        {hasChains ? (
                            <>
                                <Badge variant="outline" className="gap-2 px-3 py-1.5 justify-start">
                                    <div className="w-3 h-3 rounded-full bg-green-600 ring-2 ring-green-600/30" />
                                    <span className="font-medium">Source</span>
                                </Badge>
                                <Badge variant="outline" className="gap-2 px-3 py-1.5 justify-start">
                                    <div className="w-3 h-3 rounded-full bg-purple-500 ring-2 ring-purple-500/30" />
                                    <span className="font-medium">Relay</span>
                                </Badge>
                                <Badge variant="outline" className="gap-2 px-3 py-1.5 justify-start">
                                    <div className="w-3 h-3 rounded-full bg-blue-600 ring-2 ring-blue-600/30" />
                                    <span className="font-medium">Sink</span>
                                </Badge>
                                <Badge variant="outline" className="gap-2 px-3 py-1.5 justify-start">
                                    <GitBranch className="h-3 w-3 text-muted-foreground" />
                                    <span className="font-medium">Chain mode</span>
                                </Badge>
                            </>
                        ) : (
                            <>
                                <Badge variant="outline" className="gap-2 px-3 py-1.5 justify-start">
                                    <div className="w-3 h-3 rounded-full bg-green-600 ring-2 ring-green-600/30" />
                                    <span className="font-medium">Sending</span>
                                </Badge>
                                <Badge variant="outline" className="gap-2 px-3 py-1.5 justify-start">
                                    <div className="w-3 h-3 rounded-full bg-blue-600 ring-2 ring-blue-600/30" />
                                    <span className="font-medium">Receiving</span>
                                </Badge>
                                <Badge variant="outline" className="gap-2 px-3 py-1.5 justify-start">
                                    <ArrowRight className="h-3 w-3 text-orange-500" />
                                    <span className="font-medium">Cross-Region</span>
                                </Badge>
                            </>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Multi-filter bar */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <Input
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") addTag() }}
                                placeholder="Station or feeder name..."
                                className="pl-9 h-9 text-sm"
                            />
                        </div>
                        <button
                            onClick={addTag}
                            disabled={!searchInput.trim()}
                            className="h-9 px-4 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Add Filter
                        </button>
                        {filterTags.length > 0 && (
                            <button
                                onClick={() => setFilterTags([])}
                                className="h-9 px-3 rounded-md text-sm text-muted-foreground hover:text-foreground border hover:bg-accent transition-colors"
                            >
                                Clear all
                            </button>
                        )}
                    </div>

                    {/* Active filter chips + match count */}
                    {filterTags.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                            {filterTags.map((tag) => (
                                <span
                                    key={tag}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                                >
                  {tag}
                                    <button
                                        onClick={() => removeTag(tag)}
                                        className="hover:text-destructive transition-colors"
                                    >
                    <X className="h-3 w-3" />
                  </button>
                </span>
                            ))}
                            <span className="text-xs text-muted-foreground ml-1">
                {matchedNodeIds.size} station{matchedNodeIds.size !== 1 ? "s" : ""} •{" "}
                                {matchedEdgeIds.size} feeder{matchedEdgeIds.size !== 1 ? "s" : ""} matched
              </span>
                        </div>
                    )}
                </div>

                <div className="w-full h-[700px] bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 rounded-xl border-2 overflow-hidden shadow-inner">
                    <ReactFlow
                        nodes={styledNodes}
                        edges={styledEdges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onEdgeClick={handleEdgeClick}
                        onPaneClick={handlePaneClick}
                        nodeTypes={nodeTypes}
                        edgeTypes={edgeTypes}
                        fitView
                        minZoom={0.2}
                        maxZoom={1.5}
                        proOptions={{ hideAttribution: true }}
                    >
                        <Background
                            color="hsl(var(--muted-foreground) / 0.15)"
                            gap={20}
                            size={1.5}
                            variant="dots"
                        />
                        <Controls
                            className="bg-background border shadow-lg rounded-lg"
                            showInteractive={false}
                        />
                    </ReactFlow>
                </div>
            </CardContent>
        </Card>
    )
}
