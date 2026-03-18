import { create } from "zustand"

export interface AnalyticsData {
  date: string
  value: number
  category?: string
}

interface AnalyticsState {
  data: AnalyticsData[]
  isLoading: boolean
  error: string | null
  selectedPeriod: "day" | "week" | "month" | "year"
  setData: (data: AnalyticsData[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setSelectedPeriod: (period: "day" | "week" | "month" | "year") => void
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  data: [],
  isLoading: false,
  error: null,
  selectedPeriod: "week",
  setData: (data) => set({ data, error: null }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error, isLoading: false }),
  setSelectedPeriod: (period) => set({ selectedPeriod: period }),
}))
