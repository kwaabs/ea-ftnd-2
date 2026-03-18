import { useAuthStore } from "@/stores/auth-store"

export function getAuthHeaders() {
  const token = useAuthStore.getState().token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Global 401 handler - call this when you catch a 401
export function handle401Error() {
  const logout = useAuthStore.getState().logout
  logout()
  // Login modal will automatically show since isAuthenticated becomes false
}
