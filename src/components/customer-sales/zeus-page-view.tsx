"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AreaChartIcon,
  ArrowUpRight,
  BarChart3,
  DollarSign,
  Scale,
  Users,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useZeusBillingAggregate } from "@/hooks/api/use-zeus-billing-aggregate-api";
import { CustomerSalesDetail } from "@/components/customer-sales/customer-sales-detail";
import { cn } from "@/lib/utils";

interface DateRange {
  start: string;
  end: string;
}

interface ZeusPageViewProps {
  dateRange: DateRange;
  region?: string;
  district?: string;
  /** Lock aggregates + detail to this Zeus meter model type (hides type tabs). */
  serviceType?: "Postpaid" | "Prepaid";
  /** When true, omit the page-level Zeus heading (hub provides context). */
  embedded?: boolean;
}

type ZeusServiceType = "Postpaid" | "Prepaid" | "AMR";

const ZEUS_SERVICE_TYPES: ZeusServiceType[] = ["Postpaid", "Prepaid", "AMR"];

const ZEUS_SERVICE_META: Record<
  ZeusServiceType,
  { label: string; blurb: string; accent: string }
> = {
  Postpaid: {
    label: "Postpaid",
    blurb: "Postpaid billed consumption, billing and balance",
    accent: "text-blue-700",
  },
  Prepaid: {
    label: "Prepaid",
    blurb: "Zeus prepaid accounts — billed consumption and balance",
    accent: "text-emerald-700",
  },
  AMR: {
    label: "AMR",
    blurb: "Zeus AMR accounts — billed consumption and balance",
    accent: "text-orange-700",
  },
};

const ZEUS_COLORS = [
  "#1d4ed8",
  "#2563eb",
  "#3b82f6",
  "#60a5fa",
  "#93c5fd",
  "#1e40af",
  "#1e3a8a",
  "#bfdbfe",
];

function formatKwhRaw(value: number | null | undefined) {
  if (value === null || value === undefined) return "0 kWh";
  return `${(value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} kWh`;
}

