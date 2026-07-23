"use client"

import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { ArrowLeft, Zap, User, MapPin, Building2, Receipt, Wallet, Calendar, Activity, Database } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { useCustomerConsumptionDetail } from "@/hooks/api/use-customer-consumption-detail-api"



function formatKwh(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) return "—"
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "—"
  return "₵" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b last:border-0">
      <span className="text-sm text-muted-foreground shrink-0 w-44">{label}</span>
      <span className="text-sm font-medium text-right">{value ?? "—"}</span>
    </div>
  )
}

export function ServicePointDetailView() {
  const params = useParams()
  // Folder is [service-point-number] → param key uses hyphens, not underscores
  const rawParam = params["service-point-number"] ?? params.service_point_number
  const servicePointNumber = rawParam ? decodeURIComponent(rawParam as string) : undefined
  const searchParams = useSearchParams()
  const dateFrom = searchParams.get("dateFrom") ?? undefined
  const dateTo = searchParams.get("dateTo") ?? undefined

  const { data, isLoading } = useCustomerConsumptionDetail({
    servicePointNumber: servicePointNumber ?? "",
    dateFrom,
    dateTo,
    limit: 50,
    page: 1,
    enabled: !!servicePointNumber,
  })

  const record = data?.data?.[0]

  return (
    <div className="space-y-6">
      {/* Back + breadcrumb */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/customer-sales">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Customer Sales
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Service Point: {servicePointNumber ?? "..."}</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            {dateFrom && dateTo ? `Period: ${formatDate(dateFrom)} – ${formatDate(dateTo)}` : "Consumption and billing detail"}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : !record ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            No data found for service point <strong>{servicePointNumber}</strong>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* kWh hero strip */}
          <div className="rounded-xl border-2 border-blue-200 bg-blue-50/40 p-6 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Consumption</p>
                <p className="text-4xl font-bold text-blue-700 tabular-nums leading-none mt-0.5">
                  {formatKwh(record.lastbillconsumption)}
                </p>
                <p className="text-sm text-blue-500 mt-0.5">kWh</p>
              </div>
            </div>
            <Separator orientation="vertical" className="hidden md:block h-16" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2 text-sm flex-1">
              <div>
                <p className="text-xs text-muted-foreground">Last Reading Value</p>
                <p className="font-semibold">{record.lastreadingvalue != null ? record.lastreadingvalue.toLocaleString() : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Reading Date</p>
                <p className="font-semibold">{formatDate(record.lastreadingdate)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bill Month</p>
                <p className="font-semibold">{record.billmonth || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Is AMR</p>
                <p className="font-semibold">{record.isamr ? "Yes" : "No"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Data Source</p>
                <Badge variant="outline" className="text-xs mt-0.5">{record.data_src || "—"}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Contract Status</p>
                <Badge variant={record.contractstatus === "Active" ? "default" : "secondary"} className="text-xs mt-0.5">
                  {record.contractstatus || "Unknown"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Financial KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Receipt className="h-3.5 w-3.5" />
                  <p className="text-xs">Last Bill Amount</p>
                </div>
                <p className="text-2xl font-bold mt-1 tabular-nums">{formatMoney(record.lastbillamount)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(record.lastbilldate)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" />
                  <p className="text-xs">Current Balance</p>
                </div>
                <p className={`text-2xl font-bold mt-1 tabular-nums ${record.currentbalance != null && record.currentbalance > 0 ? "text-red-600" : "text-green-600"}`}>
                  {formatMoney(record.currentbalance)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {record.currentbalance != null && record.currentbalance > 0 ? "Outstanding" : "No debt"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <p className="text-xs">Last Payment</p>
                </div>
                <p className="text-2xl font-bold mt-1 tabular-nums">{formatMoney(record.lastpaymentamount)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(record.lastpaymentdate)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Detail panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Customer & Account */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Customer & Account</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <DetailRow label="Full Name" value={record.fullname} />
                <DetailRow
                  label="Account Number"
                  value={
                    <Link
                      href={`/customer-sales/account/${encodeURIComponent(record.accountnumber)}${dateFrom ? `?dateFrom=${dateFrom}&dateTo=${dateTo}` : ""}`}
                      className="text-primary hover:underline font-mono text-xs"
                    >
                      {record.accountnumber}
                    </Link>
                  }
                />
                <DetailRow label="Account Type" value={record.accounttype} />
                <DetailRow label="Customer Type" value={record.customertype} />
                <DetailRow label="Service Type" value={record.servicetype} />
                <DetailRow label="Service Class" value={record.serviceclass} />
                <DetailRow label="Tariff Code" value={record.tariffclasscode} />
                <DetailRow label="Tariff Name" value={record.tariffclassname} />
              </CardContent>
            </Card>

            {/* Location */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Location</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <DetailRow label="Region" value={record.regionname} />
                <DetailRow label="District" value={record.districtname} />
                <DetailRow label="Plot Code" value={record.plotcode} />
                <DetailRow label="Geocode" value={record.geocode} />
              </CardContent>
            </Card>

            {/* Activity & Classification */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Activity & Classification</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <DetailRow label="Activity" value={record.activity} />
                <DetailRow label="Sub-Activity" value={record.subactivity} />
                <DetailRow label="Ministry" value={record.ministryname || record.ministry} />
                <DetailRow label="Ministry Code" value={record.ministrycode} />
                <DetailRow label="MDA" value={record.mdaname || record.mda} />
                <DetailRow label="MDA Code" value={record.mdacode} />
              </CardContent>
            </Card>

            {/* Data & System */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Data & System</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <DetailRow label="Data Source" value={<Badge variant="outline" className="text-xs">{record.data_src || "—"}</Badge>} />
                <DetailRow label="Is AMR" value={record.isamr ? "Yes" : "No"} />
                <DetailRow label="Bill Month" value={record.billmonth} />
                <DetailRow label="Created At" value={formatDate(record.createdat)} />
                <DetailRow label="Last Bill Date" value={formatDate(record.lastbilldate)} />
                <DetailRow label="Last Payment Date" value={formatDate(record.lastpaymentdate)} />
                <DetailRow label="Last Reading Date" value={formatDate(record.lastreadingdate)} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
