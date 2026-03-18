import { create } from "zustand"

interface DashboardMetrics {
  totalUsers?: number
  activeUsers?: number
  revenue?: number
  growth?: number
}

interface DashboardState {
  metrics: DashboardMetrics
  isLoading: boolean
  error: string | null
  setMetrics: (metrics: DashboardMetrics) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useDashboardStore = create<DashboardState>((set) => ({
  metrics: {},
  isLoading: false,
  error: null,
  setMetrics: (metrics) => set({ metrics, error: null }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error, isLoading: false }),
}))
