"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO, subDays } from "date-fns";
import {
  Activity,
  ArrowLeft,
  Building2,
  Calendar,
  MapPin,
  Radio,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import { Skeleton } from "@/components/ui/skeleton";
import { useAmrMeter } from "@/hooks/api/use-amr-meter-api";
import { useAmrConsumptionDaily } from "@/hooks/api/use-amr-consumption-daily-api";
import {
  useAmrStatusDetails,
  useAmrStatusTimeline,
} from "@/hooks/api/use-amr-status-api";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

interface AmrMeterDetailViewProps {
  meterNumber: string;
}

function formatKwh(value: number | null | undefined) {
  if (value === null || value === undefined) return "0 kWh";
  return `${(value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} kWh`;
}

function formatDate(date: string | null | undefined) {
  if (!date) return "—";
  try {
    return format(parseISO(String(date).slice(0, 10)), "MMM dd, yyyy");
  } catch {
    return date;
  }
}

function formatSltLabel(raw: string | null | undefined) {
  if (!raw?.trim()) return "—";
  return raw.replace(/_/g, " ");
}

export function AmrMeterDetailView({ meterNumber }: AmrMeterDetailViewProps) {
  const router = useRouter();
  const { filters } = useAppStore();

  const dateRange = useMemo(() => {
    const formatDateStr = (
      date: Date | string | undefined,
      fallback: Date,
    ): string => {
      if (!date) return fallback.toISOString().split("T")[0];
      if (date instanceof Date) return date.toISOString().split("T")[0];
      return typeof date === "string" && date.includes("T")
        ? date.split("T")[0]
        : (date as string);
    };
    const defaultEnd = new Date();
    const defaultStart = subDays(defaultEnd, 30);
    return {
      start: formatDateStr(filters.dateRange?.start, defaultStart),
      end: formatDateStr(filters.dateRange?.end, defaultEnd),
    };
  }, [filters.dateRange]);

  const { data: records = [], isLoading: meterLoading, isError } =
    useAmrMeter(meterNumber);

  const primary = records[0];

  const { data: dailyData, isLoading: dailyLoading } = useAmrConsumptionDaily({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    meterNumber,
    systemName: "import_kwh",
    page: 1,
    limit: 500,
  });

  const { data: exportData } = useAmrConsumptionDaily({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    meterNumber,
    systemName: "export_kwh",
    page: 1,
    limit: 500,
  });

  const { data: statusDetails, isLoading: statusLoading } = useAmrStatusDetails({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    meterNumber,
    search: meterNumber,
    page: 1,
    limit: 1,
    enabled: Boolean(meterNumber),
  });

  const { data: statusTimeline } = useAmrStatusTimeline({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    meterNumber,
    enabled: Boolean(meterNumber),
  });

  const status = statusDetails?.data?.[0];

  const chartData = useMemo(() => {
    const byDate = new Map<
      string,
      { date: string; import_kwh: number; export_kwh: number }
    >();

    for (const row of dailyData?.data || []) {
      const date = String(row.consumption_date).slice(0, 10);
      const existing = byDate.get(date) || {
        date,
        import_kwh: 0,
        export_kwh: 0,
      };
      existing.import_kwh += row.consumed_energy || 0;
      byDate.set(date, existing);
    }

    for (const row of exportData?.data || []) {
      const date = String(row.consumption_date).slice(0, 10);
      const existing = byDate.get(date) || {
        date,
        import_kwh: 0,
        export_kwh: 0,
      };
      existing.export_kwh += row.consumed_energy || 0;
      byDate.set(date, existing);
    }

    return Array.from(byDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }, [dailyData, exportData]);

  const stats = useMemo(() => {
    const totalImport = chartData.reduce((s, d) => s + d.import_kwh, 0);
    const totalExport = chartData.reduce((s, d) => s + d.export_kwh, 0);
    const dayCount = chartData.length || 1;
    return {
      totalImport,
      totalExport,
      avgDaily: totalImport / dayCount,
      dayCount: chartData.length,
    };
  }, [chartData]);

  const timelineData = useMemo(
    () =>
      (statusTimeline || []).map((d) => ({
        date: d.date,
        online: d.online,
        offline: d.offline,
      })),
    [statusTimeline],
  );

  if (meterLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !primary) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/amr")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to AMR
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            AMR meter <span className="font-mono">{meterNumber}</span> was not
            found.
          </CardContent>
        </Card>
      </div>
    );
  }

  const isOnline = (status?.status || "").toUpperCase() === "ONLINE";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            onClick={() => router.push("/amr")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to AMR
          </Button>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Radio className="h-6 w-6 text-orange-600" />
              <span className="font-mono">{meterNumber}</span>
            </h2>
            {status && (
              <Badge
                variant="outline"
                className={cn(
                  isOnline
                    ? "border-green-300 text-green-700 bg-green-50"
                    : "border-red-300 text-red-700 bg-red-50",
                )}
              >
                {status.status}
              </Badge>
            )}
            {primary.slt_type && (
              <Badge
                variant="outline"
                className="border-orange-300 text-orange-800 bg-orange-50"
              >
                {formatSltLabel(primary.slt_type)}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            {primary.customer_name || "AMR customer meter"}
            {primary.account_no ? ` · Account ${primary.account_no}` : ""}
          </p>
        </div>
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          {dateRange.start} — {dateRange.end}
        </div>
      </div>

      {/* Identity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Meter details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Region</p>
              <p className="font-medium flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                {primary.region || "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">District</p>
              <p className="font-medium">{primary.district || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Community</p>
              <p className="font-medium truncate">{primary.community || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Tariff</p>
              <p className="font-medium">{primary.tariff_class || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">
                Contract status
              </p>
              <p className="font-medium">{primary.contract_status || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Service type</p>
              <p className="font-medium">{primary.service_type || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Meter phase</p>
              <p className="font-medium">{primary.meter_phase || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">SPN</p>
              <p className="font-medium font-mono text-xs">
                {primary.spn || "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Zap className="h-3.5 w-3.5" /> Import
            </p>
            <p className="text-2xl font-bold text-orange-700 tabular-nums">
              {formatKwh(stats.totalImport)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Avg daily</p>
            <p className="text-2xl font-bold tabular-nums">
              {formatKwh(stats.avgDaily)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Activity className="h-3.5 w-3.5" /> Uptime
            </p>
            <p className="text-2xl font-bold text-blue-600 tabular-nums">
              {statusLoading
                ? "—"
                : `${(status?.uptime_percentage || 0).toFixed(1)}%`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Days offline</p>
            <p className="text-2xl font-bold text-red-600 tabular-nums">
              {statusLoading ? "—" : status?.days_offline ?? 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Last reading:{" "}
              {formatDate(
                status?.last_consumption_date || status?.last_reading_time,
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Consumption chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily consumption</CardTitle>
          <CardDescription>
            Import kWh over the selected period
            {stats.dayCount > 0 ? ` · ${stats.dayCount} days with data` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dailyLoading ? (
            <Skeleton className="h-[240px] w-full" />
          ) : chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No consumption data for this period.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
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
                    const row = payload[0]?.payload;
                    return (
                      <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
                        <p className="font-medium mb-1">
                          {formatDate(row?.date)}
                        </p>
                        <p className="text-orange-700">
                          Import: {formatKwh(row?.import_kwh)}
                        </p>
                        {(row?.export_kwh || 0) > 0 && (
                          <p className="text-blue-700">
                            Export: {formatKwh(row?.export_kwh)}
                          </p>
                        )}
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="import_kwh"
                  fill="hsl(24, 95%, 45%)"
                  name="Import"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Status timeline */}
      {timelineData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Status timeline</CardTitle>
            <CardDescription>
              Online vs offline for this meter over the period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  tickFormatter={(val) =>
                    format(parseISO(String(val).slice(0, 10)), "MMM dd")
                  }
                />
                <YAxis className="text-xs" allowDecimals={false} />
                <Tooltip />
                <Bar
                  dataKey="online"
                  stackId="s"
                  fill="hsl(142, 76%, 36%)"
                  name="Online"
                />
                <Bar
                  dataKey="offline"
                  stackId="s"
                  fill="hsl(0, 84%, 60%)"
                  name="Offline"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Daily readings table */}
      <Card>
        <CardHeader>
          <CardTitle>Daily readings</CardTitle>
          <CardDescription>Import readings for this meter</CardDescription>
        </CardHeader>
        <CardContent>
          {dailyLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (dailyData?.data || []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No daily readings in this period.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/50">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium text-right">
                      Start reading
                    </th>
                    <th className="px-3 py-2 font-medium text-right">
                      End reading
                    </th>
                    <th className="px-3 py-2 font-medium text-right text-orange-700">
                      Consumption
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...(dailyData?.data || [])]
                    .sort((a, b) =>
                      String(b.consumption_date).localeCompare(
                        String(a.consumption_date),
                      ),
                    )
                    .map((row) => (
                      <tr
                        key={`${row.consumption_date}-${row.system_name}`}
                        className="border-t"
                      >
                        <td className="px-3 py-2 whitespace-nowrap">
                          {formatDate(row.consumption_date)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-mono text-xs">
                          {(row.day_start_reading || 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-mono text-xs">
                          {(row.day_end_reading || 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-orange-700">
                          {formatKwh(row.consumed_energy)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Accounts on this meter */}
      {records.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Accounts on this meter</CardTitle>
            <CardDescription>
              {records.length} customer record
              {records.length === 1 ? "" : "s"} linked to meter {meterNumber}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Customer</th>
                    <th className="px-3 py-2 font-medium">Account</th>
                    <th className="px-3 py-2 font-medium">SPN</th>
                    <th className="px-3 py-2 font-medium">Tariff</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">SLT type</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec) => (
                    <tr key={rec.id} className="border-t">
                      <td className="px-3 py-2">{rec.customer_name || "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {rec.account_no || "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {rec.spn || "—"}
                      </td>
                      <td className="px-3 py-2">{rec.tariff_class || "—"}</td>
                      <td className="px-3 py-2">
                        {rec.contract_status || "—"}
                      </td>
                      <td className="px-3 py-2">
                        {formatSltLabel(rec.slt_type)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              <Link href="/amr" className="text-primary hover:underline">
                ← All AMR meters
              </Link>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
