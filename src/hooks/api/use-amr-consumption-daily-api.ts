import { useQuery } from "@tanstack/react-query";
import type {
  AmrConsumptionDailyResponse,
  AmrConsumptionDaily,
} from "@/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780";

interface AmrConsumptionDailyParams {
  dateFrom?: string;
  dateTo?: string;
  region?: string;
  district?: string;
  meterNumber?: string;
  systemName?: "import_kwh" | "export_kwh";
  page?: number;
  limit?: number;
}

export function useAmrConsumptionDaily(params: AmrConsumptionDailyParams) {
  const queryString = new URLSearchParams();

  if (params.dateFrom) queryString.append("dateFrom", params.dateFrom);
  if (params.dateTo) queryString.append("dateTo", params.dateTo);
  if (params.region) queryString.append("region", params.region);
  if (params.district) queryString.append("district", params.district);
  if (params.meterNumber) queryString.append("meterNumber", params.meterNumber);
  if (params.systemName) queryString.append("systemName", params.systemName);
  if (params.page) queryString.append("page", params.page.toString());
  if (params.limit) queryString.append("limit", params.limit.toString());

  return useQuery<AmrConsumptionDaily[]>({
    queryKey: [
      "amr-consumption-daily",
      params.dateFrom,
      params.dateTo,
      params.region,
      params.district,
      params.meterNumber,
      params.systemName,
      params.page,
      params.limit,
    ],
    queryFn: async () => {
      const url = `${API_BASE_URL}/api/v1/amr/consumption/daily?${queryString.toString()}`;
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(`Failed to fetch AMR daily: ${response.status}`);
      const data: AmrConsumptionDailyResponse = await response.json();
      return data.data || [];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
  });
}
