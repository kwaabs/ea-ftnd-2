"use client"

import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { ArrowLeft, Zap, User, MapPin, Building2, Receipt, Wallet, ExternalLink } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useZeusBillingDetail } from "@/hooks/api/use-zeus-billing-detail-api"

function formatKwh(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) return "—"
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " kWh"
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "—"
  return "₵" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

function formatBillingPeriod(month: number | null | undefined, year: number | null | undefined) {
  if (!month || !year) return "—"
  const name = MONTH_NAMES[month - 1]
  return name ? `${name} ${year}` : `${month}/${year}`
}

export function AccountDetailView() {
  const params = useParams()
  const rawParam = params.account_number
  const accountCode = rawParam ? decodeURIComponent(rawParam as string) : undefined
  const searchParams = useSearchParams()
  const dateFrom = searchParams.get("dateFrom") ?? undefined
  const dateTo = searchParams.get("dateTo") ?? undefined

  const { data, isLoading } = useZeusBillingDetail({
    accountCode: accountCode ?? "",
    dateFrom,
    dateTo,
    limit: 200,
    page: 1,
    enabled: !!accountCode,
  })

  const records = data?.data || []
  const customer = records[0]

  const totalKwh = records.reduce((sum, r) => sum + (r.billConsumptionValue || 0), 0)
  const totalBill = records.reduce((sum, r) => sum + (r.billAmount || 0), 0)
  const totalDebt = records.reduce((sum, r) => sum + (r.debtAmount || 0), 0)

  return (
    <div className="space-y-6">
      {/* Back + Title */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/customer-sales">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Customer Sales
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Account: {accountCode}</h2>
          <p className="text-muted-foreground text-sm mt-0.5">All service points associated with this account</p>
        </div>
      </div>

      {/* Account summary cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : customer ? (
        <>
          {/* Customer info */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{customer.customerName || "Unknown Customer"}</CardTitle>
                    <CardDescription>{customer.accountCode}</CardDescription>
                  </div>
                </div>
                <Badge variant={customer.servicePointStatus === "Active" ? "default" : "secondary"}>
                  {customer.servicePointStatus || "Unknown"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Region / District</p>
                    <p className="font-medium">{customer.regionName}</p>
                    <p className="text-muted-foreground">{customer.districtName}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Meter / Account Type</p>
                    <p className="font-medium">{customer.meterModelType || "—"}</p>
                    <p className="text-muted-foreground">{customer.accountType || "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Receipt className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Bill Status</p>
                    <p className="font-medium">{customer.billStatus || "—"}</p>
                    <p className="text-muted-foreground">Tariff: {customer.tariffClassCode || "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Latest Billing Period</p>
                    <p className="font-medium">{formatBillingPeriod(customer.billingMonth, customer.billingYear)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Aggregate KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-2 border-blue-200 bg-blue-50/30">
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground">Service Points</p>
                <p className="text-3xl font-bold text-blue-700 mt-1">{records.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Meters on account</p>
              </CardContent>
            </Card>
            <Card className="border-2 border-blue-200 bg-blue-50/30">
              <CardContent className="pt-5">
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-blue-600" />
                  <p className="text-xs text-muted-foreground">Total Consumption</p>
                </div>
                <p className="text-2xl font-bold text-blue-700 mt-1 tabular-nums">
                  {totalKwh.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">kWh</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground">Total Bill</p>
                <p className="text-2xl font-bold mt-1 tabular-nums">{formatMoney(totalBill)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Across all service points</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground">Total Debt</p>
                <p className={`text-2xl font-bold mt-1 tabular-nums ${totalDebt > 0 ? "text-red-600" : "text-green-600"}`}>
                  {formatMoney(totalDebt)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{totalDebt > 0 ? "Outstanding" : "No debt"}</p>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {/* Meters table */}
      <Card>
        <CardHeader>
          <CardTitle>Service Points / Meters</CardTitle>
          <CardDescription>All meters linked to account {accountCode}, sorted by consumption</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Meter / Service Point</TableHead>
                  <TableHead>District</TableHead>
                  <TableHead>Geocode</TableHead>
                  <TableHead>Tariff</TableHead>
                  <TableHead className="text-right bg-blue-50">
                    <div className="flex items-center justify-end gap-1">
                      <Zap className="h-3.5 w-3.5 text-blue-600" />
                      <span className="text-blue-700">Consumption (kWh)</span>
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Bill</TableHead>
                  <TableHead className="text-right">Debt</TableHead>
                  <TableHead>Billing Period</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(4)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(8)].map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      No service points found for this account
                    </TableCell>
                  </TableRow>
                ) : (
                  [...records]
                    .sort((a, b) => (b.billConsumptionValue || 0) - (a.billConsumptionValue || 0))
                    .map((r, idx) => (
                      <TableRow key={`${r.servicePointCode}-${idx}`} className="hover:bg-muted/40">
                        <TableCell>
                          <Link
                            href={`/customer-sales/service-point/${encodeURIComponent(r.servicePointCode)}${dateFrom ? `?dateFrom=${dateFrom}&dateTo=${dateTo}` : ""}`}
                            className="flex items-center gap-1.5 font-mono text-xs text-primary hover:underline"
                          >
                            {r.servicePointCode}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{r.meterModelType || "—"}</p>
                        </TableCell>
                        <TableCell className="text-sm">{r.districtName || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <p>{r.geoCode || "—"}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-normal">
                            {r.tariffClassCode || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right bg-blue-50/50">
                          <span className="font-bold text-blue-700 tabular-nums text-sm">
                            {r.billConsumptionValue != null
                              ? r.billConsumptionValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                          {formatMoney(r.billAmount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          <span className={r.debtAmount != null && r.debtAmount > 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                            {formatMoney(r.debtAmount)}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatBillingPeriod(r.billingMonth, r.billingYear)}
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
          <Separator className="my-4" />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{records.length} service point{records.length !== 1 ? "s" : ""} on this account</span>
            <span>Total: <strong className="text-blue-700">{formatKwh(totalKwh)}</strong></span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
