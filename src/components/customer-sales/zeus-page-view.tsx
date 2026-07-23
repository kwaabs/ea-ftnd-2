"use client";

import { useMemo, useState } from "react";
import { DollarSign, Scale, Users, Zap } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { useCustomerConsumptionAggregate } from "@/hooks/api/use-customer-consumption-aggregate-api";
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

export function ZeusPageView({
  dateRange,
  region,
  district,
}: ZeusPageViewProps) {
  const [serviceType, setServiceType] = useState<ZeusServiceType>("Postpaid");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const effectiveRegion = selectedRegion || region;
  const serviceMeta = ZEUS_SERVICE_META[serviceType];

  const { data: regionAgg = [], isLoading: regionLoading } =
    useCustomerConsumptionAggregate({
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
      groupBy: "regionname",
      region,
      district,
      serviceType,
    });

  const { data: districtAgg = [], isLoading: districtLoading } =
    useCustomerConsumptionAggregate({
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
      groupBy: "districtname",
      region: effectiveRegion,
      district,
      serviceType,
      enabled: Boolean(effectiveRegion),
    });

  const { data: customerTypeAgg = [], isLoading: typeLoading } =
    useCustomerConsumptionAggregate({
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
      groupBy: "customertype",
      region: effectiveRegion,
      district,
      serviceType,
    });

  const { data: accountTypeAgg = [], isLoading: accountLoading } =
    useCustomerConsumptionAggregate({
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
      groupBy: "accounttype",
      region: effectiveRegion,
      district,
      serviceType,
    });

  const stats = useMemo(() => {
    const totalKwh = regionAgg.reduce(
      (s, r) => s + (r.sum_lastbillconsumption || 0),
      0,
    );
    const totalCustomers = regionAgg.reduce(
      (s, r) => s + (r.customer_count || 0),
      0,
    );
    const totalBilling = regionAgg.reduce(
      (s, r) => s + (r.sum_lastbillamount || 0),
      0,
    );
    const totalBalance = regionAgg.reduce(
      (s, r) => s + (r.sum_currentbalance || 0),
      0,
    );
    return {
      totalKwh,
      totalCustomers,
      totalBilling,
      totalBalance,
      avgKwh: totalCustomers > 0 ? totalKwh / totalCustomers : 0,
    };
  }, [regionAgg]);

  const byConsumption = useMemo(
    () =>
      [...regionAgg]
        .sort(
          (a, b) =>
            (b.sum_lastbillconsumption || 0) -
            (a.sum_lastbillconsumption || 0),
        )
        .slice(0, 12)
        .map((r) => ({
          regionname: r.regionname || "Unknown",
          sum_lastbillconsumption: r.sum_lastbillconsumption || 0,
          customer_count: r.customer_count || 0,
          sum_lastbillamount: r.sum_lastbillamount || 0,
        })),
    [regionAgg],
  );

  const byCustomerType = useMemo(
    () =>
      [...customerTypeAgg]
        .sort(
          (a, b) =>
            (b.sum_lastbillconsumption || 0) -
            (a.sum_lastbillconsumption || 0),
        )
        .slice(0, 10)
        .map((r) => ({
          customertype: r.customertype || "Unknown",
          sum_lastbillconsumption: r.sum_lastbillconsumption || 0,
          customer_count: r.customer_count || 0,
          sum_lastbillamount: r.sum_lastbillamount || 0,
        })),
    [customerTypeAgg],
  );

  const selectRegion = (value: string | null) => {
    setSelectedRegion((prev) => (prev === value ? null : value));
  };

  const onServiceTypeChange = (value: string) => {
    setServiceType(value as ZeusServiceType);
    setSelectedRegion(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">
          Zeus
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

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Scale className="h-3.5 w-3.5" /> Current balance
            </p>
            {regionLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <p className="text-2xl font-bold text-sky-700 tabular-nums">
                {formatMoney(stats.totalBalance)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Consumption by region</CardTitle>
            <CardDescription>
              Billed kWh per region — Zeus {serviceMeta.label}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {regionLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : byConsumption.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">
                No Zeus aggregate data for this period.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={byConsumption}
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
                      Math.abs(v) >= 1_000_000
                        ? `${(v / 1_000_000).toFixed(0)}M`
                        : Math.abs(v) >= 1_000
                          ? `${(v / 1_000).toFixed(0)}k`
                          : String(v)
                    }
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(v: number) => [formatKwhRaw(v), "Consumption"]}
                  />
                  <Bar
                    dataKey="sum_lastbillconsumption"
                    radius={[6, 6, 0, 0]}
                    cursor="pointer"
                    onClick={(data: { regionname?: string }) => {
                      if (data?.regionname) selectRegion(data.regionname);
                    }}
                  >
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
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customers by region</CardTitle>
            <CardDescription>Postpaid accounts per region</CardDescription>
          </CardHeader>
          <CardContent>
            {regionLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={[...byConsumption].sort(
                    (a, b) => b.customer_count - a.customer_count,
                  )}
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
                    formatter={(v: number) => [formatNumber(v), "Customers"]}
                  />
                  <Bar
                    dataKey="customer_count"
                    fill="#8b5cf6"
                    radius={[6, 6, 0, 0]}
                    cursor="pointer"
                    onClick={(data: { regionname?: string }) => {
                      if (data?.regionname) selectRegion(data.regionname);
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="regions">
        <TabsList className="grid w-full max-w-xl grid-cols-4">
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
            value="customer-type"
            className="data-[state=active]:text-blue-700"
          >
            Customer type
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
                        <th className="text-right py-2 pl-4 font-medium text-muted-foreground">
                          Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...regionAgg]
                        .sort(
                          (a, b) =>
                            (b.sum_lastbillconsumption || 0) -
                            (a.sum_lastbillconsumption || 0),
                        )
                        .map((item) => {
                          const name = item.regionname || "Unknown";
                          const pct =
                            stats.totalKwh > 0
                              ? ((item.sum_lastbillconsumption || 0) /
                                  stats.totalKwh) *
                                100
                              : 0;
                          const avgKwh =
                            item.customer_count > 0
                              ? (item.sum_lastbillconsumption || 0) /
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
                                {formatKwhRaw(item.sum_lastbillconsumption)}
                              </td>
                              <td className="py-2.5 px-4 text-right text-cyan-700 tabular-nums">
                                {formatKwhRaw(avgKwh)}
                              </td>
                              <td className="py-2.5 px-4 text-right tabular-nums">
                                {formatNumber(item.customer_count)}
                              </td>
                              <td className="py-2.5 px-4 text-right text-blue-700 tabular-nums">
                                {formatMoney(item.sum_lastbillamount)}
                              </td>
                              <td className="py-2.5 pl-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <span className="text-sky-700 font-medium tabular-nums">
                                    {formatMoney(item.sum_currentbalance)}
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
                        <td className="py-2.5 pl-4 text-right font-semibold text-sky-700 tabular-nums">
                          {formatMoney(stats.totalBalance)}
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
                        <th className="text-right py-2 pl-4 font-medium text-muted-foreground">
                          Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...districtAgg]
                        .sort(
                          (a, b) =>
                            (b.sum_lastbillconsumption || 0) -
                            (a.sum_lastbillconsumption || 0),
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
                              {formatKwhRaw(item.sum_lastbillconsumption)}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums">
                              {formatNumber(item.customer_count)}
                            </td>
                            <td className="py-2.5 px-4 text-right text-blue-700 tabular-nums">
                              {formatMoney(item.sum_lastbillamount)}
                            </td>
                            <td className="py-2.5 pl-4 text-right text-sky-700 tabular-nums">
                              {formatMoney(item.sum_currentbalance)}
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

        <TabsContent value="customer-type" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Consumption by customer type</CardTitle>
                <CardDescription>
                  Postpaid kWh by customer type
                </CardDescription>
              </CardHeader>
              <CardContent>
                {typeLoading ? (
                  <Skeleton className="h-[260px] w-full" />
                ) : byCustomerType.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">
                    No customer type data.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={byCustomerType}
                      margin={{ top: 8, right: 8, left: 8, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="customertype"
                        angle={-30}
                        textAnchor="end"
                        tick={{ fontSize: 10 }}
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
                        formatter={(v: number) => [
                          formatKwhRaw(v),
                          "Consumption",
                        ]}
                      />
                      <Bar
                        dataKey="sum_lastbillconsumption"
                        fill="#2563eb"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Customer type breakdown</CardTitle>
                <CardDescription>
                  Customers and billing by type
                </CardDescription>
              </CardHeader>
              <CardContent>
                {typeLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-background">
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                            Type
                          </th>
                          <th className="text-right py-2 px-3 font-medium text-blue-700">
                            kWh
                          </th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">
                            Customers
                          </th>
                          <th className="text-right py-2 pl-3 font-medium text-muted-foreground">
                            Billing
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...customerTypeAgg]
                          .sort(
                            (a, b) =>
                              (b.sum_lastbillconsumption || 0) -
                              (a.sum_lastbillconsumption || 0),
                          )
                          .map((item) => (
                            <tr
                              key={item.customertype || "unknown"}
                              className="border-b last:border-0"
                            >
                              <td className="py-2 pr-4 font-medium">
                                {item.customertype || "—"}
                              </td>
                              <td className="py-2 px-3 text-right text-blue-700 tabular-nums">
                                {formatKwhRaw(item.sum_lastbillconsumption)}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums">
                                {formatNumber(item.customer_count)}
                              </td>
                              <td className="py-2 pl-3 text-right tabular-nums">
                                {formatMoney(item.sum_lastbillamount)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
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
                        <th className="text-right py-2 pl-4 font-medium text-muted-foreground">
                          Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...accountTypeAgg]
                        .sort(
                          (a, b) =>
                            (b.sum_lastbillconsumption || 0) -
                            (a.sum_lastbillconsumption || 0),
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
                              {formatKwhRaw(item.sum_lastbillconsumption)}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums">
                              {formatNumber(item.customer_count)}
                            </td>
                            <td className="py-2.5 px-4 text-right text-blue-700 tabular-nums">
                              {formatMoney(item.sum_lastbillamount)}
                            </td>
                            <td className="py-2.5 pl-4 text-right text-sky-700 tabular-nums">
                              {formatMoney(item.sum_currentbalance)}
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
