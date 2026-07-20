import { useQuery } from "@tanstack/react-query";
import type {
  CustomerConsumptionAggregateResponse,
  CustomerConsumptionAggregateItem,
} from "@/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780";

export type ZeusAggregateGroupBy =
  | "regionname"
  | "districtname"
  | "contractstatus"
  | "servicetype"
  | "serviceclass"
  | "tariffclasscode"
  | "customertype"
  | "accounttype"
  | "mda";

interface CustomerConsumptionAggregateParams {
  dateFrom?: string;
  dateTo?: string;
  region?: string;
  district?: string;
  serviceType?: string;
  serviceClass?: string;
  customerType?: string;
  accountType?: string;
  groupBy?: ZeusAggregateGroupBy | ZeusAggregateGroupBy[];
  enabled?: boolean;
}

export function useCustomerConsumptionAggregate(
  params: CustomerConsumptionAggregateParams,
) {
  const queryString = new URLSearchParams();

  if (params.dateFrom) queryString.append("lastBillDateFrom", params.dateFrom);
  if (params.dateTo) queryString.append("lastBillDateTo", params.dateTo);
  if (params.region) queryString.append("region", params.region);
  if (params.district) queryString.append("district", params.district);
  if (params.serviceType) queryString.append("serviceType", params.serviceType);
  if (params.serviceClass)
    queryString.append("serviceClass", params.serviceClass);
  if (params.customerType)
    queryString.append("customerType", params.customerType);
  if (params.accountType) queryString.append("accountType", params.accountType);
  if (params.groupBy) {
    const groups = Array.isArray(params.groupBy)
      ? params.groupBy
      : [params.groupBy];
    for (const g of groups) {
      if (g) queryString.append("groupBy", g);
    }
  }

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
      params.groupBy,
    ],
    enabled:
      params.enabled !== false && Boolean(params.dateFrom && params.dateTo),
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/meters/consumption/customer-sales-zeus/aggregate?${queryString.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch customer consumption aggregate: ${response.status}`,
        );
      }

      const data: CustomerConsumptionAggregateResponse = await response.json();
      return data.data || [];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
  });
}
