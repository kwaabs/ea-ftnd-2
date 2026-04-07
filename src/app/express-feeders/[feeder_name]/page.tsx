"use client"

import { useParams } from "next/navigation"
import { AppLayout } from "@/components/layout/app-layout"
import { ExpressFeederDetailView } from "@/components/express-feeders/express-feeder-detail-view"

export default function ExpressFeederDetailPage() {
    const params = useParams()
    const feederName = params.feeder_name as string

    return (
        <AppLayout>
            <ExpressFeederDetailView feederName={feederName} />
        </AppLayout>
    )
}
