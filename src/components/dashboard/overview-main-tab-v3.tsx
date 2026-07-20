"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Activity,
  TrendingUp,
  TrendingDown,
  Zap,
  ArrowRight,
  ArrowLeft,
  Info,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Filter,
  MapPin,
  ChevronUp,
  Map as MapIcon,
  Award,
  Search,
  ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConsumptionAggregate } from "@/hooks/api/use-consumption-aggregate-api";
import { useDailyConsumption } from "@/hooks/api/use-daily-consumption-api";
import {
  useMeterStatusSummary,
  useMeterStatusDetails,
  useMeterHealthSummary,
  useMeterHealthDetails,
} from "@/hooks/api/use-meter-status-api";
import {
  useConsumptionMetersRanking,
  useConsumptionTimeseriesIndividual,
  useTopBottomConsumers,
} from "@/hooks/api/use-consumption-api";
import { useRegionalBoundaryDaily } from "@/hooks/api/use-regional-boundary-api";
import { useCustomerConsumptionAggregate } from "@/hooks/api/use-customer-consumption-aggregate-api";
import { useMmsCustomerSalesAggregate } from "@/hooks/api/use-mms-customer-sales-aggregate-api";
import { useAmrConsumptionAggregate } from "@/hooks/api/use-amr-consumption-aggregate-api";
import { formatNumber } from "@/lib/utils";
import {
  ResponsiveContainer,
  Tooltip,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LineChart as RechartsLineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
} from "recharts";
import {
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LineChart } from "recharts";
import React from "react";

const InfoIcon = Info;

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart } from "recharts";

interface OverviewMainTabV3Props {
  dateRange: { start: string; end: string };
  filters?: {
    regions?: string[];
    districts?: string[];
    stations?: string[];
    boundaryMeteringPoints?: string[];
    meterTypes?: string[];
    voltages?: number[];
    locations?: string[];
    feeders?: string[];
  };
  /** Fill parent height without page-level vertical scroll */
  compact?: boolean;
}

