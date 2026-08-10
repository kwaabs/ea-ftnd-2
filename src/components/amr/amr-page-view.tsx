"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  Activity,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Radio,
  Search,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AmrCustomerSalesDetail } from "@/components/customer-sales/amr-customer-sales-detail";
import { CustomerSalesDetail } from "@/components/customer-sales/customer-sales-detail";
import { useZeusBillingAggregate } from "@/hooks/api/use-zeus-billing-aggregate-api";
import {
  useAmrStatusDetails,
  useAmrStatusSummary,
  useAmrStatusTimeline,
} from "@/hooks/api/use-amr-status-api";
import { cn } from "@/lib/utils";
import type { ZeusBillingAggregateItem } from "@/types/api";

const AMR_CHART_COLORS = [
  "#c2410c",
  "#ea580c",
  "#f97316",
  "#fb923c",
  "#fdba74",
  "#9a3412",
  "#7c2d12",
  "#fed7aa",
];

const ALL = "all";

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((v) => (v || "").trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
}

function formatAxisNumber(v: number) {
  return Math.abs(v) >= 1_000_000
    ? `${(v / 1_000_000).toFixed(0)}M`
    : Math.abs(v) >= 1_000
      ? `${(v / 1_000).toFixed(0)}k`
      : String(v);
}

type AmrMetricKey =
  | "sum_billconsumptionvalue"
  | "sum_amountdue"
  | "sum_debtamount"
  | "sum_outstandingamount"
  | "sum_billamount";

interface DateRange {
  start: string;
  end: string;
}

interface AmrPageViewProps {
  dateRange: DateRange;
  region?: string;
  district?: string;
  /** When true, omit the page-level AMR heading (hub provides context). */
  embedded?: boolean;
  /** Lock the view to a single SLT type (hides in-page SLT filter cards). */
  lockedSltType?: string;
  /** When true, skip the daily AMR meter consumption/SLT breakdown (which
   * uses the amr-consumption-daily/aggregate sources) and show only the
   * Zeus-billed AMR accounts in the Consumption tab. */
  hideConsumptionDetail?: boolean;
  /** When true, skip the meter online/offline health summary and the
   * "Meter status" sub-tab (which use the separate amr-status source). */
  hideMeterStatus?: boolean;
}

