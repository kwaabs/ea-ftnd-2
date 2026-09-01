"use client"

import { useQuery } from "@tanstack/react-query"
import {
  PnsConsumptionAggregateItem,
  PnsConsumptionAggregateResponse,
  PnsConsumptionDetail,
  PnsConsumptionDetailResponse,
} from "@/types/api"
import { fetchWithTimeout } from "@/lib/utils"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

export type PnsConsumptionGroupBy = "region" | "district" | "tariff" | "billmonth"

interface PnsConsumptionAggregateParams {
  dateFrom: string
  dateTo: string
  groupBy?: PnsConsumptionGroupBy
  region?: string
  district?: string
  tariff?: string
  billMonth?: string
  enabled?: boolean
}

// dateFrom/dateTo filter directly against pns_consumption's real billdate
// column (day precision) — unlike BOT/BXC, no billmonth-label resolution
// on the backend. region/district here are the raw regionid/districtid
// codes (e.g. "10001001"), not human-readable names — no name lookup
// exists yet. See ea-bknd-3/internal/pnsconsumption's package doc comment.
export function usePnsConsumptionAggregate(params: PnsConsumptionAggregateParams) {
  const queryString = new URLSearchParams()

  if (params.dateFrom) queryString.append("dateFrom", params.dateFrom)
  if (params.dateTo) queryString.append("dateTo", params.dateTo)
  if (params.groupBy) queryString.append("groupBy", params.groupBy)
  if (params.region) queryString.append("region", params.region)
  if (params.district) queryString.append("district", params.district)
  if (params.tariff) queryString.append("tariff", params.tariff)
  if (params.billMonth) queryString.append("billMonth", params.billMonth)

  return useQuery<PnsConsumptionAggregateItem[]>({
    queryKey: [
      "pns-consumption-aggregate",
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
      const url = `${API_BASE_URL}/api/v1/meters/consumption/pns-consumption/aggregate?${queryString.toString()}`
      const response = await fetchWithTimeout(url, 30000)
      if (!response.ok) {
        throw new Error(`Failed to fetch pns consumption aggregate: ${response.status}`)
      }
      const data: PnsConsumptionAggregateResponse = await response.json()
      return data.data || []
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
  })
}

interface PnsConsumptionDetailParams {
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

export function usePnsConsumptionDetail(params: PnsConsumptionDetailParams) {
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

  return useQuery<PnsConsumptionDetail[]>({
    queryKey: [
      "pns-consumption-detail",
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
      const url = `${API_BASE_URL}/api/v1/meters/consumption/pns-consumption/detail?${queryString.toString()}`
      const response = await fetchWithTimeout(url, 30000)
      if (!response.ok) {
        throw new Error(`Failed to fetch pns consumption detail: ${response.status}`)
      }
      const data: PnsConsumptionDetailResponse = await response.json()
      return data.data || []
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
  })
}
