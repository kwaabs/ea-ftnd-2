"use client"

import { Suspense, useEffect } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { PrepaidHubView } from "@/components/customer-sales/prepaid-hub-view"
import { Skeleton } from "@/components/ui/skeleton"
import { useAppStore } from "@/stores/app-store"

export default function PrepaidCustomerSalesPage() {
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
        <PrepaidHubView />
      </Suspense>
    </AppLayout>
  )
}
