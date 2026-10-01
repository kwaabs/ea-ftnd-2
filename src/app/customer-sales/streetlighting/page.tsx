"use client"

import { Suspense, useEffect } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { StreetlightingHubView } from "@/components/customer-sales/streetlighting-hub-view"
import { Skeleton } from "@/components/ui/skeleton"
import { useAppStore } from "@/stores/app-store"

export default function StreetlightingCustomerSalesPage() {
  const { clearNonDateFilters } = useAppStore()

  // Region/district/etc. filters set on another page shouldn't carry over
  // here — only the date range should persist.
  useEffect(() => {
    clearNonDateFilters()
  }, [clearNonDateFilters])

  return (
    <AppLayout>
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-96 w-full" />
          </div>
        }
      >
        <StreetlightingHubView />
      </Suspense>
    </AppLayout>
  )
}
