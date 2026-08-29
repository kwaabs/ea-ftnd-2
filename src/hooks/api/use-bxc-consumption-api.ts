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
  enabled?: boolean
}

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

  return useQuery<BxcConsumptionDetail[]>({
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
    ],
    enabled: params.enabled !== false && Boolean(params.dateFrom && params.dateTo),
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/meters/consumption/bxc-consumption/detail?${queryString.toString()}`
      const response = await fetchWithTimeout(url, 30000)
      if (!response.ok) {
        throw new Error(`Failed to fetch bxc consumption detail: ${response.status}`)
      }
      const data: BxcConsumptionDetailResponse = await response.json()
      return data.data || []
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
  })
}