function formatKwh(value: number | null | undefined) {
  if (value === null || value === undefined) return "0 kWh";
  return `${(value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} kWh`;
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "0";
  return (value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "₵0.00";
  return `₵${(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: string | null | undefined) {
  if (!date) return "—";
  try {
    return format(parseISO(date.slice(0, 10)), "MMM dd, yyyy");
  } catch {
    return date;
  }
}

const AMR_CHART_METRICS: Record<
  AmrMetricKey,
  {
    label: string;
    format: (value: number | null | undefined) => string;
    tooltipLabel: string;
  }
> = {
  sum_billconsumptionvalue: {
    label: "kWh Consumed",
    format: formatKwh,
    tooltipLabel: "Consumption",
  },
  sum_amountdue: {
    label: "Amount Due",
    format: formatMoney,
    tooltipLabel: "Amount due",
  },
  sum_debtamount: {
    label: "Debt",
    format: formatMoney,
    tooltipLabel: "Debt",
  },
  sum_outstandingamount: {
    label: "Outstanding Balance",
    format: formatMoney,
    tooltipLabel: "Outstanding balance",
  },
  sum_billamount: {
    label: "Bill Amount",
    format: formatMoney,
    tooltipLabel: "Bill amount",
  },
};

// Always renders the customer count alongside the selected metric's value —
// a second axis is never used, so the count is a direct label instead.
function AmrMetricLabel(
  props: {
    data: ZeusBillingAggregateItem[];
    metric: AmrMetricKey;
    format: (value: number | null | undefined) => string;
    horizontal: boolean;
  } & Record<string, unknown>,
) {
  const x = Number(props.x) || 0;
  const y = Number(props.y) || 0;
  const width = Number(props.width) || 0;
  const height = Number(props.height) || 0;
  const index = Number(props.index) || 0;
  const row = props.data[index];
  if (!row) return null;
  const valueText = props.format(row[props.metric]);
  const custText = `${formatNumber(row.customer_count)} cust.`;

  if (props.horizontal) {
    const lx = x + width + 6;
    const cy = y + height / 2;
    return (
      <g>
        <text x={lx} y={cy - 5} textAnchor="start" className="fill-orange-800 text-[10px] font-semibold">
          {valueText}
        </text>
        <text x={lx} y={cy + 8} textAnchor="start" className="fill-purple-700 text-[9px] font-medium">
          {custText}
        </text>
      </g>
    );
  }

  const cx = x + width / 2;
  return (
    <g>
      <text x={cx} y={y - 20} textAnchor="middle" className="fill-orange-800 text-[10px] font-semibold">
        {valueText}
      </text>
      <text x={cx} y={y - 7} textAnchor="middle" className="fill-purple-700 text-[9px] font-medium">
        {custText}
      </text>
    </g>
  );
}

export function AmrPageView({
  dateRange,
  region,
  district,
  embedded = false,
  lockedSltType,
  hideConsumptionDetail = false,
  hideMeterStatus = false,
}: AmrPageViewProps) {
  const [selectedSltType, setSelectedSltType] = useState<string | null>(
    lockedSltType ?? null,
  );
  const [statusFilter, setStatusFilter] = useState<"all" | "ONLINE" | "OFFLINE">(
    "all",
  );
  const [statusSearch, setStatusSearch] = useState("");
  const [statusPage, setStatusPage] = useState(1);
  const statusPageSize = 50;

  const effectiveSltType = lockedSltType ?? selectedSltType;

  const statusParams = {
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    region,
    district,
    sltType: effectiveSltType || undefined,
    enabled: !hideMeterStatus,
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

  // Zeus AMR aggregate — powers the combined chart above the Customer
  // Records table when the daily/status AMR sources are hidden (postpaid
  // hub context).
  const [amrMetric, setAmrMetric] = useState<AmrMetricKey>(
    "sum_billconsumptionvalue",
  );
  const [amrOrientation, setAmrOrientation] = useState<"columns" | "bars">(
    "columns",
  );
  const [amrFilterDistrict, setAmrFilterDistrict] = useState(
    district?.trim() || ALL,
  );
  const [amrFilterAccountType, setAmrFilterAccountType] = useState(ALL);
  const [amrFilterBillStatus, setAmrFilterBillStatus] = useState(ALL);

  // Re-derive the local district filter when the parent's district scope
  // changes, without an effect (React's "adjust state during render"
  // pattern) — an effect here would cause an extra render pass.
  const [amrPrevDistrictProp, setAmrPrevDistrictProp] = useState(district);
  if (district !== amrPrevDistrictProp) {
    setAmrPrevDistrictProp(district);
    setAmrFilterDistrict(district?.trim() || ALL);
  }

  const amrEffectiveDistrict =
    amrFilterDistrict === ALL ? undefined : amrFilterDistrict;
  const amrEffectiveAccountType =
    amrFilterAccountType === ALL ? undefined : amrFilterAccountType;
  const amrEffectiveBillStatus =
    amrFilterBillStatus === ALL ? undefined : amrFilterBillStatus;

  const { data: amrDistrictOptionsData } = useZeusBillingAggregate({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    region,
    meterModelType: "AMR",
    groupBy: "districtname",
    enabled: hideConsumptionDetail,
  });
  const { data: amrAccountTypeOptionsData } = useZeusBillingAggregate({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    region,
    district: amrEffectiveDistrict,
    meterModelType: "AMR",
    groupBy: "accounttype",
    enabled: hideConsumptionDetail,
  });
  const { data: amrBillStatusOptionsData } = useZeusBillingAggregate({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    region,
    district: amrEffectiveDistrict,
    accountType: amrEffectiveAccountType,
    meterModelType: "AMR",
    groupBy: "billstatus",
    enabled: hideConsumptionDetail,
  });

  const amrDistrictOptions = useMemo(
    () =>
      uniqueSorted((amrDistrictOptionsData || []).map((r) => r.districtname)),
    [amrDistrictOptionsData],
  );
  const amrAccountTypeOptions = useMemo(
    () =>
      uniqueSorted(
        (amrAccountTypeOptionsData || []).map((r) => r.accounttype),
      ),
    [amrAccountTypeOptionsData],
  );
  const amrBillStatusOptions = useMemo(
    () =>
      uniqueSorted((amrBillStatusOptionsData || []).map((r) => r.billstatus)),
    [amrBillStatusOptionsData],
  );

  const { data: zeusAmrRegionData, isLoading: zeusAmrChartsLoading } =
    useZeusBillingAggregate({
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
      region,
      district: amrEffectiveDistrict,
      accountType: amrEffectiveAccountType,
      billStatus: amrEffectiveBillStatus,
      groupBy: "regionname",
      meterModelType: "AMR",
      enabled: hideConsumptionDetail,
    });

  const zeusAmrByRegion = useMemo(
    () =>
      [...(zeusAmrRegionData || [])]
        .sort((a, b) => (Number(b[amrMetric]) || 0) - (Number(a[amrMetric]) || 0))
        .slice(0, 12),
    [zeusAmrRegionData, amrMetric],
  );

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
      {!embedded && (
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Radio className="h-7 w-7 text-orange-600" />
            AMR Meters
          </h2>
          <p className="text-muted-foreground mt-1">
            Online/offline health, SLT breakdown, and daily consumption for AMR
            customer meters
          {effectiveSltType ? (
              <span className="text-orange-700">
                {" "}
                · filtered by {effectiveSltType.replace(/_/g, " ")}
              </span>
            ) : null}
          </p>
        </div>
      )}

      {embedded && effectiveSltType && !lockedSltType ? (
        <p className="text-sm text-orange-700">
          Filtered by {effectiveSltType.replace(/_/g, " ")}
        </p>
      ) : null}

      {/* Meter health */}
      {!hideMeterStatus && (
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
      )}

      {(() => {
        const consumptionContent = (
          <>
            {!hideConsumptionDetail && (
              <AmrCustomerSalesDetail
                dateRange={dateRange}
                region={region}
                district={district}
                selectedSltType={effectiveSltType}
                onSelectedSltTypeChange={
                  lockedSltType ? undefined : setSelectedSltType
                }
                hideSltCards={Boolean(lockedSltType)}
                linkSltTypes={!lockedSltType}
              />
            )}

            {hideConsumptionDetail && (
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">
                        AMR Aggregate by Region
                      </CardTitle>
                      <CardDescription>
                        Zeus AMR — {AMR_CHART_METRICS[amrMetric].label.toLowerCase()}{" "}
                        by region · customer count always shown
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setAmrOrientation((o) =>
                          o === "columns" ? "bars" : "columns",
                        )
                      }
                      className="gap-1.5 shrink-0"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                      Flip
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                    <Select
                      value={amrMetric}
                      onValueChange={(v) => setAmrMetric(v as AmrMetricKey)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Metric" />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(AMR_CHART_METRICS) as AmrMetricKey[]).map(
                          (key) => (
                            <SelectItem key={key} value={key}>
                              {AMR_CHART_METRICS[key].label}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>

                    <Select
                      value={amrFilterDistrict}
                      onValueChange={(v) => {
                        setAmrFilterDistrict(v);
                        setAmrFilterAccountType(ALL);
                        setAmrFilterBillStatus(ALL);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="District" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>All districts</SelectItem>
                        {amrDistrictOptions.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={amrFilterAccountType}
                      onValueChange={(v) => {
                        setAmrFilterAccountType(v);
                        setAmrFilterBillStatus(ALL);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Account type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>All account types</SelectItem>
                        {amrAccountTypeOptions.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={amrFilterBillStatus}
                      onValueChange={setAmrFilterBillStatus}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Bill status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>All bill statuses</SelectItem>
                        {amrBillStatusOptions.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {zeusAmrChartsLoading ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : zeusAmrByRegion.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-16 text-center">
                      No data for the selected filters.
                    </p>
                  ) : (
                    <ResponsiveContainer
                      width="100%"
                      height={
                        amrOrientation === "bars"
                          ? Math.max(240, zeusAmrByRegion.length * 44)
                          : 300
                      }
                    >
                      <BarChart
                        data={zeusAmrByRegion}
                        layout={amrOrientation === "bars" ? "vertical" : "horizontal"}
                        margin={
                          amrOrientation === "bars"
                            ? { top: 8, right: 130, left: 8, bottom: 8 }
                            : { top: 40, right: 16, left: 8, bottom: 60 }
                        }
                      >
                        {amrOrientation === "bars" ? (
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        ) : (
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        )}
                        {amrOrientation === "bars" ? (
                          <XAxis
                            type="number"
                            tickFormatter={formatAxisNumber}
                            tick={{ fontSize: 10 }}
                          />
                        ) : (
                          <XAxis
                            dataKey="regionname"
                            angle={-35}
                            textAnchor="end"
                            tick={{ fontSize: 10 }}
                            interval={0}
                          />
                        )}
                        {amrOrientation === "bars" ? (
                          <YAxis
                            type="category"
                            dataKey="regionname"
                            tick={{ fontSize: 11 }}
                            width={110}
                          />
                        ) : (
                          <YAxis
                            tickFormatter={formatAxisNumber}
                            tick={{ fontSize: 10 }}
                          />
                        )}
                        <Tooltip
                          formatter={(v: number) => [
                            AMR_CHART_METRICS[amrMetric].format(v),
                            AMR_CHART_METRICS[amrMetric].tooltipLabel,
                          ]}
                        />
                        <Bar
                          dataKey={amrMetric}
                          radius={
                            amrOrientation === "bars"
                              ? [0, 4, 4, 0]
                              : [4, 4, 0, 0]
                          }
                        >
                          <LabelList
                            content={(p) => (
                              <AmrMetricLabel
                                {...p}
                                data={zeusAmrByRegion}
                                metric={amrMetric}
                                format={AMR_CHART_METRICS[amrMetric].format}
                                horizontal={amrOrientation === "bars"}
                              />
                            )}
                          />
                          {zeusAmrByRegion.map((row, i) => (
                            <Cell
                              key={row.regionname}
                              fill={AMR_CHART_COLORS[i % AMR_CHART_COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Zeus billing accounts tagged meterModelType=AMR — a distinct
                lineage from the daily AMR meter readings above (same "AMR"
                label, different pipeline), surfaced here rather than under
                the Postpaid/Prepaid Zeus tabs since it belongs with AMR. */}
            <CustomerSalesDetail
              dateRange={dateRange}
              region={region}
              district={district}
              serviceType="AMR"
            />
          </>
        );

        if (hideMeterStatus) {
          return <div className="space-y-4">{consumptionContent}</div>;
        }

        return (
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
              {consumptionContent}
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
                    {effectiveSltType
                      ? ` · ${effectiveSltType.replace(/_/g, " ")}`
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
        );
      })()}
    </div>
  );
}
