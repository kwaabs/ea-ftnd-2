"use client"

import { useParams } from "next/navigation"
import { AppLayout } from "@/components/layout/app-layout"
import { RegionDetail } from "@/components/regions/region-detail"

export default function RegionDetailPage() {
  const params = useParams()
  const regionSlug = params.region as string

  const regionName = decodeURIComponent(regionSlug).replace(/-/g, " ").toLowerCase()

  return (
    <AppLayout>
      <RegionDetail region={regionName} />
    </AppLayout>
  )
}
