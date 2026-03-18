"use client"

import React, { useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface BoundaryMeter {
    location: string
    import_kwh: number
    export_kwh: number
    net_kwh: number
}

interface EnergyFlow {
    from: string
    to: string
    totalKwh: number
    totalImportKwh: number
    totalExportKwh: number
    locations: BoundaryMeter[]
}

interface EnergyFlowNetworkProps {
    flows: EnergyFlow[]
}

export function EnergyFlowNetwork({ flows }: EnergyFlowNetworkProps) {
    const router = useRouter()
    const [selectedFlow, setSelectedFlow] = React.useState<EnergyFlow | null>(null)

    const networkData = useMemo(() => {
        const allRegions = new Set<string>()
        flows.forEach((flow) => {
            allRegions.add(flow.from)
            allRegions.add(flow.to)
        })

        const regions = Array.from(allRegions)
        const centerX = 300
        const centerY = 250
        const radius = 200

        // Calculate net balance for each region
        const regionBalance: Record<string, number> = {}
        flows.forEach((flow) => {
            regionBalance[flow.from] = (regionBalance[flow.from] || 0) - flow.totalKwh
            regionBalance[flow.to] = (regionBalance[flow.to] || 0) + flow.totalKwh
        })

        const nodes = regions.map((region, i) => {
            const angle = (i / regions.length) * 2 * Math.PI - Math.PI / 2
            const balance = regionBalance[region] || 0

            // Color based on role: green=exporter, blue=importer, purple=balanced
            let color = "#8b5cf6" // purple for balanced
            if (balance < -10000) color = "#22c55e" // green for exporters
            if (balance > 10000) color = "#3b82f6" // blue for importers

            return {
                id: region,
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle),
                balance,
                color,
            }
        })

        return { nodes, flows }
    }, [flows])

    return (
        <Card>
            <CardHeader>
                <CardTitle>Inter-Regional Energy Transfer Network</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Network Visualization */}
                    <div className="lg:col-span-2">
                        <svg width="600" height="500" className="border rounded-lg bg-slate-50 dark:bg-slate-900">
                            {/* Draw flow lines */}
                            {networkData.flows.map((flow, i) => {
                                const fromNode = networkData.nodes.find((n) => n.id === flow.from)
                                const toNode = networkData.nodes.find((n) => n.id === flow.to)
                                if (!fromNode || !toNode) return null

                                const isSelected = selectedFlow?.from === flow.from && selectedFlow?.to === flow.to

                                // Calculate arrow path
                                const dx = toNode.x - fromNode.x
                                const dy = toNode.y - fromNode.y
                                const distance = Math.sqrt(dx * dx + dy * dy)
                                const offsetX = (dx / distance) * 40
                                const offsetY = (dy / distance) * 40

                                const startX = fromNode.x + offsetX
                                const startY = fromNode.y + offsetY
                                const endX = toNode.x - offsetX
                                const endY = toNode.y - offsetY

                                // Line thickness based on kWh
                                const maxKwh = Math.max(...networkData.flows.map((f) => f.totalKwh))
                                const strokeWidth = 2 + (flow.totalKwh / maxKwh) * 8

                                return (
                                    <g key={i}>
                                        {/* Flow line */}
                                        <line
                                            x1={startX}
                                            y1={startY}
                                            x2={endX}
                                            y2={endY}
                                            stroke={isSelected ? "#f59e0b" : "#94a3b8"}
                                            strokeWidth={strokeWidth}
                                            opacity={isSelected ? 1 : 0.5}
                                            className="cursor-pointer hover:opacity-100 transition-opacity"
                                            onClick={() => setSelectedFlow(flow)}
                                        />
                                        {/* Arrow head */}
                                        <polygon
                                            points={`${endX},${endY} ${endX - 10},${endY - 5} ${endX - 10},${endY + 5}`}
                                            fill={isSelected ? "#f59e0b" : "#94a3b8"}
                                            opacity={isSelected ? 1 : 0.5}
                                            transform={`rotate(${(Math.atan2(dy, dx) * 180) / Math.PI}, ${endX}, ${endY})`}
                                            className="cursor-pointer"
                                            onClick={() => setSelectedFlow(flow)}
                                        />
                                        {/* kWh label with background */}
                                        <g>
                                            <rect
                                                x={(startX + endX) / 2 - 35}
                                                y={(startY + endY) / 2 - 10}
                                                width="70"
                                                height="20"
                                                fill="white"
                                                stroke="#e2e8f0"
                                                strokeWidth="1"
                                                rx="4"
                                                className="pointer-events-none"
                                            />
                                            <text
                                                x={(startX + endX) / 2}
                                                y={(startY + endY) / 2 + 4}
                                                fill="#334155"
                                                fontSize="11"
                                                fontWeight="600"
                                                textAnchor="middle"
                                                className="pointer-events-none"
                                            >
                                                {(flow.totalKwh / 1000).toFixed(0)}k kWh
                                            </text>
                                        </g>
                                    </g>
                                )
                            })}

                            {/* Draw region nodes */}
                            {networkData.nodes.map((node, i) => (
                                <g key={i}>
                                    {/* Outer glow circle */}
                                    <circle cx={node.x} cy={node.y} r={42} fill={node.color} opacity={0.2} />
                                    {/* Main circle */}
                                    <circle
                                        cx={node.x}
                                        cy={node.y}
                                        r={35}
                                        fill={node.color}
                                        stroke="white"
                                        strokeWidth="3"
                                        className="cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={() => router.push(`/regions/${node.id.toLowerCase().replace(/\s+/g, "-")}`)}
                                    />
                                    {/* Region name - split into multiple lines if needed */}
                                    <text
                                        x={node.x}
                                        y={node.y - 5}
                                        fill="white"
                                        fontSize="12"
                                        fontWeight="700"
                                        textAnchor="middle"
                                        className="pointer-events-none"
                                    >
                                        {node.id.split(" ")[0]}
                                    </text>
                                    <text
                                        x={node.x}
                                        y={node.y + 8}
                                        fill="white"
                                        fontSize="12"
                                        fontWeight="700"
                                        textAnchor="middle"
                                        className="pointer-events-none"
                                    >
                                        {node.id.split(" ")[1] || ""}
                                    </text>
                                </g>
                            ))}
                        </svg>
                        <div className="flex items-center gap-4 mt-3 text-xs">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-green-500"></div>
                                <span className="text-muted-foreground">Net Exporter</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                                <span className="text-muted-foreground">Net Importer</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-purple-500"></div>
                                <span className="text-muted-foreground">Balanced</span>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            Click on a region node or flow line to view details. Line thickness represents energy volume.
                        </p>
                    </div>

                    {/* Flow Details Panel */}
                    <div className="space-y-3">
                        <h4 className="font-semibold text-sm">{selectedFlow ? "Flow accross boundaries" : "Select a flow to view details"}</h4>

                        {selectedFlow ? (
                            <div className="space-y-3">
                                <div className="p-3 bg-muted rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="font-semibold">{selectedFlow.from}</span>
                                        <span>→</span>
                                        <span className="font-semibold">{selectedFlow.to}</span>
                                    </div>
                                    <div className="flex gap-4 text-sm mt-1">
                                        <div>
                                            <span className="text-muted-foreground">Total Import: </span>
                                            <span className="font-semibold text-green-600">{selectedFlow.totalImportKwh.toLocaleString()} kWh</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Total Export: </span>
                                            <span className="font-semibold text-orange-500">{selectedFlow.totalExportKwh.toLocaleString()} kWh</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h5 className="text-sm font-medium mb-2">Locations Involved</h5>
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                        {selectedFlow.locations.map((location, i) => (
                                            <div key={i} className="p-2 bg-muted/50 rounded text-xs">
                                                <div className="font-semibold mb-1">{location.location}</div>
                                                <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                                                    <div>
                                                        Import: <span className="text-green-600">{location.import_kwh.toLocaleString()}</span>
                                                    </div>
                                                    <div>
                                                        Export: <span className="text-blue-600">{location.export_kwh.toLocaleString()}</span>
                                                    </div>
                                                    <div className="col-span-2">
                                                        Net:{" "}
                                                        <span className="text-foreground font-medium">{location.net_kwh.toLocaleString()} kWh</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground">
                                The network diagram shows energy flows between regions. Click on any flow line to see which specific
                                locations are involved in the transfer.
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
