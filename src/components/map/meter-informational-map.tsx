"use client"

import Link from "next/link"
import { useEffect, useRef, useState, useMemo } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { useAllDistrictsGeometry } from "@/hooks/api/use-districts-geometry-api"
import { useAllRegionsGeometry } from "@/hooks/api/use-regions-geometry-api"
import { useMeters } from "@/hooks/api/use-meter-api"
import { useFeeders11kV, useFeeders33kV } from "@/hooks/api/use-feeders-api"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import type { Meter } from "@/lib/types/api"

const BASEMAP_OPTIONS = [
    { key: "google", label: "Google Maps" },
    { key: "blank", label: "Blank Map" },
    { key: "carto-voyager", label: "Carto Voyager" },
    { key: "carto-light", label: "Carto Light" },
    { key: "carto-dark", label: "Carto Dark" },
] as const

type BasemapKey = typeof BASEMAP_OPTIONS[number]["key"]

function getBasemapTiles(key: BasemapKey): { tiles: string[]; attribution: string } | null {
    switch (key) {
        case "google":
            return {
                tiles: [
                    "https://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
                    "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
                    "https://mt2.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
                    "https://mt3.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
                ],
                attribution: "&copy; Google Maps",
            }
        case "blank":
            return null
        case "carto-voyager":
            return {
                tiles: ["https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"],
                attribution: "&copy; CARTO &copy; OpenStreetMap contributors",
            }
        case "carto-light":
            return {
                tiles: ["https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png"],
                attribution: "&copy; CARTO &copy; OpenStreetMap contributors",
            }
        case "carto-dark":
            return {
                tiles: ["https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png"],
                attribution: "&copy; CARTO &copy; OpenStreetMap contributors",
            }
    }
}

interface GroupedMarker {
    name: string
    type: "BSP Station" | "Regional Boundary" | "District Boundary" | "DTX" | "District" | "11kV Feeder" | "33kV Feeder"
    meters: Meter[]
    lat: number
    lon: number
    color: string
    district?: string
    region?: string
    feederInfo?: {
        circuit_id: string
        orientation: string
        phase_configuration: string
        conductor_type: string
        voltage: string
    }
}

