import { useQuery } from "@tanstack/react-query"
import { useMapStore } from "@/stores/map-store"
import { useAppStore } from "@/stores/app-store"

// Hook to fetch map data from API with filters
export function useMapData() {
  const { setMarkers } = useMapStore()
  const { filters } = useAppStore()

  return useQuery({
    queryKey: ["map-data", filters],
    queryFn: async () => {
      // TODO: Replace with actual API endpoint when backend is ready
      // const response = await fetch('/api/map/markers', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ filters })
      // })
      // const data = await response.json()

      // Mock data for demonstration
      const mockMarkers = [
        {
          id: "marker-1",
          coordinates: [-74.006, 40.7128] as [number, number],
          properties: { name: "Location 1", status: "Active", category: "Sales" },
        },
        {
          id: "marker-2",
          coordinates: [-73.935, 40.73] as [number, number],
          properties: { name: "Location 2", status: "Pending", category: "Marketing" },
        },
        {
          id: "marker-3",
          coordinates: [-74.08, 40.7] as [number, number],
          properties: { name: "Location 3", status: "Active", category: "Operations" },
        },
      ]

      // Filter markers based on global filters
      let filteredMarkers = mockMarkers

      if (filters.status && filters.status.length > 0) {
        filteredMarkers = filteredMarkers.filter((m) => filters.status?.includes(m.properties.status))
      }

      if (filters.category && filters.category.length > 0) {
        filteredMarkers = filteredMarkers.filter((m) => filters.category?.includes(m.properties.category))
      }

      setMarkers(filteredMarkers)
      return filteredMarkers
    },
  })
}
