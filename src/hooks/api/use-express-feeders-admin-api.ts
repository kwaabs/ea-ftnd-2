"use client"

import { useQuery } from "@tanstack/react-query"
import { useUserStore } from "@/stores/user-store"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

/**
 * Writable field set for the express-feeder pairing admin UI — mirrors
 * internal/meters.ExpressFeederInput on the backend. A pairing links two
 * real meters (by id) under one feeder_name; kept local to this file same
 * as MeterAdminInput in use-meters-admin-api.ts.
 */
export interface ExpressFeederAdminInput {
  feeder_name: string
  sap_version?: string | null
  comments?: string | null
  sending_meter_id: string
  sending_station?: string | null
  sending_type_of_station?: string | null
  sending_code?: string | null
  sending_region?: string | null
  sending_district?: string | null
  receiving_meter_id: string
  receiving_station?: string | null
  receiving_type_of_station?: string | null
  receiving_code?: string | null
  receiving_region?: string | null
  receiving_district?: string | null
}

export interface ExpressFeederAdminRecord extends ExpressFeederAdminInput {
  id: string
  sending_meter_number: string
  receiving_meter_number: string
}

interface ExpressFeederListResponse {
  data: ExpressFeederAdminRecord[]
  meta: { page: number; limit: number; total: number; pages: number }
}

/** Same pattern as use-meters-admin-api.ts's authHeaders/readError. */
function authHeaders(): HeadersInit {
  const token = useUserStore.getState().token
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const json = await response.json()
    if (typeof json === "string") return json
    if (json && typeof json.message === "string") return json.message
  } catch {
    // ignore — fall through to generic message
  }
  return `Request failed (${response.status})`
}

export function useExpressFeedersAdmin(params: { search?: string; page?: number; limit?: number }) {
  const queryString = new URLSearchParams({
    ...(params.search ? { search: params.search } : {}),
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 20),
  }).toString()

  return useQuery<ExpressFeederListResponse>({
    queryKey: ["express-feeders-admin", queryString],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/express-feeders/admin?${queryString}`, {
        headers: authHeaders(),
      })
      if (!response.ok) throw new Error(await readError(response))
      return response.json()
    },
    staleTime: 30 * 1000,
  })
}

export async function createExpressFeeder(
  input: ExpressFeederAdminInput,
): Promise<ExpressFeederAdminRecord> {
  const response = await fetch(`${API_BASE_URL}/api/v1/express-feeders/admin`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json()
}

export async function updateExpressFeeder(
  id: string,
  input: ExpressFeederAdminInput,
): Promise<ExpressFeederAdminRecord> {
  const response = await fetch(`${API_BASE_URL}/api/v1/express-feeders/admin/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json()
}

export async function deleteExpressFeeder(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/express-feeders/admin/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await readError(response))
}
