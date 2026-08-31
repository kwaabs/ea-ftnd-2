"use client"

import { useQuery } from "@tanstack/react-query"
import { SalesSummary } from "@/types/api"
import { fetchWithTimeout } from "@/lib/utils"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

export type SalesSummaryCategory = "prepaid" | "postpaid"
export type SalesSummaryGroupBy = "region" | "district"

interface SalesSummaryParams {
  category: SalesSummaryCategory
  dateFrom: string
  dateTo: string
  groupBy?: SalesSummaryGroupBy
  region?: string
  district?: string
  enabled?: boolean
}

// The canonical cross-source Prepaid/Postpaid totals endpoint
// (ea-bknd-3/internal/salessummary). Use this instead of fetching every
// raw source (Zeus, MMS, BOT, BXC, ...) and merging them by hand — that
// hand-merge logic is exactly what went stale repeatedly as new sources
// were added. Adding a future source only requires this hook's callers to
// re-fetch; no merge logic here needs to change.
export function useSalesSummary(params: SalesSummaryParams) {
  const queryString = new URLSearchParams()

  queryString.append("category", params.category)
  if (params.dateFrom) queryString.append("dateFrom", params.dateFrom)
  if (params.dateTo) queryString.append("dateTo", params.dateTo)
  if (params.groupBy) queryString.append("groupBy", params.groupBy)
  if (params.region) queryString.append("region", params.region)
  if (params.district) queryString.append("district", params.district)

  return useQuery<SalesSummary>({
    queryKey: [
      "sales-summary",
      params.category,
      params.dateFrom,
      params.dateTo,
      params.groupBy,
      params.region,
      params.district,
    ],
    enabled: params.enabled !== false && Boolean(params.dateFrom && params.dateTo),
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/meters/consumption/customer-sales-summary?${queryString.toString()}`
      const response = await fetchWithTimeout(url, 30000)
      if (!response.ok) {
        throw new Error(`Failed to fetch sales summary: ${response.status}`)
      }
      return (await response.json()) as SalesSummary
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
  })
}
