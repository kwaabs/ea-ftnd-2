"use client"

import { AppLayout } from "@/components/layout/app-layout"
import { RegionsView } from "@/components/regions/regions-view"

export default function RegionsPage() {
    return (
        <AppLayout>
            <div className="p-6">
                <h1 className="text-3xl font-bold mb-6">Regions Overview</h1>
                <RegionsView />
            </div>
        </AppLayout>
    )
}
