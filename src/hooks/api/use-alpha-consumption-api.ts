"use client"

import { useQuery } from "@tanstack/react-query"
import {
  AlphaConsumptionAggregateItem,
  AlphaConsumptionAggregateResponse,
  AlphaConsumptionDetail,
  AlphaConsumptionDetailResponse,
} from "@/types/api"
import { fetchWithTimeout } from "@/lib/utils"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

export type AlphaConsumptionGroupBy = "substation" | "energy_code"

interface AlphaConsumptionAggregateParams {
  dateFrom: string
  dateTo: string
  groupBy?: AlphaConsumptionGroupBy
  substation?: string
  energyCode?: string
  enabled?: boolean
}

// dateFrom/dateTo filter directly against alpha_tnd_consumption_raw's real
// fromdatetime column — same as Holley/PNS, no billmonth-label resolution.
// Unlike every other legacy source here, there's no region/district at
// all, only a substation name. See
// ea-bknd-3/internal/alphaconsumption's package doc comment.
export function useAlphaConsumptionAggregate(params: AlphaConsumptionAggregateParams) {
  const queryString = new URLSearchParams()

  if (params.dateFrom) queryString.append("dateFrom", params.dateFrom)
  if (params.dateTo) queryString.append("dateTo", params.dateTo)
  if (params.groupBy) queryString.append("groupBy", params.groupBy)
  if (params.substation) queryString.append("substation", params.substation)
  if (params.energyCode) queryString.append("energyCode", params.energyCode)

  return useQuery<AlphaConsumptionAggregateItem[]>({
    queryKey: [
      "alpha-consumption-aggregate",
      params.dateFrom,
      params.dateTo,
      params.groupBy,
      params.substation,
      params.energyCode,
    ],
    enabled: params.enabled !== false && Boolean(params.dateFrom && params.dateTo),
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/meters/consumption/alpha-consumption/aggregate?${queryString.toString()}`
      const response = await fetchWithTimeout(url, 30000)
      if (!response.ok) {
        throw new Error(`Failed to fetch alpha consumption aggregate: ${response.status}`)
      }
      const data: AlphaConsumptionAggregateResponse = await response.json()
      return data.data || []
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
  })
}

interface AlphaConsumptionDetailParams {
  dateFrom: string
  dateTo: string
  substation?: string
  energyCode?: string
  search?: string
  page?: number
  limit?: number
  /** "consumer_name" | "value" | "from_date" — matches the backend's
   * detailSortColumn whitelist exactly. Anything else falls back to the
   * server's stable default order. */
  sortBy?: string
  sortOrder?: "asc" | "desc"
  enabled?: boolean
}

/** Returns the full paginated envelope ({data, total, page, limit,
 * total_pages}) — never just the row array. This endpoint caps `limit` at
 * 500 per request server-side, so `total`/`total_pages` are the only way
 * to know the true match count and page through the rest. */
export function useAlphaConsumptionDetail(params: AlphaConsumptionDetailParams) {
  const queryString = new URLSearchParams()

  if (params.dateFrom) queryString.append("dateFrom", params.dateFrom)
  if (params.dateTo) queryString.append("dateTo", params.dateTo)
  if (params.substation) queryString.append("substation", params.substation)
  if (params.energyCode) queryString.append("energyCode", params.energyCode)
  if (params.search) queryString.append("search", params.search)
  if (params.page) queryString.append("page", params.page.toString())
  if (params.limit) queryString.append("limit", params.limit.toString())
  if (params.sortBy) queryString.append("sortBy", params.sortBy)
  if (params.sortOrder) queryString.append("sortOrder", params.sortOrder)

  return useQuery<AlphaConsumptionDetailResponse>({
    queryKey: [
      "alpha-consumption-detail",
      params.dateFrom,
      params.dateTo,
      params.substation,
      params.energyCode,
      params.search,
      params.page,
      params.limit,
      params.sortBy,
      params.sortOrder,
    ],
    enabled: params.enabled !== false && Boolean(params.dateFrom && params.dateTo),
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/meters/consumption/alpha-consumption/detail?${queryString.toString()}`
      const response = await fetchWithTimeout(url, 30000)
      if (!response.ok) {
        throw new Error(`Failed to fetch alpha consumption detail: ${response.status}`)
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
  })
}

function detailUrl(params: Omit<AlphaConsumptionDetailParams, "page" | "limit" | "enabled">, page: number): string {
  const qs = new URLSearchParams()
  if (params.dateFrom) qs.append("dateFrom", params.dateFrom)
  if (params.dateTo) qs.append("dateTo", params.dateTo)
  if (params.substation) qs.append("substation", params.substation)
  if (params.energyCode) qs.append("energyCode", params.energyCode)
  if (params.search) qs.append("search", params.search)
  if (params.sortBy) qs.append("sortBy", params.sortBy)
  if (params.sortOrder) qs.append("sortOrder", params.sortOrder)
  qs.append("page", page.toString())
  qs.append("limit", "500") // the server's own per-request cap
  return `${API_BASE_URL}/api/v1/meters/consumption/alpha-consumption/detail?${qs.toString()}`
}

/** Fetches every matching row across all pages for a full export — the
 * paginated table view only ever holds one page in memory, but "Download"
 * of the result set means the whole thing. Page 1 first to learn
 * total_pages, then the rest run in parallel. */
export async function fetchAllAlphaConsumptionDetail(
  params: Omit<AlphaConsumptionDetailParams, "page" | "limit" | "enabled">,
): Promise<AlphaConsumptionDetail[]> {
  const first = await fetchWithTimeout(detailUrl(params, 1), 30000)
  if (!first.ok) throw new Error(`Failed to fetch alpha consumption detail: ${first.status}`)
  const firstPage: AlphaConsumptionDetailResponse = await first.json()
  const all = [...(firstPage.data || [])]

  if (firstPage.total_pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: firstPage.total_pages - 1 }, (_, i) => i + 2).map(async (page) => {
        const res = await fetchWithTimeout(detailUrl(params, page), 30000)
        if (!res.ok) throw new Error(`Failed to fetch alpha consumption detail (page ${page}): ${res.status}`)
        const json: AlphaConsumptionDetailResponse = await res.json()
        return json.data || []
      }),
    )
    for (const page of rest) all.push(...page)
  }

  return all
}
