"use client"

import { useParams } from "next/navigation"
import { AppLayout } from "@/components/layout/app-layout"
import { MeterDetailsView } from "@/components/meters/meter-details-view"

export default function MeterDetailsPage() {
  const params = useParams()
  const meterId = params.meter_id as string

  return (
    <AppLayout>
      <MeterDetailsView meterNumber={meterId} />
    </AppLayout>
  )
}
