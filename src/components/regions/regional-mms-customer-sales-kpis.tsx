"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useMmsCustomerSalesAggregate } from "@/hooks/api/use-mms-customer-sales-aggregate-api"
import { Zap, Users, TrendingUp, Wallet } from "lucide-react"

interface RegionalMmsCustomerSalesKpisProps {
  region: string
  dateRange: { start: string; end: string }
}

function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined) return "—"
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function RegionalMmsCustomerSalesKpis({ region, dateRange }: RegionalMmsCustomerSalesKpisProps) {
  // groupBy=region, then filter client-side for this region — matches the
  // pattern already used elsewhere for MMS aggregates in this file.
  const { data: aggregateData } = useMmsCustomerSalesAggregate({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    groupBy: "region",
  })

  const metrics = useMemo(() => {
    const row = aggregateData?.find(
      (item) => (item.region || "").toLowerCase() === region.toLowerCase(),
    )
    return {
      kwhRead: row?.sum_last_month_kwh_read || 0,
      creditPurchased: row?.sum_last_month_credit_read || 0,
      customerCount: row?.customer_count || 0,
      balanceRemaining: row?.sum_credit_balance_remaining || 0,
    }
  }, [aggregateData, region])

  const avgKwhPerCustomer =
    metrics.customerCount > 0 ? metrics.kwhRead / metrics.customerCount : 0

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-600" />
            kWh Read
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{formatNumber(metrics.kwhRead)}</div>
          <div className="h-px bg-border my-2"></div>
          <p className="text-xs text-muted-foreground">Last month</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Wallet className="h-4 w-4 text-green-600" />
            Credit Purchased
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">₵{formatNumber(metrics.creditPurchased, 2)}</div>
          <div className="h-px bg-border my-2"></div>
          <p className="text-xs text-muted-foreground">Last month</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-600" />
            Customers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-600">{formatNumber(metrics.customerCount)}</div>
          <div className="h-px bg-border my-2"></div>
          <p className="text-xs text-muted-foreground">Prepaid meters</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-amber-600" />
            Balance Remaining
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">₵{formatNumber(metrics.balanceRemaining, 2)}</div>
          <div className="h-px bg-border my-2"></div>
          <p className="text-xs text-muted-foreground">
            Avg {formatNumber(avgKwhPerCustomer, 1)} kWh/customer
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
