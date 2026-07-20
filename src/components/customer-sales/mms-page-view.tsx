"use client";

import { useMemo, useState } from "react";
import {
  BatteryCharging,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
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
import { useMmsCustomerSalesAggregate } from "@/hooks/api/use-mms-customer-sales-aggregate-api";
import { MmsCustomerSalesDetail } from "@/components/customer-sales/mms-customer-sales-detail";
import { cn } from "@/lib/utils";

interface DateRange {
  start: string;
  end: string;
}

interface MmsPageViewProps {
  dateRange: DateRange;
  region?: string;
  district?: string;
}

const MMS_COLORS = [
  "#16a34a",
  "#22c55e",
  "#4ade80",
  "#86efac",
  "#15803d",
  "#166534",
  "#14532d",
  "#bbf7d0",
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

export function MmsPageView({ dateRange, region, district }: MmsPageViewProps) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const effectiveRegion = selectedRegion || region;

  const { data: regionAgg = [], isLoading: regionLoading } =
    useMmsCustomerSalesAggregate({
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
      groupBy: "region",
      region,
      district,
    });

  const { data: manufacturerAgg = [], isLoading: mfrLoading } =
    useMmsCustomerSalesAggregate({
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
      groupBy: "manufacturer",
      region: effectiveRegion,
      district,
    });

  const { data: districtAgg = [], isLoading: districtLoading } =
    useMmsCustomerSalesAggregate({
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
      groupBy: "district",
      region: effectiveRegion,
      district,
      enabled: Boolean(effectiveRegion),
    });

  const stats = useMemo(() => {
    const totalKwh = regionAgg.reduce(
      (s, r) => s + (r.sum_last_month_kwh_read || 0),
      0,
    );
    const totalCustomers = regionAgg.reduce(
      (s, r) => s + (r.customer_count || 0),
      0,
    );
    const totalCredit = regionAgg.reduce(
      (s, r) => s + (r.sum_last_month_credit_read || 0),
      0,
    );
    const totalBalance = regionAgg.reduce(
      (s, r) => s + (r.sum_credit_balance_remaining || 0),
      0,
    );
    return {
      totalKwh,
      totalCustomers,
      totalCredit,
      totalBalance,
      avgKwh: totalCustomers > 0 ? totalKwh / totalCustomers : 0,
    };
  }, [regionAgg]);

  const byConsumption = useMemo(
    () =>
      [...regionAgg]
        .sort(
          (a, b) =>
            (b.sum_last_month_kwh_read || 0) - (a.sum_last_month_kwh_read || 0),
        )
        .slice(0, 12)
        .map((r) => ({
          region: r.region || "Unknown",
          sum_last_month_kwh_read: r.sum_last_month_kwh_read || 0,
          customer_count: r.customer_count || 0,
        })),
    [regionAgg],
  );

  const byManufacturer = useMemo(
    () =>
      [...manufacturerAgg]
        .sort(
          (a, b) =>
            (b.sum_last_month_kwh_read || 0) - (a.sum_last_month_kwh_read || 0),
        )
        .slice(0, 10)
        .map((r) => ({
          manufacturer: r.manufacturer || "Unknown",
          sum_last_month_kwh_read: r.sum_last_month_kwh_read || 0,
          customer_count: r.customer_count || 0,
        })),
    [manufacturerAgg],
  );

  const selectRegion = (value: string | null) => {
    setSelectedRegion((prev) => (prev === value ? null : value));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">
          MMS — Prepaid
        </h2>
        <p className="text-muted-foreground mt-1">
          Prepaid customer consumption, credit purchases and balances
          {selectedRegion ? (
            <span className="text-green-700">
              {" "}
              · filtered by {selectedRegion}
            </span>
          ) : null}
        </p>
      </div>

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
              <p className="text-2xl font-bold text-green-700 tabular-nums">
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
              <p className="text-2xl font-bold text-emerald-700 tabular-nums">
                {formatNumber(stats.totalCustomers)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Prepaid meters
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <BatteryCharging className="h-3.5 w-3.5" /> Credit purchased
            </p>
            {regionLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <p className="text-2xl font-bold text-green-700 tabular-nums">
                {formatMoney(stats.totalCredit)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Wallet className="h-3.5 w-3.5" /> Credit balance
            </p>
            {regionLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <p className="text-2xl font-bold text-emerald-700 tabular-nums">
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
            <CardDescription>Prepaid kWh read per region</CardDescription>
          </CardHeader>
          <CardContent>
            {regionLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : byConsumption.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">
                No MMS aggregate data for this period.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={byConsumption}
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
                    dataKey="sum_last_month_kwh_read"
                    radius={[6, 6, 0, 0]}
                    cursor="pointer"
                    onClick={(data: { region?: string }) => {
                      if (data?.region) selectRegion(data.region);
                    }}
                  >
                    {byConsumption.map((row, i) => (
                      <Cell
                        key={row.region}
                        fill={
                          selectedRegion === row.region
                            ? "#15803d"
                            : MMS_COLORS[i % MMS_COLORS.length]
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
            <CardDescription>Prepaid accounts per region</CardDescription>
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
                    formatter={(v: number) => [formatNumber(v), "Customers"]}
                  />
                  <Bar
                    dataKey="customer_count"
                    fill="#22c55e"
                    radius={[6, 6, 0, 0]}
                    cursor="pointer"
                    onClick={(data: { region?: string }) => {
                      if (data?.region) selectRegion(data.region);
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="regions">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger
            value="regions"
            className="data-[state=active]:text-green-700"
          >
            By region
          </TabsTrigger>
          <TabsTrigger
            value="districts"
            className="data-[state=active]:text-green-700"
          >
            By district
          </TabsTrigger>
          <TabsTrigger
            value="manufacturers"
            className="data-[state=active]:text-green-700"
          >
            By manufacturer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="regions" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Region breakdown</CardTitle>
                <CardDescription>
                  Click a region to filter charts, districts and the detail table
                </CardDescription>
              </div>
              {selectedRegion && (
                <button
                  type="button"
                  onClick={() => selectRegion(null)}
                  className="text-xs text-green-700 hover:underline"
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
                        <th className="text-right py-2 px-4 font-medium text-green-700">
                          kWh Read
                        </th>
                        <th className="text-right py-2 px-4 font-medium text-cyan-700">
                          Avg kWh / Customer
                        </th>
                        <th className="text-right py-2 px-4 font-medium text-muted-foreground">
                          Customers
                        </th>
                        <th className="text-right py-2 px-4 font-medium text-muted-foreground">
                          Credit purchased
                        </th>
                        <th className="text-right py-2 pl-4 font-medium text-muted-foreground">
                          Credit balance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...regionAgg]
                        .sort(
                          (a, b) =>
                            (b.sum_last_month_kwh_read || 0) -
                            (a.sum_last_month_kwh_read || 0),
                        )
                        .map((item) => {
                          const name = item.region || "Unknown";
                          const pct =
                            stats.totalKwh > 0
                              ? ((item.sum_last_month_kwh_read || 0) /
                                  stats.totalKwh) *
                                100
                              : 0;
                          const avgKwh =
                            item.customer_count > 0
                              ? (item.sum_last_month_kwh_read || 0) /
                                item.customer_count
                              : 0;
                          const selected = selectedRegion === name;
                          return (
                            <tr
                              key={name}
                              className={cn(
                                "border-b last:border-0 hover:bg-muted/40 cursor-pointer",
                                selected && "bg-green-50",
                              )}
                              onClick={() => selectRegion(name)}
                            >
                              <td className="py-2.5 pr-4 font-medium">
                                {name}
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
                          {formatKwhRaw(stats.totalKwh)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-cyan-700 tabular-nums">
                          {formatKwhRaw(stats.avgKwh)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold tabular-nums">
                          {formatNumber(stats.totalCustomers)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-green-700 tabular-nums">
                          {formatMoney(stats.totalCredit)}
                        </td>
                        <td className="py-2.5 pl-4 text-right font-semibold text-emerald-700 tabular-nums">
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
                        <th className="text-right py-2 px-4 font-medium text-green-700">
                          kWh Read
                        </th>
                        <th className="text-right py-2 px-4 font-medium text-muted-foreground">
                          Customers
                        </th>
                        <th className="text-right py-2 px-4 font-medium text-muted-foreground">
                          Credit purchased
                        </th>
                        <th className="text-right py-2 pl-4 font-medium text-muted-foreground">
                          Credit balance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...districtAgg]
                        .sort(
                          (a, b) =>
                            (b.sum_last_month_kwh_read || 0) -
                            (a.sum_last_month_kwh_read || 0),
                        )
                        .map((item) => (
                          <tr
                            key={item.district || "unknown"}
                            className="border-b last:border-0 hover:bg-muted/40"
                          >
                            <td className="py-2.5 pr-4 font-medium">
                              {item.district || "—"}
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold text-green-700 tabular-nums">
                              {formatKwhRaw(item.sum_last_month_kwh_read)}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums">
                              {formatNumber(item.customer_count)}
                            </td>
                            <td className="py-2.5 px-4 text-right text-green-700 tabular-nums">
                              {formatMoney(item.sum_last_month_credit_read)}
                            </td>
                            <td className="py-2.5 pl-4 text-right text-emerald-700 tabular-nums">
                              {formatMoney(item.sum_credit_balance_remaining)}
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

        <TabsContent value="manufacturers" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Consumption by manufacturer</CardTitle>
                <CardDescription>
                  Top manufacturers by prepaid kWh
                </CardDescription>
              </CardHeader>
              <CardContent>
                {mfrLoading ? (
                  <Skeleton className="h-[260px] w-full" />
                ) : byManufacturer.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">
                    No manufacturer data.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={byManufacturer}
                      margin={{ top: 8, right: 8, left: 8, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="manufacturer"
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
                        dataKey="sum_last_month_kwh_read"
                        fill="#16a34a"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Manufacturer breakdown</CardTitle>
                <CardDescription>
                  Customers and credit by manufacturer
                </CardDescription>
              </CardHeader>
              <CardContent>
                {mfrLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-background">
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                            Manufacturer
                          </th>
                          <th className="text-right py-2 px-3 font-medium text-green-700">
                            kWh
                          </th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">
                            Customers
                          </th>
                          <th className="text-right py-2 pl-3 font-medium text-muted-foreground">
                            Credit
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...manufacturerAgg]
                          .sort(
                            (a, b) =>
                              (b.sum_last_month_kwh_read || 0) -
                              (a.sum_last_month_kwh_read || 0),
                          )
                          .map((item) => (
                            <tr
                              key={item.manufacturer || "unknown"}
                              className="border-b last:border-0"
                            >
                              <td className="py-2 pr-4 font-medium">
                                {item.manufacturer || "—"}
                              </td>
                              <td className="py-2 px-3 text-right text-green-700 tabular-nums">
                                {formatKwhRaw(item.sum_last_month_kwh_read)}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums">
                                {formatNumber(item.customer_count)}
                              </td>
                              <td className="py-2 pl-3 text-right tabular-nums">
                                {formatMoney(item.sum_last_month_credit_read)}
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
      </Tabs>

      {/* Detail records */}
      <MmsCustomerSalesDetail
        dateRange={dateRange}
        region={effectiveRegion}
        district={district}
      />
    </div>
  );
}
