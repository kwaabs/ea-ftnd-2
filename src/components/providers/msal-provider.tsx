"use client"

import { useEffect, useState } from "react"
import { MsalProvider } from "@azure/msal-react"
import { msalInstance } from "@/lib/msal-config"
import { useUserStore } from "@/stores/user-store"

export default function Providers({ children }: { children: React.ReactNode }) {
  const [isHandlingRedirect, setIsHandlingRedirect] = useState(true)

  useEffect(() => {
    msalInstance.handleRedirectPromise().then(async (response) => {
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
        const expiresAt = data.expiresAt || Date.now() + 24 * 60 * 60 * 1000
        login(data.user, data.access_token, expiresAt)
      }
      setIsHandlingRedirect(false)
    }).catch((err) => {
      console.error(err)
      setIsHandlingRedirect(false)
    })

    const keys = Object.keys(sessionStorage).filter(k =>
      k.includes("msal") && k.includes("interaction")
    )
    keys.forEach(k => sessionStorage.removeItem(k))
  }, [])

  // 👇 Show a blank loading screen while handling the redirect
  if (isHandlingRedirect) {
    return (
      <MsalProvider instance={msalInstance}>
        <div className="flex min-h-screen items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </MsalProvider>
    )
  }

  return (
    <MsalProvider instance={msalInstance}>
      {children}
    </MsalProvider>
  )
}