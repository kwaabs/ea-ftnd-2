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
import { useCustomerConsumptionDetail } from "@/hooks/api/use-customer-consumption-detail-api"

function formatKwh(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) return "—"
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " kWh"
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "—"
  return "₵" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

export function AccountDetailView() {
  const params = useParams()
  const rawParam = params.account_number
  const accountNumber = rawParam ? decodeURIComponent(rawParam as string) : undefined
  const searchParams = useSearchParams()
  const dateFrom = searchParams.get("dateFrom") ?? undefined
  const dateTo = searchParams.get("dateTo") ?? undefined

  const { data, isLoading } = useCustomerConsumptionDetail({
    accountNumber: accountNumber ?? "",
    dateFrom,
    dateTo,
    limit: 200,
    page: 1,
    enabled: !!accountNumber,
  })

  const records = data?.data || []
  const customer = records[0]

  const totalKwh = records.reduce((sum, r) => sum + (r.lastbillconsumption || 0), 0)
  const totalBill = records.reduce((sum, r) => sum + (r.lastbillamount || 0), 0)
  const totalBalance = records.reduce((sum, r) => sum + (r.currentbalance || 0), 0)

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
          <h2 className="text-2xl font-semibold tracking-tight">Account: {accountNumber}</h2>
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
                    <CardTitle className="text-lg">{customer.fullname || "Unknown Customer"}</CardTitle>
                    <CardDescription>{customer.accountnumber}</CardDescription>
                  </div>
                </div>
                <Badge variant={customer.contractstatus === "Active" ? "default" : "secondary"}>
                  {customer.contractstatus || "Unknown"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Region / District</p>
                    <p className="font-medium">{customer.regionname}</p>
                    <p className="text-muted-foreground">{customer.districtname}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Service / Customer Type</p>
                    <p className="font-medium">{customer.servicetype || "—"}</p>
                    <p className="text-muted-foreground">{customer.customertype || "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Receipt className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Account Type</p>
                    <p className="font-medium">{customer.accounttype || "—"}</p>
                    <p className="text-muted-foreground">Tariff: {customer.tariffclasscode || "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Last Bill Date</p>
                    <p className="font-medium">{formatDate(customer.lastbilldate)}</p>
                    <p className="text-muted-foreground">Bill month: {customer.billmonth || "—"}</p>
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
                <p className="text-xs text-muted-foreground">Total Last Bill</p>
                <p className="text-2xl font-bold mt-1 tabular-nums">{formatMoney(totalBill)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Across all service points</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground">Total Balance</p>
                <p className={`text-2xl font-bold mt-1 tabular-nums ${totalBalance > 0 ? "text-red-600" : "text-green-600"}`}>
                  {formatMoney(totalBalance)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{totalBalance > 0 ? "Outstanding" : "No debt"}</p>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {/* Meters table */}
      <Card>
        <CardHeader>
          <CardTitle>Service Points / Meters</CardTitle>
          <CardDescription>All meters linked to account {accountNumber}, sorted by consumption</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Meter / Service Point</TableHead>
                  <TableHead>District</TableHead>
                  <TableHead>Plot / Geocode</TableHead>
                  <TableHead>Tariff</TableHead>
                  <TableHead className="text-right bg-blue-50">
                    <div className="flex items-center justify-end gap-1">
                      <Zap className="h-3.5 w-3.5 text-blue-600" />
                      <span className="text-blue-700">Consumption (kWh)</span>
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Last Bill</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Last Reading</TableHead>
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
                    .sort((a, b) => (b.lastbillconsumption || 0) - (a.lastbillconsumption || 0))
                    .map((r, idx) => (
                      <TableRow key={`${r.servicepointnumber}-${idx}`} className="hover:bg-muted/40">
                        <TableCell>
                          <Link
                            href={`/customer-sales/service-point/${encodeURIComponent(r.servicepointnumber)}${dateFrom ? `?dateFrom=${dateFrom}&dateTo=${dateTo}` : ""}`}
                            className="flex items-center gap-1.5 font-mono text-xs text-primary hover:underline"
                          >
                            {r.servicepointnumber}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{r.activity || "—"}</p>
                        </TableCell>
                        <TableCell className="text-sm">{r.districtname || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <p>{r.plotcode || "—"}</p>
                          <p>{r.geocode || "—"}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-normal">
                            {r.tariffclasscode || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right bg-blue-50/50">
                          <span className="font-bold text-blue-700 tabular-nums text-sm">
                            {r.lastbillconsumption != null
                              ? r.lastbillconsumption.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                          {formatMoney(r.lastbillamount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          <span className={r.currentbalance != null && r.currentbalance > 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                            {formatMoney(r.currentbalance)}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          <p>{r.lastreadingvalue != null ? r.lastreadingvalue.toLocaleString() : "—"}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(r.lastreadingdate)}</p>
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
