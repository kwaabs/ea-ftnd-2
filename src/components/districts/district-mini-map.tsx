"use client"

import { useEffect, useRef } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExternalLink, MapPin } from "lucide-react"
import Link from "next/link"

interface DistrictMiniMapProps {
    districtName: string
    geometry: any // GeoJSON geometry from the API
    meterCoordinates?: Array<{ lat: number; lng: number; type: string; meter_number: string; brand?: string }>
}

export function DistrictMiniMap({ districtName, geometry, meterCoordinates = [] }: DistrictMiniMapProps) {
    const mapContainer = useRef<HTMLDivElement>(null)
    const map = useRef<maplibregl.Map | null>(null)
    const markersRef = useRef<maplibregl.Marker[]>([])

    useEffect(() => {
        if (!mapContainer.current || !geometry) return
        if (map.current) return // Already initialized

        // Calculate center from geometry bounds
        const coordinates = geometry.coordinates[0]
        let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity

        coordinates.forEach((coord: number[]) => {
            const [lng, lat] = coord
            minLng = Math.min(minLng, lng)
            maxLng = Math.max(maxLng, lng)
            minLat = Math.min(minLat, lat)
            maxLat = Math.max(maxLat, lat)
        })

        const centerLng = (minLng + maxLng) / 2
        const centerLat = (minLat + maxLat) / 2

        // Initialize map
        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
            center: [centerLng, centerLat],
            zoom: 11,
            attributionControl: false,
        })

        // Add navigation controls
        map.current.addControl(new maplibregl.NavigationControl(), "top-right")

        // Wait for map to load, then add district polygon
        map.current.on("load", () => {
            if (!map.current) return

            // Add district boundary source
            map.current.addSource("district", {
                type: "geojson",
                data: {
                    type: "Feature",
                    properties: { name: districtName },
                    geometry: geometry,
                },
            })

            // Add fill layer
            map.current.addLayer({
                id: "district-fill",
                type: "fill",
                source: "district",
                paint: {
                    "fill-color": "#3b82f6",
                    "fill-opacity": 0.2,
                },
            })

            // Add outline layer
            map.current.addLayer({
                id: "district-outline",
                type: "line",
                source: "district",
                paint: {
                    "line-color": "#3b82f6",
                    "line-width": 3,
                },
            })

            // Fit map to district bounds
            const bounds = new maplibregl.LngLatBounds()
            coordinates.forEach((coord: number[]) => {
                bounds.extend(coord as [number, number])
            })
            map.current.fitBounds(bounds, { padding: 40 })

            // Add meter markers
            if (meterCoordinates.length > 0) {
                meterCoordinates.forEach((meter) => {
                    if (!map.current) return

                    const el = document.createElement('div')
                    el.className = 'meter-marker'
                    el.style.width = '10px'
                    el.style.height = '10px'
                    el.style.borderRadius = '50%'
                    el.style.border = '2px solid white'
                    el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)'
                    el.style.cursor = 'pointer'
                    
                    // Different colors for different meter types
                    if (meter.type === 'DTX') {
                        el.style.backgroundColor = '#10b981' // green for DTX
                    } else {
                        el.style.backgroundColor = '#8b5cf6' // purple for boundary
                    }

                    const marker = new maplibregl.Marker({ element: el })
                        .setLngLat([meter.lng, meter.lat])
                        .setPopup(
                            new maplibregl.Popup({ offset: 15 }).setHTML(
                                `<div style="padding: 4px;">
                                    <strong style="font-size: 12px;">${meter.meter_number}</strong><br/>
                                    <span style="font-size: 11px; color: #666;">Type: ${meter.type}</span><br/>
                                    ${meter.brand ? `<span style="font-size: 11px; color: #666;">Brand: ${meter.brand}</span>` : ''}
                                </div>`
                            )
                        )
                        .addTo(map.current)

                    markersRef.current.push(marker)
                })
            }
        })

        return () => {
            // Clean up markers
            markersRef.current.forEach(marker => marker.remove())
            markersRef.current = []
            map.current?.remove()
            map.current = null
        }
    }, [geometry, districtName, meterCoordinates])

    if (!geometry) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">District Map</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-64 flex flex-col items-center justify-center bg-muted/30 rounded-lg border-2 border-dashed">
                        <MapPin className="h-12 w-12 text-muted-foreground mb-2 opacity-30" />
                        <p className="text-sm text-muted-foreground font-medium">No map data available</p>
                        <p className="text-xs text-muted-foreground mt-1">Boundary geometry not set for this district</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">District Map</CardTitle>
                    <Button variant="ghost" size="sm" asChild className="h-8 text-xs">
                        <Link href={`/map?district=${encodeURIComponent(districtName)}`} className="flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" />
                            Full Map
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div ref={mapContainer} className="h-64 w-full rounded-lg overflow-hidden border-2 shadow-sm" />
                <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <div className="flex-1">
                        <p className="font-medium">{districtName} District</p>
                        <p>Boundary polygon with {geometry.coordinates[0].length} coordinates</p>
                        {meterCoordinates.length > 0 && (
                            <p className="mt-1">
                                {meterCoordinates.filter(m => m.type === 'DTX').length} DTX meters, {' '}
                                {meterCoordinates.filter(m => m.type === 'DISTRICT_BOUNDARY').length} boundary meters
                            </p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
