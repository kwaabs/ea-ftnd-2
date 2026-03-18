"use client"

import { useEffect, useRef } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { useMapStore } from "@/stores/map-store"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ZoomIn, ZoomOut, Maximize2, Locate } from "lucide-react"

export function MapComponent() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const { center, zoom, markers, selectedMarkerId, setCenter, setZoom, selectMarker } = useMapStore()
  const markersRef = useRef<{ [key: string]: maplibregl.Marker }>({})
  const isUpdatingFromMap = useRef(false)

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          "osm-tiles": {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        },
        layers: [
          {
            id: "osm-tiles",
            type: "raster",
            source: "osm-tiles",
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: center,
      zoom: zoom,
    })

    map.current.addControl(new maplibregl.NavigationControl(), "top-right")

    map.current.on("moveend", () => {
      if (map.current) {
        isUpdatingFromMap.current = true
        const newCenter = map.current.getCenter()
        setCenter([newCenter.lng, newCenter.lat])
        setTimeout(() => {
          isUpdatingFromMap.current = false
        }, 0)
      }
    })

    map.current.on("zoomend", () => {
      if (map.current) {
        isUpdatingFromMap.current = true
        setZoom(map.current.getZoom())
        setTimeout(() => {
          isUpdatingFromMap.current = false
        }, 0)
      }
    })

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  // Update markers
  useEffect(() => {
    if (!map.current) return

    // Remove old markers
    Object.keys(markersRef.current).forEach((id) => {
      if (!markers.find((m) => m.id === id)) {
        markersRef.current[id].remove()
        delete markersRef.current[id]
      }
    })

    // Add new markers
    markers.forEach((marker) => {
      if (!markersRef.current[marker.id]) {
        const el = document.createElement("div")
        el.className = "custom-marker"
        el.style.width = "24px"
        el.style.height = "24px"
        el.style.borderRadius = "50%"
        el.style.backgroundColor = selectedMarkerId === marker.id ? "#6366f1" : "#3b82f6"
        el.style.border = "2px solid white"
        el.style.cursor = "pointer"
        el.style.transition = "all 0.2s"

        el.addEventListener("mouseenter", () => {
          el.style.transform = "scale(1.2)"
        })

        el.addEventListener("mouseleave", () => {
          el.style.transform = "scale(1)"
        })

        const mapMarker = new maplibregl.Marker({ element: el }).setLngLat(marker.coordinates).addTo(map.current!)

        mapMarker.getElement().addEventListener("click", () => {
          selectMarker(marker.id)
        })

        markersRef.current[marker.id] = mapMarker
      } else {
        // Update marker appearance if selected
        const el = markersRef.current[marker.id].getElement()
        el.style.backgroundColor = selectedMarkerId === marker.id ? "#6366f1" : "#3b82f6"
      }
    })
  }, [markers, selectedMarkerId, selectMarker])

  useEffect(() => {
    if (map.current && !isUpdatingFromMap.current) {
      map.current.setCenter(center)
      map.current.setZoom(zoom)
    }
  }, [center, zoom])

  const handleZoomIn = () => {
    if (map.current) {
      map.current.zoomIn()
    }
  }

  const handleZoomOut = () => {
    if (map.current) {
      map.current.zoomOut()
    }
  }

  const handleResetView = () => {
    if (map.current) {
      map.current.flyTo({
        center: [-74.006, 40.7128],
        zoom: 12,
        duration: 1500,
      })
    }
  }

  const handleFitBounds = () => {
    if (map.current && markers.length > 0) {
      const bounds = new maplibregl.LngLatBounds()
      markers.forEach((marker) => {
        bounds.extend(marker.coordinates)
      })
      map.current.fitBounds(bounds, { padding: 50, duration: 1000 })
    }
  }

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainer} className="h-full w-full rounded-lg overflow-hidden" />

      {/* Map Controls */}
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <Card className="p-1">
          <div className="flex flex-col gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomIn} title="Zoom In">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomOut} title="Zoom Out">
              <ZoomOut className="h-4 w-4" />
            </Button>
          </div>
        </Card>
        <Card className="p-1">
          <div className="flex flex-col gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleResetView} title="Reset View">
              <Locate className="h-4 w-4" />
            </Button>
            {markers.length > 0 && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleFitBounds} title="Fit All Markers">
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* Selected Marker Info */}
      {selectedMarkerId && (
        <Card className="absolute bottom-4 left-4 right-4 p-4 max-w-sm">
          {(() => {
            const marker = markers.find((m) => m.id === selectedMarkerId)
            if (!marker) return null
            return (
              <div>
                <h3 className="font-semibold text-foreground mb-2">Marker Details</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID:</span>
                    <span className="font-medium">{marker.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Coordinates:</span>
                    <span className="font-medium font-mono text-xs">
                      {marker.coordinates[1].toFixed(4)}, {marker.coordinates[0].toFixed(4)}
                    </span>
                  </div>
                  {Object.entries(marker.properties).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-muted-foreground capitalize">{key}:</span>
                      <span className="font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </Card>
      )}
    </div>
  )
}
