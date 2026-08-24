"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
import { Marquee, MarqueeItem } from "@/components/ui/marquee";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useZeusBillingAggregate } from "@/hooks/api/use-zeus-billing-aggregate-api";
import { useMmsCustomerSalesAggregate } from "@/hooks/api/use-mms-customer-sales-aggregate-api";
import { normalizeRegionName, shortRegionLabel } from "@/hooks/use-resolved-region-name";
import { cn } from "@/lib/utils";
import {
  Area,
  AreaChart,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
  LabelList,
} from "recharts";
import {
  AreaChartIcon,
  BarChart3,
  Zap,
  Users,
  TrendingUp,
  DollarSign,
  BatteryCharging,
  Wallet,
  ArrowRight,
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

type ChartKind = "bar" | "area";

interface RegionChartRow {
  regionname?: string;
  sum_billconsumptionvalue?: number;
  customer_count?: number;
  sum_billamount?: number;
}

/** Renders both the consumption and customer-count figures above a single bar/area point. */
function DualValueLabel(
  props: { data: RegionChartRow[] } & Record<string, unknown>,
) {
  const x = Number(props.x) || 0;
  const y = Number(props.y) || 0;
  const width = Number(props.width) || 0;
  const index = Number(props.index) || 0;
  const row = props.data[index];
  if (!row) return null;
  const cx = x + width / 2;
  return (
    <g>
      <text x={cx} y={y - 20} textAnchor="middle" className="fill-blue-700 text-[11px] font-semibold">
        {formatKwh(row.sum_billconsumptionvalue)}
      </text>
      <text x={cx} y={y - 7} textAnchor="middle" className="fill-purple-700 text-[10px] font-medium">
        {formatNumber(row.customer_count)} cust.
      </text>
    </g>
  );
}

export function CustomerSalesOverview({
  dateRange,
}: CustomerSalesOverviewProps) {
  const params = { dateFrom: dateRange.start, dateTo: dateRange.end };

  const [postpaidChartKind, setPostpaidChartKind] = useState<ChartKind>("bar");
  const [selectedPostpaidRegion, setSelectedPostpaidRegion] = useState<string | null>(null);
  const [selectedPostpaidDistrict, setSelectedPostpaidDistrict] = useState<string | null>(null);
  const [sourceMetric, setSourceMetric] = useState<"kwh" | "customers" | "billing">("kwh");

  // Zeus's own metermodeltype=AMR billing records are a subset of Zeus data,
  // not a separate source — the Postpaid tab's Zeus view below always
  // queries this combined set rather than Postpaid alone.
  const POSTPAID_METER_TYPES = "Postpaid,AMR";

  // Regional Zeus (for charts / region tables)
  const { data: zeusData, isLoading: zeusLoading } =
    useZeusBillingAggregate({
      ...params,
      groupBy: ["metermodeltype", "regionname"],
    });
  // National Zeus by meter model type — distinct customers (no region sum inflation)
  const { data: zeusNationalData, isLoading: zeusNationalLoading } =
    useZeusBillingAggregate({
      ...params,
      groupBy: ["metermodeltype"],
    });
  const { data: mmsData, isLoading: mmsLoading } = useMmsCustomerSalesAggregate(
    {
      ...params,
      groupBy: "region",
    },
  );
  // National MMS — distinct (account, meter) without summing regions
  const { data: mmsNationalData, isLoading: mmsNationalLoading } =
    useMmsCustomerSalesAggregate({
      ...params,
    });
  // District drill-down for the Postpaid/Zeus combined chart — only fetched
  // once a region is clicked.
  const { data: postpaidDistrictData, isLoading: postpaidDistrictLoading } =
    useZeusBillingAggregate({
      ...params,
      groupBy: "districtname",
      region: selectedPostpaidRegion || undefined,
      meterModelType: POSTPAID_METER_TYPES,
      enabled: Boolean(selectedPostpaidRegion),
    });

  // Service class drill-down — only fetched once a district is clicked.
  const { data: postpaidServiceClassData, isLoading: postpaidServiceClassLoading } =
    useZeusBillingAggregate({
      ...params,
      groupBy: "serviceclass",
      region: selectedPostpaidRegion || undefined,
      district: selectedPostpaidDistrict || undefined,
      meterModelType: POSTPAID_METER_TYPES,
      enabled: Boolean(selectedPostpaidDistrict),
    });

  const zeusRaw = zeusData || [];
  const zeusNationalRaw = zeusNationalData || [];
  const mmsItems = mmsData || [];
  const mmsNationalItems = mmsNationalData || [];

  const normalizeZeusType = (raw?: string | null) => {
    const t = (raw || "").trim().toLowerCase();
    if (t === "postpaid") return "Postpaid" as const;
    if (t === "prepaid") return "Prepaid" as const;
    if (t === "amr") return "AMR" as const;
    return "Other" as const;
  };

  // Zeus Postpaid / Prepaid partitions
  const zeusItems = useMemo(
    () => zeusRaw.filter((i) => normalizeZeusType(i.metermodeltype) === "Postpaid"),
    [zeusRaw],
  );

  const zeusPrepaidItems = useMemo(
    () => zeusRaw.filter((i) => normalizeZeusType(i.metermodeltype) === "Prepaid"),
    [zeusRaw],
  );

  // Zeus billing accounts tagged meterModelType=AMR — a distinct lineage from
  // the daily AMR meter readings (same "AMR" label, different pipeline),
  // grouped here the same way zeusItems is for Postpaid.
  const zeusAmrItems = useMemo(
    () => zeusRaw.filter((i) => normalizeZeusType(i.metermodeltype) === "AMR"),
    [zeusRaw],
  );

  // The Postpaid tab's own region-level view — Zeus Postpaid + Zeus AMR
  // merged into one row per region, since AMR is just another metermodeltype
  // value within Zeus data, not a separate source.
  const postpaidRegionItems = useMemo(() => {
    const map = new Map<
      string,
      { regionname: string; sum_billconsumptionvalue: number; customer_count: number; sum_billamount: number }
    >();
    const ensure = (r: string) => {
      if (!map.has(r)) {
        map.set(r, { regionname: r, sum_billconsumptionvalue: 0, customer_count: 0, sum_billamount: 0 });
      }
      return map.get(r)!;
    };
    ;[...zeusItems, ...zeusAmrItems].forEach((i) => {
      const row = ensure(i.regionname || "Unknown");
      row.sum_billconsumptionvalue += i.sum_billconsumptionvalue || 0;
      row.customer_count += i.customer_count || 0;
      row.sum_billamount += i.sum_billamount || 0;
    });
    return [...map.values()];
  }, [zeusItems, zeusAmrItems]);

  const postpaidByConsumption = useMemo(
    () =>
      [...postpaidRegionItems]
        .sort((a, b) => b.sum_billconsumptionvalue - a.sum_billconsumptionvalue)
        .slice(0, 12),
    [postpaidRegionItems],
  );

  const zeusByServiceType = useMemo(() => {
    const totals = {
      Postpaid: { totalKwh: 0, totalCustomers: 0, totalBilling: 0, totalBalance: 0 },
      Prepaid: { totalKwh: 0, totalCustomers: 0, totalBilling: 0, totalBalance: 0 },
      AMR: { totalKwh: 0, totalCustomers: 0, totalBilling: 0, totalBalance: 0 },
    };
    // kWh / billing / balance: sum regional rows (additive)
    zeusRaw.forEach((i) => {
      const key = normalizeZeusType(i.metermodeltype);
      if (key === "Other") return;
      totals[key].totalKwh += i.sum_billconsumptionvalue || 0;
      totals[key].totalBilling += i.sum_billamount || 0;
      totals[key].totalBalance += i.sum_debtamount || 0;
    });
    // customers: national distinct (account, service point) — do not sum regions
    zeusNationalRaw.forEach((i) => {
      const key = normalizeZeusType(i.metermodeltype);
      if (key === "Other") return;
      totals[key].totalCustomers += i.customer_count || 0;
    });
    return totals;
  }, [zeusRaw, zeusNationalRaw]);

  const postpaidTabStats = useMemo(() => {
    const totalKwh = postpaidRegionItems.reduce((s, r) => s + r.sum_billconsumptionvalue, 0);
    const totalBilling = postpaidRegionItems.reduce((s, r) => s + r.sum_billamount, 0);
    const totalCustomers =
      zeusByServiceType.Postpaid.totalCustomers + zeusByServiceType.AMR.totalCustomers;
    return {
      totalKwh,
      totalBilling,
      totalCustomers,
      avgKwh: totalCustomers > 0 ? totalKwh / totalCustomers : 0,
    };
  }, [postpaidRegionItems, zeusByServiceType]);

  // ── MMS stats ──
  const mmsStats = useMemo(() => {
    if (!mmsItems.length && !mmsNationalItems.length)
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
    const totalCredit = mmsItems.reduce(
      (s, i) => s + (i.sum_last_month_credit_read || 0),
      0,
    );
    const totalBalance = mmsItems.reduce(
      (s, i) => s + (i.sum_credit_balance_remaining || 0),
      0,
    );
    const totalCustomers = mmsNationalItems.reduce(
      (s, i) => s + (i.customer_count || 0),
      0,
    );
    return {
      totalKwh,
      totalCustomers,
      totalCredit,
      totalBalance,
      avgKwh: totalCustomers > 0 ? totalKwh / totalCustomers : 0,
    };
  }, [mmsItems, mmsNationalItems]);

  // ── Data source breakdown (Zeus vs MMS) — the two underlying systems
  // this page's data is sourced from, independent of Postpaid/Prepaid
  // classification. Zeus here is Postpaid + Prepaid + AMR combined, since
  // all three metermodeltype values come from the same Zeus billing feed.
  const sourceBreakdown = useMemo(() => {
    const zeusKwh =
      zeusByServiceType.Postpaid.totalKwh +
      zeusByServiceType.Prepaid.totalKwh +
      zeusByServiceType.AMR.totalKwh;
    const zeusCustomers =
      zeusByServiceType.Postpaid.totalCustomers +
      zeusByServiceType.Prepaid.totalCustomers +
      zeusByServiceType.AMR.totalCustomers;
    const zeusBilling =
      zeusByServiceType.Postpaid.totalBilling +
      zeusByServiceType.Prepaid.totalBilling +
      zeusByServiceType.AMR.totalBilling;
    return {
      kwh: { zeus: zeusKwh, mms: mmsStats.totalKwh },
      customers: { zeus: zeusCustomers, mms: mmsStats.totalCustomers },
      billing: { zeus: zeusBilling, mms: mmsStats.totalCredit },
    };
  }, [zeusByServiceType, mmsStats]);

  // ── Category buckets (Customer Consumption IA) ──
  // Postpaid = Zeus Postpaid + Zeus AMR; Prepaid = Zeus Prepaid + MMS
  const postpaidKwh =
    zeusByServiceType.Postpaid.totalKwh + zeusByServiceType.AMR.totalKwh;
  const prepaidKwh =
    zeusByServiceType.Prepaid.totalKwh + mmsStats.totalKwh;
  const combinedKwh = postpaidKwh + prepaidKwh;
  const combinedCustomers =
    zeusByServiceType.Postpaid.totalCustomers +
    zeusByServiceType.AMR.totalCustomers +
    zeusByServiceType.Prepaid.totalCustomers +
    mmsStats.totalCustomers;
  const postpaidCustomers =
    zeusByServiceType.Postpaid.totalCustomers +
    zeusByServiceType.AMR.totalCustomers;
  const prepaidCustomers =
    zeusByServiceType.Prepaid.totalCustomers + mmsStats.totalCustomers;

  // Keep zeusStats as Postpaid for legacy chart sections that expect it
  const zeusStats = {
    ...zeusByServiceType.Postpaid,
    avgKwh:
      zeusByServiceType.Postpaid.totalCustomers > 0
        ? zeusByServiceType.Postpaid.totalKwh /
          zeusByServiceType.Postpaid.totalCustomers
        : 0,
  };

  // ── Chart data ──

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

  // ── Combined chart: Postpaid vs Prepaid kWh by region ──
  // Keyed on normalizeRegionName (not the raw string) for the same reason
  // as the Combined table below: Zeus/AMR and MMS spell region names
  // differently (e.g. "Accra East Region" vs "Accra East"), and an exact
  // match would split one real region into two bars/marquee entries.
  // Displayed via shortRegionLabel — always the suffix-free short form.
  const combinedChartData = useMemo(() => {
    const regionMap = new Map<
      string,
      { region: string; postpaid: number; prepaid: number }
    >();
    const ensure = (raw: string) => {
      const key = normalizeRegionName(raw);
      if (!regionMap.has(key)) {
        regionMap.set(key, { region: shortRegionLabel(raw), postpaid: 0, prepaid: 0 });
      }
      return regionMap.get(key)!;
    };
    zeusItems.forEach((i) => {
      ensure(i.regionname || "Unknown").postpaid +=
        i.sum_billconsumptionvalue || 0;
    });
    zeusAmrItems.forEach((i) => {
      ensure(i.regionname || "Unknown").postpaid +=
        i.sum_billconsumptionvalue || 0;
    });
    zeusPrepaidItems.forEach((i) => {
      ensure(i.regionname || "Unknown").prepaid +=
        i.sum_billconsumptionvalue || 0;
    });
    mmsItems.forEach((i) => {
      ensure(i.region || "Unknown").prepaid += i.sum_last_month_kwh_read || 0;
    });
    return [...regionMap.values()].sort(
      (a, b) => b.postpaid + b.prepaid - (a.postpaid + a.prepaid),
    );
  }, [zeusItems, zeusAmrItems, zeusPrepaidItems, mmsItems]);

  const isLoading =
    zeusLoading || zeusNationalLoading || mmsLoading || mmsNationalLoading;

  return (
    <div className="space-y-6">
      {/* ── PER-REGION SALES MARQUEE ── */}
      <div className="flex items-center gap-2.5 rounded-lg border border-border/80 bg-card px-3 py-2 shadow-sm">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Customer sales
        </span>
        <Marquee speed="slow" gap="medium" className="bg-transparent border-0 flex-1">
          {isLoading ? (
            <MarqueeItem className="text-sm font-medium text-muted-foreground">
              Loading customer sales figures…
            </MarqueeItem>
          ) : combinedChartData.length === 0 ? (
            <MarqueeItem className="text-sm font-medium text-muted-foreground">
              No customer sales data for this period.
            </MarqueeItem>
          ) : (
            combinedChartData.map(({ region, postpaid, prepaid }) => (
              <MarqueeItem
                key={region}
                className="text-sm font-medium text-foreground flex items-center gap-2"
              >
                <span className="font-semibold text-foreground">{region}:</span>
                <span className="text-blue-700 dark:text-blue-400">
                  Postpaid {formatKwh(postpaid)}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-emerald-700 dark:text-emerald-400">
                  Prepaid {formatKwh(prepaid)}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="font-semibold text-purple-700 dark:text-purple-400">
                  Total {formatKwh(postpaid + prepaid)}
                </span>
              </MarqueeItem>
            ))
          )}
        </Marquee>
      </div>

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
                  Postpaid + Prepaid
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
                    className="text-[10px] gap-1 border-blue-400 text-blue-800 font-medium"
                  >
                    Postpaid {formatKwh(postpaidKwh)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] gap-1 border-emerald-400 text-emerald-800 font-medium"
                  >
                    Prepaid {formatKwh(prepaidKwh)}
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
                    Postpaid: {formatNumber(postpaidCustomers)}
                  </span>
                  <span className="text-[10px] text-emerald-600">
                    Prepaid: {formatNumber(prepaidCustomers)}
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
                  Across Postpaid + Prepaid customers
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── DATA SOURCE BREAKDOWN ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>Data Sources</CardTitle>
              <CardDescription>
                Where this page&apos;s figures come from — Zeus (billing, all
                meter types) vs MMS (prepaid vending)
              </CardDescription>
            </div>
            <ToggleGroup
              type="single"
              value={sourceMetric}
              onValueChange={(v) => {
                if (v) setSourceMetric(v as typeof sourceMetric);
              }}
              variant="outline"
            >
              <ToggleGroupItem value="kwh">kWh</ToggleGroupItem>
              <ToggleGroupItem value="customers">Customers</ToggleGroupItem>
              <ToggleGroupItem value="billing">Billing</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            (() => {
              const active = sourceBreakdown[sourceMetric];
              const total = active.zeus + active.mms;
              const zeusPct = total > 0 ? (active.zeus / total) * 100 : 0;
              const mmsPct = total > 0 ? (active.mms / total) * 100 : 0;
              const format =
                sourceMetric === "kwh"
                  ? formatKwh
                  : sourceMetric === "billing"
                    ? formatMoney
                    : formatNumber;
              return (
                <>
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="bg-blue-600"
                      style={{ width: `${zeusPct}%` }}
                    />
                    <div
                      className="bg-green-600"
                      style={{ width: `${mmsPct}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-blue-600 shrink-0" />
                        <span className="text-sm font-medium">Zeus</span>
                        <span className="text-xs text-muted-foreground">
                          {zeusPct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-xl font-bold text-blue-700 mt-0.5">
                        {format(active.zeus)}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-green-600 shrink-0" />
                        <span className="text-sm font-medium">MMS</span>
                        <span className="text-xs text-muted-foreground">
                          {mmsPct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-xl font-bold text-green-700 mt-0.5">
                        {format(active.mms)}
                      </div>
                    </div>
                  </div>
                </>
              );
            })()
          )}
        </CardContent>
      </Card>

      {/* ── COMBINED COMPARISON CHART ── */}
      <Card>
        <CardHeader>
          <CardTitle>Consumption by Region — Postpaid vs Prepaid</CardTitle>
          <CardDescription>
            Postpaid (Zeus + AMR) and Prepaid (Zeus + MMS) kWh per region
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
                    name === "postpaid"
                      ? "Postpaid (Zeus + AMR)"
                      : "Prepaid (Zeus + MMS)",
                  ]}
                />
                <Legend
                  formatter={(v) =>
                    v === "postpaid"
                      ? "Postpaid (Zeus + AMR)"
                      : "Prepaid (Zeus + MMS)"
                  }
                />
                <Bar
                  dataKey="postpaid"
                  fill="#2563eb"
                  radius={[4, 4, 0, 0]}
                  name="postpaid"
                />
                <Bar
                  dataKey="prepaid"
                  fill="#059669"
                  radius={[4, 4, 0, 0]}
                  name="prepaid"
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
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger
              value="combined"
              className="data-[state=active]:text-purple-700"
            >
              Combined
            </TabsTrigger>
            <TabsTrigger
              value="postpaid"
              className="data-[state=active]:text-blue-700"
            >
              Postpaid
            </TabsTrigger>
            <TabsTrigger
              value="prepaid"
              className="data-[state=active]:text-emerald-700"
            >
              Prepaid
            </TabsTrigger>
          </TabsList>

          {/* ── COMBINED TAB ── */}
          <TabsContent value="combined" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  Region Breakdown — Combined (Postpaid + Prepaid)
                </CardTitle>
                <CardDescription>
                  Postpaid (Zeus + AMR) and Prepaid (Zeus + MMS) by region
                </CardDescription>
              </CardHeader>
              <CardContent>
                {zeusLoading || mmsLoading ? (
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
                            AMR (Postpaid)
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
                            kWh
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-xs text-orange-600">
                            Customers
                          </th>
                          <th className="text-right py-2 px-4 font-medium text-xs text-orange-600">
                            Billing
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
                        {(() => {
                          // Zeus/AMR and MMS each maintain their own
                          // independent region-name column, which don't
                          // always agree exactly (typically just a
                          // trailing "Region" — e.g. "Accra East" vs
                          // "Accra East Region"). Keying rows on the raw
                          // string split what's really one region into two
                          // separate rows, one per naming convention, each
                          // showing only that source's numbers. Group by
                          // the normalized name instead (same
                          // strip-trailing-"Region" rule as
                          // useResolvedRegionName) so all three sources
                          // land in one row per real region, displayed via
                          // shortRegionLabel (always the suffix-free short
                          // form) regardless of which source's naming
                          // convention happened to include it.
                          const labelByKey = new Map<string, string>();
                          [
                            ...zeusItems.map((z) => z.regionname),
                            ...zeusAmrItems.map((a) => a.regionname),
                            ...mmsItems.map((m) => m.region || "Unknown"),
                          ].forEach((raw) => {
                            const key = normalizeRegionName(raw);
                            if (!labelByKey.has(key)) labelByKey.set(key, shortRegionLabel(raw));
                          });

                          return Array.from(labelByKey.keys())
                            .sort((a, b) =>
                              (labelByKey.get(a) || "").localeCompare(
                                labelByKey.get(b) || "",
                              ),
                            )
                            .map((key, idx) => {
                              const region = labelByKey.get(key) as string;
                              const zeusData = zeusItems.find(
                                (z) => normalizeRegionName(z.regionname) === key,
                              ) || {
                                sum_billconsumptionvalue: 0,
                                customer_count: 0,
                                sum_billamount: 0,
                              };
                              const mmsData = mmsItems.find(
                                (m) =>
                                  normalizeRegionName(m.region || "Unknown") ===
                                  key,
                              ) || {
                                sum_last_month_kwh_read: 0,
                                customer_count: 0,
                                sum_last_month_credit_read: 0,
                              };
                              const amrData = zeusAmrItems.find(
                                (a) => normalizeRegionName(a.regionname) === key,
                              ) || {
                                sum_billconsumptionvalue: 0,
                                customer_count: 0,
                                sum_billamount: 0,
                              };
                            const totalKwh =
                              (zeusData.sum_billconsumptionvalue || 0) +
                              (mmsData.sum_last_month_kwh_read || 0) +
                              (amrData.sum_billconsumptionvalue || 0);
                            const totalCustomers =
                              (zeusData.customer_count || 0) +
                              (mmsData.customer_count || 0) +
                              (amrData.customer_count || 0);
                            const totalValue =
                              (zeusData.sum_billamount || 0) +
                              (mmsData.sum_last_month_credit_read || 0) +
                              (amrData.sum_billamount || 0);
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
                                    zeusData.sum_billconsumptionvalue,
                                  )}
                                </td>
                                <td className="py-2.5 px-4 text-right text-blue-600 tabular-nums text-xs">
                                  {formatNumber(zeusData.customer_count)}
                                </td>
                                <td className="py-2.5 px-4 text-right text-blue-700 tabular-nums text-xs">
                                  {formatMoney(zeusData.sum_billamount)}
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
                                  {formatKwhRaw(
                                    amrData.sum_billconsumptionvalue,
                                  )}
                                </td>
                                <td className="py-2.5 px-4 text-right text-orange-600 tabular-nums text-xs">
                                  {formatNumber(amrData.customer_count)}
                                </td>
                                <td className="py-2.5 px-4 text-right text-orange-700 tabular-nums text-xs">
                                  {formatMoney(amrData.sum_billamount)}
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
                            });
                        })()}
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
                            {formatKwhRaw(zeusByServiceType.AMR.totalKwh)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-orange-700 tabular-nums">
                            {formatNumber(
                              zeusByServiceType.AMR.totalCustomers,
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-orange-700 tabular-nums">
                            {formatMoney(zeusByServiceType.AMR.totalBilling)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-purple-700 tabular-nums">
                            {formatKwhRaw(combinedKwh)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-purple-700 tabular-nums">
                            {formatNumber(combinedCustomers)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-purple-700 tabular-nums">
                            {formatMoney(
                              zeusStats.totalBilling +
                                mmsStats.totalCredit +
                                zeusByServiceType.AMR.totalBilling,
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

          {/* ── POSTPAID TAB (Zeus: Postpaid + AMR, AMR is just another
              metermodeltype value within Zeus data, not a separate source) ── */}
          <TabsContent value="postpaid" className="space-y-6 mt-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-medium">Postpaid</p>
                <p className="text-xs text-muted-foreground">
                  Zeus billing — postpaid + AMR-tagged accounts
                </p>
              </div>
              <Link
                href="/customer-sales/postpaid"
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xs font-medium text-white"
              >
                Open Postpaid hub
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

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
                        {formatKwhRaw(postpaidTabStats.totalKwh)}
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
                        {formatMoney(postpaidTabStats.totalBilling)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Zeus chart — consumption & customers together, click a
                region to drill down into its districts, then a district to
                drill further into service class. */}
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle>Consumption &amp; customers by region (Zeus)</CardTitle>
                  <CardDescription>
                    Billed kWh and accounts per region — click a region (bar chart or table row below) to drill into districts, then a district into service class
                  </CardDescription>
                </div>
                <ToggleGroup
                  type="single"
                  value={postpaidChartKind}
                  onValueChange={(v) => {
                    if (v) setPostpaidChartKind(v as ChartKind);
                  }}
                  variant="outline"
                >
                  <ToggleGroupItem value="bar" aria-label="Bar chart">
                    <BarChart3 className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="area" aria-label="Area chart">
                    <AreaChartIcon className="h-4 w-4" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </CardHeader>
              <CardContent>
                {zeusLoading ? (
                  <Skeleton className="h-[320px] w-full" />
                ) : postpaidByConsumption.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">
                    No Zeus aggregate data for this period.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    {postpaidChartKind === "bar" ? (
                      <BarChart
                        data={postpaidByConsumption}
                        margin={{ top: 40, right: 8, left: 8, bottom: 80 }}
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
                          tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip
                          formatter={(v: number, name: string) =>
                            name === "customer_count"
                              ? [formatNumber(v), "Customers"]
                              : [formatKwhRaw(v), "Consumption"]
                          }
                        />
                        <Bar
                          dataKey="sum_billconsumptionvalue"
                          radius={[6, 6, 0, 0]}
                          cursor="pointer"
                          isAnimationActive={false}
                          onClick={(data: { regionname?: string }) => {
                            if (data?.regionname) {
                              setSelectedPostpaidRegion((prev) =>
                                prev === data.regionname ? null : data.regionname!,
                              );
                              setSelectedPostpaidDistrict(null);
                            }
                          }}
                        >
                          <LabelList
                            dataKey="sum_billconsumptionvalue"
                            content={(props) => <DualValueLabel {...props} data={postpaidByConsumption} />}
                          />
                          {postpaidByConsumption.map((row, i) => (
                            <Cell
                              key={row.regionname}
                              fill={
                                selectedPostpaidRegion === row.regionname
                                  ? "#1e3a8a"
                                  : ZEUS_COLORS[i % ZEUS_COLORS.length]
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    ) : (
                      <AreaChart
                        data={postpaidByConsumption}
                        margin={{ top: 40, right: 8, left: 8, bottom: 80 }}
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
                          tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip
                          formatter={(v: number, name: string) =>
                            name === "customer_count"
                              ? [formatNumber(v), "Customers"]
                              : [formatKwhRaw(v), "Consumption"]
                          }
                        />
                        <Area
                          type="monotone"
                          dataKey="sum_billconsumptionvalue"
                          stroke="#1d4ed8"
                          fill="#1d4ed8"
                          fillOpacity={0.25}
                          strokeWidth={2}
                          isAnimationActive={false}
                          dot={{ r: 4, fill: "#1d4ed8" }}
                        >
                          <LabelList
                            dataKey="sum_billconsumptionvalue"
                            content={(props) => <DualValueLabel {...props} data={postpaidByConsumption} />}
                          />
                        </Area>
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {selectedPostpaidRegion && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <div>
                    <CardTitle>District breakdown — {selectedPostpaidRegion}</CardTitle>
                    <CardDescription>
                      Consumption and billing by district — click a district to drill into service class
                    </CardDescription>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPostpaidRegion(null);
                      setSelectedPostpaidDistrict(null);
                    }}
                    className="text-xs text-blue-700 hover:underline"
                  >
                    Clear
                  </button>
                </CardHeader>
                <CardContent>
                  {postpaidDistrictLoading ? (
                    <Skeleton className="h-48 w-full" />
                  ) : !postpaidDistrictData || postpaidDistrictData.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      No district data for {selectedPostpaidRegion}.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                              District
                            </th>
                            <th className="text-right py-2 px-4 font-medium text-blue-700">
                              Consumption (kWh)
                            </th>
                            <th className="text-right py-2 px-4 font-medium text-muted-foreground">
                              Customers
                            </th>
                            <th className="text-right py-2 pl-4 font-medium text-muted-foreground">
                              Billing
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...postpaidDistrictData]
                            .sort(
                              (a, b) =>
                                (b.sum_billconsumptionvalue || 0) -
                                (a.sum_billconsumptionvalue || 0),
                            )
                            .map((item) => {
                              const isSelectedDistrict =
                                selectedPostpaidDistrict === item.districtname;
                              return (
                                <tr
                                  key={item.districtname || "unknown"}
                                  onClick={() => {
                                    if (item.districtname) {
                                      setSelectedPostpaidDistrict((prev) =>
                                        prev === item.districtname ? null : item.districtname!,
                                      );
                                    }
                                  }}
                                  className={cn(
                                    "border-b last:border-0 hover:bg-muted/40 cursor-pointer",
                                    isSelectedDistrict && "bg-blue-50",
                                  )}
                                >
                                  <td className="py-2.5 pr-4 font-medium">
                                    {item.districtname || "—"}
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-semibold text-blue-700 tabular-nums">
                                    {formatKwhRaw(item.sum_billconsumptionvalue)}
                                  </td>
                                  <td className="py-2.5 px-4 text-right tabular-nums">
                                    {formatNumber(item.customer_count)}
                                  </td>
                                  <td className="py-2.5 pl-4 text-right text-green-700 tabular-nums">
                                    {formatMoney(item.sum_billamount)}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {selectedPostpaidDistrict && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <div>
                    <CardTitle>Service class breakdown — {selectedPostpaidDistrict}</CardTitle>
                    <CardDescription>
                      Consumption and billing by service class
                    </CardDescription>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPostpaidDistrict(null)}
                    className="text-xs text-blue-700 hover:underline"
                  >
                    Clear
                  </button>
                </CardHeader>
                <CardContent>
                  {postpaidServiceClassLoading ? (
                    <Skeleton className="h-48 w-full" />
                  ) : !postpaidServiceClassData || postpaidServiceClassData.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      No service class data for {selectedPostpaidDistrict}.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                              Service class
                            </th>
                            <th className="text-right py-2 px-4 font-medium text-blue-700">
                              Consumption (kWh)
                            </th>
                            <th className="text-right py-2 px-4 font-medium text-muted-foreground">
                              Customers
                            </th>
                            <th className="text-right py-2 pl-4 font-medium text-muted-foreground">
                              Billing
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...postpaidServiceClassData]
                            .sort(
                              (a, b) =>
                                (b.sum_billconsumptionvalue || 0) -
                                (a.sum_billconsumptionvalue || 0),
                            )
                            .map((item, idx) => (
                              <tr
                                key={idx}
                                className="border-b last:border-0 hover:bg-muted/40"
                              >
                                <td className="py-2.5 pr-4 font-medium">
                                  {item.serviceclass || "—"}
                                </td>
                                <td className="py-2.5 px-4 text-right font-semibold text-blue-700 tabular-nums">
                                  {formatKwhRaw(item.sum_billconsumptionvalue)}
                                </td>
                                <td className="py-2.5 px-4 text-right tabular-nums">
                                  {formatNumber(item.customer_count)}
                                </td>
                                <td className="py-2.5 pl-4 text-right text-green-700 tabular-nums">
                                  {formatMoney(item.sum_billamount)}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Zeus region breakdown table */}
            <Card>
              <CardHeader>
                <CardTitle>Region Breakdown — Zeus</CardTitle>
                <CardDescription>
                  Postpaid + AMR consumption and billing by region
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
                        {[...postpaidRegionItems]
                          .sort(
                            (a, b) =>
                              b.sum_billconsumptionvalue - a.sum_billconsumptionvalue,
                          )
                          .map((item, idx) => {
                            const pct =
                              postpaidTabStats.totalKwh > 0
                                ? (item.sum_billconsumptionvalue /
                                    postpaidTabStats.totalKwh) *
                                  100
                                : 0;
                            const avgKwh =
                              item.customer_count > 0
                                ? item.sum_billconsumptionvalue / item.customer_count
                                : 0;
                            const isSelected = selectedPostpaidRegion === item.regionname;
                            return (
                              <tr
                                key={idx}
                                onClick={() => {
                                  if (item.regionname) {
                                    setSelectedPostpaidRegion((prev) =>
                                      prev === item.regionname ? null : item.regionname!,
                                    );
                                    setSelectedPostpaidDistrict(null);
                                  }
                                }}
                                className={cn(
                                  "border-b last:border-0 hover:bg-muted/40 cursor-pointer",
                                  isSelected && "bg-blue-50",
                                )}
                              >
                                <td className="py-2.5 pr-4 font-medium">
                                  {item.regionname}
                                </td>
                                <td className="py-2.5 px-4 text-right font-semibold text-blue-700 tabular-nums">
                                  {formatKwhRaw(item.sum_billconsumptionvalue)}
                                </td>
                                <td className="py-2.5 px-4 text-right text-cyan-700 tabular-nums">
                                  {formatKwhRaw(avgKwh)}
                                </td>
                                <td className="py-2.5 px-4 text-right tabular-nums">
                                  {formatNumber(item.customer_count)}
                                </td>
                                <td className="py-2.5 px-4 text-right text-green-700 tabular-nums">
                                  {formatMoney(item.sum_billamount)}
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
                            {formatKwhRaw(postpaidTabStats.totalKwh)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-cyan-700 tabular-nums">
                            {formatKwh(postpaidTabStats.avgKwh)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold tabular-nums">
                            {formatNumber(postpaidTabStats.totalCustomers)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-green-700 tabular-nums">
                            {formatMoney(postpaidTabStats.totalBilling)}
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

          {/* ── PREPAID TAB (MMS + Zeus Prepaid) ── */}
          <TabsContent value="prepaid" className="space-y-6 mt-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-medium">Prepaid</p>
                <p className="text-xs text-muted-foreground">
                  Zeus prepaid accounts + MMS prepaid meters
                </p>
              </div>
              <Link
                href="/customer-sales/prepaid"
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white"
              >
                Open Prepaid hub
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-dashed border-emerald-200">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground font-medium">
                      Zeus Prepaid kWh
                    </span>
                    {zeusLoading ? (
                      <Skeleton className="h-5 w-28" />
                    ) : (
                      <span className="text-base font-semibold text-emerald-700">
                        {formatKwhRaw(zeusByServiceType.Prepaid.totalKwh)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-dashed border-green-200">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground font-medium">
                      MMS Prepaid kWh
                    </span>
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
            </div>
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
        </Tabs>
      </div>
    </div>
  );
}
