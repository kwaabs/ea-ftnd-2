"use client"

import { useQuery } from "@tanstack/react-query"
import { MmsCustomerSalesDetail, MmsCustomerSalesDetailResponse } from "@/types/api"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

interface MmsCustomerSalesDetailParams {
  dateFrom: string
  dateTo: string
  region?: string
  district?: string
  manufacturer?: string
  model?: string
  search?: string
  page?: number
  limit?: number
  /** "customer_name" | "sts_last_month_kwh_read" | "sts_last_month_credit_read"
   * | "sts_credit_balance_remaining" | "date_time" — matches the backend's
   * detailSortColumn whitelist exactly. Anything else falls back to the
   * server's stable default order. */
  sortBy?: string
  sortOrder?: "asc" | "desc"
}

/** Returns the full paginated envelope ({data, total, page, limit,
 * total_pages}) — never just the row array. This endpoint caps `limit` at
 * 500 per request server-side, so `total`/`total_pages` are the only way
 * to know the true match count and page through the rest; treating
 * `data.length` as if it were the grand total (as this hook used to)
 * silently hid every row past the first 500 for any query with more. */
export function useMmsCustomerSalesDetail(params: MmsCustomerSalesDetailParams) {
  const queryString = new URLSearchParams()

  if (params.dateFrom) queryString.append("dateFrom", params.dateFrom)
  if (params.dateTo) queryString.append("dateTo", params.dateTo)
  if (params.region) queryString.append("region", params.region)
  if (params.district) queryString.append("district", params.district)
  if (params.manufacturer) queryString.append("manufacturer", params.manufacturer)
  if (params.model) queryString.append("model", params.model)
  if (params.search) queryString.append("search", params.search)
  if (params.page) queryString.append("page", params.page.toString())
  if (params.limit) queryString.append("limit", params.limit.toString())
  if (params.sortBy) queryString.append("sortBy", params.sortBy)
  if (params.sortOrder) queryString.append("sortOrder", params.sortOrder)

  return useQuery<MmsCustomerSalesDetailResponse>({
    queryKey: [
      "mms-customer-sales-detail",
      params.dateFrom,
      params.dateTo,
      params.region,
      params.district,
      params.manufacturer,
      params.model,
      params.search,
      params.page,
      params.limit,
      params.sortBy,
      params.sortOrder,
    ],
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/meters/consumption/mms-customer-sales/detail?${queryString.toString()}`

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch MMS customer sales detail: ${response.status}`)
      }

      return response.json()
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
  })
}

function detailUrl(params: Omit<MmsCustomerSalesDetailParams, "page" | "limit">, page: number): string {
  const qs = new URLSearchParams()
  if (params.dateFrom) qs.append("dateFrom", params.dateFrom)
  if (params.dateTo) qs.append("dateTo", params.dateTo)
  if (params.region) qs.append("region", params.region)
  if (params.district) qs.append("district", params.district)
  if (params.manufacturer) qs.append("manufacturer", params.manufacturer)
  if (params.model) qs.append("model", params.model)
  if (params.search) qs.append("search", params.search)
  if (params.sortBy) qs.append("sortBy", params.sortBy)
  if (params.sortOrder) qs.append("sortOrder", params.sortOrder)
  qs.append("page", page.toString())
  qs.append("limit", "500") // the server's own per-request cap
  return `${API_BASE_URL}/api/v1/meters/consumption/mms-customer-sales/detail?${qs.toString()}`
}

/** Fetches every matching row across all pages for a full export — the
 * paginated table view only ever holds one page in memory, but "Download"
 * of the result set means the whole thing. Page 1 first to learn
 * total_pages, then the rest run in parallel. */
export async function fetchAllMmsCustomerSalesDetail(
  params: Omit<MmsCustomerSalesDetailParams, "page" | "limit">,
): Promise<MmsCustomerSalesDetail[]> {
  const first = await fetch(detailUrl(params, 1))
  if (!first.ok) throw new Error(`Failed to fetch MMS customer sales detail: ${first.status}`)
  const firstPage: MmsCustomerSalesDetailResponse = await first.json()
  const all = [...(firstPage.data || [])]

  if (firstPage.total_pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: firstPage.total_pages - 1 }, (_, i) => i + 2).map(async (page) => {
        const res = await fetch(detailUrl(params, page))
        if (!res.ok) throw new Error(`Failed to fetch MMS customer sales detail (page ${page}): ${res.status}`)
        const json: MmsCustomerSalesDetailResponse = await res.json()
        return json.data || []
      }),
    )
    for (const page of rest) all.push(...page)
  }

  return all
}
