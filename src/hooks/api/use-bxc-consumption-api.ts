"use client"

import { useQuery } from "@tanstack/react-query"
import {
  BxcConsumptionAggregateItem,
  BxcConsumptionAggregateResponse,
  BxcConsumptionDetail,
  BxcConsumptionDetailResponse,
} from "@/types/api"
import { fetchWithTimeout } from "@/lib/utils"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

export type BxcConsumptionGroupBy = "region" | "district" | "tariff" | "billmonth"

interface BxcConsumptionAggregateParams {
  dateFrom: string
  dateTo: string
  groupBy?: BxcConsumptionGroupBy
  region?: string
  district?: string
  tariff?: string
  billMonth?: string
  enabled?: boolean
}

// dateFrom/dateTo are month-precision only on this source — the backend
// resolves them to whichever billmonth labels ("JULY-2026") the range
// overlaps, day-of-month is ignored. See
// ea-bknd-3/internal/bxcconsumption/service.go's resolveDateRangeToBillMonths.
export function useBxcConsumptionAggregate(params: BxcConsumptionAggregateParams) {
  const queryString = new URLSearchParams()

  if (params.dateFrom) queryString.append("dateFrom", params.dateFrom)
  if (params.dateTo) queryString.append("dateTo", params.dateTo)
  if (params.groupBy) queryString.append("groupBy", params.groupBy)
  if (params.region) queryString.append("region", params.region)
  if (params.district) queryString.append("district", params.district)
  if (params.tariff) queryString.append("tariff", params.tariff)
  if (params.billMonth) queryString.append("billMonth", params.billMonth)

  return useQuery<BxcConsumptionAggregateItem[]>({
    queryKey: [
      "bxc-consumption-aggregate",
      params.dateFrom,
      params.dateTo,
      params.groupBy,
      params.region,
      params.district,
      params.tariff,
      params.billMonth,
    ],
    enabled: params.enabled !== false && Boolean(params.dateFrom && params.dateTo),
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/meters/consumption/bxc-consumption/aggregate?${queryString.toString()}`
      const response = await fetchWithTimeout(url, 30000)
      if (!response.ok) {
        throw new Error(`Failed to fetch bxc consumption aggregate: ${response.status}`)
      }
      const data: BxcConsumptionAggregateResponse = await response.json()
      return data.data || []
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
  })
}

interface BxcConsumptionDetailParams {
  dateFrom: string
  dateTo: string
  region?: string
  district?: string
  tariff?: string
  billMonth?: string
  search?: string
  page?: number
  limit?: number
  /** "customer_name" | "kwh" | "bill_month" — matches the backend's
   * detailSortColumn whitelist exactly. Anything else falls back to the
   * server's stable default order. */
  sortBy?: string
  sortOrder?: "asc" | "desc"
  enabled?: boolean
}

/** Returns the full paginated envelope ({data, total, page, limit,
 * total_pages}) — never just the row array. This endpoint caps `limit` at
 * 500 per request server-side, so `total`/`total_pages` are the only way
 * to know the true match count and page through the rest; treating
 * `data.length` as if it were the grand total (as this hook used to)
 * silently hid every row past the first 500 for any query with more. */
export function useBxcConsumptionDetail(params: BxcConsumptionDetailParams) {
  const queryString = new URLSearchParams()

  if (params.dateFrom) queryString.append("dateFrom", params.dateFrom)
  if (params.dateTo) queryString.append("dateTo", params.dateTo)
  if (params.region) queryString.append("region", params.region)
  if (params.district) queryString.append("district", params.district)
  if (params.tariff) queryString.append("tariff", params.tariff)
  if (params.billMonth) queryString.append("billMonth", params.billMonth)
  if (params.search) queryString.append("search", params.search)
  if (params.page) queryString.append("page", params.page.toString())
  if (params.limit) queryString.append("limit", params.limit.toString())
  if (params.sortBy) queryString.append("sortBy", params.sortBy)
  if (params.sortOrder) queryString.append("sortOrder", params.sortOrder)

  return useQuery<BxcConsumptionDetailResponse>({
    queryKey: [
      "bxc-consumption-detail",
      params.dateFrom,
      params.dateTo,
      params.region,
      params.district,
      params.tariff,
      params.billMonth,
      params.search,
      params.page,
      params.limit,
      params.sortBy,
      params.sortOrder,
    ],
    enabled: params.enabled !== false && Boolean(params.dateFrom && params.dateTo),
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/meters/consumption/bxc-consumption/detail?${queryString.toString()}`
      const response = await fetchWithTimeout(url, 30000)
      if (!response.ok) {
        throw new Error(`Failed to fetch bxc consumption detail: ${response.status}`)
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
  })
}

function detailUrl(params: Omit<BxcConsumptionDetailParams, "page" | "limit" | "enabled">, page: number): string {
  const qs = new URLSearchParams()
  if (params.dateFrom) qs.append("dateFrom", params.dateFrom)
  if (params.dateTo) qs.append("dateTo", params.dateTo)
  if (params.region) qs.append("region", params.region)
  if (params.district) qs.append("district", params.district)
  if (params.tariff) qs.append("tariff", params.tariff)
  if (params.billMonth) qs.append("billMonth", params.billMonth)
  if (params.search) qs.append("search", params.search)
  if (params.sortBy) qs.append("sortBy", params.sortBy)
  if (params.sortOrder) qs.append("sortOrder", params.sortOrder)
  qs.append("page", page.toString())
  qs.append("limit", "500") // the server's own per-request cap
  return `${API_BASE_URL}/api/v1/meters/consumption/bxc-consumption/detail?${qs.toString()}`
}

/** Fetches every matching row across all pages for a full export — the
 * paginated table view only ever holds one page in memory, but "Download"
 * of the result set means the whole thing. Page 1 first to learn
 * total_pages, then the rest run in parallel. */
export async function fetchAllBxcConsumptionDetail(
  params: Omit<BxcConsumptionDetailParams, "page" | "limit" | "enabled">,
): Promise<BxcConsumptionDetail[]> {
  const first = await fetchWithTimeout(detailUrl(params, 1), 30000)
  if (!first.ok) throw new Error(`Failed to fetch bxc consumption detail: ${first.status}`)
  const firstPage: BxcConsumptionDetailResponse = await first.json()
  const all = [...(firstPage.data || [])]

  if (firstPage.total_pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: firstPage.total_pages - 1 }, (_, i) => i + 2).map(async (page) => {
        const res = await fetchWithTimeout(detailUrl(params, page), 30000)
        if (!res.ok) throw new Error(`Failed to fetch bxc consumption detail (page ${page}): ${res.status}`)
        const json: BxcConsumptionDetailResponse = await res.json()
        return json.data || []
      }),
    )
    for (const page of rest) all.push(...page)
  }

  return all
}
