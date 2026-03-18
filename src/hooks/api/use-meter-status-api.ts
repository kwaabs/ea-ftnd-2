"use client"
import { useQuery } from "@tanstack/react-query"
import { formatApiDate } from "@/lib/utils"
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

export interface MeterStatusSummary {
    total: number
    online: number
    offline_no_data: number
    offline_no_record: number
    total_offline: number
    online_percentage: number
    offline_percentage: number
    avg_uptime_percentage: number
    total_consumption_kwh: number
}

export interface StatusTimelineData {
    date: string
    online: number
    offline: number
    total: number
}

export interface StatusTimelineResponse {
    data: StatusTimelineData[]
    date_range: {
        from: string
        to: string
    }
}

export interface MeterStatusDetail {
    meter_number: string
    meter_type: string
    region: string
    district?: string
    station: string
    feeder_panel_name?: string
    location?: string
    boundary_point?: string
    status: string
    last_consumption_date: string
    last_reading_time: string
    total_consumption_kwh: number
    uptime_percentage: number
    days_offline: number
}

export interface PaginatedResponse<T> {
    data: T[]
    pagination: {
        page: number
        limit: number
        total: number
        total_pages: number
    }
}

interface MeterStatusParams {
    dateFrom: string
    dateTo: string
    regions?: string[]
    districts?: string[]
    stations?: string[]
    meterTypes?: string[]
    boundaryMeteringPoints?: string[]
    voltage_kv?: number[]
    voltages?: number[]
    feeders?: string[]
    locations?: string[]
    search?: string
    status?: string
    sortBy?: string
    sortOrder?: string
}

function buildQueryString(params: MeterStatusParams & { page?: number; limit?: number }): string {
    const queryParams = new URLSearchParams()

    queryParams.append("dateFrom", formatApiDate(params.dateFrom))
    queryParams.append("dateTo", formatApiDate(params.dateTo))

    if (params.page) queryParams.append("page", params.page.toString())
    if (params.limit) queryParams.append("limit", params.limit.toString())
    if (params.regions && params.regions.length > 0) queryParams.append("region", params.regions.join(","))
    if (params.districts && params.districts.length > 0) queryParams.append("district", params.districts.join(","))
    if (params.stations && params.stations.length > 0) queryParams.append("station", params.stations.join(","))
    if (params.meterTypes && params.meterTypes.length > 0) queryParams.append("meterType", params.meterTypes.join(","))
    if (params.boundaryMeteringPoints && params.boundaryMeteringPoints.length > 0) {
        queryParams.append("boundaryMeteringPoint", params.boundaryMeteringPoints.join(","))
    }
    if (params.locations && params.locations.length > 0) {
        queryParams.append("location", params.locations.join(","))
    }
    if (params.feeders && params.feeders.length > 0) {
        queryParams.append("feeder", params.feeders.join(","))
    }
    if (params.voltages && params.voltages.length > 0) {
        queryParams.append("voltage_kv", params.voltages.map((v) => v.toString()).join(","))
    }
    if (params.voltage_kv && params.voltage_kv.length > 0) {
        queryParams.append("voltage_kv", params.voltage_kv.map((v) => v.toString()).join(","))
    }
    if (params.search) queryParams.append("search", params.search)
    if (params.status) queryParams.append("status", params.status)
    if (params.sortBy) queryParams.append("sortBy", params.sortBy)
    if (params.sortOrder) queryParams.append("sortOrder", params.sortOrder)

    return queryParams.toString()
}

export function useMeterStatusSummary(params: MeterStatusParams) {
    const queryString = buildQueryString(params)

    return useQuery<MeterStatusSummary>({
        queryKey: ["meter-status-summary", queryString],
        queryFn: async () => {
            const url = `${API_BASE_URL}/api/v1/meters/status/summary?${queryString}`
            console.log("[v0] Fetching meter status summary from:", url)
            const response = await fetch(url)
            if (!response.ok) {
                console.error("[v0] Failed to fetch meter status summary:", response.status, response.statusText)
                throw new Error("Failed to fetch meter status summary")
            }
            const data = await response.json()
            console.log("[v0] Meter status summary response:", data)
            return data
        },
        enabled: !!params.dateFrom && !!params.dateTo,
        staleTime: 30000, // 30 seconds
    })
}

export function useStatusTimeline(params: MeterStatusParams) {
    const queryString = buildQueryString(params)
    console.log("[v0] useStatusTimeline called with params:", params)

    return useQuery<StatusTimelineData[]>({
        queryKey: ["status-timeline", queryString],
        queryFn: async () => {
            const url = `${API_BASE_URL}/api/v1/meters/status/timeline?${queryString}`
            console.log("[v0] Fetching status timeline from:", url)
            const response = await fetch(url)
            if (!response.ok) {
                console.error("[v0] Failed to fetch status timeline:", response.status, response.statusText)
                throw new Error("Failed to fetch status timeline")
            }
            const result: StatusTimelineResponse = await response.json()
            console.log("[v0] Status timeline response:", result)
            return result.data
        },
        enabled: !!params.dateFrom && !!params.dateTo,
        staleTime: 30000,
    })
}

