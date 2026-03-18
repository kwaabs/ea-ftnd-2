"use client"

import type React from "react"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import NProgress from "nprogress"

// Configure nprogress
NProgress.configure({
  showSpinner: false,
  trickleSpeed: 200,
  minimum: 0.08,
})

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  useEffect(() => {
    console.log("[v0] Navigation detected - Starting progress bar. Pathname:", pathname)

    // Start progress bar
    NProgress.start()

    // Complete after a short delay to allow route transition
    const timeout = setTimeout(() => {
      console.log("[v0] Progress bar completed")
      NProgress.done()
    }, 100)

    return () => {
      clearTimeout(timeout)
      NProgress.done()
    }
  }, [pathname])

  return <>{children}</>
}
