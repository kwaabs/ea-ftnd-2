import { useQuery } from "@tanstack/react-query"
import { API_BASE_URL } from "@/lib/api-config"

interface RegionGeometry {
  region: string
  center_lat: number
  center_lng: number
  geojson: {
    type: "Feature"
    properties: {
      region: string
    }
    geometry: {
      type: "Polygon" | "MultiPolygon"
      coordinates: any
    }
  }
}

interface RegionGeometryResponse {
  data: {
    version: string
    regions: RegionGeometry[]
  }
  success: boolean
}

// Fetch all regions with their complete GeoJSON boundaries
export function useAllRegionsGeometry() {
  return useQuery<RegionGeometryResponse>({
    queryKey: ["regions-geometry-all"],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/meters/geometries/regions`)

      if (!response.ok) {
        throw new Error(`Failed to fetch regions geometry: ${response.status}`)
      }

      return response.json()
    },
  })
}
