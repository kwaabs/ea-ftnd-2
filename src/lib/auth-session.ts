import { useUserStore } from "@/stores/user-store"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

/** Refresh within this window before access token expiry. */
export const REFRESH_SKEW_MS = 60_000

export function parseExpiresAt(data: Record<string, unknown>): number {
  const raw = data.access_expires_at ?? data.expiresAt ?? data.expires_at
  if (typeof raw === "number" && Number.isFinite(raw)) {
    // treat values under year 2100-in-ms threshold as unix seconds
    return raw < 1e12 ? raw * 1000 : raw
  }
  if (typeof raw === "string" && raw) {
    const ms = Date.parse(raw)
    if (!Number.isNaN(ms)) return ms
  }
  return Date.now() + 15 * 60 * 1000
}

export type RefreshResult = "ok" | "auth_failed" | "transient"

let refreshInFlight: Promise<RefreshResult> | null = null

/** Silently renew the access token using the refresh cookie and/or stored refresh token. */
export async function refreshAccessToken(): Promise<RefreshResult> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async (): Promise<RefreshResult> => {
    const store = useUserStore.getState()
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          refresh_token: store.refreshToken || undefined,
        }),
      })

      // Only 401/403 mean the session is dead — keep the user logged in on network/5xx.
      if (res.status === 401 || res.status === 403) return "auth_failed"
      if (!res.ok) return "transient"

      const data = (await res.json()) as Record<string, unknown>
      const accessToken = data.access_token
      if (typeof accessToken !== "string" || !accessToken) return "auth_failed"

      const nextRefresh =
        typeof data.refresh_token === "string" && data.refresh_token
          ? data.refresh_token
          : store.refreshToken

      store.setTokens(accessToken, parseExpiresAt(data), nextRefresh)
      return "ok"
    } catch (err) {
      console.error("[auth] refresh failed", err)
      return "transient"
    }
  })().finally(() => {
    refreshInFlight = null
  })

  return refreshInFlight
}

export function needsTokenRefresh(): boolean {
  const { isAuthenticated, tokenExpiresAt } = useUserStore.getState()
  if (!isAuthenticated) return false
  if (!tokenExpiresAt) return true
  return Date.now() >= tokenExpiresAt - REFRESH_SKEW_MS
}

/** Revoke refresh token on the backend (best-effort). */
export async function logoutSession(): Promise<void> {
  const store = useUserStore.getState()
  try {
    await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        refresh_token: store.refreshToken || undefined,
      }),
    })
  } catch (err) {
    console.error("[auth] logout revoke failed", err)
  } finally {
    store.logout()
  }
}
