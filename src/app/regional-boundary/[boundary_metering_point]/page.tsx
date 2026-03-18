"use client"

import { useParams } from "next/navigation"
import { AppLayout } from "@/components/layout/app-layout"
import { BoundaryDetail } from "@/components/boundary/boundary-detail"

export default function RegionalBoundaryPage() {
    const params = useParams()
    const boundaryMeteringPoint = decodeURIComponent(params.boundary_metering_point as string)

    return (
        <AppLayout>
            <BoundaryDetail boundaryMeteringPoint={boundaryMeteringPoint} type="REGIONAL_BOUNDARY" />
        </AppLayout>
    )
}
