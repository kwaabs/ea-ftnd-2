"use client"

import { useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ZeusPageView } from "@/components/customer-sales/zeus-page-view"
import { AmrPageView } from "@/components/amr/amr-page-view"
import { PostpaidAllSourcesOverview } from "@/components/customer-sales/postpaid-all-sources-overview"
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

export function PostpaidHubView() {
  const searchParams = useSearchParams()
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

  const initialSource = useMemo(() => {
    const raw = (searchParams.get("source") || "").toLowerCase()
    if (raw === "amr") return "amr"
    if (raw === "zeus" || raw === "non-amr") return "zeus"
    return "overview"
  }, [searchParams])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">
          Postpaid
        </h2>
        <p className="text-muted-foreground mt-1">
          Zeus postpaid billing and daily AMR meters (SLT / NSLT)
        </p>
      </div>

      <Tabs defaultValue={initialSource} className="space-y-6">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="zeus" className="data-[state=active]:text-blue-700">
            Non AMR Postpaid
          </TabsTrigger>
          <TabsTrigger value="amr" className="data-[state=active]:text-orange-700">
            AMR Postpaid
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <PostpaidAllSourcesOverview dateRange={dateRange} region={region} district={district} />
        </TabsContent>

        <TabsContent value="zeus" className="mt-0">
          <ZeusPageView
            dateRange={dateRange}
            region={region}
            district={district}
            serviceType="Postpaid"
            embedded
          />
        </TabsContent>

        <TabsContent value="amr" className="mt-0">
          <AmrPageView
            dateRange={dateRange}
            region={region}
            district={district}
            embedded
            hideConsumptionDetail
            hideMeterStatus
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
