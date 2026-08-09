"use client"

import { Suspense } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { DebtInsightsView } from "@/components/customer-sales/debt-insights-view"
import { Skeleton } from "@/components/ui/skeleton"

export default function CustomerSalesDebtPage() {
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
        <DebtInsightsView />
      </Suspense>
    </AppLayout>
  )
}
