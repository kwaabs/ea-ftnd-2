// "use client"

// import { useEffect } from "react"
// import { useRouter } from "next/navigation"
// import { useUserStore } from "@/stores/user-store"

// export default function HomePage() {
//   const { isAuthenticated, isLoading } = useUserStore()
//   const router = useRouter()

//   useEffect(() => {
//     if (!isLoading && isAuthenticated) {
//       router.push("/dashboard")
//     }
//   }, [isAuthenticated, isLoading, router])

//   return (
//     <div className="flex min-h-screen items-center justify-center">
//       <div className="animate-pulse text-muted-foreground">Loading...</div>
//     </div>
//   )
// }


"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUserStore } from "@/stores/user-store"

export default function HomePage() {
  const { isAuthenticated, isLoading, hasHydrated } = useUserStore()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/dashboard")
    }
  }, [isAuthenticated, isLoading, router])

  if (!hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <></> // 👈 empty fragment instead of null
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Redirecting...</div>
    </div>
  )
}