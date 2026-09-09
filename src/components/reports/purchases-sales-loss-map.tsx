"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { MapPin } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useAllRegionsGeometry } from "@/hooks/api/use-regions-geometry-api"
import { normalizeRegionName } from "@/hooks/use-resolved-region-name"
import type { RegionSeries } from "@/hooks/api/use-purchases-sales-report"
import { formatKwh, formatPct, lossHeatRgb, regionTrendDelta, rgbToCss } from "@/components/reports/report-format"

interface PurchasesSalesLossMapProps {
  regions: RegionSeries[]
  nationalAvgLossPct: number | null
  monthKeys: string[]
  /** Lifted to the parent so clicking a region here and clicking a region
   * row in the Region ranking table below highlight each other -- two
   * entry points into the same selection, not two disconnected views. */
  focusedRegionKey: string | null
  onFocusRegion: (key: string | null) => void
}

/**
 * A real map of the regions, colored by loss % (same green->amber->red
 * ramp as the heat map), separate from src/components/map/choropleth-map.tsx
 * on purpose -- reuses that component's proven maplibre setup pattern and
 * the same shared useAllRegionsGeometry() data, but as its own independent
 * component so nothing here can regress the existing map used elsewhere.
 */
export function PurchasesSalesLossMap({
  regions,
  nationalAvgLossPct,
  monthKeys,
  focusedRegionKey,
  onFocusRegion,
}: PurchasesSalesLossMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const { data: geometryData, isLoading: isLoadingGeometry } = useAllRegionsGeometry()

  const regionByKey = useMemo(() => {
    const m = new Map<string, RegionSeries>()
    regions.forEach((r) => m.set(r.regionKey, r))
    return m
  }, [regions])

  // One lookup keyed by the geometry's own region-name spelling, resolved
  // through the same normalizeRegionName() every other Reports view uses --
  // the geometry service and the sales/purchases sources don't necessarily
  // agree on "Accra East" vs "Accra East Region" any more than those
  // sources agree with each other.
  const geometryKeyToRegionKey = useMemo(() => {
    const m = new Map<string, string>()
    ;(geometryData?.data?.regions ?? []).forEach((g) => {
      const key = normalizeRegionName(g.region)
      if (regionByKey.has(key)) m.set(g.region, key)
    })
    return m
  }, [geometryData, regionByKey])

  const geoJson = useMemo(() => {
    const feats = (geometryData?.data?.regions ?? []).map((g) => {
      const regionKey = geometryKeyToRegionKey.get(g.region)
      const series = regionKey ? regionByKey.get(regionKey) : undefined
      const rgb = lossHeatRgb(series?.lossPct ?? null, nationalAvgLossPct)
      return {
        ...g.geojson,
        properties: {
          ...g.geojson.properties,
          regionKey: regionKey ?? null,
          color: rgbToCss(rgb),
        },
      }
    })
    return { type: "FeatureCollection" as const, features: feats }
  }, [geometryData, geometryKeyToRegionKey, regionByKey, nationalAvgLossPct])

  // Init map, with a retry loop -- same reason and shape as
  // choropleth-map.tsx's own "Initialize map with retry mechanism" effect:
  // mapContainer only actually exists in the DOM once isLoadingGeometry
  // flips to false and the real layout (not the Skeleton) renders, but
  // this effect only runs once (mount), so a single `if (!mapContainer.current)
  // return` -- what this file had before -- can permanently miss the
  // container if geometry is still loading on first render, which is the
  // common case. Retries on a short backoff instead of giving up once.
  useEffect(() => {
    if (map.current) return
    let attempt = 0
    const maxAttempts = 5
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    const tryInit = () => {
      if (!mapContainer.current) {
        attempt++
        if (attempt < maxAttempts) retryTimer = setTimeout(tryInit, 100 * attempt)
        return
      }
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            "google-street": {
              type: "raster",
              tiles: [
                "https://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
                "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
                "https://mt2.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
                "https://mt3.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
              ],
              tileSize: 256,
              attribution: '&copy; <a href="https://www.google.com/maps">Google Maps</a>',
            },
          },
          layers: [{ id: "google-street-layer", type: "raster", source: "google-street" }],
        },
        center: [-1.5, 7.5], // Ghana
        zoom: 6,
      })
      map.current.addControl(new maplibregl.NavigationControl(), "top-left")
      map.current.on("load", () => {
        setMapLoaded(true)
        // Canvas can size itself off a stale (pre-layout) container rect --
        // one more resize once tiles/layout have settled fixes a map that
        // rendered but painted blank/mis-sized.
        setTimeout(() => map.current?.resize(), 100)
      })
    }

    tryInit()

    return () => {
      clearTimeout(retryTimer)
      map.current?.remove()
      map.current = null
      setMapLoaded(false)
    }
  }, [])

  // Draw/refresh the loss-colored fill whenever the data changes.
  useEffect(() => {
    const m = map.current
    if (!m || !mapLoaded || geoJson.features.length === 0) return

    if (m.getLayer("loss-fill")) m.removeLayer("loss-fill")
    if (m.getLayer("loss-outline")) m.removeLayer("loss-outline")
    if (m.getLayer("loss-focused-outline")) m.removeLayer("loss-focused-outline")
    if (m.getSource("loss-regions")) m.removeSource("loss-regions")

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON shape from the geometry API isn't typed precisely
    m.addSource("loss-regions", { type: "geojson", data: geoJson as any })
    m.addLayer({
      id: "loss-fill",
      type: "fill",
      source: "loss-regions",
      paint: { "fill-color": ["get", "color"], "fill-opacity": 0.75 },
    })
    m.addLayer({
      id: "loss-outline",
      type: "line",
      source: "loss-regions",
      paint: { "line-color": "#ffffff", "line-width": 0.75, "line-opacity": 0.7 },
    })
    // A thicker dark outline on just the focused region -- the map's own
    // visual echo of whichever region is selected here or in the ranking
    // table below.
    m.addLayer({
      id: "loss-focused-outline",
      type: "line",
      source: "loss-regions",
      paint: { "line-color": "#0f172a", "line-width": 3 },
      filter: ["==", ["get", "regionKey"], focusedRegionKey ?? "__none__"],
    })

    m.off("click", "loss-fill")
    m.on("click", "loss-fill", (e) => {
      const key = e.features?.[0]?.properties?.regionKey
      onFocusRegion(typeof key === "string" ? key : null)
    })
    m.off("mouseenter", "loss-fill")
    m.on("mouseenter", "loss-fill", () => {
      m.getCanvas().style.cursor = "pointer"
    })
    m.off("mouseleave", "loss-fill")
    m.on("mouseleave", "loss-fill", () => {
      m.getCanvas().style.cursor = ""
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onFocusRegion is a stable setter from the parent
  }, [geoJson, mapLoaded, focusedRegionKey])

  useEffect(() => {
    map.current?.resize()
  }, [focusedRegionKey])

  const focused = focusedRegionKey ? regionByKey.get(focusedRegionKey) : null
  const focusedRank = focused ? regions.findIndex((r) => r.regionKey === focused.regionKey) + 1 : null
  const focusedTrend = focused ? regionTrendDelta(focused.byMonth, monthKeys) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Loss map — click a region</CardTitle>
        <CardDescription>Colored the same way as the heat map above — click any region for its full breakdown.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoadingGeometry ? (
          <Skeleton className="h-[420px] w-full" />
        ) : (
          <div className="grid gap-4 md:grid-cols-[1fr_280px]">
            <div ref={mapContainer} className="h-[420px] w-full rounded-lg overflow-hidden border border-border" />
            <div className="space-y-3">
              {!focused ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-8 text-muted-foreground">
                  <MapPin className="h-6 w-6" />
                  <p className="text-sm">Click a region on the map (or a row below) to see its full numbers here.</p>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      #{focusedRank} of {regions.length} — highest loss % first
                    </p>
                    <h3 className="text-lg font-semibold text-foreground">{focused.region}</h3>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Purchased</span>
                      <span className="font-medium text-blue-700 tabular-nums">
                        {formatKwh(focused.totalPurchasesKwh)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Sold</span>
                      <span className="font-medium text-emerald-700 tabular-nums">
                        {formatKwh(focused.totalSalesKwh)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Loss</span>
                      <span className="font-medium tabular-nums">{formatKwh(focused.lossKwh)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t">
                      <span className="text-muted-foreground">Loss %</span>
                      <Badge variant="outline" className="text-sm font-semibold border-0 bg-transparent px-0">
                        {formatPct(focused.lossPct)}
                      </Badge>
                    </div>
                    {focusedTrend !== null && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Trend (1st half vs 2nd half)</span>
                        <span className={`font-medium tabular-nums ${focusedTrend > 0.5 ? "text-red-700" : focusedTrend < -0.5 ? "text-emerald-700" : "text-muted-foreground"}`}>
                          {focusedTrend > 0 ? "+" : ""}
                          {focusedTrend.toFixed(1)} pts
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Districts</span>
                      <span className="font-medium tabular-nums">{focused.districts.length}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
