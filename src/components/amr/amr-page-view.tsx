"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Radio,
  Search,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AmrCustomerSalesDetail } from "@/components/customer-sales/amr-customer-sales-detail";
import {
  useAmrStatusDetails,
  useAmrStatusSummary,
  useAmrStatusTimeline,
} from "@/hooks/api/use-amr-status-api";
import { cn } from "@/lib/utils";

interface DateRange {
  start: string;
  end: string;
}

interface AmrPageViewProps {
  dateRange: DateRange;
  region?: string;
  district?: string;
}

function formatKwh(value: number | null | undefined) {
  if (value === null || value === undefined) return "0 kWh";
  return `${(value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} kWh`;
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "0";
  return (value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatDate(date: string | null | undefined) {
  if (!date) return "—";
  try {
    return format(parseISO(date.slice(0, 10)), "MMM dd, yyyy");
  } catch {
    return date;
  }
}

export function AmrPageView({ dateRange, region, district }: AmrPageViewProps) {
  const [selectedSltType, setSelectedSltType] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "ONLINE" | "OFFLINE">(
    "all",
  );
  const [statusSearch, setStatusSearch] = useState("");
  const [statusPage, setStatusPage] = useState(1);
  const statusPageSize = 50;

  const statusParams = {
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    region,
    district,
    sltType: selectedSltType || undefined,
  };

  const { data: statusSummary, isLoading: summaryLoading } =
    useAmrStatusSummary(statusParams);

  const { data: statusTimeline, isLoading: timelineLoading } =
    useAmrStatusTimeline(statusParams);

  const { data: statusDetails, isLoading: detailsLoading } =
    useAmrStatusDetails({
      ...statusParams,
      status: statusFilter === "all" ? undefined : statusFilter,
      search: statusSearch.trim() || undefined,
      page: statusPage,
      limit: statusPageSize,
      sortBy: "uptime",
      sortOrder: "asc",
    });

  const timelineData = useMemo(() => {
    return (statusTimeline || []).map((d) => ({
      date: d.date,
      online: d.online,
      offline: d.offline,
    }));
  }, [statusTimeline]);

  const detailRows = statusDetails?.data || [];
  const pagination = statusDetails?.pagination;
  const totalPages = pagination?.total_pages || 1;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <Radio className="h-7 w-7 text-orange-600" />
          AMR Meters
        </h2>
        <p className="text-muted-foreground mt-1">
          Online/offline health, SLT breakdown, and daily consumption for AMR
          customer meters
          {selectedSltType ? (
            <span className="text-orange-700">
              {" "}
              · filtered by {selectedSltType.replace(/_/g, " ")}
            </span>
          ) : null}
        </p>
      </div>

      {/* Meter health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Meter Health Status
          </CardTitle>
          <CardDescription>
            Online vs offline AMR meters over the selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : statusSummary ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="none"
                        className="text-gray-200"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 56}`}
                        strokeDashoffset={`${2 * Math.PI * 56 * (1 - (statusSummary.online_percentage || 0) / 100)}`}
                        className="text-green-600 transition-all duration-1000"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {(statusSummary.online_percentage || 0).toFixed(0)}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Online
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-green-500" />
                      <div>
                        <p className="text-sm font-medium">
                          Online: {formatNumber(statusSummary.online)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(statusSummary.online_percentage || 0).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-orange-500" />
                      <div>
                        <p className="text-sm font-medium">
                          No Data: {formatNumber(statusSummary.offline_no_data)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Missing recent readings
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-red-500" />
                      <div>
                        <p className="text-sm font-medium">
                          No Record:{" "}
                          {formatNumber(statusSummary.offline_no_record)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Never reported
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-muted-foreground mb-1">
                      Total Online
                    </p>
                    <p className="text-3xl font-bold text-green-600">
                      {formatNumber(statusSummary.online)}
                    </p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-muted-foreground mb-1">
                      Total Offline
                    </p>
                    <p className="text-3xl font-bold text-red-600">
                      {formatNumber(statusSummary.total_offline)}
                    </p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-muted-foreground mb-1">
                      Avg Uptime
                    </p>
                    <p className="text-3xl font-bold text-blue-600">
                      {(statusSummary.avg_uptime_percentage || 0).toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="text-sm text-muted-foreground mb-1">
                      Consumption
                    </p>
                    <p className="text-2xl font-bold text-orange-700">
                      {formatKwh(statusSummary.total_consumption_kwh)}
                    </p>
                  </div>
                </div>
              </div>

              {timelineLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : timelineData.length > 0 ? (
                <div className="mt-2">
                  <h4 className="text-sm font-medium mb-3">Status Timeline</h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={timelineData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-muted"
                      />
                      <XAxis
                        dataKey="date"
                        className="text-xs"
                        tickFormatter={(val) =>
                          format(parseISO(String(val).slice(0, 10)), "MMM dd")
                        }
                      />
                      <YAxis className="text-xs" />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const date = payload[0]?.payload?.date;
                          return (
                            <div className="bg-background border rounded-lg shadow-lg p-3">
                              <p className="font-medium mb-1 text-sm">
                                {date
                                  ? format(
                                      parseISO(String(date).slice(0, 10)),
                                      "MMM dd, yyyy",
                                    )
                                  : "—"}
                              </p>
                              {payload.map((entry) => (
                                <div
                                  key={String(entry.name)}
                                  className="flex items-center justify-between gap-4 text-sm"
                                >
                                  <span style={{ color: entry.fill }}>
                                    {entry.name}:
                                  </span>
                                  <span className="font-medium">
                                    {entry.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="online"
                        stackId="status"
                        fill="hsl(142, 76%, 36%)"
                        name="Online"
                      />
                      <Bar
                        dataKey="offline"
                        stackId="status"
                        fill="hsl(0, 84%, 60%)"
                        name="Offline"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No timeline data for this period.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No AMR health data available for the selected filters.
            </p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="consumption">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger
            value="consumption"
            className="data-[state=active]:text-orange-700"
          >
            Consumption
          </TabsTrigger>
          <TabsTrigger
            value="status"
            className="data-[state=active]:text-orange-700"
          >
            Meter status
          </TabsTrigger>
        </TabsList>

        <TabsContent value="consumption" className="mt-4 space-y-4">
          <AmrCustomerSalesDetail
            dateRange={dateRange}
            region={region}
            district={district}
            selectedSltType={selectedSltType}
            onSelectedSltTypeChange={setSelectedSltType}
          />
        </TabsContent>

        <TabsContent value="status" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>AMR meter status</CardTitle>
              <CardDescription>
                Meters sorted by uptime — use filters to focus on offline or
                low-uptime devices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search meter, account, customer…"
                    className="pl-8"
                    value={statusSearch}
                    onChange={(e) => {
                      setStatusSearch(e.target.value);
                      setStatusPage(1);
                    }}
                  />
                </div>
                <div className="flex gap-1">
                  {(
                    [
                      ["all", "All"],
                      ["ONLINE", "Online"],
                      ["OFFLINE", "Offline"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setStatusFilter(value);
                        setStatusPage(1);
                      }}
                      className={cn(
                        "px-3 py-1.5 text-xs rounded-md border transition-colors",
                        statusFilter === value
                          ? "bg-orange-50 border-orange-500 text-orange-800"
                          : "bg-card hover:bg-muted/40",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {detailsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr className="text-left text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Meter</th>
                        <th className="px-3 py-2 font-medium">Customer</th>
                        <th className="px-3 py-2 font-medium">District</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium text-right">
                          Uptime
                        </th>
                        <th className="px-3 py-2 font-medium text-right">
                          Days offline
                        </th>
                        <th className="px-3 py-2 font-medium text-right">
                          Consumption
                        </th>
                        <th className="px-3 py-2 font-medium">Last reading</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-3 py-8 text-center text-muted-foreground"
                          >
                            No meters match the current filters.
                          </td>
                        </tr>
                      ) : (
                        detailRows.map((meter) => {
                          const isOnline =
                            (meter.status || "").toUpperCase() === "ONLINE";
                          return (
                            <tr
                              key={`${meter.meter_number}-${meter.account_no || ""}`}
                              className="border-t"
                            >
                              <td className="px-3 py-2 font-mono text-xs">
                                <Link
                                  href={`/amr/${encodeURIComponent(meter.meter_number)}`}
                                  className="text-orange-700 hover:underline"
                                >
                                  {meter.meter_number}
                                </Link>
                              </td>
                              <td className="px-3 py-2 max-w-[180px] truncate">
                                {meter.customer_name || "—"}
                              </td>
                              <td className="px-3 py-2">
                                {meter.district || "—"}
                              </td>
                              <td className="px-3 py-2">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    isOnline
                                      ? "border-green-300 text-green-700 bg-green-50"
                                      : "border-red-300 text-red-700 bg-red-50",
                                  )}
                                >
                                  {meter.status || "—"}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {(meter.uptime_percentage || 0).toFixed(1)}%
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatNumber(meter.days_offline)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatKwh(meter.total_consumption_kwh)}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {formatDate(
                                  meter.last_consumption_date ||
                                    meter.last_reading_time,
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {pagination && pagination.total_records > 0 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {formatNumber(pagination.total_records)} meters
                    {selectedSltType
                      ? ` · ${selectedSltType.replace(/_/g, " ")}`
                      : ""}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={statusPage <= 1}
                      onClick={() => setStatusPage((p) => Math.max(1, p - 1))}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" /> Prev
                    </button>
                    <span>
                      Page {statusPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={statusPage >= totalPages}
                      onClick={() =>
                        setStatusPage((p) => Math.min(totalPages, p + 1))
                      }
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 disabled:opacity-40"
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
