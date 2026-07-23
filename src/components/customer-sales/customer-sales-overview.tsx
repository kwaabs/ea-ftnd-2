"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useCustomerConsumptionAggregate } from "@/hooks/api/use-customer-consumption-aggregate-api";
import { useMmsCustomerSalesAggregate } from "@/hooks/api/use-mms-customer-sales-aggregate-api";
import { useAmrConsumptionAggregate } from "@/hooks/api/use-amr-consumption-aggregate-api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import {
  Zap,
  Users,
  TrendingUp,
  DollarSign,
  BatteryCharging,
  Wallet,
} from "lucide-react";

interface CustomerSalesOverviewProps {
  dateRange: { start: string; end: string };
}

function formatKwh(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  if (value >= 1_000_000_000)
    return `${(value / 1_000_000_000).toFixed(2)} GWh`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} MWh`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)} MWh`;
  return `${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh`;
}

function formatKwhRaw(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return (
    value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " kWh"
  );
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return (
    "₵" +
    value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("en-US");
}

const ZEUS_COLORS = [
  "#3b82f6",
  "#0ea5e9",
  "#06b6d4",
  "#10b981",
  "#6366f1",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#f97316",
  "#14b8a6",
];
const MMS_COLORS = [
  "#16a34a",
  "#15803d",
  "#4ade80",
  "#22c55e",
  "#86efac",
  "#14532d",
  "#166534",
  "#dcfce7",
  "#bbf7d0",
  "#a3e635",
];

const AMR_COLORS = [
  "#f97316",
  "#ea580c",
  "#fb923c",
  "#fdba74",
  "#fed7aa",
  "#c2410c",
  "#9a3412",
  "#7c2d12",
  "#ffedd5",
  "#fff7ed",
];

export function CustomerSalesOverview({
  dateRange,
}: CustomerSalesOverviewProps) {
  const params = { dateFrom: dateRange.start, dateTo: dateRange.end };

  // Option B: one Zeus call grouped by servicetype + region, then partition client-side
  const { data: zeusData, isLoading: zeusLoading } =
    useCustomerConsumptionAggregate({
      ...params,
      groupBy: ["servicetype", "regionname"],
    });
  const { data: mmsData, isLoading: mmsLoading } = useMmsCustomerSalesAggregate(
    {
      ...params,
      groupBy: "region",
    },
  );
  const { data: amrData, isLoading: amrLoading } = useAmrConsumptionAggregate({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
  });

  const zeusRaw = zeusData || [];
  const mmsItems = mmsData || [];
  const amrItems = amrData || [];

  const normalizeZeusType = (raw?: string | null) => {
    const t = (raw || "").trim().toLowerCase();
    if (t === "postpaid") return "Postpaid" as const;
    if (t === "prepaid") return "Prepaid" as const;
    if (t === "amr") return "AMR" as const;
    return "Other" as const;
  };

  // Zeus Postpaid only for region charts / combined Zeus column (avoid double-count with MMS / daily AMR)
  const zeusItems = useMemo(
    () => zeusRaw.filter((i) => normalizeZeusType(i.servicetype) === "Postpaid"),
    [zeusRaw],
  );

  const zeusByServiceType = useMemo(() => {
    const totals = {
      Postpaid: { totalKwh: 0, totalCustomers: 0, totalBilling: 0, totalBalance: 0 },
      Prepaid: { totalKwh: 0, totalCustomers: 0, totalBilling: 0, totalBalance: 0 },
      AMR: { totalKwh: 0, totalCustomers: 0, totalBilling: 0, totalBalance: 0 },
    };
    zeusRaw.forEach((i) => {
      const key = normalizeZeusType(i.servicetype);
      if (key === "Other") return;
      totals[key].totalKwh += i.sum_lastbillconsumption || 0;
      totals[key].totalCustomers += i.customer_count || 0;
      totals[key].totalBilling += i.sum_lastbillamount || 0;
      totals[key].totalBalance += i.sum_currentbalance || 0;
    });
    return totals;
  }, [zeusRaw]);

  // ── Zeus stats (Postpaid — used where Zeus is combined with MMS / daily AMR) ──
  const zeusStats = useMemo(() => {
    const t = zeusByServiceType.Postpaid;
    return {
      ...t,
      avgKwh: t.totalCustomers > 0 ? t.totalKwh / t.totalCustomers : 0,
    };
  }, [zeusByServiceType]);

  // ── MMS stats ──
  const mmsStats = useMemo(() => {
    if (!mmsItems.length)
      return {
        totalKwh: 0,
        totalCustomers: 0,
        totalCredit: 0,
        totalBalance: 0,
        avgKwh: 0,
      };
    const totalKwh = mmsItems.reduce(
      (s, i) => s + (i.sum_last_month_kwh_read || 0),
      0,
    );
    const totalCustomers = mmsItems.reduce(
      (s, i) => s + (i.customer_count || 0),
      0,
    );
    const totalCredit = mmsItems.reduce(
      (s, i) => s + (i.sum_last_month_credit_read || 0),
      0,
    );
    const totalBalance = mmsItems.reduce(
      (s, i) => s + (i.sum_credit_balance_remaining || 0),
      0,
    );
    return {
      totalKwh,
      totalCustomers,
      totalCredit,
      totalBalance,
      avgKwh: totalCustomers > 0 ? totalKwh / totalCustomers : 0,
    };
  }, [mmsItems]);

  // ── AMR stats (aggregate import + export) ──
  const amrStats = useMemo(() => {
    if (!amrItems.length) return { totalKwh: 0, importKwh: 0, exportKwh: 0 };
    const importKwh = amrItems
      .filter((i) => i.system_name === "import_kwh")
      .reduce((s, i) => s + (i.total_consumption || 0), 0);
    const exportKwh = amrItems
      .filter((i) => i.system_name === "export_kwh")
      .reduce((s, i) => s + (i.total_consumption || 0), 0);
    return { totalKwh: importKwh + exportKwh, importKwh, exportKwh };
  }, [amrItems]);

  // ── Combined ──
  const combinedKwh =
    zeusStats.totalKwh + mmsStats.totalKwh + amrStats.totalKwh;
  const combinedCustomers = zeusStats.totalCustomers + mmsStats.totalCustomers;

  // ── Chart data ──
  const zeusByConsumption = useMemo(
    () =>
      [...zeusItems]
        .sort(
          (a, b) =>
            (b.sum_lastbillconsumption || 0) - (a.sum_lastbillconsumption || 0),
        )
        .slice(0, 12),
    [zeusItems],
  );

  const mmsByConsumption = useMemo(
    () =>
      [...mmsItems]
        .sort(
          (a, b) =>
            (b.sum_last_month_kwh_read || 0) - (a.sum_last_month_kwh_read || 0),
        )
        .slice(0, 12),
    [mmsItems],
  );

  // ── AMR by region (import + export) ──
  // active_meters is a per-day count from the backend (already correctly
  // deduplicated within that day). Summing it across every day in the range
  // — like the old code did — inflates "meters" by roughly the number of
  // days selected, and double-counts again since both the import_kwh and
  // export_kwh rows for the same day carry their own active_meters value.
  // Average across days instead, counted once (off the import_kwh axis
  // only) so the two system_name rows per day don't double it.
  const amrByRegion = useMemo(() => {
    const map = new Map<
      string,
      {
        region: string;
        importKwh: number;
        exportKwh: number;
        meterSum: number;
        meterDays: number;
      }
    >();
    amrItems.forEach((i) => {
      const r = i.region || "Unknown";
      if (!map.has(r)) {
        map.set(r, {
          region: r,
          importKwh: 0,
          exportKwh: 0,
          meterSum: 0,
          meterDays: 0,
        });
      }
      const entry = map.get(r)!;
      if (i.system_name === "import_kwh") {
        entry.importKwh += i.total_consumption || 0;
        entry.meterSum += i.active_meters || 0;
        entry.meterDays += 1;
      } else if (i.system_name === "export_kwh") {
        entry.exportKwh += i.total_consumption || 0;
      }
    });
    return [...map.values()]
      .map((e) => ({
        region: e.region,
        importKwh: e.importKwh,
        exportKwh: e.exportKwh,
        meters: e.meterDays > 0 ? Math.round(e.meterSum / e.meterDays) : 0,
      }))
      .sort((a, b) => b.importKwh + b.exportKwh - (a.importKwh + a.exportKwh));
  }, [amrItems]);

  // ── Combined chart: Zeus vs MMS vs AMR kWh by region ──
  const combinedChartData = useMemo(() => {
    const regionMap = new Map<
      string,
      { region: string; zeus: number; mms: number; amr: number }
    >();
    zeusItems.forEach((i) => {
      const r = i.regionname || "Unknown";
      if (!regionMap.has(r)) {
        regionMap.set(r, { region: r, zeus: 0, mms: 0, amr: 0 });
      }
      regionMap.get(r)!.zeus += i.sum_lastbillconsumption || 0;
    });
    mmsItems.forEach((i) => {
      const r = i.region || "Unknown";
      if (!regionMap.has(r)) {
        regionMap.set(r, { region: r, zeus: 0, mms: 0, amr: 0 });
      }
      regionMap.get(r)!.mms += i.sum_last_month_kwh_read || 0;
    });
    amrItems.forEach((i) => {
      const r = i.region || "Unknown";
      if (!regionMap.has(r)) {
        regionMap.set(r, { region: r, zeus: 0, mms: 0, amr: 0 });
      }
      regionMap.get(r)!.amr += i.total_consumption || 0;
    });
    return [...regionMap.values()].sort(
      (a, b) => b.zeus + b.mms + b.amr - (a.zeus + a.mms + a.amr),
    );
  }, [zeusItems, mmsItems, amrItems]);

  const isLoading = zeusLoading || mmsLoading || amrLoading;

  return (
    <div className="space-y-6">
      {/* ── COMBINED SUMMARY HEADER ── */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Combined kWh */}
        <Card className="md:col-span-2 border-2 border-blue-200 bg-blue-50/40">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Customer Consumption
                </CardTitle>
                <CardDescription className="text-[11px]">
                  Zeus Postpaid + MMS + daily AMR
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-12 w-48" />
            ) : (
              <>
                <div className="text-4xl font-bold text-blue-700 tracking-tight">
                  {formatKwh(combinedKwh)}
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className="text-[10px] gap-1 border-blue-300 text-blue-700"
                  >
                    Zeus Postpaid {formatKwh(zeusByServiceType.Postpaid.totalKwh)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] gap-1 border-cyan-300 text-cyan-700"
                  >
                    Zeus Prepaid {formatKwh(zeusByServiceType.Prepaid.totalKwh)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] gap-1 border-indigo-300 text-indigo-700"
                  >
                    Zeus AMR {formatKwh(zeusByServiceType.AMR.totalKwh)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] gap-1 border-green-300 text-green-700"
                  >
                    MMS {formatKwh(mmsStats.totalKwh)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] gap-1 border-orange-300 text-orange-700"
                  >
                    Daily AMR {formatKwh(amrStats.totalKwh)}
                  </Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Combined customers */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-violet-600" />
              </div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Customers
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatNumber(combinedCustomers)}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-blue-600">
                    Zeus: {formatNumber(zeusStats.totalCustomers)}
                  </span>
                  <span className="text-[10px] text-green-600">
                    MMS: {formatNumber(mmsStats.totalCustomers)}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Avg kWh */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-cyan-600" />
              </div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg kWh / Customer
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <>
                <div className="text-2xl font-bold text-cyan-700">
                  {formatKwh(
                    combinedCustomers > 0 ? combinedKwh / combinedCustomers : 0,
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across Zeus + MMS customers
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── COMBINED COMPARISON CHART ── */}
      <Card>
        <CardHeader>
          <CardTitle>Consumption by Region — All Sources</CardTitle>
          <CardDescription>
            Zeus Postpaid, MMS (prepaid system), and daily AMR kWh per region
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : combinedChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              No data available
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={combinedChartData}
                margin={{ top: 8, right: 16, left: 16, bottom: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="region"
                  angle={-35}
                  textAnchor="end"
                  tick={{ fontSize: 11 }}
                  interval={0}
                />
                <YAxis
                  tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`}
                  tick={{ fontSize: 11 }}
                  label={{
                    value: "kWh",
                    angle: -90,
                    position: "insideLeft",
                    offset: 10,
                    style: { fontSize: 11 },
                  }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatKwhRaw(value),
                    name === "zeus"
                      ? "Zeus (Postpaid)"
                      : name === "mms"
                        ? "MMS (Prepaid)"
                        : "AMR",
                  ]}
                />
                <Legend
                  formatter={(v) =>
                    v === "zeus"
                      ? "Zeus (Postpaid)"
                      : v === "mms"
                        ? "MMS (Prepaid)"
                        : "AMR (Daily)"
                  }
                />
                <Bar
                  dataKey="zeus"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  name="zeus"
                />
                <Bar
                  dataKey="mms"
                  fill="#16a34a"
                  radius={[4, 4, 0, 0]}
                  name="mms"
                />
                <Bar
                  dataKey="amr"
                  fill="#f97316"
                  radius={[4, 4, 0, 0]}
                  name="amr"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── REGION BREAKDOWN + PER-SOURCE DETAILS ── */}
      <div className="space-y-6">
        {/* ── REGION BREAKDOWN TABS ── */}
        <Tabs defaultValue="combined" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger
              value="combined"
              className="data-[state=active]:text-purple-700"
            >
              Combined
            </TabsTrigger>
            <TabsTrigger
              value="zeus"
              className="data-[state=active]:text-blue-700"
            >
              Zeus — Postpaid
            </TabsTrigger>
            <TabsTrigger
              value="mms"
              className="data-[state=active]:text-green-700"
            >
              MMS — Prepaid
            </TabsTrigger>
            <TabsTrigger
              value="amr"
              className="data-[state=active]:text-orange-700"
            >
              AMR
            </TabsTrigger>
          </TabsList>

          {/* ── COMBINED TAB ── */}
          <TabsContent value="combined" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  Region Breakdown — Combined (Zeus + MMS + AMR)
                </CardTitle>
                <CardDescription>
                  Postpaid, prepaid, and AMR consumption by region
                </CardDescription>
              </CardHeader>
              <CardContent>
                {zeusLoading || mmsLoading || amrLoading ? (
                  <Skeleton className="h-96 w-full" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                            Region
                          </th>
                          <th
                            colSpan={3}
                            className="text-center py-2 px-4 font-medium text-blue-700"
                          >
                            Zeus — Postpaid
                          </th>
                          <th
                            colSpan={3}
                            className="text-center py-2 px-4 font-medium text-green-700"
                          >
                            MMS — Prepaid
                          </th>
                          <th
                            colSpan={3}
                            className="text-center py-2 px-4 font-medium text-orange-700"
                          >
                            AMR
                          </th>
                          <th
                            colSpan={3}
                            className="text-center py-2 px-4 font-medium text-purple-700"
                          >
                            Combined Total
                          </th>
                        </tr>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4 font-medium text-xs text-muted-foreground">
                            —
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-xs text-blue-600">
                            kWh
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-xs text-blue-600">
                            Customers
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-xs text-blue-600">
                            Billing
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-xs text-green-600">
                            kWh
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-xs text-green-600">
                            Customers
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-xs text-green-600">
                            Credit
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-xs text-orange-600">
                            Import kWh
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-xs text-orange-600">
                            Export kWh
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-xs text-orange-600">
                            Meters
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-xs text-purple-600">
                            kWh
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-xs text-purple-600">
                            Customers
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-xs text-purple-600">
                            Total Value
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from(
                          new Set([
                            ...zeusItems.map((z) => z.regionname),
                            ...mmsItems.map((m) => m.region || "Unknown"),
                            ...amrByRegion.map((a) => a.region),
                          ]),
                        )
                          .sort()
                          .map((region, idx) => {
                            const zeusData = zeusItems.find(
                              (z) => z.regionname === region,
                            ) || {
                              sum_lastbillconsumption: 0,
                              customer_count: 0,
                              sum_lastbillamount: 0,
                            };
                            const mmsData = mmsItems.find(
                              (m) => m.region === region,
                            ) || {
                              sum_last_month_kwh_read: 0,
                              customer_count: 0,
                              sum_last_month_credit_read: 0,
                            };
                            const amrData = amrByRegion.find(
                              (a) => a.region === region,
                            ) || {
                              importKwh: 0,
                              exportKwh: 0,
                              meters: 0,
                            };
                            const amrKwh =
                              amrData.importKwh + amrData.exportKwh;
                            const totalKwh =
                              (zeusData.sum_lastbillconsumption || 0) +
                              (mmsData.sum_last_month_kwh_read || 0) +
                              amrKwh;
                            const totalCustomers =
                              (zeusData.customer_count || 0) +
                              (mmsData.customer_count || 0);
                            const totalValue =
                              (zeusData.sum_lastbillamount || 0) +
                              (mmsData.sum_last_month_credit_read || 0);
                            return (
                              <tr
                                key={idx}
                                className="border-b last:border-0 hover:bg-muted/40"
                              >
                                <td className="py-2.5 pr-4 font-medium">
                                  {region}
                                </td>
                                <td className="py-2.5 px-4 text-right font-semibold text-blue-700 tabular-nums text-xs">
                                  {formatKwhRaw(
                                    zeusData.sum_lastbillconsumption,
                                  )}
                                </td>
                                <td className="py-2.5 px-4 text-right text-blue-600 tabular-nums text-xs">
                                  {formatNumber(zeusData.customer_count)}
                                </td>
                                <td className="py-2.5 px-4 text-right text-blue-700 tabular-nums text-xs">
                                  {formatMoney(zeusData.sum_lastbillamount)}
                                </td>
                                <td className="py-2.5 px-4 text-right font-semibold text-green-700 tabular-nums text-xs">
                                  {formatKwhRaw(
                                    mmsData.sum_last_month_kwh_read,
                                  )}
                                </td>
                                <td className="py-2.5 px-4 text-right text-green-600 tabular-nums text-xs">
                                  {formatNumber(mmsData.customer_count)}
                                </td>
                                <td className="py-2.5 px-4 text-right text-green-700 tabular-nums text-xs">
                                  {formatMoney(
                                    mmsData.sum_last_month_credit_read,
                                  )}
                                </td>
                                <td className="py-2.5 px-4 text-right font-semibold text-orange-700 tabular-nums text-xs">
                                  {formatKwhRaw(amrData.importKwh)}
                                </td>
                                <td className="py-2.5 px-4 text-right text-orange-600 tabular-nums text-xs">
                                  {formatKwhRaw(amrData.exportKwh)}
                                </td>
                                <td className="py-2.5 px-4 text-right text-orange-600 tabular-nums text-xs">
                                  {formatNumber(amrData.meters)}
                                </td>
                                <td className="py-2.5 px-4 text-right font-bold text-purple-700 tabular-nums text-xs">
                                  {formatKwhRaw(totalKwh)}
                                </td>
                                <td className="py-2.5 px-4 text-right font-semibold text-purple-600 tabular-nums text-xs">
                                  {formatNumber(totalCustomers)}
                                </td>
                                <td className="py-2.5 px-4 text-right font-bold text-purple-700 tabular-nums text-xs">
                                  {formatMoney(totalValue)}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t bg-muted/30">
                          <td className="py-2.5 pr-4 font-semibold">Total</td>
                          <td className="py-2.5 px-4 text-right font-bold text-blue-700 tabular-nums">
                            {formatKwhRaw(zeusStats.totalKwh)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-blue-700 tabular-nums">
                            {formatNumber(zeusStats.totalCustomers)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-blue-700 tabular-nums">
                            {formatMoney(zeusStats.totalBilling)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-green-700 tabular-nums">
                            {formatKwhRaw(mmsStats.totalKwh)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-green-700 tabular-nums">
                            {formatNumber(mmsStats.totalCustomers)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-green-700 tabular-nums">
                            {formatMoney(mmsStats.totalCredit)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-orange-700 tabular-nums">
                            {formatKwhRaw(amrStats.importKwh)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-orange-700 tabular-nums">
                            {formatKwhRaw(amrStats.exportKwh)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-orange-700 tabular-nums">
                            {formatNumber(
                              amrByRegion.reduce((s, r) => s + r.meters, 0),
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-purple-700 tabular-nums">
                            {formatKwhRaw(combinedKwh)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-purple-700 tabular-nums">
                            {formatNumber(combinedCustomers)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-purple-700 tabular-nums">
                            {formatMoney(
                              zeusStats.totalBilling + mmsStats.totalCredit,
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── ZEUS TAB ── */}
          <TabsContent value="zeus" className="space-y-6 mt-6">
            {/* Zeus KPIs */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-dashed">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground font-medium">
                        Total Consumption
                      </span>
                    </div>
                    {zeusLoading ? (
                      <Skeleton className="h-5 w-28" />
                    ) : (
                      <span className="text-base font-semibold text-blue-700">
                        {formatKwhRaw(zeusStats.totalKwh)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-dashed">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground font-medium">
                        Total Billing
                      </span>
                    </div>
                    {zeusLoading ? (
                      <Skeleton className="h-5 w-28" />
                    ) : (
                      <span className="text-base font-semibold text-blue-700">
                        {formatMoney(zeusStats.totalBilling)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Zeus charts */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Consumption by Region (Zeus)</CardTitle>
                  <CardDescription>
                    Total billed kWh per region — postpaid
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {zeusLoading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart
                        data={zeusByConsumption}
                        margin={{ top: 8, right: 8, left: 8, bottom: 80 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="regionname"
                          angle={-35}
                          textAnchor="end"
                          tick={{ fontSize: 11 }}
                          interval={0}
                        />
                        <YAxis
                          tickFormatter={(v) =>
                            `${(v / 1_000_000).toFixed(0)}M`
                          }
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip
                          formatter={(v: number) => [
                            formatKwhRaw(v),
                            "Consumption",
                          ]}
                        />
                        <Bar
                          dataKey="sum_lastbillconsumption"
                          radius={[6, 6, 0, 0]}
                        >
                          {zeusByConsumption.map((_, i) => (
                            <Cell
                              key={i}
                              fill={ZEUS_COLORS[i % ZEUS_COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Customers by Region (Zeus)</CardTitle>
                  <CardDescription>
                    Number of postpaid accounts per region
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {zeusLoading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart
                        data={[...zeusItems]
                          .sort(
                            (a, b) =>
                              (b.customer_count || 0) - (a.customer_count || 0),
                          )
                          .slice(0, 12)}
                        margin={{ top: 8, right: 8, left: 8, bottom: 80 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="regionname"
                          angle={-35}
                          textAnchor="end"
                          tick={{ fontSize: 11 }}
                          interval={0}
                        />
                        <YAxis
                          tickFormatter={(v) => v.toLocaleString()}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip
                          formatter={(v: number) => [
                            formatNumber(v),
                            "Customers",
                          ]}
                        />
                        <Bar
                          dataKey="customer_count"
                          fill="#8b5cf6"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Zeus region breakdown table */}
            <Card>
              <CardHeader>
                <CardTitle>Region Breakdown — Zeus</CardTitle>
                <CardDescription>
                  Postpaid consumption and billing by region
                </CardDescription>
              </CardHeader>
              <CardContent>
                {zeusLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                            Region
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-blue-700">
                            Consumption (kWh)
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-cyan-700">
                            Avg kWh / Customer
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-muted-foreground">
                            Customers
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-muted-foreground">
                            Billing
                          </th>
                          <th className="text-right py-2 pl-4 font-medium text-muted-foreground">
                            kWh Share
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...zeusItems]
                          .sort(
                            (a, b) =>
                              (b.sum_lastbillconsumption || 0) -
                              (a.sum_lastbillconsumption || 0),
                          )
                          .map((item, idx) => {
                            const pct =
                              zeusStats.totalKwh > 0
                                ? ((item.sum_lastbillconsumption || 0) /
                                    zeusStats.totalKwh) *
                                  100
                                : 0;
                            const avgKwh =
                              item.customer_count > 0
                                ? (item.sum_lastbillconsumption || 0) /
                                  item.customer_count
                                : 0;
                            return (
                              <tr
                                key={idx}
                                className="border-b last:border-0 hover:bg-muted/40"
                              >
                                <td className="py-2.5 pr-4 font-medium">
                                  {item.regionname}
                                </td>
                                <td className="py-2.5 px-4 text-right font-semibold text-blue-700 tabular-nums">
                                  {formatKwhRaw(item.sum_lastbillconsumption)}
                                </td>
                                <td className="py-2.5 px-4 text-right text-cyan-700 tabular-nums">
                                  {formatKwhRaw(avgKwh)}
                                </td>
                                <td className="py-2.5 px-4 text-right tabular-nums">
                                  {formatNumber(item.customer_count)}
                                </td>
                                <td className="py-2.5 px-4 text-right text-green-700 tabular-nums">
                                  {formatMoney(item.sum_lastbillamount)}
                                </td>
                                <td className="py-2.5 pl-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-blue-500 rounded-full"
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-muted-foreground w-10 text-right">
                                      {pct.toFixed(1)}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t bg-muted/30">
                          <td className="py-2.5 pr-4 font-semibold">Total</td>
                          <td className="py-2.5 px-4 text-right font-bold text-blue-700 tabular-nums">
                            {formatKwhRaw(zeusStats.totalKwh)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-cyan-700 tabular-nums">
                            {formatKwh(zeusStats.avgKwh)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold tabular-nums">
                            {formatNumber(zeusStats.totalCustomers)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-green-700 tabular-nums">
                            {formatMoney(zeusStats.totalBilling)}
                          </td>
                          <td className="py-2.5 pl-4 text-right text-xs text-muted-foreground">
                            100%
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── MMS TAB ── */}
          <TabsContent value="mms" className="space-y-6 mt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-dashed">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground font-medium">
                        Total Consumption
                      </span>
                    </div>
                    {mmsLoading ? (
                      <Skeleton className="h-5 w-28" />
                    ) : (
                      <span className="text-base font-semibold text-green-700">
                        {formatKwhRaw(mmsStats.totalKwh)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-dashed">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BatteryCharging className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground font-medium">
                        Credit Purchased
                      </span>
                    </div>
                    {mmsLoading ? (
                      <Skeleton className="h-5 w-28" />
                    ) : (
                      <span className="text-base font-semibold text-green-700">
                        {formatMoney(mmsStats.totalCredit)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-dashed">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground font-medium">
                        Credit Balance
                      </span>
                    </div>
                    {mmsLoading ? (
                      <Skeleton className="h-5 w-28" />
                    ) : (
                      <span className="text-base font-semibold text-emerald-700">
                        {formatMoney(mmsStats.totalBalance)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Consumption by Region (MMS)</CardTitle>
                  <CardDescription>
                    Prepaid kWh read per region — last month
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {mmsLoading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart
                        data={mmsByConsumption}
                        margin={{ top: 8, right: 8, left: 8, bottom: 80 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="region"
                          angle={-35}
                          textAnchor="end"
                          tick={{ fontSize: 11 }}
                          interval={0}
                        />
                        <YAxis
                          tickFormatter={(v) =>
                            (v / 1_000_000).toFixed(0) + "M"
                          }
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip
                          formatter={(v: number) => [
                            formatKwhRaw(v),
                            "Consumption",
                          ]}
                        />
                        <Bar
                          dataKey="sum_last_month_kwh_read"
                          radius={[6, 6, 0, 0]}
                        >
                          {mmsByConsumption.map((_, i) => (
                            <Cell
                              key={i}
                              fill={MMS_COLORS[i % MMS_COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Customers by Region (MMS)</CardTitle>
                  <CardDescription>
                    Number of prepaid accounts per region
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {mmsLoading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart
                        data={[...mmsItems]
                          .sort(
                            (a, b) =>
                              (b.customer_count || 0) - (a.customer_count || 0),
                          )
                          .slice(0, 12)}
                        margin={{ top: 8, right: 8, left: 8, bottom: 80 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="region"
                          angle={-35}
                          textAnchor="end"
                          tick={{ fontSize: 11 }}
                          interval={0}
                        />
                        <YAxis
                          tickFormatter={(v) => v.toLocaleString()}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip
                          formatter={(v: number) => [
                            formatNumber(v),
                            "Customers",
                          ]}
                        />
                        <Bar
                          dataKey="customer_count"
                          fill="#22c55e"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Region Breakdown — MMS</CardTitle>
                <CardDescription>
                  Prepaid meter consumption and credit summary by region
                </CardDescription>
              </CardHeader>
              <CardContent>
                {mmsLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                            Region
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-green-700">
                            kWh Read (Last Month)
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-cyan-700">
                            Avg kWh / Customer
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-muted-foreground">
                            Customers
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-muted-foreground">
                            Credit Purchased
                          </th>
                          <th className="text-right py-2 pl-4 font-medium text-muted-foreground">
                            Credit Balance
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...mmsItems]
                          .sort(
                            (a, b) =>
                              (b.sum_last_month_kwh_read || 0) -
                              (a.sum_last_month_kwh_read || 0),
                          )
                          .map((item, idx) => {
                            const pct =
                              mmsStats.totalKwh > 0
                                ? ((item.sum_last_month_kwh_read || 0) /
                                    mmsStats.totalKwh) *
                                  100
                                : 0;
                            const avgKwh =
                              item.customer_count > 0
                                ? (item.sum_last_month_kwh_read || 0) /
                                  item.customer_count
                                : 0;
                            return (
                              <tr
                                key={idx}
                                className="border-b last:border-0 hover:bg-muted/40"
                              >
                                <td className="py-2.5 pr-4 font-medium">
                                  {item.region}
                                </td>
                                <td className="py-2.5 px-4 text-right font-semibold text-green-700 tabular-nums">
                                  {formatKwhRaw(item.sum_last_month_kwh_read)}
                                </td>
                                <td className="py-2.5 px-4 text-right text-cyan-700 tabular-nums">
                                  {formatKwhRaw(avgKwh)}
                                </td>
                                <td className="py-2.5 px-4 text-right tabular-nums">
                                  {formatNumber(item.customer_count)}
                                </td>
                                <td className="py-2.5 px-4 text-right text-green-700 tabular-nums">
                                  {formatMoney(item.sum_last_month_credit_read)}
                                </td>
                                <td className="py-2.5 pl-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <span className="text-emerald-700 font-medium tabular-nums">
                                      {formatMoney(
                                        item.sum_credit_balance_remaining,
                                      )}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      ({pct.toFixed(1)}%)
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t bg-muted/30">
                          <td className="py-2.5 pr-4 font-semibold">Total</td>
                          <td className="py-2.5 px-4 text-right font-bold text-green-700 tabular-nums">
                            {formatKwhRaw(mmsStats.totalKwh)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-cyan-700 tabular-nums">
                            {formatKwh(mmsStats.avgKwh)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold tabular-nums">
                            {formatNumber(mmsStats.totalCustomers)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-green-700 tabular-nums">
                            {formatMoney(mmsStats.totalCredit)}
                          </td>
                          <td className="py-2.5 pl-4 text-right font-semibold text-emerald-700 tabular-nums">
                            {formatMoney(mmsStats.totalBalance)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          {/* ── AMR TAB ── */}
          <TabsContent value="amr" className="space-y-6 mt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-dashed">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground font-medium">
                        Total Consumption
                      </span>
                    </div>
                    {amrLoading ? (
                      <Skeleton className="h-5 w-28" />
                    ) : (
                      <span className="text-base font-semibold text-orange-700">
                        {formatKwhRaw(amrStats.totalKwh)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-dashed">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground font-medium">
                        Import kWh
                      </span>
                    </div>
                    {amrLoading ? (
                      <Skeleton className="h-5 w-28" />
                    ) : (
                      <span className="text-base font-semibold text-orange-700">
                        {formatKwhRaw(amrStats.importKwh)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-dashed">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground font-medium">
                        Export kWh
                      </span>
                    </div>
                    {amrLoading ? (
                      <Skeleton className="h-5 w-28" />
                    ) : (
                      <span className="text-base font-semibold text-orange-600">
                        {formatKwhRaw(amrStats.exportKwh)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Region Breakdown — AMR</CardTitle>
                <CardDescription>
                  Daily meter import and export consumption by region
                </CardDescription>
              </CardHeader>
              <CardContent>
                {amrLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                            Region
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-orange-700">
                            Import kWh
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-orange-600">
                            Export kWh
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-muted-foreground">
                            Total kWh
                          </th>
                          <th className="text-right py-2 pl-4 font-medium text-muted-foreground">
                            Active Meters
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {amrByRegion.map((item, idx) => {
                          const total = item.importKwh + item.exportKwh;
                          const pct =
                            amrStats.totalKwh > 0
                              ? (total / amrStats.totalKwh) * 100
                              : 0;
                          return (
                            <tr
                              key={idx}
                              className="border-b last:border-0 hover:bg-muted/40"
                            >
                              <td className="py-2.5 pr-4 font-medium">
                                {item.region}
                              </td>
                              <td className="py-2.5 px-4 text-right font-semibold text-orange-700 tabular-nums">
                                {formatKwhRaw(item.importKwh)}
                              </td>
                              <td className="py-2.5 px-4 text-right text-orange-600 tabular-nums">
                                {formatKwhRaw(item.exportKwh)}
                              </td>
                              <td className="py-2.5 px-4 text-right font-semibold tabular-nums">
                                {formatKwhRaw(total)}
                              </td>
                              <td className="py-2.5 pl-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <span className="tabular-nums">
                                    {formatNumber(item.meters)}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    ({pct.toFixed(1)}%)
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t bg-muted/30">
                          <td className="py-2.5 pr-4 font-semibold">Total</td>
                          <td className="py-2.5 px-4 text-right font-bold text-orange-700 tabular-nums">
                            {formatKwhRaw(amrStats.importKwh)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-orange-600 tabular-nums">
                            {formatKwhRaw(amrStats.exportKwh)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold tabular-nums">
                            {formatKwhRaw(amrStats.totalKwh)}
                          </td>
                          <td className="py-2.5 pl-4 text-right font-semibold tabular-nums">
                            {formatNumber(
                              amrByRegion.reduce((s, r) => s + r.meters, 0),
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
