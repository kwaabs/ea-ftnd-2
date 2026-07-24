"use client"

import { useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ZeusPageView } from "@/components/customer-sales/zeus-page-view"
import { MmsPageView } from "@/components/customer-sales/mms-page-view"
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

export function PrepaidHubView() {
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
    return raw === "mms" ? "mms" : "zeus"
  }, [searchParams])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">
          Prepaid
        </h2>
        <p className="text-muted-foreground mt-1">
          Zeus prepaid accounts and MMS prepaid meters
        </p>
      </div>

      <Tabs defaultValue={initialSource} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger
            value="zeus"
            className="data-[state=active]:text-emerald-700"
          >
            Zeus
          </TabsTrigger>
          <TabsTrigger
            value="mms"
            className="data-[state=active]:text-green-700"
          >
            MMS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="zeus" className="mt-0">
          <ZeusPageView
            dateRange={dateRange}
            region={region}
            district={district}
            serviceType="Prepaid"
            embedded
          />
        </TabsContent>

        <TabsContent value="mms" className="mt-0">
          <MmsPageView
            dateRange={dateRange}
            region={region}
            district={district}
            embedded
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
