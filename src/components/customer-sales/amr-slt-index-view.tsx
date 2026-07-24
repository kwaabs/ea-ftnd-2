"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AmrPageView } from "@/components/amr/amr-page-view"
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

/** AMR landing under Postpaid — SLT type cards link to dedicated pages. */
export function AmrSltIndexView() {
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

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Button variant="outline" size="sm" asChild className="mt-1 shrink-0">
          <Link href="/customer-sales/postpaid?source=amr">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Postpaid
          </Link>
        </Button>
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            AMR by SLT type
          </h2>
          <p className="text-muted-foreground mt-1">
            Open an SLT type for a dedicated consumption and meter-status page
          </p>
        </div>
      </div>

      <AmrPageView
        dateRange={dateRange}
        region={region}
        district={district}
        embedded
      />
    </div>
  )
}
