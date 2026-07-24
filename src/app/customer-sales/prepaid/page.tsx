"use client"

import { Suspense } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { PrepaidHubView } from "@/components/customer-sales/prepaid-hub-view"
import { Skeleton } from "@/components/ui/skeleton"

export default function PrepaidCustomerSalesPage() {
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
