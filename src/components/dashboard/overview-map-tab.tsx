"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { useMeters } from "@/hooks/api/use-meter-api"
import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
import { formatNumber } from "@/lib/utils/date-helpers"
import { useConsumptionMetersRanking } from "@/hooks/api/use-consumption-api"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDashboardStore } from "@/lib/stores/dashboard-store"
import { useServiceAreas } from "@/hooks/api/use-service-areas-api"

interface OverviewMapTabProps {
  dateRange: { start_date: string; end_date: string }
  regions?: string[]
  districts?: string[]
  stations?: string[]
  meterTypes?: string[]
  voltages?: number[]
  location?: string
}

const METER_TYPE_COLORS: Record<string, string> = {
  BSP: "#3b82f6", // Blue
  // PSS: "#22c55e", // Green
  // SS: "#f59e0b", // Amber
  DTX: "#ef4444", // Red
  REGIONAL_BOUNDARY: "#f97316", // Orange
  DISTRICT_BOUNDARY: "#a855f7", // Purple
}

const BASEMAPS = {
  osm: {
    name: "OpenStreetMap",
    style: {
      version: 8,
      sources: {
        basemap: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        },
      },
      layers: [
        {
          id: "basemap",
          type: "raster",
          source: "basemap",
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
  "carto-voyager": {
    name: "Carto Voyager",
    style: {
      version: 8,
      sources: {
        basemap: {
          type: "raster",
          tiles: [
            "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
            "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
            "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
        },
      },
      layers: [
        {
          id: "basemap",
          type: "raster",
          source: "basemap",
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
  "carto-positron": {
    name: "Carto Positron",
    style: {
      version: 8,
      sources: {
        basemap: {
          type: "raster",
          tiles: [
            "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
            "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
            "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          attribution: "&copy; CARTO",
        },
      },
      layers: [
        {
          id: "basemap",
          type: "raster",
          source: "basemap",
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
  "esri-topo": {
    name: "ESRI Topo",
    style: {
      version: 8,
      sources: {
        basemap: {
          type: "raster",
          tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"],
          tileSize: 256,
          attribution: "Tiles &copy; Esri",
        },
      },
      layers: [
        {
          id: "basemap",
          type: "raster",
          source: "basemap",
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
  "google-streets": {
    name: "Google Streets",
    style: {
      version: 8,
      sources: {
        basemap: {
          type: "raster",
          tiles: ["https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"],
          tileSize: 256,
          attribution: "&copy; Google",
        },
      },
      layers: [
        {
          id: "basemap",
          type: "raster",
          source: "basemap",
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
} as const

declare global {
  interface Window {
    maplibregl: any
  }
}

export function OverviewMapTab({
  dateRange,
  regions,
  districts,
  stations,
  meterTypes,
  voltages,
  location,
}: OverviewMapTabProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [mapLibLoaded, setMapLibLoaded] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const initialBoundsSet = useRef(false)
  const [showServiceAreas, setShowServiceAreas] = useState(true)
  const [visibleMeterTypes, setVisibleMeterTypes] = useState<Set<string>>(new Set(Object.keys(METER_TYPE_COLORS)))
  const selectedBasemap = useDashboardStore((state) => state.selectedBasemap)
  const mapCenter = useDashboardStore((state) => state.mapCenter)
  const mapZoom = useDashboardStore((state) => state.mapZoom)
  const setSelectedBasemap = useDashboardStore((state) => state.setSelectedBasemap)
  const setMapCenter = useDashboardStore((state) => state.setMapCenter)
  const setMapZoom = useDashboardStore((state) => state.setMapZoom)

  const moveEndTimerRef = useRef<NodeJS.Timeout>()

  const params = {
    region: regions && regions.length > 0 ? regions[0] : undefined,
    district: districts && districts.length > 0 ? districts[0] : undefined,
    meter_type: meterTypes && meterTypes.length > 0 ? (meterTypes[0] as any) : undefined,
    location: location && location !== "all-locations" && location !== "" ? location : undefined,
  }

  const { data: metersData, isLoading } = useMeters({
    ...params,
    limit: 10000,
  })

  const { data: consumptionData } = useConsumptionMetersRanking({
    ...dateRange,
    ...params,
    sort_by: "total_import_kwh",
    sort_dir: "desc",
  })

  const { data: serviceAreasData, isLoading: serviceAreasLoading } = useServiceAreas()

  const consumptionMap = useMemo(() => {
    return new Map(
      consumptionData?.data?.map((meter) => [
        meter.meter_number,
        {
          import_kwh: meter.total_import_kwh || 0,
          export_kwh: meter.total_export_kwh || 0,
        },
      ]) || [],
    )
  }, [consumptionData])

  const bspStations = useMemo(() => {
    const map = new Map<
      string,
      {
        station: string
        meters: typeof metersData.data.data
        latSum: number
        lngSum: number
      }
    >()

    if (!metersData?.data?.data) return map

    metersData.data.data.forEach((meter) => {
      if (meter.meter_type !== "BSP") return
      if (!meter.station) return
      if (!meter.latitude || !meter.longitude) return

      const lat = Number(meter.latitude)
      const lng = Number(meter.longitude)
      if (isNaN(lat) || isNaN(lng)) return

      if (!map.has(meter.station)) {
        map.set(meter.station, {
          station: meter.station,
          meters: [],
          latSum: 0,
          lngSum: 0,
        })
      }

      const entry = map.get(meter.station)!
      entry.meters.push(meter)
      entry.latSum += lat
      entry.lngSum += lng
    })

    return map
  }, [metersData])

  useEffect(() => {
    if (window.maplibregl) {
      setMapLibLoaded(true)
      return
    }

    const existingCss = document.querySelector('link[href*="maplibre-gl.css"]')
    if (!existingCss) {
      const link = document.createElement("link")
      link.rel = "stylesheet"
      link.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css"
      document.head.appendChild(link)
    }

    const existingScript = document.querySelector('script[src*="maplibre-gl.js"]')
    if (existingScript) {
      const checkInterval = setInterval(() => {
        if (window.maplibregl) {
          clearInterval(checkInterval)
          setMapLibLoaded(true)
        }
      }, 100)

      setTimeout(() => clearInterval(checkInterval), 10000)
      return
    }

    const script = document.createElement("script")
    script.src = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"
    script.async = true

    script.onload = () => {
      if (window.maplibregl) {
        setMapLibLoaded(true)
      }
    }

    script.onerror = (error) => {
      console.error("[v0] Failed to load MapLibre GL:", error)
    }

    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!mapContainer.current || map.current || !mapLibLoaded || !window.maplibregl) return

    const maplibregl = window.maplibregl

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: BASEMAPS[selectedBasemap as keyof typeof BASEMAPS].style,
      center: mapCenter || [-1.0232, 7.9465],
      zoom: mapZoom || 6.5,
    })

    map.current.addControl(new maplibregl.NavigationControl(), "top-right")

    map.current.on("load", () => {
      setMapReady(true)
    })

    map.current.on("moveend", () => {
      if (map.current) {
        if (moveEndTimerRef.current) {
          clearTimeout(moveEndTimerRef.current)
        }
        moveEndTimerRef.current = setTimeout(() => {
          const center = map.current!.getCenter()
          const zoom = map.current!.getZoom()
          setMapCenter([center.lng, center.lat])
          setMapZoom(zoom)
        }, 300)
      }
    })

    return () => {
      if (moveEndTimerRef.current) {
        clearTimeout(moveEndTimerRef.current)
      }
      if (map.current) {
        map.current.remove()
        map.current = null
        setMapReady(false)
      }
    }
  }, [mapLibLoaded, selectedBasemap])

  useEffect(() => {
    if (!map.current || !window.maplibregl || !mapReady) return

    const newStyle = BASEMAPS[selectedBasemap as keyof typeof BASEMAPS].style
    map.current.setStyle(newStyle)
  }, [selectedBasemap, mapReady])

  useEffect(() => {
    if (!mapReady || !metersData?.data?.data || isLoading) {
      return
    }

    const maplibregl = window.maplibregl

    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    const popup = new maplibregl.Popup({
      offset: 15,
      closeButton: true,
      closeOnClick: false,
    })

    const bounds = new maplibregl.LngLatBounds()
    let validCount = 0

    const filteredMeters = metersData.data.data.filter((meter) => {
      if (regions && regions.length > 0 && meter.region) {
        if (!regions.includes(meter.region)) return false
      }

      if (districts && districts.length > 0 && meter.location) {
        if (!districts.includes(meter.location)) return false
      }

      if (stations && stations.length > 0 && meter.station) {
        if (!stations.includes(meter.station)) return false
      }

      if (meterTypes && meterTypes.length > 0) {
        if (!meterTypes.includes(meter.meter_type)) return false
      }

      if (voltages && voltages.length > 0 && meter.voltage_kv) {
        const meterVoltage = Number.parseFloat(String(meter.voltage_kv))
        if (!voltages.includes(meterVoltage)) return false
      }

      if (!visibleMeterTypes.has(meter.meter_type)) return false

      return true
    })

    filteredMeters.forEach((meter) => {
      if (!meter.latitude || !meter.longitude) return

      if (meter.meter_type === "BSP") return

      const lat = Number.parseFloat(String(meter.latitude))
      const lng = Number.parseFloat(String(meter.longitude))

      if (isNaN(lat) || isNaN(lng)) return

      const consumption = consumptionMap.get(meter.meter_number)
      const color = METER_TYPE_COLORS[meter.meter_type] || "#6b7280"

      const el = document.createElement("div")
      el.className = "meter-marker"
      el.style.backgroundColor = color
      el.style.width = "12px"
      el.style.height = "12px"
      el.style.borderRadius = "50%"
      el.style.border = "2px solid white"
      el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)"
      el.style.cursor = "pointer"

      const getPopupContent = () => `
        <div style="padding: 8px; min-width: 200px;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px;">
            <a href="/meters/${meter.id}" style="color: #3b82f6; text-decoration: none;">
              ${meter.meter_number}
            </a>
          </div>
          <div style="display: grid; gap: 4px; font-size: 12px;">
            <div><span style="color: #6b7280;">Type:</span> <span style="font-weight: 500;">${meter.meter_type}</span></div>
            <div><span style="color: #6b7280;">Location:</span> <span style="font-weight: 500;">${meter.location || "—"}</span></div>
            ${meter.station ? `<div><span style="color: #6b7280;">Station:</span> <span style="font-weight: 500;">${meter.station}</span></div>` : ""}
            ${meter.voltage_kv ? `<div><span style="color: #6b7280;">Voltage:</span> <span style="font-weight: 500;">${meter.voltage_kv} kV</span></div>` : ""}
            <div><span style="color: #6b7280;">Status:</span> <span style="font-weight: 500;">${meter.status}</span></div>
            ${
              consumption
                ? `
              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
                <div><span style="color: #22c55e;">Import:</span> <span style="font-weight: 600;">${formatNumber(consumption.import_kwh)} kWh</span></div>
                <div><span style="color: #3b82f6;">Export:</span> <span style="font-weight: 600;">${formatNumber(consumption.export_kwh)} kWh</span></div>
              </div>
            `
                : ""
            }
          </div>
        </div>
      `

      const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map.current!)

      const popupHtml = getPopupContent() // call your function here

      el.addEventListener("click", (e) => {
        e.stopPropagation() // ⬅️ STOP click reaching map layers
        popup.remove() // ⬅️ CLOSE any existing popup
        popup.setLngLat([lng, lat]).setHTML(popupHtml).addTo(map.current!)
      })

      markersRef.current.push(marker)
      bounds.extend([lng, lat])
      validCount++
    })

    bspStations.forEach((stationData) => {
      if (!visibleMeterTypes.has("BSP")) return

      const count = stationData.meters.length
      if (count === 0) return

      const lat = stationData.latSum / count
      const lng = stationData.lngSum / count

      const el = document.createElement("div")
      el.style.width = "22px"
      el.style.height = "22px"
      el.style.borderRadius = "50%"
      el.style.backgroundColor = METER_TYPE_COLORS.BSP
      el.style.border = "3px solid white"
      el.style.boxShadow = "0 3px 6px rgba(0,0,0,0.35)"
      el.style.cursor = "pointer"
      el.style.display = "flex"
      el.style.alignItems = "center"
      el.style.justifyContent = "center"
      el.style.color = "white"
      el.style.fontSize = "10px"
      el.style.fontWeight = "700"
      el.innerText = String(count)

      const popupHtml = `
      <div style="padding: 8px; max-height: 250px; overflow-y: auto;">
        <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px;">
          ${stationData.station}
        </div>
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 6px;">
          BSP meters: ${count}
        </div>
        <ul style="font-size: 12px; padding-left: 16px;">
          ${stationData.meters
            .map(
              (m) =>
                `<li>
                         <a href="/meters/${m.id}" style="color:#3b82f6;text-decoration:none">
                           ${m.meter_number}
                         </a>
                       </li>`,
            )
            .join("")}
        </ul>
      </div>
    `

      const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map.current!)

      el.addEventListener("click", (e) => {
        e.stopPropagation() // prevent map / service area click
        popup.remove() // close any existing popup
        popup.setLngLat([lng, lat]).setHTML(popupHtml).addTo(map.current!)
      })

      markersRef.current.push(marker)
      bounds.extend([lng, lat])
    })

    if (validCount > 0 && map.current && !initialBoundsSet.current) {
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 12,
      })
      initialBoundsSet.current = true
    }
  }, [
    mapReady,
    metersData,
    consumptionMap,
    isLoading,
    regions,
    districts,
    stations,
    meterTypes,
    voltages,
    visibleMeterTypes,
  ])

  useEffect(() => {
    if (!mapReady || !serviceAreasData) {
      return
    }

    const maplibregl = window.maplibregl
    if (!maplibregl || !map.current) return

    console.log("[v0] Adding service areas to map:", serviceAreasData.features.length)

    if (map.current.getLayer("service-areas-fill")) {
      map.current.removeLayer("service-areas-fill")
    }
    if (map.current.getLayer("service-areas-outline")) {
      map.current.removeLayer("service-areas-outline")
    }
    if (map.current.getSource("service-areas")) {
      map.current.removeSource("service-areas")
    }

    map.current.addSource("service-areas", {
      type: "geojson",
      data: serviceAreasData,
    })

    map.current.addLayer({
      id: "service-areas-fill",
      type: "fill",
      source: "service-areas",
      paint: {
        "fill-color": "#3b82f6",
        "fill-opacity": 0.1,
      },
    })

    map.current.addLayer({
      id: "service-areas-outline",
      type: "line",
      source: "service-areas",
      paint: {
        "line-color": "#3b82f6",
        "line-width": 2,
        "line-opacity": 0.6,
      },
    })

    map.current.on("click", "service-areas-fill", (e: any) => {
      const popup = new maplibregl.Popup({
        closeOnClick: false,
        closeButton: true,
      })

      if (!e.features || e.features.length === 0) return

      const feature = e.features[0]
      const { region, district, id } = feature.properties

      const popupContent = `
        <div style="padding: 8px; min-width: 150px;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px;">Service Area</div>
          <div style="display: grid; gap: 4px; font-size: 12px;">
            <div><span style="color: #6b7280;">Region:</span> <span style="font-weight: 500;">${region}</span></div>
            <div><span style="color: #6b7280;">District:</span> <span style="font-weight: 500;">${district}</span></div>
            <div><span style="color: #6b7280;">ID:</span> <span style="font-weight: 500;">${id}</span></div>
          </div>
        </div>
    `

      popup.setLngLat(e.lngLat).setHTML(popupContent).addTo(map.current!)
    })

    map.current.on("mouseenter", "service-areas-fill", () => {
      map.current!.getCanvas().style.cursor = "pointer"
    })

    map.current.on("mouseleave", "service-areas-fill", () => {
      map.current!.getCanvas().style.cursor = ""
    })

    console.log("[v0] Service areas added successfully")

    return () => {
      if (map.current) {
        map.current.off("click", "service-areas-fill")
        map.current.off("mouseenter", "service-areas-fill")
        map.current.off("mouseleave", "service-areas-fill")
      }
    }
  }, [mapReady, serviceAreasData])

  useEffect(() => {
    if (!mapReady || !map.current) return

    const visibility = showServiceAreas ? "visible" : "none"

    if (map.current.getLayer("service-areas-fill")) {
      map.current.setLayoutProperty("service-areas-fill", "visibility", visibility)
    }
    if (map.current.getLayer("service-areas-outline")) {
      map.current.setLayoutProperty("service-areas-outline", "visibility", visibility)
    }

    console.log("[v0] Service areas visibility:", visibility)
  }, [mapReady, showServiceAreas])

  const toggleMeterType = (type: string) => {
    setVisibleMeterTypes((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(type)) {
        newSet.delete(type)
      } else {
        newSet.add(type)
      }
      return newSet
    })
  }

  if (isLoading || serviceAreasLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-[600px]">
          <div className="text-center space-y-2">
            <Skeleton className="h-8 w-48 mx-auto" />
            <p className="text-sm text-muted-foreground">Loading meter and service area data...</p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex flex-wrap items-start gap-6">
            <div className="flex-1 min-w-[300px]">
              <span className="text-sm font-medium text-muted-foreground mb-2 block">Filter by Meter Type:</span>
              <div className="flex flex-wrap gap-4">
                {Object.entries(METER_TYPE_COLORS).map(([type, color]) => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleMeterTypes.has(type)}
                      onChange={() => toggleMeterType(type)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <div
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        backgroundColor: color,
                        border: "2px solid white",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                        opacity: visibleMeterTypes.has(type) ? 1 : 0.3,
                      }}
                    />
                    <span className={`text-sm ${visibleMeterTypes.has(type) ? "" : "text-muted-foreground"}`}>
                      {type}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showServiceAreas}
                  onChange={(e) => setShowServiceAreas(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm font-medium">Show Service Areas</span>
              </label>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Basemap:</span>
                <Select value={selectedBasemap} onValueChange={setSelectedBasemap}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(BASEMAPS).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div ref={mapContainer} className="h-[600px] w-full" />
      </Card>

      {metersData?.data?.data && (
        <div className="text-sm text-muted-foreground text-center">
          Showing {markersRef.current.length} of {metersData.data.data.length} meters with valid coordinates
          {showServiceAreas && serviceAreasData && ` • ${serviceAreasData.features.length} service areas`}
          {(stations && stations.length > 0) ||
          (voltages && voltages.length > 0) ||
          (meterTypes && meterTypes.length > 0) ||
          (regions && regions.length > 0) ||
          (districts && districts.length > 0)
            ? " (filtered)"
            : ""}
        </div>
      )}
    </div>
  )
}
