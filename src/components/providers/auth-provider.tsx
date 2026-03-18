"use client"

import type React from "react"

import { LoginDialog } from "@/components/auth/login-dialog"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Store handles its own rehydration via onRehydrateStorage callback
  // No need to manually manage auth state here
  
  return (
    <>
      <LoginDialog />
      {children}
    </>
  )
}