export function useMeterStatusDetails(params: MeterStatusParams & { page: number; limit: number }) {
    const queryString = buildQueryString(params)
    console.log("[v0] useMeterStatusDetails called with params:", params)

    return useQuery<PaginatedResponse<MeterStatusDetail>>({
        queryKey: ["meter-status-details", queryString],
        queryFn: async () => {
            const url = `${API_BASE_URL}/api/v1/meters/status/details?${queryString}`
            console.log("[v0] Fetching meter status details from:", url)
            const response = await fetch(url)
            if (!response.ok) {
                console.error("[v0] Failed to fetch meter status details:", response.status, response.statusText)
                throw new Error("Failed to fetch meter status details")
            }
            const data = await response.json()
            console.log("[v0] Meter status details response:", data)
            return data
        },
        enabled: !!params.dateFrom && !!params.dateTo,
        staleTime: 30000,
    })
}

export interface RegionalSupplyData {
    date: string
    region: string
    total_consumption_kwh: number
    meter_count: number
    avg_consumption_per_meter: number
}

export function useRegionalSupplyPatterns(params: MeterStatusParams & { groupBy?: "day" | "week" | "month" }) {
    const queryString = buildQueryString(params)
    const groupBy = params.groupBy || "day"

    return useQuery<RegionalSupplyData[]>({
        queryKey: ["regional-supply-patterns", queryString, groupBy],
        queryFn: async () => {
            const response = await fetch(
                `${API_BASE_URL}/api/v1/meters/consumption/by-region?${queryString}&groupBy=${groupBy}`,
            )
            if (!response.ok) throw new Error("Failed to fetch regional supply patterns")
            return response.json()
        },
        enabled: !!params.dateFrom && !!params.dateTo,
        staleTime: 30000,
    })
}

export function useMeterHealthSummary(params: MeterStatusParams) {
    const queryString = buildQueryString(params)

    return useQuery<import("@/lib/types/api").MeterHealthSummaryResponse>({
        queryKey: ["meter-health-summary", queryString],
        queryFn: async () => {
            const url = `${API_BASE_URL}/api/v1/meters/health/summary?${queryString}`
            console.log("[v0] Fetching meter health summary from:", url)
            const response = await fetch(url)
            if (!response.ok) {
                console.error("[v0] Failed to fetch meter health summary:", response.status, response.statusText)
                throw new Error("Failed to fetch meter health summary")
            }
            const result = await response.json()
            console.log("[v0] Meter health summary response:", result)
            return result
        },
        enabled: !!params.dateFrom && !!params.dateTo,
        staleTime: 30000,
    })
}

export function useMeterHealthDetails(
    params: MeterStatusParams & {
        page: number
        limit: number
        healthCategory?: string
    },
) {
    const queryParams = new URLSearchParams()
    const baseQueryString = buildQueryString(params)

    // Add health category filter if provided
    if (params.healthCategory) {
        queryParams.append("healthCategory", params.healthCategory)
    }

    const fullQueryString = baseQueryString + (params.healthCategory ? `&${queryParams.toString()}` : "")

    return useQuery<import("@/lib/types/api").MeterHealthDetailsResponse>({
        queryKey: ["meter-health-details", fullQueryString],
        queryFn: async () => {
            const url = `${API_BASE_URL}/api/v1/meters/health/summary/details?${fullQueryString}`
            console.log("[v0] Fetching meter health details from:", url)
            const response = await fetch(url)
            if (!response.ok) {
                console.error("[v0] Failed to fetch meter health details:", response.status, response.statusText)
                throw new Error("Failed to fetch meter health details")
            }
            const result = await response.json()
            console.log("[v0] Meter health details response:", result)
            return result
        },
        enabled: !!params.dateFrom && !!params.dateTo,
        staleTime: 30000,
    })
}

export interface SingleMeterStatus {
    consumption_date: string
    meter_number: string
    meter_type: string
    boundary_metering_point?: string
    location: string
    status: "ONLINE" | "OFFLINE"
    consumption: number
    reading_count: number
    day_start_time: string
    day_end_time: string
}

export function useSingleMeterStatus(params: { meterNumber: string; dateFrom: string; dateTo: string }) {
    const queryString = new URLSearchParams({
        meterNumber: params.meterNumber,
        dateFrom: formatApiDate(params.dateFrom),
        dateTo: formatApiDate(params.dateTo),
    }).toString()

    return useQuery<SingleMeterStatus[]>({
        queryKey: ["single-meter-status", params.meterNumber, params.dateFrom, params.dateTo],
        queryFn: async () => {
            const url = `${API_BASE_URL}/api/v1/meters/status?${queryString}`
            const response = await fetch(url)
            if (!response.ok) {
                throw new Error("Failed to fetch meter status")
            }
            return response.json()
        },
        enabled: !!params.meterNumber && !!params.dateFrom && !!params.dateTo,
        staleTime: 30000,
    })
}
