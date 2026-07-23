"use client"

import type React from "react"
import { useEffect } from "react"
import { useUserStore } from "@/stores/user-store"
import { LoginDialog } from "@/components/auth/login-dialog"
import { saveAuthReturnUrl } from "@/lib/auth-return-url"
import { needsTokenRefresh, refreshAccessToken } from "@/lib/auth-session"

export function AuthProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        let cancelled = false

        const ensureFreshSession = async () => {
            const store = useUserStore.getState()
            if (!store.hasHydrated || !store.isAuthenticated) return
            if (!needsTokenRefresh()) return

            let result = await refreshAccessToken()

            // One retry for transient failures (network blip / brief backend restart)
            if (result === "transient") {
                await new Promise((r) => setTimeout(r, 1500))
                if (cancelled) return
                result = await refreshAccessToken()
            }

            if (cancelled) return

            // Only force re-login when access is already expired and refresh was rejected.
            const after = useUserStore.getState()
            if (
                result === "auth_failed" &&
                after.isAuthenticated &&
                after.isTokenExpired()
            ) {
                console.log("[auth] Session refresh failed; logging out")
                saveAuthReturnUrl()
                after.logout()
            }
        }

        // After zustand rehydrate (and once shortly after mount as a fallback)
        const unsub = useUserStore.persist.onFinishHydration(() => {
            void ensureFreshSession()
        })
        if (useUserStore.persist.hasHydrated()) {
            void ensureFreshSession()
        }

        const interval = setInterval(() => {
            void ensureFreshSession()
        }, 30_000)

        return () => {
            cancelled = true
            unsub()
            clearInterval(interval)
        }
    }, [])

    return (
        <>
            <LoginDialog />
            {children}
        </>
    )
}
