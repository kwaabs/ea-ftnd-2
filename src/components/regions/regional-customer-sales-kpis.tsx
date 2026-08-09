"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useZeusBillingAggregate } from "@/hooks/api/use-zeus-billing-aggregate-api"
import { Zap, Users, TrendingUp, DollarSign, Scale } from "lucide-react"

interface RegionalCustomerSalesKpisProps {
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

export function RegionalCustomerSalesKpis({ region, dateRange }: RegionalCustomerSalesKpisProps) {
  const { data: aggregateData } = useZeusBillingAggregate({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    region,
  })

  const metrics = useMemo(() => {
    let totalKwh = 0
    let totalBilling = 0
    let totalDebt = 0
    let totalCustomers = 0

    if (aggregateData && Array.isArray(aggregateData)) {
      aggregateData.forEach((item: any) => {
        totalKwh += item.sum_billconsumptionvalue || 0
        totalBilling += item.sum_billamount || 0
        totalDebt += item.sum_debtamount || 0
        totalCustomers += item.customer_count || 0
      })
    }

    return { totalKwh, totalBilling, totalDebt, totalCustomers }
  }, [aggregateData])

  const avgKwhPerCustomer = metrics.totalCustomers > 0 ? metrics.totalKwh / metrics.totalCustomers : 0

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {/* Total Consumption */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-600" />
            Total Consumption
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{formatNumber(metrics.totalKwh)}</div>
          <div className="h-px bg-border my-2"></div>
          <p className="text-xs text-muted-foreground">kWh billed</p>
        </CardContent>
      </Card>

      {/* Total Billing */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            Total Billing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">₵{formatNumber(metrics.totalBilling, 2)}</div>
          <div className="h-px bg-border my-2"></div>
          <p className="text-xs text-muted-foreground">Amount billed</p>
        </CardContent>
      </Card>

      {/* Customer Count */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-600" />
            Customers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-600">{formatNumber(metrics.totalCustomers)}</div>
          <div className="h-px bg-border my-2"></div>
          <p className="text-xs text-muted-foreground">Active customers</p>
        </CardContent>
      </Card>

      {/* Avg Consumption per Customer */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-amber-600" />
            Avg Consumption
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">{formatNumber(avgKwhPerCustomer, 1)}</div>
          <div className="h-px bg-border my-2"></div>
          <p className="text-xs text-muted-foreground">kWh per customer</p>
        </CardContent>
      </Card>

      {/* Debt */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Scale className="h-4 w-4 text-sky-600" />
            Debt
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-sky-600">₵{formatNumber(metrics.totalDebt, 2)}</div>
          <div className="h-px bg-border my-2"></div>
          <p className="text-xs text-muted-foreground">Outstanding debt</p>
        </CardContent>
      </Card>
    </div>
  )
}
