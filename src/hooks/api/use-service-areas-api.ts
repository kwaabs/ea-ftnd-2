"use client"

import useSWR from "swr"
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

interface ServiceAreaFeature {
  id: number
  region: string
  district: string
  type: "Feature"
  geometry: {
    coordinates: number[][][]
    type: "Polygon"
  }
}

interface ServiceAreasResponse {
  type: "FeatureCollection"
  features: ServiceAreaFeature[]
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useServiceAreas() {
  console.log("[v0] Fetching service areas from:", `${API_BASE_URL}/api/v1/service-areas`)

  const { data, error, isLoading } = useSWR<ServiceAreasResponse>(`${API_BASE_URL}/api/v1/service-areas`, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  })

  console.log("[v0] Service areas data:", data)
  console.log("[v0] Service areas loading:", isLoading)
  console.log("[v0] Service areas error:", error)

  return {
    data,
    isLoading,
    error,
  }
}
