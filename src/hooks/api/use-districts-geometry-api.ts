import { useQuery } from "@tanstack/react-query"
import { API_BASE_URL } from "@/lib/api-config"

interface DistrictGeometry {
  district: string
  region: string
  center_lat?: number
  center_lng?: number
  geojson?: any // GeoJSON feature
  boundary?: any // GeoJSON geometry (legacy)
}

interface DistrictGeometryResponse {
  data: {
    version?: string
    districts: DistrictGeometry[]
  }
}

export function useDistrictsByRegion(region: string) {
  return useQuery<DistrictGeometryResponse>({
    queryKey: ["districts-geometry", region],
    queryFn: async () => {
      const params = new URLSearchParams({ region })
      const response = await fetch(`${API_BASE_URL}/meters/geometries/districts?${params}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch districts: ${response.status}`)
      }

      return response.json()
    },
    enabled: !!region,
  })
}

export function useAllDistrictsGeometry() {
  return useQuery<DistrictGeometryResponse>({
    queryKey: ["districts-geometry-all"],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/meters/geometries/districts`)

      if (!response.ok) {
        throw new Error(`Failed to fetch districts: ${response.status}`)
      }

      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - geometry doesn't change often
  })
}

export function useDistrictGeometry(district: string) {
  return useQuery<DistrictGeometryResponse>({
    queryKey: ["district-geometry", district],
    queryFn: async () => {
      const params = new URLSearchParams({ district })
      const response = await fetch(`${API_BASE_URL}/meters/geometries/districts?${params}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch district: ${response.status}`)
      }

      return response.json()
    },
    enabled: !!district,
    staleTime: 5 * 60 * 1000,
  })
}
