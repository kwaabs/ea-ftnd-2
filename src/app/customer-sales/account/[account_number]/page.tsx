"use client"

import { Suspense } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { AccountDetailView } from "@/components/customer-sales/account-detail-view"
import { Skeleton } from "@/components/ui/skeleton"

export default function AccountDetailPage() {
    return (
        <AppLayout>
            <Suspense fallback={<div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-96 w-full" /></div>}>
                <AccountDetailView />
            </Suspense>
        </AppLayout>
    )
}
