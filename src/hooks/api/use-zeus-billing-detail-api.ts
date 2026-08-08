import { useQuery } from "@tanstack/react-query"
import type { ZeusBillingDetail, ZeusBillingDetailResponse } from "@/types/api"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

interface ZeusBillingDetailParams {
  page?: number
  limit?: number
  region?: string
  district?: string
  tariffClassCode?: string
  serviceClass?: string
  accountType?: string
  billStatus?: string
  billConsumptionType?: string
  meterModelType?: string
  servicePointStatus?: string
  billingYear?: string
  billingMonth?: string
  search?: string
  accountCode?: string
  servicePointCode?: string
  meterCode?: string
  /** Maps to billDateFrom/billDateTo — zeus_sales has no day-precision bill
   * date, so the backend expands this into the billing periods (month/year)
   * that overlap the range. See internal/zeusbilling.billingPeriodCodesInRange. */
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortDir?: "asc" | "desc"
  enabled?: boolean
}

interface ProcessedZeusBillingDetailResponse {
  data: ZeusBillingDetail[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export function useZeusBillingDetail(params: ZeusBillingDetailParams) {
  const queryString = new URLSearchParams()

  if (params.page) queryString.append("page", String(params.page))
  if (params.limit) queryString.append("limit", String(params.limit))
  if (params.region) queryString.append("region", params.region)
  if (params.district) queryString.append("district", params.district)
  if (params.tariffClassCode) queryString.append("tariffClassCode", params.tariffClassCode)
  if (params.serviceClass) queryString.append("serviceClass", params.serviceClass)
  if (params.accountType) queryString.append("accountType", params.accountType)
  if (params.billStatus) queryString.append("billStatus", params.billStatus)
  if (params.billConsumptionType) queryString.append("billConsumptionType", params.billConsumptionType)
  if (params.meterModelType) queryString.append("meterModelType", params.meterModelType)
  if (params.servicePointStatus) queryString.append("servicePointStatus", params.servicePointStatus)
  if (params.billingYear) queryString.append("billingYear", params.billingYear)
  if (params.billingMonth) queryString.append("billingMonth", params.billingMonth)
  if (params.search) queryString.append("search", params.search)
  if (params.accountCode) queryString.append("accountCode", params.accountCode)
  if (params.servicePointCode) queryString.append("servicePointCode", params.servicePointCode)
  if (params.meterCode) queryString.append("meterCode", params.meterCode)
  if (params.dateFrom) queryString.append("billDateFrom", params.dateFrom)
  if (params.dateTo) queryString.append("billDateTo", params.dateTo)
  if (params.sortBy) queryString.append("sortBy", params.sortBy)
  if (params.sortDir) queryString.append("sortDir", params.sortDir)

  return useQuery<ProcessedZeusBillingDetailResponse>({
    queryKey: [
      "zeus-billing-detail",
      params.page,
      params.limit,
      params.region,
      params.district,
      params.tariffClassCode,
      params.serviceClass,
      params.accountType,
      params.billStatus,
      params.billConsumptionType,
      params.meterModelType,
      params.servicePointStatus,
      params.billingYear,
      params.billingMonth,
      params.search,
      params.accountCode,
      params.servicePointCode,
      params.meterCode,
      params.dateFrom,
      params.dateTo,
      params.sortBy,
      params.sortDir,
    ],
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/meters/consumption/zeus-billing/detail?${queryString.toString()}`

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch zeus billing detail: ${response.status}`)
      }

      const data: ZeusBillingDetailResponse = await response.json()
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
    placeholderData: (prev) => prev,
  })
}
