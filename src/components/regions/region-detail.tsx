"use client";

import { useMemo, useState } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
{
    /* Don't forget to add this import at the top */
}
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

import { useConsumptionAggregate } from "@/hooks/api/use-consumption-aggregate-api";
import { useRegionalBoundaryDaily } from "@/hooks/api/use-regional-boundary-api";
import { useBspDaily } from "@/hooks/api/use-bsp-api";
import { useDtxDaily, useDtxAggregate } from "@/hooks/api/use-dtx-api";
import { useDistrictsByRegion } from "@/hooks/api/use-districts-geometry-api";
import { useMeters } from "@/hooks/api/use-meter-api";
import { useMeterStatusSummary } from "@/hooks/api/use-meter-status-api";
import { useExpressFeederAggregate } from "@/hooks/api/use-express-feeder-api";
import { useAppStore } from "@/stores/app-store";
import { formatNumber, toProperCase } from "@/lib/utils";
import {
    ArrowLeft,
    ArrowLeftRight,
    ArrowDownIcon,
    ArrowUpIcon,
    ArrowRight,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    TrendingDown,
    TrendingUp,
    Building2,
    Activity,
    Trophy,
    MapPin,
    Zap,
    Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";

import { RegionMiniMap } from "./region-mini-map";
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    RadialBarChart,
    RadialBar,
} from "recharts";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import React from "react";

interface RegionDetailProps {
    region: string;
}

