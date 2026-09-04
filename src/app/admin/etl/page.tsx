"use client"

import { Loader2 } from "lucide-react"
import { AppLayout } from "@/components/layout/app-layout"
import { ManageEtlView } from "@/components/admin/manage-etl-view"
import { useIsNotifyEmail } from "@/hooks/api/use-notify-email-api"

export default function ManageEtlPage() {
    const { isAllowed, isLoading } = useIsNotifyEmail()

    return (
        <AppLayout>
            {isLoading ? (
                <div className="flex justify-center py-24">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
            ) : isAllowed ? (
                <ManageEtlView />
            ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <p className="text-sm text-muted-foreground">You don&apos;t have access to this page.</p>
                </div>
            )}
        </AppLayout>
    )
}
