// "use client"

// import type React from "react"

// import { useState, useEffect } from "react"
// import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import { Label } from "@/components/ui/label"
// import { Loader2 } from "lucide-react"
// import { useUserStore } from "@/stores/user-store"
// import { useMutation } from "@tanstack/react-query"
// const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

// export function LoginDialog() {
//   const { isAuthenticated, login, hasHydrated } = useUserStore()
//   const [error, setError] = useState<string | null>(null)
//   const [username, setUsername] = useState("")
//   const [password, setPassword] = useState("")
//   const [isMounted, setIsMounted] = useState(false)
//   const [isLoading, setIsLoading] = useState(false)



//   useEffect(() => {
//     setIsMounted(true)
//   }, [])

//   const loginMutation = useMutation({
//     mutationFn: async ({ username, password }: { username: string; password: string }) => {
//       setIsLoading(true)
//       const response = await fetch(`${API_BASE_URL}/api/v1/auth/ldap`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         credentials: "include", // Include cookies for refresh_token
//         body: JSON.stringify({ username, password }),
//       })

//       setIsLoading(false)

//       if (!response.ok) {
//         const errorData = await response.json().catch(() => ({}))
//         throw new Error(errorData.message || "Login failed")
//       }

//       return response.json()
//     },
//     // onSuccess: (data) => {
//     //   // Calculate expiration timestamp if not provided by backend
//     //   const expiresAt = data.expiresAt || (Date.now() + 2 * 60 * 1000)
//     //   login(data.user, data.access_token, expiresAt)
//     //   setError(null)
//     // },
//     onSuccess: (data) => {
//       // Calculate expiration timestamp if not provided by backend
//       const expiresAt = data.expiresAt || (Date.now() + 24 * 60 * 60 * 1000)
//       login(data.user, data.access_token, expiresAt)
//       setError(null)
//     },
//     onError: (error: Error) => {
//       setError(error.message)
//     },
//   })

//   const onSubmit = (e: React.FormEvent) => {
//     e.preventDefault()
//     setError(null)
//     loginMutation.mutate({ username, password })
//   }


//   // Don't show dialog until store has hydrated or if user is authenticated
//   if (!hasHydrated || isAuthenticated) {
//     return null
//   }

//   return (
//       <Dialog open={!isAuthenticated && hasHydrated} onOpenChange={() => {}}>
//         <DialogContent className="sm:max-w-[425px]" showCloseButton={false}>
//           <DialogHeader>
//             <DialogTitle className="text-2xl text-center font-semibold drop-shadow-2xl">Energy Accounting & Monitoring</DialogTitle>
//             <DialogDescription className="text-muted-foreground text-center">
//               Enter your credentials to access the dashboard
//             </DialogDescription>
//           </DialogHeader>
//           <form onSubmit={onSubmit} className="space-y-4 mt-4">
//             <div className="space-y-2">
//               <Label htmlFor="username">Username</Label>
//               <Input
//                   id="username"
//                   type="text"
//                   placeholder="Enter username"
//                   value={username}
//                   onChange={(e) => setUsername(e.target.value)}
//                   disabled={loginMutation.isPending}
//                   required
//               />
//             </div>
//             <div className="space-y-2">
//               <Label htmlFor="password">Password</Label>
//               <Input
//                   id="password"
//                   type="password"
//                   placeholder="Enter your password"
//                   value={password}
//                   onChange={(e) => setPassword(e.target.value)}
//                   disabled={loginMutation.isPending}
//                   required
//               />
//             </div>
//             {error && <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">{error}</div>}
//             <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
//               {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
//               Sign In
//             </Button>
//           </form>
//         </DialogContent>
//       </Dialog>
//   )
// }

"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useMsal } from "@azure/msal-react"
import { loginRequest } from "@/lib/msal-config"
import { saveAuthReturnUrl } from "@/lib/auth-return-url"
import { Button } from "@/components/ui/button"
import { Zap, LineChart, ShieldCheck, Users, Loader2 } from "lucide-react"
import { useUserStore } from "@/stores/user-store"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