function formatKwh(value: number | null | undefined) {
  if (value === null || value === undefined) return "0";
  if (Math.abs(value) >= 1_000_000)
    return `${(value / 1_000_000).toFixed(2)}M kWh`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k kWh`;
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 0 })} kWh`;
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "0";
  return (value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "₵0.00";
  return `₵${(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type ChartKind = "bar" | "area";

interface RegionChartRow {
  regionname: string;
  sum_billconsumptionvalue: number;
  customer_count: number;
  sum_billamount: number;
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

export function ZeusPageView({
  dateRange,
  region,
  district,
  serviceType: lockedServiceType,
  embedded = false,
}: ZeusPageViewProps) {
  const [unlockedServiceType, setUnlockedServiceType] =
    useState<ZeusServiceType>("Postpaid");
  const serviceType: ZeusServiceType = lockedServiceType ?? unlockedServiceType;
  const isLocked = Boolean(lockedServiceType);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [chartKind, setChartKind] = useState<ChartKind>("bar");
  const effectiveRegion = selectedRegion || region;
  const serviceMeta = ZEUS_SERVICE_META[serviceType];

  const { data: regionAgg = [], isLoading: regionLoading } =
    useZeusBillingAggregate({
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
      groupBy: "regionname",
      region,
      district,
      meterModelType: serviceType,
    });

  const { data: districtAgg = [], isLoading: districtLoading } =
    useZeusBillingAggregate({
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
      groupBy: "districtname",
      region: effectiveRegion,
      district,
      meterModelType: serviceType,
      enabled: Boolean(effectiveRegion),
    });

  const { data: accountTypeAgg = [], isLoading: accountLoading } =
    useZeusBillingAggregate({
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
      groupBy: "accounttype",
      region: effectiveRegion,
      district,
      meterModelType: serviceType,
    });

  const stats = useMemo(() => {
    const totalKwh = regionAgg.reduce(
      (s, r) => s + (r.sum_billconsumptionvalue || 0),
      0,
    );
    const totalCustomers = regionAgg.reduce(
      (s, r) => s + (r.customer_count || 0),
      0,
    );
    const totalBilling = regionAgg.reduce(
      (s, r) => s + (r.sum_billamount || 0),
      0,
    );
    const totalDebt = regionAgg.reduce(
      (s, r) => s + (r.sum_debtamount || 0),
      0,
    );
    const totalDue = regionAgg.reduce(
      (s, r) => s + (r.sum_amountdue || 0),
      0,
    );
    const totalOutstanding = regionAgg.reduce(
      (s, r) => s + (r.sum_outstandingamount || 0),
      0,
    );
    return {
      totalKwh,
      totalCustomers,
      totalBilling,
      totalDebt,
      totalDue,
      totalOutstanding,
      avgKwh: totalCustomers > 0 ? totalKwh / totalCustomers : 0,
    };
  }, [regionAgg]);

  const byConsumption = useMemo(
    () =>
      [...regionAgg]
        .sort(
          (a, b) =>
            (b.sum_billconsumptionvalue || 0) -
            (a.sum_billconsumptionvalue || 0),
        )
        .slice(0, 12)
        .map((r) => ({
          regionname: r.regionname || "Unknown",
          sum_billconsumptionvalue: r.sum_billconsumptionvalue || 0,
          customer_count: r.customer_count || 0,
          sum_billamount: r.sum_billamount || 0,
        })),
    [regionAgg],
  );

  const selectRegion = (value: string | null) => {
    setSelectedRegion((prev) => (prev === value ? null : value));
  };

  const onServiceTypeChange = (value: string) => {
    if (isLocked) return;
    setUnlockedServiceType(value as ZeusServiceType);
    setSelectedRegion(null);
  };

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            Zeus{isLocked ? ` — ${serviceMeta.label}` : ""}
          </h2>
          <p className="text-muted-foreground mt-1">
            {serviceMeta.blurb}
            {selectedRegion ? (
              <span className={serviceMeta.accent}>
                {" "}
                · filtered by {selectedRegion}
              </span>
            ) : null}
          </p>
        </div>
      )}

      {!isLocked && (
        <Tabs value={serviceType} onValueChange={onServiceTypeChange}>
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            {ZEUS_SERVICE_TYPES.map((st) => (
              <TabsTrigger
                key={st}
                value={st}
                className={
                  st === "Postpaid"
                    ? "data-[state=active]:text-blue-700"
                    : st === "Prepaid"
                      ? "data-[state=active]:text-emerald-700"
                      : "data-[state=active]:text-orange-700"
                }
              >
                {ZEUS_SERVICE_META[st].label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {embedded && selectedRegion ? (
        <p className={`text-sm ${serviceMeta.accent}`}>
          Filtered by {selectedRegion}
        </p>
      ) : null}

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Zap className="h-3.5 w-3.5" /> Consumption
            </p>
            {regionLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className={`text-2xl font-bold tabular-nums ${serviceMeta.accent}`}>
                {formatKwhRaw(stats.totalKwh)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Avg {formatKwh(stats.avgKwh)} / customer
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> Customers
            </p>
            {regionLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold text-indigo-700 tabular-nums">
                {formatNumber(stats.totalCustomers)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {serviceMeta.label} accounts
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" /> Billing
            </p>
            {regionLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <p className="text-2xl font-bold text-blue-700 tabular-nums">
                {formatMoney(stats.totalBilling)}
              </p>
            )}
          </CardContent>
        </Card>
        <Link href="/customer-sales/debt">
          <Card className="h-full transition-colors hover:border-sky-400 hover:bg-sky-50/40">
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground mb-1 flex items-center justify-between gap-1">
                <span className="flex items-center gap-1">
                  <Scale className="h-3.5 w-3.5" /> Debt
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 text-sky-600" />
              </p>
              {regionLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <p className="text-2xl font-bold text-sky-700 tabular-nums">
                  {formatMoney(stats.totalDebt)}
                </p>
              )}
              <p className="text-xs text-sky-700 mt-1">View debt insights →</p>
            </CardContent>
          </Card>
        </Link>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Scale className="h-3.5 w-3.5" /> Amount due
            </p>
            {regionLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <p className="text-2xl font-bold text-amber-700 tabular-nums">
                {formatMoney(stats.totalDue)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Scale className="h-3.5 w-3.5" /> Outstanding
            </p>
            {regionLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <p className="text-2xl font-bold text-rose-700 tabular-nums">
                {formatMoney(stats.totalOutstanding)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>Consumption &amp; customers by region</CardTitle>
            <CardDescription>
              Billed kWh and {serviceMeta.label.toLowerCase()} accounts per region — Zeus{" "}
              {serviceMeta.label}
            </CardDescription>
          </div>
          <ToggleGroup
            type="single"
            value={chartKind}
            onValueChange={(v) => {
              if (v) setChartKind(v as ChartKind);
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
          {regionLoading ? (
            <Skeleton className="h-[320px] w-full" />
          ) : byConsumption.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No Zeus aggregate data for this period.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              {chartKind === "bar" ? (
                <BarChart
                  data={byConsumption}
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
                    tickFormatter={(v) =>
                      Math.abs(v) >= 1_000_000
                        ? `${(v / 1_000_000).toFixed(0)}M`
                        : Math.abs(v) >= 1_000
                          ? `${(v / 1_000).toFixed(0)}k`
                          : String(v)
                    }
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
                      if (data?.regionname) selectRegion(data.regionname);
                    }}
                  >
                    <LabelList
                      dataKey="sum_billconsumptionvalue"
                      content={(props) => <DualValueLabel {...props} data={byConsumption} />}
                    />
                    {byConsumption.map((row, i) => (
                      <Cell
                        key={row.regionname}
                        fill={
                          selectedRegion === row.regionname
                            ? "#1e3a8a"
                            : ZEUS_COLORS[i % ZEUS_COLORS.length]
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <AreaChart
                  data={byConsumption}
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
                    tickFormatter={(v) =>
                      Math.abs(v) >= 1_000_000
                        ? `${(v / 1_000_000).toFixed(0)}M`
                        : Math.abs(v) >= 1_000
                          ? `${(v / 1_000).toFixed(0)}k`
                          : String(v)
                    }
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
                    dot={{ r: 3, fill: "#1d4ed8" }}
                    isAnimationActive={false}
                  >
                    <LabelList
                      dataKey="sum_billconsumptionvalue"
                      content={(props) => <DualValueLabel {...props} data={byConsumption} />}
                    />
                  </Area>
                </AreaChart>
              )}
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="regions">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger
            value="regions"
            className="data-[state=active]:text-blue-700"
          >
            By region
          </TabsTrigger>
          <TabsTrigger
            value="districts"
            className="data-[state=active]:text-blue-700"
          >
            By district
          </TabsTrigger>
          <TabsTrigger
            value="account-type"
            className="data-[state=active]:text-blue-700"
          >
            Account type
          </TabsTrigger>
        </TabsList>

        <TabsContent value="regions" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Region breakdown</CardTitle>
                <CardDescription>
                  Click a region to filter districts and the detail table
                </CardDescription>
              </div>
              {selectedRegion && (
                <button
                  type="button"
                  onClick={() => selectRegion(null)}
                  className="text-xs text-blue-700 hover:underline"
                >
                  Clear region filter
                </button>
              )}
            </CardHeader>
            <CardContent>
              {regionLoading ? (
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
                          Consumption
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
                        <th className="text-right py-2 px-4 font-medium text-sky-700">
                          Debt
                        </th>
                        <th className="text-right py-2 px-4 font-medium text-amber-700">
                          Due
                        </th>
                        <th className="text-right py-2 pl-4 font-medium text-rose-700">
                          Outstanding
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...regionAgg]
                        .sort(
                          (a, b) =>
                            (b.sum_billconsumptionvalue || 0) -
                            (a.sum_billconsumptionvalue || 0),
                        )
                        .map((item) => {
                          const name = item.regionname || "Unknown";
                          const avgKwh =
                            item.customer_count > 0
                              ? (item.sum_billconsumptionvalue || 0) /
                                item.customer_count
                              : 0;
                          const selected = selectedRegion === name;
                          return (
                            <tr
                              key={name}
                              className={cn(
                                "border-b last:border-0 hover:bg-muted/40 cursor-pointer",
                                selected && "bg-blue-50",
                              )}
                              onClick={() => selectRegion(name)}
                            >
                              <td className="py-2.5 pr-4 font-medium">
                                {name}
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
                              <td className="py-2.5 px-4 text-right text-blue-700 tabular-nums">
                                {formatMoney(item.sum_billamount)}
                              </td>
                              <td className="py-2.5 px-4 text-right text-sky-700 tabular-nums">
                                {formatMoney(item.sum_debtamount)}
                              </td>
                              <td className="py-2.5 px-4 text-right text-amber-700 tabular-nums">
                                {formatMoney(item.sum_amountdue)}
                              </td>
                              <td className="py-2.5 pl-4 text-right text-rose-700 tabular-nums">
                                {formatMoney(item.sum_outstandingamount)}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/30">
                        <td className="py-2.5 pr-4 font-semibold">Total</td>
                        <td className="py-2.5 px-4 text-right font-bold text-blue-700 tabular-nums">
                          {formatKwhRaw(stats.totalKwh)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-cyan-700 tabular-nums">
                          {formatKwhRaw(stats.avgKwh)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold tabular-nums">
                          {formatNumber(stats.totalCustomers)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-blue-700 tabular-nums">
                          {formatMoney(stats.totalBilling)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-sky-700 tabular-nums">
                          {formatMoney(stats.totalDebt)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-amber-700 tabular-nums">
                          {formatMoney(stats.totalDue)}
                        </td>
                        <td className="py-2.5 pl-4 text-right font-semibold text-rose-700 tabular-nums">
                          {formatMoney(stats.totalOutstanding)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="districts" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>District breakdown</CardTitle>
              <CardDescription>
                {effectiveRegion
                  ? `Districts in ${effectiveRegion}`
                  : "Select a region above to see district breakdown"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!effectiveRegion ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Click a region in the chart or region table to drill into
                  districts.
                </p>
              ) : districtLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : districtAgg.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No district data for {effectiveRegion}.
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
                          Consumption
                        </th>
                        <th className="text-right py-2 px-4 font-medium text-muted-foreground">
                          Customers
                        </th>
                        <th className="text-right py-2 px-4 font-medium text-muted-foreground">
                          Billing
                        </th>
                        <th className="text-right py-2 px-4 font-medium text-sky-700">
                          Debt
                        </th>
                        <th className="text-right py-2 px-4 font-medium text-amber-700">
                          Due
                        </th>
                        <th className="text-right py-2 pl-4 font-medium text-rose-700">
                          Outstanding
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...districtAgg]
                        .sort(
                          (a, b) =>
                            (b.sum_billconsumptionvalue || 0) -
                            (a.sum_billconsumptionvalue || 0),
                        )
                        .map((item) => (
                          <tr
                            key={item.districtname || "unknown"}
                            className="border-b last:border-0 hover:bg-muted/40"
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
                            <td className="py-2.5 px-4 text-right text-blue-700 tabular-nums">
                              {formatMoney(item.sum_billamount)}
                            </td>
                            <td className="py-2.5 px-4 text-right text-sky-700 tabular-nums">
                              {formatMoney(item.sum_debtamount)}
                            </td>
                            <td className="py-2.5 px-4 text-right text-amber-700 tabular-nums">
                              {formatMoney(item.sum_amountdue)}
                            </td>
                            <td className="py-2.5 pl-4 text-right text-rose-700 tabular-nums">
                              {formatMoney(item.sum_outstandingamount)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account-type" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Account type breakdown</CardTitle>
              <CardDescription>
                Consumption and billing by account type
              </CardDescription>
            </CardHeader>
            <CardContent>
              {accountLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : accountTypeAgg.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No account type data.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                          Account type
                        </th>
                        <th className="text-right py-2 px-4 font-medium text-blue-700">
                          Consumption
                        </th>
                        <th className="text-right py-2 px-4 font-medium text-muted-foreground">
                          Customers
                        </th>
                        <th className="text-right py-2 px-4 font-medium text-muted-foreground">
                          Billing
                        </th>
                        <th className="text-right py-2 px-4 font-medium text-sky-700">
                          Debt
                        </th>
                        <th className="text-right py-2 px-4 font-medium text-amber-700">
                          Due
                        </th>
                        <th className="text-right py-2 pl-4 font-medium text-rose-700">
                          Outstanding
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...accountTypeAgg]
                        .sort(
                          (a, b) =>
                            (b.sum_billconsumptionvalue || 0) -
                            (a.sum_billconsumptionvalue || 0),
                        )
                        .map((item) => (
                          <tr
                            key={item.accounttype || "unknown"}
                            className="border-b last:border-0 hover:bg-muted/40"
                          >
                            <td className="py-2.5 pr-4 font-medium">
                              {item.accounttype || "—"}
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold text-blue-700 tabular-nums">
                              {formatKwhRaw(item.sum_billconsumptionvalue)}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums">
                              {formatNumber(item.customer_count)}
                            </td>
                            <td className="py-2.5 px-4 text-right text-blue-700 tabular-nums">
                              {formatMoney(item.sum_billamount)}
                            </td>
                            <td className="py-2.5 px-4 text-right text-sky-700 tabular-nums">
                              {formatMoney(item.sum_debtamount)}
                            </td>
                            <td className="py-2.5 px-4 text-right text-amber-700 tabular-nums">
                              {formatMoney(item.sum_amountdue)}
                            </td>
                            <td className="py-2.5 pl-4 text-right text-rose-700 tabular-nums">
                              {formatMoney(item.sum_outstandingamount)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CustomerSalesDetail
        dateRange={dateRange}
        region={effectiveRegion}
        district={district}
        serviceType={serviceType}
      />
    </div>
  );
}
