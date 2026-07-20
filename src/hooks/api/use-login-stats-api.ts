"use client"

import useSWR from "swr"
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

export interface DailyLoginCount {
    date: string
    count: number
}

export interface ProviderLoginCount {
    provider: string
    count: number
}

export interface UserLoginFrequency {
    email: string
    name: string
    provider: string
    login_count: number
    last_login_at: string
}

export interface RecentLoginEvent {
    email: string
    name: string
    provider: string
    device_info?: string
    created_at: string
}

export interface LoginStatsResponse {
    success: boolean
    from: string
    to: string
    total_logins: number
    unique_users: number
    by_day: DailyLoginCount[]
    by_provider: ProviderLoginCount[]
    by_user: UserLoginFrequency[]
    recent_events: RecentLoginEvent[]
}

export function useLoginStats(from?: string, to?: string) {
    const params = new URLSearchParams()
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    const qs = params.toString()
    const url = `${API_BASE_URL}/api/v1/admin/login-stats${qs ? `?${qs}` : ""}`

    const { data, error, isLoading, mutate } = useSWR<LoginStatsResponse>(url, async (url: string) => {
        const response = await fetch(url)
        if (!response.ok) {
            throw new Error("Failed to fetch login stats")
        }
        return response.json()
    })

    return {
        stats: data,
        isLoading,
        error,
        mutate,
    }
}
