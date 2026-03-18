import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface User {
  id: string
  email?: string
  name?: string
  username?: string
  provider?: string
  roles: string[] | null
}

interface UserState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  hasHydrated: boolean
  setUser: (user: User | null) => void
  login: (user: User, token: string) => void // Added token parameter
  logout: () => void
  setLoading: (loading: boolean) => void
  setHasHydrated: (hydrated: boolean) => void
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true, // Always starts true, will be set to false after rehydration
      hasHydrated: false, // Tracks if store has been rehydrated from storage
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      login: (user, token) => {
        console.log("[v0] UserStore - Login called", { userId: user.id, hasToken: !!token })
        set({ user, token, isAuthenticated: true, isLoading: false, hasHydrated: true })
      },
      logout: () => {
        console.log("[v0] UserStore - Logout called")
        set({ user: null, token: null, isAuthenticated: false })
      },
      setLoading: (loading) => set({ isLoading: loading }),
      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
    }),
    {
      name: "user-storage",
      // Only persist user, token, and isAuthenticated - NOT isLoading
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      // Ensure isAuthenticated is restored based on token/user existence
      onRehydrateStorage: () => (state) => {
        console.log("[v0] UserStore - Rehydrating from storage", {
          hasUser: !!state?.user,
          hasToken: !!state?.token,
          isAuthenticated: state?.isAuthenticated,
        })
        if (state) {
          if (state.user && state.token) {
            console.log("[v0] UserStore - Session restored from storage")
            state.isAuthenticated = true
          } else {
            console.log("[v0] UserStore - No valid session in storage, clearing auth")
            state.user = null
            state.token = null
            state.isAuthenticated = false
          }
          state.isLoading = false
          state.hasHydrated = true
          console.log("[v0] UserStore - Hydration complete", { isAuthenticated: state.isAuthenticated })
        }
      },
    },
  ),
)
