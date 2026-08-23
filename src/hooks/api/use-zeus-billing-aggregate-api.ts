import { useQuery } from "@tanstack/react-query"
import type {
  ZeusBillingAggregateItem,
  ZeusBillingAggregateResponse,
} from "@/types/api"
import { fetchWithTimeout } from "@/lib/utils"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

export type ZeusBillingGroupBy =
  | "regionname"
  | "districtname"
  | "tariffclasscode"
  | "tariffclassname"
  | "serviceclass"
  | "accounttype"
  | "billstatus"
  | "metermodeltype"
  | "servicepointstatus"
  | "billingyear"
  | "billingmonth"

interface ZeusBillingAggregateParams {
  /** Maps to billDateFrom/billDateTo — see use-zeus-billing-detail-api.ts. */
  dateFrom?: string
  dateTo?: string
  region?: string
  district?: string
  tariffClassCode?: string
  serviceClass?: string
  accountType?: string
  billStatus?: string
  meterModelType?: string
  servicePointStatus?: string
  billingYear?: string
  billingMonth?: string
  groupBy?: ZeusBillingGroupBy | ZeusBillingGroupBy[]
  enabled?: boolean
}

export function useZeusBillingAggregate(params: ZeusBillingAggregateParams) {
  const queryString = new URLSearchParams()

  if (params.dateFrom) queryString.append("billDateFrom", params.dateFrom)
  if (params.dateTo) queryString.append("billDateTo", params.dateTo)
  if (params.region) queryString.append("region", params.region)
  if (params.district) queryString.append("district", params.district)
  if (params.tariffClassCode) queryString.append("tariffClassCode", params.tariffClassCode)
  if (params.serviceClass) queryString.append("serviceClass", params.serviceClass)
  if (params.accountType) queryString.append("accountType", params.accountType)
  if (params.billStatus) queryString.append("billStatus", params.billStatus)
  if (params.meterModelType) queryString.append("meterModelType", params.meterModelType)
  if (params.servicePointStatus) queryString.append("servicePointStatus", params.servicePointStatus)
  if (params.billingYear) queryString.append("billingYear", params.billingYear)
  if (params.billingMonth) queryString.append("billingMonth", params.billingMonth)
  if (params.groupBy) {
    // Backend parses groupBy as a single comma-joined value (httpx.CSV),
    // same convention as region/district/etc — NOT repeated groupBy= params,
    // which only the first of would ever reach the backend.
    const groups = Array.isArray(params.groupBy) ? params.groupBy : [params.groupBy]
    const joined = groups.filter(Boolean).join(",")
    if (joined) queryString.append("groupBy", joined)
  }

  return useQuery<ZeusBillingAggregateItem[]>({
    queryKey: [
      "zeus-billing-aggregate",
      params.dateFrom,
      params.dateTo,
      params.region,
      params.district,
      params.tariffClassCode,
      params.serviceClass,
      params.accountType,
      params.billStatus,
      params.meterModelType,
      params.servicePointStatus,
      params.billingYear,
      params.billingMonth,
      params.groupBy,
    ],
    enabled:
      params.enabled !== false && Boolean(params.dateFrom && params.dateTo),
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/meters/consumption/zeus-billing/aggregate?${queryString.toString()}`
      // app.zeus_sales is an 18M-row table with no pre-aggregated summary —
      // an unfiltered/multi-dimension groupBy (e.g. the map's all-regions
      // fetch) can run long. A hard timeout keeps this from hanging forever
      // with no error and no way for callers to surface a retry UI.
      const response = await fetchWithTimeout(url, 30000)

      if (!response.ok) {
        throw new Error(
          `Failed to fetch zeus billing aggregate: ${response.status}`,
        )
      }

      const data: ZeusBillingAggregateResponse = await response.json()
      return data.data || []
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
    retry: 1,
  })
}
