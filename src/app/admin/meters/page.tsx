"use client"

import { AppLayout } from "@/components/layout/app-layout"
import { ManageMetersView } from "@/components/admin/manage-meters-view"
import { useUserStore } from "@/stores/user-store"
import { NOTIFY_EMAILS } from "@/lib/notify-config"

export default function ManageMetersPage() {
    const { user } = useUserStore()
    const userEmail = user?.email || user?.username || ""
    const isAllowed = NOTIFY_EMAILS.includes(userEmail)

    return (
        <AppLayout>
            {isAllowed ? (
                <ManageMetersView />
            ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <p className="text-sm text-muted-foreground">You don&apos;t have access to this page.</p>
                </div>
            )}
        </AppLayout>
    )
}
