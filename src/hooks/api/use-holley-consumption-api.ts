"use client"

import { useQuery } from "@tanstack/react-query"
import {
  HolleyConsumptionAggregateItem,
  HolleyConsumptionAggregateResponse,
  HolleyConsumptionDetail,
  HolleyConsumptionDetailResponse,
} from "@/types/api"
import { fetchWithTimeout } from "@/lib/utils"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

export type HolleyConsumptionGroupBy = "region" | "district" | "tariff"

interface HolleyConsumptionAggregateParams {
  dateFrom: string
  dateTo: string
  groupBy?: HolleyConsumptionGroupBy
  region?: string
  district?: string
  tariff?: string
  enabled?: boolean
}

// dateFrom/dateTo filter directly against holley_consumption's real
// date_time column (day precision) — unlike BOT/BXC, no billmonth-label
// resolution on the backend. region/district here are human-readable
// names, unlike PNS's opaque regionid/districtid codes. See
// ea-bknd-3/internal/holleyconsumption's package doc comment.
export function useHolleyConsumptionAggregate(params: HolleyConsumptionAggregateParams) {
  const queryString = new URLSearchParams()

  if (params.dateFrom) queryString.append("dateFrom", params.dateFrom)
  if (params.dateTo) queryString.append("dateTo", params.dateTo)
  if (params.groupBy) queryString.append("groupBy", params.groupBy)
  if (params.region) queryString.append("region", params.region)
  if (params.district) queryString.append("district", params.district)
  if (params.tariff) queryString.append("tariff", params.tariff)

  return useQuery<HolleyConsumptionAggregateItem[]>({
    queryKey: [
      "holley-consumption-aggregate",
      params.dateFrom,
      params.dateTo,
      params.groupBy,
      params.region,
      params.district,
      params.tariff,
    ],
    enabled: params.enabled !== false && Boolean(params.dateFrom && params.dateTo),
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/meters/consumption/holley-consumption/aggregate?${queryString.toString()}`
      const response = await fetchWithTimeout(url, 30000)
      if (!response.ok) {
        throw new Error(`Failed to fetch holley consumption aggregate: ${response.status}`)
      }
      const data: HolleyConsumptionAggregateResponse = await response.json()
      return data.data || []
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
  })
}

interface HolleyConsumptionDetailParams {
  dateFrom: string
  dateTo: string
  region?: string
  district?: string
  tariff?: string
  search?: string
  page?: number
  limit?: number
  /** "customer_name" | "consumption_kwh" | "date_time" — matches the
   * backend's detailSortColumn whitelist exactly. Anything else falls
   * back to the server's stable default order. */
  sortBy?: string
  sortOrder?: "asc" | "desc"
  enabled?: boolean
}

/** Returns the full paginated envelope ({data, total, page, limit,
 * total_pages}) — never just the row array. This endpoint caps `limit` at
 * 500 per request server-side, so `total`/`total_pages` are the only way
 * to know the true match count and page through the rest. */
export function useHolleyConsumptionDetail(params: HolleyConsumptionDetailParams) {
  const queryString = new URLSearchParams()

  if (params.dateFrom) queryString.append("dateFrom", params.dateFrom)
  if (params.dateTo) queryString.append("dateTo", params.dateTo)
  if (params.region) queryString.append("region", params.region)
  if (params.district) queryString.append("district", params.district)
  if (params.tariff) queryString.append("tariff", params.tariff)
  if (params.search) queryString.append("search", params.search)
  if (params.page) queryString.append("page", params.page.toString())
  if (params.limit) queryString.append("limit", params.limit.toString())
  if (params.sortBy) queryString.append("sortBy", params.sortBy)
  if (params.sortOrder) queryString.append("sortOrder", params.sortOrder)

  return useQuery<HolleyConsumptionDetailResponse>({
    queryKey: [
      "holley-consumption-detail",
      params.dateFrom,
      params.dateTo,
      params.region,
      params.district,
      params.tariff,
      params.search,
      params.page,
      params.limit,
      params.sortBy,
      params.sortOrder,
    ],
    enabled: params.enabled !== false && Boolean(params.dateFrom && params.dateTo),
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/meters/consumption/holley-consumption/detail?${queryString.toString()}`
      const response = await fetchWithTimeout(url, 30000)
      if (!response.ok) {
        throw new Error(`Failed to fetch holley consumption detail: ${response.status}`)
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
  })
}

function detailUrl(params: Omit<HolleyConsumptionDetailParams, "page" | "limit" | "enabled">, page: number): string {
  const qs = new URLSearchParams()
  if (params.dateFrom) qs.append("dateFrom", params.dateFrom)
  if (params.dateTo) qs.append("dateTo", params.dateTo)
  if (params.region) qs.append("region", params.region)
  if (params.district) qs.append("district", params.district)
  if (params.tariff) qs.append("tariff", params.tariff)
  if (params.search) qs.append("search", params.search)
  if (params.sortBy) qs.append("sortBy", params.sortBy)
  if (params.sortOrder) qs.append("sortOrder", params.sortOrder)
  qs.append("page", page.toString())
  qs.append("limit", "500") // the server's own per-request cap
  return `${API_BASE_URL}/api/v1/meters/consumption/holley-consumption/detail?${qs.toString()}`
}

/** Fetches every matching row across all pages for a full export — the
 * paginated table view only ever holds one page in memory, but "Download"
 * of the result set means the whole thing. Page 1 first to learn
 * total_pages, then the rest run in parallel. */
export async function fetchAllHolleyConsumptionDetail(
  params: Omit<HolleyConsumptionDetailParams, "page" | "limit" | "enabled">,
): Promise<HolleyConsumptionDetail[]> {
  const first = await fetchWithTimeout(detailUrl(params, 1), 30000)
  if (!first.ok) throw new Error(`Failed to fetch holley consumption detail: ${first.status}`)
  const firstPage: HolleyConsumptionDetailResponse = await first.json()
  const all = [...(firstPage.data || [])]

  if (firstPage.total_pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: firstPage.total_pages - 1 }, (_, i) => i + 2).map(async (page) => {
        const res = await fetchWithTimeout(detailUrl(params, page), 30000)
        if (!res.ok) throw new Error(`Failed to fetch holley consumption detail (page ${page}): ${res.status}`)
        const json: HolleyConsumptionDetailResponse = await res.json()
        return json.data || []
      }),
    )
    for (const page of rest) all.push(...page)
  }

  return all
}
