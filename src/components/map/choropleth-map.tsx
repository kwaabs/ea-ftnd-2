"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { useAllRegionsGeometry } from "@/hooks/api/use-regions-geometry-api"
import { useBspAggregate } from "@/hooks/api/use-bsp-api"
import { useDtxAggregate } from "@/hooks/api/use-dtx-api"
import { useRegionalBoundaryAggregate } from "@/hooks/api/use-regional-boundary-api"
import { useMeters } from "@/hooks/api/use-meter-api"
import { useZeusBillingAggregate } from "@/hooks/api/use-zeus-billing-aggregate-api"
import { useMmsCustomerSalesAggregate } from "@/hooks/api/use-mms-customer-sales-aggregate-api"
import { useAppStore } from "@/stores/app-store"
import { formatApiDate } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { X, ExternalLink } from "lucide-react"
import Link from "next/link"

// Only the selection identity is kept in state — metrics are derived live
// from current data via selectedRegionMetrics below, not frozen at click
// time. Sales data (Zeus/MMS) can still be loading when a region is
// clicked; deriving live means the panel updates to the real numbers once
// it arrives instead of staying stuck at whatever was true at click time.
interface SelectedRegion {
    region: string
    district: string
}

export function ChoroplethMap() {
    const mapContainer = useRef<HTMLDivElement>(null)
    const map = useRef<maplibregl.Map | null>(null)
    const [mapLoaded, setMapLoaded] = useState(false)
    const [selectedRegion, setSelectedRegion] = useState<SelectedRegion | null>(null)

    const filters = useAppStore((state) => state.filters)
    const [selectedMetrics, setSelectedMetrics] = useState({
        bsp: true,
        dtx: false,
        net: false,
        crossBoundary: false,
        postpaid: false,
        prepaid: false,
        loss: false,
    })

    const dateFrom = formatApiDate(filters.dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    const dateTo = formatApiDate(filters.dateRange?.end || new Date())

    // Fetch geometries
    const { data: geometryData, isLoading: isLoadingGeometry } = useAllRegionsGeometry()

    // Each meter type uses its own dedicated hook and endpoint
    const { data: bspData, isLoading: isLoadingBsp } = useBspAggregate({ dateFrom, dateTo })
    const { data: dtxData, isLoading: isLoadingDtx } = useDtxAggregate({ dateFrom, dateTo })
    const { data: boundaryData, isLoading: isLoadingBoundary } = useRegionalBoundaryAggregate({ dateFrom, dateTo })

    // Customer sales sources — billed/read kWh, not grid-side metering.
    // Postpaid = Zeus Postpaid + Zeus AMR; Prepaid = Zeus Prepaid + MMS —
    // same convention used everywhere else in the app (region/district
    // detail, customer sales overview, dashboard). Zeus is grouped by both
    // region and meter type so Postpaid vs Prepaid can be split out below.
    const { data: zeusData, isLoading: isLoadingZeus } = useZeusBillingAggregate({
        dateFrom,
        dateTo,
        groupBy: ["metermodeltype", "regionname"],
    })
    const { data: mmsData, isLoading: isLoadingMms } = useMmsCustomerSalesAggregate({
        dateFrom,
        dateTo,
        groupBy: "region",
    })

    const isLoadingEnergy = isLoadingBsp || isLoadingDtx || isLoadingBoundary
    // Retries indefinitely under the hood (see the two hooks above) rather
    // than surfacing a retry button — a slow/stuck fetch just keeps this
    // true until it finally succeeds, and the real data pops in whenever
    // that happens.
    const isLoadingSales = isLoadingZeus || isLoadingMms

    // ── Per-type region lookup helpers ──────────────────────────────────────
    // BSP: byRegion[].region is lowercased, value is supplyKwh / netSupplyKwh
    const getBspImport = (regionName: string): number => {
        const match = bspData?.byRegion?.find((r) => r.region.toLowerCase() === regionName.toLowerCase())
        return match?.supplyKwh ?? 0
    }
    const getBspNet = (regionName: string): number => {
        const match = bspData?.byRegion?.find((r) => r.region.toLowerCase() === regionName.toLowerCase())
        return match?.netSupplyKwh ?? 0
    }
    // DTX: regionalBreakdown[].region original casing, value is .import
    const getDtxImport = (regionName: string): number => {
        const match = dtxData?.regionalBreakdown?.find((r) => r.region.toLowerCase() === regionName.toLowerCase())
        return match?.import ?? 0
    }
    // Regional Boundary: byBoundaryPoint[].boundaryPoint is "RegionA/RegionB"
    // Sum all boundary points where either side matches the region name
    const getBoundaryImport = (regionName: string): number => {
        if (!boundaryData?.byBoundaryPoint) return 0
        const lower = regionName.toLowerCase()
        return boundaryData.byBoundaryPoint
            .filter((b) => b.boundaryPoint.toLowerCase().includes(lower))
            .reduce((sum, b) => sum + (b.importKwh ?? 0), 0)
    }

    // ── Customer sales lookup helpers ───────────────────────────────────────
    const normalizeZeusType = (raw?: string | null) => (raw || "").trim().toLowerCase()

    // Zeus billing and MMS each maintain their own independent region
    // column, which isn't guaranteed to be the exact same string as
    // geometry's region name — typically just a trailing "Region" (e.g.
    // "Accra East" vs "Accra East Region"). Strip that specific suffix
    // rather than doing a generic prefix match: Ghana has real regions
    // where one name is a genuine prefix of a different region (Bono vs
    // Bono East, Western vs Western North), so startsWith() would silently
    // merge two distinct regions' data. Same resolution logic as
    // useResolvedRegionName, just usable per-row in a loop instead of once
    // via a hook.
    const stripRegionSuffix = (s: string) => s.trim().toLowerCase().replace(/\s+region$/, "")
    const regionNamesMatch = (pageRegion: string, sourceRegion?: string | null): boolean => {
        if (!sourceRegion) return false
        return stripRegionSuffix(pageRegion) === stripRegionSuffix(sourceRegion)
    }

    // Postpaid: Zeus Postpaid + Zeus AMR billed consumption per region — AMR
    // is just another metermodeltype value within Zeus data, not a separate
    // source (see customer-sales-overview.tsx). Split into the two
    // sub-totals as well as the combined figure, so the region panel can
    // show the Postpaid/AMR breakdown without changing the headline number
    // used everywhere else (choropleth coloring, ranges, loss calc).
    const getPostpaidZeusKwh = (regionName: string): number => {
        return (zeusData ?? [])
            .filter((z) => normalizeZeusType(z.metermodeltype) === "postpaid" && regionNamesMatch(regionName, z.regionname))
            .reduce((sum, z) => sum + (z.sum_billconsumptionvalue ?? 0), 0)
    }
    const getPostpaidAmrKwh = (regionName: string): number => {
        return (zeusData ?? [])
            .filter((z) => normalizeZeusType(z.metermodeltype) === "amr" && regionNamesMatch(regionName, z.regionname))
            .reduce((sum, z) => sum + (z.sum_billconsumptionvalue ?? 0), 0)
    }
    const getPostpaidKwh = (regionName: string): number =>
        getPostpaidZeusKwh(regionName) + getPostpaidAmrKwh(regionName)
    // Prepaid: Zeus Prepaid billed consumption + MMS kWh read (last month),
    // per region.
    const getPrepaidKwh = (regionName: string): number => {
        const zeusPrepaid = (zeusData ?? [])
            .filter((z) => normalizeZeusType(z.metermodeltype) === "prepaid" && regionNamesMatch(regionName, z.regionname))
            .reduce((sum, z) => sum + (z.sum_billconsumptionvalue ?? 0), 0)
        const mmsKwh = mmsData?.find((m) => regionNamesMatch(regionName, m.region))?.sum_last_month_kwh_read ?? 0
        return zeusPrepaid + mmsKwh
    }
    // Loss: total supply into the region (BSP import + regional boundary
    // import) minus everything billed/read across both sales categories.
    // Positive = unaccounted-for energy (technical + commercial losses, or
    // theft). Can go negative if sales exceed the region's own recorded
    // supply — e.g. power drawn from a neighboring region's BSP/boundary
    // point but billed under this region, or a data/attribution mismatch
    // between the grid-side and sales-side region labels.
    const getSupply = (regionName: string): number => getBspImport(regionName) + getBoundaryImport(regionName)
    const getSales = (regionName: string): number => getPostpaidKwh(regionName) + getPrepaidKwh(regionName)
    const getLoss = (regionName: string): number => getSupply(regionName) - getSales(regionName)

    // limit is well above any single region's meter count today (largest is
    // ~1700) — QueryMeters has no server-side upper cap, so this is safe.
    // meta.total (not meters.length) is still used for the headline count so
    // this stays correct even if a region grows past this limit later.
    const { data: meterStats } = useMeters({
        region: selectedRegion?.region,
        limit: 5000,
    })

    const regionStats = useMemo(() => {
        if (!meterStats?.data?.data) return null

        const meters = meterStats.data.data
        const totalMeters = meterStats.data.meta?.total ?? meters.length
        const meterTypeCount: Record<string, number> = {}

        meters.forEach((meter) => {
            meterTypeCount[meter.meter_type] = (meterTypeCount[meter.meter_type] || 0) + 1
        })

        return {
            totalMeters,
            meterTypes: meterTypeCount,
            // meters.length can be less than totalMeters if a region ever
            // exceeds the fetch limit above — the type/station breakdown
            // would then be a sample, not the full picture.
            isPartialBreakdown: meters.length < totalMeters,
        }
    }, [meterStats])

    // Canonical list of region names from geometry — used as the basis for all range calculations
    const allRegionNames = useMemo(
        () => (geometryData?.data?.regions ?? []).map((r) => r.region),
        [geometryData]
    )

    // Independent min/max ranges per metric — used by the legend scales
    const metricRanges = useMemo(() => {
        const rangeFrom = (vals: number[]) =>
            vals.length ? { min: Math.min(...vals), max: Math.max(...vals) } : { min: 0, max: 0 }
        return {
            bsp: rangeFrom(allRegionNames.map(getBspImport)),
            dtx: rangeFrom(allRegionNames.map(getDtxImport)),
            net: rangeFrom(allRegionNames.map(getBspNet)),
            crossBoundary: rangeFrom(allRegionNames.map(getBoundaryImport)),
            postpaid: rangeFrom(allRegionNames.map(getPostpaidKwh)),
            prepaid: rangeFrom(allRegionNames.map(getPrepaidKwh)),
            loss: rangeFrom(allRegionNames.map(getLoss)),
        }
    }, [bspData, dtxData, boundaryData, zeusData, mmsData, allRegionNames])

    // Global min/max across all active metrics — used for choropleth color scaling
    const { minValue, maxValue } = useMemo(() => {
        if (allRegionNames.length === 0) return { minValue: 0, maxValue: 0 }
        const values = allRegionNames.map((region) => {
            let total = 0
            if (selectedMetrics.bsp) total += getBspImport(region)
            if (selectedMetrics.dtx) total += getDtxImport(region)
            if (selectedMetrics.net) total += getBspNet(region)
            if (selectedMetrics.crossBoundary) total += getBoundaryImport(region)
            if (selectedMetrics.postpaid) total += getPostpaidKwh(region)
            if (selectedMetrics.prepaid) total += getPrepaidKwh(region)
            if (selectedMetrics.loss) total += getLoss(region)
            return total
        })
        return { minValue: Math.min(...values), maxValue: Math.max(...values) }
    }, [bspData, dtxData, boundaryData, zeusData, mmsData, allRegionNames, selectedMetrics])

    const getRegionColor = (regionName: string) => {
        const noMetric =
            !selectedMetrics.bsp &&
            !selectedMetrics.dtx &&
            !selectedMetrics.net &&
            !selectedMetrics.crossBoundary &&
            !selectedMetrics.postpaid &&
            !selectedMetrics.prepaid &&
            !selectedMetrics.loss
        if (noMetric) return "#e5e7eb"

        let total = 0
        if (selectedMetrics.bsp) total += getBspImport(regionName)
        if (selectedMetrics.dtx) total += getDtxImport(regionName)
        if (selectedMetrics.net) total += getBspNet(regionName)
        if (selectedMetrics.crossBoundary) total += getBoundaryImport(regionName)
        if (selectedMetrics.postpaid) total += getPostpaidKwh(regionName)
        if (selectedMetrics.prepaid) total += getPrepaidKwh(regionName)
        if (selectedMetrics.loss) total += getLoss(regionName)

        const range = maxValue - minValue
        const normalized = range > 0 ? (total - minValue) / range : 0

        if (normalized < 0.5) {
            const t = normalized * 2
            return `rgb(${Math.floor(34 + t * 221)}, ${Math.floor(197 - t * 42)}, 94)`
        } else {
            const t = (normalized - 0.5) * 2
            return `rgb(${255}, ${Math.floor(155 - t * 155)}, ${Math.floor(94 - t * 94)})`
        }
    }

    // Combine geometry with per-type energy values — each metric from its own hook
    const geoJsonData = useMemo(() => {
        if (!geometryData?.data?.regions) return null
        const regions = geometryData.data.regions
        if (regions.length === 0) return null

        const features = regions.map((regionGeom) => {
            const regionName = regionGeom.region
            const bsp_import = getBspImport(regionName)
            const dtx_import = getDtxImport(regionName)
            const net_consumption = getBspNet(regionName)
            const cross_boundary = getBoundaryImport(regionName)
            const postpaid_kwh = getPostpaidKwh(regionName)
            const prepaid_kwh = getPrepaidKwh(regionName)
            const loss_kwh = getLoss(regionName)
            const color = getRegionColor(regionName)

            return {
                ...regionGeom.geojson,
                properties: {
                    ...regionGeom.geojson.properties,
                    bsp_import,
                    dtx_import,
                    net_consumption,
                    cross_boundary,
                    postpaid_kwh,
                    prepaid_kwh,
                    loss_kwh,
                    color,
                },
            }
        })

        return { type: "FeatureCollection" as const, features }
    }, [geometryData, bspData, dtxData, boundaryData, zeusData, mmsData, selectedMetrics])

    // Derived live from current data rather than frozen at click time — see
    // the SelectedRegion comment above.
    const selectedRegionMetrics = useMemo(() => {
        if (!selectedRegion) return null
        const region = selectedRegion.region
        const bsp_import = getBspImport(region)
        const dtx_import = getDtxImport(region)
        const net_consumption = getBspNet(region)
        const cross_boundary = getBoundaryImport(region)
        const postpaid_zeus_kwh = getPostpaidZeusKwh(region)
        const postpaid_amr_kwh = getPostpaidAmrKwh(region)
        const postpaid_kwh = postpaid_zeus_kwh + postpaid_amr_kwh
        const prepaid_kwh = getPrepaidKwh(region)
        const loss_kwh = getLoss(region)
        return { bsp_import, dtx_import, net_consumption, cross_boundary, postpaid_kwh, postpaid_zeus_kwh, postpaid_amr_kwh, prepaid_kwh, loss_kwh }
    }, [selectedRegion, bspData, dtxData, boundaryData, zeusData, mmsData])

    // Initialize map with retry mechanism
    useEffect(() => {
        if (map.current) {
            return
        }

        let attempt = 0
        const maxAttempts = 5

        const tryInitializeMap = () => {
            if (!mapContainer.current) {
                attempt++
                if (attempt < maxAttempts) {
                    setTimeout(tryInitializeMap, 100 * attempt)
                }
                return
            }

            try {
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
                        layers: [
                            {
                                id: "google-street-layer",
                                type: "raster",
                                source: "google-street",
                            },
                        ],
                    },
                    center: [-1.5, 7.5], // Ghana center
                    zoom: 6,
                })

                map.current.addControl(new maplibregl.NavigationControl(), "top-left")

                map.current.on("load", () => {
                    setMapLoaded(true)
                    setTimeout(() => {
                        if (map.current) {
                            map.current.resize()
                        }
                    }, 100)
                })
            } catch (error) {
                console.error("[v0] Error initializing map:", error)
            }
        }

        // Start initialization after a small delay
        const timer = setTimeout(tryInitializeMap, 100)

        return () => {
            clearTimeout(timer)
            if (map.current) {
                console.log("[v0] Cleaning up map")
                map.current.remove()
                map.current = null
            }
            setMapLoaded(false)
        }
    }, [])

    // Resize map when panel opens/closes
    useEffect(() => {
        if (map.current) {
            setTimeout(() => {
                map.current?.resize()
            }, 300) // Match transition duration
        }
    }, [selectedRegion])

    // Update choropleth layer
    useEffect(() => {
        if (!map.current || !geoJsonData || !mapLoaded) return

        const mapInstance = map.current

        function addChoroplethLayer() {
            if (!mapInstance || !geoJsonData) return

            try {
                // Remove existing layer and source
                if (mapInstance.getLayer("districts-fill")) {
                    mapInstance.removeLayer("districts-fill")
                }
                if (mapInstance.getLayer("districts-outline")) {
                    mapInstance.removeLayer("districts-outline")
                }
                if (mapInstance.getSource("districts")) {
                    mapInstance.removeSource("districts")
                }

                // Add source
                mapInstance.addSource("districts", {
                    type: "geojson",
                    data: geoJsonData as any,
                })

                // Add fill layer
                mapInstance.addLayer({
                    id: "districts-fill",
                    type: "fill",
                    source: "districts",
                    paint: {
                        "fill-color": ["get", "color"], // Read color directly from properties
                        "fill-opacity": 0.7, // Increased opacity for better heatmap effect
                    },
                })

                // Add outline layer with thinner lines
                mapInstance.addLayer({
                    id: "districts-outline",
                    type: "line",
                    source: "districts",
                    paint: {
                        "line-color": "#ffffff", // White boundaries for cleaner look
                        "line-width": 0.5, // Reduced from 1 to 0.5
                        "line-opacity": 0.6, // Subtle boundaries
                    },
                })

                // Fit bounds
                const bounds = new maplibregl.LngLatBounds()
                geoJsonData.features.forEach((feature: any) => {
                    if (feature.geometry.type === "Polygon") {
                        feature.geometry.coordinates[0].forEach((coord: number[]) => {
                            bounds.extend(coord as [number, number])
                        })
                    } else if (feature.geometry.type === "MultiPolygon") {
                        feature.geometry.coordinates.forEach((polygon: any) => {
                            polygon[0].forEach((coord: number[]) => {
                                bounds.extend(coord as [number, number])
                            })
                        })
                    }
                })

                if (!bounds.isEmpty()) {
                    mapInstance.fitBounds(bounds, { padding: 50, duration: 1000 })
                }

                // Remove existing event listeners
                mapInstance.off("click", "districts-fill")
                mapInstance.off("mouseenter", "districts-fill")
                mapInstance.off("mouseleave", "districts-fill")

                // Add click handler
                mapInstance.on("click", "districts-fill", (e) => {
                    if (!e.features || !e.features[0]) return

                    const feature = e.features[0]
                    const props = feature.properties

                    if (props) {
                        setSelectedRegion({
                            region: props.region,
                            district: props.district,
                        })
                    }
                })

                // Change cursor on hover
                mapInstance.on("mouseenter", "districts-fill", () => {
                    mapInstance.getCanvas().style.cursor = "pointer"
                })
                mapInstance.on("mouseleave", "districts-fill", () => {
                    mapInstance.getCanvas().style.cursor = ""
                })
            } catch (error) {
                console.error("Error adding choropleth layer:", error)
            }
        }

        addChoroplethLayer()
    }, [geoJsonData, selectedMetrics, mapLoaded])

    // Only block on geometry — energy data layers in once ready
    if (isLoadingGeometry) {
        return (
            <div className="space-y-4">
                <Card>
                    <CardHeader>
                        <div className="h-6 w-48 bg-muted animate-pulse rounded" />
                    </CardHeader>
                    <CardContent className="flex gap-6">
                        <div className="h-5 w-24 bg-muted animate-pulse rounded" />
                        <div className="h-5 w-32 bg-muted animate-pulse rounded" />
                        <div className="h-5 w-28 bg-muted animate-pulse rounded" />
                        <div className="h-5 w-36 bg-muted animate-pulse rounded" />
                    </CardContent>
                </Card>
                <div className="h-[calc(100vh-300px)] w-full flex items-center justify-center bg-muted/10 rounded-lg border">
                    <div className="text-center space-y-2">
                        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-sm text-muted-foreground">Loading map boundaries...</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Metrics to Display</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-6 flex-wrap">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="bsp"
                                checked={selectedMetrics.bsp}
                                disabled={selectedMetrics.loss}
                                onCheckedChange={(checked) => setSelectedMetrics((prev) => ({ ...prev, bsp: checked as boolean }))}
                            />
                            <label
                                htmlFor="bsp"
                                className={`text-sm font-medium ${selectedMetrics.loss ? "text-muted-foreground/50 cursor-not-allowed" : "cursor-pointer"}`}
                            >
                                BSP Import
                            </label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="dtx"
                                checked={selectedMetrics.dtx}
                                disabled={selectedMetrics.loss}
                                onCheckedChange={(checked) => setSelectedMetrics((prev) => ({ ...prev, dtx: checked as boolean }))}
                            />
                            <label
                                htmlFor="dtx"
                                className={`text-sm font-medium ${selectedMetrics.loss ? "text-muted-foreground/50 cursor-not-allowed" : "cursor-pointer"}`}
                            >
                                DTX Distribution
                            </label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="net"
                                checked={selectedMetrics.net}
                                disabled={selectedMetrics.loss}
                                onCheckedChange={(checked) => setSelectedMetrics((prev) => ({ ...prev, net: checked as boolean }))}
                            />
                            <label
                                htmlFor="net"
                                className={`text-sm font-medium ${selectedMetrics.loss ? "text-muted-foreground/50 cursor-not-allowed" : "cursor-pointer"}`}
                            >
                                Net Consumption
                            </label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="crossBoundary"
                                checked={selectedMetrics.crossBoundary}
                                disabled={selectedMetrics.loss}
                                onCheckedChange={(checked) =>
                                    setSelectedMetrics((prev) => ({ ...prev, crossBoundary: checked as boolean }))
                                }
                            />
                            <label
                                htmlFor="crossBoundary"
                                className={`text-sm font-medium ${selectedMetrics.loss ? "text-muted-foreground/50 cursor-not-allowed" : "cursor-pointer"}`}
                            >
                                Cross-Boundary Flow
                            </label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="postpaid"
                                checked={selectedMetrics.postpaid}
                                disabled={selectedMetrics.loss}
                                onCheckedChange={(checked) => setSelectedMetrics((prev) => ({ ...prev, postpaid: checked as boolean }))}
                            />
                            <label
                                htmlFor="postpaid"
                                className={`text-sm font-medium ${selectedMetrics.loss ? "text-muted-foreground/50 cursor-not-allowed" : "cursor-pointer"}`}
                            >
                                Postpaid Sales (Zeus + AMR)
                            </label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="prepaid"
                                checked={selectedMetrics.prepaid}
                                disabled={selectedMetrics.loss}
                                onCheckedChange={(checked) => setSelectedMetrics((prev) => ({ ...prev, prepaid: checked as boolean }))}
                            />
                            <label
                                htmlFor="prepaid"
                                className={`text-sm font-medium ${selectedMetrics.loss ? "text-muted-foreground/50 cursor-not-allowed" : "cursor-pointer"}`}
                            >
                                Prepaid Sales (Zeus + MMS)
                            </label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="loss"
                                checked={selectedMetrics.loss}
                                onCheckedChange={(checked) =>
                                    setSelectedMetrics((prev) =>
                                        checked
                                            ? {
                                                  bsp: false,
                                                  dtx: false,
                                                  net: false,
                                                  crossBoundary: false,
                                                  postpaid: false,
                                                  prepaid: false,
                                                  loss: true,
                                              }
                                            : { ...prev, loss: false },
                                    )
                                }
                            />
                            <label htmlFor="loss" className="text-sm font-medium cursor-pointer">
                                Loss (Supply − Sales)
                            </label>
                        </div>
                    </div>
                    {selectedMetrics.loss && (
                        <p className="mt-2 text-xs text-muted-foreground">
                            Loss is shown on its own — other metrics are disabled while Loss is selected since combining
                            them into one blended color scale wouldn&apos;t be meaningful.
                        </p>
                    )}

                    <div className="mt-6 pt-6 border-t">
                        <div className="space-y-3">
                            <span className="text-sm font-medium">Heat Map Scales:</span>

                            {selectedMetrics.bsp && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-green-700 dark:text-green-400 min-w-[110px]">BSP Import:</span>
                                    <div className="flex items-center gap-2 flex-1">
                                        <span className="text-xs text-muted-foreground">{metricRanges.bsp.min.toLocaleString()}</span>
                                        <div
                                            className="flex-1 h-5 rounded"
                                            style={{
                                                background: "linear-gradient(to right, rgb(34, 197, 94), rgb(255, 155, 94), rgb(255, 0, 0))",
                                            }}
                                        />
                                        <span className="text-xs text-muted-foreground">{metricRanges.bsp.max.toLocaleString()}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">kWh</span>
                                </div>
                            )}

                            {selectedMetrics.dtx && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-blue-700 dark:text-blue-400 min-w-[110px]">DTX Import:</span>
                                    <div className="flex items-center gap-2 flex-1">
                                        <span className="text-xs text-muted-foreground">{metricRanges.dtx.min.toLocaleString()}</span>
                                        <div
                                            className="flex-1 h-5 rounded"
                                            style={{
                                                background: "linear-gradient(to right, rgb(34, 197, 94), rgb(255, 155, 94), rgb(255, 0, 0))",
                                            }}
                                        />
                                        <span className="text-xs text-muted-foreground">{metricRanges.dtx.max.toLocaleString()}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">kWh</span>
                                </div>
                            )}

                            {selectedMetrics.net && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-purple-700 dark:text-purple-400 min-w-[110px]">Net Consumption:</span>
                                    <div className="flex items-center gap-2 flex-1">
                                        <span className="text-xs text-muted-foreground">{metricRanges.net.min.toLocaleString()}</span>
                                        <div
                                            className="flex-1 h-5 rounded"
                                            style={{
                                                background: "linear-gradient(to right, rgb(34, 197, 94), rgb(255, 155, 94), rgb(255, 0, 0))",
                                            }}
                                        />
                                        <span className="text-xs text-muted-foreground">{metricRanges.net.max.toLocaleString()}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">kWh</span>
                                </div>
                            )}

                            {selectedMetrics.crossBoundary && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-orange-700 dark:text-orange-400 min-w-[110px]">Cross-Boundary:</span>
                                    <div className="flex items-center gap-2 flex-1">
                                        <span className="text-xs text-muted-foreground">{metricRanges.crossBoundary.min.toLocaleString()}</span>
                                        <div
                                            className="flex-1 h-5 rounded"
                                            style={{
                                                background: "linear-gradient(to right, rgb(34, 197, 94), rgb(255, 155, 94), rgb(255, 0, 0))",
                                            }}
                                        />
                                        <span className="text-xs text-muted-foreground">{metricRanges.crossBoundary.max.toLocaleString()}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">kWh</span>
                                </div>
                            )}

                            {selectedMetrics.postpaid && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-blue-700 dark:text-blue-400 min-w-[110px]">Postpaid Sales:</span>
                                    <div className="flex items-center gap-2 flex-1">
                                        <span className="text-xs text-muted-foreground">{metricRanges.postpaid.min.toLocaleString()}</span>
                                        <div
                                            className="flex-1 h-5 rounded"
                                            style={{
                                                background: "linear-gradient(to right, rgb(34, 197, 94), rgb(255, 155, 94), rgb(255, 0, 0))",
                                            }}
                                        />
                                        <span className="text-xs text-muted-foreground">{metricRanges.postpaid.max.toLocaleString()}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">kWh</span>
                                </div>
                            )}

                            {selectedMetrics.prepaid && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 min-w-[110px]">Prepaid Sales:</span>
                                    <div className="flex items-center gap-2 flex-1">
                                        <span className="text-xs text-muted-foreground">{metricRanges.prepaid.min.toLocaleString()}</span>
                                        <div
                                            className="flex-1 h-5 rounded"
                                            style={{
                                                background: "linear-gradient(to right, rgb(34, 197, 94), rgb(255, 155, 94), rgb(255, 0, 0))",
                                            }}
                                        />
                                        <span className="text-xs text-muted-foreground">{metricRanges.prepaid.max.toLocaleString()}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">kWh</span>
                                </div>
                            )}

                            {selectedMetrics.loss && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-red-700 dark:text-red-400 min-w-[110px]">Loss:</span>
                                    <div className="flex items-center gap-2 flex-1">
                                        <span className="text-xs text-muted-foreground">{metricRanges.loss.min.toLocaleString()}</span>
                                        <div
                                            className="flex-1 h-5 rounded"
                                            style={{
                                                background: "linear-gradient(to right, rgb(34, 197, 94), rgb(255, 155, 94), rgb(255, 0, 0))",
                                            }}
                                        />
                                        <span className="text-xs text-muted-foreground">{metricRanges.loss.max.toLocaleString()}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">kWh</span>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex gap-4 relative">
                {/* Map Container */}
                <div
                    className={`relative transition-all duration-300 ease-in-out ${selectedRegion ? "w-[60%]" : "w-full"
                    } h-[calc(100vh-300px)] rounded-lg border overflow-hidden`}
                >
                    <div ref={mapContainer} className="w-full h-full" />
                    {(isLoadingEnergy || isLoadingSales) && (
                        <div className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm border rounded-md px-3 py-1.5 flex items-center gap-2 shadow-sm">
                            <div className="h-3.5 w-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs text-muted-foreground">Loading energy data...</span>
                        </div>
                    )}
                </div>

                {/* Side Panel */}
                {selectedRegion && selectedRegionMetrics && (
                    <Card className="w-[38%] h-[calc(100vh-300px)] overflow-auto animate-in slide-in-from-right duration-300">
                        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                            <div className="space-y-1">
                                <CardTitle className="text-2xl">{selectedRegion.region}</CardTitle>
                                <p className="text-sm text-muted-foreground">{selectedRegion.district}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setSelectedRegion(null)} className="h-8 w-8">
                                <X className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Metrics Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                {selectedMetrics.bsp && (
                                    <div className="space-y-1 p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
                                        <p className="text-xs font-medium text-green-700 dark:text-green-400">BSP Import</p>
                                        <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                                            {selectedRegionMetrics.bsp_import.toLocaleString()}
                                        </p>
                                        <p className="text-xs text-green-600 dark:text-green-500">kWh</p>
                                    </div>
                                )}

                                {selectedMetrics.dtx && (
                                    <div className="space-y-1 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                                        <p className="text-xs font-medium text-blue-700 dark:text-blue-400">DTX Import</p>
                                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                                            {selectedRegionMetrics.dtx_import.toLocaleString()}
                                        </p>
                                        <p className="text-xs text-blue-600 dark:text-blue-500">kWh</p>
                                    </div>
                                )}

                                {selectedMetrics.net && (
                                    <div className="space-y-1 p-4 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900">
                                        <p className="text-xs font-medium text-purple-700 dark:text-purple-400">Net Consumption</p>
                                        <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                                            {selectedRegionMetrics.net_consumption.toLocaleString()}
                                        </p>
                                        <p className="text-xs text-purple-600 dark:text-purple-500">kWh</p>
                                    </div>
                                )}

                                {selectedMetrics.crossBoundary && (
                                    <div className="space-y-1 p-4 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900">
                                        <p className="text-xs font-medium text-orange-700 dark:text-orange-400">Cross-Boundary</p>
                                        <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                                            {selectedRegionMetrics.cross_boundary.toLocaleString()}
                                        </p>
                                        <p className="text-xs text-orange-600 dark:text-orange-500">kWh</p>
                                    </div>
                                )}

                                {selectedMetrics.postpaid && (isLoadingSales ? (
                                    <div className="space-y-1 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 flex items-center gap-2">
                                        <div className="h-3.5 w-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                                        <p className="text-xs text-blue-700 dark:text-blue-400">Loading Postpaid sales…</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                                        <p className="text-xs font-medium text-blue-700 dark:text-blue-400">Postpaid Sales</p>
                                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                                            {selectedRegionMetrics.postpaid_kwh.toLocaleString()}
                                        </p>
                                        <p className="text-xs text-blue-600 dark:text-blue-500">kWh billed (Zeus + AMR)</p>
                                        <div className="flex items-center justify-between pt-1 mt-1 border-t border-blue-200 dark:border-blue-900 text-[11px] text-blue-700/80 dark:text-blue-400/80">
                                            <span>Zeus {selectedRegionMetrics.postpaid_zeus_kwh.toLocaleString()} kWh</span>
                                            <span>AMR {selectedRegionMetrics.postpaid_amr_kwh.toLocaleString()} kWh</span>
                                        </div>
                                    </div>
                                ))}

                                {selectedMetrics.prepaid && (isLoadingSales ? (
                                    <div className="space-y-1 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 flex items-center gap-2">
                                        <div className="h-3.5 w-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin shrink-0" />
                                        <p className="text-xs text-emerald-700 dark:text-emerald-400">Loading Prepaid sales…</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900">
                                        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Prepaid Sales</p>
                                        <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                                            {selectedRegionMetrics.prepaid_kwh.toLocaleString()}
                                        </p>
                                        <p className="text-xs text-emerald-600 dark:text-emerald-500">kWh (Zeus + MMS)</p>
                                    </div>
                                ))}

                                {selectedMetrics.loss && (isLoadingSales ? (
                                    <div className="space-y-1 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 flex items-center gap-2">
                                        <div className="h-3.5 w-3.5 border-2 border-red-600 border-t-transparent rounded-full animate-spin shrink-0" />
                                        <p className="text-xs text-red-700 dark:text-red-400">Loading sales data…</p>
                                    </div>
                                ) : (() => {
                                    const supply = selectedRegionMetrics.bsp_import + selectedRegionMetrics.cross_boundary
                                    const sales = selectedRegionMetrics.postpaid_kwh + selectedRegionMetrics.prepaid_kwh
                                    const noSalesData = sales === 0
                                    return (
                                        <div className="space-y-1 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                                            <p className="text-xs font-medium text-red-700 dark:text-red-400">Loss</p>
                                            <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                                                {selectedRegionMetrics.loss_kwh.toLocaleString()}
                                            </p>
                                            <p className="text-xs text-red-600 dark:text-red-500">
                                                {noSalesData
                                                    ? "kWh — no sales data for this period, see breakdown below"
                                                    : supply > 0
                                                        ? `${((selectedRegionMetrics.loss_kwh / supply) * 100).toFixed(1)}% of supply`
                                                        : "kWh (Supply − Postpaid − Prepaid)"}
                                            </p>
                                        </div>
                                    )
                                })())}
                            </div>

                            {/* Loss Breakdown */}
                            {selectedMetrics.loss && (isLoadingSales ? (
                                <div className="pt-4 border-t flex items-center gap-2 text-sm text-muted-foreground">
                                    <div className="h-3.5 w-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                                    Loading sales data for the breakdown…
                                </div>
                            ) : (() => {
                                const bsp = selectedRegionMetrics.bsp_import
                                const boundary = selectedRegionMetrics.cross_boundary
                                const supply = bsp + boundary
                                const sales = selectedRegionMetrics.postpaid_kwh + selectedRegionMetrics.prepaid_kwh
                                const loss = selectedRegionMetrics.loss_kwh
                                const lossPct = supply > 0 ? (loss / supply) * 100 : null
                                // Both sales categories at exactly zero almost always means no
                                // sales data exists for the selected date range in this region —
                                // not that the region genuinely sold zero kWh. Surface that
                                // instead of a confident-looking percentage.
                                const noSalesData = sales === 0

                                return (
                                    <div className="space-y-3 pt-4 border-t">
                                        <h4 className="font-semibold text-sm">Loss Breakdown</h4>
                                        <div className="space-y-1.5 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">BSP Import</span>
                                                <span className="font-medium tabular-nums">{bsp.toLocaleString()} kWh</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">+ Regional Boundary Import</span>
                                                <span className="font-medium tabular-nums">{boundary.toLocaleString()} kWh</span>
                                            </div>
                                            <div className="flex justify-between pl-3">
                                                <span className="text-muted-foreground">− Postpaid (Zeus)</span>
                                                <span className="tabular-nums">{selectedRegionMetrics.postpaid_zeus_kwh.toLocaleString()} kWh</span>
                                            </div>
                                            <div className="flex justify-between pl-3">
                                                <span className="text-muted-foreground">− Postpaid (AMR)</span>
                                                <span className="tabular-nums">{selectedRegionMetrics.postpaid_amr_kwh.toLocaleString()} kWh</span>
                                            </div>
                                            <div className="flex justify-between pl-3">
                                                <span className="text-muted-foreground">− Prepaid Sales</span>
                                                <span className="tabular-nums">{selectedRegionMetrics.prepaid_kwh.toLocaleString()} kWh</span>
                                            </div>
                                            <div className="flex justify-between pt-1.5 border-t font-semibold">
                                                <span className={loss >= 0 ? "text-red-700 dark:text-red-400" : "text-blue-700 dark:text-blue-400"}>
                                                    = Loss
                                                </span>
                                                <span
                                                    className={`tabular-nums ${loss >= 0 ? "text-red-700 dark:text-red-400" : "text-blue-700 dark:text-blue-400"}`}
                                                >
                                                    {loss.toLocaleString()} kWh
                                                    {lossPct !== null && !noSalesData && ` (${lossPct.toFixed(1)}%)`}
                                                </span>
                                            </div>
                                        </div>

                                        {noSalesData ? (
                                            <p className="text-xs text-amber-600 dark:text-amber-500 leading-relaxed">
                                                Postpaid and Prepaid both show zero sales for {selectedRegion.region} in the
                                                selected date range. This almost certainly means the date range doesn&apos;t
                                                overlap with available sales data — not that the region has a real {lossPct !== null ? `${lossPct.toFixed(0)}%` : ""} loss.
                                                Try a date range covering 2025 to see actual sales-backed loss figures.
                                            </p>
                                        ) : (
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                {supply === 0 ? (
                                                    <>
                                                        {selectedRegion.region} has no recorded BSP or boundary import for this
                                                        period, so loss can&apos;t be computed as a share of supply. Total
                                                        Postpaid + Prepaid sales were {sales.toLocaleString()} kWh.
                                                    </>
                                                ) : loss >= 0 ? (
                                                    <>
                                                        Of the {supply.toLocaleString()} kWh supplied to {selectedRegion.region}
                                                        {" "}(BSP + regional boundary imports), {sales.toLocaleString()} kWh was
                                                        billed across Postpaid and Prepaid sales. The remaining{" "}
                                                        {loss.toLocaleString()} kWh ({lossPct?.toFixed(1)}%) is unaccounted for
                                                        — this covers technical losses (line/transformer losses), commercial
                                                        losses (theft, metering error, unbilled connections), and any sales
                                                        attributed to a different region than where the power was actually
                                                        supplied.
                                                    </>
                                                ) : (
                                                    <>
                                                        Postpaid + Prepaid sales ({sales.toLocaleString()} kWh) exceed
                                                        this region&apos;s own recorded supply ({supply.toLocaleString()} kWh)
                                                        by {Math.abs(loss).toLocaleString()} kWh. That usually means some of
                                                        the power billed under {selectedRegion.region} was physically supplied
                                                        through a neighboring region&apos;s BSP or boundary point, or there&apos;s
                                                        a region-label mismatch between the grid-side and sales-side data — not
                                                        a &quot;negative loss&quot; in the technical sense.
                                                    </>
                                                )}
                                            </p>
                                        )}
                                    </div>
                                )
                            })())}

                            {/* Region Infrastructure Statistics */}
                            <div className="space-y-3 pt-4 border-t">
                                <h4 className="font-semibold text-sm">Region Infrastructure</h4>
                                {regionStats ? (
                                    <div className="space-y-4">
                                        {regionStats.isPartialBreakdown && (
                                            <p className="text-xs text-amber-600 dark:text-amber-500">
                                                Stations and meter-type counts below are based on a partial sample —
                                                this region has more meters than the fetch limit.
                                            </p>
                                        )}
                                        <div className="space-y-2">
                                            <p className="text-xs font-medium text-muted-foreground">Meters by Type</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {Object.entries(regionStats.meterTypes).map(([type, count]) => (
                                                    <div key={type} className="flex items-center justify-between p-2 rounded bg-muted/30 text-xs">
                                                        <span className="font-medium">{type}</span>
                                                        <span className="text-muted-foreground">{count}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-sm text-muted-foreground">Loading infrastructure data...</div>
                                )}
                            </div>

                            {/* Summary Stats */}
                            <div className="space-y-3 pt-4 border-t">
                                <h4 className="font-semibold text-sm">Summary Statistics</h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Total Import:</span>
                                        <span className="font-medium">
                                            {(selectedRegionMetrics.bsp_import + selectedRegionMetrics.dtx_import).toLocaleString()} kWh
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Net Flow:</span>
                                        <span className="font-medium">
                                            {(
                                                selectedRegionMetrics.bsp_import +
                                                selectedRegionMetrics.dtx_import -
                                                selectedRegionMetrics.net_consumption
                                            ).toLocaleString()}{" "}
                                            kWh
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Cross-Boundary Net:</span>
                                        <span
                                            className={`font-medium ${selectedRegionMetrics.cross_boundary >= 0 ? "text-green-600" : "text-red-600"}`}
                                        >
                                            {selectedRegionMetrics.cross_boundary >= 0 ? "+" : ""}
                                            {selectedRegionMetrics.cross_boundary.toLocaleString()} kWh
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* View Details Button */}
                            <Link href={`/regions/${selectedRegion.region.toLowerCase().replace(/\s+/g, "-")}`} className="w-full">
                                <Button className="w-full" variant="default">
                                    View Full Region Details
                                    <ExternalLink className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
