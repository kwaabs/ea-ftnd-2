"use client"

import { useQuery } from "@tanstack/react-query"
import { formatApiDate } from "@/lib/utils"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

export interface AmrMeterStatusSummary {
  total: number
  online: number
  offline_no_data: number
  offline_no_record: number
  total_offline: number
  online_percentage: number
  offline_percentage: number
  avg_uptime_percentage: number
  total_consumption_kwh: number
  filters_applied?: Record<string, unknown>
}

export interface AmrStatusTimelineEntry {
  date: string
  online: number
  offline: number
  total: number
}

export interface AmrStatusTimelineResponse {
  data: AmrStatusTimelineEntry[]
  date_range: {
    from: string
    to: string
  }
}

export interface AmrMeterStatusDetail {
  meter_number: string
  region?: string
  district?: string
  community?: string
  customer_name?: string
  account_no?: string
  tariff_class?: string
  contract_status?: string
  service_type?: string
  status: string
  last_consumption_date?: string
  total_consumption_kwh: number
  uptime_percentage: number
  days_offline: number
  last_reading_time?: string
}

export interface AmrMeterStatusDetailResponse {
  data: AmrMeterStatusDetail[]
  pagination: {
    page: number
    limit: number
    total_records: number
    total_pages: number
    has_more: boolean
  }
}

interface AmrStatusParams {
  dateFrom: string
  dateTo: string
  region?: string
  district?: string
  meterNumber?: string
  sltType?: string
  search?: string
  status?: "ONLINE" | "OFFLINE" | string
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: "asc" | "desc"
  enabled?: boolean
}

function buildQueryString(params: AmrStatusParams): string {
  const q = new URLSearchParams()
  q.append("dateFrom", formatApiDate(params.dateFrom))
  q.append("dateTo", formatApiDate(params.dateTo))
  if (params.region) q.append("region", params.region)
  if (params.district) q.append("district", params.district)
  if (params.meterNumber) q.append("meterNumber", params.meterNumber)
  if (params.sltType) q.append("sltType", params.sltType)
  if (params.search) q.append("search", params.search)
  if (params.status) q.append("status", params.status)
  if (params.page) q.append("page", String(params.page))
  if (params.limit) q.append("limit", String(params.limit))
  if (params.sortBy) q.append("sortBy", params.sortBy)
  if (params.sortOrder) q.append("sortOrder", params.sortOrder)
  return q.toString()
}

export function useAmrStatusSummary(params: AmrStatusParams) {
  const { enabled = true, ...rest } = params
  const queryString = buildQueryString(rest)

  return useQuery<AmrMeterStatusSummary>({
    queryKey: ["amr-status-summary", queryString],
    enabled,
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/v1/amr/status/summary?${queryString}`)
      if (!res.ok) throw new Error(`Failed to fetch AMR status summary: ${res.status}`)
      const body = await res.json()
      return body.data
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
  })
}

export function useAmrStatusTimeline(params: AmrStatusParams) {
  const { enabled = true, ...rest } = params
  const queryString = buildQueryString(rest)

  return useQuery<AmrStatusTimelineEntry[]>({
    queryKey: ["amr-status-timeline", queryString],
    enabled,
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/v1/amr/status/timeline?${queryString}`)
      if (!res.ok) throw new Error(`Failed to fetch AMR status timeline: ${res.status}`)
      const body = await res.json()
      // API wraps AmrMeterStatusTimeline as data
      const timeline = body.data
      if (Array.isArray(timeline)) return timeline
      return timeline?.data || []
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
  })
}

export function useAmrStatusDetails(params: AmrStatusParams) {
  const { enabled = true, ...rest } = params
  const queryString = buildQueryString(rest)

  return useQuery<AmrMeterStatusDetailResponse>({
    queryKey: ["amr-status-details", queryString],
    enabled,
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/v1/amr/status/details?${queryString}`)
      if (!res.ok) throw new Error(`Failed to fetch AMR status details: ${res.status}`)
      const body = await res.json()
      return (
        body.data || {
          data: [],
          pagination: {
            page: 1,
            limit: 50,
            total_records: 0,
            total_pages: 0,
            has_more: false,
          },
        }
      )
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
  })
}
