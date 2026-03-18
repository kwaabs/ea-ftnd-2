"use client"

import type React from "react"

import { useUserStore } from "@/stores/user-store"
import { Header } from "./header"
import { Sidebar } from "./sidebar"
import { useSidebarStore } from "@/stores/sidebar-store"
import { cn } from "@/lib/utils"

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useUserStore()
  const { isCollapsed } = useSidebarStore()

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className={cn("transition-all duration-300", isCollapsed ? "ml-16" : "ml-64")}>
        <Header />
        <main className="p-6 bg-zinc-100">{children}</main>
      </div>
    </div>
  )
}
