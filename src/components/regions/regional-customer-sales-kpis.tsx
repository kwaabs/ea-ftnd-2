"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useCustomerConsumptionAggregate } from "@/hooks/api/use-customer-consumption-aggregate-api"
import { Zap, Users, TrendingUp, DollarSign } from "lucide-react"

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
  const { data: aggregateData } = useCustomerConsumptionAggregate({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    region,
  })

  const metrics = useMemo(() => {
    const bySrc = new Map<string, { kwh: number; billing: number; customerCount: number }>()
    let totalKwh = 0
    let totalBilling = 0
    let totalCustomers = 0

    if (aggregateData && Array.isArray(aggregateData)) {
      aggregateData.forEach((item: any) => {
        const src = item.data_src || "Unknown"
        const kwh = item.sum_lastbillconsumption || 0
        const billing = item.sum_lastbillamount || 0
        const customers = item.customer_count || 0

        bySrc.set(src, {
          kwh: (bySrc.get(src)?.kwh || 0) + kwh,
          billing: (bySrc.get(src)?.billing || 0) + billing,
          customerCount: (bySrc.get(src)?.customerCount || 0) + customers,
        })

        totalKwh += kwh
        totalBilling += billing
        totalCustomers += customers
      })
    }

    return { totalKwh, totalBilling, totalCustomers, bySrc }
  }, [aggregateData])

  const avgKwhPerCustomer = metrics.totalCustomers > 0 ? metrics.totalKwh / metrics.totalCustomers : 0

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

      {/* Per-Source Breakdown Cards */}
      {metrics.bySrc.size > 0 && Array.from(metrics.bySrc.entries()).map(([src, data]) => (
        <Card key={src} className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              <span>{src}</span>
              <Badge variant="secondary" className="text-xs">{formatNumber(data.customerCount)} customers</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <div className="text-lg font-bold text-blue-600">{formatNumber(data.kwh)}</div>
              <p className="text-xs text-muted-foreground">kWh</p>
            </div>
            <div className="h-px bg-border"></div>
            <div>
              <div className="text-sm font-semibold text-green-600">₵{formatNumber(data.billing, 2)}</div>
              <p className="text-xs text-muted-foreground">Billed</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
