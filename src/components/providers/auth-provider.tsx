"use client"

import type React from "react"
import { useEffect } from "react"
import { useUserStore } from "@/stores/user-store"
import { LoginDialog } from "@/components/auth/login-dialog"
import { saveAuthReturnUrl } from "@/lib/auth-return-url"
import {
  needsTokenRefresh,
  refreshAccessToken,
  REFRESH_SKEW_MS,
} from "@/lib/auth-session"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const clearTimer = () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }

    const scheduleNext = () => {
      clearTimer()
      if (cancelled) return

      const { isAuthenticated, tokenExpiresAt } = useUserStore.getState()
      if (!isAuthenticated || !tokenExpiresAt) {
        timer = setTimeout(() => {
          void ensureFreshSession()
        }, 30_000)
        return
      }

      // Refresh 60s before expiry (or immediately if already inside the skew window)
      const delay = Math.max(5_000, tokenExpiresAt - Date.now() - REFRESH_SKEW_MS)
      timer = setTimeout(() => {
        void ensureFreshSession()
      }, delay)
    }

    const ensureFreshSession = async () => {
      const store = useUserStore.getState()
      if (!store.hasHydrated || !store.isAuthenticated) {
        scheduleNext()
        return
      }
      if (!needsTokenRefresh()) {
        scheduleNext()
        return
      }

      let result = await refreshAccessToken()

      if (result === "transient") {
        await new Promise((r) => setTimeout(r, 1500))
        if (cancelled) return
        result = await refreshAccessToken()
      }

      if (cancelled) return

      if (result === "auth_failed") {
        // Another tab may have already rotated tokens into localStorage.
        await useUserStore.persist.rehydrate()
        const after = useUserStore.getState()
        if (after.isAuthenticated && !after.isTokenExpired()) {
          scheduleNext()
          return
        }

        if (after.isAuthenticated && after.isTokenExpired()) {
          console.log("[auth] Session refresh failed; logging out")
          saveAuthReturnUrl()
          after.logout()
        }
        scheduleNext()
        return
      }

      scheduleNext()
    }

    const unsub = useUserStore.persist.onFinishHydration(() => {
      void ensureFreshSession()
    })
    if (useUserStore.persist.hasHydrated()) {
      void ensureFreshSession()
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void ensureFreshSession()
      }
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === "user-storage") {
        void useUserStore.persist.rehydrate().then(() => {
          if (!cancelled) scheduleNext()
        })
      }
    }

    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)
    window.addEventListener("storage", onStorage)

    return () => {
      cancelled = true
      clearTimer()
      unsub()
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  return (
    <>
      <LoginDialog />
      {children}
    </>
  )
}