export function MeterInformationalMap() {
    const mapContainer = useRef<HTMLDivElement>(null)
    const map = useRef<maplibregl.Map | null>(null)
    const markersRef = useRef<maplibregl.Marker[]>([])
    const [mapLoaded, setMapLoaded] = useState(false)
    const [selectedGroup, setSelectedGroup] = useState<GroupedMarker | null>(null)

    const [basemap, setBasemap] = useState<BasemapKey>("google")
    const [basemapDropdownOpen, setBasemapDropdownOpen] = useState(false)
    const [controlsCollapsed, setControlsCollapsed] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [searchOpen, setSearchOpen] = useState(false)

    const [visibility, setVisibility] = useState({
        bsp: true,
        regionalBoundary: true,
        districtBoundary: true,
        dtx: true,
        districts: false,
        regions: true,
        feeders11kV: false,
        feeders33kV: false,
    })

    const { data: districtsData, isLoading: isLoadingDistricts } = useAllDistrictsGeometry()
    const { data: regionsData } = useAllRegionsGeometry()
    const { data: metersData, isLoading: isLoadingMeters } = useMeters({ limit: 5000 })
    const { data: feeders11kVData, isLoading: isLoading11kV } = useFeeders11kV()
    const { data: feeders33kVData, isLoading: isLoading33kV } = useFeeders33kV()

    const searchResults = useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        if (!q || !metersData?.data?.data) return []
        return metersData.data.data
            .filter((m: any) => m.meter_number?.toLowerCase().includes(q) && m.latitude && m.longitude)
            .slice(0, 8)
    }, [searchQuery, metersData])

    const groupedMarkers = useMemo<GroupedMarker[]>(() => {
        if (!metersData?.data?.data) return []

        const bspGroups: Record<string, GroupedMarker> = {}
        const individualMarkers: GroupedMarker[] = []

        metersData.data.data.forEach((meter) => {
            if (!meter.latitude || !meter.longitude) return

            if (meter.meter_type === "BSP") {
                const key = `bsp-${meter.station || "unknown"}`
                if (!bspGroups[key]) {
                    bspGroups[key] = {
                        name: meter.station || "Unknown Station",
                        type: "BSP Station",
                        meters: [],
                        lat: meter.latitude,
                        lon: meter.longitude,
                        color: "#3b82f6",
                        region: meter.region,
                    }
                }
                bspGroups[key].meters.push(meter)
            } else {
                let name: string
                let type: "Regional Boundary" | "District Boundary" | "DTX"
                let color: string

                if (meter.meter_type === "REGIONAL_BOUNDARY") {
                    name = meter.meter_number || "Unknown Meter"
                    type = "Regional Boundary"
                    color = "#10b981"
                } else if (meter.meter_type === "DISTRICT_BOUNDARY") {
                    name = meter.meter_number || "Unknown Meter"
                    type = "District Boundary"
                    color = "#f97316"
                } else if (meter.meter_type === "DTX") {
                    name = meter.meter_number || "Unknown Meter"
                    type = "DTX"
                    color = "#a855f7"
                } else {
                    return
                }

                individualMarkers.push({
                    name,
                    type,
                    meters: [meter],
                    lat: meter.latitude,
                    lon: meter.longitude,
                    color,
                    region: meter.region,
                    district: meter.district,
                })
            }
        })

        return [...Object.values(bspGroups), ...individualMarkers]
    }, [metersData])

    const visibleMarkers = useMemo(() => {
        return groupedMarkers.filter((marker) => {
            if (marker.type === "BSP Station") return visibility.bsp
            if (marker.type === "Regional Boundary") return visibility.regionalBoundary
            if (marker.type === "District Boundary") return visibility.districtBoundary
            if (marker.type === "DTX") return visibility.dtx
            return true
        })
    }, [groupedMarkers, visibility])

    const uniqueCircuit11kV = useMemo(() => {
        if (!feeders11kVData?.data) return 0
        return new Set(feeders11kVData.data.map(f => f.circuit_id)).size
    }, [feeders11kVData])

    const uniqueCircuit33kV = useMemo(() => {
        if (!feeders33kVData?.data) return 0
        return new Set(feeders33kVData.data.map(f => f.circuit_id)).size
    }, [feeders33kVData])

    // Initialize map
    useEffect(() => {
        if (!mapContainer.current || map.current) return

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: { version: 8, sources: {}, layers: [] },
            center: [-1.5, 7.5],
            zoom: 6,
        })

        map.current.addControl(new maplibregl.NavigationControl(), "top-right")
        map.current.on("load", () => {
            console.log("[Map] Map loaded")
            setMapLoaded(true)
        })

        return () => {
            if (map.current) {
                map.current.remove()
                map.current = null
            }
        }
    }, [])

    // Swap basemap
    useEffect(() => {
        if (!map.current || !mapLoaded) return
        const m = map.current
        const tileConfig = getBasemapTiles(basemap)

        try {
            if (m.getLayer("basemap-layer")) m.removeLayer("basemap-layer")
            if (m.getSource("basemap-source")) m.removeSource("basemap-source")

            if (tileConfig) {
                m.addSource("basemap-source", {
                    type: "raster",
                    tiles: tileConfig.tiles,
                    tileSize: 256,
                    attribution: tileConfig.attribution,
                })

                // Add at the bottom to not cover other layers
                m.addLayer({
                    id: "basemap-layer",
                    type: "raster",
                    source: "basemap-source"
                })
            }
        } catch (error) {
            console.error("[Map] Error swapping basemap:", error)
        }
    }, [basemap, mapLoaded])

    // Resize map when panel opens/closes
    useEffect(() => {
        if (map.current) setTimeout(() => map.current?.resize(), 300)
    }, [selectedGroup])

    // Add district boundaries
    useEffect(() => {
        if (!map.current || !mapLoaded || !districtsData?.data?.districts) return
        const mapInstance = map.current

        try {
            if (mapInstance.getSource("districts")) return

            const features = districtsData.data.districts
                .filter((d) => !!(d.geojson || d.boundary))
                .map((d) => {
                    if (d.geojson) return d.geojson
                    return {
                        type: "Feature" as const,
                        properties: { district: d.district, region: d.region },
                        geometry: d.boundary,
                    }
                })

            if (features.length === 0) return

            mapInstance.addSource("districts", {
                type: "geojson",
                data: { type: "FeatureCollection", features },
            })

            mapInstance.addLayer({
                id: "district-fill",
                type: "fill",
                source: "districts",
                paint: { "fill-color": "#e2e8f0", "fill-opacity": 0.3 },
                layout: { visibility: visibility.districts ? "visible" : "none" },
            })

            mapInstance.addLayer({
                id: "district-boundaries",
                type: "line",
                source: "districts",
                paint: { "line-color": "#64748b", "line-width": 2, "line-opacity": 0.8 },
                layout: { visibility: visibility.districts ? "visible" : "none" },
            })

            mapInstance.on("click", "district-fill", (e) => {
                const features = mapInstance.queryRenderedFeatures(e.point, { layers: ["district-fill"] })
                if (features.length === 0) return
                const { district, region } = features[0].properties || {}
                new maplibregl.Popup({ closeButton: true, closeOnClick: true })
                    .setLngLat(e.lngLat)
                    .setHTML(`
                        <div style="padding:12px;min-width:180px;">
                            <h4 style="font-weight:700;font-size:14px;margin-bottom:8px;">${district || "Unknown District"}</h4>
                            ${region ? `<div style="font-size:12px;color:#64748b;">Region: <strong>${region}</strong></div>` : ""}
                        </div>
                    `)
                    .addTo(mapInstance)
            })

            mapInstance.on("mouseenter", "district-fill", () => { mapInstance.getCanvas().style.cursor = "pointer" })
            mapInstance.on("mouseleave", "district-fill", () => { mapInstance.getCanvas().style.cursor = "" })
        } catch (error) {
            console.error("[Map] Error adding districts:", error)
        }
    }, [mapLoaded, districtsData, visibility.districts])

    // Add region boundaries
    useEffect(() => {
        if (!map.current || !mapLoaded || !regionsData?.data?.regions) return
        const mapInstance = map.current

        try {
            if (mapInstance.getSource("regions")) return

            const features = regionsData.data.regions
                .filter((r) => !!r.geojson)
                .map((r) => ({
                    ...r.geojson,
                    properties: {
                        ...r.geojson.properties,
                        region: r.region,
                        center_lat: r.center_lat,
                        center_lng: r.center_lng,
                    },
                }))

            if (features.length === 0) return

            mapInstance.addSource("regions", {
                type: "geojson",
                data: { type: "FeatureCollection", features },
            })

            mapInstance.addLayer({
                id: "region-fill",
                type: "fill",
                source: "regions",
                paint: { "fill-color": "#6366f1", "fill-opacity": 0.08 },
                layout: { visibility: visibility.regions ? "visible" : "none" },
            })

            mapInstance.addLayer({
                id: "region-boundaries",
                type: "line",
                source: "regions",
                paint: { "line-color": "#e1b904", "line-width": 2.5, "line-opacity": 0.85 },
                layout: { visibility: visibility.regions ? "visible" : "none" },
            })

            mapInstance.on("click", "region-fill", (e) => {
                const features = mapInstance.queryRenderedFeatures(e.point, { layers: ["region-fill"] })
                if (features.length === 0) return
                const { region } = features[0].properties || {}
                new maplibregl.Popup({ closeButton: true, closeOnClick: true })
                    .setLngLat(e.lngLat)
                    .setHTML(`
                        <div style="padding:12px;min-width:160px;">
                            <h4 style="font-weight:700;font-size:14px;margin-bottom:4px;">${region || "Unknown Region"}</h4>
                            <div style="font-size:12px;color:#64748b;">Region Boundary</div>
                        </div>
                    `)
                    .addTo(mapInstance)
            })

            mapInstance.on("mouseenter", "region-fill", () => { mapInstance.getCanvas().style.cursor = "pointer" })
            mapInstance.on("mouseleave", "region-fill", () => { mapInstance.getCanvas().style.cursor = "" })
        } catch (error) {
            console.error("[Map] Error adding region boundaries:", error)
        }
    }, [mapLoaded, regionsData, visibility.regions])

    // Add 11kV feeders
    useEffect(() => {
        if (!map.current || !mapLoaded) {
            console.log("[Map] Map not ready for 11kV feeders")
            return
        }

        if (!feeders11kVData?.data || feeders11kVData.data.length === 0) {
            console.log("[Map] No 11kV feeder data available")
            return
        }

        const mapInstance = map.current

        try {
            // Remove existing layer/source if they exist
            if (mapInstance.getLayer("feeders-11kv-layer")) {
                mapInstance.removeLayer("feeders-11kv-layer")
            }
            if (mapInstance.getSource("feeders-11kv")) {
                mapInstance.removeSource("feeders-11kv")
            }

            console.log(`[Map] Adding ${feeders11kVData.data.length} 11kV feeders`)

            const features = feeders11kVData.data
                .filter(feeder => feeder.geometry && feeder.geometry.coordinates && feeder.geometry.coordinates.length > 0)
                .map((feeder) => ({
                    type: "Feature" as const,
                    geometry: feeder.geometry,
                    properties: {
                        circuit_id: feeder.circuit_id,
                        orientation: feeder.orientation,
                        phase_configuration: feeder.phase_configuration,
                        conductor_type: feeder.conductor_type,
                        voltage: "11kV",
                    },
                }))

            if (features.length === 0) {
                console.log("[Map] No valid 11kV feeder geometries")
                return
            }

            console.log(`[Map] Created ${features.length} valid 11kV features`)

            mapInstance.addSource("feeders-11kv", {
                type: "geojson",
                data: { type: "FeatureCollection", features },
            })

            mapInstance.addLayer({
                id: "feeders-11kv-layer",
                type: "line",
                source: "feeders-11kv",
                paint: {
                    "line-color": "#dc2626",
                    "line-width": 2.5,
                    "line-opacity": 0.9,
                    "line-dasharray": [2, 1] // Make them more visible as lines
                },
                layout: {
                    visibility: visibility.feeders11kV ? "visible" : "none",
                    "line-join": "round",
                    "line-cap": "round"
                },
            })

            console.log("[Map] 11kV feeders added successfully")

            mapInstance.on("click", "feeders-11kv-layer", (e) => {
                if (!e.features?.length) return
                const props = e.features[0].properties
                setSelectedGroup({
                    name: props?.circuit_id || "Unknown Circuit",
                    type: "11kV Feeder",
                    meters: [],
                    lat: e.lngLat.lat,
                    lon: e.lngLat.lng,
                    color: "#dc2626",
                    feederInfo: {
                        circuit_id: props?.circuit_id || "N/A",
                        orientation: props?.orientation || "N/A",
                        phase_configuration: props?.phase_configuration || "N/A",
                        conductor_type: props?.conductor_type || "N/A",
                        voltage: "11kV",
                    },
                })
            })

            mapInstance.on("mouseenter", "feeders-11kv-layer", () => {
                mapInstance.getCanvas().style.cursor = "pointer"
            })

            mapInstance.on("mouseleave", "feeders-11kv-layer", () => {
                mapInstance.getCanvas().style.cursor = ""
            })

        } catch (error) {
            console.error("[Map] Error adding 11kV feeders:", error)
        }
    }, [mapLoaded, feeders11kVData, visibility.feeders11kV])

    // Add 33kV feeders
    useEffect(() => {
        if (!map.current || !mapLoaded) {
            console.log("[Map] Map not ready for 33kV feeders")
            return
        }

        if (!feeders33kVData?.data || feeders33kVData.data.length === 0) {
            console.log("[Map] No 33kV feeder data available")
            return
        }

        const mapInstance = map.current

        try {
            // Remove existing layer/source if they exist
            if (mapInstance.getLayer("feeders-33kv-layer")) {
                mapInstance.removeLayer("feeders-33kv-layer")
            }
            if (mapInstance.getSource("feeders-33kv")) {
                mapInstance.removeSource("feeders-33kv")
            }

            console.log(`[Map] Adding ${feeders33kVData.data.length} 33kV feeders`)

            const features = feeders33kVData.data
                .filter(feeder => feeder.geometry && feeder.geometry.coordinates && feeder.geometry.coordinates.length > 0)
                .map((feeder) => ({
                    type: "Feature" as const,
                    geometry: feeder.geometry,
                    properties: {
                        circuit_id: feeder.circuit_id,
                        orientation: feeder.orientation,
                        phase_configuration: feeder.phase_configuration,
                        conductor_type: feeder.conductor_type,
                        voltage: "33kV",
                    },
                }))

            if (features.length === 0) {
                console.log("[Map] No valid 33kV feeder geometries")
                return
            }

            console.log(`[Map] Created ${features.length} valid 33kV features`)

            mapInstance.addSource("feeders-33kv", {
                type: "geojson",
                data: { type: "FeatureCollection", features },
            })

            mapInstance.addLayer({
                id: "feeders-33kv-layer",
                type: "line",
                source: "feeders-33kv",
                paint: {
                    "line-color": "#2563eb",
                    "line-width": 3,
                    "line-opacity": 0.9,
                    "line-dasharray": [3, 2] // Different dash pattern to distinguish from 11kV
                },
                layout: {
                    visibility: visibility.feeders33kV ? "visible" : "none",
                    "line-join": "round",
                    "line-cap": "round"
                },
            })

            console.log("[Map] 33kV feeders added successfully")

            mapInstance.on("click", "feeders-33kv-layer", (e) => {
                if (!e.features?.length) return
                const props = e.features[0].properties
                setSelectedGroup({
                    name: props?.circuit_id || "Unknown Circuit",
                    type: "33kV Feeder",
                    meters: [],
                    lat: e.lngLat.lat,
                    lon: e.lngLat.lng,
                    color: "#2563eb",
                    feederInfo: {
                        circuit_id: props?.circuit_id || "N/A",
                        orientation: props?.orientation || "N/A",
                        phase_configuration: props?.phase_configuration || "N/A",
                        conductor_type: props?.conductor_type || "N/A",
                        voltage: "33kV",
                    },
                })
            })

            mapInstance.on("mouseenter", "feeders-33kv-layer", () => {
                mapInstance.getCanvas().style.cursor = "pointer"
            })

            mapInstance.on("mouseleave", "feeders-33kv-layer", () => {
                mapInstance.getCanvas().style.cursor = ""
            })

        } catch (error) {
            console.error("[Map] Error adding 33kV feeders:", error)
        }
    }, [mapLoaded, feeders33kVData, visibility.feeders33kV])

    // Update layer visibility
    useEffect(() => {
        if (!map.current || !mapLoaded) return
        const m = map.current

        const setVis = (id: string, visible: boolean) => {
            if (m.getLayer(id)) {
                m.setLayoutProperty(id, "visibility", visible ? "visible" : "none")
            }
        }

        setVis("district-fill", visibility.districts)
        setVis("district-boundaries", visibility.districts)
        setVis("region-fill", visibility.regions)
        setVis("region-boundaries", visibility.regions)
        setVis("feeders-11kv-layer", visibility.feeders11kV)
        setVis("feeders-33kv-layer", visibility.feeders33kV)
    }, [visibility, mapLoaded])

    // Add markers
    useEffect(() => {
        if (!map.current || !mapLoaded) return

        markersRef.current.forEach((marker) => marker.remove())
        markersRef.current = []

        visibleMarkers.forEach((group) => {
            const el = document.createElement("div")
            el.style.cssText = "width:36px;height:36px;cursor:pointer;"

            const inner = document.createElement("div")
            inner.style.cssText = `
                width:100%;height:100%;
                background-color:${group.color};
                border:3px solid white;
                border-radius:50%;
                display:flex;align-items:center;justify-content:center;
                color:white;font-weight:bold;font-size:12px;
                box-shadow:0 2px 8px rgba(0,0,0,0.3);
                transition:transform 0.2s ease;
                transform-origin:center center;
            `

            if (group.type === "BSP Station" && group.meters.length > 1) {
                inner.textContent = group.meters.length.toString()
            }

            el.appendChild(inner)
            el.addEventListener("mouseenter", () => { inner.style.transform = "scale(1.15)"; inner.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)" })
            el.addEventListener("mouseleave", () => { inner.style.transform = "scale(1)"; inner.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)" })
            el.addEventListener("click", () => setSelectedGroup(group))

            const marker = new maplibregl.Marker({ element: el, anchor: "center" })
                .setLngLat([group.lon, group.lat])
                .addTo(map.current!)

            markersRef.current.push(marker)
        })
    }, [mapLoaded, visibleMarkers])

    const isLoading = isLoadingDistricts || isLoadingMeters || isLoading11kV || isLoading33kV

    const meterGroupItems = [
        { id: "bsp", key: "bsp" as const, color: "#3b82f6", label: "BSP Station", count: groupedMarkers.filter(m => m.type === "BSP Station").length },
        { id: "regional", key: "regionalBoundary" as const, color: "#10b981", label: "Regional Boundary Meter", count: groupedMarkers.filter(m => m.type === "Regional Boundary").length },
        { id: "district-b", key: "districtBoundary" as const, color: "#f97316", label: "District Boundary Meter", count: groupedMarkers.filter(m => m.type === "District Boundary").length },
        { id: "dtx", key: "dtx" as const, color: "#a855f7", label: "D. T. Meter", count: groupedMarkers.filter(m => m.type === "DTX").length },
    ]

    const feederItems = [
        { id: "feeders-11kv", key: "feeders11kV" as const, color: "#dc2626", label: "11kV Feeders", count: uniqueCircuit11kV },
        { id: "feeders-33kv", key: "feeders33kV" as const, color: "#2563eb", label: "33kV Feeders", count: uniqueCircuit33kV },
    ]

    return (
        <div className="space-y-2">
            {/* ── Controls Card ── */}
            <Card className="overflow-visible">
                {/* Header */}
                <div
                    className="flex items-center justify-between px-5 py-3 cursor-pointer select-none bg-muted/40 border-b"
                    onClick={() => setControlsCollapsed(c => !c)}
                >
                    <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        <span className="text-sm font-semibold tracking-tight">Map Controls</span>
                        {controlsCollapsed && (
                            <span className="text-xs text-muted-foreground ml-1">
                                · {BASEMAP_OPTIONS.find(o => o.key === basemap)?.label}
                            </span>
                        )}
                    </div>
                    <button
                        className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors text-muted-foreground"
                        onClick={e => { e.stopPropagation(); setControlsCollapsed(c => !c) }}
                        aria-label={controlsCollapsed ? "Expand controls" : "Collapse controls"}
                    >
                        <svg className={`h-4 w-4 transition-transform duration-200 ${controlsCollapsed ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                {!controlsCollapsed && (
                    <CardContent className="p-0">
                        <div className="flex items-stretch flex-wrap lg:flex-nowrap">
                            {/* Base Map */}
                            <div className="px-6 py-4 flex flex-col justify-center gap-2 shrink-0 border-r">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Base Map</span>
                                <div className="relative">
                                    <button
                                        onClick={() => setBasemapDropdownOpen(o => !o)}
                                        className="flex items-center gap-2 text-sm border rounded-md px-3 py-1.5 bg-background hover:bg-muted transition-colors"
                                    >
                                        <span className="font-medium">{BASEMAP_OPTIONS.find(o => o.key === basemap)?.label}</span>
                                        <svg className="h-3.5 w-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                    {basemapDropdownOpen && (
                                        <div
                                            className="absolute z-50 top-full mt-1 left-0 bg-background border rounded-md shadow-lg py-1 min-w-[160px]"
                                            onMouseLeave={() => setBasemapDropdownOpen(false)}
                                        >
                                            {BASEMAP_OPTIONS.map(opt => (
                                                <button
                                                    key={opt.key}
                                                    onClick={() => { setBasemap(opt.key); setBasemapDropdownOpen(false) }}
                                                    className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-muted transition-colors ${basemap === opt.key ? "font-semibold text-primary" : ""}`}
                                                >
                                                    <span className={`h-1.5 w-1.5 rounded-full ${basemap === opt.key ? "bg-primary" : "bg-transparent"}`} />
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Meter Groups */}
                            <div className="px-6 py-4 flex flex-col justify-center gap-2 flex-1 border-r">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Meter Groups</span>
                                <div className="flex flex-wrap items-center gap-4">
                                    {meterGroupItems.map(item => (
                                        <label key={item.id} className="flex items-center gap-2 cursor-pointer group whitespace-nowrap">
                                            <Checkbox
                                                id={item.id}
                                                checked={visibility[item.key]}
                                                onCheckedChange={(checked) => setVisibility(prev => ({ ...prev, [item.key]: !!checked }))}
                                            />
                                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                            <span className="text-sm">
                                                {item.label} <span className="text-xs text-muted-foreground">({item.count})</span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Boundaries */}
                            <div className="px-6 py-4 flex flex-col justify-center gap-2 shrink-0 border-r">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Boundaries</span>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <Checkbox
                                        id="show-regions"
                                        checked={visibility.regions}
                                        onCheckedChange={(checked) => setVisibility(prev => ({ ...prev, regions: !!checked }))}
                                    />
                                    <div className="w-3.5 h-3.5 rounded-sm border-2 shrink-0" style={{ borderColor: "#e1b904" }} />
                                    <span className="text-sm whitespace-nowrap">Region Boundaries</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <Checkbox
                                        id="show-districts"
                                        checked={visibility.districts}
                                        onCheckedChange={(checked) => setVisibility(prev => ({ ...prev, districts: !!checked }))}
                                    />
                                    <div className="w-3.5 h-3.5 rounded-sm border-2 shrink-0" style={{ borderColor: "#64748b" }} />
                                    <span className="text-sm whitespace-nowrap">District Boundaries</span>
                                </label>
                            </div>

                            {/* Feeders */}
                            <div className="px-6 py-4 flex flex-col justify-center gap-2 shrink-0">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Feeders</span>
                                <div className="flex flex-col gap-3">
                                    {feederItems.map(item => (
                                        <label key={item.id} className="flex items-center gap-2 cursor-pointer">
                                            <Checkbox
                                                id={item.id}
                                                checked={visibility[item.key]}
                                                onCheckedChange={(checked) => setVisibility(prev => ({ ...prev, [item.key]: !!checked }))}
                                            />
                                            <div className="w-8 h-0.5 shrink-0" style={{ backgroundColor: item.color }} />
                                            <span className="text-sm whitespace-nowrap">
                                                {item.label} <span className="text-xs text-muted-foreground ml-1">({item.count} circuits)</span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* ── Map + Side Panel ── */}
            <div className="flex gap-4 relative">
                {/* Search overlay */}
                <div className="absolute top-4 left-3 z-40 w-64">
                    <div className="relative">
                        <div className="flex items-center gap-2 bg-background border rounded-lg px-3 py-2 shadow-md">
                            <svg className="h-4 w-4 text-muted-foreground shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search meter number..."
                                value={searchQuery}
                                onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true) }}
                                onFocus={() => setSearchOpen(true)}
                                onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                                className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
                            />
                            {searchQuery && (
                                <button onClick={() => { setSearchQuery(""); setSearchOpen(false) }} className="text-muted-foreground hover:text-foreground">
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {searchOpen && searchResults.length > 0 && (
                            <div className="absolute top-full mt-1 left-0 w-full bg-background border rounded-lg shadow-lg overflow-hidden">
                                {searchResults.map((m: any) => (
                                    <button
                                        key={m.meter_number}
                                        onMouseDown={() => {
                                            if (!map.current) return
                                            map.current.flyTo({ center: [m.longitude, m.latitude], zoom: 14, speed: 1.4 })
                                            const match = groupedMarkers.find(g =>
                                                g.meters.some((gm: any) => gm.meter_number === m.meter_number)
                                            )
                                            if (match) setSelectedGroup(match)
                                            setSearchQuery(m.meter_number)
                                            setSearchOpen(false)
                                        }}
                                        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left hover:bg-muted border-b last:border-0 transition-colors"
                                    >
                                        <span className="h-2 w-2 rounded-full shrink-0" style={{
                                            backgroundColor:
                                                m.meter_type === "REGIONAL_BOUNDARY" ? "#10b981" :
                                                    m.meter_type === "DISTRICT_BOUNDARY" ? "#f97316" :
                                                        m.meter_type === "DTX" ? "#a855f7" : "#3b82f6"
                                        }} />
                                        <div className="min-w-0">
                                            <p className="font-medium truncate">{m.meter_number}</p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {m.meter_type?.replace(/_/g, " ")}{m.district ? ` · ${m.district}` : ""}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {searchOpen && searchQuery.trim().length > 0 && searchResults.length === 0 && (
                            <div className="absolute top-full mt-1 left-0 w-full bg-background border rounded-lg shadow-lg px-3 py-2 text-sm text-muted-foreground">
                                No meters found
                            </div>
                        )}
                    </div>
                </div>

                {/* Map */}
                <div className={`transition-all duration-300 ${selectedGroup ? "w-[60%]" : "w-full"} h-[calc(100vh-300px)] rounded-lg border overflow-hidden relative`}>
                    <div ref={mapContainer} className="w-full h-full" />

                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
                            <div className="text-center">
                                <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                <p className="text-muted-foreground">Loading map data...</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Side Panel */}
                {selectedGroup && (
                    <Card className="w-[38%] h-[calc(100vh-300px)] flex flex-col overflow-hidden">
                        <div className="flex-shrink-0 p-4 border-b flex items-start justify-between bg-muted/30">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span className={`text-sm px-2.5 py-0.5 rounded-full text-white font-semibold ${
                                        selectedGroup.type === "BSP Station" ? "bg-blue-500" :
                                            selectedGroup.type === "Regional Boundary" ? "bg-green-500" :
                                                selectedGroup.type === "District Boundary" ? "bg-orange-500" :
                                                    selectedGroup.type === "DTX" ? "bg-purple-500" :
                                                        selectedGroup.type === "11kV Feeder" ? "bg-red-600" :
                                                            selectedGroup.type === "33kV Feeder" ? "bg-blue-600" :
                                                                "bg-slate-500"
                                    }`}>
                                        {selectedGroup.type}
                                    </span>
                                    {!selectedGroup.feederInfo && (
                                        <span className="text-sm text-muted-foreground font-medium">
                                            {selectedGroup.meters.length} meter{selectedGroup.meters.length !== 1 ? "s" : ""}
                                        </span>
                                    )}
                                </div>
                                <h3 className="font-bold text-xl truncate">{selectedGroup.name}</h3>
                                {selectedGroup.region && (
                                    <p className="text-sm text-muted-foreground mt-0.5">Region: {selectedGroup.region}</p>
                                )}
                                {selectedGroup.district && (
                                    <p className="text-sm text-muted-foreground">District: {selectedGroup.district}</p>
                                )}
                            </div>
                            <button onClick={() => setSelectedGroup(null)} className="ml-2 p-1.5 hover:bg-muted rounded-md">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                            {selectedGroup.feederInfo ? (
                                <div className="p-4 border-2 rounded-lg">
                                    <h4 className="font-bold text-lg mb-4">Feeder Details</h4>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">Circuit ID</span>
                                            <div className="font-semibold text-base mt-1">{selectedGroup.feederInfo.circuit_id}</div>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Voltage</span>
                                            <div className="font-semibold text-base mt-1">{selectedGroup.feederInfo.voltage}</div>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Type</span>
                                            <div className="font-semibold mt-1">
                                                {selectedGroup.feederInfo.orientation === "OH" ? "Overhead" :
                                                    selectedGroup.feederInfo.orientation === "UG" ? "Underground" :
                                                        selectedGroup.feederInfo.orientation}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Phase Configuration</span>
                                            <div className="font-semibold mt-1">{selectedGroup.feederInfo.phase_configuration}</div>
                                        </div>
                                        <div className="col-span-2">
                                            <span className="text-muted-foreground">Conductor Type</span>
                                            <div className="font-semibold mt-1">{selectedGroup.feederInfo.conductor_type}</div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                selectedGroup.meters.map((meter) => (
                                    <div key={meter.meter_id} className="p-3 border-2 rounded-lg hover:border-primary/50 transition-all">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="font-bold text-base truncate flex-1">{meter.meter_id}</div>
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium ml-2 shrink-0">
                                                {meter.meter_type}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                            {meter.meter_number && (
                                                <div>
                                                    <span className="text-muted-foreground">Meter Number:</span>
                                                    <div className="font-semibold truncate">{meter.meter_number}</div>
                                                </div>
                                            )}
                                            {meter.meter_brand && (
                                                <div>
                                                    <span className="text-muted-foreground">Meter Brand:</span>
                                                    <div className="font-semibold truncate">{meter.meter_brand}</div>
                                                </div>
                                            )}
                                            {meter.station && (
                                                <div>
                                                    <span className="text-muted-foreground">Station:</span>
                                                    <div className="font-semibold truncate">{meter.station}</div>
                                                </div>
                                            )}
                                            {meter.region && (
                                                <div>
                                                    <span className="text-muted-foreground">Region:</span>
                                                    <div className="font-semibold truncate">{meter.region}</div>
                                                </div>
                                            )}
                                            {meter.district && (
                                                <div>
                                                    <span className="text-muted-foreground">District:</span>
                                                    <div className="font-semibold truncate">{meter.district}</div>
                                                </div>
                                            )}
                                            {meter.location && (
                                                <div className="col-span-2">
                                                    <span className="text-muted-foreground">Location:</span>
                                                    <div className="font-semibold truncate">{meter.location}</div>
                                                </div>
                                            )}
                                            {meter.feeder_panel_name && (
                                                <div className="col-span-2">
                                                    <span className="text-muted-foreground">Feeder:</span>
                                                    <div className="font-semibold truncate">{meter.feeder_panel_name}</div>
                                                </div>
                                            )}
                                            {meter.boundary_metering_point && (
                                                <div className="col-span-2">
                                                    <span className="text-muted-foreground">Boundary:</span>
                                                    <div className="font-semibold truncate">{meter.boundary_metering_point}</div>
                                                </div>
                                            )}
                                        </div>
                                        <Link
                                            href={`/meters/${meter.meter_number}`}
                                            className="block w-full text-center px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                                        >
                                            View Details
                                        </Link>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}