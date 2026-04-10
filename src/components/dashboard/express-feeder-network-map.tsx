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
} from "reactflow"
import "reactflow/dist/style.css"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Zap, ChevronDown, ChevronRight } from "lucide-react"
import type { FeederDetail } from "@/hooks/api/use-express-feeder-api"

interface ExpressFeederNetworkMapProps {
    feeders: FeederDetail[]
}

// Expandable Station Node - Click to drill into feeders/meters
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
            {/* Station Header - Click to expand */}
            <div
                className="px-4 py-2.5 cursor-pointer hover:bg-accent/20 transition-colors flex items-center justify-between gap-2"
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    background: `linear-gradient(135deg, ${data.color}08 0%, transparent 100%)`
                }}
            >
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs text-foreground truncate">{data.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{data.region}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <Badge
                        variant="secondary"
                        className="text-[9px] px-1.5 py-0.5 font-semibold"
                        style={{
                            backgroundColor: `${data.color}15`,
                            color: data.color,
                        }}
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

            {/* Expanded Feeder/Meter Details */}
            {isExpanded && data.feeders && data.feeders.length > 0 && (
                <div className="border-t px-2.5 py-2 space-y-1.5 max-h-64 overflow-y-auto bg-muted/5">
                    {data.feeders.map((feeder: any, idx: number) => (
                        <div
                            key={idx}
                            className="bg-background rounded-md px-2.5 py-2 text-[10px] border"
                        >
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

            {/* Connection Handles */}
            <Handle
                type={data.side === "sending" ? "source" : "target"}
                position={data.side === "sending" ? Position.Right : Position.Left}
                className="w-2 h-2 border-2 border-background"
                style={{
                    backgroundColor: data.color,
                }}
            />
        </div>
    )
}

const nodeTypes = {
    station: StationNode,
}

// Generate distinct colors for feeders
const generateFeederColor = (index: number, total: number): string => {
    const hue = (index * 360 / Math.max(total, 1)) % 360
    const saturation = 65 + (index % 3) * 10
    const lightness = 50 + (index % 4) * 5
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

export function ExpressFeederNetworkMap({ feeders }: ExpressFeederNetworkMapProps) {
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

    // Build bipartite graph: sending stations (left) and receiving stations (right)
    const { initialNodes, initialEdges } = useMemo(() => {
        const sendingStations = new Map<string, {
            region: string
            district: string
            feeders: any[]
        }>()

        const receivingStations = new Map<string, {
            region: string
            district: string
            feeders: any[]
        }>()

        // Group feeders by sending and receiving stations
        feeders.forEach((feeder) => {
            const sendingKey = feeder.sendingMeter.station
            const receivingKey = feeder.receivingMeter.station

            // Add to sending stations map
            if (!sendingStations.has(sendingKey)) {
                sendingStations.set(sendingKey, {
                    region: feeder.sendingMeter.region,
                    district: feeder.sendingMeter.district || "",
                    feeders: [],
                })
            }
            sendingStations.get(sendingKey)!.feeders.push({
                name: feeder.feederName,
                isCrossRegion: feeder.isCrossRegion,
                sendingImport: feeder.sendingMeter.importKwh,
                sendingExport: feeder.sendingMeter.exportKwh,
                receivingImport: feeder.receivingMeter.importKwh,
                receivingExport: feeder.receivingMeter.exportKwh,
            })

            // Add to receiving stations map
            if (!receivingStations.has(receivingKey)) {
                receivingStations.set(receivingKey, {
                    region: feeder.receivingMeter.region,
                    district: feeder.receivingMeter.district || "",
                    feeders: [],
                })
            }
            receivingStations.get(receivingKey)!.feeders.push({
                name: feeder.feederName,
                isCrossRegion: feeder.isCrossRegion,
                sendingImport: feeder.sendingMeter.importKwh,
                sendingExport: feeder.sendingMeter.exportKwh,
                receivingImport: feeder.receivingMeter.importKwh,
                receivingExport: feeder.receivingMeter.exportKwh,
            })
        })

        const nodes: Node[] = []
        const leftX = 50
        const rightX = 800
        const verticalSpacing = 120

        // Create sending station nodes (left side)
        Array.from(sendingStations.entries()).forEach(([station, data], idx) => {
            nodes.push({
                id: `sending-${station}`,
                type: "station",
                position: { x: leftX, y: idx * verticalSpacing + 50 },
                data: {
                    label: station,
                    region: data.region,
                    district: data.district,
                    feederCount: data.feeders.length,
                    feeders: data.feeders,
                    side: "sending",
                    color: "#16a34a",
                },
            })
        })

        // Create receiving station nodes (right side)
        Array.from(receivingStations.entries()).forEach(([station, data], idx) => {
            nodes.push({
                id: `receiving-${station}`,
                type: "station",
                position: { x: rightX, y: idx * verticalSpacing + 50 },
                data: {
                    label: station,
                    region: data.region,
                    district: data.district,
                    feederCount: data.feeders.length,
                    feeders: data.feeders,
                    side: "receiving",
                    color: "#2563eb",
                },
            })
        })

        // Create edges - ONE PER FEEDER with unique colors
        const edges: Edge[] = feeders.map((feeder, idx) => {
            const netFlow =
                (feeder.sendingMeter.importKwh - feeder.sendingMeter.exportKwh) +
                (feeder.receivingMeter.importKwh - feeder.receivingMeter.exportKwh)

            // Each feeder gets its own unique color, unless cross-region (then orange)
            const baseColor = feeder.isCrossRegion ? "#f97316" : generateFeederColor(idx, feeders.length)
            const strokeWidth = Math.max(1.5, Math.min(4, Math.abs(netFlow) / 600000))

            return {
                id: `feeder-${idx}`,
                source: `sending-${feeder.sendingMeter.station}`,
                target: `receiving-${feeder.receivingMeter.station}`,
                type: "default",
                animated: feeder.isCrossRegion,
                label: feeder.feederName,
                labelStyle: {
                    fontSize: 9,
                    fontWeight: 600,
                    fill: baseColor,
                },
                labelShowBg: true,
                labelBgStyle: {
                    fill: "hsl(var(--background))",
                    fillOpacity: 0.9,
                },
                labelBgPadding: [4, 6] as [number, number],
                labelBgBorderRadius: 4,
                data: {
                    feederName: feeder.feederName,
                    baseColor,
                    sendingImport: feeder.sendingMeter.importKwh,
                    sendingExport: feeder.sendingMeter.exportKwh,
                    receivingImport: feeder.receivingMeter.importKwh,
                    receivingExport: feeder.receivingMeter.exportKwh,
                },
                style: {
                    stroke: baseColor,
                    strokeWidth,
                },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: baseColor,
                    width: 16,
                    height: 16,
                },
            }
        })

        return {
            initialNodes: nodes,
            initialEdges: edges,
        }
    }, [feeders])

    const [nodes, , onNodesChange] = useNodesState(initialNodes)
    const [edges, , onEdgesChange] = useEdgesState(initialEdges)

    // Update edge styles based on selection
    const styledEdges = useMemo(() => {
        if (!selectedEdgeId) return edges

        return edges.map((edge) => {
            const isSelected = edge.id === selectedEdgeId
            const baseColor = edge.data?.baseColor || "#64748b"

            return {
                ...edge,
                style: {
                    ...edge.style,
                    stroke: baseColor,
                    strokeWidth: isSelected ? (edge.style?.strokeWidth as number || 2) * 2.5 : edge.style?.strokeWidth,
                    opacity: isSelected ? 1 : 0.2,
                },
                markerEnd: {
                    ...edge.markerEnd,
                    color: baseColor,
                },
                labelStyle: {
                    ...edge.labelStyle,
                    opacity: isSelected ? 1 : 0.3,
                },
                animated: isSelected || edge.animated,
            }
        })
    }, [edges, selectedEdgeId])

    const handleEdgeClick = (_event: React.MouseEvent, edge: Edge) => {
        setSelectedEdgeId(selectedEdgeId === edge.id ? null : edge.id)
    }

    const handlePaneClick = () => {
        setSelectedEdgeId(null)
    }

    if (feeders.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5" />
                        Express Feeder Network Map
                    </CardTitle>
                    <CardDescription>Bipartite view: Sending stations ← Feeders → Receiving stations</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[600px] flex items-center justify-center text-muted-foreground text-sm">
                        No feeder data available to display.
                    </div>
                </CardContent>
            </Card>
        )
    }

    const sendingStationCount = new Set(feeders.map(f => f.sendingMeter.station)).size
    const receivingStationCount = new Set(feeders.map(f => f.receivingMeter.station)).size

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
                {sendingStationCount} sending • {feeders.length} feeders • {receivingStationCount} receiving
              </span>
                            <span className="block text-xs mt-1.5 text-muted-foreground">
                Click stations to drill into feeders & meters • Drag to reposition • Scroll to zoom
              </span>
                        </CardDescription>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                        <Badge variant="outline" className="gap-2 px-3 py-1.5 justify-start">
                            <div className="w-3 h-3 rounded-full bg-green-600 ring-2 ring-green-600/30" />
                            <span className="font-medium">Sending</span>
                        </Badge>
                        <Badge variant="outline" className="gap-2 px-3 py-1.5 justify-start">
                            <div className="w-3 h-3 rounded-full bg-blue-600 ring-2 ring-blue-600/30" />
                            <span className="font-medium">Receiving</span>
                        </Badge>
                        <Badge variant="outline" className="gap-2 px-3 py-1.5 justify-start">
                            <div className="w-4 h-0.5 bg-orange-500 rounded-full" />
                            <span className="font-medium">Cross-Region</span>
                        </Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="w-full h-[700px] bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 rounded-xl border-2 overflow-hidden shadow-inner">
                    <ReactFlow
                        nodes={nodes}
                        edges={styledEdges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onEdgeClick={handleEdgeClick}
                        onPaneClick={handlePaneClick}
                        nodeTypes={nodeTypes}
                        fitView
                        minZoom={0.3}
                        maxZoom={1.5}
                        defaultViewport={{ x: 100, y: 50, zoom: 0.7 }}
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
