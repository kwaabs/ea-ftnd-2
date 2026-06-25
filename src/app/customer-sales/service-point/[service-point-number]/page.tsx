"use client"

import { Suspense } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { ServicePointDetailView } from "@/components/customer-sales/service-point-detail-view"
import { Skeleton } from "@/components/ui/skeleton"

export default function ServicePointDetailPage() {
    return (
        <AppLayout>
            <Suspense fallback={<div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-96 w-full" /></div>}>
                <ServicePointDetailView />
            </Suspense>
        </AppLayout>
    )
}

