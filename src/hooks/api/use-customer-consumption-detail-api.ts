import { useQuery } from "@tanstack/react-query"
import type { CustomerConsumptionDetail, CustomerConsumptionDetailResponse } from "@/types/api"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

interface CustomerConsumptionDetailParams {
  page?: number
  limit?: number
  region?: string
  district?: string
  serviceType?: string
  serviceClass?: string
  customerType?: string
  accountType?: string
  contractStatus?: string
  search?: string
  accountNumber?: string
  servicePointNumber?: string
  dateFrom?: string
  dateTo?: string
  enabled?: boolean
}

interface ProcessedDetailResponse {
  data: CustomerConsumptionDetail[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export function useCustomerConsumptionDetail(params: CustomerConsumptionDetailParams) {
  const queryString = new URLSearchParams()

  if (params.page) queryString.append("page", String(params.page))
  if (params.limit) queryString.append("limit", String(params.limit))
  if (params.region) queryString.append("region", params.region)
  if (params.district) queryString.append("district", params.district)
  if (params.serviceType) queryString.append("servicetype", params.serviceType)
  if (params.serviceClass) queryString.append("serviceclass", params.serviceClass)
  if (params.customerType) queryString.append("customertype", params.customerType)
  if (params.accountType) queryString.append("accounttype", params.accountType)
  if (params.contractStatus) queryString.append("contractstatus", params.contractStatus)
  if (params.search) queryString.append("search", params.search)
  if (params.accountNumber) queryString.append("accountNumber", params.accountNumber)
  if (params.servicePointNumber) queryString.append("servicePointNumber", params.servicePointNumber)
  if (params.dateFrom) queryString.append("dateFrom", params.dateFrom)
  if (params.dateTo) queryString.append("dateTo", params.dateTo)

  return useQuery<ProcessedDetailResponse>({
    queryKey: [
      "customer-consumption-detail",
      params.page,
      params.limit,
      params.region,
      params.district,
      params.serviceType,
      params.serviceClass,
      params.customerType,
      params.accountType,
      params.contractStatus,
      params.search,
      params.accountNumber,
      params.servicePointNumber,
      params.dateFrom,
      params.dateTo,
    ],
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/meters/consumption/customer-sales-zeus/detail?${queryString.toString()}`

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch customer consumption detail: ${response.status}`)
      }

      const data: CustomerConsumptionDetailResponse = await response.json()
      return {
        data: data.data || [],
        total: data.total || 0,
        page: data.page || 1,
        limit: data.limit || 10,
        total_pages: data.total_pages || 0,
      }
    },
    enabled: params.enabled !== false,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
  })
}
