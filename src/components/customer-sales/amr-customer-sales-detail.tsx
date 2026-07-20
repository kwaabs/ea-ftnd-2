"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAmrConsumptionDaily } from "@/hooks/api/use-amr-consumption-daily-api";
import { useAmrConsumptionAggregate } from "@/hooks/api/use-amr-consumption-aggregate-api";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { ExportButton } from "@/components/ui/export-button";
import { cn } from "@/lib/utils";

interface DateRange {
  start: string;
  end: string;
}

interface AmrCustomerSalesDetailProps {
  dateRange: DateRange;
  region?: string;
  district?: string;
  /** Controlled SLT filter — when provided with onSelectedSltTypeChange */
  selectedSltType?: string | null;
  onSelectedSltTypeChange?: (value: string | null) => void;
  /** Hide the SLT card strip (e.g. when parent page renders its own) */
  hideSltCards?: boolean;
}

const formatKwhRaw = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "0 kWh";
  return `${(value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} kWh`;
};

const formatNumber = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "0";
  return (value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
};

const formatDate = (date: string | null | undefined) => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

function formatSltLabel(raw: string | null | undefined) {
  if (!raw || !raw.trim()) return "Unknown";
  return raw.replace(/_/g, " ");
}

export function AmrCustomerSalesDetail({
  dateRange,
  region,
  district,
  selectedSltType: controlledSltType,
  onSelectedSltTypeChange,
  hideSltCards = false,
}: AmrCustomerSalesDetailProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [internalSltType, setInternalSltType] = useState<string | null>(null);
  const pageSize = 100;

  const isSltControlled = onSelectedSltTypeChange !== undefined;
  const selectedSltType = isSltControlled
    ? (controlledSltType ?? null)
    : internalSltType;

  const setSelectedSltType = (value: string | null) => {
    if (isSltControlled) {
      onSelectedSltTypeChange?.(value);
    } else {
      setInternalSltType(value);
    }
  };

  const { data: sltAggregate, isLoading: sltAggLoading } =
    useAmrConsumptionAggregate({
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
      region,
      group: "slt_type",
    });

  const { data: detailData, isLoading } = useAmrConsumptionDaily({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    region,
    district,
    sltType: selectedSltType || undefined,
    systemName: "import_kwh",
    page,
    limit: pageSize,
  });

  const sltCards = useMemo(() => {
    // Aggregate kWh across all rows; for meters take max per (slt_type, region)
    // then sum regions so day-level duplicates don't inflate counts.
    const kwhByType = new Map<string, number>();
    const metersByTypeRegion = new Map<string, number>();

    for (const row of sltAggregate || []) {
      if (row.system_name && row.system_name !== "import_kwh") continue;
      const rawType =
        row.slt_type ?? (row as { sltType?: string }).sltType ?? "";
      const typeKey = String(rawType).trim() || "__unknown__";
      kwhByType.set(
        typeKey,
        (kwhByType.get(typeKey) || 0) + (row.total_consumption || 0),
      );

      const regionKey = (row.region || "").trim() || "__noregion__";
      const trKey = `${typeKey}::${regionKey}`;
      metersByTypeRegion.set(
        trKey,
        Math.max(metersByTypeRegion.get(trKey) || 0, row.active_meters || 0),
      );
    }

    const metersByType = new Map<string, number>();
    for (const [trKey, meters] of metersByTypeRegion) {
      const typeKey = trKey.split("::")[0];
      metersByType.set(typeKey, (metersByType.get(typeKey) || 0) + meters);
    }

    return Array.from(kwhByType.entries())
      .map(([typeKey, kwh]) => ({
        sltType: typeKey === "__unknown__" ? "" : typeKey,
        kwh,
        meters: metersByType.get(typeKey) || 0,
      }))
      .sort((a, b) => b.kwh - a.kwh);
  }, [sltAggregate]);

  const allSltTotals = useMemo(() => {
    return sltCards.reduce(
      (acc, c) => ({
        kwh: acc.kwh + c.kwh,
        meters: acc.meters + c.meters,
      }),
      { kwh: 0, meters: 0 },
    );
  }, [sltCards]);

  const rawRecords = detailData?.data || [];

  // Search filters within the current page only — the search box doesn't
  // re-query the server, so results outside this page won't show up.
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return rawRecords;
    const term = searchTerm.toLowerCase();
    return rawRecords.filter(
      (r: any) =>
        (r.meter_number || "").toLowerCase().includes(term) ||
        (r.customer_name || "").toLowerCase().includes(term) ||
        (r.account_no || "").toLowerCase().includes(term) ||
        (r.district || "").toLowerCase().includes(term) ||
        (r.slt_type || "").toLowerCase().includes(term),
    );
  }, [rawRecords, searchTerm]);

  // Pivot: each raw record is one (meter, date, system_name) row — merge the
  // import_kwh and export_kwh rows for the same meter/date into a single row
  // with both columns side by side, instead of one row per system_name.
  const pivotedRecords = useMemo(() => {
    const groups = new Map<string, any>();
    for (const r of filteredRecords as any[]) {
      const key = `${r.meter_number || ""}__${r.account_no || ""}__${r.consumption_date || ""}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          key,
          customer_name: r.customer_name,
          meter_number: r.meter_number,
          account_no: r.account_no,
          region: r.region,
          district: r.district,
          tariff_class: r.tariff_class,
          slt_type: r.slt_type,
          consumption_date: r.consumption_date,
          import_kwh: null as number | null,
          export_kwh: null as number | null,
        };
        groups.set(key, group);
      }
      if (r.system_name === "export_kwh") {
        group.export_kwh = r.consumed_energy;
      } else {
        group.import_kwh = r.consumed_energy;
      }
    }
    return Array.from(groups.values());
  }, [filteredRecords]);

  const totalRecords = detailData?.total ?? filteredRecords.length;
  const totalPages = detailData?.total_pages ?? 1;

  const selectSlt = (value: string | null) => {
    setSelectedSltType(selectedSltType === value ? null : value);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {!hideSltCards && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-muted-foreground">
              AMR by SLT type
            </p>
            {selectedSltType && (
              <button
                type="button"
                onClick={() => selectSlt(null)}
                className="text-xs text-primary hover:underline"
              >
                Clear filter
              </button>
            )}
          </div>
          {sltAggLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => selectSlt(null)}
                className={cn(
                  "text-left rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40",
                  selectedSltType === null &&
                    "border-orange-500 ring-1 ring-orange-500/40",
                )}
              >
                <p className="text-xs font-medium text-muted-foreground">
                  All types
                </p>
                <p className="text-lg font-bold tabular-nums text-orange-700 mt-1">
                  {formatKwhRaw(allSltTotals.kwh)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatNumber(allSltTotals.meters)} meters
                </p>
              </button>
              {sltCards.map((card) => {
                const value = card.sltType || "";
                const selected = selectedSltType === value;
                return (
                  <button
                    key={card.sltType || "__unknown__"}
                    type="button"
                    onClick={() => selectSlt(value)}
                    className={cn(
                      "text-left rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40",
                      selected && "border-orange-500 ring-1 ring-orange-500/40",
                    )}
                  >
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      {formatSltLabel(card.sltType)}
                    </p>
                    <p className="text-lg font-bold tabular-nums text-orange-700 mt-1">
                      {formatKwhRaw(card.kwh)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatNumber(card.meters)} meters
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>AMR Customer Records — Daily</CardTitle>
              <CardDescription>
                Individual meter daily readings — import consumption
                {selectedSltType
                  ? ` · filtered by ${formatSltLabel(selectedSltType)}`
                  : ""}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <ExportButton
                data={pivotedRecords.map((r: any) => ({
                  customer_name: r.customer_name,
                  meter_number: r.meter_number,
                  account_no: r.account_no,
                  region: r.region,
                  district: r.district,
                  tariff_class: r.tariff_class,
                  slt_type: r.slt_type,
                  consumption_date: r.consumption_date,
                  import_kwh: r.import_kwh,
                  export_kwh: r.export_kwh,
                }))}
                filename={`${(region || "all").replace(/\s+/g, "-").toLowerCase()}-amr-customer-sales`}
              />
              <Badge variant="secondary">
                {totalRecords} daily reading{totalRecords === 1 ? "" : "s"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-64 relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground -translate-y-1/2" />
              <Input
                placeholder="Search by name, meter, account, district, SLT type..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
          </div>

          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : pivotedRecords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No records found for the selected filters</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto overflow-y-auto max-h-[600px] border rounded-lg">
                <table className="w-full text-sm table-fixed">
                  <colgroup>
                    <col className="w-[16%]" />
                    <col className="w-[11%]" />
                    <col className="w-[11%]" />
                    <col className="w-[11%]" />
                    <col className="w-[10%]" />
                    <col className="w-[14%]" />
                    <col className="w-[9%]" />
                    <col className="w-[11%]" />
                    <col className="w-[7%]" />
                  </colgroup>
                  <thead className="sticky top-0 z-10 bg-background">
                    <tr className="border-b bg-muted/40">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        Customer
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        Meter No.
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        Account
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        Region
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        District
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        Tariff
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        SLT Type
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-orange-700">
                        Consumption (kWh)
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pivotedRecords.map((record: any) => (
                      <tr
                        key={record.key}
                        className="border-b last:border-0 hover:bg-muted/50"
                      >
                        <td className="text-left py-3 px-4 font-medium truncate">
                          {record.customer_name || "—"}
                        </td>
                        <td className="text-left py-3 px-4 font-mono text-xs truncate">
                          {record.meter_number ? (
                            <Link
                              href={`/amr/${encodeURIComponent(record.meter_number)}`}
                              className="text-orange-700 hover:underline"
                            >
                              {record.meter_number}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="text-left py-3 px-4 font-mono text-xs truncate">
                          {record.account_no || "—"}
                        </td>
                        <td className="text-left py-3 px-4 text-xs truncate">
                          {record.region || "—"}
                        </td>
                        <td className="text-left py-3 px-4 text-xs truncate">
                          {record.district || "—"}
                        </td>
                        <td className="text-left py-3 px-4 text-xs truncate">
                          {record.tariff_class || "—"}
                        </td>
                        <td className="text-left py-3 px-4 text-xs truncate">
                          {formatSltLabel(record.slt_type)}
                        </td>
                        <td className="text-right py-3 px-4 font-semibold tabular-nums text-sm text-orange-700">
                          {record.import_kwh === null
                            ? "—"
                            : formatKwhRaw(record.import_kwh)}
                        </td>
                        <td className="text-left py-3 px-4 text-muted-foreground whitespace-nowrap text-xs">
                          {formatDate(record.consumption_date)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Showing {Math.min((page - 1) * pageSize + 1, totalRecords)}–
                  {Math.min(page * pageSize, totalRecords)} of {totalRecords}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="p-1 hover:bg-muted rounded disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    className="p-1 hover:bg-muted rounded disabled:opacity-50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
