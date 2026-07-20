"use client"

import useSWR from "swr"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

export interface Announcement {
  id: string
  body: string
  author_email: string
  author_name?: string | null
  active: boolean
  created_at: string
  updated_at: string
}

interface ListResponse {
  success: boolean
  count: number
  data: Announcement[]
}

interface MutationResponse {
  success: boolean
  message?: string
  data?: Announcement
}

const fetcher = async (url: string): Promise<ListResponse> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error("Failed to fetch announcements")
  return response.json()
}

export function useAnnouncements(options?: { refreshInterval?: number }) {
  const { data, error, isLoading, mutate } = useSWR<ListResponse>(
    `${API_BASE_URL}/api/v1/announcements`,
    fetcher,
    { refreshInterval: options?.refreshInterval ?? 30_000 },
  )

  return {
    announcements: data?.data ?? [],
    count: data?.count ?? 0,
    isLoading,
    error,
    mutate,
  }
}

export async function createAnnouncement(payload: {
  body: string
  author_email: string
  author_name?: string
}): Promise<MutationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/announcements`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const json = await response.json()
  if (!response.ok) {
    throw new Error(json?.message || "Failed to create announcement")
  }
  return json
}

export async function deleteAnnouncement(id: string, authorEmail: string): Promise<MutationResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/announcements/${id}?author_email=${encodeURIComponent(authorEmail)}`,
    { method: "DELETE" },
  )
  const json = await response.json()
  if (!response.ok) {
    throw new Error(json?.message || "Failed to delete announcement")
  }
  return json
}
