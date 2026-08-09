"use client"

import { useMemo } from "react"
import Link from "next/link"
import { ArrowLeft, AlertTriangle, Scale, TrendingDown, Users } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useZeusBillingAggregate } from "@/hooks/api/use-zeus-billing-aggregate-api"
import { CustomerSalesDetail } from "@/components/customer-sales/customer-sales-detail"
import { DebtChart } from "@/components/customer-sales/debt-chart"
import { useAppStore } from "@/stores/app-store"

function formatDateToString(
  date: Date | string | undefined,
  fallback: string,
): string {
  if (!date) return fallback
  if (date instanceof Date) return date.toISOString().split("T")[0]
  if (typeof date === "string")
    return date.includes("T") ? date.split("T")[0] : date
  return fallback
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "₵0.00"
  return `₵${(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "0"
  return (value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })
}

export function DebtInsightsView() {
  const { filters: globalFilters } = useAppStore()

  const defaultStart = new Date(new Date().setDate(new Date().getDate() - 30))
    .toISOString()
    .split("T")[0]
  const defaultEnd = new Date().toISOString().split("T")[0]

  const dateRange = {
    start: formatDateToString(globalFilters.dateRange?.start, defaultStart),
    end: formatDateToString(globalFilters.dateRange?.end, defaultEnd),
  }

  const region =
    globalFilters.regions?.length > 0
      ? globalFilters.regions.join(",")
      : undefined
  const district =
    globalFilters.districts?.length > 0
      ? globalFilters.districts.join(",")
      : undefined

  // Ungrouped aggregate — backend returns a single totals row when no
  // groupBy dimension is requested.
  const { data: totalsAgg = [], isLoading: totalsLoading } =
    useZeusBillingAggregate({
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
      region,
      district,
    })

  const stats = useMemo(() => {
    const totalDebt = totalsAgg.reduce((s, r) => s + (r.sum_debtamount || 0), 0)
    const totalDue = totalsAgg.reduce((s, r) => s + (r.sum_amountdue || 0), 0)
    const totalOutstanding = totalsAgg.reduce(
      (s, r) => s + (r.sum_outstandingamount || 0),
      0,
    )
    const totalCustomers = totalsAgg.reduce(
      (s, r) => s + (r.customer_count || 0),
      0,
    )
    return { totalDebt, totalDue, totalOutstanding, totalCustomers }
  }, [totalsAgg])

  const filterSummary = [region, district].filter(Boolean).join(" · ")

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/customer-sales"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Customer Consumption
        </Link>
        <h2 className="text-3xl font-semibold tracking-tight text-foreground mt-2">
          Debt Insights
        </h2>
        <p className="text-muted-foreground mt-1">
          Outstanding customer debt across regions, districts, account
          types, meter model types, tariff classes and service point status
          {filterSummary ? (
            <span className="text-sky-700"> · filtered by {filterSummary}</span>
          ) : null}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Scale className="h-3.5 w-3.5" /> Total debt
            </p>
            {totalsLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <p className="text-2xl font-bold text-sky-700 tabular-nums">
                {formatMoney(stats.totalDebt)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <TrendingDown className="h-3.5 w-3.5" /> Amount due
            </p>
            {totalsLoading ? (
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
              <AlertTriangle className="h-3.5 w-3.5" /> Outstanding
            </p>
            {totalsLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <p className="text-2xl font-bold text-rose-700 tabular-nums">
                {formatMoney(stats.totalOutstanding)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> Customers
            </p>
            {totalsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold tabular-nums">
                {formatNumber(stats.totalCustomers)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <DebtChart dateRange={dateRange} region={region} district={district} />

      <CustomerSalesDetail
        dateRange={dateRange}
        region={region}
        district={district}
        initialSortField="debtAmount"
      />
    </div>
  )
}
