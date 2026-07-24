"use client"

import { Suspense } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { PostpaidHubView } from "@/components/customer-sales/postpaid-hub-view"
import { Skeleton } from "@/components/ui/skeleton"

export default function PostpaidCustomerSalesPage() {
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
        <PostpaidHubView />
      </Suspense>
    </AppLayout>
  )
}