export function RegionDetail({ region }: RegionDetailProps) {
    const { filters } = useAppStore();
    const [metricView, setMetricView] = useState<
        | "bsp"
        | "dtx"
        | "boundaryImport"
        | "boundaryExport"
        | "availableSupply"
        | "net"
    >("availableSupply");
    const [expandedDistricts, setExpandedDistricts] = useState<Set<string>>(
        new Set(),
    );
    const [expandedStations, setExpandedStations] = useState<Set<string>>(
        new Set(),
    );
    const [expandedFeeders, setExpandedFeeders] = useState<Set<string>>(new Set());
    const toggleFeeder = (key: string) => {
        setExpandedFeeders((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const [expandedBoundaries, setExpandedBoundaries] = useState<Set<string>>(
        new Set(),
    );
    const [isBspFlowExpanded, setIsBspFlowExpanded] = useState(false);
    const [isBoundaryImportExpanded, setIsBoundaryImportExpanded] = useState(false);
    const [isAvailableSupplyExpanded, setIsAvailableSupplyExpanded] = useState(false);
    const [isPublicDtExpanded, setIsPublicDtExpanded] = useState(false);
    const [isDtxExpanded, setIsDtxExpanded] = useState(false);
    const [isBoundaryExportExpanded, setIsBoundaryExportExpanded] = useState(false);
    const [isFeederInboundExpanded, setIsFeederInboundExpanded] = useState(false);
    const [isFeederOutboundExpanded, setIsFeederOutboundExpanded] = useState(false);
    const [showFootnote, setShowFootnote] = useState(false);
    const [feederPage, setFeederPage] = useState(0);
    const [feederPageSize, setFeederPageSize] = useState(10);
    const [feederSearch, setFeederSearch] = useState("");



    const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
        "availableSupply",
    ]);

    // Convert region to proper case for data matching
    const regionProperCase = toProperCase(region);

    const dateRange = useMemo(() => {
        const formatDateToString = (
            date: Date | string | undefined,
            fallback: string,
        ): string => {
            if (!date) return fallback;
            if (date instanceof Date) {
                return date.toISOString().split("T")[0];
            }
            if (typeof date === "string") {
                return date.includes("T") ? date.split("T")[0] : date;
            }
            return fallback;
        };

        const defaultStart = new Date(new Date().setDate(new Date().getDate() - 30))
            .toISOString()
            .split("T")[0];
        const defaultEnd = new Date().toISOString().split("T")[0];

        return {
            start: formatDateToString(filters.dateRange?.start, defaultStart),
            end: formatDateToString(filters.dateRange?.end, defaultEnd),
        };
    }, [filters.dateRange]);

    // Params for consumption aggregate
    const params = {
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        regions: [regionProperCase],
    };

    // Params for regional boundary data - NO region filter
    const boundaryDataParams = {
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        meterTypes: ["REGIONAL_BOUNDARY"],
    };

    const { data: aggregateData, isLoading: aggregateLoading } =
        useConsumptionAggregate(params);
    const { data: boundaryData, isLoading: isBoundaryDataLoading } =
        useRegionalBoundaryDaily(boundaryDataParams);

    // Fetch daily data to get actual meter numbers
    const { data: bspDailyData } = useBspDaily({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        region: [regionProperCase],
    });

    const { data: dtxDailyData } = useDtxDaily({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        regions: [regionProperCase],
    });

    // Fetch district geometries for this region
    const { data: districtGeometriesData } =
        useDistrictsByRegion(regionProperCase);

    // Fetch all DTX meters for this region
    const { data: dtxMetersData } = useMeters({
        region: regionProperCase,
        meter_type: "DTX",
        limit: 10000,
    });

    // Fetch all BSP meters for this region
    const { data: bspMetersData } = useMeters({
        region: regionProperCase,
        meter_type: "BSP",
        limit: 5000,
    });

    // Fetch ALL REGIONAL_BOUNDARY meters — we filter client-side by region name
    const { data: allRegionalBoundaryMetersData } = useMeters({
        meter_type: "REGIONAL_BOUNDARY",
        limit: 5000,
    });

    // Derive relevant boundary meters by checking if boundary_metering_point contains the region name
    // e.g. "Central/Western" matches for both "Central" and "Western"
    const regionalBoundaryMetersData = useMemo(() => {
        if (!allRegionalBoundaryMetersData?.data?.data) return allRegionalBoundaryMetersData;
        const filtered = allRegionalBoundaryMetersData.data.data.filter((meter: any) => {
            const bmp = meter.boundary_metering_point || "";
            const parts = bmp.split("/").map((p: string) => p.trim().toLowerCase());
            return parts.includes(regionProperCase.toLowerCase());
        });
        return {
            ...allRegionalBoundaryMetersData,
            data: { ...allRegionalBoundaryMetersData.data, data: filtered },
        };
    }, [allRegionalBoundaryMetersData, regionProperCase]);

    // Derive the list of relevant boundary point strings from the filtered meters
    const relevantRegionalBoundaryPoints = useMemo(() => {
        if (!regionalBoundaryMetersData?.data?.data) return [];
        const points = new Set<string>();
        regionalBoundaryMetersData.data.data.forEach((meter: any) => {
            if (meter.boundary_metering_point) points.add(meter.boundary_metering_point);
        });
        return Array.from(points);
    }, [regionalBoundaryMetersData]);

    // Fetch DISTRICT_BOUNDARY meters for this region
    const { data: districtBoundaryMetersData } = useMeters({
        region: regionProperCase,
        meter_type: "DISTRICT_BOUNDARY",
        limit: 5000,
    });

    // Fetch DTX aggregate for all regions (for ranking)
    const { data: allRegionsAggregate } = useDtxAggregate({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        meterTypes: ["DTX"],
    });

    // Fetch meter health status for this region - DTX
    const { data: dtxHealthStatus } = useMeterStatusSummary({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        regions: [regionProperCase],
        meterTypes: ["DTX"],
    });

    // Fetch meter health status for BSP
    const { data: bspHealthStatus } = useMeterStatusSummary({
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
        regions: [regionProperCase],
        meterTypes: ["BSP"],
    });

    // Fetch ALL express feeder data without a region filter.
    // The API region filter matches only the sending_region, so inbound feeders
    // (sending_region = partner, receiving_region = this region) would be invisible.
    // We fetch everything and filter client-side in expressFeederMetrics below.
    const { data: expressFeederData, isLoading: expressFeederLoading } =
        useExpressFeederAggregate({
            dateFrom: dateRange.start,
            dateTo: dateRange.end,
        });



    // Fetch meter health status for REGIONAL_BOUNDARY — only when this region actually has boundary points.
    // If boundaryMeteringPoints is empty and we fire the query, the API returns ALL boundary meters globally,
    // producing false non-zero values for a region that has no boundary connections.
    const hasBoundaryPoints = relevantRegionalBoundaryPoints.length > 0;
    const { data: boundaryHealthStatus } = useMeterStatusSummary({
        dateFrom: hasBoundaryPoints ? dateRange.start : "",
        dateTo: hasBoundaryPoints ? dateRange.end : "",
        boundaryMeteringPoints: relevantRegionalBoundaryPoints,
        meterTypes: ["REGIONAL_BOUNDARY"],
    });

    // Process BSP data (import/supply) - BSP: region → station → meter
    const bspMetrics = useMemo(() => {
        if (!bspDailyData || !Array.isArray(bspDailyData)) {
            return {
                import: 0,
                export: 0,
                uniqueMeters: new Set(),
                byStation: new Map(),
            };
        }

        let totalImport = 0;
        let totalExport = 0;
        const uniqueMeters = new Set<string>();
        const byStation = new Map<
            string,
            { import: number; export: number; meters: Set<string> }
        >();

        // Process BSP daily data for consumption and meter numbers
        bspDailyData.forEach((record: any) => {
            if (record.region === regionProperCase) {
                const station = record.station || "Unknown Station";
                const consumption = record.consumed_energy || 0;
                const systemName = record.system_name || "";

                if (!byStation.has(station)) {
                    byStation.set(station, {
                        import: 0,
                        export: 0,
                        meters: new Set(),
                    });
                }
                const stationData = byStation.get(station)!;

                if (systemName === "import_kwh") {
                    totalImport += consumption;
                    stationData.import += consumption;
                } else if (systemName === "export_kwh") {
                    totalExport += consumption;
                    stationData.export += consumption;
                }

                // Track unique meters
                if (record.meter_number) {
                    uniqueMeters.add(record.meter_number);
                    stationData.meters.add(record.meter_number);
                }
            }
        });

        return {
            import: totalImport,
            export: totalExport,
            uniqueMeters,
            byStation,
        };
    }, [bspDailyData, regionProperCase]);

    // Process DTX data (distribution/consumption) - DTX: region → district → meter
    const dtxMetrics = useMemo(() => {
        if (!dtxDailyData || !Array.isArray(dtxDailyData)) {
            return { consumption: 0, uniqueMeters: new Set(), byDistrict: new Map() };
        }

        let totalConsumption = 0;
        const uniqueMeters = new Set<string>();
        const byDistrict = new Map<
            string,
            { consumption: number; meters: Set<string> }
        >();

        // Process DTX daily data — import only (exclude export records)
        dtxDailyData.forEach((record: any) => {
            if (record.region === regionProperCase && record.system_name === "import_kwh") {
                const district = record.district || "Unknown District";
                const consumption = record.consumed_energy || 0;

                totalConsumption += consumption;

                if (!byDistrict.has(district)) {
                    byDistrict.set(district, {
                        consumption: 0,
                        meters: new Set(),
                    });
                }
                const districtData = byDistrict.get(district)!;
                districtData.consumption += consumption;

                // Track unique meters
                if (record.meter_number) {
                    uniqueMeters.add(record.meter_number);
                    districtData.meters.add(record.meter_number);
                }
            }
        });

        return { consumption: totalConsumption, uniqueMeters, byDistrict };
    }, [dtxDailyData, regionProperCase]);

    // Process boundary data - Regional Boundary: boundary_metering_point → location → meter
    const boundaryMetrics = useMemo(() => {
        if (!boundaryData || !Array.isArray(boundaryData)) {
            return {
                imports: [],
                exports: [],
                totalImport: 0,
                totalExport: 0,
                uniqueMeters: new Set<string>(),
                byBoundaryPoint: new Map(),
            };
        }

        const importMap = new Map<
            string,
            {
                value: number;
                locations: Map<string, { value: number; meters: Set<string> }>;
            }
        >();
        const exportMap = new Map<
            string,
            {
                value: number;
                locations: Map<string, { value: number; meters: Set<string> }>;
            }
        >();
        let totalImport = 0;
        let totalExport = 0;
        const uniqueMeters = new Set<string>();

        boundaryData.forEach((record: any) => {
            const boundaryPoint = record.boundary_metering_point || "";
            const location = record.location || "Unknown Location";
            const parts = boundaryPoint.split("/").map((p: string) => p.trim());

            if (parts.length !== 2) return;

            const [leftRegion, rightRegion] = parts;
            const consumption = record.consumed_energy || 0;
            const systemName = record.system_name || "";

            // Track unique meters
            if (record.meter_number) {
                uniqueMeters.add(record.meter_number);
            }

            // The backend returns identical records for both regions — direction must be
            // resolved on the frontend using the boundary_metering_point convention:
            //   "Left/Right" means Left → Right is the net flow direction.
            //   import_kwh = energy flowing Left → Right (into the boundary point from Left)
            //   export_kwh = energy flowing Right → Left (back from Right to Left)
            //
            // Therefore:
            //   LEFT region:  import_kwh = their EXPORT (pushing out), export_kwh = their IMPORT (receiving back)
            //   RIGHT region: import_kwh = their IMPORT (receiving),   export_kwh = their EXPORT (pushing back)
            const isLeft = leftRegion.toLowerCase() === regionProperCase.toLowerCase();
            const isRight = rightRegion.toLowerCase() === regionProperCase.toLowerCase();

            if (!isLeft && !isRight) return;

            const partnerRegion = isLeft ? rightRegion : leftRegion;

            // Resolve which map to put this value in based on position
            const isThisRegionExporting =
                (isLeft && systemName === "import_kwh") ||
                (isRight && systemName === "export_kwh");
            const isThisRegionImporting =
                (isLeft && systemName === "export_kwh") ||
                (isRight && systemName === "import_kwh");

            const addToMap = (
                map: Map<string, { value: number; locations: Map<string, { value: number; meters: Set<string> }> }>,
            ) => {
                if (!map.has(partnerRegion)) {
                    map.set(partnerRegion, { value: 0, locations: new Map() });
                }
                const partnerData = map.get(partnerRegion)!;
                partnerData.value += consumption;
                if (!partnerData.locations.has(location)) {
                    partnerData.locations.set(location, { value: 0, meters: new Set() });
                }
                const locationData = partnerData.locations.get(location)!;
                locationData.value += consumption;
                if (record.meter_number) locationData.meters.add(record.meter_number);
            };

            if (isThisRegionExporting) {
                addToMap(exportMap);
                totalExport += consumption;
            } else if (isThisRegionImporting) {
                addToMap(importMap);
                totalImport += consumption;
            }
        });

        const imports = Array.from(importMap.entries())
            .map(([partner, data]) => ({
                partner,
                value: data.value,
                locations: data.locations,
            }))
            .sort((a, b) => b.value - a.value);

        const exports = Array.from(exportMap.entries())
            .map(([partner, data]) => ({
                partner,
                value: data.value,
                locations: data.locations,
            }))
            .sort((a, b) => b.value - a.value);

        return { imports, exports, totalImport, totalExport, uniqueMeters };
    }, [boundaryData, regionProperCase]);

    // Classify each feeder as inbound, outbound, or internal — exactly once.
    // A feeder where both stations share this region = "internal".
    // A cross-region feeder where the receiving station is here = "inbound".
    // A cross-region feeder where the sending station is here = "outbound".
    // If somehow neither station is here, skip it.
    const expressFeederMetrics = useMemo(() => {
        if (!expressFeederData?.feederBreakdown) {
            return { all: [], inbound: [], outbound: [], internal: [], inboundImport: 0, outboundExport: 0 };
        }

        const regionUpper = regionProperCase.toUpperCase();
        type Tagged = (typeof expressFeederData.feederBreakdown)[0] & {
            direction: "inbound" | "outbound" | "internal";
        };

        const all: Tagged[] = [];

        for (const f of expressFeederData.feederBreakdown) {
            const sendingHere = f.sendingMeter.region.toUpperCase() === regionUpper;
            const receivingHere = f.receivingMeter.region.toUpperCase() === regionUpper;

            if (sendingHere && receivingHere) {
                all.push({ ...f, direction: "internal" });
            } else if (receivingHere) {
                all.push({ ...f, direction: "inbound" });
            } else if (sendingHere) {
                all.push({ ...f, direction: "outbound" });
            }
            // if neither station is in this region the API shouldn't have returned it, skip
        }

        const inbound = all.filter((f) => f.direction === "inbound");
        const outbound = all.filter((f) => f.direction === "outbound");

        return {
            all,
            inbound,
            outbound,
            internal: all.filter((f) => f.direction === "internal"),
            inboundImport: inbound.reduce((s, f) => s + f.totalImport, 0),
            // Outbound = energy leaving this region = totalExport on the sending meter's side
            outboundExport: outbound.reduce((s, f) => s + f.totalExport, 0),
        };
    }, [expressFeederData, regionProperCase]);

    // Express feeder trading — groups inbound/outbound feeders by partner region → station
    // Inbound: energy entering this region = receivingMeter.importKwh, grouped by sendingMeter.region → sendingMeter.station
    // Outbound: energy leaving this region = sendingMeter.exportKwh, grouped by receivingMeter.region → receivingMeter.station
    const feederTrading = useMemo(() => {
        type StationEntry = { station: string; feeders: { name: string; kwh: number; meterNumber: string }[]; total: number };
        type RegionEntry = { region: string; stations: Map<string, StationEntry>; total: number };

        const inboundByRegion = new Map<string, RegionEntry>();
        for (const f of expressFeederMetrics.inbound) {
            const regionKey = f.sendingMeter.region || "Unknown";
            const stationKey = f.sendingMeter.station || "Unknown";
            const kwh = f.receivingMeter.importKwh;

            if (!inboundByRegion.has(regionKey)) {
                inboundByRegion.set(regionKey, { region: regionKey, stations: new Map(), total: 0 });
            }
            const regionEntry = inboundByRegion.get(regionKey)!;
            regionEntry.total += kwh;

            if (!regionEntry.stations.has(stationKey)) {
                regionEntry.stations.set(stationKey, { station: stationKey, feeders: [], total: 0 });
            }
            const stationEntry = regionEntry.stations.get(stationKey)!;
            stationEntry.total += kwh;
            stationEntry.feeders.push({ name: f.feederName, kwh, meterNumber: f.sendingMeter.stationCode || f.sendingMeter.sapVersion });
        }

        const outboundByRegion = new Map<string, RegionEntry>();
        for (const f of expressFeederMetrics.outbound) {
            const regionKey = f.receivingMeter.region || "Unknown";
            const stationKey = f.receivingMeter.station || "Unknown";
            const kwh = f.sendingMeter.exportKwh;

            if (!outboundByRegion.has(regionKey)) {
                outboundByRegion.set(regionKey, { region: regionKey, stations: new Map(), total: 0 });
            }
            const regionEntry = outboundByRegion.get(regionKey)!;
            regionEntry.total += kwh;

            if (!regionEntry.stations.has(stationKey)) {
                regionEntry.stations.set(stationKey, { station: stationKey, feeders: [], total: 0 });
            }
            const stationEntry = regionEntry.stations.get(stationKey)!;
            stationEntry.total += kwh;
            stationEntry.feeders.push({ name: f.feederName, kwh, meterNumber: f.receivingMeter.stationCode || f.receivingMeter.sapVersion });
        }

        const inbound = Array.from(inboundByRegion.values()).sort((a, b) => b.total - a.total);
        const outbound = Array.from(outboundByRegion.values()).sort((a, b) => b.total - a.total);
        const totalInbound = inbound.reduce((s, r) => s + r.total, 0);
        const totalOutbound = outbound.reduce((s, r) => s + r.total, 0);

        return { inbound, outbound, totalInbound, totalOutbound };
    }, [expressFeederMetrics]);



    // Energy flow calculations
    const energyFlow = useMemo(() => {
        const bspImport = bspMetrics.import;
        const outgoing = 0;
        const boundaryNet = boundaryMetrics.totalImport - boundaryMetrics.totalExport;
        const expressNet = expressFeederMetrics.inboundImport - expressFeederMetrics.outboundExport;
        const availableSupply = bspImport + outgoing + boundaryNet + expressNet;
        const dtxConsumption = dtxMetrics.consumption;

        return {
            bspImport,
            outgoing,
            boundaryImport: boundaryMetrics.totalImport,
            boundaryExport: boundaryMetrics.totalExport,
            boundaryNet,
            expressFeederInbound: expressFeederMetrics.inboundImport,
            expressFeederOutbound: expressFeederMetrics.outboundExport,
            expressFeederExport: expressFeederMetrics.outboundExport,
            expressNet,
            availableSupply,
            dtxConsumption,
        };
    }, [bspMetrics, boundaryMetrics, dtxMetrics, expressFeederMetrics]);

    // Enhanced analytics
    const analytics = useMemo(() => {
        const totalSupply = energyFlow.bspImport + energyFlow.boundaryImport;
        const selfSufficiency =
            totalSupply > 0 ? (energyFlow.bspImport / totalSupply) * 100 : 0;
        const importDependency =
            totalSupply > 0 ? (energyFlow.boundaryImport / totalSupply) * 100 : 0;
        const exportCapacity =
            energyFlow.bspImport > 0
                ? (energyFlow.boundaryExport / energyFlow.bspImport) * 100
                : 0;
        const coverageRate =
            energyFlow.availableSupply > 0
                ? (energyFlow.dtxConsumption / energyFlow.availableSupply) * 100
                : 0;
        const netPosition =
            energyFlow.boundaryNet > 0
                ? "Net Importer"
                : energyFlow.boundaryNet < 0
                    ? "Net Exporter"
                    : "Balanced";

        return {
            selfSufficiency,
            importDependency,
            exportCapacity,
            coverageRate,
            netPosition,
        };
    }, [energyFlow]);

    // Peak analysis
    const peakAnalysis = useMemo(() => {
        if (!aggregateData?.rawData || !Array.isArray(aggregateData.rawData)) {
            return {
                peakBspDay: null,
                peakDtxDay: null,
                peakImportDay: null,
                peakExportDay: null,
            };
        }

        const dateMetrics = new Map<
            string,
            { bsp: number; dtx: number; import: number; export: number }
        >();

        aggregateData.rawData.forEach((record: any) => {
            if (record.region !== regionProperCase) return;
            const date = record.group_period?.split("T")[0];
            if (!date) return;

            if (!dateMetrics.has(date)) {
                dateMetrics.set(date, { bsp: 0, dtx: 0, import: 0, export: 0 });
            }
            const metrics = dateMetrics.get(date)!;

            if (record.meter_type === "BSP" && record.system_name === "import_kwh") {
                metrics.bsp += record.total_consumption || 0;
            } else if (record.meter_type === "DTX") {
                metrics.dtx += record.total_consumption || 0;
            }
        });

        // Add boundary data
        if (boundaryData && Array.isArray(boundaryData)) {
            boundaryData.forEach((record: any) => {
                const date = record.consumption_date?.split("T")[0];
                if (!date) return;

                if (!dateMetrics.has(date)) {
                    dateMetrics.set(date, { bsp: 0, dtx: 0, import: 0, export: 0 });
                }
                const metrics = dateMetrics.get(date)!;

                const boundaryPoint = record.boundary_metering_point || "";
                const parts = boundaryPoint.split("/").map((p: string) => p.trim());
                if (parts.length !== 2) return;

                const [leftRegion, rightRegion] = parts;
                const consumption = record.consumed_energy || 0;
                const systemName = record.system_name || "";

                if (
                    leftRegion.toLowerCase() === regionProperCase.toLowerCase() &&
                    systemName === "export_kwh"
                ) {
                    metrics.export += consumption;
                } else if (
                    rightRegion.toLowerCase() === regionProperCase.toLowerCase() &&
                    systemName === "import_kwh"
                ) {
                    metrics.import += consumption;
                }
            });
        }

        let peakBspDay: { date: string; value: number } | null = null;
        let peakDtxDay: { date: string; value: number } | null = null;
        let peakImportDay: { date: string; value: number } | null = null;
        let peakExportDay: { date: string; value: number } | null = null;

        dateMetrics.forEach((metrics, date) => {
            if (!peakBspDay || metrics.bsp > peakBspDay.value) {
                peakBspDay = { date, value: metrics.bsp };
            }
            if (!peakDtxDay || metrics.dtx > peakDtxDay.value) {
                peakDtxDay = { date, value: metrics.dtx };
            }
            if (!peakImportDay || metrics.import > peakImportDay.value) {
                peakImportDay = { date, value: metrics.import };
            }
            if (!peakExportDay || metrics.export > peakExportDay.value) {
                peakExportDay = { date, value: metrics.export };
            }
        });

        return { peakBspDay, peakDtxDay, peakImportDay, peakExportDay };
    }, [aggregateData, boundaryData, regionProperCase]);

    // Daily trend data with all metrics
    const dailyData = useMemo(() => {
        if (!aggregateData?.rawData || !Array.isArray(aggregateData.rawData))
            return [];

        const dateMap = new Map<string, { bsp: number; dtx: number }>();

        // Process aggregate data
        aggregateData.rawData.forEach((record: any) => {
            if (record.region !== regionProperCase) return;

            const date = record.group_period?.split("T")[0];
            if (!date) return;

            if (!dateMap.has(date)) {
                dateMap.set(date, { bsp: 0, dtx: 0 });
            }

            const data = dateMap.get(date)!;
            if (record.meter_type === "BSP" && record.system_name === "import_kwh") {
                data.bsp += record.total_consumption || 0;
            } else if (record.meter_type === "DTX") {
                data.dtx += record.total_consumption || 0;
            }
        });

        // Process boundary data by date
        const boundaryDateMap = new Map<
            string,
            { import: number; export: number }
        >();
        if (boundaryData && Array.isArray(boundaryData)) {
            boundaryData.forEach((record: any) => {
                const boundaryPoint = record.boundary_metering_point || "";
                const parts = boundaryPoint.split("/").map((p: string) => p.trim());
                if (parts.length !== 2) return;

                const [leftRegion, rightRegion] = parts;
                const date = record.consumption_date?.split("T")[0];
                if (!date) return;

                if (!boundaryDateMap.has(date)) {
                    boundaryDateMap.set(date, { import: 0, export: 0 });
                }

                const boundaryDayData = boundaryDateMap.get(date)!;
                const consumption = record.consumed_energy || 0;

                if (
                    leftRegion.toLowerCase() === regionProperCase.toLowerCase() &&
                    record.system_name === "export_kwh"
                ) {
                    boundaryDayData.export += consumption;
                } else if (
                    rightRegion.toLowerCase() === regionProperCase.toLowerCase() &&
                    record.system_name === "import_kwh"
                ) {
                    boundaryDayData.import += consumption;
                }
            });
        }

        return Array.from(dateMap.entries())
            .map(([date, data]) => {
                const boundaryDay = boundaryDateMap.get(date) || {
                    import: 0,
                    export: 0,
                };
                const availableSupply =
                    data.bsp + boundaryDay.import - boundaryDay.export;
                const net =
                    data.bsp + boundaryDay.import - boundaryDay.export - data.dtx;

                return {
                    date,
                    formattedDate: format(parseISO(date), "MMM d"),
                    bsp: data.bsp,
                    dtx: data.dtx,
                    boundaryImport: boundaryDay.import,
                    boundaryExport: boundaryDay.export,
                    availableSupply,
                    net,
                };
            })
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [aggregateData, boundaryData, regionProperCase]);

    const toggleDistrict = (district: string) => {
        setExpandedDistricts((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(district)) {
                newSet.delete(district);
            } else {
                newSet.add(district);
            }
            return newSet;
        });
    };

    const toggleStation = (station: string) => {
        setExpandedStations((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(station)) {
                newSet.delete(station);
            } else {
                newSet.add(station);
            }
            return newSet;
        });
    };

    const toggleBoundary = (partner: string) => {
        setExpandedBoundaries((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(partner)) {
                newSet.delete(partner);
            } else {
                newSet.add(partner);
            }
            return newSet;
        });
    };

    // Extract meter coordinates for map display - SIMPLIFIED VERSION
    const meterCoordinates = useMemo(() => {
        console.log("=== Building meterCoordinates ===");
        console.log("[v0] Backend API Responses:");
        console.log("[v0] BSP meters data:", bspMetersData?.data?.data?.length || 0, "meters");
        console.log("[v0] DTX meters data:", dtxMetersData?.data?.data?.length || 0, "meters");
        console.log("[v0] Regional Boundary meters data:", regionalBoundaryMetersData?.data?.data?.length || 0, "meters");
        console.log("[v0] District Boundary meters data:", districtBoundaryMetersData?.data?.data?.length || 0, "meters");

        // Log sample data from each API
        if (bspMetersData?.data?.data?.[0]) {
            console.log("[v0] Sample BSP meter from API:", {
                meter_number: bspMetersData.data.data[0].meter_number,
                meter_type: bspMetersData.data.data[0].meter_type,
                station: bspMetersData.data.data[0].station,
                latitude: bspMetersData.data.data[0].latitude,
                longitude: bspMetersData.data.data[0].longitude,
            });
        }
        if (dtxMetersData?.data?.data?.[0]) {
            console.log("[v0] Sample DTX meter from API:", {
                meter_number: dtxMetersData.data.data[0].meter_number,
                meter_type: dtxMetersData.data.data[0].meter_type,
                district: dtxMetersData.data.data[0].district,
                latitude: dtxMetersData.data.data[0].latitude,
                longitude: dtxMetersData.data.data[0].longitude,
            });
        }
        if (regionalBoundaryMetersData?.data?.data?.[0]) {
            console.log("[v0] Sample Regional Boundary meter from API:", {
                meter_number: regionalBoundaryMetersData.data.data[0].meter_number,
                meter_type: regionalBoundaryMetersData.data.data[0].meter_type,
                boundary_metering_point: regionalBoundaryMetersData.data.data[0].boundary_metering_point,
                latitude: regionalBoundaryMetersData.data.data[0].latitude,
                longitude: regionalBoundaryMetersData.data.data[0].longitude,
            });
        }
        if (districtBoundaryMetersData?.data?.data?.[0]) {
            console.log("[v0] Sample District Boundary meter from API:", {
                meter_number: districtBoundaryMetersData.data.data[0].meter_number,
                meter_type: districtBoundaryMetersData.data.data[0].meter_type,
                district: districtBoundaryMetersData.data.data[0].district,
                latitude: districtBoundaryMetersData.data.data[0].latitude,
                longitude: districtBoundaryMetersData.data.data[0].longitude,
            });
        }

        const coords: Array<{
            lat: number;
            lng: number;
            type: string;
            meter_number: string;
            brand?: string;
            station?: string;
            boundary_metering_point?: string;
        }> = [];

        // Helper to validate coordinates
        const isValidCoord = (lat: any, lng: any) => {
            return (
                lat &&
                lng &&
                typeof lat === "number" &&
                typeof lng === "number" &&
                lat !== 0 &&
                lng !== 0 &&
                Math.abs(lat) <= 90 &&
                Math.abs(lng) <= 180
            );
        };

        // Add BSP meters - DON'T deduplicate, let RegionMiniMap handle grouping
        if (bspMetersData?.data?.data) {
            console.log(`[v0] Processing ${bspMetersData.data.data.length} BSP meters from backend`);

            bspMetersData.data.data.forEach((meter: any, idx: number) => {
                if (isValidCoord(meter.latitude, meter.longitude)) {
                    const backendType = meter.meter_type || "BSP";
                    if (idx < 3) {
                        console.log(`[v0] BSP query meter ${idx + 1}: API meter_type="${meter.meter_type}" → Using type="${backendType}"`);
                    }
                    coords.push({
                        lat: meter.latitude,
                        lng: meter.longitude,
                        type: backendType,
                        meter_number: meter.meter_number,
                        brand: meter.meter_brand,
                        station: meter.station,
                    });
                }
            });
            console.log(`[v0] Added ${coords.filter(c => c.type === "BSP").length} BSP meters to map`);
        }

        // Add DTX meters - only those that DON'T share coordinates with BSP
        const bspCoordSet = new Set(
            coords
                .filter((c) => c.type === "BSP")
                .map((c) => `${c.lat.toFixed(6)},${c.lng.toFixed(6)}`),
        );

        if (dtxMetersData?.data?.data) {
            console.log(`[v0] Processing ${dtxMetersData.data.data.length} DTX meters from backend`);

            const dtxAdded = new Set<string>();
            let dtxSampleCount = 0;

            dtxMetersData.data.data.forEach((meter: any) => {
                if (isValidCoord(meter.latitude, meter.longitude)) {
                    const coordKey = `${meter.latitude.toFixed(6)},${meter.longitude.toFixed(6)}`;

                    // Skip if BSP exists at this location
                    if (bspCoordSet.has(coordKey)) {
                        console.warn(
                            `[v0] ⚠️ Skipping DTX ${meter.meter_number} - BSP exists at [${meter.latitude}, ${meter.longitude}]`,
                        );
                        return;
                    }

                    // Skip if we already added a DTX at this location
                    if (dtxAdded.has(coordKey)) {
                        return;
                    }

                    const backendType = meter.meter_type || "DTX";
                    if (dtxSampleCount < 3) {
                        console.log(`[v0] DTX query meter ${dtxSampleCount + 1}: API meter_type="${meter.meter_type}" → Using type="${backendType}"`);
                        dtxSampleCount++;
                    }

                    coords.push({
                        lat: meter.latitude,
                        lng: meter.longitude,
                        type: backendType,
                        meter_number: meter.meter_number,
                        brand: meter.meter_brand,
                    });

                    dtxAdded.add(coordKey);
                }
            });

            console.log(`[v0] Added ${dtxAdded.size} DTX meters to map`);
        }

        // Add REGIONAL_BOUNDARY meters
        if (regionalBoundaryMetersData?.data?.data) {
            console.log(
                `[v0] Processing ${regionalBoundaryMetersData.data.data.length} REGIONAL_BOUNDARY meters from backend`,
            );

            const boundaryAdded = new Set<string>();
            let rbSampleCount = 0;

            regionalBoundaryMetersData.data.data.forEach((meter: any) => {
                // Client-side filter: only include meters where boundary_metering_point contains this region
                const boundaryPoint = meter.boundary_metering_point || "";
                const parts = boundaryPoint.split("/").map((p: string) => p.trim());
                const belongsToRegion = parts.some((part: string) => part.toLowerCase() === regionProperCase.toLowerCase());

                if (!belongsToRegion) {
                    return; // Skip this meter - it belongs to the other region in the boundary
                }

                if (isValidCoord(meter.latitude, meter.longitude)) {
                    const coordKey = `${meter.latitude.toFixed(6)},${meter.longitude.toFixed(6)}`;

                    if (boundaryAdded.has(coordKey)) {
                        return;
                    }

                    const backendType = meter.meter_type || "REGIONAL_BOUNDARY";
                    if (rbSampleCount < 3) {
                        console.log(`[v0] Regional Boundary query meter ${rbSampleCount + 1}: boundary_point="${meter.boundary_metering_point}", API meter_type="${meter.meter_type}" → Using type="${backendType}"`);
                        rbSampleCount++;
                    }

                    coords.push({
                        lat: meter.latitude,
                        lng: meter.longitude,
                        type: backendType,
                        meter_number: meter.meter_number,
                        brand: meter.meter_brand,
                        boundary_metering_point: meter.boundary_metering_point,
                    });

                    boundaryAdded.add(coordKey);
                }
            });

            console.log(
                `[v0] Added ${boundaryAdded.size} REGIONAL_BOUNDARY meters to map`,
            );
        }

        console.log(`Total coords: ${coords.length}`);
        console.log("By type:", {
            BSP: coords.filter((c) => c.type === "BSP").length,
            DTX: coords.filter((c) => c.type === "DTX").length,
            REGIONAL_BOUNDARY: coords.filter((c) => c.type === "REGIONAL_BOUNDARY")
                .length,
        });

        return coords;
    }, [dtxMetersData, bspMetersData, regionalBoundaryMetersData]);

    const regionProfile = useMemo(() => {
        const totalDistricts = districtGeometriesData?.data?.districts?.length || 0;
        const regionalDistricts = districtGeometriesData?.data?.districts || [];

        // Use meter health status for total counts (all meters, not just those with coordinates)
        const totalDtxMeters =
            (dtxHealthStatus?.online || 0) + (dtxHealthStatus?.total_offline || 0);
        const totalBspMeters =
            (bspHealthStatus?.online || 0) + (bspHealthStatus?.total_offline || 0);
        // If no boundary points match this region, count must be 0 — don't trust the API
        // response which may return all boundary meters when passed an empty array
        const totalBoundaryMeters = relevantRegionalBoundaryPoints.length === 0
            ? 0
            : (boundaryHealthStatus?.online || 0) + (boundaryHealthStatus?.total_offline || 0);

        // Count unique stations from BSP meters with coordinates (for station display)
        const uniqueStations = new Set<string>();
        meterCoordinates.forEach((m) => {
            if (m.type === "BSP" && m.station) {
                uniqueStations.add(m.station);
            }
        });
        const totalBspStations = uniqueStations.size;

        return {
            totalDistricts,
            regionalDistricts,
            totalDtxMeters,
            totalBspMeters,
            totalBspStations,
            totalBoundaryMeters,
            totalMeters: totalDtxMeters + totalBspMeters + totalBoundaryMeters,
        };
    }, [
        districtGeometriesData,
        dtxHealthStatus,
        bspHealthStatus,
        boundaryHealthStatus,
        meterCoordinates,
        relevantRegionalBoundaryPoints,
    ]);

    // District performance ranking within region
    const districtRankings = useMemo(() => {
        const rankings = Array.from(dtxMetrics.byDistrict.entries())
            .map(([district, data]) => ({
                district,
                consumption: data.consumption,
                meters: data.meters.size,
            }))
            .sort((a, b) => b.consumption - a.consumption);

        return rankings;
    }, [dtxMetrics]);

    // Region performance ranking
    const regionRanking = useMemo(() => {
        if (!allRegionsAggregate?.byRegion) return null;

        const regions = allRegionsAggregate.byRegion
            .map((r: any) => ({
                region: r.region,
                consumption: r.importKwh || 0,
            }))
            .sort((a, b) => b.consumption - a.consumption);

        const currentIndex = regions.findIndex(
            (r) => r.region === regionProperCase,
        );
        const currentRegion = regions[currentIndex];

        return {
            rank: currentIndex + 1,
            total: regions.length,
            consumption: currentRegion?.consumption || 0,
            percentile: ((regions.length - currentIndex) / regions.length) * 100,
            topRegions: regions.slice(0, 5),
        };
    }, [allRegionsAggregate, regionProperCase]);

    // Prepare district geometries with consumption data for map
    const districtGeometriesWithConsumption = useMemo(() => {
        if (!districtGeometriesData?.data?.districts) return [];

        return districtGeometriesData.data.districts.map((district) => {
            const districtData = dtxMetrics.byDistrict.get(district.district);
            return {
                district: district.district,
                geometry: district.geojson?.geometry,
                consumption: districtData?.consumption || 0,
            };
        });
    }, [districtGeometriesData, dtxMetrics]);

    if (aggregateLoading || isBoundaryDataLoading) {
        return (
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-32" />
                        <Skeleton className="h-9 w-52" />
                        <Skeleton className="h-4 w-44" />
                    </div>
                    <Skeleton className="h-10 w-32 rounded-full" />
                </div>

                {/* Tabs card */}
                <Card>
                    <CardContent className="pt-6">
                        {/* Tab bar — 3 tabs */}
                        <Skeleton className="h-10 w-full rounded-md mb-6" />
                        {/* 4 summary metric cards */}
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <Card key={i}>
                                    <CardHeader className="pb-2">
                                        <Skeleton className="h-4 w-28" />
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <Skeleton className="h-8 w-36" />
                                        <Skeleton className="h-px w-full" />
                                        <Skeleton className="h-3 w-24" />
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Energy flow diagram card */}
                <Card>
                    <CardHeader>
                        <Skeleton className="h-5 w-44" />
                        <Skeleton className="h-4 w-64" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-64 w-full rounded-md" />
                    </CardContent>
                </Card>

                {/* Daily trend chart card */}
                <Card>
                    <CardHeader>
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-4 w-56" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-72 w-full rounded-md" />
                    </CardContent>
                </Card>

                {/* Districts table card */}
                <Card>
                    <CardHeader>
                        <Skeleton className="h-5 w-32" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-10 w-full rounded-md" />
                        ))}
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <Link href="/regions">
                        <Button variant="outline" size="sm" className="mb-2 bg-transparent">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Regions
                        </Button>
                    </Link>
                    <h1 className="text-3xl font-bold">{toProperCase(region)} Region</h1>
                    <p className="text-muted-foreground">
                        {format(parseISO(dateRange.start), "MMM d, yyyy")} -{" "}
                        {format(parseISO(dateRange.end), "MMM d, yyyy")}
                    </p>
                </div>
                <Badge
                    variant={
                        analytics.netPosition === "Net Importer"
                            ? "default"
                            : analytics.netPosition === "Net Exporter"
                                ? "secondary"
                                : "outline"
                    }
                    className="text-lg px-4 py-2"
                >
                    {analytics.netPosition}
                </Badge>
            </div>

            {/* Metrics Tabs - Replace Carousel */}
            <Card>
                <CardContent className="pt-6">
                    <Tabs defaultValue="summary" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 mb-6">
                            <TabsTrigger
                                value="summary"
                                className="data-[state=active]:text-blue-600 data-[state=active]:border-blue-600"
                            >
                                Summary Metrics
                            </TabsTrigger>

                            <TabsTrigger
                                value="peaks"
                                className="data-[state=active]:text-amber-600 data-[state=active]:border-amber-600"
                            >
                                Energy Peaks
                            </TabsTrigger>

                            <TabsTrigger
                                value="express-feeders"
                                className="data-[state=active]:text-purple-600 data-[state=active]:border-purple-600"
                            >
                                Express Feeders
                            </TabsTrigger>
                        </TabsList>

                        {/* Tab 1: Summary Metrics */}
                        <TabsContent
                            value="summary"
                            className="border-2 border-blue-600 bg-blue-200 rounded-md p-4"
                        >
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            BSP Import
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">
                                            {formatNumber(energyFlow.bspImport)}
                                        </div>

                                        <div className="h-px bg-border my-2"></div>

                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <span>kwh</span>
                                            <span className="font-bold">·</span>
                                            <span>{bspMetrics.uniqueMeters.size} unique meters</span>
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            Boundary Exchange
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-baseline gap-3 flex-wrap">
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <ArrowDownIcon className="h-4 w-4 text-green-600" />
                                                    <span className="text-xl font-bold text-green-600">
                              {formatNumber(energyFlow.boundaryImport)}
                            </span>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground">Import (kWh)</p>
                                            </div>
                                            <div className="h-8 w-px bg-border" />
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <ArrowUpIcon className="h-4 w-4 text-orange-500" />
                                                    <span className="text-xl font-bold text-orange-500">
                              {formatNumber(energyFlow.boundaryExport)}
                            </span>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground">Export (kWh)</p>
                                            </div>
                                            <div className="h-8 w-px bg-border" />
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    {energyFlow.boundaryNet >= 0 ? (
                                                        <ArrowDownIcon className="h-4 w-4 text-blue-600" />
                                                    ) : (
                                                        <ArrowUpIcon className="h-4 w-4 text-red-500" />
                                                    )}
                                                    <span className={`text-xl font-bold ${energyFlow.boundaryNet >= 0 ? "text-blue-600" : "text-red-500"}`}>
                              {formatNumber(Math.abs(energyFlow.boundaryNet))}
                            </span>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground">
                                                    Net ({energyFlow.boundaryNet >= 0 ? "Import" : "Export"}) (kWh)
                                                </p>
                                            </div>
                                        </div>

                                        <div className="h-px bg-border my-2"></div>

                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <span>
                          {boundaryMetrics.uniqueMeters.size} unique meters
                        </span>
                                            <span className="font-bold">·</span>
                                            <span>
                          {boundaryMetrics.imports.length + boundaryMetrics.exports.length} exchange regions
                        </span>
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            Available Supply
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">
                                            {formatNumber(energyFlow.availableSupply)}
                                        </div>

                                        <div className="h-px bg-border my-2"></div>

                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <span>kWh</span>
                                            <span className="font-bold">·</span>
                                            <span>(BSP Import + Boundary Net)</span>
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            DTX Import
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">
                                            {formatNumber(energyFlow.dtxConsumption)}
                                        </div>

                                        <div className="h-px bg-border my-2"></div>

                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <span>kwh</span>
                                            <span className="font-bold">·</span>
                                            <span>{dtxMetrics.uniqueMeters.size} unique meters</span>
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        {/* Tab 2: Peak Analysis */}
                        <TabsContent
                            value="peaks"
                            className="border-2 border-amber-600 bg-amber-200 rounded-md p-4"
                        >
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            Peak BSP Day
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">
                                            {formatNumber(peakAnalysis.peakBspDay?.value || 0)} kWh
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {peakAnalysis.peakBspDay
                                                ? format(
                                                    parseISO(peakAnalysis.peakBspDay.date),
                                                    "MMM d, yyyy",
                                                )
                                                : "N/A"}
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            Peak DTX Day
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">
                                            {formatNumber(peakAnalysis.peakDtxDay?.value || 0)} kWh
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {peakAnalysis.peakDtxDay
                                                ? format(
                                                    parseISO(peakAnalysis.peakDtxDay.date),
                                                    "MMM d, yyyy",
                                                )
                                                : "N/A"}
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            Peak Import Day
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">
                                            {formatNumber(peakAnalysis.peakImportDay?.value || 0)} kWh
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {peakAnalysis.peakImportDay
                                                ? format(
                                                    parseISO(peakAnalysis.peakImportDay.date),
                                                    "MMM d, yyyy",
                                                )
                                                : "N/A"}
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">
                                            Peak Export Day
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">
                                            {formatNumber(peakAnalysis.peakExportDay?.value || 0)} kWh
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {peakAnalysis.peakExportDay
                                                ? format(
                                                    parseISO(peakAnalysis.peakExportDay.date),
                                                    "MMM d, yyyy",
                                                )
                                                : "N/A"}
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        {/* Tab 3: Express Feeders */}
                        <TabsContent
                            value="express-feeders"
                            className="border-2 border-purple-600 bg-purple-50 rounded-md p-4"
                        >
                            <div className="space-y-6">
                                {/* Express Feeder Summary */}
                                <div className="grid gap-4 md:grid-cols-2">
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                                <ArrowDownIcon className="h-4 w-4 text-purple-600" />
                                                Inbound Express Feeders
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold text-purple-600">
                                                {formatNumber(expressFeederMetrics.inboundImport)} kWh
                                            </div>
                                            <div className="text-sm text-muted-foreground mt-1">
                                                {expressFeederMetrics.inbound.length} feeder{expressFeederMetrics.inbound.length !== 1 ? "s" : ""} receiving into this region
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                                <ArrowUpIcon className="h-4 w-4 text-orange-600" />
                                                Outbound Express Feeders
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold text-orange-600">
                                                {formatNumber(expressFeederMetrics.outboundExport)} kWh
                                            </div>
                                            <div className="text-sm text-muted-foreground mt-1">
                                                {expressFeederMetrics.outbound.length} feeder{expressFeederMetrics.outbound.length !== 1 ? "s" : ""} sending out of this region
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Combined Feeders Table — one row per feeder, no duplicates */}
                                {expressFeederMetrics.all.length > 0 ? (
                                    <Card>
                                        <CardHeader>
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <CardTitle className="text-base flex items-center gap-2">
                                                        <Zap className="h-4 w-4" />
                                                        Express Feeders
                                                    </CardTitle>
                                                    <CardDescription className="mt-1">
                                                        {expressFeederMetrics.all.length} feeder{expressFeederMetrics.all.length !== 1 ? "s" : ""} connected to {regionProperCase}. Each feeder has one sending meter and one receiving meter.
                                                    </CardDescription>
                                                </div>
                                                <div className="relative w-56 shrink-0">
                                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                                                    <Input
                                                        placeholder="Filter by feeder name..."
                                                        value={feederSearch}
                                                        onChange={(e) => {
                                                            setFeederSearch(e.target.value);
                                                            setFeederPage(0);
                                                        }}
                                                        className="pl-8 h-9 text-sm"
                                                    />
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            {(() => {
                                                const filtered = [...expressFeederMetrics.all]
                                                    .filter((f) =>
                                                        feederSearch === "" ||
                                                        f.feederName.toLowerCase().includes(feederSearch.toLowerCase())
                                                    )
                                                    .sort((a, b) => a.feederName.localeCompare(b.feederName));
                                                const totalPages = Math.ceil(filtered.length / feederPageSize);
                                                const pageRows = filtered.slice(feederPage * feederPageSize, (feederPage + 1) * feederPageSize);

                                                return (
                                                    <>
                                                        <div className="overflow-auto">
                                                            <Table>
                                                                <TableHeader className="sticky top-0 bg-background z-10">
                                                                    <TableRow>
                                                                        <TableHead className="w-8">#</TableHead>
                                                                        <TableHead>Feeder</TableHead>
                                                                        <TableHead>Direction</TableHead>
                                                                        <TableHead>Route</TableHead>
                                                                        <TableHead className="text-center border-l bg-green-50/50" colSpan={3}>
                                                                            <span className="text-green-800 text-xs font-semibold">Sending Meter</span>
                                                                        </TableHead>
                                                                        <TableHead className="text-center border-l bg-blue-50/50" colSpan={3}>
                                                                            <span className="text-blue-800 text-xs font-semibold">Receiving Meter</span>
                                                                        </TableHead>
                                                                        <TableHead className="text-right border-l">Total Import</TableHead>
                                                                        <TableHead className="text-right">Total Export</TableHead>
                                                                        <TableHead className="text-right">Net kWh</TableHead>
                                                                    </TableRow>
                                                                    <TableRow className="bg-muted/30">
                                                                        <TableHead />
                                                                        <TableHead />
                                                                        <TableHead />
                                                                        <TableHead />
                                                                        <TableHead className="text-right text-[11px] text-green-700 border-l">Import</TableHead>
                                                                        <TableHead className="text-right text-[11px] text-green-700">Export</TableHead>
                                                                        <TableHead className="text-right text-[11px] text-green-700">Net</TableHead>
                                                                        <TableHead className="text-right text-[11px] text-blue-700 border-l">Import</TableHead>
                                                                        <TableHead className="text-right text-[11px] text-blue-700">Export</TableHead>
                                                                        <TableHead className="text-right text-[11px] text-blue-700">Net</TableHead>
                                                                        <TableHead className="border-l" />
                                                                        <TableHead />
                                                                        <TableHead />
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {pageRows.length === 0 ? (
                                                                        <TableRow>
                                                                            <TableCell colSpan={13} className="text-center text-muted-foreground py-8">
                                                                                No feeders match &quot;{feederSearch}&quot;
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ) : (
                                                                        pageRows.map((feeder, idx) => (
                                                                            <TableRow key={feeder.feederName}>
                                                                                <TableCell className="text-muted-foreground text-sm">
                                                                                    {feederPage * feederPageSize + idx + 1}
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <Link
                                                                                        href={`/express-feeders/${encodeURIComponent(feeder.feederName)}`}
                                                                                        className="font-medium text-sm text-blue-600 hover:underline"
                                                                                    >
                                                                                        {feeder.feederName}
                                                                                    </Link>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    {feeder.direction === "inbound" ? (
                                                                                        <Badge variant="outline" className="text-purple-700 border-purple-400 bg-purple-50">
                                                                                            <ArrowDownIcon className="h-3 w-3 mr-1" />
                                                                                            Inbound
                                                                                        </Badge>
                                                                                    ) : feeder.direction === "outbound" ? (
                                                                                        <Badge variant="outline" className="text-orange-700 border-orange-400 bg-orange-50">
                                                                                            <ArrowUpIcon className="h-3 w-3 mr-1" />
                                                                                            Outbound
                                                                                        </Badge>
                                                                                    ) : (
                                                                                        <Badge variant="outline" className="text-gray-600 border-gray-400 bg-gray-50">
                                                                                            Internal
                                                                                        </Badge>
                                                                                    )}
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <div className="flex items-center gap-1 text-xs">
                                                                                        <div className="text-right">
                                                                                            <div className="font-medium">{feeder.sendingMeter.station}</div>
                                                                                            <div className="text-muted-foreground">{feeder.sendingMeter.region}</div>
                                                                                        </div>
                                                                                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                                                                        <div>
                                                                                            <div className="font-medium">{feeder.receivingMeter.station}</div>
                                                                                            <div className="text-muted-foreground">{feeder.receivingMeter.region}</div>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="text-xs text-muted-foreground font-mono mt-1">
                                                                                        {feeder.sendingMeter.meterNumber || "NO METER"} / {feeder.receivingMeter.meterNumber || "NO METER"}
                                                                                    </div>
                                                                                </TableCell>
                                                                                {/* Sending meter */}
                                                                                <TableCell className="text-right tabular-nums text-green-700 font-semibold border-l text-xs">
                                                                                    {formatNumber(feeder.sendingMeter.importKwh)}
                                                                                </TableCell>
                                                                                <TableCell className="text-right tabular-nums text-blue-700 font-semibold text-xs">
                                                                                    {formatNumber(feeder.sendingMeter.exportKwh)}
                                                                                </TableCell>
                                                                                <TableCell className={`text-right tabular-nums font-bold text-xs ${feeder.sendingMeter.netKwh >= 0 ? "text-green-700" : "text-red-600"}`}>
                                                                                    {formatNumber(feeder.sendingMeter.netKwh)}
                                                                                </TableCell>
                                                                                {/* Receiving meter */}
                                                                                <TableCell className="text-right tabular-nums text-green-700 font-semibold border-l text-xs">
                                                                                    {formatNumber(feeder.receivingMeter.importKwh)}
                                                                                </TableCell>
                                                                                <TableCell className="text-right tabular-nums text-blue-700 font-semibold text-xs">
                                                                                    {formatNumber(feeder.receivingMeter.exportKwh)}
                                                                                </TableCell>
                                                                                <TableCell className={`text-right tabular-nums font-bold text-xs ${feeder.receivingMeter.netKwh >= 0 ? "text-green-700" : "text-red-600"}`}>
                                                                                    {formatNumber(feeder.receivingMeter.netKwh)}
                                                                                </TableCell>
                                                                                {/* Totals */}
                                                                                <TableCell className="text-right tabular-nums text-green-700 font-semibold border-l text-sm">
                                                                                    {formatNumber(feeder.totalImport)}
                                                                                </TableCell>
                                                                                <TableCell className="text-right tabular-nums text-blue-700 font-semibold text-sm">
                                                                                    {formatNumber(feeder.totalExport)}
                                                                                </TableCell>
                                                                                <TableCell className={`text-right tabular-nums font-bold text-sm ${feeder.netKwh >= 0 ? "text-green-700" : "text-red-600"}`}>
                                                                                    {formatNumber(feeder.netKwh)}
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        ))
                                                                    )}
                                                                </TableBody>
                                                            </Table>
                                                        </div>

                                                        <div className="flex items-center justify-between px-4 py-3 border-t">
                                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                <span>Rows per page:</span>
                                                                <select
                                                                    className="h-8 rounded border bg-background px-2 text-sm"
                                                                    value={feederPageSize}
                                                                    onChange={(e) => {
                                                                        setFeederPageSize(Number(e.target.value));
                                                                        setFeederPage(0);
                                                                    }}
                                                                >
                                                                    {[10, 20, 50, 100].map((n) => (
                                                                        <option key={n} value={n}>{n}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-sm">
                                  <span className="text-muted-foreground">
                                    {feederSearch
                                        ? `${filtered.length} result${filtered.length !== 1 ? "s" : ""}`
                                        : `${feederPage * feederPageSize + 1}–${Math.min((feederPage + 1) * feederPageSize, filtered.length)} of ${filtered.length}`}
                                  </span>
                                                                <div className="flex items-center gap-1">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-8 w-8 p-0"
                                                                        onClick={() => setFeederPage((p) => Math.max(0, p - 1))}
                                                                        disabled={feederPage === 0}
                                                                    >
                                                                        <ChevronLeft className="h-4 w-4" />
                                                                    </Button>
                                                                    <span className="text-muted-foreground px-1">
                                      Page {feederPage + 1} of {Math.max(1, totalPages)}
                                    </span>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-8 w-8 p-0"
                                                                        onClick={() => setFeederPage((p) => Math.min(totalPages - 1, p + 1))}
                                                                        disabled={feederPage >= totalPages - 1}
                                                                    >
                                                                        <ChevronRight className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <Card>
                                        <CardContent className="pt-6 text-center text-muted-foreground">
                                            No express feeders found for this region in the selected date range.
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        </TabsContent>

                        {/* Tab 4: Analytics Gauges */}
                        <TabsContent value="analytics">
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                {[
                                    {
                                        title: "Self-Sufficiency",
                                        value: analytics.selfSufficiency,
                                        desc: "BSP / Total Supply",
                                        color: "#22c55e",
                                    },
                                    {
                                        title: "Import Dependency",
                                        value: analytics.importDependency,
                                        desc: "Boundary Import / Total Supply",
                                        color: "#3b82f6",
                                    },
                                    {
                                        title: "Export Capacity",
                                        value: analytics.exportCapacity,
                                        desc: "Boundary Export / BSP",
                                        color: "#f97316",
                                    },
                                    {
                                        title: "Coverage Rate",
                                        value: analytics.coverageRate,
                                        desc: "DTX / Available Supply",
                                        color: "#a855f7",
                                    },
                                ].map((metric) => (
                                    <Card key={metric.title}>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                                {metric.title}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="h-32">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <RadialBarChart
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius="60%"
                                                        outerRadius="90%"
                                                        data={[
                                                            {
                                                                value: Math.min(metric.value, 100),
                                                                fill: metric.color,
                                                            },
                                                        ]}
                                                        startAngle={90}
                                                        endAngle={-270}
                                                    >
                                                        <RadialBar
                                                            background
                                                            dataKey="value"
                                                            cornerRadius={10}
                                                        />
                                                        <text
                                                            x="50%"
                                                            y="50%"
                                                            textAnchor="middle"
                                                            dominantBaseline="middle"
                                                            className="fill-foreground text-2xl font-bold"
                                                        >
                                                            {formatNumber(metric.value, 1)}%
                                                        </text>
                                                    </RadialBarChart>
                                                </ResponsiveContainer>
                                            </div>
                                            <p className="text-xs text-muted-foreground text-center mt-1">
                                                {metric.desc}
                                            </p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Energy Flow Visualization */}
            <Card>
                <CardHeader>
                    <CardTitle>Energy Flow Diagram</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Visual representation of energy sources and distribution
                    </p>
                </CardHeader>
                <CardContent>
                    {/* Column Headers - Fixed at top */}
                    <div className="flex items-center gap-0 pt-2">
                        <div className="flex-1 pr-6">
                            <h3 className="font-semibold text-sm text-muted-foreground text-center">
                                SOURCES
                            </h3>
                        </div>
                        <div className="w-1"></div>
                        <div className="flex-1 px-6">
                            <h3 className="font-semibold text-sm text-muted-foreground text-center">
                                POOL
                            </h3>
                        </div>
                        <div className="w-1"></div>
                        <div className="flex-1 pl-6">
                            <h3 className="font-semibold text-sm text-muted-foreground text-center">
                                OUT OF REGION
                            </h3>
                        </div>
                    </div>

                    {/* Diagram Content - Centered vertically */}
                    <div className="flex items-center gap-0 min-h-[500px]">
                        {/* Left: Sources */}
                        <div className="flex-1 pr-6 flex flex-col justify-center">
                            <div className="grid grid-cols-1 gap-4">
                                <div className="relative">
                                    <div
                                        className="p-4 bg-green-500/20 rounded-lg border-2 border-green-500 text-center cursor-pointer hover:bg-green-500/30 transition-colors"
                                        onClick={() => setIsBspFlowExpanded(!isBspFlowExpanded)}
                                    >
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="text-xs font-medium text-muted-foreground">
                                                BSP Import
                                            </div>
                                            {isBspFlowExpanded ? (
                                                <ChevronDown className="h-3 w-3" />
                                            ) : (
                                                <ChevronRight className="h-3 w-3" />
                                            )}
                                        </div>
                                        <div className="text-lg font-bold mt-1">
                                            {formatNumber(energyFlow.bspImport)}
                                        </div>
                                        <div className="text-xs text-muted-foreground">kWh</div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {bspMetrics.byStation.size} stations
                                        </div>
                                    </div>

                                    {/* Station Breakdown */}
                                    {isBspFlowExpanded && bspMetrics.byStation.size > 0 && (
                                        <div className="mt-2 space-y-1 max-h-60 overflow-y-auto bg-background/95 rounded-lg border border-green-500/30 p-3">
                                            <div className="text-xs font-semibold mb-2 text-muted-foreground sticky top-0 bg-background">
                                                Station Contributions:
                                            </div>
                                            {Array.from(bspMetrics.byStation.entries())
                                                .sort((a, b) => b[1].import - a[1].import)
                                                .map(([station, data]) => {
                                                    const percentage =
                                                        energyFlow.bspImport > 0
                                                            ? (data.import / energyFlow.bspImport) * 100
                                                            : 0;
                                                    return (
                                                        <div
                                                            key={station}
                                                            className="flex items-center justify-between py-1 px-2 hover:bg-muted/50 rounded text-xs"
                                                        >
                                                            <Link
                                                                href={`/stations/${encodeURIComponent(station.toLowerCase())}`}
                                                                className="font-medium truncate flex-1 text-primary hover:underline"
                                                            >
                                                                {station}
                                                            </Link>
                                                            <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-muted-foreground">
                                  {formatNumber(data.import)} kWh
                                </span>
                                                                <span className="font-semibold text-green-600 min-w-[45px] text-right">
                                  {formatNumber(percentage, 1)}%
                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    )}

                                    {/* Flow arrow */}
                                    <div
                                        className="absolute top-1/2 -right-8 w-8 h-1 bg-green-500"
                                        style={{ transform: "translateY(-50%)" }}
                                    />
                                </div>

                                {/* Express Feeder Inbound Section */}
                                {expressFeederMetrics.inbound.length > 0 && (
                                    <div className="relative">
                                        <div
                                            className="p-4 bg-purple-500/20 rounded-lg border-2 border-purple-500 text-center cursor-pointer hover:bg-purple-500/30 transition-colors"
                                            onClick={() => setIsFeederInboundExpanded(!isFeederInboundExpanded)}
                                        >
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="text-xs font-medium text-muted-foreground">
                                                    Express Feeder Inbound
                                                </div>
                                                {isFeederInboundExpanded ? (
                                                    <ChevronDown className="h-3 w-3" />
                                                ) : (
                                                    <ChevronRight className="h-3 w-3" />
                                                )}
                                            </div>
                                            <div className="text-lg font-bold mt-1 text-purple-700">
                                                {formatNumber(energyFlow.expressFeederInbound)}
                                            </div>
                                            <div className="text-xs text-muted-foreground">kWh</div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {expressFeederMetrics.inbound.length} feeder{expressFeederMetrics.inbound.length !== 1 ? "s" : ""}
                                            </div>
                                        </div>

                                        {/* Feeder Breakdown */}
                                        {isFeederInboundExpanded && expressFeederMetrics.inbound.length > 0 && (
                                            <div className="mt-2 space-y-1 max-h-60 overflow-y-auto bg-background/95 rounded-lg border border-purple-500/30 p-3">
                                                <div className="text-xs font-semibold mb-2 text-muted-foreground sticky top-0 bg-background">
                                                    Inbound Feeders:
                                                </div>
                                                {expressFeederMetrics.inbound
                                                    .slice()
                                                    .sort((a, b) => b.totalImport - a.totalImport)
                                                    .map((feeder) => {
                                                        const percentage = energyFlow.expressFeederInbound > 0
                                                            ? (feeder.totalImport / energyFlow.expressFeederInbound) * 100
                                                            : 0;
                                                        return (
                                                            <div
                                                                key={feeder.feederName}
                                                                className="flex items-center justify-between py-1 px-2 hover:bg-muted/50 rounded text-xs"
                                                            >
                                                                <div className="flex-1 min-w-0">
                                                                    <Link
                                                                        href={`/express-feeders/${encodeURIComponent(feeder.feederName)}`}
                                                                        className="font-medium text-primary hover:underline block truncate"
                                                                    >
                                                                        {feeder.feederName}
                                                                    </Link>
                                                                    <span className="text-muted-foreground truncate block">
                                      {feeder.sendingMeter.station} → {feeder.receivingMeter.station}
                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                                                    <span className="text-muted-foreground">{formatNumber(feeder.totalImport)} kWh</span>
                                                                    <span className="font-semibold text-purple-600 min-w-[45px] text-right">
                                      {formatNumber(percentage, 1)}%
                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        )}

                                        {/* Flow arrow */}
                                        <div
                                            className="absolute top-1/2 -right-8 w-8 h-1 bg-purple-500"
                                            style={{ transform: "translateY(-50%)" }}
                                        />
                                    </div>
                                )}

                                {energyFlow.boundaryImport > 0 && (
                                    <div className="relative">
                                        <div
                                            className="p-4 bg-blue-500/20 rounded-lg border-2 border-blue-500 text-center cursor-pointer hover:bg-blue-500/30 transition-colors"
                                            onClick={() =>
                                                setIsBoundaryImportExpanded(!isBoundaryImportExpanded)
                                            }
                                        >
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="text-xs font-medium text-muted-foreground">
                                                    Boundary Import
                                                </div>
                                                {isBoundaryImportExpanded ? (
                                                    <ChevronDown className="h-3 w-3" />
                                                ) : (
                                                    <ChevronRight className="h-3 w-3" />
                                                )}
                                            </div>
                                            <div className="text-lg font-bold mt-1 text-blue-600">
                                                {formatNumber(energyFlow.boundaryImport)}
                                            </div>
                                            <div className="text-xs text-muted-foreground">kWh</div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {boundaryMetrics.imports.length} exchange partner(s)
                                            </div>
                                        </div>

                                        {/* Location Breakdown */}
                                        {isBoundaryImportExpanded &&
                                            boundaryMetrics.imports.length > 0 && (
                                                <div className="mt-2 space-y-1 max-h-60 overflow-y-auto bg-background/95 rounded-lg border border-blue-500/30 p-3">
                                                    <div className="text-xs font-semibold mb-2 text-muted-foreground sticky top-0 bg-background">
                                                        Import by Location:
                                                    </div>
                                                    {boundaryMetrics.imports.map((importData) =>
                                                            Array.from(importData.locations.entries())
                                                                .sort((a, b) => b[1].value - a[1].value)
                                                                .map(([location, data]) => {
                                                                    const percentage =
                                                                        energyFlow.boundaryImport > 0
                                                                            ? (data.value / energyFlow.boundaryImport) *
                                                                            100
                                                                            : 0;
                                                                    return (
                                                                        <div
                                                                            key={`${importData.partner}-${location}`}
                                                                            className="flex items-center justify-between py-1 px-2 hover:bg-muted/50 rounded text-xs"
                                                                        >
                                    <span className="font-medium truncate flex-1">
                                      {location} ({importData.partner})
                                    </span>
                                                                            <div className="flex items-center gap-2 flex-shrink-0">
                                      <span className="text-muted-foreground">
                                        {formatNumber(data.value)} kWh
                                      </span>
                                                                                <span className="font-semibold text-blue-600 min-w-[45px] text-right">
                                        {formatNumber(percentage, 1)}%
                                      </span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }),
                                                    )}
                                                </div>
                                            )}

                                        {/* Flow arrow */}
                                        <div
                                            className="absolute top-1/2 -right-8 w-8 h-1 bg-blue-500"
                                            style={{ transform: "translateY(-50%)" }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Divider 1 */}
                        <div className="w-1 bg-border/40 rounded-full self-center h-96"></div>

                        {/* Center: Pool */}
                        <div className="flex-1 px-6 flex flex-col justify-center">
                            <div className="relative">
                                {/* Available Supply clickable box */}
                                <div
                                    className="p-6 bg-primary/10 rounded-lg border-4 border-primary text-center cursor-pointer hover:bg-primary/15 transition-colors"
                                    onClick={() => setIsAvailableSupplyExpanded(!isAvailableSupplyExpanded)}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="text-xs font-medium text-muted-foreground">
                                            Available Supply
                                        </div>
                                        {isAvailableSupplyExpanded ? (
                                            <ChevronDown className="h-3 w-3" />
                                        ) : (
                                            <ChevronRight className="h-3 w-3" />
                                        )}
                                    </div>
                                    <div className="text-2xl font-bold mt-2 text-primary">
                                        {formatNumber(energyFlow.availableSupply)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">kWh</div>
                                    <div className="text-xs mt-2 text-muted-foreground font-medium">
                                        {analytics.netPosition}
                                    </div>
                                </div>

                                {/* Supply Breakdown */}
                                {isAvailableSupplyExpanded && (
                                    <div className="mt-2 space-y-1 max-h-96 overflow-y-auto bg-background/95 rounded-lg border border-primary/30 p-3">
                                        <div className="text-xs font-semibold mb-2 text-muted-foreground sticky top-0 bg-background">
                                            Regional distribution:
                                        </div>

                                        {/* Public DT (DTX) row — clickable to expand districts */}
                                        <div
                                            className="cursor-pointer hover:bg-muted/50 rounded transition-colors"
                                            onClick={() => setIsPublicDtExpanded(!isPublicDtExpanded)}
                                        >
                                            <div className="flex items-center justify-between py-2 px-2 text-xs border-b border-border/50">
                                                <div className="flex items-center gap-1">
                                                    <div>
                                                        <span className="font-medium block text-foreground">Public DT</span>
                                                        <span className="text-muted-foreground text-[10px]">
                                {dtxMetrics.uniqueMeters.size} meters · {dtxMetrics.byDistrict.size} districts
                              </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-muted-foreground">
                              {formatNumber(energyFlow.dtxConsumption)} kWh
                            </span>
                                                    <div className="flex items-center gap-1">
                              <span className="font-semibold text-primary min-w-[40px] text-right">
                                {energyFlow.availableSupply > 0
                                    ? formatNumber((energyFlow.dtxConsumption / energyFlow.availableSupply) * 100, 1)
                                    : "0"}
                                  %
                              </span>
                                                        {isPublicDtExpanded ? (
                                                            <ChevronDown className="h-3 w-3" />
                                                        ) : (
                                                            <ChevronRight className="h-3 w-3" />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* District breakdown */}
                                            {isPublicDtExpanded && dtxMetrics.byDistrict.size > 0 && (
                                                <div className="space-y-0.5 py-1 px-2 bg-muted/20 rounded-b">
                                                    {Array.from(dtxMetrics.byDistrict.entries())
                                                        .sort((a, b) => b[1].consumption - a[1].consumption)
                                                        .map(([district, data]) => {
                                                            const percentage =
                                                                energyFlow.dtxConsumption > 0
                                                                    ? (data.consumption / energyFlow.dtxConsumption) * 100
                                                                    : 0;
                                                            return (
                                                                <div
                                                                    key={district}
                                                                    className="flex items-center justify-between py-1 px-2 hover:bg-muted/50 rounded text-xs ml-2 border-l-2 border-primary/30"
                                                                >
                                    <span className="font-medium text-muted-foreground truncate flex-1">
                                      {district}
                                    </span>
                                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <span className="text-muted-foreground text-right">
                                        {formatNumber(data.consumption)} kWh
                                      </span>
                                                                        <span className="font-semibold text-primary/70 min-w-[35px] text-right text-[10px]">
                                        {formatNumber(percentage, 1)}%
                                      </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                </div>
                                            )}
                                        </div>

                                        {/* Private DT (Non-DTX) Customers row */}
                                        <div className="flex items-center justify-between py-2 px-2 hover:bg-muted/50 rounded text-xs">
                                            <div>
                                                <span className="font-medium block text-foreground">Private DT</span>
                                                <span className="text-muted-foreground text-[10px]">
                            Direct customers
                          </span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-muted-foreground">
                            0 kWh
                          </span>
                                                <span className="font-semibold text-primary min-w-[45px] text-right">
                            0%
                          </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Divider 2 */}
                        <div className="w-1 bg-border/40 rounded-full self-center h-96"></div>

                        {/* Right: Out of Region */}
                        <div className="flex-1 pl-6 flex flex-col justify-center">
                            <div className="grid grid-cols-1 gap-4">
                                {/* Express Feeder Outbound */}
                                {expressFeederMetrics.outbound.length > 0 && (
                                    <div className="relative">
                                        {/* Flow arrow */}
                                        <div
                                            className="absolute top-1/2 -left-8 w-8 h-1 bg-teal-500"
                                            style={{ transform: "translateY(-50%)" }}
                                        />
                                        <div
                                            className="p-4 bg-teal-500/20 rounded-lg border-2 border-teal-500 text-center cursor-pointer hover:bg-teal-500/30 transition-colors"
                                            onClick={() => setIsFeederOutboundExpanded(!isFeederOutboundExpanded)}
                                        >
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="text-xs font-medium text-muted-foreground">
                                                    Express Feeder Outbound
                                                </div>
                                                {isFeederOutboundExpanded ? (
                                                    <ChevronDown className="h-3 w-3" />
                                                ) : (
                                                    <ChevronRight className="h-3 w-3" />
                                                )}
                                            </div>
                                            <div className="text-lg font-bold mt-1 text-teal-700">
                                                {formatNumber(energyFlow.expressFeederOutbound)}
                                            </div>
                                            <div className="text-xs text-muted-foreground">kWh</div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {expressFeederMetrics.outbound.length} feeder{expressFeederMetrics.outbound.length !== 1 ? "s" : ""}
                                            </div>
                                        </div>

                                        {/* Feeder Breakdown */}
                                        {isFeederOutboundExpanded && expressFeederMetrics.outbound.length > 0 && (
                                            <div className="mt-2 space-y-1 max-h-60 overflow-y-auto bg-background/95 rounded-lg border border-teal-500/30 p-3">
                                                <div className="text-xs font-semibold mb-2 text-muted-foreground sticky top-0 bg-background">
                                                    Outbound Feeders:
                                                </div>
                                                {expressFeederMetrics.outbound
                                                    .slice()
                                                    .sort((a, b) => b.totalExport - a.totalExport)
                                                    .map((feeder) => {
                                                        const percentage = energyFlow.expressFeederOutbound > 0
                                                            ? (feeder.totalExport / energyFlow.expressFeederOutbound) * 100
                                                            : 0;
                                                        return (
                                                            <div
                                                                key={feeder.feederName}
                                                                className="flex items-center justify-between py-1 px-2 hover:bg-muted/50 rounded text-xs"
                                                            >
                                                                <div className="flex-1 min-w-0">
                                                                    <Link
                                                                        href={`/express-feeders/${encodeURIComponent(feeder.feederName)}`}
                                                                        className="font-medium text-primary hover:underline block truncate"
                                                                    >
                                                                        {feeder.feederName}
                                                                    </Link>
                                                                    <span className="text-muted-foreground truncate block">
                                      {feeder.sendingMeter.station} → {feeder.receivingMeter.station}
                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                                                    <span className="text-muted-foreground">{formatNumber(feeder.totalExport)} kWh</span>
                                                                    <span className="font-semibold text-teal-600 min-w-[45px] text-right">
                                      {formatNumber(percentage, 1)}%
                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {energyFlow.boundaryExport > 0 && (
                                    <div className="relative">
                                        {/* Flow arrow */}
                                        <div
                                            className="absolute top-1/2 -left-8 w-8 h-1 bg-orange-500"
                                            style={{ transform: "translateY(-50%)" }}
                                        />
                                        <div
                                            className="p-4 bg-orange-500/20 rounded-lg border-2 border-orange-500 text-center cursor-pointer hover:bg-orange-500/30 transition-colors"
                                            onClick={() => setIsBoundaryExportExpanded(!isBoundaryExportExpanded)}
                                        >
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="text-xs font-medium text-muted-foreground">
                                                    Boundary Export
                                                </div>
                                                {isBoundaryExportExpanded ? (
                                                    <ChevronDown className="h-3 w-3" />
                                                ) : (
                                                    <ChevronRight className="h-3 w-3" />
                                                )}
                                            </div>
                                            <div className="text-lg font-bold mt-1 text-orange-600">
                                                {formatNumber(energyFlow.boundaryExport)}
                                            </div>
                                            <div className="text-xs text-muted-foreground">kWh</div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {boundaryMetrics.exports.length} exchange partner(s)
                                            </div>
                                        </div>

                                        {/* Location Breakdown */}
                                        {isBoundaryExportExpanded && boundaryMetrics.exports.length > 0 && (
                                            <div className="mt-2 space-y-1 max-h-60 overflow-y-auto bg-background/95 rounded-lg border border-orange-500/30 p-3">
                                                <div className="text-xs font-semibold mb-2 text-muted-foreground sticky top-0 bg-background">
                                                    Export by Location:
                                                </div>
                                                {boundaryMetrics.exports.map((exportData) =>
                                                        Array.from(exportData.locations.entries())
                                                            .sort((a, b) => b[1].value - a[1].value)
                                                            .map(([location, data]) => {
                                                                const percentage =
                                                                    energyFlow.boundaryExport > 0
                                                                        ? (data.value / energyFlow.boundaryExport) * 100
                                                                        : 0;
                                                                return (
                                                                    <div
                                                                        key={`${exportData.partner}-${location}`}
                                                                        className="flex items-center justify-between py-1 px-2 hover:bg-muted/50 rounded text-xs"
                                                                    >
                                              <span className="font-medium truncate flex-1">
                                                {location} ({exportData.partner})
                                              </span>
                                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className="text-muted-foreground">
                                                  {formatNumber(data.value)} kWh
                                                </span>
                                                                            <span className="font-semibold text-orange-600 min-w-[45px] text-right">
                                                  {formatNumber(percentage, 1)}%
                                                </span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }),
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Calculation footnote */}
                    <div className="mt-5 pt-4 border-t border-border/60">
                        <button
                            onClick={() => setShowFootnote((v) => !v)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors w-full text-left"
                        >
                            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showFootnote ? "rotate-180" : ""}`} />
                            How calculations work
                        </button>
                        {showFootnote && (
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-xs text-muted-foreground">
                                {/* Pool */}
                                <div className="md:col-span-2">
                                    <span className="font-medium text-foreground">Pool — Available Supply</span>
                                    <p className="mt-0.5 leading-relaxed font-mono bg-muted/50 rounded px-2 py-1 inline-block mt-1">
                                        BSP Import &nbsp;+&nbsp; (Boundary Import &minus; Boundary Export) &nbsp;+&nbsp; (Express Feeder Inbound &minus; Express Feeder Outbound)
                                    </p>
                                    <p className="mt-1 leading-relaxed">
                                        BSP Import is taken as a gross figure. Boundary and Express Feeder contributions are netted — only the difference between what flows in and what flows out is added to the pool.
                                    </p>
                                </div>
                                {/* Sources */}
                                <div>
                                    <span className="font-medium text-foreground">Source — Boundary Import</span>
                                    <p className="mt-0.5 leading-relaxed">
                                        Energy received from neighbouring regions through boundary metering points. Only the net of Boundary Import minus Boundary Export contributes to the pool — not the gross import figure shown in the diagram.
                                    </p>
                                </div>
                                <div>
                                    <span className="font-medium text-foreground">Source — Express Feeder Inbound</span>
                                    <p className="mt-0.5 leading-relaxed">
                                        Energy flowing into this region via express feeder lines from adjacent regions. Only the net of Inbound minus Outbound contributes to the pool — not the gross inbound figure shown in the diagram.
                                    </p>
                                </div>
                                {/* Distribution */}
                                <div>
                                    <span className="font-medium text-foreground">Distribution — Public DT (DTX Import)</span>
                                    <p className="mt-0.5 leading-relaxed">
                                        Total kWh drawn from the pool by all public Distribution Transformer (DTX) meters in the region, summed across all districts.
                                    </p>
                                </div>
                                <div>
                                    <span className="font-medium text-foreground">Distribution — Private DT (Non-DTX Customers)</span>
                                    <p className="mt-0.5 leading-relaxed">
                                        Direct customers not served through a DTX meter. Currently reported as 0 — no direct customer metering data is ingested yet.
                                    </p>
                                </div>
                                <div>
                                    <span className="font-medium text-foreground">Distribution — Boundary Export</span>
                                    <p className="mt-0.5 leading-relaxed">
                                        Energy leaving this region to neighbouring regions via boundary meters. Shown as a distribution outflow because it is subtracted from gross Boundary Import before the net is added to the pool.
                                    </p>
                                </div>
                                <div>
                                    <span className="font-medium text-foreground">Distribution — Express Feeder Outbound</span>
                                    <p className="mt-0.5 leading-relaxed">
                                        Energy sent out of this region to adjacent regions via express feeder lines. Shown as a distribution outflow because it is subtracted from gross Express Feeder Inbound before the net is added to the pool.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Daily Trend Chart */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <CardTitle>Daily Consumption Trend</CardTitle>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { key: "bsp", label: "BSP Incomer", color: "#22c55e" },
                                {
                                    key: "dtx",
                                    label: "Distribution Transformer",
                                    color: "#a855f7",
                                },
                                {
                                    key: "boundaryImport",
                                    label: "Boundary Import",
                                    color: "#3b82f6",
                                },
                                {
                                    key: "boundaryExport",
                                    label: "Boundary Export",
                                    color: "#f97316",
                                },
                                {
                                    key: "availableSupply",
                                    label: "Available Supply",
                                    color: "#0ea5e9",
                                },
                                // { key: "net", label: "Net", color: "#ef4444" },
                            ].map((metric) => {
                                const isSelected = selectedMetrics.includes(metric.key);
                                return (
                                    <Button
                                        key={metric.key}
                                        variant={isSelected ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => {
                                            setSelectedMetrics((prev) =>
                                                isSelected
                                                    ? prev.filter((m) => m !== metric.key)
                                                    : [...prev, metric.key],
                                            );
                                        }}
                                        style={
                                            isSelected
                                                ? {
                                                    backgroundColor: metric.color,
                                                    borderColor: metric.color,
                                                }
                                                : {}
                                        }
                                    >
                                        {metric.label}
                                    </Button>
                                );
                            })}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {selectedMetrics.length === 0 ? (
                        <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                            Select at least one metric to display
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={380}>
                            <AreaChart
                                data={dailyData}
                                margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="formattedDate"
                                    angle={-45}
                                    textAnchor="end"
                                    height={80}
                                />
                                <YAxis
                                    tickFormatter={(value) => {
                                        if (value >= 1000000)
                                            return `${(value / 1000000).toFixed(1)}M`;
                                        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                                        return value.toString();
                                    }}
                                />
                                <Tooltip
                                    labelFormatter={(label) => label}
                                    formatter={(value: any, name: string) => {
                                        const metricLabels: Record<string, string> = {
                                            bsp: "BSP Import",
                                            dtx: "DTX Import",
                                            boundaryImport: "Boundary Import",
                                            boundaryExport: "Boundary Export",
                                            availableSupply: "Available Supply",
                                            net: "Net",
                                        };
                                        return [
                                            formatNumber(value) + " kWh",
                                            metricLabels[name] || name,
                                        ];
                                    }}
                                />
                                <Legend />

                                {/* BSP Incomer */}
                                {selectedMetrics.includes("bsp") && (
                                    <Area
                                        type="monotone"
                                        dataKey="bsp"
                                        stroke="#22c55e"
                                        fill="#22c55e"
                                        fillOpacity={0.3}
                                        strokeWidth={2}
                                        name="BSP Import"
                                    />
                                )}

                                {/* DTX Distribution */}
                                {selectedMetrics.includes("dtx") && (
                                    <Area
                                        type="monotone"
                                        dataKey="dtx"
                                        stroke="#a855f7"
                                        fill="#a855f7"
                                        fillOpacity={0.3}
                                        strokeWidth={2}
                                        name="DTX Import"
                                    />
                                )}

                                {/* Boundary Import */}
                                {selectedMetrics.includes("boundaryImport") && (
                                    <Area
                                        type="monotone"
                                        dataKey="boundaryImport"
                                        stroke="#3b82f6"
                                        fill="#3b82f6"
                                        fillOpacity={0.3}
                                        strokeWidth={2}
                                        name="Boundary Import"
                                    />
                                )}

                                {/* Boundary Export */}
                                {selectedMetrics.includes("boundaryExport") && (
                                    <Area
                                        type="monotone"
                                        dataKey="boundaryExport"
                                        stroke="#f97316"
                                        fill="#f97316"
                                        fillOpacity={0.3}
                                        strokeWidth={2}
                                        name="Boundary Export"
                                    />
                                )}

                                {/* Available Supply */}
                                {selectedMetrics.includes("availableSupply") && (
                                    <Area
                                        type="monotone"
                                        dataKey="availableSupply"
                                        stroke="#0ea5e9"
                                        fill="#0ea5e9"
                                        fillOpacity={0.3}
                                        strokeWidth={2}
                                        name="Available Supply"
                                    />
                                )}

                                {/* Net */}
                                {selectedMetrics.includes("net") && (
                                    <Area
                                        type="monotone"
                                        dataKey="net"
                                        stroke="#ef4444"
                                        fill="#ef4444"
                                        fillOpacity={0.3}
                                        strokeWidth={2}
                                        name="Net"
                                    />
                                )}
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>

            {/*Tables */}
            <Card>
                <CardHeader>
                    <CardTitle>Energy Trading Regions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* IMPORTS Column - Left Side */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-green-600 mb-3 flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                IMPORTS FROM ({boundaryMetrics.imports.length} partners)
                            </h3>

                            {boundaryMetrics.imports.length > 0 ? (
                                <div className="space-y-2">
                                    {boundaryMetrics.imports.map((item) => (
                                        <div
                                            key={item.partner}
                                            className="border rounded-lg overflow-hidden"
                                        >
                                            {/* Partner Header */}
                                            <div
                                                className="flex items-center justify-between p-3 bg-muted/50 cursor-pointer hover:bg-muted"
                                                onClick={() => toggleBoundary(`import-${item.partner}`)}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {expandedBoundaries.has(`import-${item.partner}`) ? (
                                                        <ChevronDown className="h-4 w-4" />
                                                    ) : (
                                                        <ChevronRight className="h-4 w-4" />
                                                    )}
                                                    <span className="font-medium">
                            {toProperCase(item.partner)}
                          </span>
                                                </div>
                                                <div className="flex items-center gap-3">
                          <span className="font-semibold">
                            {formatNumber(item.value)} kWh
                          </span>
                                                    <Badge variant="secondary" className="text-xs">
                                                        {formatNumber(
                                                            (item.value / boundaryMetrics.totalImport) * 100,
                                                            1,
                                                        )}
                                                        %
                                                    </Badge>
                                                </div>
                                            </div>

                                            {/* Expanded Locations */}
                                            {expandedBoundaries.has(`import-${item.partner}`) && (
                                                <div className="p-3 bg-background space-y-2">
                                                    {Array.from(item.locations.entries()).map(
                                                        ([location, data]) => (
                                                            <div key={location} className="border rounded">
                                                                <div
                                                                    className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleBoundary(
                                                                            `import-${item.partner}-${location}`,
                                                                        );
                                                                    }}
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        {expandedBoundaries.has(
                                                                            `import-${item.partner}-${location}`,
                                                                        ) ? (
                                                                            <ChevronDown className="h-3 w-3" />
                                                                        ) : (
                                                                            <ChevronRight className="h-3 w-3" />
                                                                        )}
                                                                        <span className="text-sm font-medium">
                                      {location}
                                    </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold">
                                      {formatNumber(data.value)} kWh
                                    </span>
                                                                        <Badge
                                                                            variant="outline"
                                                                            className="text-xs"
                                                                        >
                                                                            {data.meters.size} meters
                                                                        </Badge>
                                                                    </div>
                                                                </div>

                                                                {/* Individual Meters with Contributions */}
                                                                {expandedBoundaries.has(
                                                                    `import-${item.partner}-${location}`,
                                                                ) && (
                                                                    <div className="p-2 bg-muted/30 border-t">
                                                                        <p className="text-xs text-muted-foreground mb-2">
                                                                            Meter Contributions:
                                                                        </p>
                                                                        <div className="space-y-1">
                                                                            {(() => {
                                                                                // We need to get individual meter data from boundaryData
                                                                                const meterContributions = new Map<
                                                                                    string,
                                                                                    number
                                                                                >();

                                                                                if (
                                                                                    boundaryData &&
                                                                                    Array.isArray(boundaryData)
                                                                                ) {
                                                                                    boundaryData.forEach(
                                                                                        (record: any) => {
                                                                                            const bp =
                                                                                                record.boundary_metering_point ||
                                                                                                "";
                                                                                            const parts = bp
                                                                                                .split("/")
                                                                                                .map((p: string) => p.trim());
                                                                                            if (parts.length !== 2) return;

                                                                                            const [leftRegion, rightRegion] =
                                                                                                parts;
                                                                                            const recordLocation =
                                                                                                record.location ||
                                                                                                "Unknown Location";

                                                                                            // Check if this is the right partner, location, and it's an import
                                                                                            if (
                                                                                                rightRegion.toLowerCase() ===
                                                                                                regionProperCase.toLowerCase() &&
                                                                                                leftRegion === item.partner &&
                                                                                                recordLocation === location &&
                                                                                                record.system_name ===
                                                                                                "import_kwh" &&
                                                                                                record.meter_number
                                                                                            ) {
                                                                                                const current =
                                                                                                    meterContributions.get(
                                                                                                        record.meter_number,
                                                                                                    ) || 0;
                                                                                                meterContributions.set(
                                                                                                    record.meter_number,
                                                                                                    current +
                                                                                                    (record.consumed_energy ||
                                                                                                        0),
                                                                                                );
                                                                                            }
                                                                                        },
                                                                                    );
                                                                                }

                                                                                // Sort by contribution (highest first)
                                                                                const sortedMeters = Array.from(
                                                                                    meterContributions.entries(),
                                                                                ).sort((a, b) => b[1] - a[1]);

                                                                                return sortedMeters.map(
                                                                                    ([meter, contribution]) => (
                                                                                        <div
                                                                                            key={meter}
                                                                                            className="flex items-center justify-between p-2 bg-background rounded text-xs"
                                                                                        >
                                              <span className="font-mono">
                                                {meter}
                                              </span>
                                                                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">
                                                  {formatNumber(contribution)}{" "}
                                                    kWh
                                                </span>
                                                                                                <Badge
                                                                                                    variant="secondary"
                                                                                                    className="text-[10px]"
                                                                                                >
                                                                                                    {formatNumber(
                                                                                                        (contribution /
                                                                                                            data.value) *
                                                                                                        100,
                                                                                                        1,
                                                                                                    )}
                                                                                                    %
                                                                                                </Badge>
                                                                                            </div>
                                                                                        </div>
                                                                                    ),
                                                                                );
                                                                            })()}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {/* Total */}
                                    <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg font-semibold">
                                        <span>Total Imports</span>
                                        <span>{formatNumber(boundaryMetrics.totalImport)} kWh</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 text-center text-muted-foreground border rounded-lg">
                                    No imports
                                </div>
                            )}
                        </div>

                        {/* EXPORTS Column - Right Side */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-orange-600 mb-3 flex items-center gap-2">
                                <TrendingDown className="h-4 w-4" />
                                EXPORTS TO ({boundaryMetrics.exports.length} partners)
                            </h3>

                            {boundaryMetrics.exports.length > 0 ? (
                                <div className="space-y-2">
                                    {boundaryMetrics.exports.map((item) => (
                                        <div
                                            key={item.partner}
                                            className="border rounded-lg overflow-hidden"
                                        >
                                            {/* Partner Header */}
                                            <div
                                                className="flex items-center justify-between p-3 bg-muted/50 cursor-pointer hover:bg-muted"
                                                onClick={() => toggleBoundary(`export-${item.partner}`)}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {expandedBoundaries.has(`export-${item.partner}`) ? (
                                                        <ChevronDown className="h-4 w-4" />
                                                    ) : (
                                                        <ChevronRight className="h-4 w-4" />
                                                    )}
                                                    <span className="font-medium">
                            {toProperCase(item.partner)}
                          </span>
                                                </div>
                                                <div className="flex items-center gap-3">
                          <span className="font-semibold">
                            {formatNumber(item.value)} kWh
                          </span>
                                                    <Badge variant="secondary" className="text-xs">
                                                        {formatNumber(
                                                            (item.value / boundaryMetrics.totalExport) * 100,
                                                            1,
                                                        )}
                                                        %
                                                    </Badge>
                                                </div>
                                            </div>

                                            {/* Expanded Locations */}
                                            {expandedBoundaries.has(`export-${item.partner}`) && (
                                                <div className="p-3 bg-background space-y-2">
                                                    {Array.from(item.locations.entries()).map(
                                                        ([location, data]) => (
                                                            <div key={location} className="border rounded">
                                                                <div
                                                                    className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleBoundary(
                                                                            `export-${item.partner}-${location}`,
                                                                        );
                                                                    }}
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        {expandedBoundaries.has(
                                                                            `export-${item.partner}-${location}`,
                                                                        ) ? (
                                                                            <ChevronDown className="h-3 w-3" />
                                                                        ) : (
                                                                            <ChevronRight className="h-3 w-3" />
                                                                        )}
                                                                        <span className="text-sm font-medium">
                                      {location}
                                    </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold">
                                      {formatNumber(data.value)} kWh
                                    </span>
                                                                        <Badge
                                                                            variant="outline"
                                                                            className="text-xs"
                                                                        >
                                                                            {data.meters.size} meters
                                                                        </Badge>
                                                                    </div>
                                                                </div>

                                                                {/* Individual Meters with Contributions */}
                                                                {expandedBoundaries.has(
                                                                    `export-${item.partner}-${location}`,
                                                                ) && (
                                                                    <div className="p-2 bg-muted/30 border-t">
                                                                        <p className="text-xs text-muted-foreground mb-2">
                                                                            Meter Contributions:
                                                                        </p>
                                                                        <div className="space-y-1">
                                                                            {(() => {
                                                                                // Get individual meter data from boundaryData
                                                                                const meterContributions = new Map<
                                                                                    string,
                                                                                    number
                                                                                >();

                                                                                if (
                                                                                    boundaryData &&
                                                                                    Array.isArray(boundaryData)
                                                                                ) {
                                                                                    boundaryData.forEach(
                                                                                        (record: any) => {
                                                                                            const bp =
                                                                                                record.boundary_metering_point ||
                                                                                                "";
                                                                                            const parts = bp
                                                                                                .split("/")
                                                                                                .map((p: string) => p.trim());
                                                                                            if (parts.length !== 2) return;

                                                                                            const [leftRegion, rightRegion] =
                                                                                                parts;
                                                                                            const recordLocation =
                                                                                                record.location ||
                                                                                                "Unknown Location";

                                                                                            // Check if this is the right partner, location, and it's an export
                                                                                            if (
                                                                                                leftRegion.toLowerCase() ===
                                                                                                regionProperCase.toLowerCase() &&
                                                                                                rightRegion === item.partner &&
                                                                                                recordLocation === location &&
                                                                                                record.system_name ===
                                                                                                "export_kwh" &&
                                                                                                record.meter_number
                                                                                            ) {
                                                                                                const current =
                                                                                                    meterContributions.get(
                                                                                                        record.meter_number,
                                                                                                    ) || 0;
                                                                                                meterContributions.set(
                                                                                                    record.meter_number,
                                                                                                    current +
                                                                                                    (record.consumed_energy ||
                                                                                                        0),
                                                                                                );
                                                                                            }
                                                                                        },
                                                                                    );
                                                                                }

                                                                                // Sort by contribution (highest first)
                                                                                const sortedMeters = Array.from(
                                                                                    meterContributions.entries(),
                                                                                ).sort((a, b) => b[1] - a[1]);

                                                                                return sortedMeters.map(
                                                                                    ([meter, contribution]) => (
                                                                                        <div
                                                                                            key={meter}
                                                                                            className="flex items-center justify-between p-2 bg-background rounded text-xs"
                                                                                        >
                                              <span className="font-mono">
                                                {meter}
                                              </span>
                                                                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">
                                                  {formatNumber(contribution)}{" "}
                                                    kWh
                                                </span>
                                                                                                <Badge
                                                                                                    variant="secondary"
                                                                                                    className="text-[10px]"
                                                                                                >
                                                                                                    {formatNumber(
                                                                                                        (contribution /
                                                                                                            data.value) *
                                                                                                        100,
                                                                                                        1,
                                                                                                    )}
                                                                                                    %
                                                                                                </Badge>
                                                                                            </div>
                                                                                        </div>
                                                                                    ),
                                                                                );
                                                                            })()}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {/* Total */}
                                    <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950 rounded-lg font-semibold">
                                        <span>Total Exports</span>
                                        <span>{formatNumber(boundaryMetrics.totalExport)} kWh</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 text-center text-muted-foreground border rounded-lg">
                                    No exports
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Express Feeder Trading */}
            {(feederTrading.inbound.length > 0 || feederTrading.outbound.length > 0) && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Zap className="h-5 w-5 text-purple-600" />
                            Express Feeder Trading
                        </CardTitle>
                        <CardDescription>
                            Energy exchanged with other regions via express feeders — inbound (received) and outbound (sent)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* INBOUND Column */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-purple-600 mb-3 flex items-center gap-2">
                                    <ArrowDownIcon className="h-4 w-4" />
                                    RECEIVED FROM ({feederTrading.inbound.length} region{feederTrading.inbound.length !== 1 ? "s" : ""})
                                </h3>
                                {feederTrading.inbound.length > 0 ? (
                                    <div className="space-y-2">
                                        {feederTrading.inbound.map((regionEntry) => (
                                            <div key={regionEntry.region} className="border rounded-lg overflow-hidden">
                                                {/* Region header */}
                                                <div
                                                    className="flex items-center justify-between p-3 bg-muted/50 cursor-pointer hover:bg-muted"
                                                    onClick={() => toggleFeeder(`in-${regionEntry.region}`)}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {expandedFeeders.has(`in-${regionEntry.region}`) ? (
                                                            <ChevronDown className="h-4 w-4" />
                                                        ) : (
                                                            <ChevronRight className="h-4 w-4" />
                                                        )}
                                                        <span className="font-medium">{toProperCase(regionEntry.region)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-semibold">{formatNumber(regionEntry.total)} kWh</span>
                                                        <Badge variant="secondary" className="text-xs">
                                                            {feederTrading.totalInbound > 0
                                                                ? formatNumber((regionEntry.total / feederTrading.totalInbound) * 100, 1)
                                                                : "0"}%
                                                        </Badge>
                                                    </div>
                                                </div>
                                                {/* Station breakdown */}
                                                {expandedFeeders.has(`in-${regionEntry.region}`) && (
                                                    <div className="p-3 bg-background space-y-2">
                                                        {Array.from(regionEntry.stations.values())
                                                            .sort((a, b) => b.total - a.total)
                                                            .map((stationEntry) => (
                                                                <div key={stationEntry.station} className="border rounded">
                                                                    <div
                                                                        className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            toggleFeeder(`in-${regionEntry.region}-${stationEntry.station}`);
                                                                        }}
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            {expandedFeeders.has(`in-${regionEntry.region}-${stationEntry.station}`) ? (
                                                                                <ChevronDown className="h-3 w-3" />
                                                                            ) : (
                                                                                <ChevronRight className="h-3 w-3" />
                                                                            )}
                                                                            <span className="text-sm font-medium">{stationEntry.station}</span>
                                                                            <span className="text-xs text-muted-foreground">(Sending)</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-sm font-semibold">{formatNumber(stationEntry.total)} kWh</span>
                                                                            <Badge variant="outline" className="text-xs">
                                                                                {stationEntry.feeders.length} feeder{stationEntry.feeders.length !== 1 ? "s" : ""}
                                                                            </Badge>
                                                                        </div>
                                                                    </div>
                                                                    {/* Feeder list */}
                                                                    {expandedFeeders.has(`in-${regionEntry.region}-${stationEntry.station}`) && (
                                                                        <div className="p-2 bg-muted/30 border-t space-y-1">
                                                                            <p className="text-xs text-muted-foreground mb-2">Feeder contributions (receiving meter import):</p>
                                                                            {stationEntry.feeders
                                                                                .slice()
                                                                                .sort((a, b) => b.kwh - a.kwh)
                                                                                .map((feeder) => (
                                                                                    <div key={feeder.name} className="flex items-center justify-between p-2 bg-background rounded text-xs">
                                                                                        <div>
                                                                                            <Link
                                                                                                href={`/express-feeders/${encodeURIComponent(feeder.name)}`}
                                                                                                className="font-medium text-primary hover:underline"
                                                                                            >
                                                                                                {feeder.name}
                                                                                            </Link>
                                                                                            {feeder.meterNumber && (
                                                                                                <span className="ml-2 font-mono text-muted-foreground">{feeder.meterNumber}</span>
                                                                                            )}
                                                                                        </div>
                                                                                        <div className="flex items-center gap-2">
                                                                                            <span className="font-medium">{formatNumber(feeder.kwh)} kWh</span>
                                                                                            <Badge variant="secondary" className="text-[10px]">
                                                                                                {stationEntry.total > 0 ? formatNumber((feeder.kwh / stationEntry.total) * 100, 1) : "0"}%
                                                                                            </Badge>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950 rounded-lg font-semibold">
                                            <span>Total Received</span>
                                            <span>{formatNumber(feederTrading.totalInbound)} kWh</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-8 text-center text-muted-foreground border rounded-lg">No inbound feeders</div>
                                )}
                            </div>

                            {/* OUTBOUND Column */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-teal-600 mb-3 flex items-center gap-2">
                                    <ArrowUpIcon className="h-4 w-4" />
                                    SENT TO ({feederTrading.outbound.length} region{feederTrading.outbound.length !== 1 ? "s" : ""})
                                </h3>
                                {feederTrading.outbound.length > 0 ? (
                                    <div className="space-y-2">
                                        {feederTrading.outbound.map((regionEntry) => (
                                            <div key={regionEntry.region} className="border rounded-lg overflow-hidden">
                                                {/* Region header */}
                                                <div
                                                    className="flex items-center justify-between p-3 bg-muted/50 cursor-pointer hover:bg-muted"
                                                    onClick={() => toggleFeeder(`out-${regionEntry.region}`)}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {expandedFeeders.has(`out-${regionEntry.region}`) ? (
                                                            <ChevronDown className="h-4 w-4" />
                                                        ) : (
                                                            <ChevronRight className="h-4 w-4" />
                                                        )}
                                                        <span className="font-medium">{toProperCase(regionEntry.region)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-semibold">{formatNumber(regionEntry.total)} kWh</span>
                                                        <Badge variant="secondary" className="text-xs">
                                                            {feederTrading.totalOutbound > 0
                                                                ? formatNumber((regionEntry.total / feederTrading.totalOutbound) * 100, 1)
                                                                : "0"}%
                                                        </Badge>
                                                    </div>
                                                </div>
                                                {/* Station breakdown */}
                                                {expandedFeeders.has(`out-${regionEntry.region}`) && (
                                                    <div className="p-3 bg-background space-y-2">
                                                        {Array.from(regionEntry.stations.values())
                                                            .sort((a, b) => b.total - a.total)
                                                            .map((stationEntry) => (
                                                                <div key={stationEntry.station} className="border rounded">
                                                                    <div
                                                                        className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            toggleFeeder(`out-${regionEntry.region}-${stationEntry.station}`);
                                                                        }}
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            {expandedFeeders.has(`out-${regionEntry.region}-${stationEntry.station}`) ? (
                                                                                <ChevronDown className="h-3 w-3" />
                                                                            ) : (
                                                                                <ChevronRight className="h-3 w-3" />
                                                                            )}
                                                                            <span className="text-sm font-medium">{stationEntry.station}</span>
                                                                            <span className="text-xs text-muted-foreground">(Receiving)</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-sm font-semibold">{formatNumber(stationEntry.total)} kWh</span>
                                                                            <Badge variant="outline" className="text-xs">
                                                                                {stationEntry.feeders.length} feeder{stationEntry.feeders.length !== 1 ? "s" : ""}
                                                                            </Badge>
                                                                        </div>
                                                                    </div>
                                                                    {/* Feeder list */}
                                                                    {expandedFeeders.has(`out-${regionEntry.region}-${stationEntry.station}`) && (
                                                                        <div className="p-2 bg-muted/30 border-t space-y-1">
                                                                            <p className="text-xs text-muted-foreground mb-2">Feeder contributions (sending meter export):</p>
                                                                            {stationEntry.feeders
                                                                                .slice()
                                                                                .sort((a, b) => b.kwh - a.kwh)
                                                                                .map((feeder) => (
                                                                                    <div key={feeder.name} className="flex items-center justify-between p-2 bg-background rounded text-xs">
                                                                                        <div>
                                                                                            <Link
                                                                                                href={`/express-feeders/${encodeURIComponent(feeder.name)}`}
                                                                                                className="font-medium text-primary hover:underline"
                                                                                            >
                                                                                                {feeder.name}
                                                                                            </Link>
                                                                                            {feeder.meterNumber && (
                                                                                                <span className="ml-2 font-mono text-muted-foreground">{feeder.meterNumber}</span>
                                                                                            )}
                                                                                        </div>
                                                                                        <div className="flex items-center gap-2">
                                                                                            <span className="font-medium">{formatNumber(feeder.kwh)} kWh</span>
                                                                                            <Badge variant="secondary" className="text-[10px]">
                                                                                                {stationEntry.total > 0 ? formatNumber((feeder.kwh / stationEntry.total) * 100, 1) : "0"}%
                                                                                            </Badge>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        <div className="flex items-center justify-between p-3 bg-teal-50 dark:bg-teal-950 rounded-lg font-semibold">
                                            <span>Total Sent</span>
                                            <span>{formatNumber(feederTrading.totalOutbound)} kWh</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-8 text-center text-muted-foreground border rounded-lg">No outbound feeders</div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Region Profile & Map */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Region Profile */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5" />
                            Region Profile
                        </CardTitle>
                        <CardDescription>
                            Infrastructure and coverage overview
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {/* Coverage Stats and Districts - Grid Layout */}
                            <div className="grid grid-cols-1 lg:grid-cols-[2fr_auto_1fr] gap-6">
                                {/* Coverage Stats - Takes 2fr */}
                                <div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                                Districts
                                            </p>
                                            <p className="text-3xl font-bold text-blue-600 mt-2">
                                                {regionProfile.totalDistricts}
                                            </p>
                                        </div>

                                        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                                            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                                                BSP Meters
                                            </p>
                                            <p className="text-3xl font-bold text-amber-600 mt-2">
                                                {regionProfile.totalBspMeters}
                                                <span className="text-sm font-normal text-amber-700 dark:text-amber-300 ml-2">
                          ({regionProfile.totalBspStations} stations)
                        </span>
                                            </p>
                                        </div>

                                        <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                                            <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                                                DTX Meters
                                            </p>
                                            <p className="text-3xl font-bold text-purple-600 mt-2">
                                                {regionProfile.totalDtxMeters}
                                            </p>
                                        </div>

                                        <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                                            <p className="text-sm font-medium text-green-900 dark:text-green-100">
                                                Boundary Meters
                                            </p>
                                            <p className="text-3xl font-bold text-green-600 mt-2">
                                                {regionProfile.totalBoundaryMeters}
                                            </p>
                                        </div>

                                        <div className="p-4 bg-muted/30 rounded-lg border col-span-2">
                                            <p className="text-sm font-medium">Total Meters</p>
                                            <p className="text-3xl font-bold mt-2">
                                                {regionProfile.totalMeters}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {regionProfile.totalBspMeters} BSP •{" "}
                                                {regionProfile.totalDtxMeters} DTX •{" "}
                                                {regionProfile.totalBoundaryMeters} Boundary
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Vertical Divider */}
                                {regionProfile.regionalDistricts &&
                                    regionProfile.regionalDistricts.length > 0 && (
                                        <div className="hidden lg:block w-px bg-border self-stretch"></div>
                                    )}

                                {/* Districts Column - Takes 1fr */}
                                {regionProfile.regionalDistricts &&
                                    regionProfile.regionalDistricts.length > 0 && (
                                        <div className="hidden lg:block min-w-[200px]">
                                            <div className="flex items-center justify-between mb-3">
                                                <p className="text-sm font-medium">Districts</p>
                                                <span className="text-xs text-muted-foreground">
                          {regionProfile.regionalDistricts.length}
                        </span>
                                            </div>
                                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                                                {regionProfile.regionalDistricts.map(
                                                    (district: any) => (
                                                        <Link
                                                            key={district.id}
                                                            href={`/districts/${encodeURIComponent(district.district.replace(/ district/i, "").trim())}`}
                                                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-950/40 transition-colors w-full"
                                                        >
                                                            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                                                            <span className="truncate">
                                {district.district.replace(/ district/i, "")}
                              </span>
                                                        </Link>
                                                    ),
                                                )}
                                            </div>
                                        </div>
                                    )}
                            </div>

                            {/* Districts for Mobile */}
                            {regionProfile.regionalDistricts &&
                                regionProfile.regionalDistricts.length > 0 && (
                                    <div className="lg:hidden pt-3 border-t">
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-sm font-medium">Districts</p>
                                            <span className="text-xs text-muted-foreground">
                        {regionProfile.regionalDistricts.length}
                      </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {regionProfile.regionalDistricts.map((district: any) => (
                                                <Link
                                                    key={district.id}
                                                    href={`/districts/${encodeURIComponent(district.district.replace(/ district/i, "").trim())}`}
                                                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-950/40 transition-colors"
                                                >
                                                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                                                    <span className="truncate">
                            {district.district.replace(/ district/i, "")}
                          </span>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )}

                            {/* Regional Boundary Connections */}
                            {relevantRegionalBoundaryPoints.length > 0 && (
                                <div className="pt-3 border-t">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-sm font-medium">
                                            Regional Boundary Connections
                                        </p>
                                        <span className="text-xs text-muted-foreground">
                      {relevantRegionalBoundaryPoints.length}{" "}
                                            {relevantRegionalBoundaryPoints.length === 1
                                                ? "boundary point"
                                                : "boundary points"}
                    </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {relevantRegionalBoundaryPoints.map((boundaryPoint) => (
                                            <Link
                                                key={boundaryPoint}
                                                href={`/regional-boundary/${encodeURIComponent(boundaryPoint)}`}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-full hover:bg-green-100 dark:hover:bg-green-950/40 transition-colors"
                                            >
                                                <ArrowLeftRight className="h-3 w-3" />
                                                {boundaryPoint}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Meter Health Status */}
                            <div className="pt-3 border-t space-y-3">
                                {/* BSP Meter Health */}
                                {bspHealthStatus && (
                                    <div>
                                        <p className="text-sm font-medium mb-2">BSP Meter Health</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="flex flex-col p-2 bg-green-50 dark:bg-green-950/20 rounded">
                        <span className="text-xs font-medium text-green-900 dark:text-green-100">
                          Online
                        </span>
                                                <span className="text-lg font-bold text-green-600">
                          {bspHealthStatus.online || 0}
                        </span>
                                            </div>
                                            <div className="flex flex-col p-2 bg-orange-50 dark:bg-orange-950/20 rounded">
                        <span className="text-xs font-medium text-orange-900 dark:text-orange-100">
                          Offline
                        </span>
                                                <span className="text-lg font-bold text-orange-600">
                          {bspHealthStatus.total_offline || 0}
                        </span>
                                            </div>
                                            <div className="flex flex-col p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
                        <span className="text-xs font-medium text-blue-900 dark:text-blue-100">
                          Uptime
                        </span>
                                                <span className="text-lg font-bold text-blue-600">
                          {bspHealthStatus.avg_uptime_percentage?.toFixed(1) ||
                              0}
                                                    %
                        </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* DTX Meter Health */}
                                {dtxHealthStatus && (
                                    <div>
                                        <p className="text-sm font-medium mb-2">DTX Meter Health</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="flex flex-col p-2 bg-green-50 dark:bg-green-950/20 rounded">
                        <span className="text-xs font-medium text-green-900 dark:text-green-100">
                          Online
                        </span>
                                                <span className="text-lg font-bold text-green-600">
                          {dtxHealthStatus.online || 0}
                        </span>
                                            </div>
                                            <div className="flex flex-col p-2 bg-orange-50 dark:bg-orange-950/20 rounded">
                        <span className="text-xs font-medium text-orange-900 dark:text-orange-100">
                          Offline
                        </span>
                                                <span className="text-lg font-bold text-orange-600">
                          {dtxHealthStatus.total_offline || 0}
                        </span>
                                            </div>
                                            <div className="flex flex-col p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
                        <span className="text-xs font-medium text-blue-900 dark:text-blue-100">
                          Uptime
                        </span>
                                                <span className="text-lg font-bold text-blue-600">
                          {dtxHealthStatus.avg_uptime_percentage?.toFixed(1) ||
                              0}
                                                    %
                        </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Regional Boundary Meter Health */}
                                {boundaryHealthStatus && (
                                    <div>
                                        <p className="text-sm font-medium mb-2">
                                            Regional Boundary Meter Health
                                        </p>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="flex flex-col p-2 bg-green-50 dark:bg-green-950/20 rounded">
                        <span className="text-xs font-medium text-green-900 dark:text-green-100">
                          Online
                        </span>
                                                <span className="text-lg font-bold text-green-600">
                          {boundaryHealthStatus.online || 0}
                        </span>
                                            </div>
                                            <div className="flex flex-col p-2 bg-orange-50 dark:bg-orange-950/20 rounded">
                        <span className="text-xs font-medium text-orange-900 dark:text-orange-100">
                          Offline
                        </span>
                                                <span className="text-lg font-bold text-orange-600">
                          {boundaryHealthStatus.total_offline || 0}
                        </span>
                                            </div>
                                            <div className="flex flex-col p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
                        <span className="text-xs font-medium text-blue-900 dark:text-blue-100">
                          Uptime
                        </span>
                                                <span className="text-lg font-bold text-blue-600">
                          {boundaryHealthStatus.avg_uptime_percentage?.toFixed(
                              1,
                          ) || 0}
                                                    %
                        </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Region Map */}
                <RegionMiniMap
                    regionName={regionProperCase}
                    districtGeometries={districtGeometriesWithConsumption}
                    meterCoordinates={meterCoordinates}
                />
            </div>

            {/* Region Performance Ranking */}
            {regionRanking && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Activity className="h-5 w-5 text-blue-600" />
                            <CardTitle>Regional Performance Comparison</CardTitle>
                        </div>
                        <CardDescription>
                            How this region compares nationally
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="text-center p-4 bg-muted rounded-lg">
                                <p className="text-sm text-muted-foreground mb-1">
                                    National Rank
                                </p>
                                <p className="text-3xl font-bold">#{regionRanking.rank}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    out of {regionRanking.total} regions
                                </p>
                            </div>
                            <div className="text-center p-4 bg-muted rounded-lg">
                                <p className="text-sm text-muted-foreground mb-1">
                                    Total Consumption
                                </p>
                                <p className="text-3xl font-bold text-blue-600">
                                    {formatNumber(regionRanking.consumption)}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">kWh</p>
                            </div>
                            <div className="text-center p-4 bg-muted rounded-lg">
                                <p className="text-sm text-muted-foreground mb-1">Percentile</p>
                                <p className="text-3xl font-bold text-green-600">
                                    {regionRanking.percentile.toFixed(0)}%
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    top performing
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-sm font-medium mb-2">
                                Top 5 Regions Nationally
                            </p>
                            {regionRanking.topRegions.map((r, idx) => (
                                <div
                                    key={r.region}
                                    className={`flex items-center justify-between p-3 rounded-lg border ${
                                        r.region === regionProperCase
                                            ? "bg-primary/10 border-primary"
                                            : "bg-background"
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 font-bold text-sm">
                                            {idx + 1}
                                        </div>
                                        <Link
                                            href={`/regions/${encodeURIComponent(r.region.toLowerCase())}`}
                                            className="font-medium hover:underline text-primary"
                                        >
                                            {r.region}
                                        </Link>
                                    </div>
                                    <p className="text-sm font-bold">
                                        {formatNumber(r.consumption)} kWh
                                    </p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Trading Partner Distribution */}
            {/*{(boundaryMetrics.imports.length > 0 || boundaryMetrics.exports.length > 0) && (*/}
            {/*    <div className="grid gap-4 md:grid-cols-2">*/}
            {/*        {boundaryMetrics.imports.length > 0 && (*/}
            {/*            <Card>*/}
            {/*                <CardHeader>*/}
            {/*                    <CardTitle>Import Sources Distribution</CardTitle>*/}
            {/*                </CardHeader>*/}
            {/*                <CardContent>*/}
            {/*                    <ResponsiveContainer width="100%" height={300}>*/}
            {/*                        <PieChart>*/}
            {/*                            <Pie*/}
            {/*                                data={boundaryMetrics.imports.slice(0, 5).map((item, index) => ({*/}
            {/*                                    name: toProperCase(item.partner),*/}
            {/*                                    value: item.value,*/}
            {/*                                    fill: `hsl(${(index * 360) / boundaryMetrics.imports.length}, 70%, 50%)`,*/}
            {/*                                }))}*/}
            {/*                                cx="50%"*/}
            {/*                                cy="50%"*/}
            {/*                                labelLine={false}*/}
            {/*                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}*/}
            {/*                                outerRadius={80}*/}
            {/*                                dataKey="value"*/}
            {/*                            >*/}
            {/*                                {boundaryMetrics.imports.slice(0, 5).map((_, index) => (*/}
            {/*                                    <Cell key={`cell-${index}`} fill={`hsl(${(index * 360) / boundaryMetrics.imports.length}, 70%, 50%)`} />*/}
            {/*                                ))}*/}
            {/*                            </Pie>*/}
            {/*                            <Tooltip formatter={(value: any) => formatNumber(value) + " kWh"} />*/}
            {/*                        </PieChart>*/}
            {/*                    </ResponsiveContainer>*/}
            {/*                </CardContent>*/}
            {/*            </Card>*/}
            {/*        )}*/}

            {/*        {boundaryMetrics.exports.length > 0 && (*/}
            {/*            <Card>*/}
            {/*                <CardHeader>*/}
            {/*                    <CardTitle>Export Destinations Distribution</CardTitle>*/}
            {/*                </CardHeader>*/}
            {/*                <CardContent>*/}
            {/*                    <ResponsiveContainer width="100%" height={300}>*/}
            {/*                        <PieChart>*/}
            {/*                            <Pie*/}
            {/*                                data={boundaryMetrics.exports.slice(0, 5).map((item, index) => ({*/}
            {/*                                    name: toProperCase(item.partner),*/}
            {/*                                    value: item.value,*/}
            {/*                                    fill: `hsl(${(index * 360) / boundaryMetrics.exports.length + 180}, 70%, 50%)`,*/}
            {/*                                }))}*/}
            {/*                                cx="50%"*/}
            {/*                                cy="50%"*/}
            {/*                                labelLine={false}*/}
            {/*                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}*/}
            {/*                                outerRadius={80}*/}
            {/*                                dataKey="value"*/}
            {/*                            >*/}
            {/*                                {boundaryMetrics.exports.slice(0, 5).map((_, index) => (*/}
            {/*                                    <Cell key={`cell-${index}`} fill={`hsl(${(index * 360) / boundaryMetrics.exports.length + 180}, 70%, 50%)`} />*/}
            {/*                                ))}*/}
            {/*                            </Pie>*/}
            {/*                            <Tooltip formatter={(value: any) => formatNumber(value) + " kWh"} />*/}
            {/*                        </PieChart>*/}
            {/*                    </ResponsiveContainer>*/}
            {/*                </CardContent>*/}
            {/*            </Card>*/}
            {/*        )}*/}
            {/*    </div>*/}
            {/*)}*/}

            {/* BSP Station Breakdown */}
            {bspMetrics.byStation.size > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>BSP Stations Breakdown</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Click station to view meter contributions
                        </p>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-10"></TableHead>
                                    <TableHead>Station</TableHead>
                                    <TableHead className="text-right">Import kWh</TableHead>
                                    <TableHead className="text-right">Export kWh</TableHead>
                                    <TableHead className="text-right">Net kWh</TableHead>
                                    <TableHead className="text-right">Meters</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Array.from(bspMetrics.byStation.entries())
                                    .sort((a, b) => b[1].import - a[1].import)
                                    .map(([station, data]) => {
                                        const isExpanded = expandedStations.has(station);
                                        const netKwh = data.import - data.export;

                                        return (
                                            <>
                                                <TableRow
                                                    key={station}
                                                    className="cursor-pointer hover:bg-muted/50"
                                                    onClick={() => toggleStation(station)}
                                                >
                                                    <TableCell>
                                                        {isExpanded ? (
                                                            <ChevronDown className="h-4 w-4" />
                                                        ) : (
                                                            <ChevronRight className="h-4 w-4" />
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        <Link
                                                            href={`/stations/${encodeURIComponent(station.toLowerCase())}`}
                                                            className="text-primary hover:underline"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            {station}
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {formatNumber(data.import)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {formatNumber(data.export)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold">
                                                        {formatNumber(netKwh)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {data.meters.size}
                                                    </TableCell>
                                                </TableRow>

                                                {/* Expanded Meters Table */}
                                                {isExpanded && (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="bg-muted/30 p-0">
                                                            <div className="p-4">
                                                                <p className="text-sm font-semibold mb-3">
                                                                    Meters ({data.meters.size}):
                                                                </p>
                                                                <Table>
                                                                    <TableHeader>
                                                                        <TableRow>
                                                                            <TableHead>Meter Number</TableHead>
                                                                            <TableHead className="text-right">
                                                                                Import kWh
                                                                            </TableHead>
                                                                            <TableHead className="text-right">
                                                                                Export kWh
                                                                            </TableHead>
                                                                            <TableHead className="text-right">
                                                                                Net kWh
                                                                            </TableHead>
                                                                            <TableHead className="text-right">
                                                                                % of Station
                                                                            </TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {(() => {
                                                                            // Calculate individual meter contributions
                                                                            const meterContributions = new Map<
                                                                                string,
                                                                                { import: number; export: number }
                                                                            >();

                                                                            if (
                                                                                bspDailyData &&
                                                                                Array.isArray(bspDailyData)
                                                                            ) {
                                                                                bspDailyData.forEach((record: any) => {
                                                                                    if (
                                                                                        record.region ===
                                                                                        regionProperCase &&
                                                                                        record.station === station &&
                                                                                        record.meter_number
                                                                                    ) {
                                                                                        if (
                                                                                            !meterContributions.has(
                                                                                                record.meter_number,
                                                                                            )
                                                                                        ) {
                                                                                            meterContributions.set(
                                                                                                record.meter_number,
                                                                                                { import: 0, export: 0 },
                                                                                            );
                                                                                        }

                                                                                        const contribution =
                                                                                            meterContributions.get(
                                                                                                record.meter_number,
                                                                                            )!;

                                                                                        if (
                                                                                            record.system_name ===
                                                                                            "import_kwh"
                                                                                        ) {
                                                                                            contribution.import +=
                                                                                                record.consumed_energy || 0;
                                                                                        } else if (
                                                                                            record.system_name ===
                                                                                            "export_kwh"
                                                                                        ) {
                                                                                            contribution.export +=
                                                                                                record.consumed_energy || 0;
                                                                                        }
                                                                                    }
                                                                                });
                                                                            }

                                                                            // Sort by net (highest first)
                                                                            const sortedMeters = Array.from(
                                                                                meterContributions.entries(),
                                                                            )
                                                                                .map(([meter, values]) => ({
                                                                                    meter,
                                                                                    import: values.import,
                                                                                    export: values.export,
                                                                                    net: values.import - values.export,
                                                                                }))
                                                                                .sort((a, b) => b.net - a.net);

                                                                            if (sortedMeters.length === 0) {
                                                                                return (
                                                                                    <TableRow>
                                                                                        <TableCell
                                                                                            colSpan={5}
                                                                                            className="text-center text-muted-foreground"
                                                                                        >
                                                                                            No meter data available
                                                                                        </TableCell>
                                                                                    </TableRow>
                                                                                );
                                                                            }

                                                                            return sortedMeters.map(
                                                                                ({
                                                                                     meter,
                                                                                     import: importVal,
                                                                                     export: exportVal,
                                                                                     net,
                                                                                 }) => {
                                                                                    const percentage =
                                                                                        data.import > 0
                                                                                            ? (importVal / data.import) * 100
                                                                                            : 0;

                                                                                    return (
                                                                                        <TableRow key={meter}>
                                                                                            <TableCell className="font-mono text-sm">
                                                                                                {meter}
                                                                                            </TableCell>
                                                                                            <TableCell className="text-right">
                                                                                                {formatNumber(importVal)}
                                                                                            </TableCell>
                                                                                            <TableCell className="text-right">
                                                                                                {formatNumber(exportVal)}
                                                                                            </TableCell>
                                                                                            <TableCell className="text-right font-semibold">
                                                                                                {formatNumber(net)}
                                                                                            </TableCell>
                                                                                            <TableCell className="text-right">
                                                                                                {formatNumber(percentage, 1)}%
                                                                                            </TableCell>
                                                                                        </TableRow>
                                                                                    );
                                                                                },
                                                                            );
                                                                        })()}

                                                                        {/* Total Row */}
                                                                        <TableRow className="font-semibold bg-muted/50">
                                                                            <TableCell>Total</TableCell>
                                                                            <TableCell className="text-right">
                                                                                {formatNumber(data.import)}
                                                                            </TableCell>
                                                                            <TableCell className="text-right">
                                                                                {formatNumber(data.export)}
                                                                            </TableCell>
                                                                            <TableCell className="text-right">
                                                                                {formatNumber(netKwh)}
                                                                            </TableCell>
                                                                            <TableCell className="text-right">
                                                                                100%
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </>
                                        );
                                    })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* DTX District Breakdown */}
            {dtxMetrics.byDistrict.size > 0 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Distribution Transformers in Region</CardTitle>
                                <CardDescription>
                                    Region → District → Meter (Click to expand)
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="relative overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-10"></TableHead>
                                        <TableHead className="font-semibold sticky left-0 bg-background z-10 border-r">
                                            District
                                        </TableHead>
                                        <TableHead className="text-right font-semibold">
                                            Consumption kWh
                                        </TableHead>
                                        <TableHead className="text-right font-semibold">
                                            % of Total
                                        </TableHead>
                                        <TableHead className="text-right font-semibold">
                                            Meters
                                        </TableHead>
                                        <TableHead className="text-right font-semibold w-32">
                                            Share
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {Array.from(dtxMetrics.byDistrict.entries())
                                        .sort((a, b) => b[1].consumption - a[1].consumption)
                                        .map(([district, data]) => {
                                            const isExpanded = expandedDistricts.has(district);
                                            const percentage =
                                                (data.consumption / dtxMetrics.consumption) * 100;

                                            return (
                                                <React.Fragment key={district}>
                                                    {/* District Row */}
                                                    <TableRow
                                                        className="cursor-pointer hover:bg-muted/50"
                                                        onClick={() => toggleDistrict(district)}
                                                    >
                                                        <TableCell>
                                                            {isExpanded ? (
                                                                <ChevronDown className="h-4 w-4" />
                                                            ) : (
                                                                <ChevronRight className="h-4 w-4" />
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="font-medium sticky left-0 bg-background z-10 border-r">
                                                            {district}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {formatNumber(data.consumption)}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {formatNumber(percentage, 1)}%
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {data.meters.size}
                                                        </TableCell>
                                                        <TableCell className="text-right font-semibold">
                                                            {formatNumber(percentage, 1)}%
                                                        </TableCell>
                                                    </TableRow>

                                                    {/* Drill-down: Meter Numbers */}
                                                    {isExpanded && (
                                                        <TableRow>
                                                            <TableCell colSpan={6}>
                                                                <Table>
                                                                    <TableBody>
                                                                        {Array.from(data.meters)
                                                                            .sort()
                                                                            .map((meterNum) => (
                                                                                <TableRow key={meterNum}>
                                                                                    <TableCell className="pl-10 font-mono text-xs sticky left-0 bg-background z-10">
                                                                                        {meterNum}
                                                                                    </TableCell>
                                                                                    <TableCell colSpan={5}></TableCell>
                                                                                </TableRow>
                                                                            ))}
                                                                    </TableBody>
                                                                </Table>
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