export function OverviewMainTabV3({
  dateRange,
  filters = {},
  compact = false,
}: OverviewMainTabV3Props) {
  const [drillDownView, setDrillDownView] = useState<
    null | "meters" | "map" | "single-meter"
  >(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [regionalViewMode, setRegionalViewMode] = useState<
    "net" | "import" | "export"
  >("import");
  const [regionalMeterTypeFilters, setRegionalMeterTypeFilters] = useState<
    Set<string>
  >(new Set());
  const [categoryViewMode, setCategoryViewMode] = useState<
    "net" | "import" | "export"
  >("net");
  const [consumptionViewMode, setConsumptionViewMode] = React.useState<
    "net" | "import" | "export"
  >("net");
  const [meterSearchQuery, setMeterSearchQuery] = React.useState("");
  const [metersPerPage] = React.useState(20);
  const [healthPage, setHealthPage] = React.useState(1);
  const [healthCategoryFilter, setHealthCategoryFilter] =
    React.useState<string>("");
  const [healthMeterTypeFilter, setHealthMeterTypeFilter] =
    React.useState<string>("");
  const [currentMeterPage, setCurrentMeterPage] = useState<number>(1);
  const [individualMetricTab, setIndividualMetricTab] = useState<string>("net");

  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(
    new Set(),
  );
  const [expandedTableRegions, setExpandedTableRegions] = useState<Set<string>>(
    new Set(),
  );

  const [selectedMeterTypes, setSelectedMeterTypes] = useState<Set<string>>(
    new Set(["ALL"]),
  );
  const [selectedBalanceMeterTypes, setSelectedBalanceMeterTypes] = useState<
    Set<string>
  >(new Set(["ALL"]));
  const [consumptionMeterTypeFilter, setConsumptionMeterTypeFilter] = useState<
    Set<string>
  >(new Set(["ALL"]));
  const [selectedChartMeterTypes, setSelectedChartMeterTypes] = useState<
    Set<string>
  >(new Set(["ALL"]));

  const [selectedChartRegions, setSelectedChartRegions] = useState<Set<string>>(
    new Set(["ALL"]),
  );

  const [cumulateRegions, setCumulateRegions] = useState(false);
  const [cumulateMeterTypes, setCumulateMeterTypes] = useState(false);

  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const [groupBy, setGroupBy] = useState<string>("meter_type");

  const [rankingColumns, setRankingColumns] = useState({
    showNetKwh: false,
    showAvgDaily: false,
  });

  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const [selectedMeterNumber, setSelectedMeterNumber] = useState<string | null>(
    null,
  );

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const params = {
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    region:
      filters.regions && filters.regions.length > 0
        ? filters.regions
        : undefined,
    district:
      filters.districts && filters.districts.length > 0
        ? filters.districts
        : undefined,
    station:
      filters.stations && filters.stations.length > 0
        ? filters.stations
        : undefined,
    boundaryMeteringPoint:
      filters.boundaryMeteringPoints &&
      filters.boundaryMeteringPoints.length > 0
        ? filters.boundaryMeteringPoints
        : undefined,
    meterType:
      filters.meterTypes && filters.meterTypes.length > 0
        ? filters.meterTypes
        : undefined,
    voltage_kv:
      filters.voltages && filters.voltages.length > 0
        ? filters.voltages
        : undefined,
  };

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleRegionalMeterType = (meterType: string) => {
    setRegionalMeterTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(meterType)) {
        next.delete(meterType);
      } else {
        next.add(meterType);
      }
      return next;
    });
  };

  const meterStatusParams = {
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    regions: filters.regions,
    districts: filters.districts,
    stations: filters.stations,
    boundaryMeteringPoints: filters.boundaryMeteringPoints,
    meterTypes: filters.meterTypes,
    voltages: filters.voltages,
  };

  const { data: aggregateData, isLoading: aggregateLoading } =
    useConsumptionAggregate(params);
  const { data: meterStatusSummary, isLoading: isLoadingSummaryStatus } =
    useMeterStatusSummary(meterStatusParams);

  const { data: meterRankings, isLoading: rankingsLoading } =
    useDailyConsumption(params);

  const allMetersForHealth = useMeterStatusDetails({
    ...meterStatusParams,
    limit: 10000,
    page: 1,
  });
  const allMetersForBreakdown = useConsumptionTimeseriesIndividual({
    start_date: params.dateFrom || "",
    end_date: params.dateTo || "",
    view: "individual",
    limit: 100,
  });

  const { data: topBottomConsumersData, isLoading: topBottomLoading } =
    useTopBottomConsumers({
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
      regions: filters.regions?.length > 0 ? filters.regions : undefined,
      districts: filters.districts?.length > 0 ? filters.districts : undefined,
      stations: filters.stations?.length > 0 ? filters.stations : undefined,
      boundaryMeteringPoints:
        filters.boundaryMeteringPoints?.length > 0
          ? filters.boundaryMeteringPoints
          : undefined,
      meterTypes:
        filters.meterTypes?.length > 0 ? filters.meterTypes : undefined,
      voltages: filters.voltages?.length > 0 ? filters.voltages : undefined,
    });

  const boundaryDataParams = {
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    regions: filters.regions,
    districts: filters.districts,
    stations: filters.stations,
    meterTypes: ["REGIONAL_BOUNDARY"],
    voltages: filters.voltages,
  };

  const { data: rawBoundaryMeterData, isLoading: isBoundaryDataLoading } =
    useRegionalBoundaryDaily(boundaryDataParams);

  const customerSalesParams = {
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    region:
      filters.regions && filters.regions.length > 0
        ? filters.regions?.[0]
        : undefined,
  };

  const {
    data: customerConsumptionDataArray,
    isLoading: customerConsumptionLoading,
  } = useCustomerConsumptionAggregate(customerSalesParams);

  const { data: mmsAggregateData, isLoading: mmsAggregateLoading } =
    useMmsCustomerSalesAggregate({
      groupBy: "region",
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
    });

  const { data: amrAggregateData, isLoading: amrAggregateLoading } =
    useAmrConsumptionAggregate({
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
    });

  const energyPurchases = useMemo(() => {
    if (!aggregateData?.rawData || aggregateData.rawData.length === 0) {
      return 0;
    }

    return aggregateData.rawData
      .filter(
        (item: any) =>
          item.meter_type === "BSP" && item.system_name === "import_kwh",
      )
      .reduce(
        (sum: number, item: any) =>
          sum + (Number.parseFloat(item.total_consumption) || 0),
        0,
      );
  }, [aggregateData?.rawData]);

  const energySales = useMemo(() => {
    const zeusKwh =
      customerConsumptionDataArray && customerConsumptionDataArray.length > 0
        ? customerConsumptionDataArray.reduce(
            (sum: number, item: any) =>
              sum + (item.sum_lastbillconsumption || 0),
            0,
          )
        : 0;

    const mmsKwh =
      mmsAggregateData && mmsAggregateData.length > 0
        ? mmsAggregateData.reduce(
            (sum: number, item: any) =>
              sum + (item.sum_last_month_kwh_read || 0),
            0,
          )
        : 0;

    const amrKwh =
      amrAggregateData && amrAggregateData.length > 0
        ? amrAggregateData.reduce(
            (sum: number, item: any) => sum + (item.total_consumption || 0),
            0,
          )
        : 0;

    if (zeusKwh === 0 && mmsKwh === 0 && amrKwh === 0) return null;

    return zeusKwh + mmsKwh + amrKwh;
  }, [customerConsumptionDataArray, mmsAggregateData, amrAggregateData]);

  const systemLosses = useMemo(() => {
    if (energySales === null || energyPurchases === 0) {
      return {
        kwh: null,
        percentage: null,
      };
    }

    const lossKwh = energyPurchases - energySales;
    const lossPercentage = (lossKwh / energyPurchases) * 100;

    return {
      kwh: lossKwh,
      percentage: lossPercentage,
    };
  }, [energyPurchases, energySales]);

  // Same severity scale as marquee: green <10%, amber <25%, red ≥25%
  const systemLossColorClass =
    systemLosses.percentage === null
      ? "text-muted-foreground"
      : systemLosses.percentage < 10
        ? "text-green-700"
        : systemLosses.percentage < 25
          ? "text-amber-700"
          : "text-red-600";

  const meterHealthSummary = useMeterHealthSummary({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    regions: filters.regions,
    districts: filters.districts,
    stations: filters.stations,
    meterTypes: filters.meterTypes,
    locations: filters.locations,
    voltages: filters.voltages,
  });

  const meterHealthDetails = useMeterHealthDetails({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    regions: filters.regions,
    districts: filters.districts,
    stations: filters.stations,
    meterTypes: healthMeterTypeFilter
      ? [healthMeterTypeFilter]
      : filters.meterTypes,
    locations: filters.locations,
    voltages: filters.voltages,
    page: healthPage,
    limit: 50,
    healthCategory: healthCategoryFilter,
  });

  const healthPercentage =
    meterHealthSummary.data?.data?.health_percentage || 0;
  const onlineMeters = meterHealthSummary.data?.data?.online_meters || 0;
  const totalMeters = meterHealthSummary.data?.data?.total_meters || 0;
  const isLoadingSummary = meterHealthSummary.isLoading;

  // Server-side aggregate, grouped over ALL meters — unlike
  // meterHealthAnalytics.byMeterType (below), which is computed client-side
  // from a status/details call capped at 200 rows and so undercounts badly
  // once there are more meters than that.
  const byMeterTypeFromSummary = useMemo(
    () =>
      (meterHealthSummary.data?.data?.by_meter_type || []).map((mt) => ({
        type: mt.meter_type,
        online: mt.online,
        offline: mt.offline,
      })),
    [meterHealthSummary.data],
  );

  const meterHealthAnalytics = useMemo(() => {
    const meters = allMetersForHealth.data?.data || [];

    if (meters.length === 0) {
      return {
        totalMeters: 0,
        onlineMeters: 0,
        offlineMeters: 0,
        averageUptime: 0,
        uptimeDistribution: [],
        performanceTiers: [],
        byMeterType: [],
        byRegion: [],
        byStation: [],
      };
    }

    const totalMeters = meters.length;
    const onlineMeters = meters.filter((m) => m.status === "ONLINE").length;
    const offlineMeters = totalMeters - onlineMeters;
    const averageUptime =
      meters.reduce((sum, m) => sum + (m.uptime_percentage || 0), 0) /
      totalMeters;

    const uptimeRanges = [
      { range: "0-20%", min: 0, max: 20, count: 0 },
      { range: "20-40%", min: 20, max: 40, count: 0 },
      { range: "40-60%", min: 40, max: 60, count: 0 },
      { range: "60-80%", min: 60, max: 80, count: 0 },
      { range: "80-100%", min: 80, max: 100, count: 0 },
    ];

    meters.forEach((meter) => {
      const uptime = meter.uptime_percentage || 0;
      const range = uptimeRanges.find(
        (r) => uptime >= r.min && uptime <= r.max,
      );
      if (range) range.count++;
    });

    const excellent = meters.filter(
      (m) => (m.uptime_percentage || 0) > 95,
    ).length;
    const good = meters.filter(
      (m) =>
        (m.uptime_percentage || 0) > 80 && (m.uptime_percentage || 0) <= 95,
    ).length;
    const fair = meters.filter(
      (m) =>
        (m.uptime_percentage || 0) > 50 && (m.uptime_percentage || 0) <= 80,
    ).length;
    const poor = meters.filter((m) => (m.uptime_percentage || 0) <= 50).length;

    const performanceTiers = [
      {
        tier: "Excellent (>95%)",
        count: excellent,
        percentage: (excellent / totalMeters) * 100,
      },
      {
        tier: "Good (80-95%)",
        count: good,
        percentage: (good / totalMeters) * 100,
      },
      {
        tier: "Fair (50-80%)",
        count: fair,
        percentage: (fair / totalMeters) * 100,
      },
      {
        tier: "Poor (<50%)",
        count: poor,
        percentage: (poor / totalMeters) * 100,
      },
    ];

    const meterTypeMap = new Map<
      string,
      { online: number; offline: number; totalUptime: number; count: number }
    >();
    meters.forEach((meter) => {
      const type = meter.meter_type || "Unknown";
      if (!meterTypeMap.has(type)) {
        meterTypeMap.set(type, {
          online: 0,
          offline: 0,
          totalUptime: 0,
          count: 0,
        });
      }
      const stats = meterTypeMap.get(type)!;
      if (meter.status === "ONLINE") stats.online++;
      else stats.offline++;
      stats.totalUptime += meter.uptime_percentage || 0;
      stats.count++;
    });

    const byMeterType = Array.from(meterTypeMap.entries()).map(
      ([type, stats]) => ({
        type,
        online: stats.online,
        offline: stats.offline,
        avgUptime: stats.totalUptime / stats.count,
      }),
    );

    const regionMap = new Map<
      string,
      { online: number; offline: number; totalUptime: number; count: number }
    >();
    meters.forEach((meter) => {
      const region = meter.region || "Unknown";
      if (!regionMap.has(region)) {
        regionMap.set(region, {
          online: 0,
          offline: 0,
          totalUptime: 0,
          count: 0,
        });
      }
      const stats = regionMap.get(region)!;
      if (meter.status === "ONLINE") stats.online++;
      else stats.offline++;
      stats.totalUptime += meter.uptime_percentage || 0;
      stats.count++;
    });

    const byRegion = Array.from(regionMap.entries()).map(([region, stats]) => ({
      region,
      online: stats.online,
      offline: stats.offline,
      avgUptime: stats.totalUptime / stats.count,
    }));

    const stationMap = new Map<
      string,
      { online: number; offline: number; totalUptime: number; count: number }
    >();
    meters.forEach((meter) => {
      const station = meter.station || "Unknown";
      if (!stationMap.has(station)) {
        stationMap.set(station, {
          online: 0,
          offline: 0,
          totalUptime: 0,
          count: 0,
        });
      }
      const stats = stationMap.get(station)!;
      if (meter.status === "ONLINE") stats.online++;
      else stats.offline++;
      stats.totalUptime += meter.uptime_percentage || 0;
      stats.count++;
    });

    const byStation = Array.from(stationMap.entries())
      .map(([station, stats]) => ({
        station,
        online: stats.online,
        offline: stats.offline,
        avgUptime: stats.totalUptime / stats.count,
        totalMeters: stats.count,
      }))
      .sort((a, b) => b.avgUptime - a.avgUptime);

    return {
      totalMeters,
      onlineMeters,
      offlineMeters,
      averageUptime,
      uptimeDistribution: uptimeRanges,
      performanceTiers,
      byMeterType,
      byRegion,
      byStation,
    };
  }, [allMetersForHealth.data]);

  const meterTypeBreakdownData = useMemo(() => {
    if (!aggregateData?.rawData || aggregateData.rawData.length === 0) {
      return [];
    }

    const aggregated: Record<
      string,
      { import: number; export: number; net: number }
    > = {};

    aggregateData.rawData.forEach((item: any) => {
      const meterType = item.meter_type || "Unknown";
      const consumption = Number.parseFloat(item.total_consumption) || 0;

      if (!aggregated[meterType]) {
        aggregated[meterType] = { import: 0, export: 0, net: 0 };
      }

      if (item.system_name === "import_kwh") {
        aggregated[meterType].import += consumption;
      } else if (item.system_name === "export_kwh") {
        aggregated[meterType].export += consumption;
      }
    });

    Object.keys(aggregated).forEach((meterType) => {
      aggregated[meterType].net =
        aggregated[meterType].import - aggregated[meterType].export;
    });

    const METER_ORDER = [
      "BSP",
      "REGIONAL_BOUNDARY",
      "DISTRICT_BOUNDARY",
      "DTX",
    ];

    return Object.entries(aggregated)
      .map(([meterType, values]) => ({
        meter_type: meterType,
        total_import_kwh: values.import,
        total_export_kwh: values.export,
        net_kwh: values.net,
      }))
      .sort((a, b) => {
        const ai = METER_ORDER.indexOf(a.meter_type);
        const bi = METER_ORDER.indexOf(b.meter_type);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
  }, [aggregateData?.rawData]);

  const regionalBreakdownData = useMemo(() => {
    if (!aggregateData?.rawData || aggregateData.rawData.length === 0) {
      return [];
    }

    const aggregated: Record<
      string,
      { import: number; export: number; net: number }
    > = {};

    aggregateData.rawData.forEach((item: any) => {
      if (
        item.meter_type === "DISTRICT_BOUNDARY" ||
        item.meter_type === "REGIONAL_BOUNDARY"
      ) {
        return;
      }

      const region = item.region || "Unknown";

      if (region === "Unknown") {
        return;
      }

      const consumption = Number.parseFloat(item.total_consumption) || 0;

      if (!aggregated[region]) {
        aggregated[region] = { import: 0, export: 0, net: 0 };
      }

      if (item.system_name === "import_kwh") {
        aggregated[region].import += consumption;
      } else if (item.system_name === "export_kwh") {
        aggregated[region].export += consumption;
      }
    });

    Object.keys(aggregated).forEach((region) => {
      aggregated[region].net =
        aggregated[region].import - aggregated[region].export;
    });

    return Object.entries(aggregated)
      .map(([region, values]) => ({
        region,
        total_import_kwh: values.import,
        total_export_kwh: values.export,
        net_kwh: values.net,
      }))
      .sort((a, b) => b.total_import_kwh - a.total_import_kwh);
  }, [aggregateData?.rawData]);

  const totalImport = aggregateData?.totalImportKwh || 0;
  const totalExport = aggregateData?.totalExportKwh || 0;
  const netConsumption = aggregateData?.netKwh || 0;
  const totalConsumption = aggregateData?.totalConsumption || 0;

  const onlineMetersOld = meterStatusSummary?.online || 0;
  const totalMetersOld = meterStatusSummary?.total || 0;
  const offlineMetersOld = totalMetersOld - onlineMetersOld;
  const healthPercentageOld =
    totalMetersOld > 0
      ? Math.round((onlineMetersOld / totalMetersOld) * 100)
      : 0;

  const COLORS = [
    "hsl(142, 76%, 36%)",
    "hsl(221, 83%, 53%)",
    "hsl(45, 93%, 47%)",
    "hsl(280, 65%, 60%)",
    "hsl(0, 59%, 41%)",
    "hsl(188, 68%, 32%)",
  ];

  const pieData = useMemo(() => {
    if (!meterTypeBreakdownData || meterTypeBreakdownData.length === 0) {
      return [];
    }
    return meterTypeBreakdownData.map((item: any) => ({
      name: item.meter_type || "Unknown",
      value: item.total_import_kwh || 0,
    }));
  }, [meterTypeBreakdownData]);

  const meterTypeCountBreakdown = useMemo(() => {
    if (
      !allMetersForBreakdown?.data ||
      !allMetersForBreakdown.data.individual
    ) {
      return [];
    }

    const breakdown: Record<
      string,
      { online: number; total: number; meterNumbers: Set<string> }
    > = {};

    allMetersForBreakdown.data.individual.forEach((meter) => {
      const meterType = meter.meter_type || "Unknown";

      if (!breakdown[meterType]) {
        breakdown[meterType] = { online: 0, total: 0, meterNumbers: new Set() };
      }

      if (!breakdown[meterType].meterNumbers.has(meter.meter_number)) {
        breakdown[meterType].meterNumbers.add(meter.meter_number);
        breakdown[meterType].total += 1;

        if (meter.status === "online") {
          breakdown[meterType].online += 1;
        }
      }
    });

    return Object.entries(breakdown)
      .map(([meterType, data]) => ({
        meterType,
        online: data.online,
        total: data.total,
      }))
      .sort((a, b) => b.total - a.total);
  }, [allMetersForBreakdown?.data]);

  const regionalData = regionalBreakdownData;

  const consumptionTrendData = useMemo(() => {
    if (!aggregateData?.rawData || aggregateData.rawData.length === 0)
      return [];

    const dateMap = new Map<
      string,
      {
        date: string;
        import: number;
        export: number;
        net: number;
        by_meter_type: Record<
          string,
          { import: number; export: number; net: number }
        >;
      }
    >();

    aggregateData.rawData.forEach((record) => {
      if (!record.group_period) return;
      const date = record.group_period.split("T")[0];
      const meterType = record.meter_type || "Unknown";

      if (!dateMap.has(date)) {
        dateMap.set(date, {
          date,
          import: 0,
          export: 0,
          net: 0,
          by_meter_type: {},
        });
      }

      const dayData = dateMap.get(date)!;
      const consumption = record.total_consumption || 0;

      if (!dayData.by_meter_type[meterType]) {
        dayData.by_meter_type[meterType] = { import: 0, export: 0, net: 0 };
      }

      const meterTypeData = dayData.by_meter_type[meterType];

      if (record.system_name === "import_kwh") {
        dayData.import += consumption;
        meterTypeData.import += consumption;
      } else if (record.system_name === "export_kwh") {
        dayData.export += consumption;
        meterTypeData.export += consumption;
      }

      meterTypeData.net = meterTypeData.import - meterTypeData.export;
    });

    dateMap.forEach((value) => {
      value.net = value.import - value.export;
    });

    return Array.from(dateMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }, [aggregateData]);

  const filteredConsumptionTrendData = useMemo(() => {
    if (!aggregateData?.rawData || aggregateData.rawData.length === 0)
      return [];

    if (consumptionMeterTypeFilter.has("ALL")) {
      return consumptionTrendData;
    }

    const dateMap = new Map<
      string,
      { date: string; import: number; export: number; net: number }
    >();

    aggregateData.rawData.forEach((record) => {
      if (!record.group_period) return;

      const meterType = record.meter_type || "Unknown";
      if (!consumptionMeterTypeFilter.has(meterType)) return;

      const date = record.group_period.split("T")[0];

      if (!dateMap.has(date)) {
        dateMap.set(date, { date, import: 0, export: 0, net: 0 });
      }

      const dayData = dateMap.get(date)!;
      if (record.system_name === "import_kwh") {
        dayData.import += record.total_consumption;
      } else if (record.system_name === "export_kwh") {
        dayData.export += record.total_consumption;
      }
    });

    dateMap.forEach((value) => {
      value.net = value.import - value.export;
    });

    return Array.from(dateMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }, [
    aggregateData?.rawData,
    consumptionMeterTypeFilter,
    consumptionTrendData,
  ]);

  const timeSeriesData = useMemo(() => {
    if (!aggregateData?.rawData) return [];

    const grouped = new Map<
      string,
      { date: string; import: number; export: number; net: number }
    >();

    aggregateData.rawData.forEach((record: any) => {
      const date = record.group_period;
      const existing = grouped.get(date) || {
        date,
        import: 0,
        export: 0,
        net: 0,
      };

      if (record.system_name === "import_kwh") {
        existing.import += record.total_consumption || 0;
      } else if (record.system_name === "export_kwh") {
        existing.export += record.total_consumption || 0;
      }

      grouped.set(date, existing);
    });

    return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        net: item.import - item.export,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [aggregateData?.rawData]);

  const consumptionStats = useMemo(() => {
    if (timeSeriesData.length === 0) return null;

    const imports = timeSeriesData.map((d) => d.import);
    const exports = timeSeriesData.map((d) => d.export);
    const nets = timeSeriesData.map((d) => d.net);

    return {
      avgDaily:
        nets.length > 0 ? nets.reduce((a, b) => a + b, 0) / nets.length : 0,
      peakImport: imports.length > 0 ? Math.max(...imports) : 0,
      peakExport: exports.length > 0 ? Math.max(...exports) : 0,
      peakNet: nets.length > 0 ? Math.max(...nets) : 0,
      minNet: nets.length > 0 ? Math.min(...nets) : 0,
      importExportRatio: totalExport > 0 ? totalImport / totalExport : 0,
    };
  }, [timeSeriesData, totalImport, totalExport]);

  const aggregateDataRegionAnalytics = useMemo(() => {
    if (!aggregateData?.rawData)
      return { regions: [], allDates: [], availableMeterTypes: [] };

    const regionMap = new Map<
      string,
      {
        daily: Map<string, { import: number; export: number; net: number }>;
        dailyByMeterType: Map<
          string,
          Map<string, { import: number; export: number; net: number }>
        >;
        total: { import: number; export: number; net: number };
        totalByMeterType: Map<
          string,
          { import: number; export: number; net: number }
        >;
      }
    >();

    const allDatesSet = new Set<string>();
    const meterTypesSet = new Set<string>();

    aggregateData.rawData.forEach((record: any) => {
      const region = record.region || "Unknown";

      if (region === "Unknown") {
        return;
      }

      const date = record.group_period;
      const meterType = record.meter_type || "Unknown";

      allDatesSet.add(date);
      meterTypesSet.add(meterType);

      if (!regionMap.has(region)) {
        regionMap.set(region, {
          daily: new Map(),
          dailyByMeterType: new Map(),
          total: { import: 0, export: 0, net: 0 },
          totalByMeterType: new Map(),
        });
      }

      const regionData = regionMap.get(region)!;

      if (!regionData.daily.has(date)) {
        regionData.daily.set(date, { import: 0, export: 0, net: 0 });
      }

      if (!regionData.dailyByMeterType.has(meterType)) {
        regionData.dailyByMeterType.set(meterType, new Map());
        regionData.totalByMeterType.set(meterType, {
          import: 0,
          export: 0,
          net: 0,
        });
      }

      const meterTypeDaily = regionData.dailyByMeterType.get(meterType)!;
      if (!meterTypeDaily.has(date)) {
        meterTypeDaily.set(date, { import: 0, export: 0, net: 0 });
      }

      const dailyData = regionData.daily.get(date)!;
      const meterTypeDailyData = meterTypeDaily.get(date)!;
      const meterTypeTotalData = regionData.totalByMeterType.get(meterType)!;
      const consumption = record.total_consumption || 0;

      if (record.system_name === "import_kwh") {
        dailyData.import += consumption;
        meterTypeDailyData.import += consumption;
        regionData.total.import += consumption;
        meterTypeTotalData.import += consumption;
      } else if (record.system_name === "export_kwh") {
        dailyData.export += consumption;
        meterTypeDailyData.export += consumption;
        regionData.total.export += consumption;
        meterTypeTotalData.export += consumption;
      }

      dailyData.net = dailyData.import - dailyData.export;
      meterTypeDailyData.net =
        meterTypeDailyData.import - meterTypeDailyData.export;
      regionData.total.net = regionData.total.import - regionData.total.export;
      meterTypeTotalData.net =
        meterTypeTotalData.import - meterTypeTotalData.export;
    });

    const allDates = Array.from(allDatesSet).sort();
    const availableMeterTypes = Array.from(meterTypesSet).sort();

    const regions = Array.from(regionMap.entries())
      .map(([region, data]) => {
        const sortedDays = Array.from(data.daily.entries()).sort(
          (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime(),
        );

        const midpoint = Math.floor(sortedDays.length / 2);
        const firstHalf = sortedDays.slice(0, midpoint);
        const secondHalf = sortedDays.slice(midpoint);

        const firstHalfAvg =
          firstHalf.length > 0
            ? firstHalf.reduce((sum, [_, d]) => sum + d.net, 0) /
              firstHalf.length
            : 0;
        const secondHalfAvg =
          secondHalf.length > 0
            ? secondHalf.reduce((sum, [_, d]) => sum + d.net, 0) /
              secondHalf.length
            : 0;

        const growthRate =
          firstHalfAvg !== 0
            ? ((secondHalfAvg - firstHalfAvg) / Math.abs(firstHalfAvg)) * 100
            : 0;

        const dataPoints = allDates.map((date) => {
          const dayData = data.daily.get(date) || {
            import: 0,
            export: 0,
            net: 0,
          };
          return {
            date,
            import: dayData.import,
            export: dayData.export,
            net: dayData.net,
          };
        });

        const meterTypeBreakdown = Array.from(
          data.dailyByMeterType.entries(),
        ).map(([meterType, dailyMap]) => {
          const dataPoints = allDates.map((date) => {
            const dayData = dailyMap.get(date) || {
              import: 0,
              export: 0,
              net: 0,
            };
            return {
              date,
              import: dayData.import,
              export: dayData.export,
              net: dayData.net,
            };
          });

          const totals = data.totalByMeterType.get(meterType) || {
            import: 0,
            export: 0,
            net: 0,
          };

          return {
            meterType,
            dataPoints,
            totalImport: totals.import,
            totalExport: totals.export,
            totalNet: totals.net,
          };
        });

        return {
          region,
          totalImport: data.total.import,
          totalExport: data.total.export,
          totalNet: data.total.net,
          dailyAvg: data.daily.size > 0 ? data.total.net / data.daily.size : 0,
          growthRate,
          trend:
            growthRate > 5
              ? "increasing"
              : growthRate < -5
                ? "decreasing"
                : "stable",
          dataPoints,
          meterTypeBreakdown,
        };
      })
      .sort((a, b) => Math.abs(b.totalNet) - Math.abs(a.totalNet));

    return { regions, allDates, availableMeterTypes };
  }, [aggregateData?.rawData]);

  const singleRegionBoundaryPoints = useMemo(() => {
    if (!rawBoundaryMeterData || !selectedRegion) return [];

    const boundaryMap = new Map<string, { import: number; export: number }>();

    rawBoundaryMeterData.forEach((record: any) => {
      const boundaryPoint = record.boundary_metering_point;
      if (!boundaryPoint) return;

      if (!boundaryPoint.includes(selectedRegion)) return;

      if (!boundaryMap.has(boundaryPoint)) {
        boundaryMap.set(boundaryPoint, { import: 0, export: 0 });
      }

      const boundaryData = boundaryMap.get(boundaryPoint)!;
      const consumption = record.consumed_energy || 0;

      if (record.system_name === "import_kwh") {
        boundaryData.import += consumption;
      } else if (record.system_name === "export_kwh") {
        boundaryData.export += consumption;
      }
    });

    return Array.from(boundaryMap.entries())
      .map(([boundaryPoint, data]) => ({
        boundaryPoint,
        totalImport: data.import,
        totalExport: data.export,
        totalNet: data.import - data.export,
      }))
      .sort((a, b) => Math.abs(b.totalNet) - Math.abs(a.totalNet));
  }, [rawBoundaryMeterData, selectedRegion]);

  const singleRegionBoundaryLocationBreakdown = useMemo(() => {
    if (!rawBoundaryMeterData || !selectedRegion) return [];

    if (rawBoundaryMeterData.length > 0) {
    }

    const boundaryLocationMap = new Map<
      string,
      Map<
        string,
        {
          meters: Map<
            string,
            { import: number; export: number; station?: string }
          >;
          import: number;
          export: number;
        }
      >
    >();

    let recordsProcessed = 0;
    let recordsWithBoundary = 0;
    let matchingRegionRecords = 0;
    let recordsWithLocation = 0;

    rawBoundaryMeterData.forEach((record: any) => {
      const boundaryPoint = record.boundary_metering_point;
      const location =
        record.location ||
        record.region ||
        record.station ||
        record.district ||
        "Unknown";
      const meterNumber = record.meter_number;

      recordsProcessed++;

      if (recordsProcessed <= 3) {
      }

      if (!boundaryPoint) return;
      recordsWithBoundary++;

      if (!boundaryPoint.includes(selectedRegion)) return;
      matchingRegionRecords++;

      if (location && location !== "Unknown") {
        recordsWithLocation++;
      }

      if (!boundaryLocationMap.has(boundaryPoint)) {
        boundaryLocationMap.set(boundaryPoint, new Map());
      }

      const locationMap = boundaryLocationMap.get(boundaryPoint)!;

      if (!locationMap.has(location)) {
        locationMap.set(location, {
          meters: new Map(),
          import: 0,
          export: 0,
        });
      }

      const locationData = locationMap.get(location)!;

      if (meterNumber && !locationData.meters.has(meterNumber)) {
        locationData.meters.set(meterNumber, {
          import: 0,
          export: 0,
          station: record.station,
        });
      }

      const consumption = record.consumed_energy || 0;

      if (record.system_name === "import_kwh") {
        locationData.import += consumption;
        if (meterNumber) {
          locationData.meters.get(meterNumber)!.import += consumption;
        }
      } else if (record.system_name === "export_kwh") {
        locationData.export += consumption;
        if (meterNumber) {
          locationData.meters.get(meterNumber)!.export += consumption;
        }
      }
    });

    const result: Array<{
      boundaryPoint: string;
      location: string;
      meterCount: number;
      totalImport: number;
      totalExport: number;
      netFlow: number;
      meters: Array<{
        meterNumber: string;
        import: number;
        export: number;
        netFlow: number;
        station?: string;
      }>;
    }> = [];

    boundaryLocationMap.forEach((locationMap, boundaryPoint) => {
      const boundaryPointTotal = { import: 0, export: 0 };

      locationMap.forEach((data, location) => {
        const netFlow = data.import - data.export;

        const metersArray = Array.from(data.meters.entries())
          .map(([meterNumber, meterData]) => ({
            meterNumber,
            import: meterData.import,
            export: meterData.export,
            netFlow: meterData.import - meterData.export,
            station: meterData.station,
          }))
          .sort((a, b) => Math.abs(b.netFlow) - Math.abs(a.netFlow));

        boundaryPointTotal.import += data.import;
        boundaryPointTotal.export += data.export;

        result.push({
          boundaryPoint,
          location,
          meterCount: data.meters.size,
          totalImport: data.import,
          totalExport: data.export,
          netFlow: netFlow,
          meters: metersArray,
        });
      });
    });

    return result.sort((a, b) => {
      if (a.boundaryPoint !== b.boundaryPoint) {
        return a.boundaryPoint.localeCompare(b.boundaryPoint);
      }
      return (
        Math.abs(b.totalImport + b.totalExport) -
        Math.abs(a.totalImport + a.totalExport)
      );
    });
  }, [rawBoundaryMeterData, selectedRegion]);

  const singleRegionStationBreakdown = useMemo(() => {
    if (!aggregateData?.rawData || !selectedRegion) return [];

    const regionData = aggregateDataRegionAnalytics.regions.find(
      (r) => r.region === selectedRegion,
    );
    if (!regionData) return [];

    const stationMap = new Map<
      string,
      {
        daily: Map<string, { import: number; export: number }>;
        total: { import: number; export: number };
        meterCount: number;
      }
    >();

    aggregateData.rawData.forEach((record: any) => {
      if (record.region !== selectedRegion) return;

      const station = record.station || "Unknown";
      if (station === "Unknown") {
        return;
      }

      const date = record.group_period;

      if (!stationMap.has(station)) {
        stationMap.set(station, {
          daily: new Map(),
          total: { import: 0, export: 0 },
          meterCount: 0,
        });
      }

      const stationData = stationMap.get(station)!;

      if (!stationData.daily.has(date)) {
        stationData.daily.set(date, { import: 0, export: 0 });
      }

      const dailyData = stationData.daily.get(date)!;
      const consumption = record.total_consumption || 0;

      if (record.system_name === "import_kwh") {
        dailyData.import += consumption;
        stationData.total.import += consumption;
      } else if (record.system_name === "export_kwh") {
        dailyData.export += consumption;
        stationData.total.export += consumption;
      }
    });

    return Array.from(stationMap.entries())
      .map(([station, data]) => ({
        station,
        totalImport: data.total.import,
        totalExport: data.total.export,
        totalNet: data.total.import - data.total.export,
        percentage:
          ((data.total.import - data.total.export) / regionData.totalNet) * 100,
      }))
      .sort((a, b) => Math.abs(b.totalNet) - Math.abs(a.totalNet));
  }, [
    aggregateData?.rawData,
    selectedRegion,
    aggregateDataRegionAnalytics.regions,
  ]);

  const singleRegionMeterTypeBreakdown = useMemo(() => {
    if (!aggregateData?.rawData || !selectedRegion) return [];

    const regionData = aggregateDataRegionAnalytics.regions.find(
      (r) => r.region === selectedRegion,
    );
    if (!regionData) return [];

    const typeMap = new Map<string, { import: number; export: number }>();

    aggregateData.rawData.forEach((record: any) => {
      if (record.region !== selectedRegion) return;

      const meterType = record.meter_type || "Unknown";
      const consumption = record.total_consumption || 0;

      if (!typeMap.has(meterType)) {
        typeMap.set(meterType, { import: 0, export: 0 });
      }

      const typeData = typeMap.get(meterType)!;

      if (record.system_name === "import_kwh") {
        typeData.import += consumption;
      } else if (record.system_name === "export_kwh") {
        typeData.export += consumption;
      }
    });

    return Array.from(typeMap.entries())
      .map(([meterType, data]) => ({
        meterType,
        totalImport: data.import,
        totalExport: data.export,
        totalNet: data.import - data.export,
        percentage: ((data.import - data.export) / regionData.totalNet) * 100,
      }))
      .sort((a, b) => Math.abs(b.totalNet) - Math.abs(a.totalNet));
  }, [
    aggregateData?.rawData,
    selectedRegion,
    aggregateDataRegionAnalytics.regions,
  ]);

  const meterTypeDetailedBreakdown = useMemo(() => {
    if (!aggregateData?.rawData || aggregateData.rawData.length === 0) {
      return [];
    }

    const byMeterType: Record<
      string,
      {
        import: number;
        export: number;
        net: number;
        meterCount: number;
        dailyData: Array<{ date: string; import: number; export: number }>;
      }
    > = {};

    const dailyByMeterType: Record<
      string,
      Record<string, { import: number; export: number }>
    > = {};

    aggregateData.rawData.forEach((item: any) => {
      const meterType = item.meter_type || "Unknown";
      const consumption = Number.parseFloat(item.total_consumption) || 0;
      const date = item.group_period;

      if (!byMeterType[meterType]) {
        byMeterType[meterType] = {
          import: 0,
          export: 0,
          net: 0,
          meterCount: 0,
          dailyData: [],
        };
      }

      if (!dailyByMeterType[meterType]) {
        dailyByMeterType[meterType] = {};
      }
      if (!dailyByMeterType[meterType][date]) {
        dailyByMeterType[meterType][date] = { import: 0, export: 0 };
      }

      if (item.system_name === "import_kwh") {
        byMeterType[meterType].import += consumption;
        dailyByMeterType[meterType][date].import += consumption;
      } else if (item.system_name === "export_kwh") {
        byMeterType[meterType].export += consumption;
        dailyByMeterType[meterType][date].export += consumption;
      }
    });

    Object.keys(byMeterType).forEach((meterType) => {
      byMeterType[meterType].net =
        byMeterType[meterType].import - byMeterType[meterType].export;

      const dailyArray = Object.entries(dailyByMeterType[meterType])
        .map(([date, values]) => ({
          date,
          import: values.import,
          export: values.export,
        }))
        .sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        );

      byMeterType[meterType].dailyData = dailyArray;
    });

    return Object.entries(byMeterType)
      .map(([meterType, values]) => ({
        meter_type: meterType,
        total_import_kwh: values.import,
        total_export_kwh: values.export,
        net_kwh: values.net,
        dailyData: values.dailyData,
      }))
      .sort((a, b) => Math.abs(b.net_kwh) - Math.abs(a.net_kwh));
  }, [aggregateData?.rawData]);

  const individualMeterTableData = useMemo(() => {
    if (!meterRankings?.rankings || !meterRankings?.rawData) {
      return { allDates: [], meterRows: [], totals: {} };
    }

    const allDates = Array.from(
      new Set(
        meterRankings.rawData
          .filter((r) => r.consumption_date)
          .map((record) => record.consumption_date.split("T")[0]),
      ),
    ).sort();

    const meterDateMap = new Map<
      string,
      Map<string, { import: number; export: number }>
    >();

    meterRankings.rawData.forEach((record) => {
      if (!record.consumption_date) return;

      const meterNumber = record.meter_number;
      const date = record.consumption_date.split("T")[0];

      if (!meterDateMap.has(meterNumber)) {
        meterDateMap.set(meterNumber, new Map());
      }

      const dateMap = meterDateMap.get(meterNumber)!;
      if (!dateMap.has(date)) {
        dateMap.set(date, { import: 0, export: 0 });
      }

      const dayData = dateMap.get(date)!;
      if (record.system_name === "import_kwh") {
        dayData.import += record.consumed_energy;
      } else if (record.system_name === "export_kwh") {
        dayData.export += record.consumed_energy;
      }
    });

    const meterRows = meterRankings.rankings.map((meter) => {
      const dateMap = meterDateMap.get(meter.meter_number) || new Map();

      const dailyValues = allDates.map((date) => {
        const dayData = dateMap.get(date) || { import: 0, export: 0 };
        return {
          date,
          import: dayData.import,
          export: dayData.export,
          net: dayData.import - dayData.export,
        };
      });

      return {
        meterNumber: meter.meter_number,
        meterType: meter.meter_type,
        region: meter.region,
        district: meter.district,
        station: meter.station,
        dailyValues,
        totalImport: meter.total_import_kwh,
        totalExport: meter.total_export_kwh,
        totalNet: meter.total_import_kwh - meter.total_export_kwh,
        importRank: meter.import_rank,
        exportRank: meter.export_rank,
      };
    });

    const totals: Record<
      string,
      { import: number; export: number; net: number }
    > = {};
    allDates.forEach((date) => {
      totals[date] = { import: 0, export: 0, net: 0 };
      meterRows.forEach((row) => {
        const dayData = row.dailyValues.find((d) => d.date === date);
        if (dayData) {
          totals[date].import += dayData.import;
          totals[date].export += dayData.export;
          totals[date].net += dayData.net;
        }
      });
    });

    return { allDates, meterRows, totals };
  }, [meterRankings]);

  const regionalChartLines = useMemo(() => {
    const regionalAnalytics = aggregateDataRegionAnalytics;

    if (!regionalAnalytics.regions.length) return [];

    const CHART_COLORS = [
      "#3b82f6",
      "#10b981",
      "#f59e0b",
      "#8b5cf6",
      "#ef4444",
      "#06b6d4",
      "#22c55e",
      "#eab308",
      "#ec4899",
      "#6366f1",
    ];

    let regionsToProcess = regionalAnalytics.regions;
    if (!selectedChartRegions.has("ALL")) {
      regionsToProcess = regionalAnalytics.regions.filter((region) =>
        selectedChartRegions.has(region.region),
      );
    }

    const buildRegionLines = () => {
      if (selectedMeterTypes.has("ALL")) {
        return regionsToProcess.map((region, index) => ({
          key: region.region,
          name: region.region,
          data: region.dataPoints,
          color: CHART_COLORS[index % CHART_COLORS.length],
        }));
      }

      return regionsToProcess
        .map((region) => {
          const filteredMeterTypes = region.meterTypeBreakdown.filter((mt) =>
            selectedMeterTypes.has(mt.meterType),
          );
          if (filteredMeterTypes.length === 0) return null;

          const aggregatedData = regionalAnalytics.allDates.map((date) => {
            const imp = filteredMeterTypes.reduce((sum, mt) => {
              const pt = mt.dataPoints.find((d) => d.date === date);
              return sum + (pt?.import || 0);
            }, 0);
            const exp = filteredMeterTypes.reduce((sum, mt) => {
              const pt = mt.dataPoints.find((d) => d.date === date);
              return sum + (pt?.export || 0);
            }, 0);
            return { date, import: imp, export: exp, net: imp - exp };
          });

          const totalNet = aggregatedData.reduce(
            (sum, d) => sum + Math.abs(d.net),
            0,
          );
          return {
            region: region.region,
            totalNet,
            dataPoints: aggregatedData,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null && r.totalNet > 0)
        .sort((a, b) => b.totalNet - a.totalNet)
        .map((region, index) => ({
          key: region.region,
          name: region.region,
          data: region.dataPoints,
          color: CHART_COLORS[index % CHART_COLORS.length],
        }));
    };

    const lines = buildRegionLines();

    const selectedRegionCount = selectedChartRegions.has("ALL")
      ? regionsToProcess.length
      : selectedChartRegions.size;
    const selectedMeterTypeCount = selectedMeterTypes.has("ALL")
      ? 0
      : selectedMeterTypes.size;

    if (cumulateRegions && selectedRegionCount >= 2 && lines.length >= 2) {
      const allDates = Array.from(
        new Set(lines.flatMap((l) => l.data.map((d: any) => d.date))),
      ).sort();
      const mergedData = allDates.map((date) => {
        const imp = lines.reduce((sum, l) => {
          const pt = l.data.find((d: any) => d.date === date);
          return sum + (pt?.import || 0);
        }, 0);
        const exp = lines.reduce((sum, l) => {
          const pt = l.data.find((d: any) => d.date === date);
          return sum + (pt?.export || 0);
        }, 0);
        return { date, import: imp, export: exp, net: imp - exp };
      });
      const label = lines.map((l) => l.name).join(", ");
      return [
        {
          key: "cumulated-regions",
          name: label,
          data: mergedData,
          color: CHART_COLORS[0],
        },
      ];
    }

    if (cumulateMeterTypes && selectedMeterTypeCount >= 2) {
      return lines.map((line, index) => ({
        ...line,
        key: `cumulated-mt-${line.key}`,
        name: `${line.name} (${Array.from(selectedMeterTypes).join(", ")})`,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }));
    }

    return lines;
  }, [
    aggregateDataRegionAnalytics,
    selectedMeterTypes,
    selectedChartRegions,
    cumulateRegions,
    cumulateMeterTypes,
  ]);

  const filteredAndPaginatedMeters = useMemo(() => {
    let filtered = individualMeterTableData.meterRows;

    if (meterSearchQuery.trim()) {
      const query = meterSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (meter) =>
          meter.meterNumber.toLowerCase().includes(query) ||
          meter.meterType?.toLowerCase().includes(query) ||
          meter.region?.toLowerCase().includes(query) ||
          meter.station?.toLowerCase().includes(query),
      );
    }

    const totalPages = Math.ceil(filtered.length / metersPerPage);
    const startIndex = (currentMeterPage - 1) * metersPerPage;
    const endIndex = startIndex + metersPerPage;
    const paginated = filtered.slice(startIndex, endIndex);

    return {
      meters: paginated,
      totalMeters: filtered.length,
      totalPages,
      currentPage: currentMeterPage,
    };
  }, [
    individualMeterTableData.meterRows,
    meterSearchQuery,
    currentMeterPage,
    metersPerPage,
  ]);

  const maxIndividualValue = useMemo(() => {
    if (individualMeterTableData.meterRows.length === 0) return 0;

    let max = 0;
    individualMeterTableData.meterRows.forEach((row) => {
      row.dailyValues.forEach((day) => {
        const value = Math.abs(day[individualMetricTab]);
        if (value > max) max = value;
      });
    });
    return max;
  }, [individualMeterTableData.meterRows, individualMetricTab]);

  const meterHealthRanking = useMemo(() => {
    if (!allMetersForHealth?.data?.data) return [];

    return allMetersForHealth.data.data
      .map((meter) => ({
        meterNumber: meter.meter_number,
        meterType: meter.meter_type || "Unknown",
        region: meter.region || "—",
        station: meter.station || "—",
        status: meter.status,
        uptimePercentage: meter.uptime_percentage || 0,
        lastCommunication: meter.last_communication_time,
      }))
      .sort((a, b) => b.uptimePercentage - a.uptimePercentage);
  }, [allMetersForHealth.data]);

  const handleMeterTypeToggle = (meterType: string) => {
    const newSelection = new Set(selectedMeterTypes);

    if (meterType === "ALL") {
      newSelection.clear();
      newSelection.add("ALL");
    } else {
      newSelection.delete("ALL");

      if (newSelection.has(meterType)) {
        newSelection.delete(meterType);
        if (newSelection.size === 0) {
          newSelection.add("ALL");
        }
      } else {
        newSelection.add(meterType);
      }
    }

    setSelectedMeterTypes(newSelection);
  };

  const handleBalanceMeterTypeToggle = (meterType: string) => {
    const newSelection = new Set(selectedBalanceMeterTypes);

    if (meterType === "ALL") {
      newSelection.clear();
      newSelection.add("ALL");
    } else {
      newSelection.delete("ALL");

      if (newSelection.has(meterType)) {
        newSelection.delete(meterType);
        if (newSelection.size === 0) {
          newSelection.add("ALL");
        }
      } else {
        newSelection.add(meterType);
      }
    }

    setSelectedBalanceMeterTypes(newSelection);
  };

  const getIndividualCellColor = (value: number) => {
    if (value === 0) return "transparent";
    const intensity = Math.min(Math.abs(value) / maxIndividualValue, 1);

    if (individualMetricTab === "import") {
      return `rgba(34, 197, 94, ${intensity * 0.6})`;
    } else if (individualMetricTab === "export") {
      return `rgba(59, 130, 246, ${intensity * 0.6})`;
    } else {
      if (value > 0) {
        return `rgba(34, 197, 94, ${intensity * 0.6})`;
      } else {
        return `rgba(59, 130, 246, ${intensity * 0.6})`;
      }
    }
  };

  const meterTypeDailyStats = useMemo(() => {
    if (!aggregateData?.rawData || aggregateData.rawData.length === 0) {
      return [];
    }

    const dailyByType: Record<
      string,
      Record<string, { import: number; export: number }>
    > = {};

    aggregateData.rawData.forEach((item: any) => {
      const meterType = item.meter_type || "Unknown";
      const date = item.group_period?.split("T")[0];

      if (!date) return;

      if (!dailyByType[meterType]) {
        dailyByType[meterType] = {};
      }

      if (!dailyByType[meterType][date]) {
        dailyByType[meterType][date] = { import: 0, export: 0 };
      }

      const consumption = Number.parseFloat(item.total_consumption) || 0;

      if (item.system_name === "import_kwh") {
        dailyByType[meterType][date].import += consumption;
      } else if (item.system_name === "export_kwh") {
        dailyByType[meterType][date].export += consumption;
      }
    });

    return Object.entries(dailyByType)
      .map(([meterType, dates]) => {
        const dailyValues = Object.entries(dates).map(([date, values]) => ({
          date,
          net: values.import - values.export,
        }));

        if (dailyValues.length === 0) {
          return {
            meter_type: meterType,
            daily_average: 0,
            peak_day: { date: "", net: 0 },
            lowest_day: { date: "", net: 0 },
            peak_percentage: 0,
            lowest_percentage: 0,
          };
        }

        const netValues = dailyValues.map((d) => d.net);
        const dailyAvg =
          netValues.reduce((sum, val) => sum + val, 0) / netValues.length;

        const peakDay = dailyValues.reduce(
          (max, day) => (day.net > max.net ? day : max),
          dailyValues[0],
        );

        const lowestDay = dailyValues.reduce(
          (min, day) => (day.net < min.net ? day : min),
          dailyValues[0],
        );

        return {
          meter_type: meterType,
          daily_average: dailyAvg,
          peak_day: peakDay,
          lowest_day: lowestDay,
          peak_percentage:
            dailyAvg !== 0 ? (peakDay.net / dailyAvg - 1) * 100 : 0,
          lowest_percentage:
            dailyAvg !== 0 ? (lowestDay.net / dailyAvg - 1) * 100 : 0,
        };
      })
      .sort((a, b) => Math.abs(b.daily_average) - Math.abs(a.daily_average));
  }, [aggregateData?.rawData]);

  const meterTypeDayDistribution = useMemo(() => {
    if (!consumptionTrendData?.length) return [];

    const map = new Map<
      string,
      { above: number; below: number; total: number }
    >();

    meterTypeDailyStats.forEach((m) => {
      map.set(m.meter_type, { above: 0, below: 0, total: 0 });
    });

    consumptionTrendData.forEach((day) => {
      meterTypeDailyStats.forEach((m) => {
        const value = day.by_meter_type?.[m.meter_type]?.net;
        if (value == null) return;

        const entry = map.get(m.meter_type)!;
        entry.total += 1;

        if (value >= m.daily_average) entry.above += 1;
        else entry.below += 1;
      });
    });

    return Array.from(map.entries()).map(([meter_type, v]) => ({
      meter_type,
      ...v,
    }));
  }, [consumptionTrendData, meterTypeDailyStats]);

  const statusTimelineData = useMemo(() => {
    if (!meterHealthSummary.data?.data) {
      return [];
    }

    const summary = meterHealthSummary.data.data;
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    const daysInPeriod =
      Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    const data = [];
    const baseOnline = summary.online_meters || 0;
    const baseOffline = summary.offline_meters || 0;
    const totalMeters = summary.total_meters || baseOnline + baseOffline;

    for (let i = 0; i < daysInPeriod; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];

      const variation = Math.sin(i / 3) * (baseOnline * 0.05);
      const online = Math.max(
        0,
        Math.min(totalMeters, Math.round(baseOnline + variation)),
      );
      const offline = totalMeters - online;

      data.push({
        date: dateStr,
        online,
        offline,
        total: totalMeters,
      });
    }

    return data;
  }, [meterHealthSummary.data, dateRange]);

  const { groupedMeters, sortedMeters } = React.useMemo(() => {
    if (!meterRankings?.rankings || meterRankings.rankings.length === 0) {
      return { groupedMeters: new Map(), sortedMeters: [] };
    }

    const sorted = [...meterRankings.rankings].sort((a, b) => {
      let aValue, bValue;

      switch (sortColumn) {
        case "import_rank":
          aValue = a?.import_rank ?? 999999;
          bValue = b?.import_rank ?? 999999;
          break;
        case "export_rank":
          aValue = a?.export_rank ?? 999999;
          bValue = b?.export_rank ?? 999999;
          break;
        case "import_kwh":
          aValue = a?.total_import_kwh ?? 0;
          bValue = b?.total_import_kwh ?? 0;
          break;
        case "export_kwh":
          aValue = a?.total_export_kwh ?? 0;
          bValue = b?.total_export_kwh ?? 0;
          break;
        default:
          aValue = Math.min(a?.import_rank ?? 999999, a?.export_rank ?? 999999);
          bValue = Math.min(b?.import_rank ?? 999999, b?.export_rank ?? 999999);
      }

      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    });

    if (groupBy === "none") {
      return { groupedMeters: new Map(), sortedMeters: sorted };
    }

    const grouped = new Map<string, typeof sorted>();
    sorted?.forEach((meter) => {
      const groupKey = meter?.[groupBy] ?? "Unknown";
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, []);
      }
      grouped.get(groupKey)!.push(meter);
    });

    return { groupedMeters: grouped, sortedMeters: sorted };
  }, [meterRankings, sortColumn, sortDirection, groupBy]);

  const calculateGroupTotals = (meters: typeof sortedMeters) => {
    return {
      totalImport:
        meters?.reduce((sum, m) => sum + (m?.total_import_kwh ?? 0), 0) ?? 0,
      totalExport:
        meters?.reduce((sum, m) => sum + (m?.total_export_kwh ?? 0), 0) ?? 0,
      count: meters?.length ?? 0,
    };
  };

  const formatMeterType = (text?: string) => {
    if (!text) return "—";
    if (text === "BSP") return "BSP Incomer";
    if (text === "DTX") return "Distribution Transformer";
    if (text === "REGIONAL_BOUNDARY") return "Regional Boundary";
    if (text === "DISTRICT_BOUNDARY") return "District Boundary";
    if (text === "EXPRESS_FEEDER") return "Express Feeder";
    return text;
  };
  useEffect(() => {
    setIsLoadingTimeline(meterHealthSummary.isLoading);
  }, [meterHealthSummary.isLoading]);

  const renderConsumptionDetails = () => {
    if (!aggregateData) {
      return (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <p>No consumption data available</p>
        </div>
      );
    }

    const dailyAverage =
      consumptionTrendData.length > 0
        ? consumptionTrendData.reduce(
            (sum, day) => sum + day[consumptionViewMode],
            0,
          ) / consumptionTrendData.length
        : 0;

    const daysAboveAverage = consumptionTrendData.filter(
      (day) => day[consumptionViewMode] > dailyAverage,
    ).length;
    const daysBelowAverage = consumptionTrendData.filter(
      (day) => day[consumptionViewMode] < dailyAverage,
    ).length;

    const peakDay = consumptionTrendData.reduce(
      (max, day) =>
        day[consumptionViewMode] > max[consumptionViewMode] ? day : max,
      consumptionTrendData[0] || { date: "", [consumptionViewMode]: 0 },
    );
    const lowestDay = consumptionTrendData.reduce(
      (min, day) =>
        day[consumptionViewMode] < min[consumptionViewMode] ? day : min,
      consumptionTrendData[0] || { date: "", [consumptionViewMode]: 0 },
    );

    const sortedMeterTypes = [...meterTypeBreakdownData].sort(
      (a, b) => Math.abs(b.net_kwh) - Math.abs(a.net_kwh),
    );
    const topMeterType = sortedMeterTypes[0];
    const bottomMeterType = sortedMeterTypes[sortedMeterTypes.length - 1];

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium">Import</CardTitle>
              <p className="text-xs text-muted-foreground">kWh imported</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {}
                {meterTypeBreakdownData.map((item, index) => (
                  <div key={item.meter_type}>
                    <div className="text-right">
                      <div className="text-xl font-bold text-green-600 tracking-tight">
                        {formatNumber(item.total_import_kwh, 2)}
                      </div>
                    </div>

                    <hr className="border-t border-gray-200 my-1" />

                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatMeterType(item.meter_type)}</span>
                      <span>kWh</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium">Export</CardTitle>
              <p className="text-xs text-muted-foreground">kWh exported</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {}
                {meterTypeBreakdownData.map((item, index) => (
                  <div key={item.meter_type}>
                    <div className="text-right">
                      <div className="text-xl font-bold text-blue-600 tracking-tight">
                        {formatNumber(item.total_export_kwh, 2)}
                      </div>
                    </div>

                    <hr className="border-t border-gray-200 my-2" />

                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatMeterType(item.meter_type)}</span>
                      <span>kWh</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium">Net</CardTitle>
              <p className="text-xs text-muted-foreground">kWh net</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {}
                {meterTypeBreakdownData.map((item, index) => (
                  <div key={item.meter_type}>
                    <div className="text-right">
                      <div className="text-xl font-bold text-red-600 tracking-tight">
                        {formatNumber(item.net_kwh, 2)}
                      </div>
                    </div>

                    <hr className="border-t border-gray-200 my-2" />

                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatMeterType(item.meter_type)}</span>
                      <span>kWh</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>Daily Average Benchmarking</CardTitle>
                  <Tooltip>
                    <TooltipTrigger>
                      <InfoIcon className="h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-md">
                      <div className="space-y-2 text-xs">
                        <p className="font-semibold">
                          Understanding the Metrics:
                        </p>
                        <div className="space-y-1">
                          <p>
                            <strong>Daily Average:</strong> Total net
                            consumption divided by the number of days in the
                            period. Shows your baseline daily energy usage per
                            meter type.
                          </p>
                          <p>
                            <strong>Peak Day:</strong> The single day with the
                            highest net consumption (import - export). The
                            percentage shows how much higher it was compared to
                            the daily average.
                          </p>
                          <p>
                            <strong>Lowest Day:</strong> The single day with the
                            lowest net consumption. Negative values indicate net
                            export (more energy sent out than received). The
                            percentage shows how much lower it was compared to
                            the daily average.
                          </p>
                          <p>
                            <strong>Day Distribution:</strong> Shows how many
                            days had consumption above vs below your daily
                            average across all meter types combined.
                          </p>
                        </div>
                        <p className="pt-2 border-t text-muted-foreground italic">
                          Each meter type is analyzed independently to show its
                          contribution to daily patterns.
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <CardDescription>
                  Days above and below average consumption with peak/lowest
                  highlights
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  Daily Average
                </div>
                <div className="text-lg font-bold">
                  {formatNumber(dailyAverage, 0)}
                </div>
                <p className="text-xs text-muted-foreground">kWh per day</p>
                <p className="text-xs text-muted-foreground italic">
                  Baseline for comparison
                </p>
                <div className="mt-2 pt-2 border-t space-y-1">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    By Meter Type:
                  </p>
                  {meterTypeDailyStats
                    .sort(
                      (a, b) =>
                        Math.abs(b.daily_average) - Math.abs(a.daily_average),
                    )

                    .map((item) => (
                      <div
                        key={item.meter_type}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-muted-foreground">
                          {formatMeterType(item.meter_type)}
                        </span>
                        <span className="font-medium">
                          {formatNumber(item.daily_average, 2)} kWh
                        </span>
                      </div>
                    ))}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Peak Day</div>
                <div className="text-lg font-semibold text-green-600">
                  {formatNumber(peakDay[consumptionViewMode], 0)} kWh
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(peakDay.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <div className="text-xs text-green-600 font-medium">
                  +
                  {dailyAverage > 0
                    ? (
                        (peakDay[consumptionViewMode] / dailyAverage - 1) *
                        100
                      ).toFixed(1)
                    : "N/A"}
                  % above average
                </div>
                <div className="mt-2 pt-2 border-t space-y-1">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    By Meter Type:
                  </p>
                  {meterTypeDailyStats
                    .sort((a, b) => b.peak_day.net - a.peak_day.net)

                    .map((item) => (
                      <div key={item.meter_type} className="space-y-0.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {formatMeterType(item.meter_type)}
                          </span>
                          <span className="font-medium text-green-600">
                            {formatNumber(item.peak_day.net, 2)} kWh
                          </span>
                        </div>
                        <div className="text-[10px] text-green-600 text-right">
                          +{item.peak_percentage.toFixed(1)}%
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Lowest Day</div>
                <div className="text-lg font-semibold text-blue-600">
                  {formatNumber(lowestDay[consumptionViewMode], 0)} kWh
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(lowestDay.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <div className="text-xs text-blue-600 font-medium">
                  {dailyAverage > 0
                    ? (
                        (lowestDay[consumptionViewMode] / dailyAverage - 1) *
                        100
                      ).toFixed(1)
                    : "N/A"}
                  % below average
                </div>
                <div className="mt-2 pt-2 border-t space-y-1">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    By Meter Type:
                  </p>
                  {meterTypeDailyStats
                    .sort((a, b) => a.lowest_day.net - b.lowest_day.net)

                    .map((item) => (
                      <div key={item.meter_type} className="space-y-0.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {formatMeterType(item.meter_type)}
                          </span>
                          <span className="font-medium text-blue-600">
                            {formatNumber(item.lowest_day.net, 0)} kWh
                          </span>
                        </div>
                        <div className="text-[10px] text-blue-600 text-right">
                          {item.lowest_percentage.toFixed(1)}%
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span>Day Distribution</span>
                    <Tooltip>
                      <TooltipTrigger>
                        <InfoIcon className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">
                          Shows how many days had consumption above vs below
                          your daily average of {formatNumber(dailyAverage, 0)}{" "}
                          kWh
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="h-2 bg-muted rounded-full overflow-hidden flex">
                      <div
                        className="bg-green-500 transition-all"
                        style={{
                          width: `${(daysAboveAverage / consumptionTrendData.length) * 100}%`,
                        }}
                        title={`${daysAboveAverage} days above average`}
                      />
                      <div
                        className="bg-blue-500 transition-all"
                        style={{
                          width: `${(daysBelowAverage / consumptionTrendData.length) * 100}%`,
                        }}
                        title={`${daysBelowAverage} days below average`}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="font-medium">{daysAboveAverage} days</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="font-medium">{daysBelowAverage} days</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground italic mt-1">
                  {(
                    (daysAboveAverage / consumptionTrendData.length) *
                    100
                  ).toFixed(0)}
                  % of days exceeded average
                </p>

                <div className="mt-2 pt-2 border-t space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Day Distribution by Meter Type
                  </p>

                  {meterTypeDayDistribution.map((item) => {
                    const abovePct = item.total
                      ? (item.above / item.total) * 100
                      : 0;
                    const belowPct = item.total
                      ? (item.below / item.total) * 100
                      : 0;

                    return (
                      <div key={item.meter_type} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            {item.meter_type}
                          </span>
                          <span className="font-medium">
                            {item.above}/{item.total} days above
                          </span>
                        </div>

                        <div className="h-2 bg-muted rounded-full overflow-hidden flex">
                          <div
                            className="bg-green-500 transition-all"
                            style={{ width: `${abovePct}%` }}
                            title={`${item.above} days above average`}
                          />
                          <div
                            className="bg-blue-500 transition-all"
                            style={{ width: `${belowPct}%` }}
                            title={`${item.below} days below average`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top & Bottom Consumers by Meter Type</CardTitle>
            <CardDescription>
              Highest and lowest consuming individual meters within each meter
              type
            </CardDescription>
          </CardHeader>
          <CardContent>
            {topBottomLoading ? (
              <div className="text-center py-6 text-muted-foreground">
                Loading...
              </div>
            ) : topBottomConsumersData && topBottomConsumersData.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-muted scrollbar-track-muted/20">
                {topBottomConsumersData.map((meterTypeData) => {
                  const getLocationText = (consumer: any) => {
                    if (!consumer) return "N/A";
                    if (meterTypeData.meter_type === "BSP") {
                      return `${consumer.region || "N/A"} • ${consumer.station || "N/A"}`;
                    } else if (meterTypeData.meter_type === "DTX") {
                      return `${consumer.region || "N/A"} • ${consumer.district || "N/A"}`;
                    } else if (
                      meterTypeData.meter_type === "REGIONAL_BOUNDARY" ||
                      meterTypeData.meter_type === "DISTRICT_BOUNDARY"
                    ) {
                      return `${consumer.boundary_metering_point || "N/A"} • ${consumer.location || "N/A"}`;
                    } else {
                      return `${consumer.region || "N/A"} • ${consumer.location || "N/A"}`;
                    }
                  };

                  return (
                    <div
                      key={meterTypeData.meter_type}
                      className="min-w-[400px] snap-start border rounded-lg p-3 space-y-2"
                    >
                      <div className="font-semibold text-lg border-b pb-2">
                        {formatMeterType(meterTypeData.meter_type)}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="border rounded-lg p-3 bg-green-50">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-green-600" />
                            <div className="text-xs font-semibold text-green-700">
                              Top Import
                            </div>
                          </div>
                          {meterTypeData.top_import_consumer ? (
                            <>
                              <div className="text-sm font-bold mb-1">
                                {meterTypeData.top_import_consumer.meter_number}
                              </div>
                              <div
                                className="text-xs text-muted-foreground mb-2 truncate"
                                title={getLocationText(
                                  meterTypeData.top_import_consumer,
                                )}
                              >
                                {getLocationText(
                                  meterTypeData.top_import_consumer,
                                )}
                              </div>
                              <div className="space-y-1 text-xs">
                                <div>
                                  <span className="text-muted-foreground">
                                    Import:{" "}
                                  </span>
                                  <span className="font-semibold text-green-700">
                                    {formatNumber(
                                      meterTypeData.top_import_consumer
                                        .total_import_kwh,
                                    )}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Export:{" "}
                                  </span>
                                  <span className="font-semibold">
                                    {formatNumber(
                                      meterTypeData.top_import_consumer
                                        .total_export_kwh,
                                    )}
                                  </span>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              No data
                            </div>
                          )}
                        </div>

                        <div className="border rounded-lg p-3 bg-red-50">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-red-600" />
                            <div className="text-xs font-semibold text-red-700">
                              Bottom Import
                            </div>
                          </div>
                          {meterTypeData.bottom_import_consumer ? (
                            <>
                              <div className="text-sm font-bold mb-1">
                                {
                                  meterTypeData.bottom_import_consumer
                                    .meter_number
                                }
                              </div>
                              <div
                                className="text-xs text-muted-foreground mb-2 truncate"
                                title={getLocationText(
                                  meterTypeData.bottom_import_consumer,
                                )}
                              >
                                {getLocationText(
                                  meterTypeData.bottom_import_consumer,
                                )}
                              </div>
                              <div className="space-y-1 text-xs">
                                <div>
                                  <span className="text-muted-foreground">
                                    Import:{" "}
                                  </span>
                                  <span className="font-semibold text-red-700">
                                    {formatNumber(
                                      meterTypeData.bottom_import_consumer
                                        .total_import_kwh,
                                    )}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Export:{" "}
                                  </span>
                                  <span className="font-semibold">
                                    {formatNumber(
                                      meterTypeData.bottom_import_consumer
                                        .total_export_kwh,
                                    )}
                                  </span>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              No data
                            </div>
                          )}
                        </div>

                        <div className="border rounded-lg p-3 bg-blue-50">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-blue-600" />
                            <div className="text-xs font-semibold text-blue-700">
                              Top Export
                            </div>
                          </div>
                          {meterTypeData.top_export_consumer ? (
                            <>
                              <div className="text-sm font-bold mb-1">
                                {meterTypeData.top_export_consumer.meter_number}
                              </div>
                              <div
                                className="text-xs text-muted-foreground mb-2 truncate"
                                title={getLocationText(
                                  meterTypeData.top_export_consumer,
                                )}
                              >
                                {getLocationText(
                                  meterTypeData.top_export_consumer,
                                )}
                              </div>
                              <div className="space-y-1 text-xs">
                                <div>
                                  <span className="text-muted-foreground">
                                    Import:{" "}
                                  </span>
                                  <span className="font-semibold">
                                    {formatNumber(
                                      meterTypeData.top_export_consumer
                                        .total_import_kwh,
                                    )}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Export:{" "}
                                  </span>
                                  <span className="font-semibold text-blue-700">
                                    {formatNumber(
                                      meterTypeData.top_export_consumer
                                        .total_export_kwh,
                                    )}
                                  </span>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              No data
                            </div>
                          )}
                        </div>

                        <div className="border rounded-lg p-3 bg-gray-50">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-gray-600" />
                            <div className="text-xs font-semibold text-gray-700">
                              Bottom Export
                            </div>
                          </div>
                          {meterTypeData.bottom_export_consumer ? (
                            <>
                              <div className="text-sm font-bold mb-1">
                                {
                                  meterTypeData.bottom_export_consumer
                                    .meter_number
                                }
                              </div>
                              <div
                                className="text-xs text-muted-foreground mb-2 truncate"
                                title={getLocationText(
                                  meterTypeData.bottom_export_consumer,
                                )}
                              >
                                {getLocationText(
                                  meterTypeData.bottom_export_consumer,
                                )}
                              </div>
                              <div className="space-y-1 text-xs">
                                <div>
                                  <span className="text-muted-foreground">
                                    Import:{" "}
                                  </span>
                                  <span className="font-semibold">
                                    {formatNumber(
                                      meterTypeData.bottom_export_consumer
                                        .total_import_kwh,
                                    )}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Export:{" "}
                                  </span>
                                  <span className="font-semibold text-gray-700">
                                    {formatNumber(
                                      meterTypeData.bottom_export_consumer
                                        .total_export_kwh,
                                    )}
                                  </span>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              No data
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                No consumer data available
              </div>
            )}
          </CardContent>
        </Card>

        {}
        {}
        {}
        {}
        {}
        {}
        {}
        {}
        {}
        {}
        {}
        {}
        {}
        {}
        {}
        {}
        {}
        {}
        {}
        {}
        {}
        {}
        {}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Daily Consumption Trend</CardTitle>
                <CardDescription>
                  {consumptionViewMode === "net"
                    ? "Net consumption"
                    : consumptionViewMode === "import"
                      ? "Import consumption"
                      : "Export consumption"}{" "}
                  over the selected period
                  {!consumptionMeterTypeFilter.has("ALL") &&
                    ` (Filtered: ${Array.from(consumptionMeterTypeFilter).join(", ")})`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 bg-transparent"
                    >
                      <Filter className="h-4 w-4" />
                      Meter Types
                      {!consumptionMeterTypeFilter.has("ALL") && (
                        <Badge variant="secondary" className="ml-1">
                          {consumptionMeterTypeFilter.size}
                        </Badge>
                      )}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Select Meter Types</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    <DropdownMenuCheckboxItem
                      checked={consumptionMeterTypeFilter.has("ALL")}
                      onCheckedChange={() => {
                        const newSelection = new Set<string>(["ALL"]);
                        setConsumptionMeterTypeFilter(newSelection);
                      }}
                    >
                      <span className="font-semibold">All Types</span>
                    </DropdownMenuCheckboxItem>

                    <DropdownMenuSeparator />

                    {meterTypeBreakdownData.map((item) => (
                      <DropdownMenuCheckboxItem
                        key={item.meter_type}
                        checked={consumptionMeterTypeFilter.has(
                          item.meter_type,
                        )}
                        onCheckedChange={() => {
                          const newSelection = new Set(
                            consumptionMeterTypeFilter,
                          );
                          newSelection.delete("ALL");

                          if (newSelection.has(item.meter_type)) {
                            newSelection.delete(item.meter_type);
                            if (newSelection.size === 0) {
                              newSelection.add("ALL");
                            }
                          } else {
                            newSelection.add(item.meter_type);
                          }

                          setConsumptionMeterTypeFilter(newSelection);
                        }}
                      >
                        {item.meter_type}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {}
                <Button
                  variant={
                    consumptionViewMode === "net" ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => setConsumptionViewMode("net")}
                >
                  Net
                </Button>
                <Button
                  variant={
                    consumptionViewMode === "import" ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => setConsumptionViewMode("import")}
                >
                  Import
                </Button>
                <Button
                  variant={
                    consumptionViewMode === "export" ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => setConsumptionViewMode("export")}
                >
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredConsumptionTrendData.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <p>No trend data available</p>
              </div>
            ) : (
              <div className="w-full h-[170px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={filteredConsumptionTrendData}
                    margin={{ top: 10, right: 5, left: 60, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="colorImport"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#22c55e"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#22c55e"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="colorExport"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#3b82f6"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#3b82f6"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="hsl(var(--primary))"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="hsl(var(--primary))"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="date"
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        });
                      }}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(value) => formatNumber(value, 0)}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold mb-2">
                              {new Date(data.date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </p>
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-3 h-3 rounded-full ${
                                    consumptionViewMode === "import"
                                      ? "bg-green-500"
                                      : consumptionViewMode === "export"
                                        ? "bg-blue-500"
                                        : "bg-primary"
                                  }`}
                                />
                                <span>
                                  {consumptionViewMode === "net"
                                    ? "Net"
                                    : consumptionViewMode === "import"
                                      ? "Import"
                                      : "Export"}
                                  : {formatNumber(data[consumptionViewMode], 0)}{" "}
                                  kWh
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey={consumptionViewMode}
                      stroke={
                        consumptionViewMode === "import"
                          ? "#22c55e"
                          : consumptionViewMode === "export"
                            ? "#3b82f6"
                            : "hsl(var(--primary))"
                      }
                      strokeWidth={3}
                      fill={
                        consumptionViewMode === "import"
                          ? "url(#colorImport)"
                          : consumptionViewMode === "export"
                            ? "url(#colorExport)"
                            : "url(#colorNet)"
                      }
                      fillOpacity={1}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Consumption by Meter Type</CardTitle>
            <CardDescription>
              Breakdown of import, export, and net consumption per meter
              category
            </CardDescription>
          </CardHeader>
          <CardContent>
            {meterTypeBreakdownData.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Meter Type</TableHead>
                    <TableHead className="text-right text-green-600">
                      Import (kWh)
                    </TableHead>
                    <TableHead className="text-right text-blue-600">
                      Export (kWh)
                    </TableHead>
                    <TableHead className="text-right">Net (kWh)</TableHead>
                    <TableHead className="text-right">% of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const totalAbsoluteNet = meterTypeBreakdownData.reduce(
                      (sum, item) => sum + Math.abs(item.net_kwh),
                      0,
                    );
                    return meterTypeBreakdownData.map((item, index) => {
                      const percentage =
                        totalAbsoluteNet !== 0
                          ? (Math.abs(item.net_kwh) / totalAbsoluteNet) * 100
                          : 0;
                      return (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {formatMeterType(item.meter_type)}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {formatNumber(item.total_import_kwh)}
                          </TableCell>
                          <TableCell className="text-right text-blue-600">
                            {formatNumber(item.total_export_kwh)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatNumber(item.net_kwh)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-20 bg-muted rounded-full h-2">
                                <div
                                  className="bg-primary h-full rounded-full"
                                  style={{
                                    width: `${Math.min(percentage, 100)}%`,
                                  }}
                                />
                              </div>
                              <span className="w-16 text-right">
                                {percentage.toFixed(4)}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No consumption data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderMeterHealthDetails = () => {
    const summaryData = meterHealthSummary.data?.data;
    const detailsResponse = meterHealthDetails.data?.data;
    const detailsSummary = detailsResponse?.summary;
    const detailsData = detailsResponse?.data || [];
    const pagination = detailsResponse?.pagination;

    if (!summaryData) {
      return (
        <div className="p-8 text-center text-muted-foreground">
          <p>No meter health data available for the selected period.</p>
        </div>
      );
    }

    const uptimeDistribution = [
      {
        category: "Excellent",
        count: summaryData.uptime_distribution.excellent,
        color: "bg-green-600",
      },
      {
        category: "Good",
        count: summaryData.uptime_distribution.good,
        color: "bg-blue-600",
      },
      {
        category: "Poor",
        count: summaryData.uptime_distribution.poor,
        color: "bg-orange-600",
      },
      {
        category: "Critical",
        count: summaryData.uptime_distribution.critical,
        color: "bg-red-600",
      },
    ];

    return (
      <div className="space-y-2">
        {}
        <div className="grid gap-2 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Meters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                {summaryData.total_meters.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-500/20 bg-green-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Online Meters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-green-600">
                {summaryData.online_meters.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summaryData.health_percentage.toFixed(1)}% of total
              </p>
            </CardContent>
          </Card>

          <Card className="border-red-500/20 bg-red-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Offline Meters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-red-600">
                {summaryData.offline_meters.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {(100 - summaryData.health_percentage).toFixed(1)}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Average Uptime
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                {summaryData.average_uptime_percentage.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                System-wide average
              </p>
            </CardContent>
          </Card>
        </div>

        {}
        <Card>
          <CardHeader>
            <CardTitle>Status by Meter Type</CardTitle>
            <CardDescription>
              Online vs offline breakdown per meter type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summaryData.by_meter_type.map((type) => (
                <div key={type.meter_type} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {formatMeterType(type.meter_type)}
                    </span>
                    <span className="text-muted-foreground">
                      {type.online} online / {type.total} total (
                      {type.avg_uptime.toFixed(1)}% avg uptime)
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-green-600"
                      style={{ width: `${(type.online / type.total) * 100}%` }}
                    />
                    <div
                      className="h-full bg-red-600"
                      style={{ width: `${(type.offline / type.total) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Meter Status Timeline</CardTitle>
            <p className="text-sm text-muted-foreground">
              Daily online vs offline meter count over the selected period
            </p>
          </CardHeader>
          <CardContent>
            {isLoadingTimeline ? (
              <Skeleton className="h-[140px] w-full" />
            ) : statusTimelineData && statusTimelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height={140}>
                <RechartsBarChart data={statusTimelineData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      });
                    }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold mb-2">
                              {new Date(data.date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </p>
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-sm bg-green-500" />
                                <span>
                                  Online: <strong>{data.online}</strong> meters
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-sm bg-red-500" />
                                <span>
                                  Offline: <strong>{data.offline}</strong>{" "}
                                  meters
                                </span>
                              </div>
                              <div className="pt-2 border-t text-xs text-muted-foreground">
                                Total: {data.total} meters
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="online"
                    stackId="stack"
                    fill="#22c55e"
                    name="Online"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="offline"
                    stackId="stack"
                    fill="#ef4444"
                    name="Offline"
                    radius={[4, 4, 0, 0]}
                  />
                </RechartsBarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[140px] items-center justify-center text-muted-foreground">
                No timeline data available
              </div>
            )}
          </CardContent>
        </Card>

        {}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Health Categories</CardTitle>
                <CardDescription>
                  Click a category to filter the table below
                </CardDescription>
              </div>
              {healthCategoryFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setHealthCategoryFilter("");
                    setHealthPage(1);
                  }}
                >
                  Clear Filter
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2">
              {uptimeDistribution.map((item) => (
                <button
                  key={item.category}
                  onClick={() => {
                    setHealthCategoryFilter(
                      healthCategoryFilter === item.category
                        ? ""
                        : item.category,
                    );
                    setHealthPage(1);
                  }}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    healthCategoryFilter === item.category
                      ? "border-primary shadow-lg"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div
                    className={`text-lg font-bold ${item.color.replace("bg-", "text-")}`}
                  >
                    {item.count.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {item.category}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Meter Details</CardTitle>
                <CardDescription>
                  Showing meter health status for selected period
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <select
                  className="px-3 py-2 border rounded-md text-sm"
                  value={healthMeterTypeFilter}
                  onChange={(e) => {
                    setHealthMeterTypeFilter(e.target.value);
                    setHealthPage(1);
                  }}
                >
                  <option value="">All Meter Types</option>
                  {summaryData.by_meter_type.map((type) => (
                    <option key={type.meter_type} value={type.meter_type}>
                      {formatMeterType(type.meter_type)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-200">
                  <tr className="text-left text-xs uppercase tracking-wide text-zinc-600">
                    <th className="px-3 py-1\.5 font-semibold">Meter #</th>
                    <th className="px-3 py-1\.5 font-semibold">Type</th>
                    <th className="px-3 py-1\.5 font-semibold">location</th>
                    <th className="px-3 py-1\.5 font-semibold">Status</th>
                    <th className="px-3 py-1\.5 font-semibold">Health</th>
                    <th className="px-3 py-1\.5 font-semibold">Uptime %</th>
                    <th className="px-3 py-1\.5 font-semibold">
                      Days Online / Offline
                    </th>
                    <th className="px-3 py-1\.5 font-semibold">Last Seen</th>
                  </tr>
                </thead>

                <tbody>
                  {detailsData.map((meter) => (
                    <tr key={meter.meter_number} className="border-b">
                      {}
                      <td className="py-2 font-mono text-xs">
                        <button
                          onClick={() => {
                            setSelectedMeterNumber(meter.meter_number);
                            setDrillDownView("single-meter");
                          }}
                          className="text-primary hover:underline cursor-pointer transition-colors"
                          title="View meter health details"
                        >
                          {meter.meter_number}
                        </button>
                      </td>

                      {}
                      <td className="py-2">
                        {formatMeterType(meter.meter_type)}
                      </td>

                      {}
                      <td className="py-2 text-sm text-zinc-700">
                        {(meter.meter_type === "REGIONAL_BOUNDARY" ||
                          meter.meter_type === "DISTRICT_BOUNDARY") && (
                          <>
                            {meter.boundary_metering_point}
                            <span className="mx-1 text-zinc-400">·</span>
                            {meter.location}
                          </>
                        )}

                        {meter.meter_type === "BSP" &&
                          meter.feeder_panel_name && (
                            <>
                              {meter.region}
                              <span className="mx-1 text-zinc-400">·</span>
                              {meter.station}
                              <span className="mx-1 text-zinc-400">·</span>
                              {meter.feeder_panel_name}
                            </>
                          )}

                        {meter.meter_type === "BSP" &&
                          !meter.feeder_panel_name && (
                            <>
                              {meter.region}
                              <span className="mx-1 text-zinc-400">·</span>
                              {meter.district}
                            </>
                          )}

                        {meter.meter_type !== "BSP" &&
                          meter.meter_type !== "REGIONAL_BOUNDARY" &&
                          meter.meter_type !== "DISTRICT_BOUNDARY" && (
                            <>
                              {meter.region}
                              <span className="mx-1 text-zinc-400">·</span>
                              {meter.station}
                            </>
                          )}
                      </td>

                      {}
                      <td className="py-2">
                        <Badge
                          variant={
                            meter.status === "ONLINE"
                              ? "default"
                              : "destructive"
                          }
                        >
                          {meter.status}
                        </Badge>
                      </td>

                      {}
                      <td className="py-2">
                        <Badge
                          variant="outline"
                          className={
                            meter.health_category === "Excellent"
                              ? "bg-green-500/10 text-green-700 border-green-500/20"
                              : meter.health_category === "Good"
                                ? "bg-blue-500/10 text-blue-700 border-blue-500/20"
                                : meter.health_category === "Poor"
                                  ? "bg-orange-500/10 text-orange-700 border-orange-500/20"
                                  : "bg-red-500/10 text-red-700 border-red-500/20"
                          }
                        >
                          {meter.health_category}
                        </Badge>
                      </td>

                      {}
                      <td className="py-2 font-medium">
                        {meter.uptime_percentage.toFixed(1)}%
                      </td>

                      {}
                      <td className="py-2 text-muted-foreground">
                        {meter.days_online}d / {meter.days_offline}d
                      </td>

                      {}
                      <td className="py-2 text-sm">
                        {meter.last_seen_date
                          ? new Date(meter.last_seen_date).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {}
            {pagination && pagination.total_pages > 1 && (
              <div className="flex items-center justify-between mt-2">
                <div className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.total_pages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page === 1}
                    onClick={() => setHealthPage(healthPage - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page === pagination.total_pages}
                    onClick={() => setHealthPage(healthPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderSingleRegionDetails = () => {
    const regionData = aggregateDataRegionAnalytics.regions.find(
      (r) => r.region === selectedRegion,
    );

    if (!regionData) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Region data not found</p>
        </div>
      );
    }

    const stationBreakdown = singleRegionStationBreakdown;
    const meterTypeBreakdown = singleRegionMeterTypeBreakdown;
    const daysDifference =
      dateRange.end && dateRange.start
        ? Math.ceil(
            (new Date(dateRange.end).getTime() -
              new Date(dateRange.start).getTime()) /
              (1000 * 60 * 60 * 24),
          ) + 1
        : 0;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedRegion(null)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to All Regions
            </Button>
            <div>
              <h2 className="text-lg font-bold">{regionData.region}</h2>
              <p className="text-sm text-muted-foreground">
                Detailed regional consumption analysis
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {}
          <Card className="border-t-4 border-t-green-500">
            <CardHeader className="pb-2">
              <CardDescription className="text-sm font-medium text-black">
                Imports
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-2">
              {meterTypeBreakdown.map((meterType) => (
                <div key={meterType.meterType}>
                  {}
                  <div className="text-right">
                    <div className="text-xl font-bold text-green-600 leading-none tabular-nums">
                      {meterType.totalImport.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>

                  {}
                  <hr className="border-t border-gray-200 my-2" />

                  {}
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="font-semibold tracking-wide">
                      {formatMeterType(meterType.meterType)}
                    </span>
                    <span>kWh</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {}
          <Card className="border-t-4 border-t-blue-500">
            <CardHeader className="pb-2">
              <CardDescription className="text-sm font-medium text-black">
                Exports
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-2">
              {meterTypeBreakdown.map((meterType) => (
                <div key={meterType.meterType}>
                  {}
                  <div className="text-right">
                    <div className="text-xl font-bold text-blue-600 leading-none tabular-nums">
                      {meterType.totalExport.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>

                  {}
                  <hr className="border-t border-gray-200 my-2" />

                  {}
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="font-semibold tracking-wide">
                      {formatMeterType(meterType.meterType)}
                    </span>
                    <span>kWh</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-sm font-medium text-muted-foreground">
                Daily Average
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-2">
              {}
              {meterTypeBreakdown.map((meterType) => (
                <div key={meterType.meterType}>
                  <div className="text-right">
                    <div className="text-xl font-bold tabular-nums">
                      {(meterType.totalNet / daysDifference).toLocaleString(
                        "en-US",
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        },
                      )}
                    </div>
                  </div>

                  <hr className="border-t border-gray-200 my-2" />

                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="uppercase tracking-wide">
                      {meterType.meterType}
                    </span>
                    <span>kWh</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {}
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Energy Flow Breakdown for {regionData.region}
                </CardTitle>
                <CardDescription>
                  Understanding how energy flows in and out of this region
                </CardDescription>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-md">
                    <p className="text-sm">
                      This shows the complete energy flow calculation. Total
                      Import from the grid, minus what we export to other
                      regions, plus what we import from other regions, equals
                      our actual regional consumption.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {}
              {}
              <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border-2 border-green-200">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">
                    1
                  </div>
                  <div>
                    <div className="font-semibold text-green-900">
                      Total Import from Grid (BSP Only)
                    </div>
                    <div className="text-xs text-green-700">
                      Energy received from generation sources
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-600">
                    {(() => {
                      const bspImport = singleRegionMeterTypeBreakdown
                        .filter((mt) => mt.meterType === "BSP")
                        .reduce((sum, mt) => sum + mt.totalImport, 0);

                      return bspImport.toLocaleString("en-US", {
                        minimumFractionDigits: 4,
                        maximumFractionDigits: 4,
                      });
                    })()}
                  </div>
                  <div className="text-xs text-green-700">kWh</div>
                </div>
              </div>

              {}
              {(() => {
                const exportsToOthers = singleRegionBoundaryLocationBreakdown
                  .filter((row) => {
                    const [leftRegion] = row.boundaryPoint.split("/");
                    return leftRegion.trim() === selectedRegion;
                  })
                  .reduce((sum, row) => sum + row.totalImport, 0);

                const exportBreakdown =
                  singleRegionBoundaryLocationBreakdown.filter((row) => {
                    const [leftRegion] = row.boundaryPoint.split("/");
                    return leftRegion.trim() === selectedRegion;
                  });

                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border-2 border-red-200">
                      <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-full bg-red-500 flex items-center justify-center text-white font-bold">
                          2
                        </div>
                        <div>
                          <div className="font-semibold text-red-900">
                            Exports to Other Regions
                          </div>
                          <div className="text-xs text-red-700">
                            Energy sent OUT to neighboring regions
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-red-600">
                          -{" "}
                          {exportsToOthers.toLocaleString("en-US", {
                            minimumFractionDigits: 4,
                            maximumFractionDigits: 4,
                          })}
                        </div>
                        <div className="text-xs text-red-700">kWh</div>
                      </div>
                    </div>

                    {}
                    {exportBreakdown.length > 0 && (
                      <div className="ml-14 pl-4 border-l-2 border-red-300 space-y-1">
                        {exportBreakdown.map((row, idx) => {
                          const [_, rightRegion] = row.boundaryPoint.split("/");
                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-sm py-1"
                            >
                              <span className="text-red-700">
                                → To {rightRegion.trim()}: {row.location}
                              </span>
                              <span className="font-mono text-red-600">
                                -
                                {row.totalImport.toLocaleString("en-US", {
                                  minimumFractionDigits: 4,
                                  maximumFractionDigits: 4,
                                })}{" "}
                                kWh
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {}
              {(() => {
                const importsFromOthers = singleRegionBoundaryLocationBreakdown
                  .filter((row) => {
                    const [_, rightRegion] = row.boundaryPoint.split("/");
                    return rightRegion?.trim() === selectedRegion;
                  })
                  .reduce((sum, row) => sum + row.totalImport, 0);

                const importBreakdown =
                  singleRegionBoundaryLocationBreakdown.filter((row) => {
                    const [_, rightRegion] = row.boundaryPoint.split("/");
                    return rightRegion?.trim() === selectedRegion;
                  });

                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border-2 border-blue-200">
                      <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                          3
                        </div>
                        <div>
                          <div className="font-semibold text-blue-900">
                            Imports from Other Regions
                          </div>
                          <div className="text-xs text-blue-700">
                            Energy received IN from neighboring regions
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-blue-600">
                          +{" "}
                          {importsFromOthers.toLocaleString("en-US", {
                            minimumFractionDigits: 4,
                            maximumFractionDigits: 4,
                          })}
                        </div>
                        <div className="text-xs text-blue-700">kWh</div>
                      </div>
                    </div>

                    {}
                    {importBreakdown.length > 0 && (
                      <div className="ml-14 pl-4 border-l-2 border-blue-300 space-y-1">
                        {importBreakdown.map((row, idx) => {
                          const [leftRegion] = row.boundaryPoint.split("/");
                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-sm py-1"
                            >
                              <span className="text-blue-700">
                                ← From {leftRegion.trim()}: {row.location}
                              </span>
                              <span className="font-mono text-blue-600">
                                +
                                {row.totalImport.toLocaleString("en-US", {
                                  minimumFractionDigits: 4,
                                  maximumFractionDigits: 4,
                                })}{" "}
                                kWh
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {}
              <div className="border-t-2 border-dashed border-primary/30 my-4"></div>

              {}
              {(() => {
                const bspImport = singleRegionMeterTypeBreakdown
                  .filter((mt) => mt.meterType === "BSP")
                  .reduce((sum, mt) => sum + mt.totalImport, 0);

                const exportsToOthers = singleRegionBoundaryLocationBreakdown
                  .filter((row) => {
                    const [leftRegion] = row.boundaryPoint.split("/");
                    return leftRegion.trim() === selectedRegion;
                  })
                  .reduce((sum, row) => sum + row.totalImport, 0);

                const importsFromOthers = singleRegionBoundaryLocationBreakdown
                  .filter((row) => {
                    const [_, rightRegion] = row.boundaryPoint.split("/");
                    return rightRegion?.trim() === selectedRegion;
                  })
                  .reduce((sum, row) => sum + row.totalImport, 0);

                const actualConsumption =
                  bspImport - exportsToOthers + importsFromOthers;

                return (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-primary/10 to-background border-2 border-primary">
                    <div className="flex items-center gap-2">
                      <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg">
                        =
                      </div>
                      <div>
                        <div className="font-bold text-lg text-primary">
                          Actual Regional Consumption
                        </div>
                        <div className="text-sm text-muted-foreground font-mono">
                          {bspImport.toLocaleString("en-US", {
                            minimumFractionDigits: 4,
                            maximumFractionDigits: 4,
                          })}{" "}
                          -{" "}
                          {exportsToOthers.toLocaleString("en-US", {
                            minimumFractionDigits: 4,
                            maximumFractionDigits: 4,
                          })}{" "}
                          +{" "}
                          {importsFromOthers.toLocaleString("en-US", {
                            minimumFractionDigits: 4,
                            maximumFractionDigits: 4,
                          })}{" "}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-primary">
                        {actualConsumption.toLocaleString("en-US", {
                          minimumFractionDigits: 4,
                          maximumFractionDigits: 4,
                        })}
                      </div>
                      <div className="text-sm text-muted-foreground">kWh</div>
                    </div>
                  </div>
                );
              })()}

              {}
              <div className="mt-2 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
                <p className="font-medium mb-2">
                  📊 Understanding the Calculation:
                </p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>
                    <strong>Boundary Point Format:</strong> "Left Region / Right
                    Region" means Left exports TO Right
                  </li>
                  <li>
                    <strong>Import Values:</strong> Energy received BY the right
                    region FROM the left region
                  </li>
                  <li>
                    <strong>Export Values:</strong> Energy sent BY the left
                    region TO the right region
                  </li>
                  <li>
                    <strong>Net Consumption:</strong> Total Grid Import -
                    Outflows + Inflows = What's actually used in this region
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Daily Consumption Trend (BSP Incomers)</CardTitle>
                <CardDescription>
                  Selected period import and export consumption patterns
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={
                    regionalViewMode === "import" ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => setRegionalViewMode("import")}
                  className={
                    regionalViewMode === "import"
                      ? "bg-green-600 hover:bg-green-700"
                      : ""
                  }
                >
                  Import
                </Button>
                <Button
                  variant={
                    regionalViewMode === "export" ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => setRegionalViewMode("export")}
                  className={
                    regionalViewMode === "export"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : ""
                  }
                >
                  Export
                </Button>
                <Button
                  variant={regionalViewMode === "net" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRegionalViewMode("net")}
                >
                  Net
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={regionData.dataPoints}>
                <defs>
                  <linearGradient
                    id="regionImportGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient
                    id="regionExportGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "short",
                    });
                  }}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border bg-background p-3 shadow-lg">
                          <div className="grid gap-2">
                            <div className="flex flex-col">
                              <span className="text-xs uppercase text-muted-foreground mb-1">
                                {new Date(
                                  payload[0].payload.date,
                                ).toLocaleDateString()}
                              </span>
                              {regionalViewMode === "net" && (
                                <span className="font-bold text-foreground">
                                  Net: {formatNumber(payload[0].payload.net)}{" "}
                                  kWh
                                </span>
                              )}
                              {regionalViewMode === "import" && (
                                <span className="font-bold text-green-600">
                                  Import:{" "}
                                  {formatNumber(payload[0].payload.import)} kWh
                                </span>
                              )}
                              {regionalViewMode === "export" && (
                                <span className="font-bold text-blue-600">
                                  Export:{" "}
                                  {formatNumber(payload[0].payload.export)} kWh
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {regionalViewMode === "import" && (
                  <Area
                    type="monotone"
                    dataKey="import"
                    stroke="#16a34a"
                    strokeWidth={3}
                    fill="url(#regionImportGradient)"
                  />
                )}
                {regionalViewMode === "export" && (
                  <Area
                    type="monotone"
                    dataKey="export"
                    stroke="#2563eb"
                    strokeWidth={3}
                    fill="url(#regionExportGradient)"
                  />
                )}
                {regionalViewMode === "net" && (
                  <Area
                    type="monotone"
                    dataKey="net"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    fill="url(#regionImportGradient)"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {}
        <Card>
          <CardHeader>
            <CardTitle>Consumption by Station</CardTitle>
            <CardDescription>
              Stations by import and export within {regionData.region}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                import: {
                  label: "Import",
                  color: "hsl(142, 76%, 36%)",
                },
                export: {
                  label: "Export",
                  color: "hsl(221, 83%, 53%)",
                },
              }}
              className="h-[140px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stationBreakdown}
                  margin={{ top: 10, right: 5, left: 60, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="station" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar
                    dataKey="totalImport"
                    name="Import"
                    fill="hsl(142, 76%, 36%)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="totalExport"
                    name="Export"
                    fill="hsl(221, 83%, 53%)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {}
          <Card>
            <CardHeader>
              <CardTitle>Import vs Export Balance</CardTitle>
              <CardDescription>
                Flow comparison by meter type for {regionData.region}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-500" />
                  Import
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" />
                  Export
                </div>
              </div>

              {meterTypeBreakdown.map((meterType) => {
                const total = meterType.totalImport + meterType.totalExport;
                const importPct =
                  total > 0 ? (meterType.totalImport / total) * 100 : 0;
                const exportPct =
                  total > 0 ? (meterType.totalExport / total) * 100 : 0;
                return (
                  <div key={meterType.meterType} className="space-y-2">
                    {}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        {meterType.meterType}
                      </span>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-green-600 font-bold tabular-nums">
                          {formatNumber(meterType.totalImport)} kWh
                        </span>
                        <span className="text-blue-600 font-bold tabular-nums">
                          {formatNumber(meterType.totalExport)} kWh
                        </span>
                      </div>
                    </div>
                    {}
                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${importPct}%` }}
                      />
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{ width: `${exportPct}%` }}
                      />
                    </div>
                    {}
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{importPct.toFixed(2)}%</span>
                      <span>{exportPct.toFixed(2)}%</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {}
          <Card>
            <CardHeader>
              <CardTitle>Meter Type Distribution</CardTitle>
              <CardDescription>Consumption by meter category</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={meterTypeBreakdown} layout="vertical">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    type="number"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) =>
                      `${(value / 1000000).toFixed(1)}M`
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="meterType"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    width={120}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="totalNet"
                    fill="hsl(var(--primary))"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {}
        <Card>
          <CardHeader>
            <CardTitle>Station Comparison Table</CardTitle>
            <CardDescription>
              Comprehensive breakdown of all stations in {regionData.region}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Station</TableHead>
                    <TableHead className="text-right text-green-600">
                      Import (kWh)
                    </TableHead>
                    <TableHead className="text-right text-blue-600">
                      Export (kWh)
                    </TableHead>
                    <TableHead className="text-right">Net (kWh)</TableHead>
                    <TableHead className="text-right">% of Total</TableHead>
                    <TableHead className="w-[200px]">Contribution</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stationBreakdown.map((station) => (
                    <TableRow key={station.station}>
                      <TableCell className="font-medium">
                        {station.station}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatNumber(station.totalImport, 2)}
                      </TableCell>
                      <TableCell className="text-right text-blue-600">
                        {formatNumber(station.totalExport, 2)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(station.totalNet, 2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {Math.abs(station.percentage).toFixed(1)}%
                      </TableCell>
                      <TableCell>
                        <Progress
                          value={Math.min(Math.abs(station.percentage), 100)}
                          className="h-2"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {}
        {singleRegionBoundaryPoints.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {}
            <Card>
              <CardHeader>
                <CardTitle>
                  Inter-Regional Connections (Online Meters)
                </CardTitle>
                <CardDescription>
                  Boundary metering points connecting {regionData.region} with
                  other regions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    import: {
                      label: "Import",
                      color: "hsl(142, 76%, 36%)",
                    },
                    export: {
                      label: "Export",
                      color: "hsl(221, 83%, 53%)",
                    },
                  }}
                  className="h-[170px] w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={singleRegionBoundaryPoints}
                      layout="vertical"
                      margin={{ top: 10, right: 30, left: 30, bottom: 20 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        type="number"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        axisLine={{
                          stroke: "hsl(var(--border))",
                          strokeWidth: 1,
                        }}
                        tickLine={{ stroke: "hsl(var(--border))" }}
                        tickFormatter={(value) => {
                          if (value >= 1_000_000)
                            return `${(value / 1_000_000).toFixed(0)}M`;
                          if (value >= 1_000)
                            return `${(value / 1_000).toFixed(0)}K`;
                          return Math.round(value).toString();
                        }}
                      />
                      <YAxis
                        dataKey="boundaryPoint"
                        type="category"
                        width={140}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        axisLine={{
                          stroke: "hsl(var(--border))",
                          strokeWidth: 1,
                        }}
                        tickLine={{ stroke: "hsl(var(--border))" }}
                      />
                      <ChartTooltip
                        content={<ChartTooltipContent />}
                        formatter={(value: any) => [
                          `${Number(value).toLocaleString("en-US", {
                            minimumFractionDigits: 4,
                            maximumFractionDigits: 4,
                          })} kWh`,
                        ]}
                      />
                      <Legend />
                      <Bar
                        dataKey="totalImport"
                        name="Import"
                        fill="hsl(142, 76%, 36%)"
                        radius={[0, 4, 4, 0]}
                      />
                      <Bar
                        dataKey="totalExport"
                        name="Export"
                        fill="hsl(221, 83%, 53%)"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>

                {}
                <div className="mt-2 text-sm text-muted-foreground">
                  Showing {singleRegionBoundaryPoints.length} boundary metering
                  point(s) connected to {regionData.region}
                </div>
              </CardContent>
            </Card>

            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}

            {}
            {}

            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}

            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}

            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}

            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}

            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}

            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}

            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {}
            {singleRegionBoundaryLocationBreakdown.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Location Breakdown by Boundary Point</CardTitle>
                  <CardDescription>
                    Detailed meter-level breakdown for each boundary location
                    for online meters
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative border rounded-md">
                    <div
                      className="overflow-auto max-h-[500px]"
                      style={{ position: "relative" }}
                    >
                      <table className="w-full text-sm border-collapse">
                        <thead
                          className="bg-background"
                          style={{ position: "sticky", top: 0, zIndex: 30 }}
                        >
                          <tr className="border-b">
                            <th
                              className="py-1\.5 px-4 text-left font-semibold border-r bg-background"
                              style={{
                                position: "sticky",
                                left: 0,
                                zIndex: 40,
                                minWidth: "180px",
                                width: "180px",
                              }}
                            >
                              Boundary Point
                            </th>
                            <th
                              className="py-1\.5 px-4 text-left font-semibold border-r bg-background"
                              style={{
                                position: "sticky",
                                left: "180px",
                                zIndex: 40,
                                minWidth: "150px",
                                width: "150px",
                              }}
                            >
                              Location
                            </th>
                            <th
                              className="py-1\.5 px-4 text-right font-semibold bg-background"
                              style={{ minWidth: "80px", width: "80px" }}
                            >
                              Meters
                            </th>
                            <th
                              className="py-1\.5 px-4 text-right font-semibold bg-background"
                              style={{ minWidth: "130px", width: "130px" }}
                            >
                              <span className="text-green-600">
                                Import (kWh)
                              </span>
                            </th>
                            <th
                              className="py-1\.5 px-4 text-right font-semibold bg-background"
                              style={{ minWidth: "130px", width: "130px" }}
                            >
                              <span className="text-blue-600">
                                Export (kWh)
                              </span>
                            </th>
                            <th
                              className="py-1\.5 px-4 text-right font-semibold bg-background"
                              style={{ minWidth: "130px", width: "130px" }}
                            >
                              <span className="text-purple-600">Net (kWh)</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {singleRegionBoundaryLocationBreakdown.map(
                            (row, idx) => {
                              const isFirstInGroup =
                                idx === 0 ||
                                row.boundaryPoint !==
                                  singleRegionBoundaryLocationBreakdown[idx - 1]
                                    .boundaryPoint;

                              const rowKey = `${row.boundaryPoint}-${row.location}`;
                              const isExpanded = expandedRows.has(rowKey);

                              const boundaryIndex =
                                singleRegionBoundaryLocationBreakdown
                                  .slice(0, idx + 1)
                                  .filter(
                                    (r, i) =>
                                      i === 0 ||
                                      r.boundaryPoint !==
                                        singleRegionBoundaryLocationBreakdown[
                                          i - 1
                                        ].boundaryPoint,
                                  ).length - 1;
                              const groupBgClass =
                                boundaryIndex % 2 === 0
                                  ? "bg-white dark:bg-background"
                                  : "bg-muted/20";

                              return (
                                <React.Fragment key={idx}>
                                  {}
                                  <tr
                                    className={`border-b hover:bg-muted/50 ${isFirstInGroup && idx !== 0 ? "border-t-2" : ""}`}
                                  >
                                    <td
                                      className={`py-1\.5 px-4 font-medium text-xs border-r ${groupBgClass}`}
                                      style={{
                                        position: "sticky",
                                        left: 0,
                                        zIndex: 20,
                                        minWidth: "180px",
                                        width: "180px",
                                      }}
                                    >
                                      {isFirstInGroup ? row.boundaryPoint : ""}
                                    </td>
                                    <td
                                      className={`py-1\.5 px-4 cursor-pointer border-r ${groupBgClass}`}
                                      style={{
                                        position: "sticky",
                                        left: "180px",
                                        zIndex: 20,
                                        minWidth: "150px",
                                        width: "150px",
                                      }}
                                      onClick={() => toggleRow(rowKey)}
                                    >
                                      <div className="flex items-center gap-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0 flex-shrink-0"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleRow(rowKey);
                                          }}
                                        >
                                          {isExpanded ? (
                                            <ChevronDown className="h-4 w-4" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4" />
                                          )}
                                        </Button>
                                        <span className="font-medium text-xs truncate">
                                          {row.location}
                                        </span>
                                      </div>
                                    </td>
                                    <td
                                      className={`py-1\.5 px-4 text-right ${groupBgClass}`}
                                    >
                                      <Badge
                                        variant="secondary"
                                        className="font-mono text-xs"
                                      >
                                        {row.meterCount}
                                      </Badge>
                                    </td>
                                    <td
                                      className={`py-1\.5 px-4 text-right text-green-600 font-medium text-xs ${groupBgClass}`}
                                    >
                                      {row.totalImport.toLocaleString("en-US", {
                                        minimumFractionDigits: 4,
                                        maximumFractionDigits: 4,
                                      })}
                                    </td>
                                    <td
                                      className={`py-1\.5 px-4 text-right text-blue-600 font-medium text-xs ${groupBgClass}`}
                                    >
                                      {row.totalExport.toLocaleString("en-US", {
                                        minimumFractionDigits: 4,
                                        maximumFractionDigits: 4,
                                      })}
                                    </td>
                                    <td
                                      className={`py-1\.5 px-4 text-right text-purple-600 font-semibold text-xs ${groupBgClass}`}
                                    >
                                      {row.netFlow.toLocaleString("en-US", {
                                        minimumFractionDigits: 4,
                                        maximumFractionDigits: 4,
                                      })}
                                    </td>
                                  </tr>

                                  {}
                                  {isExpanded &&
                                    row.meters.map((meter) => (
                                      <tr
                                        key={`${rowKey}-${meter.meterNumber}`}
                                        className="border-b"
                                      >
                                        <td
                                          className={`py-2 px-4 border-r ${groupBgClass}`}
                                          style={{
                                            position: "sticky",
                                            left: 0,
                                            zIndex: 20,
                                            minWidth: "180px",
                                            width: "180px",
                                          }}
                                        ></td>
                                        <td
                                          className={`py-2 px-4 pl-8 border-r ${groupBgClass}`}
                                          style={{
                                            position: "sticky",
                                            left: "180px",
                                            zIndex: 20,
                                            minWidth: "150px",
                                            width: "150px",
                                          }}
                                        >
                                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <div className="h-px w-4 bg-border flex-shrink-0" />
                                            <span className="font-mono text-xs truncate">
                                              {meter.meterNumber}
                                            </span>
                                            {meter.station && (
                                              <Badge
                                                variant="outline"
                                                className="text-xs flex-shrink-0"
                                              >
                                                {meter.station}
                                              </Badge>
                                            )}
                                          </div>
                                        </td>
                                        <td
                                          className={`py-2 px-4 text-right text-xs text-muted-foreground ${groupBgClass}`}
                                        >
                                          1
                                        </td>
                                        <td
                                          className={`py-2 px-4 text-right text-green-600 text-xs ${groupBgClass}`}
                                        >
                                          {meter.import.toLocaleString(
                                            "en-US",
                                            {
                                              minimumFractionDigits: 4,
                                              maximumFractionDigits: 4,
                                            },
                                          )}
                                        </td>
                                        <td
                                          className={`py-2 px-4 text-right text-blue-600 text-xs ${groupBgClass}`}
                                        >
                                          {meter.export.toLocaleString(
                                            "en-US",
                                            {
                                              minimumFractionDigits: 4,
                                              maximumFractionDigits: 4,
                                            },
                                          )}
                                        </td>
                                        <td
                                          className={`py-2 px-4 text-right text-purple-600 text-xs ${groupBgClass}`}
                                        >
                                          {meter.netFlow.toLocaleString(
                                            "en-US",
                                            {
                                              minimumFractionDigits: 4,
                                              maximumFractionDigits: 4,
                                            },
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                </React.Fragment>
                              );
                            },
                          )}

                          {}
                          <tr
                            className="bg-muted/50 font-semibold border-t-2"
                            style={{
                              position: "sticky",
                              bottom: 0,
                              zIndex: 20,
                            }}
                          >
                            <td
                              className="py-1\.5 px-4 text-xs border-r bg-muted/50"
                              style={{
                                position: "sticky",
                                left: 0,
                                zIndex: 30,
                                minWidth: "180px",
                                width: "180px",
                              }}
                            >
                              Total
                            </td>
                            <td
                              className="py-1\.5 px-4 border-r bg-muted/50"
                              style={{
                                position: "sticky",
                                left: "180px",
                                zIndex: 30,
                                minWidth: "150px",
                                width: "150px",
                              }}
                            ></td>
                            <td className="py-1\.5 px-4 text-right text-xs bg-muted/50">
                              {singleRegionBoundaryLocationBreakdown.reduce(
                                (sum, row) => sum + row.meterCount,
                                0,
                              )}
                            </td>
                            <td className="py-1\.5 px-4 text-right text-green-600 text-xs bg-muted/50">
                              {singleRegionBoundaryLocationBreakdown
                                .reduce((sum, row) => sum + row.totalImport, 0)
                                .toLocaleString("en-US", {
                                  minimumFractionDigits: 4,
                                  maximumFractionDigits: 4,
                                })}
                            </td>
                            <td className="py-1\.5 px-4 text-right text-blue-600 text-xs bg-muted/50">
                              {singleRegionBoundaryLocationBreakdown
                                .reduce((sum, row) => sum + row.totalExport, 0)
                                .toLocaleString("en-US", {
                                  minimumFractionDigits: 4,
                                  maximumFractionDigits: 4,
                                })}
                            </td>
                            <td className="py-1\.5 px-4 text-right text-purple-600 text-xs bg-muted/50">
                              {singleRegionBoundaryLocationBreakdown
                                .reduce((sum, row) => sum + row.netFlow, 0)
                                .toLocaleString("en-US", {
                                  minimumFractionDigits: 4,
                                  maximumFractionDigits: 4,
                                })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {}
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const allKeys =
                          singleRegionBoundaryLocationBreakdown.map(
                            (row) => `${row.boundaryPoint}-${row.location}`,
                          );
                        setExpandedRows(new Set(allKeys));
                      }}
                    >
                      Expand All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandedRows(new Set())}
                    >
                      Collapse All
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderMapView = () => {
    return (
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Consumption Map</h2>
            <p className="text-muted-foreground">
              Geographic visualization of district-level consumption patterns
            </p>
          </div>
          <Button variant="outline" onClick={() => setDrillDownView(null)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Overview
          </Button>
        </div>
      </div>
    );
  };

  const renderSingleMeterHealthDetails = () => {
    const selectedMeter = meterHealthDetails.data?.data?.data?.find(
      (m) => m.meter_number === selectedMeterNumber,
    );

    if (!selectedMeter) {
      return (
        <div className="space-y-2 p-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Meter Not Found</h2>
            </div>
            <Button
              variant="outline"
              onClick={() => setDrillDownView("meters")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Meters
            </Button>
          </div>
        </div>
      );
    }

    const healthPercentage = selectedMeter.uptime_percentage || 0;
    const daysInPeriod = selectedMeter.days_online + selectedMeter.days_offline;

    return (
      <div className="space-y-2 p-3">
        {}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Meter Health Profile</h2>
            <p className="text-muted-foreground">
              Detailed health analysis for {selectedMeterNumber}
            </p>
          </div>
          <Button variant="outline" onClick={() => setDrillDownView("meters")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Meters
          </Button>
        </div>

        {}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Meter Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <div className="text-sm text-muted-foreground mb-1">
                  Meter Number
                </div>
                <div className="font-mono font-semibold">
                  {selectedMeter.meter_number}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Type</div>
                <Badge variant="outline">{selectedMeter.meter_type}</Badge>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Region</div>
                <div className="font-medium">{selectedMeter.region || "—"}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">
                  Station
                </div>
                <div className="font-medium">
                  {selectedMeter.station || "—"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <Card
            className={`border-2 ${selectedMeter.status === "ONLINE" ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Current Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div
                  className={`h-3 w-3 rounded-full ${selectedMeter.status === "ONLINE" ? "bg-green-500" : "bg-red-500"}`}
                />
                <div className="text-lg font-bold">{selectedMeter.status}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Health Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge
                variant="outline"
                className={`text-lg px-3 py-1 ${
                  selectedMeter.health_category === "Excellent"
                    ? "bg-green-500/10 text-green-700 border-green-500/20"
                    : selectedMeter.health_category === "Good"
                      ? "bg-blue-500/10 text-blue-700 border-blue-500/20"
                      : selectedMeter.health_category === "Poor"
                        ? "bg-orange-500/10 text-orange-700 border-orange-500/20"
                        : "bg-red-500/10 text-red-700 border-red-500/20"
                }`}
              >
                {selectedMeter.health_category}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Uptime
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                {healthPercentage.toFixed(1)}%
              </div>
              <Progress value={healthPercentage} className="h-2 mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Days Active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-green-600">
                {selectedMeter.days_online}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                out of {daysInPeriod} days
              </p>
            </CardContent>
          </Card>
        </div>

        {}
        <Card>
          <CardHeader>
            <CardTitle>Activity Distribution</CardTitle>
            <CardDescription>
              Days online vs offline during the selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-green-600">
                      Days Online
                    </span>
                    <span className="text-sm font-bold">
                      {selectedMeter.days_online} days
                    </span>
                  </div>
                  <div className="h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{
                        width: `${daysInPeriod > 0 ? (selectedMeter.days_online / daysInPeriod) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-red-600">
                      Days Offline
                    </span>
                    <span className="text-sm font-bold">
                      {selectedMeter.days_offline} days
                    </span>
                  </div>
                  <div className="h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 transition-all"
                      style={{
                        width: `${daysInPeriod > 0 ? (selectedMeter.days_offline / daysInPeriod) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {}
              <div className="pt-2 border-t">
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Online", value: selectedMeter.days_online },
                        { name: "Offline", value: selectedMeter.days_offline },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name}: ${(percent * 100).toFixed(1)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      <Cell fill="#22c55e" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {}
        <Card>
          <CardHeader>
            <CardTitle>Health Summary</CardTitle>
            <CardDescription>
              Performance analysis for the selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center ${
                    healthPercentage >= 90
                      ? "bg-green-500/10"
                      : healthPercentage >= 70
                        ? "bg-blue-500/10"
                        : healthPercentage >= 50
                          ? "bg-orange-500/10"
                          : "bg-red-500/10"
                  }`}
                >
                  <Activity
                    className={`h-4 w-4 ${
                      healthPercentage >= 90
                        ? "text-green-600"
                        : healthPercentage >= 70
                          ? "text-blue-600"
                          : healthPercentage >= 50
                            ? "text-orange-600"
                            : "text-red-600"
                    }`}
                  />
                </div>
                <div className="flex-1">
                  <div className="font-semibold mb-1">Overall Performance</div>
                  <p className="text-sm text-muted-foreground">
                    {healthPercentage >= 90 &&
                      "Excellent performance with minimal downtime. This meter is operating reliably."}
                    {healthPercentage >= 70 &&
                      healthPercentage < 90 &&
                      "Good performance with acceptable uptime. Minor improvements may be needed."}
                    {healthPercentage >= 50 &&
                      healthPercentage < 70 &&
                      "Fair performance with noticeable downtime. Investigation recommended."}
                    {healthPercentage < 50 &&
                      "Poor performance with significant downtime. Immediate attention required."}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="p-3 rounded-lg border">
                  <div className="text-sm text-muted-foreground mb-1">
                    Total Period
                  </div>
                  <div className="text-lg font-bold">{daysInPeriod} days</div>
                </div>
                <div className="p-3 rounded-lg border bg-green-50">
                  <div className="text-sm text-green-700 mb-1">Online Days</div>
                  <div className="text-lg font-bold text-green-700">
                    {selectedMeter.days_online}
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    {daysInPeriod > 0
                      ? (
                          (selectedMeter.days_online / daysInPeriod) *
                          100
                        ).toFixed(1)
                      : 0}
                    % of period
                  </div>
                </div>
                <div className="p-3 rounded-lg border bg-red-50">
                  <div className="text-sm text-red-700 mb-1">Offline Days</div>
                  <div className="text-lg font-bold text-red-700">
                    {selectedMeter.days_offline}
                  </div>
                  <div className="text-xs text-red-600 mt-1">
                    {daysInPeriod > 0
                      ? (
                          (selectedMeter.days_offline / daysInPeriod) *
                          100
                        ).toFixed(1)
                      : 0}
                    % of period
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {}
        {selectedMeter.last_communication_time && (
          <Card>
            <CardHeader>
              <CardTitle>Communication Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Last Communication:
                </span>
                <span className="font-semibold">
                  {new Date(
                    selectedMeter.last_communication_time,
                  ).toLocaleString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const getMeterTypeBreakdownForRegion = (regionName: string) => {
    if (!aggregateData?.rawData) return [];

    const meterTypeMap = new Map<
      string,
      { import: number; export: number; net: number }
    >();

    aggregateData.rawData.forEach((record: any) => {
      if (record.region !== regionName) return;

      const meterType = record.meter_type || "Unknown";

      if (!meterTypeMap.has(meterType)) {
        meterTypeMap.set(meterType, { import: 0, export: 0, net: 0 });
      }

      const data = meterTypeMap.get(meterType)!;
      const consumption = record.total_consumption || 0;

      if (record.system_name === "import_kwh") {
        data.import += consumption;
      } else if (record.system_name === "export_kwh") {
        data.export += consumption;
      }

      data.net = data.import - data.export;
    });

    return Array.from(meterTypeMap.entries())
      .map(([meterType, data]) => ({ meterType, ...data }))
      .filter((item) => Math.abs(item.import) > 0 || Math.abs(item.export) > 0)
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  };

  const renderRegionalDetails = () => {
    if (selectedRegion) {
      return renderSingleRegionDetails();
    }

    const regionalAnalytics = aggregateDataRegionAnalytics;

    if (!regionalAnalytics.regions.length) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No regional data available</p>
        </div>
      );
    }

    const allExpanded = regionalAnalytics.regions.every((r) =>
      expandedRegions.has(r.region),
    );

    const toggleAllRegions = () => {
      if (allExpanded) {
        setExpandedRegions(new Set());
      } else {
        const allRegionNames = regionalAnalytics.regions.map((r) => r.region);
        setExpandedRegions(new Set(allRegionNames));
      }
    };

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDrillDownView(null)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Overview
            </Button>
            <div>
              <h2 className="text-lg font-bold">Regional Analysis</h2>
              <p className="text-sm text-muted-foreground">
                Comprehensive regional consumption breakdown
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">All Regions</h3>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">
                    Click on any region card to view detailed analysis for that
                    specific region.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>

            {}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleAllRegions}
              className="gap-2 bg-transparent"
            >
              {allExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Hide All Breakdowns
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Show All Breakdowns
                </>
              )}
            </Button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-muted scrollbar-track-muted/20">
            {regionalAnalytics.regions.map((regionData, index) => {
              const meterTypeBreakdown = getMeterTypeBreakdownForRegion(
                regionData.region,
              );
              const isExpanded = expandedRegions.has(regionData.region);

              return (
                <Card
                  key={index}
                  className="min-w-[300px] snap-start hover:shadow-lg transition-shadow"
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle
                        className="text-base cursor-pointer hover:underline hover:text-rose-600"
                        onClick={() => setSelectedRegion(regionData.region)}
                      >
                        {regionData.region}
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        {regionData.trend === "increasing" ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : regionData.trend === "decreasing" ? (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        ) : (
                          <Activity className="h-4 w-4 text-blue-600" />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            const newExpanded = new Set(expandedRegions);
                            if (isExpanded) {
                              newExpanded.delete(regionData.region);
                            } else {
                              newExpanded.add(regionData.region);
                            }
                            setExpandedRegions(newExpanded);
                          }}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {isExpanded && (
                    <CardContent className="space-y-2">
                      {meterTypeBreakdown.length > 0 ? (
                        <>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Import
                            </p>
                            <div className="pl-2 space-y-1 border-l-2 border-blue-200">
                              {meterTypeBreakdown.map((mt, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-xs"
                                >
                                  <span className="text-muted-foreground">
                                    {mt.meterType}
                                  </span>
                                  <span className="font-medium text-blue-600">
                                    {mt.import.toLocaleString("en-US", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}{" "}
                                    kWh
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Export
                            </p>
                            <div className="pl-2 space-y-1 border-l-2 border-orange-200">
                              {meterTypeBreakdown.map((mt, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-xs"
                                >
                                  <span className="text-muted-foreground">
                                    {mt.meterType}
                                  </span>
                                  <span className="font-medium text-orange-600">
                                    {mt.export.toLocaleString("en-US", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}{" "}
                                    kWh
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Net
                            </p>
                            <div className="pl-2 space-y-1 border-l-2 border-muted">
                              {meterTypeBreakdown.map((mt, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-xs"
                                >
                                  <span className="text-muted-foreground">
                                    {mt.meterType}
                                  </span>
                                  <span className="font-medium">
                                    {mt.net.toLocaleString("en-US", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}{" "}
                                    kWh
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="h-2 bg-secondary rounded-full overflow-hidden mt-2 flex">
                              <div
                                className="bg-green-500"
                                style={{
                                  width: `${regionData.totalImport + regionData.totalExport > 0 ? (regionData.totalImport / (regionData.totalImport + regionData.totalExport)) * 100 : 0}%`,
                                }}
                              />
                              <div
                                className="bg-blue-500"
                                style={{
                                  width: `${regionData.totalImport + regionData.totalExport > 0 ? (regionData.totalExport / (regionData.totalImport + regionData.totalExport)) * 100 : 0}%`,
                                }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center gap-1 mb-1">
                              <p className="text-xs font-medium text-muted-foreground">
                                Daily Average
                              </p>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-3 w-3 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">
                                    Total net consumption ÷ number of days in
                                    period
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <div className="pl-2 space-y-1 border-l-2 border-muted">
                              {meterTypeBreakdown.map((mt, idx) => {
                                const dailyAvg =
                                  regionData.dataPoints.length > 0
                                    ? mt.net / regionData.dataPoints.length
                                    : 0;
                                return (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between text-xs"
                                  >
                                    <span className="text-muted-foreground">
                                      {mt.meterType}
                                    </span>
                                    <span className="font-medium">
                                      {dailyAvg.toLocaleString("en-US", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}{" "}
                                      kWh/day
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No breakdown data available
                        </p>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Consumption Trends</CardTitle>
                <CardDescription>
                  Daily{" "}
                  {regionalViewMode === "import"
                    ? "import"
                    : regionalViewMode === "export"
                      ? "export"
                      : "net"}{" "}
                  consumption
                  {!selectedMeterTypes.has("ALL") &&
                    ` (Meter Types: ${Array.from(selectedMeterTypes).join(", ")})`}
                  {!selectedChartRegions.has("ALL") &&
                    ` (Regions: ${Array.from(selectedChartRegions).join(", ")})`}{" "}
                  over the selected period
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {aggregateDataRegionAnalytics.availableMeterTypes.length >
                  0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 bg-transparent"
                      >
                        <Filter className="h-4 w-4" />
                        Meter Types
                        {!selectedMeterTypes.has("ALL") && (
                          <Badge variant="secondary" className="ml-1">
                            {selectedMeterTypes.size}
                          </Badge>
                        )}
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Select Meter Types</DropdownMenuLabel>
                      <DropdownMenuSeparator />

                      <DropdownMenuCheckboxItem
                        checked={selectedMeterTypes.has("ALL")}
                        onCheckedChange={() => handleMeterTypeToggle("ALL")}
                      >
                        <span className="font-semibold">All Types</span>
                      </DropdownMenuCheckboxItem>

                      <DropdownMenuSeparator />

                      {aggregateDataRegionAnalytics.availableMeterTypes.map(
                        (meterType) => (
                          <DropdownMenuCheckboxItem
                            key={meterType}
                            checked={selectedMeterTypes.has(meterType)}
                            onCheckedChange={() =>
                              handleMeterTypeToggle(meterType)
                            }
                          >
                            {meterType}
                          </DropdownMenuCheckboxItem>
                        ),
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {}
                {aggregateDataRegionAnalytics.regions.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 bg-transparent"
                      >
                        <MapPin className="h-4 w-4" />
                        Regions
                        {!selectedChartRegions.has("ALL") && (
                          <Badge variant="secondary" className="ml-1">
                            {selectedChartRegions.size}
                          </Badge>
                        )}
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-56 max-h-36 overflow-y-auto"
                    >
                      <DropdownMenuLabel>Select Regions</DropdownMenuLabel>
                      <DropdownMenuSeparator />

                      <DropdownMenuCheckboxItem
                        checked={selectedChartRegions.has("ALL")}
                        onCheckedChange={() => {
                          setSelectedChartRegions(new Set(["ALL"]));
                        }}
                      >
                        <span className="font-semibold">All Regions</span>
                      </DropdownMenuCheckboxItem>

                      <DropdownMenuSeparator />

                      {aggregateDataRegionAnalytics.regions.map((region) => (
                        <DropdownMenuCheckboxItem
                          key={region.region}
                          checked={selectedChartRegions.has(region.region)}
                          onCheckedChange={() => {
                            const newSelection = new Set(selectedChartRegions);
                            newSelection.delete("ALL");

                            if (newSelection.has(region.region)) {
                              newSelection.delete(region.region);
                              if (newSelection.size === 0) {
                                newSelection.add("ALL");
                              }
                            } else {
                              newSelection.add(region.region);
                            }

                            setSelectedChartRegions(newSelection);
                          }}
                        >
                          {region.region}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {}
                <div className="flex flex-col gap-1 text-xs border-l pl-3">
                  {!selectedChartRegions.has("ALL") &&
                    selectedChartRegions.size >= 2 && (
                      <label className="flex items-center gap-1.5 cursor-pointer select-none text-muted-foreground hover:text-foreground">
                        <input
                          type="checkbox"
                          checked={cumulateRegions}
                          onChange={(e) => setCumulateRegions(e.target.checked)}
                          className="h-3.5 w-3.5 accent-primary"
                        />
                        Cumulate regions
                      </label>
                    )}
                  {!selectedMeterTypes.has("ALL") &&
                    selectedMeterTypes.size >= 2 && (
                      <label className="flex items-center gap-1.5 cursor-pointer select-none text-muted-foreground hover:text-foreground">
                        <input
                          type="checkbox"
                          checked={cumulateMeterTypes}
                          onChange={(e) =>
                            setCumulateMeterTypes(e.target.checked)
                          }
                          className="h-3.5 w-3.5 accent-primary"
                        />
                        Cumulate meter types
                      </label>
                    )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={
                      regionalViewMode === "import" ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => setRegionalViewMode("import")}
                  >
                    Import
                  </Button>
                  <Button
                    variant={
                      regionalViewMode === "export" ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => setRegionalViewMode("export")}
                  >
                    Export
                  </Button>
                  <Button
                    variant={regionalViewMode === "net" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRegionalViewMode("net")}
                  >
                    Net
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {regionalChartLines.length > 0 ? (
              <div className="h-116">
                <ResponsiveContainer width="100%" height="100%">
                  {cumulateRegions && regionalChartLines.length === 1 ? (
                    <AreaChart
                      data={regionalChartLines[0].data}
                      margin={{ top: 5, right: 30, left: 30, bottom: -10 }}
                    >
                      <defs>
                        <linearGradient
                          id="cumulAreaGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor={regionalChartLines[0].color}
                            stopOpacity={0.85}
                          />
                          <stop
                            offset="95%"
                            stopColor={regionalChartLines[0].color}
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          return date.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          });
                        }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tickFormatter={(value) =>
                          `${(value / 1000000).toFixed(1)}M`
                        }
                        label={{
                          value: "kWh",
                          angle: -90,
                          position: "insideLeft",
                        }}
                      />
                      <Tooltip
                        formatter={(value: any) => `${formatNumber(value)} kWh`}
                        labelFormatter={(label) => {
                          const date = new Date(label);
                          return date.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          });
                        }}
                        labelStyle={{ color: "#000" }}
                      />
                      <Legend
                        wrapperStyle={{ paddingTop: "1px" }}
                        iconType="rect"
                        iconSize={14}
                      />
                      <Area
                        type="monotone"
                        dataKey={regionalViewMode}
                        name={regionalChartLines[0].name}
                        stroke={regionalChartLines[0].color}
                        fill="url(#cumulAreaGradient)"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />
                    </AreaChart>
                  ) : (
                    <RechartsLineChart
                      margin={{ top: 5, right: 30, left: 30, bottom: -10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        type="category"
                        allowDuplicatedCategory={false}
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          return date.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          });
                        }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tickFormatter={(value) =>
                          `${(value / 1000000).toFixed(1)}M`
                        }
                        label={{
                          value: "kWh",
                          angle: -90,
                          position: "insideLeft",
                        }}
                      />
                      <Tooltip
                        formatter={(value: any) => `${formatNumber(value)} kWh`}
                        labelFormatter={(label) => {
                          const date = new Date(label);
                          return date.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          });
                        }}
                        labelStyle={{ color: "#000" }}
                      />
                      <Legend
                        wrapperStyle={{ paddingTop: "1px" }}
                        iconType="line"
                        iconSize={20}
                      />
                      {regionalChartLines.map((line) => (
                        <Line
                          key={line.key}
                          data={line.data}
                          type="monotone"
                          dataKey={regionalViewMode}
                          name={line.name}
                          stroke={line.color}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 5 }}
                        />
                      ))}
                    </RechartsLineChart>
                  )}
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No trend data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Import vs Export Balance</CardTitle>
                <CardDescription>
                  Regional flow comparison
                  {!selectedBalanceMeterTypes.has("ALL") &&
                    ` (Filtered: ${Array.from(selectedBalanceMeterTypes).join(", ")})`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {aggregateDataRegionAnalytics.availableMeterTypes.length >
                  0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 bg-transparent"
                      >
                        <Filter className="h-4 w-4" />
                        Meter Types
                        {!selectedBalanceMeterTypes.has("ALL") && (
                          <Badge variant="secondary" className="ml-1">
                            {selectedBalanceMeterTypes.size}
                          </Badge>
                        )}
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Select Meter Types</DropdownMenuLabel>
                      <DropdownMenuSeparator />

                      <DropdownMenuCheckboxItem
                        checked={selectedBalanceMeterTypes.has("ALL")}
                        onCheckedChange={() =>
                          handleBalanceMeterTypeToggle("ALL")
                        }
                      >
                        <span className="font-semibold">All Types</span>
                      </DropdownMenuCheckboxItem>

                      <DropdownMenuSeparator />

                      {aggregateDataRegionAnalytics.availableMeterTypes.map(
                        (meterType) => (
                          <DropdownMenuCheckboxItem
                            key={meterType}
                            checked={selectedBalanceMeterTypes.has(meterType)}
                            onCheckedChange={() =>
                              handleBalanceMeterTypeToggle(meterType)
                            }
                          >
                            {meterType}
                          </DropdownMenuCheckboxItem>
                        ),
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              let barChartData;

              if (selectedBalanceMeterTypes.has("ALL")) {
                barChartData = regionalAnalytics.regions.map((r) => ({
                  region: r.region,
                  import: r.totalImport,
                  export: -r.totalExport,
                }));
              } else {
                barChartData = regionalAnalytics.regions
                  .map((region) => {
                    const filteredMeterTypes = region.meterTypeBreakdown.filter(
                      (mt) => selectedBalanceMeterTypes.has(mt.meterType),
                    );

                    if (filteredMeterTypes.length === 0) return null;

                    const totalImport = filteredMeterTypes.reduce(
                      (sum, mt) => sum + mt.totalImport,
                      0,
                    );
                    const totalExport = filteredMeterTypes.reduce(
                      (sum, mt) => sum + mt.totalExport,
                      0,
                    );

                    return {
                      region: region.region,
                      import: totalImport,
                      export: -totalExport,
                    };
                  })
                  .filter(
                    (region) =>
                      region !== null &&
                      (Math.abs(region.import) > 0 ||
                        Math.abs(region.export) > 0),
                  )
                  .sort((a, b) => Math.abs(b.import) - Math.abs(a.import));
              }

              return barChartData.length > 0 ? (
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={barChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        tickFormatter={(value) => formatNumber(Math.abs(value))}
                      />
                      <YAxis
                        type="category"
                        dataKey="region"
                        width={120}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        formatter={(value: any) =>
                          `${formatNumber(Math.abs(value))} kWh`
                        }
                      />
                      <Legend />
                      <Bar
                        dataKey="import"
                        fill={COLORS[0]}
                        name="Import (kWh)"
                      />
                      <Bar
                        dataKey="export"
                        fill={COLORS[3]}
                        name="Export (kWh)"
                      />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No balance data available
                </div>
              );
            })()}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Complete Regional Breakdown</CardTitle>
                <CardDescription>
                  All regions with detailed consumption metrics
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={regionalViewMode === "net" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRegionalViewMode("net")}
                >
                  Total Net
                </Button>
                <Button
                  variant={
                    regionalViewMode === "import" ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => setRegionalViewMode("import")}
                >
                  Import
                </Button>
                <Button
                  variant={
                    regionalViewMode === "export" ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => setRegionalViewMode("export")}
                >
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {regionalAnalytics.regions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Region</TableHead>
                    {regionalViewMode === "net" && (
                      <>
                        <TableHead className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            Import (kWh)
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-3 w-3 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-xs">
                                  Total energy imported into the region
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableHead>
                        <TableHead className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            Export (kWh)
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-3 w-3 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-xs">
                                  Total energy exported from the region
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableHead>
                        <TableHead className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            Net (kWh)
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-3 w-3 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Import - Export</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableHead>
                      </>
                    )}
                    {regionalViewMode === "import" && (
                      <TableHead className="text-right">
                        Total Import (kWh)
                      </TableHead>
                    )}
                    {regionalViewMode === "export" && (
                      <TableHead className="text-right">
                        Total Export (kWh)
                      </TableHead>
                    )}
                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        Daily Avg
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">
                              Average daily net consumption
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        % of Total
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">
                              Region's share of total{" "}
                              {regionalViewMode === "import"
                                ? "imports"
                                : regionalViewMode === "export"
                                  ? "exports"
                                  : "net consumption"}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regionalAnalytics.regions.map((regionData, index) => {
                    const totalValue =
                      regionalViewMode === "import"
                        ? regionalAnalytics.regions.reduce(
                            (sum, r) => sum + r.totalImport,
                            0,
                          )
                        : regionalViewMode === "export"
                          ? regionalAnalytics.regions.reduce(
                              (sum, r) => sum + r.totalExport,
                              0,
                            )
                          : regionalAnalytics.regions.reduce(
                              (sum, r) => sum + Math.abs(r.totalNet),
                              0,
                            );

                    const regionValue =
                      regionalViewMode === "import"
                        ? regionData.totalImport
                        : regionalViewMode === "export"
                          ? regionData.totalExport
                          : Math.abs(regionData.totalNet);

                    const percentage =
                      totalValue > 0 ? (regionValue / totalValue) * 100 : 0;

                    const meterTypeBreakdown = getMeterTypeBreakdownForRegion(
                      regionData.region,
                    );
                    const isExpanded = expandedTableRegions.has(
                      regionData.region,
                    );

                    return (
                      <React.Fragment key={index}>
                        {}
                        <TableRow className="hover:bg-muted/50">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => {
                                  const newExpanded = new Set(
                                    expandedTableRegions,
                                  );
                                  if (isExpanded) {
                                    newExpanded.delete(regionData.region);
                                  } else {
                                    newExpanded.add(regionData.region);
                                  }
                                  setExpandedTableRegions(newExpanded);
                                }}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                              {regionData.region}
                              <span className="text-xs text-muted-foreground">
                                {regionData.trend === "increasing"
                                  ? "(↑)"
                                  : regionData.trend === "decreasing"
                                    ? "(↓)"
                                    : "(→)"}
                              </span>
                            </div>
                          </TableCell>
                          {regionalViewMode === "net" && (
                            <>
                              <TableCell className="text-right text-blue-600 font-medium">
                                {regionData.totalImport.toLocaleString(
                                  "en-US",
                                  {
                                    minimumFractionDigits: 4,
                                    maximumFractionDigits: 4,
                                  },
                                )}
                              </TableCell>
                              <TableCell className="text-right text-orange-600 font-medium">
                                {regionData.totalExport.toLocaleString(
                                  "en-US",
                                  {
                                    minimumFractionDigits: 4,
                                    maximumFractionDigits: 4,
                                  },
                                )}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {regionData.totalNet.toLocaleString("en-US", {
                                  minimumFractionDigits: 4,
                                  maximumFractionDigits: 4,
                                })}
                              </TableCell>
                            </>
                          )}
                          {regionalViewMode === "import" && (
                            <TableCell className="text-right font-semibold text-blue-600">
                              {regionData.totalImport.toLocaleString("en-US", {
                                minimumFractionDigits: 4,
                                maximumFractionDigits: 4,
                              })}
                            </TableCell>
                          )}
                          {regionalViewMode === "export" && (
                            <TableCell className="text-right font-semibold text-orange-600">
                              {regionData.totalExport.toLocaleString("en-US", {
                                minimumFractionDigits: 4,
                                maximumFractionDigits: 4,
                              })}
                            </TableCell>
                          )}
                          <TableCell className="text-right">
                            {regionData.dailyAvg.toLocaleString("en-US", {
                              minimumFractionDigits: 4,
                              maximumFractionDigits: 4,
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-24 bg-muted rounded-full h-2">
                                <div
                                  className="bg-primary h-full rounded-full"
                                  style={{
                                    width: `${Math.min(percentage, 100)}%`,
                                  }}
                                />
                              </div>
                              <span className="text-xs font-medium min-w-[3rem] text-right">
                                {percentage.toFixed(4)}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>

                        {}
                        {isExpanded && meterTypeBreakdown.length > 0 && (
                          <>
                            {meterTypeBreakdown.map((mt, mtIdx) => {
                              const mtPercentage =
                                regionData.totalNet !== 0
                                  ? (Math.abs(mt.net) /
                                      Math.abs(regionData.totalNet)) *
                                    100
                                  : 0;

                              return (
                                <TableRow
                                  key={`${regionData.region}-${mt.meterType}`}
                                  className="bg-muted/30"
                                >
                                  <TableCell className="pl-12">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <div className="h-px w-4 bg-border" />
                                      {mt.meterType}
                                    </div>
                                  </TableCell>
                                  {regionalViewMode === "net" && (
                                    <>
                                      <TableCell className="text-right text-blue-600 text-sm">
                                        {mt.import?.toLocaleString("en-US", {
                                          minimumFractionDigits: 4,
                                          maximumFractionDigits: 4,
                                        })}
                                      </TableCell>
                                      <TableCell className="text-right text-orange-600 text-sm">
                                        {mt.export?.toLocaleString("en-US", {
                                          minimumFractionDigits: 4,
                                          maximumFractionDigits: 4,
                                        })}
                                      </TableCell>
                                      <TableCell className="text-right text-sm">
                                        {mt.net?.toLocaleString("en-US", {
                                          minimumFractionDigits: 4,
                                          maximumFractionDigits: 4,
                                        })}
                                      </TableCell>
                                    </>
                                  )}
                                  {regionalViewMode === "import" && (
                                    <TableCell className="text-right text-blue-600 text-sm">
                                      {mt.import?.toLocaleString("en-US", {
                                        minimumFractionDigits: 4,
                                        maximumFractionDigits: 4,
                                      })}
                                    </TableCell>
                                  )}
                                  {regionalViewMode === "export" && (
                                    <TableCell className="text-right text-orange-600 text-sm">
                                      {mt.export?.toLocaleString("en-US", {
                                        minimumFractionDigits: 4,
                                        maximumFractionDigits: 4,
                                      })}
                                    </TableCell>
                                  )}
                                  <TableCell className="text-right text-sm text-muted-foreground">
                                    {(regionData.dataPoints.length > 0
                                      ? (mt.net || 0) /
                                        regionData.dataPoints.length
                                      : 0
                                    ).toLocaleString("en-US", {
                                      minimumFractionDigits: 4,
                                      maximumFractionDigits: 4,
                                    })}
                                  </TableCell>
                                  <TableCell className="text-right text-sm text-muted-foreground">
                                    <div className="flex items-center justify-end gap-2">
                                      <div className="w-24 bg-muted rounded-full h-2">
                                        <div
                                          className="bg-primary/60 h-full rounded-full"
                                          style={{
                                            width: `${Math.min(mtPercentage, 100)}%`,
                                          }}
                                        />
                                      </div>
                                      <span className="text-xs font-medium min-w-[3rem] text-right">
                                        {mtPercentage.toFixed(4)}%
                                      </span>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No regional data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  if (false) {
    const allMeterTypes = meterTypeDetailedBreakdown || [];

    return (
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Category Breakdown</h2>
          </div>
        </div>

        <div className="relative">
          <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-muted scrollbar-track-muted/20">
            {allMeterTypes.map((meterType, index) => {
              const displayValue =
                categoryViewMode === "net"
                  ? meterType.net_kwh
                  : categoryViewMode === "import"
                    ? meterType.total_import_kwh
                    : categoryViewMode === "export"
                      ? meterType.total_export_kwh
                      : 0;

              const totalValue =
                categoryViewMode === "net"
                  ? netConsumption
                  : categoryViewMode === "import"
                    ? totalImport
                    : totalExport;

              const percentage =
                totalValue > 0
                  ? (Math.abs(displayValue) / Math.abs(totalValue)) * 100
                  : 0;

              const meterTypeSlug = meterType.meter_type
                .toLowerCase()
                .replace(/_/g, "-");

              return (
                <Card key={index} className="min-w-[280px] snap-start">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base font-semibold">
                        {formatMeterType(meterType.meter_type)}
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          asChild
                        >
                          <a
                            href={`/meter-category/${meterTypeSlug}`}
                            title="View category details"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs">
                                {categoryViewMode === "net" &&
                                  "Net Consumption = Import - Export"}
                                {categoryViewMode === "import" &&
                                  "Total energy imported by this meter type"}
                                {categoryViewMode === "export" &&
                                  "Total energy exported by this meter type"}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <div className="text-lg font-bold">
                        {formatNumber(displayValue)}
                      </div>
                      <div className="text-xs text-muted-foreground">kWh</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">
                          Contribution
                        </span>
                      </div>
                      {(() => {
                        const importValue = meterType.total_import_kwh || 0;
                        const exportValue = meterType.total_export_kwh || 0;
                        const total = importValue + exportValue;
                        const importPercentage =
                          total > 0 ? (importValue / total) * 100 : 0;
                        const exportPercentage =
                          total > 0 ? (exportValue / total) * 100 : 0;

                        return (
                          <div className="w-full bg-muted rounded-full h-2 flex overflow-hidden">
                            {importPercentage > 0 && (
                              <div
                                className="bg-green-500 h-2 transition-all"
                                style={{ width: `${importPercentage}%` }}
                                title={`Import: ${formatNumber(importValue)} kWh (${importPercentage.toFixed(1)}%)`}
                              />
                            )}
                            {exportPercentage > 0 && (
                              <div
                                className="bg-blue-500 h-2 transition-all"
                                style={{ width: `${exportPercentage}%` }}
                                title={`Export: ${formatNumber(exportValue)} kWh (${exportPercentage.toFixed(1)}%)`}
                              />
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t">
                      <div>
                        <div className="text-muted-foreground">Import</div>
                        <div className="font-medium">
                          {formatNumber(meterType.total_import_kwh)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Export</div>
                        <div className="font-medium">
                          {formatNumber(meterType.total_export_kwh)}
                        </div>
                      </div>
                    </div>

                    {}
                    {(() => {
                      const meterStatus =
                        meterHealthSummary.data?.data?.by_meter_type?.find(
                          (mt: any) => mt.meter_type === meterType.meter_type,
                        );

                      if (!meterStatus) return null;

                      const totalMeters = meterStatus.total || 0;
                      const onlineMeters = meterStatus.online || 0;
                      const offlineMeters = meterStatus.offline || 0;
                      const onlinePercentage =
                        totalMeters > 0
                          ? (onlineMeters / totalMeters) * 100
                          : 0;

                      return (
                        <div className="pt-2 border-t space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground font-medium">
                              Meter Status
                            </span>
                            <span className="text-xs font-semibold">
                              {onlinePercentage.toFixed(1)}% Online
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="text-center p-2 rounded bg-muted/50">
                              <div className="text-muted-foreground">Total</div>
                              <div className="font-semibold text-sm">
                                {totalMeters}
                              </div>
                            </div>
                            <div className="text-center p-2 rounded bg-green-50">
                              <div className="text-green-600">Online</div>
                              <div className="font-semibold text-sm text-green-700">
                                {onlineMeters}
                              </div>
                            </div>
                            <div className="text-center p-2 rounded bg-red-50">
                              <div className="text-red-600">Offline</div>
                              <div className="font-semibold text-sm text-red-700">
                                {offlineMeters}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 border rounded-lg p-1 w-fit">
          <Button
            variant={categoryViewMode === "net" ? "default" : "ghost"}
            size="sm"
            onClick={() => setCategoryViewMode("net")}
          >
            Net Consumption
          </Button>
          <Button
            variant={categoryViewMode === "import" ? "default" : "ghost"}
            size="sm"
            onClick={() => setCategoryViewMode("import")}
          >
            Import
          </Button>
          <Button
            variant={categoryViewMode === "export" ? "default" : "ghost"}
            size="sm"
            onClick={() => setCategoryViewMode("export")}
          >
            Export
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Consumption Trends</CardTitle>
                <CardDescription>
                  Daily {categoryViewMode} consumption patterns by meter type
                </CardDescription>
              </div>

              {}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 bg-transparent"
                  >
                    <Filter className="h-4 w-4" />
                    Filter Meter Types
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    Select Meter Types to Display
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {}
                  <DropdownMenuCheckboxItem
                    checked={selectedChartMeterTypes.has("ALL")}
                    onCheckedChange={() => {
                      const newSelection = new Set(["ALL"]);
                      setSelectedChartMeterTypes(newSelection);
                    }}
                  >
                    <span className="font-semibold">All Types</span>
                  </DropdownMenuCheckboxItem>

                  <DropdownMenuSeparator />

                  {}
                  {allMeterTypes.map((meterType) => (
                    <DropdownMenuCheckboxItem
                      key={meterType.meter_type}
                      checked={selectedChartMeterTypes.has(
                        meterType.meter_type,
                      )}
                      onCheckedChange={() => {
                        const newSelection = new Set(selectedChartMeterTypes);
                        newSelection.delete("ALL");

                        if (newSelection.has(meterType.meter_type)) {
                          newSelection.delete(meterType.meter_type);
                          if (newSelection.size === 0) {
                            newSelection.add("ALL");
                          }
                        } else {
                          newSelection.add(meterType.meter_type);
                        }

                        setSelectedChartMeterTypes(newSelection);
                      }}
                    >
                      {meterType.meter_type}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            {allMeterTypes.length > 0 &&
            allMeterTypes[0].dailyData.length > 0 ? (
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      type="category"
                      allowDuplicatedCategory={false}
                      tickFormatter={(value) =>
                        new Date(value).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      }
                    />
                    <YAxis
                      tickFormatter={(value) =>
                        `${(value / 1000000).toFixed(1)}M`
                      }
                    />
                    <Tooltip
                      labelFormatter={(value) =>
                        new Date(value).toLocaleDateString()
                      }
                      formatter={(value: any) => [formatNumber(value), "kWh"]}
                    />
                    <Legend />
                    {(() => {
                      let meterTypesToShow = allMeterTypes;

                      if (!selectedChartMeterTypes.has("ALL")) {
                        meterTypesToShow = allMeterTypes.filter((mt) =>
                          selectedChartMeterTypes.has(mt.meter_type),
                        );
                      }

                      meterTypesToShow = meterTypesToShow.slice(0, 8);

                      return meterTypesToShow.map((meterType, index) => {
                        const dataKey =
                          categoryViewMode === "net"
                            ? "net"
                            : categoryViewMode === "import"
                              ? "import"
                              : "export";

                        const chartData = meterType.dailyData.map((d) => ({
                          date: d.date,
                          net: d.import - d.export,
                          import: d.import,
                          export: d.export,
                        }));

                        return (
                          <Line
                            key={meterType.meter_type}
                            data={chartData}
                            type="monotone"
                            dataKey={dataKey}
                            name={meterType.meter_type}
                            stroke={COLORS[index % COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                          />
                        );
                      });
                    })()}
                  </LineChart>
                </ResponsiveContainer>

                {}
                {!selectedChartMeterTypes.has("ALL") &&
                  allMeterTypes.filter((mt) =>
                    selectedChartMeterTypes.has(mt.meter_type),
                  ).length === 0 && (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      No meter types selected. Please select at least one meter
                      type from the filter.
                    </div>
                  )}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No trend data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Import vs Export Balance</CardTitle>
                <CardDescription>
                  Energy flow comparison by meter type
                </CardDescription>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      Visualizes the balance between imported and exported
                      energy for each meter type
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent>
            {allMeterTypes.length > 0 ? (
              <div className="space-y-2">
                {allMeterTypes.map((meterType, index) => {
                  const maxValue = Math.max(
                    meterType.total_import_kwh,
                    meterType.total_export_kwh,
                  );
                  const importPercentage =
                    maxValue > 0
                      ? (meterType.total_import_kwh / maxValue) * 100
                      : 0;
                  const exportPercentage =
                    maxValue > 0
                      ? (meterType.total_export_kwh / maxValue) * 100
                      : 0;

                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">
                          {formatMeterType(meterType.meter_type)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Net: {formatNumber(meterType.net_kwh)} kWh
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-green-600">Import</span>
                            <span className="font-medium">
                              {formatNumber(meterType.total_import_kwh)}
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full transition-all"
                              style={{ width: `${importPercentage}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-blue-600">Export</span>
                            <span className="font-medium">
                              {formatNumber(meterType.total_export_kwh)}
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${exportPercentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Detailed Breakdown</CardTitle>
                <CardDescription>
                  Complete meter type consumption metrics
                </CardDescription>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      Contribution % = (Meter Type Value / Total{" "}
                      {categoryViewMode.charAt(0).toUpperCase() +
                        categoryViewMode.slice(1)}
                      ) × 100
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent>
            {allMeterTypes.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metering Type</TableHead>
                    <TableHead className="text-right text-green-600">
                      Import (kWh)
                    </TableHead>
                    <TableHead className="text-right text-blue-600">
                      Export (kWh)
                    </TableHead>
                    <TableHead className="text-right">Net (kWh)</TableHead>
                    <TableHead className="text-right">Contribution</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allMeterTypes.map((meterType, index) => {
                    const netValue = meterType.net_kwh;
                    const percentage =
                      netConsumption > 0
                        ? (Math.abs(netValue) / Math.abs(netConsumption)) * 100
                        : 0;

                    return (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {formatMeterType(meterType.meter_type)}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatNumber(meterType.total_import_kwh)}
                        </TableCell>
                        <TableCell className="text-right text-blue-600">
                          {formatNumber(meterType.total_export_kwh)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(netValue)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-24 bg-muted rounded-full h-2">
                              <div
                                className="bg-primary h-full rounded-full"
                                style={{
                                  width: `${Math.min(percentage, 100)}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs font-medium min-w-[3rem] text-right">
                              {percentage.toFixed(4)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Full Meters Ranking
                </CardTitle>
                <CardDescription>
                  Complete import and export rankings for all meters - Online
                  and reporting
                  {sortedMeters.length > 0 &&
                    ` (${sortedMeters.length} meters)`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {}
                {}
                {}
                {}
                {}
                {}
                {}
                {}
                {}
                {}
                {}
                {}
                {}
                {}
                {}
                {}
                {}
                {}
                {}
                {}
                {}
                {}
                {}
                {}
                {}
                {}
                {}

                <Select
                  value={groupBy}
                  onValueChange={(value: any) => setGroupBy(value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Group by..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Grouping</SelectItem>
                    <SelectItem value="meter_type">Group by Type</SelectItem>
                    {}
                    {}
                    {}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {rankingsLoading ? (
              <Skeleton className="h-[170px] w-full" />
            ) : !meterRankings?.rankings ||
              meterRankings.rankings.length === 0 ? (
              <div className="h-[170px] flex items-center justify-center border border-dashed rounded-lg">
                <div className="text-center">
                  <p className="text-muted-foreground mb-2">
                    No ranking data available
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Try adjusting your filters or date range.
                  </p>
                </div>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full text-sm">
                    {}
                    <thead className="sticky top-0 z-20 bg-muted/95 backdrop-blur-sm">
                      {}
                      <tr className="border-b">
                        <th
                          colSpan={3}
                          className="py-1\.5 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                        >
                          Meter Information
                        </th>
                        <th
                          colSpan={2}
                          className="py-1\.5 px-4 text-center text-xs font-semibold uppercase tracking-wider border-l bg-green-50/50"
                        >
                          <div className="flex items-center justify-center gap-2">
                            <TrendingUp className="h-4 w-4 text-green-600" />
                            <span className="text-green-700">Import</span>
                          </div>
                        </th>
                        <th
                          colSpan={2}
                          className="py-1\.5 px-4 text-center text-xs font-semibold uppercase tracking-wider border-l bg-blue-50/50"
                        >
                          <div className="flex items-center justify-center gap-2">
                            <TrendingDown className="h-4 w-4 text-blue-600" />
                            <span className="text-blue-700">Export</span>
                          </div>
                        </th>
                        {rankingColumns.showNetKwh && (
                          <th className="py-1\.5 px-4 text-right text-xs font-semibold uppercase tracking-wider border-l">
                            Net
                          </th>
                        )}
                      </tr>

                      {}
                      <tr className="bg-background/95 backdrop-blur-sm border-b-2">
                        <th className="py-1\.5 px-4 text-left font-semibold">
                          Meter #
                        </th>
                        <th className="py-1\.5 px-4 text-left font-semibold">
                          Type
                        </th>
                        <th className="py-1\.5 px-4 text-left font-semibold">
                          Location
                        </th>

                        <th
                          className="py-1\.5 px-4 text-right font-semibold cursor-pointer hover:bg-green-50 transition-colors border-l group"
                          onClick={() => handleSort("import_kwh")}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-green-700">
                              Consumption kWh
                            </span>
                            {sortColumn === "import_kwh" &&
                              (sortDirection === "asc" ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              ))}
                          </div>
                        </th>
                        <th
                          className="py-1\.5 px-4 text-center font-semibold cursor-pointer hover:bg-green-50 transition-colors group"
                          onClick={() => handleSort("import_rank")}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-green-700">Rank</span>
                            {sortColumn === "import_rank" &&
                              (sortDirection === "asc" ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              ))}
                          </div>
                        </th>

                        <th
                          className="py-1\.5 px-4 text-right font-semibold cursor-pointer hover:bg-blue-50 transition-colors border-l group"
                          onClick={() => handleSort("export_kwh")}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-blue-700">kWh</span>
                            {sortColumn === "export_kwh" &&
                              (sortDirection === "asc" ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              ))}
                          </div>
                        </th>
                        <th
                          className="py-1\.5 px-4 text-center font-semibold cursor-pointer hover:bg-blue-50 transition-colors group"
                          onClick={() => handleSort("export_rank")}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-blue-700">Rank</span>
                            {sortColumn === "export_rank" &&
                              (sortDirection === "asc" ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              ))}
                          </div>
                        </th>

                        {rankingColumns.showNetKwh && (
                          <th className="py-1\.5 px-4 text-right font-semibold border-l">
                            Consumption kWh
                          </th>
                        )}
                      </tr>
                    </thead>

                    {}
                    <tbody>
                      {groupBy === "none"
                        ? sortedMeters.map((meter, index) => {
                            const getRankBadgeClass = (rank: number) => {
                              if (rank === 1)
                                return "bg-amber-500 text-white border-amber-600";
                              if (rank === 2)
                                return "bg-gray-400 text-white border-gray-500";
                              if (rank === 3)
                                return "bg-amber-700 text-white border-amber-800";
                              if (rank <= 10)
                                return "bg-green-600 text-white border-green-700";
                              if (rank <= 20)
                                return "bg-blue-600 text-white border-blue-700";
                              return "bg-muted text-muted-foreground border-border";
                            };

                            const getLocationString = () => {
                              if (meter.meter_type === "BSP") {
                                const parts = [
                                  meter.region,
                                  meter.station,
                                  meter.feeder_panel_name,
                                ].filter(Boolean);
                                return parts.join(" • ") || "—";
                              } else if (meter.meter_type === "DTX") {
                                const parts = [
                                  meter.region,
                                  meter.district,
                                ].filter(Boolean);
                                return parts.join(" • ") || "—";
                              } else if (
                                meter.meter_type === "REGIONAL_BOUNDARY"
                              ) {
                                const parts = [
                                  meter.boundary_metering_point,
                                  meter.location,
                                ].filter(Boolean);
                                return parts.join(" • ") || "—";
                              } else if (
                                meter.meter_type === "DISTRICT_BOUNDARY"
                              ) {
                                const parts = [
                                  meter.boundary_metering_point,
                                  meter.location,
                                ].filter(Boolean);
                                return parts.join(" • ") || "—";
                              } else {
                                return meter.region || "—";
                              }
                            };

                            return (
                              <tr
                                key={meter.meter_number}
                                className={`border-b hover:bg-muted/50 transition-colors ${
                                  index % 2 === 0
                                    ? "bg-background"
                                    : "bg-muted/20"
                                }`}
                              >
                                <td className="py-1\.5 px-4 font-mono text-xs">
                                  {meter.meter_number}
                                </td>
                                <td className="py-1\.5 px-4">
                                  <Badge variant="outline" className="text-xs">
                                    {formatMeterType(meter.meter_type)}
                                  </Badge>
                                </td>
                                <td className="py-1\.5 px-4 text-xs">
                                  {getLocationString()}
                                </td>

                                <td className="py-1\.5 px-4 text-right font-semibold bg-green-50/30 border-l">
                                  <span className="text-green-700">
                                    {formatNumber(meter.total_import_kwh)}
                                  </span>
                                </td>
                                <td className="py-1\.5 px-4 text-center bg-green-50/30">
                                  {meter.import_rank ? (
                                    <Badge
                                      variant="outline"
                                      className={`${getRankBadgeClass(meter.import_rank)} font-semibold`}
                                    >
                                      #{meter.import_rank}
                                    </Badge>
                                  ) : (
                                    "—"
                                  )}
                                </td>

                                <td className="py-1\.5 px-4 text-right font-semibold bg-blue-50/30 border-l">
                                  <span className="text-blue-700">
                                    {formatNumber(meter.total_export_kwh)}
                                  </span>
                                </td>
                                <td className="py-1\.5 px-4 text-center bg-blue-50/30">
                                  {meter.export_rank ? (
                                    <Badge
                                      variant="outline"
                                      className={`${getRankBadgeClass(meter.export_rank)} font-semibold`}
                                    >
                                      #{meter.export_rank}
                                    </Badge>
                                  ) : (
                                    "—"
                                  )}
                                </td>

                                {rankingColumns.showNetKwh && (
                                  <td className="py-1\.5 px-4 text-right font-semibold border-l">
                                    {formatNumber(meter.net_kwh)}
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        : Array.from(groupedMeters.entries()).map(
                            ([groupKey, meters]) => {
                              const totals = calculateGroupTotals(meters);
                              const isExpanded = expandedRows.has(groupKey);

                              const allGroupTotals = Array.from(
                                groupedMeters.entries(),
                              ).map(([key, meterList]) => ({
                                key,
                                totalImport:
                                  calculateGroupTotals(meterList).totalImport,
                                totalExport:
                                  calculateGroupTotals(meterList).totalExport,
                              }));
                              const importRanked = allGroupTotals.sort(
                                (a, b) => b.totalImport - a.totalImport,
                              );
                              const exportRanked = allGroupTotals.sort(
                                (a, b) => b.totalExport - a.totalExport,
                              );

                              const groupImportRank =
                                importRanked.findIndex(
                                  (g) => g.key === groupKey,
                                ) + 1;
                              const groupExportRank =
                                exportRanked.findIndex(
                                  (g) => g.key === groupKey,
                                ) + 1;

                              const getRankBadgeClass = (rank: number) => {
                                if (rank === 1)
                                  return "bg-amber-500 text-white border-amber-600";
                                if (rank === 2)
                                  return "bg-gray-400 text-white border-gray-500";
                                if (rank === 3)
                                  return "bg-amber-700 text-white border-amber-800";
                                if (rank <= 10)
                                  return "bg-green-600 text-white border-green-700";
                                if (rank <= 20)
                                  return "bg-blue-600 text-white border-blue-700";
                                return "bg-muted text-muted-foreground border-border";
                              };

                              return (
                                <React.Fragment key={groupKey}>
                                  <tr
                                    className="bg-muted/50 hover:bg-muted/70 cursor-pointer border-b-2"
                                    onClick={() => toggleRow(groupKey)}
                                  >
                                    <td
                                      colSpan={3}
                                      className="py-1\.5 px-4 font-semibold"
                                    >
                                      <div className="flex items-center gap-2">
                                        {isExpanded ? (
                                          <ChevronDown className="h-4 w-4" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4" />
                                        )}
                                        <span>{formatMeterType(groupKey)}</span>
                                        <Badge variant="secondary">
                                          {meters.length} meters
                                        </Badge>
                                      </div>
                                    </td>

                                    <td className="py-1\.5 px-4 text-right font-semibold bg-green-50/50 border-l">
                                      <span className="text-green-700">
                                        {formatNumber(totals.totalImport)}
                                      </span>
                                    </td>
                                    <td className="py-1\.5 px-4 text-center bg-green-50/50">
                                      <Badge
                                        variant="outline"
                                        className={`text-xs ${getRankBadgeClass(groupImportRank)} font-semibold`}
                                      >
                                        #{groupImportRank}
                                      </Badge>
                                    </td>

                                    <td className="py-1\.5 px-4 text-right font-semibold bg-blue-50/50 border-l">
                                      <span className="text-blue-700">
                                        {formatNumber(totals.totalExport)}
                                      </span>
                                    </td>
                                    <td className="py-1\.5 px-4 text-center bg-blue-50/50">
                                      <Badge
                                        variant="outline"
                                        className={`text-xs ${getRankBadgeClass(groupExportRank)} font-semibold`}
                                      >
                                        #{groupExportRank}
                                      </Badge>
                                    </td>

                                    {rankingColumns.showNetKwh && (
                                      <td className="py-1\.5 px-4 text-right font-semibold border-l">
                                        {formatNumber(
                                          totals.totalImport -
                                            totals.totalExport,
                                        )}
                                      </td>
                                    )}
                                  </tr>

                                  {isExpanded &&
                                    meters.map((meter, groupIndex) => {
                                      const groupImportRank = groupIndex + 1;
                                      const groupExportRank = groupIndex + 1;

                                      const getRankBadgeClass = (
                                        rank: number,
                                      ) => {
                                        if (rank === 1)
                                          return "bg-amber-500 text-white border-amber-600";
                                        if (rank === 2)
                                          return "bg-gray-400 text-white border-gray-500";
                                        if (rank === 3)
                                          return "bg-amber-700 text-white border-amber-800";
                                        if (rank <= 10)
                                          return "bg-green-600 text-white border-green-700";
                                        if (rank <= 20)
                                          return "bg-blue-600 text-white border-blue-700";
                                        return "bg-muted text-muted-foreground border-border";
                                      };

                                      const getLocationString = () => {
                                        if (meter.meter_type === "BSP") {
                                          const parts = [
                                            meter.region,
                                            meter.station,
                                            meter.feeder_panel_name,
                                          ].filter(Boolean);
                                          return parts.join(" • ") || "—";
                                        } else if (meter.meter_type === "DTX") {
                                          const parts = [
                                            meter.region,
                                            meter.district,
                                          ].filter(Boolean);
                                          return parts.join(" • ") || "—";
                                        } else if (
                                          meter.meter_type ===
                                          "REGIONAL_BOUNDARY"
                                        ) {
                                          const parts = [
                                            meter.boundary_metering_point,
                                            meter.location,
                                          ].filter(Boolean);
                                          return parts.join(" • ") || "—";
                                        } else if (
                                          meter.meter_type ===
                                          "DISTRICT_BOUNDARY"
                                        ) {
                                          const parts = [
                                            meter.boundary_metering_point,
                                            meter.location,
                                          ].filter(Boolean);
                                          return parts.join(" • ") || "—";
                                        } else {
                                          return meter.region || "—";
                                        }
                                      };

                                      return (
                                        <tr
                                          key={meter.meter_number}
                                          className="border-b hover:bg-muted/30"
                                        >
                                          <td className="py-2 px-4 pl-12 font-mono text-xs">
                                            {meter.meter_number}
                                          </td>
                                          <td className="py-2 px-4">
                                            <Badge
                                              variant="outline"
                                              className="text-xs"
                                            >
                                              {formatMeterType(
                                                meter.meter_type,
                                              )}
                                            </Badge>
                                          </td>
                                          <td className="py-2 px-4 text-xs">
                                            {getLocationString()}
                                          </td>

                                          <td className="py-2 px-4 text-right font-semibold bg-green-50/20 border-l">
                                            <span className="text-green-700">
                                              {formatNumber(
                                                meter.total_import_kwh,
                                              )}
                                            </span>
                                          </td>
                                          <td className="py-2 px-4 text-center bg-green-50/20">
                                            <Badge
                                              variant="outline"
                                              className={`text-xs ${getRankBadgeClass(groupImportRank)} font-semibold`}
                                            >
                                              #{groupImportRank}
                                            </Badge>
                                          </td>

                                          <td className="py-2 px-4 text-right font-semibold bg-blue-50/20 border-l">
                                            <span className="text-blue-700">
                                              {formatNumber(
                                                meter.total_export_kwh,
                                              )}
                                            </span>
                                          </td>
                                          <td className="py-2 px-4 text-center bg-blue-50/20">
                                            <Badge
                                              variant="outline"
                                              className={`text-xs ${getRankBadgeClass(groupExportRank)} font-semibold`}
                                            >
                                              #{groupExportRank}
                                            </Badge>
                                          </td>

                                          {rankingColumns.showNetKwh && (
                                            <td className="py-2 px-4 text-right font-semibold border-l text-xs">
                                              {formatNumber(meter.net_kwh)}
                                            </td>
                                          )}
                                        </tr>
                                      );
                                    })}
                                </React.Fragment>
                              );
                            },
                          )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (drillDownView === "meters") {
    return (
      <div className="h-full overflow-y-auto space-y-2 p-1">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Meter Health Details</h2>
            <p className="text-muted-foreground">
              Detailed meter status and health analysis
            </p>
          </div>
          <Button variant="outline" onClick={() => setDrillDownView(null)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Overview
          </Button>
        </div>
        {renderMeterHealthDetails()}
      </div>
    );
  }

  if (drillDownView === "map") {
    return renderMapView();
  }

  if (drillDownView === "single-meter") {
    return renderSingleMeterHealthDetails();
  }

  // Compact dashboard: 3 KPI cards + consumption / health boards.
  if (compact) {
    return (
      <div className="h-full min-h-0 flex flex-col gap-3 overflow-hidden">
        <div className="grid grid-cols-3 gap-3 shrink-0">
          <Card className="shadow-none border bg-card">
            <CardContent className="py-2.5 px-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-muted-foreground">Purchases (BSP)</p>
                <span className="text-xs font-semibold text-red-600 animate-pulse shrink-0">
                  Check meter Imports
                </span>
              </div>
              <p className="text-2xl font-bold tabular-nums tracking-tight mt-0.5">
                {formatNumber(energyPurchases)}
                <span className="text-sm font-normal text-muted-foreground ml-1.5">kWh</span>
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-none border bg-card">
            <CardContent className="py-2.5 px-4">
              <p className="text-sm font-medium text-muted-foreground">Sales (Zeus + MMS + AMR)</p>
              <p className="text-2xl font-bold tabular-nums tracking-tight mt-0.5">
                {energySales === null ? "—" : formatNumber(energySales)}
                {energySales !== null && (
                  <span className="text-sm font-normal text-muted-foreground ml-1.5">kWh</span>
                )}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-none border bg-card">
            <CardContent className="py-2.5 px-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">System Losses</p>
                <p
                  className={`text-2xl font-bold tabular-nums tracking-tight mt-0.5 ${systemLossColorClass}`}
                >
                  {systemLosses.kwh === null ? "—" : formatNumber(systemLosses.kwh)}
                  {systemLosses.kwh !== null && (
                    <span className={`text-sm font-normal ml-1.5 opacity-70 ${systemLossColorClass}`}>
                      kWh
                    </span>
                  )}
                </p>
              </div>
              <p
                className={`text-2xl font-semibold tabular-nums tracking-tight shrink-0 mt-5 ${systemLossColorClass}`}
              >
                {systemLosses.percentage === null
                  ? "—"
                  : `${systemLosses.percentage.toFixed(2)}%`}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
          <Card className="col-span-12 xl:col-span-7 shadow-none border bg-card flex flex-col min-h-0 overflow-hidden">
            <CardHeader className="py-2 px-3 pb-1.5 shrink-0 border-b">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-base font-semibold">Consumption by Meter Type</CardTitle>
                  <CardDescription className="text-xs">
                    Import, export, and net for the selected period
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3 text-sm font-semibold tabular-nums">
                  <span className="text-green-600">Imp {formatNumber(totalImport, 0)}</span>
                  <span className="text-blue-600">Exp {formatNumber(totalExport, 0)}</span>
                  <span className="text-rose-600">Net {formatNumber(netConsumption, 0)}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-0 overflow-auto">
              {aggregateLoading ? (
                <div className="p-4">
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : (
                <table className="w-full table-fixed text-base">
                  <colgroup>
                    <col className="w-[30%]" />
                    <col className="w-[24%]" />
                    <col className="w-[23%]" />
                    <col className="w-[23%]" />
                  </colgroup>
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b text-muted-foreground text-sm">
                      <th className="text-left font-medium py-1.5 px-3">Type</th>
                      <th className="text-right font-medium py-1.5 px-2 text-green-700">Import</th>
                      <th className="text-right font-medium py-1.5 px-2 text-blue-700">Export</th>
                      <th className="text-right font-medium py-1.5 px-3 text-rose-700">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meterTypeBreakdownData.map((item) => (
                      <tr
                        key={item.meter_type}
                        className="border-b border-border/40 hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-2 px-3 font-medium truncate text-sm">
                          {formatMeterType(item.meter_type)}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums font-semibold text-green-600">
                          {formatNumber(item.total_import_kwh, 2)}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums font-semibold text-blue-600">
                          {formatNumber(item.total_export_kwh, 2)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-semibold text-rose-600">
                          {formatNumber(item.net_kwh, 2)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 bg-muted/20">
                      <td className="py-2.5 px-3 font-bold text-base">Total</td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-lg font-bold text-green-600">
                        {formatNumber(totalImport, 2)}
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-lg font-bold text-blue-600">
                        {formatNumber(totalExport, 2)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-lg font-bold text-rose-600">
                        {formatNumber(netConsumption, 2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card
            className="col-span-12 xl:col-span-5 shadow-none border bg-card flex flex-col min-h-0 overflow-hidden cursor-pointer hover:bg-muted/20 transition-colors group"
            onClick={() => setDrillDownView("meters")}
          >
            <CardHeader className="py-2 px-3 pb-1.5 shrink-0 border-b">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-1.5">
                    Meter Health
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Online / offline by type — click for details
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xl font-bold tabular-nums leading-none">
                      {onlineMeters}
                      <span className="text-sm font-normal text-muted-foreground">
                        {" "}
                        / {totalMeters}
                      </span>
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      healthPercentage >= 90
                        ? "bg-green-500/10 text-green-700 border-green-300"
                        : healthPercentage >= 70
                          ? "bg-amber-500/10 text-amber-700 border-amber-300"
                          : "bg-red-500/10 text-red-700 border-red-300"
                    }
                  >
                    {healthPercentage.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-0 overflow-auto">
              {isLoadingSummary ? (
                <div className="p-4">
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : (
                <table className="w-full table-fixed text-base">
                  <colgroup>
                    <col className="w-[34%]" />
                    <col className="w-[16%]" />
                    <col className="w-[16%]" />
                    <col className="w-[34%]" />
                  </colgroup>
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b text-muted-foreground text-sm">
                      <th className="text-left font-medium py-1.5 px-3">Type</th>
                      <th className="text-right font-medium py-1.5 px-2 text-green-700">Online</th>
                      <th className="text-right font-medium py-1.5 px-2 text-red-600">Offline</th>
                      <th className="text-right font-medium py-1.5 px-3">Health</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byMeterTypeFromSummary.map((mt) => {
                      const pct =
                        mt.online + mt.offline > 0
                          ? Math.round((mt.online / (mt.online + mt.offline)) * 100)
                          : 0;
                      return (
                        <tr
                          key={mt.type}
                          className="border-b border-border/40 hover:bg-muted/30 transition-colors"
                        >
                          <td className="py-2 px-3 font-medium truncate text-sm">
                            {formatMeterType(mt.type)}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums font-semibold text-green-600">
                            {mt.online}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums font-semibold text-red-500">
                            {mt.offline}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    pct >= 90
                                      ? "bg-green-500"
                                      : pct >= 70
                                        ? "bg-amber-500"
                                        : "bg-red-500"
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span
                                className={`text-sm font-semibold tabular-nums w-9 text-right ${
                                  pct >= 90
                                    ? "text-green-700"
                                    : pct >= 70
                                      ? "text-amber-700"
                                      : "text-red-700"
                                }`}
                              >
                                {pct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 bg-muted/20">
                      <td className="py-2.5 px-3 font-bold text-base">Total</td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-lg font-bold text-green-600">
                        {onlineMeters}
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-lg font-bold text-red-500">
                        {Math.max(totalMeters - onlineMeters, 0)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span
                          className={`text-lg font-bold tabular-nums ${
                            healthPercentage >= 90
                              ? "text-green-700"
                              : healthPercentage >= 70
                                ? "text-amber-700"
                                : "text-red-700"
                          }`}
                        >
                          {healthPercentage.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Energy Purchases (BSP Incomers)
              </CardTitle>
              <span className="text-xs font-semibold text-red-600 animate-pulse shrink-0">
                Check meter Imports
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {formatNumber(energyPurchases)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">kWh</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Energy Sales (Zeus + MMS + AMR)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {energySales === null
                ? "Not Yet Available"
                : formatNumber(energySales)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {energySales === null ? "Not Applicable" : "kWh"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              System Losses
            </CardTitle>
          </CardHeader>
          <CardContent>
            {systemLosses.kwh === null ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold">Not Yet Available</div>
                  <p className="text-xs text-muted-foreground mt-1">kWh</p>
                </div>
                <div className="h-16 w-[3px] bg-gray-500 dark:bg-gray-700 mx-4"></div>
                <div className="text-right">
                  <div className="text-lg font-semibold">—</div>
                  <p className="text-xs text-muted-foreground mt-1">Loss %</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-lg font-bold ${systemLossColorClass}`}>
                    {formatNumber(systemLosses.kwh)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">kWh</p>
                </div>
                <div className="h-16 w-px bg-blue-600 dark:bg-gray-700 mx-4"></div>
                <div className="text-right">
                  <div className={`text-lg font-semibold ${systemLossColorClass}`}>
                    {systemLosses.percentage.toFixed(2)}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Loss %</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <Card className="border-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  Import
                </CardTitle>
                <CardDescription className="text-xs">
                  kWh imported
                </CardDescription>
              </div>
              <div className="h-7 w-7 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
            </div>
            {aggregateLoading ? (
              <Skeleton className="h-8 w-40 mt-2" />
            ) : (
              <div className="text-lg font-bold text-green-600 mt-2 text-right">
                {formatNumber(totalImport, 2)}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-0 pt-0">
            <Separator className="mb-2" />
            {aggregateLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              meterTypeBreakdownData.map((item) => (
                <div key={item.meter_type}>
                  <div className="flex items-start justify-between py-1.5">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {formatMeterType(item.meter_type)}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60">
                        kWh
                      </p>
                    </div>
                    <span className="text-base font-semibold text-green-600 tabular-nums">
                      {formatNumber(item.total_import_kwh, 2)}
                    </span>
                  </div>
                  <Separator />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  Export
                </CardTitle>
                <CardDescription className="text-xs">
                  kWh exported
                </CardDescription>
              </div>
              <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <TrendingDown className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            {aggregateLoading ? (
              <Skeleton className="h-8 w-40 mt-2" />
            ) : (
              <div className="text-lg font-bold text-blue-600 mt-2 text-right">
                {formatNumber(totalExport, 2)}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-0 pt-0">
            <Separator className="mb-2" />
            {aggregateLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              meterTypeBreakdownData.map((item) => (
                <div key={item.meter_type}>
                  <div className="flex items-start justify-between py-1.5">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {formatMeterType(item.meter_type)}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60">
                        kWh
                      </p>
                    </div>
                    <span className="text-base font-semibold text-blue-600 tabular-nums">
                      {formatNumber(item.total_export_kwh, 2)}
                    </span>
                  </div>
                  <Separator />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Net</CardTitle>
                <CardDescription className="text-xs">kWh net</CardDescription>
              </div>
              <div className="h-7 w-7 rounded-lg bg-rose-500/10 flex items-center justify-center">
                <Zap className="h-4 w-4 text-rose-600" />
              </div>
            </div>
            {aggregateLoading ? (
              <Skeleton className="h-8 w-40 mt-2" />
            ) : (
              <div className="text-lg font-bold text-rose-600 mt-2 text-right">
                {formatNumber(netConsumption, 2)}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-0 pt-0">
            <Separator className="mb-2" />
            {aggregateLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              meterTypeBreakdownData.map((item) => (
                <div key={item.meter_type}>
                  <div className="flex items-start justify-between py-1.5">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {formatMeterType(item.meter_type)}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60">
                        kWh
                      </p>
                    </div>
                    <span className="text-base font-semibold text-rose-600 tabular-nums">
                      {formatNumber(item.net_kwh, 2)}
                    </span>
                  </div>
                  <Separator />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <Card
          className="relative overflow-hidden border-2 hover:shadow-lg transition-shadow cursor-pointer group"
          onClick={() => setDrillDownView("meters")}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-bl-full" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  Meter Health
                </CardTitle>
                <CardDescription className="text-xs">
                  Online / Total meters
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    healthPercentage >= 90
                      ? "bg-green-500/10 text-green-700 border-green-300"
                      : healthPercentage >= 70
                        ? "bg-amber-500/10 text-amber-700 border-amber-300"
                        : "bg-red-500/10 text-red-700 border-red-300"
                  }
                >
                  {healthPercentage.toFixed(1)}%
                </Badge>
                <div className="h-7 w-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-purple-600" />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoadingSummary ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <>
                <div className="text-xl font-bold tracking-tight">
                  {onlineMeters}
                  <span className="text-lg text-muted-foreground font-normal">
                    {" "}
                    / {totalMeters}
                  </span>
                </div>
                <Progress value={healthPercentage} className="h-2" />
                <div className="space-y-1 pt-1">
                  {byMeterTypeFromSummary.map((mt) => (
                    <div
                      key={mt.type}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-muted-foreground">
                        {formatMeterType(mt.type)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-green-600 font-medium">
                          {mt.online} on
                        </span>
                        <span className="text-red-500 font-medium">
                          {mt.offline} off
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="flex items-center text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity pt-1">
              View Details <ArrowRight className="h-3 w-3 ml-1" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  Online / Offline Status
                </CardTitle>
                <CardDescription className="text-xs">
                  Current meter connectivity by type
                </CardDescription>
              </div>
              <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Activity className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-0 pt-0">
            <Separator className="mb-2" />
            {isLoadingSummary ? (
              <Skeleton className="h-40 w-full" />
            ) : byMeterTypeFromSummary.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No meter data available
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between py-1.5 bg-muted/30 rounded-md px-2 mb-2">
                  <span className="text-xs font-semibold text-foreground">
                    All Meters
                  </span>
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="text-green-600">
                      {onlineMeters} Online
                    </span>
                    <span className="text-red-500">
                      {totalMeters - onlineMeters} Offline
                    </span>
                    <span className="text-muted-foreground">
                      {totalMeters} Total
                    </span>
                  </div>
                </div>
                {byMeterTypeFromSummary.map((mt) => {
                  const pct =
                    mt.online + mt.offline > 0
                      ? Math.round((mt.online / (mt.online + mt.offline)) * 100)
                      : 0;
                  return (
                    <div key={mt.type}>
                      <div className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-2 w-2 rounded-full ${pct >= 90 ? "bg-green-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500"}`}
                          />
                          <span className="text-xs text-muted-foreground">
                            {formatMeterType(mt.type)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-green-600 font-medium w-16 text-right">
                            {mt.online} online
                          </span>
                          <span className="text-red-500 font-medium w-16 text-right">
                            {mt.offline} offline
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] min-w-[40px] justify-center ${pct >= 90 ? "border-green-300 text-green-700" : pct >= 70 ? "border-amber-300 text-amber-700" : "border-red-300 text-red-700"}`}
                          >
                            {pct}%
                          </Badge>
                        </div>
                      </div>
                      <Separator />
                    </div>
                  );
                })}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
