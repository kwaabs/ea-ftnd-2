"use client"

import { useEffect } from "react"
import { MsalProvider } from "@azure/msal-react"
import { msalInstance } from "@/lib/msal-config"

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    msalInstance.handleRedirectPromise().then((response) => {
      console.log("[msal] redirect response:", response) // 👈 add this
      if (response) {
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/azure`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            id_token: response.idToken,
            access_token: response.accessToken,
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            const { useUserStore } = require("@/stores/user-store")
            const { login } = useUserStore.getState()
            const expiresAt = data.expiresAt || Date.now() + 24 * 60 * 60 * 1000
            login(data.user, data.access_token, expiresAt)
          })
          .catch(console.error)
      }
    }).catch(console.error)

    // Clear stale interaction state
    const keys = Object.keys(sessionStorage).filter(k =>
      k.includes("msal") && k.includes("interaction")
    )
    keys.forEach(k => sessionStorage.removeItem(k))
  }, [])

  return (
    <MsalProvider instance={msalInstance}>
      {children}
    </MsalProvider>
  )
}