"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { useUserStore } from "@/stores/user-store"
import { useMutation } from "@tanstack/react-query"
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

export function LoginDialog() {
  const { isAuthenticated, login, hasHydrated } = useUserStore()
  const [error, setError] = useState<string | null>(null)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isMounted, setIsMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  console.log("[v0] LoginDialog - Render", { isAuthenticated, hasHydrated })

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const loginMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      setIsLoading(true)
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/ldap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Include cookies for refresh_token
        body: JSON.stringify({ username, password }),
      })

      setIsLoading(false)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || "Login failed")
      }

      return response.json()
    },
    onSuccess: (data) => {
      login(data.user, data.access_token)
      setError(null)
    },
    onError: (error: Error) => {
      setError(error.message)
    },
  })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    loginMutation.mutate({ username, password })
  }


  // Don't show dialog until store has hydrated or if user is authenticated
  if (!hasHydrated || isAuthenticated) {
    return null
  }

  return (
      <Dialog open={!isAuthenticated && hasHydrated} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[425px]" hideCloseButton>
          <DialogHeader>
            <DialogTitle className="text-2xl text-center font-semibold drop-shadow-2xl">Energy Accounting & Monitoring</DialogTitle>
            <DialogDescription className="text-muted-foreground text-center">
              Enter your credentials to access the dashboard
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                  id="username"
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loginMutation.isPending}
                  required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loginMutation.isPending}
                  required
              />
            </div>
            {error && <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">{error}</div>}
            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </form>
        </DialogContent>
      </Dialog>
  )
}
