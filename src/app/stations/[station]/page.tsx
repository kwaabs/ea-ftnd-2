"use client"

import { useParams } from "next/navigation"
import { AppLayout } from "@/components/layout/app-layout"
import { StationDetail } from "@/components/stations/station-detail"

export default function StationDetailPage() {
  const params = useParams()
  const stationSlug = params.station as string
  const stationName = decodeURIComponent(stationSlug).replace(/-/g, " ")

  return (
    <AppLayout>
      <StationDetail station={stationName} />
    </AppLayout>
  )
}
