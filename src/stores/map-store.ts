import { create } from "zustand"

export interface MapMarker {
  id: string
  coordinates: [number, number]
  properties: Record<string, any>
}

interface MapState {
  center: [number, number]
  zoom: number
  markers: MapMarker[]
  selectedMarkerId: string | null
  setCenter: (center: [number, number]) => void
  setZoom: (zoom: number) => void
  setMarkers: (markers: MapMarker[]) => void
  addMarker: (marker: MapMarker) => void
  removeMarker: (id: string) => void
  selectMarker: (id: string | null) => void
}

export const useMapStore = create<MapState>((set) => ({
  center: [-74.006, 40.7128], // Default to New York
  zoom: 12,
  markers: [],
  selectedMarkerId: null,
  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  setMarkers: (markers) => set({ markers }),
  addMarker: (marker) => set((state) => ({ markers: [...state.markers, marker] })),
  removeMarker: (id) =>
    set((state) => ({
      markers: state.markers.filter((m) => m.id !== id),
    })),
  selectMarker: (id) => set({ selectedMarkerId: id }),
}))
