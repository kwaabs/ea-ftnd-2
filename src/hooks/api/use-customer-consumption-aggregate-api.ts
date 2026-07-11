import { useQuery } from "@tanstack/react-query"
import type { CustomerConsumptionAggregateResponse, CustomerConsumptionAggregateItem } from "@/types/api"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

interface CustomerConsumptionAggregateParams {
  dateFrom?: string
  dateTo?: string
  region?: string
  district?: string
  serviceType?: string
  serviceClass?: string
  customerType?: string
  accountType?: string
}

export function useCustomerConsumptionAggregate(params: CustomerConsumptionAggregateParams) {
  const queryString = new URLSearchParams()

  if (params.dateFrom) queryString.append("lastBillDateFrom", params.dateFrom)
  if (params.dateTo) queryString.append("lastBillDateTo", params.dateTo)
  if (params.region) queryString.append("region", params.region)
  if (params.district) queryString.append("district", params.district)
  if (params.serviceType) queryString.append("serviceType", params.serviceType)
  if (params.serviceClass) queryString.append("serviceClass", params.serviceClass)
  if (params.customerType) queryString.append("customerType", params.customerType)
  if (params.accountType) queryString.append("accountType", params.accountType)

  return useQuery<CustomerConsumptionAggregateItem[]>({
    queryKey: [
      "customer-consumption-aggregate",
      params.dateFrom,
      params.dateTo,
      params.region,
      params.district,
      params.serviceType,
      params.serviceClass,
      params.customerType,
      params.accountType,
    ],
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/meters/consumption/customer-sales-zeus/aggregate?${queryString.toString()}`
      console.log("[v0] useCustomerConsumptionAggregate URL:", url)

      try {
        const response = await fetch(url)
        console.log("[v0] useCustomerConsumptionAggregate response status:", response.status)
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error("[v0] useCustomerConsumptionAggregate error:", { status: response.status, errorText })
          throw new Error(`Failed to fetch customer consumption aggregate: ${response.status} - ${errorText}`)
        }

        const data: CustomerConsumptionAggregateResponse = await response.json()
        console.log("[v0] useCustomerConsumptionAggregate response data:", data)
        return data.data || []
      } catch (error) {
        console.error("[v0] useCustomerConsumptionAggregate fetch error:", error)
        throw error
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
  })
}
