"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAmrConsumptionDaily } from "@/hooks/api/use-amr-consumption-daily-api";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

interface DateRange {
  start: string;
  end: string;
}

interface AmrCustomerSalesDetailProps {
  dateRange: DateRange;
  region?: string;
  district?: string;
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

export function AmrCustomerSalesDetail({
  dateRange,
  region,
  district,
}: AmrCustomerSalesDetailProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [systemFilter, setSystemFilter] = useState<
    "all" | "import_kwh" | "export_kwh"
  >("all");
  const [page, setPage] = useState(1);
  const pageSize = 100;

  const { data: detailData, isLoading } = useAmrConsumptionDaily({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    region,
    district,
    systemName: systemFilter === "all" ? undefined : systemFilter,
    page,
    limit: pageSize,
  });

  const rawRecords = detailData || [];

  // Filter by search term
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return rawRecords;
    const term = searchTerm.toLowerCase();
    return rawRecords.filter(
      (r: any) =>
        (r.meter_number || "").toLowerCase().includes(term) ||
        (r.customer_name || "").toLowerCase().includes(term) ||
        (r.account_no || "").toLowerCase().includes(term) ||
        (r.district || "").toLowerCase().includes(term),
    );
  }, [rawRecords, searchTerm]);

  const totalRecords = filteredRecords.length;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>AMR Customer Records — Daily</CardTitle>
            <CardDescription>
              Individual meter daily readings — import and export consumption
            </CardDescription>
          </div>
          <Badge variant="secondary" className="ml-auto">
            {totalRecords} meters
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-64 relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground -translate-y-1/2" />
            <Input
              placeholder="Search by name, meter, account, district..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Select
            value={systemFilter}
            onValueChange={(val: any) => {
              setSystemFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="System type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Systems</SelectItem>
              <SelectItem value="import_kwh">
                Import (Grid Consumption)
              </SelectItem>
              <SelectItem value="export_kwh">Export (Generation)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No records found for the selected filters</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead>
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
                      System
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      Tariff
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-orange-700">
                      Consumed (kWh)
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record: any, idx: number) => {
                    const isExport = record.system_name === "export_kwh";
                    return (
                      <tr
                        key={idx}
                        className="border-b last:border-0 hover:bg-muted/50"
                      >
                        <td className="py-3 px-4 font-medium truncate">
                          {record.customer_name || "—"}
                        </td>
                        <td className="text-right py-3 px-4 font-mono text-xs">
                          {record.meter_number || "—"}
                        </td>
                        <td className="text-right py-3 px-4 font-mono text-xs">
                          {record.account_no || "—"}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {record.region || "—"}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {record.district || "—"}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <Badge
                            variant="outline"
                            className={
                              isExport
                                ? "border-purple-300 text-purple-700"
                                : "border-orange-300 text-orange-700"
                            }
                          >
                            {isExport ? "Export" : "Import"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {record.tariff_class || "—"}
                        </td>
                        <td
                          className={`text-right py-3 px-4 font-semibold tabular-nums text-sm ${isExport ? "text-purple-700" : "text-orange-700"}`}
                        >
                          {formatKwhRaw(record.consumed_energy)}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground whitespace-nowrap text-xs">
                          {formatDate(record.consumption_date)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
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
  );
}
