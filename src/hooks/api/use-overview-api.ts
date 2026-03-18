"use client"

import { useQuery } from "@tanstack/react-query"
import { formatApiDate } from "@/lib/utils"

interface MeterStatusRecord {
  consumption_date: string
  meter_number: string
  status: string
  consumption: number
  reading_count: number
  day_start_time: string
  day_end_time: string
}

interface MeterStatusCounts {
  offline_no_data: number
  offline_no_record: number
  online: number
  total: number
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780/api/v1"

function buildDailyQueryString(params: {
  dateFrom: string
  dateTo: string
  region?: string[]
  district?: string[]
  station?: string[]
}): string {
  const queryParams = new URLSearchParams()

  queryParams.append("dateFrom", formatApiDate(params.dateFrom))
  queryParams.append("dateTo", formatApiDate(params.dateTo))
  queryParams.append("meterType", "BSP,PSS,SS")

  if (params.region && params.region.length > 0) {
    queryParams.append("region", params.region.join(","))
  }
  if (params.district && params.district.length > 0) {
    queryParams.append("district", params.district.join(","))
  }
  if (params.station && params.station.length > 0) {
    queryParams.append("station", params.station.join(","))
  }

  return queryParams.toString()
}

export function useOverviewMeterStatus(params: {
  dateFrom: string
  dateTo: string
  region?: string[]
  district?: string[]
  station?: string[]
}) {
  const queryString = buildDailyQueryString(params)

  return useQuery<MeterStatusRecord[]>({
    queryKey: [
      "overview-meter-status",
      params.dateFrom,
      params.dateTo,
      params.region?.join(","),
      params.district?.join(","),
      params.station?.join(","),
    ],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/v1/meters/status?${queryString}`)
      if (!response.ok) throw new Error("Failed to fetch meter status data")

      const records: MeterStatusRecord[] = await response.json()
      return records
    },
    enabled: !!params.dateFrom && !!params.dateTo,
  })
}

export function useOverviewMeterStatusCounts(params: {
  dateFrom: string
  dateTo: string
  region?: string[]
  district?: string[]
  station?: string[]
}) {
  const queryString = buildDailyQueryString(params)

  return useQuery<MeterStatusCounts>({
    queryKey: [
      "overview-meter-status-counts",
      params.dateFrom,
      params.dateTo,
      params.region?.join(","),
      params.district?.join(","),
      params.station?.join(","),
    ],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/v1/meters/status/counts?${queryString}`)
      if (!response.ok) throw new Error("Failed to fetch meter status counts")

      const counts: MeterStatusCounts = await response.json()
      return counts
    },
    enabled: !!params.dateFrom && !!params.dateTo,
  })
}
