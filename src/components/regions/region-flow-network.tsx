"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface BoundaryMeter {
    location: string
    import_kwh: number
    export_kwh: number
    net_flow: number
}

interface TradingPartner {
    region: string
    totalFlow: number
    netFlow: number
    isImporter: boolean
    locationCount: number
    locations: BoundaryMeter[]
}

interface RegionFlowNetworkProps {
    regionName: string
    tradingPartners: TradingPartner[]
}

export function RegionFlowNetwork({ regionName, tradingPartners }: RegionFlowNetworkProps) {
    const [selectedPartner, setSelectedPartner] = useState<TradingPartner | null>(null)

    // Calculate positions for center region and surrounding partners
    const layout = useMemo(() => {
        const centerX = 300
        const centerY = 200
        const radius = 220  // increase from 180 or 200

        const partners = tradingPartners.map((partner, index) => {
            // For 2 partners: place on left and right
            // For 3+: distribute in a semicircle
            let angle
            if (tradingPartners.length === 2) {
                angle = index === 0 ? Math.PI : 0 // left and right
            } else {
                angle = (index / (tradingPartners.length - 1)) * Math.PI
            }

            return {
                ...partner,
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle),
            }
        })

        return {
            center: { x: centerX, y: centerY },
            partners,
        }
    }, [tradingPartners])

    // Find max flow for stroke width calculation
    const maxFlow = useMemo(() => {
        return Math.max(...tradingPartners.map((p) => Math.abs(p.netFlow)))
    }, [tradingPartners])

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle>Regional Energy Exchange Network</CardTitle>
                    <CardDescription>Energy flows between {regionName} and neighboring regions</CardDescription>
                </CardHeader>
                <CardContent>
                    <svg width="600" height="400" viewBox="-50 -50 700 500"
                         className="w-full border rounded-lg bg-slate-50 dark:bg-slate-900">                        {/* Draw flow lines */}
                        {layout.partners.map((partner, index) => {
                            const isSelected = selectedPartner?.region === partner.region
                            const strokeWidth = 2 + (Math.abs(partner.netFlow) / maxFlow) * 8

                            // Calculate line endpoints (stop at edge of circles)
                            const dx = partner.x - layout.center.x
                            const dy = partner.y - layout.center.y
                            const distance = Math.sqrt(dx * dx + dy * dy)
                            const offsetX = (dx / distance) * 50 // center circle radius
                            const offsetY = (dy / distance) * 50
                            const endOffsetX = (dx / distance) * 35 // partner circle radius
                            const endOffsetY = (dy / distance) * 35

                            const startX = layout.center.x + offsetX
                            const startY = layout.center.y + offsetY
                            const endX = partner.x - endOffsetX
                            const endY = partner.y - endOffsetY

                            const color = partner.isImporter ? "#ef4444" : "#22c55e"

                            return (
                                <g key={index}>
                                    {/* Flow line */}
                                    <line
                                        x1={startX}
                                        y1={startY}
                                        x2={endX}
                                        y2={endY}
                                        stroke={isSelected ? "#f59e0b" : color}
                                        strokeWidth={strokeWidth}
                                        opacity={isSelected ? 1 : 0.5}
                                        onClick={() => setSelectedPartner(partner)}
                                        className="cursor-pointer hover:opacity-100 transition-opacity"
                                    />

                                    {/* Arrow head */}
                                    <polygon
                                        points={`${endX},${endY} ${endX - 10},${endY - 5} ${endX - 10},${endY + 5}`}
                                        fill={isSelected ? "#f59e0b" : color}
                                        opacity={isSelected ? 1 : 0.5}
                                        transform={`rotate(${(Math.atan2(dy, dx) * 180) / Math.PI}, ${endX}, ${endY})`}
                                        className="cursor-pointer"
                                        onClick={() => setSelectedPartner(partner)}
                                    />

                                    {/* Flow label with white background */}
                                    <g>
                                        <rect
                                            x={(startX + endX) / 2 - 40}
                                            y={(startY + endY) / 2 - 10}
                                            width="80"
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
                                            {(Math.abs(partner.netFlow) / 1000).toFixed(0)}k kWh
                                        </text>
                                    </g>
                                </g>
                            )
                        })}

                        {/* Center region node */}
                        <g>
                            {/* Outer glow circle */}
                            <circle
                                cx={layout.center.x}
                                cy={layout.center.y}
                                r={57}
                                fill="hsl(var(--primary))"
                                opacity={0.2}
                            />
                            {/* Main circle */}
                            <circle
                                cx={layout.center.x}
                                cy={layout.center.y}
                                r={50}
                                fill="hsl(var(--primary))"
                                stroke="white"
                                strokeWidth={3}
                            />
                            {/* Region name - split into multiple lines */}
                            <text
                                x={layout.center.x}
                                y={layout.center.y - 5}
                                textAnchor="middle"
                                fill="white"
                                fontSize="13"
                                fontWeight="700"
                                className="pointer-events-none"
                            >
                                {regionName.split(" ")[0]}
                            </text>
                            {regionName.split(" ")[1] && (
                                <text
                                    x={layout.center.x}
                                    y={layout.center.y + 10}
                                    textAnchor="middle"
                                    fill="white"
                                    fontSize="13"
                                    fontWeight="700"
                                    className="pointer-events-none"
                                >
                                    {regionName.split(" ")[1]}
                                </text>
                            )}
                        </g>

                        {/* Partner region nodes */}
                        {layout.partners.map((partner, index) => {
                            const isSelected = selectedPartner?.region === partner.region
                            const nodeColor = partner.isImporter ? "#3b82f6" : "#22c55e"

                            return (
                                <g key={index} onClick={() => setSelectedPartner(partner)} className="cursor-pointer">
                                    {/* Outer glow circle */}
                                    <circle
                                        cx={partner.x}
                                        cy={partner.y}
                                        r={42}
                                        fill={nodeColor}
                                        opacity={0.2}
                                    />
                                    {/* Main circle */}
                                    <circle
                                        cx={partner.x}
                                        cy={partner.y}
                                        r={35}
                                        fill={nodeColor}
                                        stroke={isSelected ? "#f59e0b" : "white"}
                                        strokeWidth={isSelected ? 4 : 3}
                                        className="hover:opacity-80 transition-all"
                                    />
                                    {/* Region name - split into multiple lines */}
                                    <text
                                        x={partner.x}
                                        y={partner.y - 5}
                                        textAnchor="middle"
                                        fill="white"
                                        fontSize="12"
                                        fontWeight="700"
                                        className="pointer-events-none"
                                    >
                                        {partner.region.split(" ")[0]}
                                    </text>
                                    {partner.region.split(" ")[1] && (
                                        <text
                                            x={partner.x}
                                            y={partner.y + 8}
                                            textAnchor="middle"
                                            fill="white"
                                            fontSize="12"
                                            fontWeight="700"
                                            className="pointer-events-none"
                                        >
                                            {partner.region.split(" ")[1]}
                                        </text>
                                    )}
                                </g>
                            )
                        })}
                    </svg>

                    {/* Legend */}
                    <div className="flex items-center gap-6 mt-4 text-xs">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-green-500" />
                            <span className="text-muted-foreground">Net Exporter (to {regionName})</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-blue-500" />
                            <span className="text-muted-foreground">Net Importer (from {regionName})</span>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        Click on a region node or flow line to view details. Line thickness represents energy volume.
                    </p>
                </CardContent>
            </Card>

            {/* Partner details panel */}
            <Card>
                <CardHeader>
                    <CardTitle>Flow Details</CardTitle>
                    <CardDescription>
                        {selectedPartner ? `Trading with ${selectedPartner.region}` : "Click on a region or flow line"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {selectedPartner ? (
                        <div className="space-y-4">
                            <div className="p-3 bg-muted rounded-lg">
                                <div className="text-2xl font-bold">
                                    {Math.abs(selectedPartner.netFlow).toLocaleString()} kWh
                                </div>
                                <div className="text-sm text-muted-foreground mt-1">
                                    {selectedPartner.isImporter
                                        ? `${regionName} imports from ${selectedPartner.region}`
                                        : `${regionName} exports to ${selectedPartner.region}`}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="font-semibold text-sm">
                                    Boundary Locations ({selectedPartner.locationCount})
                                </div>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {selectedPartner.locations.map((location, idx) => (
                                        <div key={idx} className="p-2 bg-muted/50 rounded-lg text-xs">
                                            <div className="font-semibold mb-1">{location.location}</div>
                                            <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                                                <div>
                                                    Import: <span className="text-green-600">{location.import_kwh.toLocaleString()}</span>
                                                </div>
                                                <div>
                                                    Export: <span className="text-blue-600">{location.export_kwh.toLocaleString()}</span>
                                                </div>
                                            </div>
                                            <div className="text-muted-foreground mt-1">
                                                Net:{" "}
                                                <span className={location.net_flow > 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                                                    {Math.abs(location.net_flow).toLocaleString()} kWh{" "}
                                                    {location.net_flow > 0 ? "export" : "import"}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-muted-foreground text-sm py-8">
                            Click on a region node or flow line to see detailed information about the energy exchange and boundary
                            meter locations.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
