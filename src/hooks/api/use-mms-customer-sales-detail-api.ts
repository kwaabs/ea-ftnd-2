"use client"

import { useQuery } from "@tanstack/react-query"
import { MmsCustomerSalesDetail } from "@/types/api"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

interface MmsCustomerSalesDetailParams {
  dateFrom: string
  dateTo: string
  region?: string
  district?: string
  manufacturer?: string
  model?: string
  page?: number
  limit?: number
}

interface MmsCustomerSalesDetailResponse {
  data: MmsCustomerSalesDetail[]
  total: number
  page: number
  limit: number
}

export function useMmsCustomerSalesDetail(params: MmsCustomerSalesDetailParams) {
  const queryString = new URLSearchParams()

  if (params.dateFrom) queryString.append("dateFrom", params.dateFrom)
  if (params.dateTo) queryString.append("dateTo", params.dateTo)
  if (params.region) queryString.append("region", params.region)
  if (params.district) queryString.append("district", params.district)
  if (params.manufacturer) queryString.append("manufacturer", params.manufacturer)
  if (params.model) queryString.append("model", params.model)
  if (params.page) queryString.append("page", params.page.toString())
  if (params.limit) queryString.append("limit", params.limit.toString())

  return useQuery<MmsCustomerSalesDetail[]>({
    queryKey: [
      "mms-customer-sales-detail",
      params.dateFrom,
      params.dateTo,
      params.region,
      params.district,
      params.manufacturer,
      params.model,
      params.page,
      params.limit,
    ],
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/meters/consumption/mms-customer-sales/detail?${queryString.toString()}`

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch MMS customer sales detail: ${response.status}`)
      }

      const data: MmsCustomerSalesDetailResponse = await response.json()
      return data.data || []
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
  })
}
