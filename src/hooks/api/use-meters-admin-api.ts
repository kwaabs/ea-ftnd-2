"use client"

import { useUserStore } from "@/stores/user-store"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

/**
 * Writable field set for the meter-management admin UI — mirrors
 * internal/meters.MeterInput on the backend. Kept separate from the
 * read-side `Meter` type in @/lib/types/api (narrower, used by
 * useMeters/choropleth-map.tsx) rather than widening a type other code
 * depends on.
 */
export interface MeterAdminInput {
  meter_number: string
  meter_type: string
  spn?: string | null
  meter_brand?: string | null
  location?: string | null
  digital_address?: string | null
  status?: string | null
  metering_point?: string | null
  boundary_metering_point?: string | null
  incomer?: string | null
  region?: string | null
  district?: string | null
  station?: string | null
  multiply_factor?: number | null
  ct_ratio_primary?: number | null
  ct_ratio_secondary?: number | null
  vt_ratio_primary?: number | null
  vt_ratio_secondary?: number | null
  latitude?: number | null
  longitude?: number | null
  voltage_kv?: number | null
  feeder_panel_name?: string | null
}

export interface MeterAdminRecord extends MeterAdminInput {
  id: string
}

/** Reads the live token directly from useUserStore — the real, populated
 * auth store used by src/lib/auth-session.ts elsewhere. (Not
 * src/lib/api-client.ts's getAuthHeaders(), which reads from a
 * useAuthStore that's dead code, imported nowhere else in the app.) */
function authHeaders(): HeadersInit {
  const token = useUserStore.getState().token
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

/** The backend writes plain string error bodies (httpx.JSON(w, status, "msg")),
 * not a {message: "..."} envelope — handle both defensively. */
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

export async function createMeter(input: MeterAdminInput): Promise<MeterAdminRecord> {
  const response = await fetch(`${API_BASE_URL}/api/v1/meters/admin`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json()
}

export async function updateMeter(id: string, input: MeterAdminInput): Promise<MeterAdminRecord> {
  const response = await fetch(`${API_BASE_URL}/api/v1/meters/admin/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json()
}

export async function deleteMeter(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/meters/admin/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await readError(response))
}
