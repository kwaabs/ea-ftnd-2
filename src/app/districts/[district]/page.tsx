"use client"

import { useParams } from "next/navigation"
import { AppLayout } from "@/components/layout/app-layout"
import { DistrictDetail } from "@/components/districts/district-detail"

export default function DistrictDetailPage() {
    const params = useParams()
    const districtSlug = params.district as string

    // District names come in format "region-name-district-name" 
    // e.g., "greater-accra-accra-central" -> "Greater Accra/Accra Central"
    const districtName = decodeURIComponent(districtSlug)
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")

    // Extract region and district from the slug
    // Convention: first part before "/" is region, rest is district
    const parts = districtName.split(" ")
    
    return (
        <AppLayout>
            <DistrictDetail district={districtName} />
        </AppLayout>
    )
}
