"use client"

import type React from "react"
import { useEffect } from "react"
import { useUserStore } from "@/stores/user-store"
import { LoginDialog } from "@/components/auth/login-dialog"

export function AuthProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // Check token expiration every minute
        const tokenCheckInterval = setInterval(() => {
            const store = useUserStore.getState()
            if (store.isAuthenticated && store.isTokenExpired()) {
                console.log("[v0] AuthProvider - Token expired, logging out")
                store.logout()
            }
        }, 60000) // Check every minute

        return () => clearInterval(tokenCheckInterval)
    }, [])

    return (
        <>
            <LoginDialog />
            {children}
        </>
    )
}
