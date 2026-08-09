"use client"

import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { ArrowLeft, Zap, User, MapPin, Building2, Receipt, Wallet, Calendar, Activity, Database } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { useZeusBillingDetail } from "@/hooks/api/use-zeus-billing-detail-api"



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

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function formatBillingPeriod(month: number | null | undefined, year: number | null | undefined) {
  if (!month || !year) return "—"
  const name = MONTH_NAMES[month - 1]
  return name ? `${name} ${year}` : `${month}/${year}`
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
  const servicePointCode = rawParam ? decodeURIComponent(rawParam as string) : undefined
  const searchParams = useSearchParams()
  const dateFrom = searchParams.get("dateFrom") ?? undefined
  const dateTo = searchParams.get("dateTo") ?? undefined

  const { data, isLoading } = useZeusBillingDetail({
    servicePointCode: servicePointCode ?? "",
    dateFrom,
    dateTo,
    limit: 50,
    page: 1,
    enabled: !!servicePointCode,
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
          <h2 className="text-2xl font-semibold tracking-tight">Service Point: {servicePointCode ?? "..."}</h2>
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
            No data found for service point <strong>{servicePointCode}</strong>
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
                  {formatKwh(record.billConsumptionValue)}
                </p>
                <p className="text-sm text-blue-500 mt-0.5">kWh</p>
              </div>
            </div>
            <Separator orientation="vertical" className="hidden md:block h-16" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2 text-sm flex-1">
              <div>
                <p className="text-xs text-muted-foreground">Meter Type</p>
                <p className="font-semibold">{record.meterModelType || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Billing Period</p>
                <p className="font-semibold">{formatBillingPeriod(record.billingMonth, record.billingYear)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bill Consumption Type</p>
                <p className="font-semibold">{record.billConsumptionType || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bill Status</p>
                <Badge variant={record.billStatus === "Billed" ? "default" : "secondary"} className="text-xs mt-0.5">
                  {record.billStatus || "Unknown"}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Contract Status</p>
                <Badge variant={record.servicePointStatus === "Active" ? "default" : "secondary"} className="text-xs mt-0.5">
                  {record.servicePointStatus || "Unknown"}
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
                  <p className="text-xs">Bill Amount</p>
                </div>
                <p className="text-2xl font-bold mt-1 tabular-nums">{formatMoney(record.billAmount)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatBillingPeriod(record.billingMonth, record.billingYear)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" />
                  <p className="text-xs">Debt</p>
                </div>
                <p className={`text-2xl font-bold mt-1 tabular-nums ${record.debtAmount != null && record.debtAmount > 0 ? "text-red-600" : "text-green-600"}`}>
                  {formatMoney(record.debtAmount)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {record.debtAmount != null && record.debtAmount > 0 ? "Outstanding" : "No debt"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" />
                  <p className="text-xs">Amount Due</p>
                </div>
                <p className="text-2xl font-bold mt-1 tabular-nums">{formatMoney(record.amountDue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" />
                  <p className="text-xs">Outstanding</p>
                </div>
                <p className="text-2xl font-bold mt-1 tabular-nums">{formatMoney(record.outstandingAmount)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <p className="text-xs">Last Payment</p>
                </div>
                <p className="text-2xl font-bold mt-1 tabular-nums">{formatMoney(record.lastPaymentAmount)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(record.lastPaymentDate)}</p>
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
                <DetailRow label="Full Name" value={record.customerName} />
                <DetailRow
                  label="Account Code"
                  value={
                    <Link
                      href={`/customer-sales/account/${encodeURIComponent(record.accountCode)}${dateFrom ? `?dateFrom=${dateFrom}&dateTo=${dateTo}` : ""}`}
                      className="text-primary hover:underline font-mono text-xs"
                    >
                      {record.accountCode}
                    </Link>
                  }
                />
                <DetailRow label="Account Type" value={record.accountType} />
                <DetailRow label="Meter Type" value={record.meterModelType} />
                <DetailRow label="Service Class" value={record.serviceClass} />
                <DetailRow label="Tariff Code" value={record.tariffClassCode} />
                <DetailRow label="Tariff Name" value={record.tariffClassName} />
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
                <DetailRow label="Region" value={record.regionName} />
                <DetailRow label="District" value={record.districtName} />
                <DetailRow label="Geocode" value={record.geoCode} />
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
                <DetailRow label="MDA" value={record.mdaName} />
                <DetailRow label="SOE" value={record.soeName} />
                <DetailRow label="Sensitive" value={record.isSensitive} />
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
                <DetailRow label="Billing Period" value={formatBillingPeriod(record.billingMonth, record.billingYear)} />
                <DetailRow label="Created At" value={formatDate(record.createdAt)} />
                <DetailRow label="Updated At" value={formatDate(record.updatedAt)} />
                <DetailRow label="Last Payment Date" value={formatDate(record.lastPaymentDate)} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
