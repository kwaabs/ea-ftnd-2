"use client";

import { useQuery } from "@tanstack/react-query";
import {
  MmsCustomerSalesAggregateItem,
  MmsCustomerSalesAggregateResponse,
} from "@/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780";

export type MmsAggregateGroupBy =
  | "region"
  | "district"
  | "contract_type"
  | "tariff"
  | "manufacturer"
  | "model";

interface MmsCustomerSalesAggregateParams {
  dateFrom: string;
  dateTo: string;
  groupBy?: MmsAggregateGroupBy;
  region?: string;
  district?: string;
  enabled?: boolean;
}

export function useMmsCustomerSalesAggregate(
  params: MmsCustomerSalesAggregateParams,
) {
  const queryString = new URLSearchParams();

  if (params.dateFrom) queryString.append("dateFrom", params.dateFrom);
  if (params.dateTo) queryString.append("dateTo", params.dateTo);
  if (params.groupBy) queryString.append("groupBy", params.groupBy);
  if (params.region) queryString.append("region", params.region);
  if (params.district) queryString.append("district", params.district);

  return useQuery<MmsCustomerSalesAggregateItem[]>({
    queryKey: [
      "mms-customer-sales-aggregate",
      params.dateFrom,
      params.dateTo,
      params.groupBy,
      params.region,
      params.district,
    ],
    enabled: params.enabled !== false && Boolean(params.dateFrom && params.dateTo),
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/meters/consumption/mms-customer-sales/aggregate?${queryString.toString()}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch MMS customer sales aggregate: ${response.status}`,
        );
      }

      const data: MmsCustomerSalesAggregateResponse = await response.json();
      return data.data || [];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
  });
}
