import { useQuery } from "@tanstack/react-query"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"





interface FeederGeometry {
    type: "LineString"
    coordinates: number[][]
}

interface Feeder {
    orientation: string // "OH" (Overhead) or "UG" (Underground)
    circuit_id: string
    phase_configuration: string
    conductor_type: string
    geometry: FeederGeometry
}

interface FeedersResponse {
    success: boolean
    total: number
    voltage?: number
    data: Feeder[]
}

export function useFeeders11kV(params?: { orientation?: string }) {
    return useQuery<FeedersResponse>({
        queryKey: ["feeders", "11kv", params],
        queryFn: async () => {
            const queryParams = new URLSearchParams()
            if (params?.orientation) {
                queryParams.append("orientation", params.orientation)
            }
            const queryString = queryParams.toString()
            const url = `${API_BASE_URL}/api/v1/feeders/11kv${queryString ? `?${queryString}` : ""}`

            const response = await fetch(url)
            if (!response.ok) {
                throw new Error(`Failed to fetch 11kV feeders: ${response.status}`)
            }

            return response.json()
        },
        staleTime: 10 * 60 * 1000, // 10 minutes - infrastructure doesn't change often
    })
}

export function useFeeders33kV(params?: { orientation?: string }) {
    return useQuery<FeedersResponse>({
        queryKey: ["feeders", "33kv", params],
        queryFn: async () => {
            const queryParams = new URLSearchParams()
            if (params?.orientation) {
                queryParams.append("orientation", params.orientation)
            }
            const queryString = queryParams.toString()
            const url = `${API_BASE_URL}/api/v1/feeders/33kv${queryString ? `?${queryString}` : ""}`

            const response = await fetch(url)
            if (!response.ok) {
                throw new Error(`Failed to fetch 33kV feeders: ${response.status}`)
            }

            return response.json()
        },
        staleTime: 10 * 60 * 1000, // 10 minutes - infrastructure doesn't change often
    })
}
