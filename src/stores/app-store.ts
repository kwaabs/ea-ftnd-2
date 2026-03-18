import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface GlobalFilters {
  preset: "lastDay" | "lastWeek" | "lastMonth" | "custom"

  dateRange: { start: Date; end: Date }

  // Location filters
  regions: string[]
  districts: string[]
  stations: string[]
  locations: string[]

  // Meter filters
  meterTypes: string[]
  boundaryMeteringPoints: string[]
  voltages: number[]

  activeTab: string
}

interface AppState {
  filters: GlobalFilters
  setFilters: (filters: Partial<GlobalFilters>) => void
  updateFilter: <K extends keyof GlobalFilters>(key: K, value: GlobalFilters[K]) => void
  clearFilters: () => void
  clearNonDateFilters: () => void
  isFilterPanelOpen: boolean
  toggleFilterPanel: () => void
}

const getDefaultDateRange = () => {
  const today = new Date()
  const lastMonth = new Date(today)
  lastMonth.setMonth(lastMonth.getMonth() - 1)

  return {
    start: lastMonth,
    end: today,
  }
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      filters: {
        preset: "lastMonth",
        dateRange: getDefaultDateRange(),
        regions: [],
        districts: [],
        stations: [],
        locations: [],
        meterTypes: [],
        boundaryMeteringPoints: [],
        voltages: [],
        activeTab: "overview",
      },
      setFilters: (filters) =>
        set((state) => ({
          filters: { ...state.filters, ...filters },
        })),
      updateFilter: (key, value) =>
        set((state) => ({
          filters: { ...state.filters, [key]: value },
        })),
      clearFilters: () =>
        set({
          filters: {
            preset: "lastMonth",
            dateRange: getDefaultDateRange(),
            regions: [],
            districts: [],
            stations: [],
            locations: [],
            meterTypes: [],
            boundaryMeteringPoints: [],
            voltages: [],
            activeTab: "overview",
          },
        }),
      clearNonDateFilters: () =>
        set((state) => ({
          filters: {
            ...state.filters,
            // Keep date-related filters
            preset: state.filters.preset,
            dateRange: state.filters.dateRange,
            activeTab: state.filters.activeTab,
            // Clear all other filters
            regions: [],
            districts: [],
            stations: [],
            locations: [],
            meterTypes: [],
            boundaryMeteringPoints: [],
            voltages: [],
          },
        })),
      isFilterPanelOpen: false,
      toggleFilterPanel: () => set((state) => ({ isFilterPanelOpen: !state.isFilterPanelOpen })),
    }),
    {
      name: "app-filters-storage",
      partialize: (state) => ({ filters: state.filters }),
    },
  ),
)
