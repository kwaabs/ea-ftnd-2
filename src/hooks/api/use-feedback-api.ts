"use client"

import useSWR from "swr"
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

export type FeedbackStatus = "PENDING" | "IN_PROGRESS" | "RESOLVED"

export interface Reply {
  id: number
  email: string
  comments: string
  parent_id: number
  created_at: string
  updated_at: string
}

export interface Feedback {
  id: number
  email: string
  type: "COMPLAINT" | "COMMENT"
  comments: string
  status: FeedbackStatus
  parent_id: number | null
  created_at: string
  updated_at: string
  replies?: Reply[]
}

interface FeedbackListResponse {
  success: boolean
  count: number
  data: Feedback[]
  limit: number
  offset: number
}

interface SubmitFeedbackPayload {
  email: string
  type: "COMPLAINT" | "COMMENT"
  comments: string
}

interface SubmitReplyPayload {
  email: string
  comments: string
  parent_id: number
}

interface SubmitFeedbackResponse {
  success: boolean
  message: string
}

interface SingleFeedbackResponse {
  success: boolean
  data: Feedback
}

interface UpdateStatusResponse {
  success: boolean
  message: string
  data: Feedback
}

// Hook to fetch all feedback with pagination
export function useAllFeedback(limit = 50, offset = 0) {
  const url = `${API_BASE_URL}/api/v1/feedback?limit=${limit}&offset=${offset}`

  const { data, error, isLoading, mutate } = useSWR<FeedbackListResponse>(url, async (url: string) => {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error("Failed to fetch feedback")
    }
    return response.json()
  })

  return {
    feedback: data?.data || [],
    count: data?.count || 0,
    isLoading,
    error,
    mutate,
  }
}

// Hook to fetch single feedback with replies
export function useFeedback(id: number | null) {
  const url = id ? `${API_BASE_URL}/api/v1/feedback/${id}` : null

  const { data, error, isLoading, mutate } = useSWR<SingleFeedbackResponse>(url, async (url: string) => {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error("Failed to fetch feedback")
    }
    return response.json()
  })

  return {
    feedback: data?.data || null,
    isLoading,
    error,
    mutate,
  }
}

// Function to submit new feedback
export async function submitFeedback(payload: SubmitFeedbackPayload): Promise<SubmitFeedbackResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error("Failed to submit feedback")
  }

  return response.json()
}

// Function to submit reply to feedback
export async function submitReply(payload: SubmitReplyPayload): Promise<SubmitFeedbackResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error("Failed to submit reply")
  }

  return response.json()
}

// Function to delete feedback
export async function deleteFeedback(id: number): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/feedback/${id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    throw new Error("Failed to delete comment")
  }

  return response.json()
}

// Function to update feedback status
export async function updateFeedbackStatus(id: number, status: FeedbackStatus): Promise<UpdateStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/feedback/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  })

  if (!response.ok) {
    throw new Error("Failed to update status")
  }

  return response.json()
}
