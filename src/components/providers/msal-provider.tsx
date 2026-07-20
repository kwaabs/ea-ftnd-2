"use client"

import { useEffect, useState } from "react"
import { MsalProvider } from "@azure/msal-react"
import { msalInstance } from "@/lib/msal-config"
import { useUserStore } from "@/stores/user-store"
import { consumeAuthReturnUrl } from "@/lib/auth-return-url"

function parseExpiresAt(data: Record<string, unknown>): number {
  const raw = data.access_expires_at ?? data.expiresAt ?? data.expires_at
  if (typeof raw === "number" && Number.isFinite(raw)) {
    // treat values under year 2100-in-ms threshold as unix seconds
    return raw < 1e12 ? raw * 1000 : raw
  }
  if (typeof raw === "string" && raw) {
    const ms = Date.parse(raw)
    if (!Number.isNaN(ms)) return ms
  }
  return Date.now() + 24 * 60 * 60 * 1000
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [isHandlingRedirect, setIsHandlingRedirect] = useState(true)

  useEffect(() => {
    msalInstance
      .handleRedirectPromise()
      .then(async (response) => {
        if (response) {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/azure`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              id_token: response.idToken,
              access_token: response.accessToken,
            }),
          })

          const contentType = res.headers.get("content-type")
          if (!res.ok || !contentType?.includes("application/json")) {
            console.error("[msal] Backend error:", res.status, res.statusText)
            setIsHandlingRedirect(false)
            return
          }

          const data = await res.json()
          const { login } = useUserStore.getState()
          login(data.user, data.access_token, parseExpiresAt(data))

          // Restore the page the user was on before Azure AD redirect
          const returnUrl = consumeAuthReturnUrl("/dashboard")
          if (window.location.pathname + window.location.search !== returnUrl) {
            window.location.replace(returnUrl)
            return
          }
        }
        setIsHandlingRedirect(false)
      })
      .catch((err) => {
        console.error(err)
        setIsHandlingRedirect(false)
      })
  }, [])

  if (isHandlingRedirect) {
    return (
      <MsalProvider instance={msalInstance}>
        <div className="flex min-h-screen items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Signing you in…</div>
        </div>
      </MsalProvider>
    )
  }

  return <MsalProvider instance={msalInstance}>{children}</MsalProvider>
}
