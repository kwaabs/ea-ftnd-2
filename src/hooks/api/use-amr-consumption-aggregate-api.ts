import { useQuery } from "@tanstack/react-query";
import type {
  AmrConsumptionAggregateResponse,
  AmrConsumptionAggregateItem,
} from "@/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780";

interface AmrConsumptionAggregateParams {
  dateFrom?: string;
  dateTo?: string;
  region?: string;
}

export function useAmrConsumptionAggregate(
  params: AmrConsumptionAggregateParams,
) {
  const queryString = new URLSearchParams();

  if (params.dateFrom) queryString.append("dateFrom", params.dateFrom);
  if (params.dateTo) queryString.append("dateTo", params.dateTo);
  if (params.region) queryString.append("region", params.region);

  return useQuery<AmrConsumptionAggregateItem[]>({
    queryKey: [
      "amr-consumption-aggregate",
      params.dateFrom,
      params.dateTo,
      params.region,
    ],
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/amr/consumption/aggregate?${queryString.toString()}`;
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(`Failed to fetch AMR aggregate: ${response.status}`);
      const data: AmrConsumptionAggregateResponse = await response.json();
      return data.data || [];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
  });
}
