"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

interface RegionMiniMapProps {
  regionName: string
  districtGeometries: Array<{
    district: string
    geometry: any
    consumption?: number
  }>
  meterCoordinates?: Array<{
    lat: number
    lng: number
    type: string
    meter_number: string
    brand?: string
    station?: string
    boundary_metering_point?: string
  }>
}

const GOOGLE_TILES = [
  "https://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
  "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
  "https://mt2.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
  "https://mt3.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
]

// Flatten Polygon or MultiPolygon coordinates into a flat list of [lng, lat] pairs
function flattenCoords(geometry: any): number[][] {
  if (!geometry) return []
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.flatMap((poly: number[][][]) =>
        poly.flatMap((ring: number[][]) => ring)
    )
  }
  if (geometry.type === "Polygon") {
    return geometry.coordinates[0] as number[][]
  }
  return []
}

export function RegionMiniMap({
                                regionName,
                                districtGeometries = [],
                                meterCoordinates = [],
                              }: RegionMiniMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const [hoveredDistrict, setHoveredDistrict] = useState<{ name: string; consumption?: number } | null>(null)

  useEffect(() => {
    if (!mapContainer.current || districtGeometries.length === 0) return
    if (map.current) return

    // Calculate initial bounds from all district geometries (handles Polygon + MultiPolygon)
    const bounds = new maplibregl.LngLatBounds()
    districtGeometries.forEach((district) => {
      flattenCoords(district.geometry).forEach((coord) => {
        bounds.extend(coord as [number, number])
      })
    })
    const center = bounds.getCenter()

    // Initialise with blank style — Google Maps raster tiles added on load
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: { version: 8, sources: {}, layers: [] },
      center: [center.lng, center.lat],
      zoom: 10,
      attributionControl: false,
    })

    map.current.addControl(new maplibregl.NavigationControl(), "top-right")

    map.current.on("load", () => {
      if (!map.current) return

      // Add Google Maps basemap tiles at the bottom
      map.current.addSource("google-basemap", {
        type: "raster",
        tiles: GOOGLE_TILES,
        tileSize: 256,
        attribution: "&copy; Google Maps",
      })
      map.current.addLayer({
        id: "google-basemap-layer",
        type: "raster",
        source: "google-basemap",
        minzoom: 0,
        maxzoom: 22,
      })

      // Add district fill + border layers
      const maxConsumption = Math.max(...districtGeometries.map((d) => d.consumption || 0))

      districtGeometries.forEach((district, index) => {
        if (!district.geometry) return
        const geoType = district.geometry.type
        if (geoType !== "Polygon" && geoType !== "MultiPolygon") return

        map.current!.addSource(`district-${index}`, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: { name: district.district, consumption: district.consumption || 0 },
            geometry: district.geometry,
          },
        })

        const normalizedConsumption =
            district.consumption && maxConsumption > 0
                ? district.consumption / maxConsumption
                : 0.3

        map.current!.addLayer({
          id: `district-fill-${index}`,
          type: "fill",
          source: `district-${index}`,
          paint: {
            "fill-color": "#3b82f6",
            "fill-opacity": normalizedConsumption * 0.5 + 0.1,
          },
        })

        map.current!.addLayer({
          id: `district-border-${index}`,
          type: "line",
          source: `district-${index}`,
          paint: {
            "line-color": "#1d4ed8",
            "line-width": 1.5,
          },
        })

        map.current!.on("mouseenter", `district-fill-${index}`, () => {
          if (map.current) map.current.getCanvas().style.cursor = "pointer"
          setHoveredDistrict({ name: district.district, consumption: district.consumption })
        })
        map.current!.on("mouseleave", `district-fill-${index}`, () => {
          if (map.current) map.current.getCanvas().style.cursor = ""
          setHoveredDistrict(null)
        })
      })

      // Filter valid meter coordinates
      const validMeters = meterCoordinates.filter(
          (m) =>
              typeof m.lat === "number" &&
              typeof m.lng === "number" &&
              !isNaN(m.lat) &&
              !isNaN(m.lng) &&
              m.lat !== 0 &&
              m.lng !== 0
      )

      if (validMeters.length > 0) {
        // Group BSP meters by station
        const bspGroups: Record<string, typeof validMeters> = {}
        const individualMeters: typeof validMeters = []

        validMeters.forEach((meter) => {
          if (meter.type === "BSP" && meter.station) {
            const key = `bsp-${meter.station}`
            if (!bspGroups[key]) bspGroups[key] = []
            bspGroups[key].push(meter)
          } else {
            individualMeters.push(meter)
          }
        })

        // BSP station grouped markers
        Object.values(bspGroups).forEach((meters) => {
          if (!map.current || meters.length === 0) return
          const first = meters[0]
          const el = document.createElement("div")
          el.style.cssText = "width: 36px; height: 36px; cursor: pointer;"
          const inner = document.createElement("div")
          inner.style.cssText = `
                        width: 100%; height: 100%;
                        background-color: #3b82f6;
                        border: 3px solid white;
                        border-radius: 50%;
                        display: flex; align-items: center; justify-content: center;
                        color: white; font-weight: bold; font-size: 12px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                        transition: transform 0.2s ease;
                    `
          inner.textContent = meters.length.toString()
          el.appendChild(inner)

          el.addEventListener("mouseenter", () => { inner.style.transform = "scale(1.15)" })
          el.addEventListener("mouseleave", () => { inner.style.transform = "scale(1)" })

          const marker = new maplibregl.Marker({ element: el, anchor: "center" })
              .setLngLat([first.lng, first.lat])
              .addTo(map.current!)

          el.addEventListener("click", (e) => {
            e.stopPropagation()
            if (!map.current) return
            popupRef.current?.remove()
            popupRef.current = new maplibregl.Popup({ offset: 15, closeButton: true, closeOnClick: true })
                .setLngLat([first.lng, first.lat])
                .setHTML(
                    `<div style="padding: 8px; max-width: 200px;">
                                    <strong style="font-size: 13px;">${first.station}</strong><br/>
                                    <span style="font-size: 11px; color: #666;">BSP Station &bull; ${meters.length} meters</span><br/>
                                    <div style="margin-top: 6px; font-size: 11px; max-height: 150px; overflow-y: auto;">
                                        ${meters.map((m) => m.meter_number).join("<br/>")}
                                    </div>
                                </div>`
                )
                .addTo(map.current)
          })

          markersRef.current.push(marker)
        })

        // Individual meter markers
        individualMeters.forEach((meter) => {
          if (!map.current) return
          const el = document.createElement("div")
          el.style.cssText = "width: 12px; height: 12px; cursor: pointer;"
          const inner = document.createElement("div")
          let color = "#64748b"
          if (meter.type === "DTX") color = "#a855f7"
          else if (meter.type === "REGIONAL_BOUNDARY") color = "#10b981"
          else if (meter.type === "DISTRICT_BOUNDARY") color = "#f97316"
          else if (meter.type === "BSP") color = "#3b82f6"
          inner.style.cssText = `
                        width: 100%; height: 100%;
                        background-color: ${color};
                        border: 2px solid white;
                        border-radius: 50%;
                        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
                        transition: transform 0.2s ease;
                    `
          el.appendChild(inner)
          el.addEventListener("mouseenter", () => { inner.style.transform = "scale(1.3)" })
          el.addEventListener("mouseleave", () => { inner.style.transform = "scale(1)" })

          const marker = new maplibregl.Marker({ element: el, anchor: "center" })
              .setLngLat([meter.lng, meter.lat])
              .addTo(map.current!)

          el.addEventListener("click", (e) => {
            e.stopPropagation()
            if (!map.current) return
            popupRef.current?.remove()
            popupRef.current = new maplibregl.Popup({ offset: 10, closeButton: true, closeOnClick: true })
                .setLngLat([meter.lng, meter.lat])
                .setHTML(
                    `<div style="padding: 6px;">
                                    <strong style="font-size: 11px;">${meter.meter_number}</strong><br/>
                                    <span style="font-size: 10px; color: #666;">Type: ${meter.type}</span><br/>
                                    ${meter.brand ? `<span style="font-size: 10px; color: #666;">Brand: ${meter.brand}</span><br/>` : ""}
                                    ${meter.station ? `<span style="font-size: 10px; color: #666;">Station: ${meter.station}</span><br/>` : ""}
                                    ${meter.boundary_metering_point ? `<span style="font-size: 10px; color: #666;">Boundary: ${meter.boundary_metering_point}</span>` : ""}
                                </div>`
                )
                .addTo(map.current)
          })

          markersRef.current.push(marker)
        })

        // Fit bounds to include all districts and meters
        const fitBounds = new maplibregl.LngLatBounds()
        districtGeometries.forEach((d) => {
          flattenCoords(d.geometry).forEach((c) => fitBounds.extend(c as [number, number]))
        })
        validMeters.forEach((m) => fitBounds.extend([m.lng, m.lat]))
        map.current.fitBounds(fitBounds, { padding: 50 })
      } else {
        map.current.fitBounds(bounds, { padding: 40 })
      }

      setTimeout(() => map.current?.resize(), 100)
    })

    return () => {
      popupRef.current?.remove()
      popupRef.current = null
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      map.current?.remove()
      map.current = null
    }
  }, [districtGeometries, regionName, meterCoordinates])

  const bspCount = meterCoordinates.filter((m) => m.type === "BSP").length
  const dtxCount = meterCoordinates.filter((m) => m.type === "DTX").length
  const boundaryCount = meterCoordinates.filter(
      (m) => m.type === "REGIONAL_BOUNDARY" || m.type === "DISTRICT_BOUNDARY"
  ).length

  return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2 flex-shrink-0">
          <CardTitle className="text-base">Region Map</CardTitle>
          <CardDescription className="text-xs">District boundaries visualization</CardDescription>
        </CardHeader>
        <CardContent className="p-0 flex-1 flex flex-col">
          {districtGeometries.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                No district boundaries available
              </div>
          ) : (
              <>
                <div ref={mapContainer} className="flex-1 w-full min-h-[450px] relative">
                  {hoveredDistrict && (
                      <div className="absolute top-3 left-3 bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-3 z-10 min-w-[200px]">
                        <div className="font-semibold text-sm">{hoveredDistrict.name}</div>
                        {hoveredDistrict.consumption !== undefined && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Consumption: {hoveredDistrict.consumption.toLocaleString()} kWh
                            </div>
                        )}
                      </div>
                  )}
                </div>
                <div className="flex-shrink-0 p-3 mx-3 mb-3 flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded">
                  <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium">{regionName}</p>
                    <p>{districtGeometries.length} districts</p>
                    {meterCoordinates.length > 0 && (
                        <p className="mt-1">
                          {bspCount > 0 && (
                              <>
                                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 border border-white mr-1" />
                                {bspCount} BSP
                              </>
                          )}
                          {dtxCount > 0 && (
                              <>
                                {bspCount > 0 && " \u00b7 "}
                                <span className="inline-block w-2 h-2 rounded-full bg-purple-500 border border-white mr-1" />
                                {dtxCount} DTX
                              </>
                          )}
                          {boundaryCount > 0 && (
                              <>
                                {(bspCount > 0 || dtxCount > 0) && " \u00b7 "}
                                <span className="inline-block w-2 h-2 rounded-full bg-green-500 border border-white mr-1" />
                                {boundaryCount} boundary
                              </>
                          )}
                        </p>
                    )}
                  </div>
                </div>
              </>
          )}
        </CardContent>
      </Card>
  )
}
