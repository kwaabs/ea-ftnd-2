"use client";

import { useQuery } from "@tanstack/react-query";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780";

export interface AmrCustomerRecord {
  id: string;
  region?: string;
  district?: string;
  customer_name?: string;
  account_no?: string;
  spn?: string;
  geocode?: string;
  ghanapost_address?: string;
  activity_type?: string;
  meter_number?: string;
  phone_number?: string;
  tariff_class?: string;
  sub_activity?: string;
  account_type?: string;
  activity?: string;
  contract_status?: string;
  meter_phase?: string;
  service_type?: string;
  community?: string;
  customer_type?: string;
  house_number?: string;
  slt_type?: string;
  multiply_factor?: number;
}

export function useAmrMeter(meterNumber: string | undefined) {
  return useQuery<AmrCustomerRecord[]>({
    queryKey: ["amr-meter", meterNumber],
    enabled: Boolean(meterNumber),
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/amr/meters/${encodeURIComponent(meterNumber!)}`,
      );
      if (res.status === 404) return [];
      if (!res.ok) throw new Error(`Failed to fetch AMR meter: ${res.status}`);
      const body = await res.json();
      return body.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}
