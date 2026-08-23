"use client"

import { Loader2 } from "lucide-react"
import { AppLayout } from "@/components/layout/app-layout"
import { ManageMetersView } from "@/components/admin/manage-meters-view"
import { useIsNotifyEmail } from "@/hooks/api/use-notify-email-api"

export default function ManageMetersPage() {
    const { isAllowed, isLoading } = useIsNotifyEmail()

    return (
        <AppLayout>
            {isLoading ? (
                <div className="flex justify-center py-24">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
            ) : isAllowed ? (
                <ManageMetersView />
            ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <p className="text-sm text-muted-foreground">You don&apos;t have access to this page.</p>
                </div>
            )}
        </AppLayout>
    )
}