export function LoginDialog() {
  const { isAuthenticated, login, hasHydrated } = useUserStore()
  const { instance } = useMsal()
  const [error, setError] = useState<string | null>(null)

  const loginMutation = useMutation({
    mutationFn: async () => {
      // Remember deep link (e.g. /regions) — Azure always returns to origin redirectUri
      saveAuthReturnUrl()
      const inProgress = sessionStorage.getItem("msal.interaction.status")
      if (inProgress) sessionStorage.removeItem("msal.interaction.status")
      await instance.loginRedirect(loginRequest)
    },
    onError: (error: Error) => {
      if (error.message?.includes("user_cancelled")) return
      setError(error.message)
    },
  })

  if (!hasHydrated || isAuthenticated) return null

  return (
    <div className="flex h-screen w-full overflow-hidden">

      {/* ── Left — navy + SVG + card ── */}
      <div className="relative flex flex-1 flex-col  overflow-hidden bg-[#0f2d57] px-14 py-12">

        {/* Background SVG */}
        <div className="absolute inset-0 pointer-events-none select-none">
          <svg width="100%" height="100%" viewBox="0 0 680 560" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
            <line x1="0" y1="80" x2="680" y2="80" stroke="white" strokeWidth="0.8" opacity="0.15" fill="none"/>
            <line x1="0" y1="160" x2="680" y2="160" stroke="white" strokeWidth="0.8" opacity="0.15" fill="none"/>
            <line x1="0" y1="240" x2="680" y2="240" stroke="white" strokeWidth="0.8" opacity="0.15" fill="none"/>
            <line x1="0" y1="320" x2="680" y2="320" stroke="white" strokeWidth="0.8" opacity="0.15" fill="none"/>
            <line x1="0" y1="400" x2="680" y2="400" stroke="white" strokeWidth="0.8" opacity="0.15" fill="none"/>
            <line x1="0" y1="480" x2="680" y2="480" stroke="white" strokeWidth="0.8" opacity="0.15" fill="none"/>
            <line x1="80" y1="0" x2="80" y2="560" stroke="white" strokeWidth="0.8" opacity="0.15" fill="none"/>
            <line x1="160" y1="0" x2="160" y2="560" stroke="white" strokeWidth="0.8" opacity="0.15" fill="none"/>
            <line x1="240" y1="0" x2="240" y2="560" stroke="white" strokeWidth="0.8" opacity="0.15" fill="none"/>
            <line x1="320" y1="0" x2="320" y2="560" stroke="white" strokeWidth="0.8" opacity="0.15" fill="none"/>
            <line x1="400" y1="0" x2="400" y2="560" stroke="white" strokeWidth="0.8" opacity="0.15" fill="none"/>
            <line x1="480" y1="0" x2="480" y2="560" stroke="white" strokeWidth="0.8" opacity="0.15" fill="none"/>
            <line x1="560" y1="0" x2="560" y2="560" stroke="white" strokeWidth="0.8" opacity="0.15" fill="none"/>
            <line x1="640" y1="0" x2="640" y2="560" stroke="white" strokeWidth="0.8" opacity="0.15" fill="none"/>
            <line x1="80" y1="0" x2="480" y2="560" stroke="white" strokeWidth="0.8" opacity="0.10" fill="none"/>
            <line x1="160" y1="0" x2="560" y2="560" stroke="white" strokeWidth="0.8" opacity="0.10" fill="none"/>
            <line x1="0" y1="80" x2="400" y2="560" stroke="white" strokeWidth="0.8" opacity="0.08" fill="none"/>
            <line x1="320" y1="0" x2="680" y2="360" stroke="white" strokeWidth="0.8" opacity="0.08" fill="none"/>
            <line x1="110" y1="160" x2="120" y2="280" stroke="white" strokeWidth="0.8" opacity="0.20" fill="none"/>
            <line x1="130" y1="160" x2="120" y2="280" stroke="white" strokeWidth="0.8" opacity="0.20" fill="none"/>
            <line x1="100" y1="185" x2="140" y2="185" stroke="white" strokeWidth="0.8" opacity="0.15" fill="none"/>
            <line x1="104" y1="210" x2="136" y2="210" stroke="white" strokeWidth="0.8" opacity="0.15" fill="none"/>
            <line x1="490" y1="60" x2="500" y2="180" stroke="white" strokeWidth="0.8" opacity="0.20" fill="none"/>
            <line x1="510" y1="60" x2="500" y2="180" stroke="white" strokeWidth="0.8" opacity="0.20" fill="none"/>
            <line x1="480" y1="85" x2="520" y2="85" stroke="white" strokeWidth="0.8" opacity="0.15" fill="none"/>
            <line x1="484" y1="110" x2="516" y2="110" stroke="white" strokeWidth="0.8" opacity="0.15" fill="none"/>
            <line x1="330" y1="380" x2="340" y2="500" stroke="white" strokeWidth="0.8" opacity="0.18" fill="none"/>
            <line x1="350" y1="380" x2="340" y2="500" stroke="white" strokeWidth="0.8" opacity="0.18" fill="none"/>
            <line x1="320" y1="400" x2="360" y2="400" stroke="white" strokeWidth="0.8" opacity="0.14" fill="none"/>
            <path d="M120,185 Q310,230 500,85" stroke="white" strokeWidth="1" opacity="0.18" fill="none"/>
            <path d="M120,210 Q310,260 500,110" stroke="white" strokeWidth="1" opacity="0.14" fill="none"/>
            <path d="M340,400 Q420,340 500,110" stroke="white" strokeWidth="1" opacity="0.18" fill="none"/>
            <path d="M120,210 Q230,340 340,420" stroke="white" strokeWidth="1" opacity="0.14" fill="none"/>
            <circle cx="80" cy="80" r="3" fill="white" opacity="0.20"/>
            <circle cx="240" cy="160" r="3" fill="white" opacity="0.20"/>
            <circle cx="400" cy="160" r="3" fill="white" opacity="0.20"/>
            <circle cx="560" cy="160" r="3" fill="white" opacity="0.20"/>
            <circle cx="160" cy="320" r="3" fill="white" opacity="0.20"/>
            <circle cx="400" cy="320" r="3" fill="white" opacity="0.20"/>
            <circle cx="640" cy="240" r="3" fill="white" opacity="0.20"/>
            <circle cx="120" cy="280" r="14" stroke="white" strokeWidth="0.7" opacity="0.15" fill="none"/>
            <circle cx="120" cy="280" r="9" stroke="white" strokeWidth="0.7" opacity="0.15" fill="none"/>
            <circle cx="120" cy="280" r="4" fill="white" opacity="0.22"/>
            <circle cx="120" cy="280" r="28" stroke="white" strokeWidth="0.7" opacity="0.10" fill="none"/>
            <circle cx="120" cy="280" r="44" stroke="white" strokeWidth="0.7" opacity="0.07" fill="none"/>
            <circle cx="500" cy="180" r="14" stroke="white" strokeWidth="0.7" opacity="0.15" fill="none"/>
            <circle cx="500" cy="180" r="9" stroke="white" strokeWidth="0.7" opacity="0.15" fill="none"/>
            <circle cx="500" cy="180" r="4" fill="white" opacity="0.22"/>
            <circle cx="500" cy="180" r="28" stroke="white" strokeWidth="0.7" opacity="0.10" fill="none"/>
            <circle cx="500" cy="180" r="44" stroke="white" strokeWidth="0.7" opacity="0.07" fill="none"/>
            <circle cx="340" cy="500" r="12" stroke="white" strokeWidth="0.7" opacity="0.15" fill="none"/>
            <circle cx="340" cy="500" r="7" stroke="white" strokeWidth="0.7" opacity="0.15" fill="none"/>
            <polygon points="610,30 598,70 608,70 596,110 622,62 610,62" fill="white" opacity="0.15"/>
            <polygon points="50,400 40,432 48,432 38,464 58,424 50,424" fill="white" opacity="0.12"/>
          </svg>
        </div>

        {/* Tagline */}
        <div className="relative z-10 mb-6 max-w-sm">
          <h2 className="mb-2 text-xl font-medium drop-shadow-2xl leading-snug text-white whitespace-nowrap">
              Energy Accounting & Monitoring System
          </h2>
          <p className="text-sm leading-relaxed text-white/55">
            Monitor consumption, track meters, and analyze distribution across all regions.
          </p>
        </div>

        {/* Login card */}
        <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0f2d57]">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-sm font-medium text-slate-700">Energy Accounting & Monitoring</span>
          </div>

          <h1 className="mb-1 text-xl font-medium text-slate-900">Welcome back</h1>
          <p className="mb-6 text-sm text-slate-500">
            Sign in with your organization account to access the dashboard.
          </p>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <Button
            className="w-full"
            
            onClick={() => loginMutation.mutate()}
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <MicrosoftIcon className="mr-2 h-[18px] w-[18px]" />
            )}
            Sign in with Microsoft
          </Button>

          <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
            <div className="h-px flex-1 bg-slate-200" />
            or
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <p className="text-center text-xs text-slate-400">
            Contact your administrator if you don't have access.
          </p>
        </div>

      </div>

      {/* ── Right — light panel ── */}
      <div className="flex w-[420px] flex-col items-center justify-end pb-16 gap-6 bg-slate-50 px-12 py-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#0f2d57]">
          <LineChart className="h-7 w-7 text-white" />
        </div>
        <p className="text-center text-lg font-medium leading-snug text-slate-900">
          Energy insights at your fingertips
        </p>
        <div className="h-px w-8 bg-slate-300" />
        <p className="text-center text-sm leading-relaxed text-slate-600">
          Monitor consumption, track meters, and analyze distribution across all regions.
        </p>
        <div className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
          <ShieldCheck className="h-4 w-4 text-[#0f2d57]" />
          <span className="text-xs font-medium text-slate-700">Secured with Microsoft Entra ID</span>
        </div>
        <div className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
          <Users className="h-4 w-4 text-[#0f2d57]" />
          <span className="text-xs font-medium text-slate-700">Organization accounts only</span>
        </div>
      </div>

    </div>
  )
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  )
}