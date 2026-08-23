"use client"

import { useQuery } from "@tanstack/react-query"
import { useUserStore } from "@/stores/user-store"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

interface NotifyEmailMeResponse {
  allowed: boolean
}

/**
 * Whether the currently signed-in user is on the backend's
 * app.notify_emails allowlist — gates admin-only nav/UI (Manage Meters,
 * login stats, the comments bell, posting/removing marquee announcements).
 * Replaces the old hardcoded NOTIFY_EMAILS array (src/lib/notify-config.ts):
 * that required a redeploy to change who had access; this reads live from
 * GET /api/v1/notify-emails/me, backed by a DB table an admin can edit at
 * runtime.
 */
export function useIsNotifyEmail() {
  const token = useUserStore((s) => s.token)
  const userId = useUserStore((s) => s.user?.id)
  const isAuthenticated = useUserStore((s) => s.isAuthenticated)

  const query = useQuery<NotifyEmailMeResponse>({
    queryKey: ["notify-emails-me", userId],
    enabled: isAuthenticated && Boolean(token) && Boolean(userId),
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/notify-emails/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        throw new Error(`Failed to check notify-emails allowlist: ${response.status}`)
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  return {
    isAllowed: query.data?.allowed ?? false,
    isLoading: query.isLoading,
  }
}
