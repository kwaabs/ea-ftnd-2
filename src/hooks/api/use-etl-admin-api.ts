"use client"

import { useQuery } from "@tanstack/react-query"
import { useUserStore } from "@/stores/user-store"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

/**
 * ETL admin UI types — mirror internal/etl's Go structs on the backend
 * (models.go/service.go). This is the "planner" surface: sources and jobs
 * configured here are picked up by the background worker
 * (internal/etl/engine.go) on its own schedule; nothing on this page runs
 * a job itself except the explicit "Run now" / "Test query" actions.
 */
export type EtlSourceKind = "oracle" | "mssql" | "postgres"
export type EtlJobMode = "full_refresh" | "incremental"
export type EtlWatermarkType = "timestamp" | "integer" | "string"
export type EtlRunStatus = "running" | "success" | "failed"

export interface EtlSourceInput {
  name: string
  kind: EtlSourceKind
  host: string
  port: number
  database_name: string
  username: string
  /** Write-only: never returned by the API. Required (non-empty) on
   * create; on update, null/empty means "leave the current password
   * unchanged" — the Edit form never has the real value to prefill. */
  password: string | null
  extra_params: Record<string, string>
  enabled: boolean
}

export interface EtlSourceRecord extends Omit<EtlSourceInput, "password"> {
  id: string
  /** Whether a password is currently stored — the actual value is never
   * returned by the API (see EtlSourceInput.password). */
  has_password: boolean
}

export interface EtlJobInput {
  name: string
  source_id: string
  source_query: string
  dest_schema: string
  dest_table: string
  dest_columns: string[]
  mode: EtlJobMode
  watermark_column: string | null
  watermark_type: EtlWatermarkType | null
  conflict_columns: string[]
  trigger_times: string[]
  batch_size: number
  timeout_seconds: number
  enabled: boolean
  /** Seeds the {{FILTER}} token in source_query: a SELECT run against
   * THIS app database (never the external source) before every run, its
   * single result column chunked into filter_batch_size-sized groups —
   * source_query runs once per chunk with {{FILTER}} substituted as a SQL
   * IN (...) list. Only valid for mode "full_refresh". null/empty means
   * the job isn't filtered — every run just runs source_query as-is. */
  filter_query: string | null
  filter_batch_size: number | null
}

export interface EtlJobRecord extends EtlJobInput {
  id: string
}

export interface EtlJobRun {
  id: number
  job_id: string
  started_at: string
  finished_at: string | null
  status: EtlRunStatus
  rows_extracted: number
  rows_loaded: number
  error_message: string | null
}

export interface EtlJobState {
  job_id: string
  last_watermark: string | null
  updated_at: string
}

export interface EtlTestConnectionResult {
  ok: boolean
  error?: string
  elapsed_ms: number
}

export interface EtlTestQueryResult {
  columns: string[]
  rows: unknown[][]
  truncated: boolean
  elapsed_ms: number
}

export interface EtlDestColumnInfo {
  name: string
  data_type: string
}

/** Same pattern as use-meters-admin-api.ts / use-express-feeders-admin-api.ts. */
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

// ---------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------

export function useEtlSources() {
  return useQuery<{ data: EtlSourceRecord[] }>({
    queryKey: ["etl-sources"],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/etl/admin/sources`, {
        headers: authHeaders(),
      })
      if (!response.ok) throw new Error(await readError(response))
      return response.json()
    },
    staleTime: 30 * 1000,
  })
}

export async function createEtlSource(input: EtlSourceInput): Promise<EtlSourceRecord> {
  const response = await fetch(`${API_BASE_URL}/api/v1/etl/admin/sources`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json()
}

export async function updateEtlSource(id: string, input: EtlSourceInput): Promise<EtlSourceRecord> {
  const response = await fetch(`${API_BASE_URL}/api/v1/etl/admin/sources/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json()
}

export async function deleteEtlSource(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/etl/admin/sources/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await readError(response))
}

export async function testEtlSourceConnection(id: string): Promise<EtlTestConnectionResult> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/etl/admin/sources/${encodeURIComponent(id)}/test-connection`,
    { method: "POST", headers: authHeaders() },
  )
  if (!response.ok) throw new Error(await readError(response))
  return response.json()
}

/** Same connect-and-ping check as testEtlSourceConnection, but against a
 * source that hasn't been saved yet — the Add/Edit Source form's own
 * in-progress values, before they're ever a row in app.etl_sources. */
export async function testEtlSourceConnectionDraft(
  input: EtlSourceInput,
): Promise<EtlTestConnectionResult> {
  const response = await fetch(`${API_BASE_URL}/api/v1/etl/admin/sources/test-connection`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json()
}

// ---------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------

export function useEtlJobs() {
  return useQuery<{ data: EtlJobRecord[] }>({
    queryKey: ["etl-jobs"],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/etl/admin/jobs`, {
        headers: authHeaders(),
      })
      if (!response.ok) throw new Error(await readError(response))
      return response.json()
    },
    staleTime: 30 * 1000,
  })
}

export async function createEtlJob(input: EtlJobInput): Promise<EtlJobRecord> {
  const response = await fetch(`${API_BASE_URL}/api/v1/etl/admin/jobs`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json()
}

export async function updateEtlJob(id: string, input: EtlJobInput): Promise<EtlJobRecord> {
  const response = await fetch(`${API_BASE_URL}/api/v1/etl/admin/jobs/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json()
}

export async function deleteEtlJob(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/etl/admin/jobs/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await readError(response))
}

/** Triggers a job outside its schedule. Returns immediately with a run id
 * — the actual extract+load happens in the background on the server, so
 * callers should poll useEtlJobRuns(jobId) to watch it progress. */
export async function runEtlJobNow(id: string): Promise<{ run_id: number }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/etl/admin/jobs/${encodeURIComponent(id)}/run`, {
    method: "POST",
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json()
}

export function useEtlJobRuns(jobId: string | null, options?: { refetchInterval?: number }) {
  return useQuery<{ data: EtlJobRun[] }>({
    queryKey: ["etl-job-runs", jobId],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/etl/admin/jobs/${encodeURIComponent(jobId as string)}/runs?limit=20`,
        { headers: authHeaders() },
      )
      if (!response.ok) throw new Error(await readError(response))
      return response.json()
    },
    enabled: Boolean(jobId),
    refetchInterval: options?.refetchInterval,
  })
}

export function useEtlJobState(jobId: string | null) {
  return useQuery<EtlJobState | null>({
    queryKey: ["etl-job-state", jobId],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/etl/admin/jobs/${encodeURIComponent(jobId as string)}/state`,
        { headers: authHeaders() },
      )
      if (!response.ok) throw new Error(await readError(response))
      return response.json()
    },
    enabled: Boolean(jobId),
  })
}

// ---------------------------------------------------------------------
// Destination table/column discovery — feeds the Job form's destination
// table picker and its source -> destination column mapping step.
// ---------------------------------------------------------------------

export function useEtlDestTables(schema: string) {
  return useQuery<{ data: string[] }>({
    queryKey: ["etl-dest-tables", schema],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/etl/admin/dest-tables?schema=${encodeURIComponent(schema)}`,
        { headers: authHeaders() },
      )
      if (!response.ok) throw new Error(await readError(response))
      return response.json()
    },
    enabled: Boolean(schema),
    staleTime: 30 * 1000,
  })
}

export function useEtlDestTableColumns(schema: string, table: string | null) {
  return useQuery<{ data: EtlDestColumnInfo[] }>({
    queryKey: ["etl-dest-table-columns", schema, table],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/etl/admin/dest-tables/${encodeURIComponent(table as string)}/columns?schema=${encodeURIComponent(schema)}`,
        { headers: authHeaders() },
      )
      if (!response.ok) throw new Error(await readError(response))
      return response.json()
    },
    enabled: Boolean(schema) && Boolean(table),
    staleTime: 30 * 1000,
  })
}

// ---------------------------------------------------------------------
// Ad-hoc test query — the "does this query work" check, independent of
// any saved job. Never touches a destination table or advances a
// watermark; capped server-side to 200 rows.
// ---------------------------------------------------------------------

export async function testEtlQuery(sourceId: string, query: string): Promise<EtlTestQueryResult> {
  const response = await fetch(`${API_BASE_URL}/api/v1/etl/admin/test-query`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ source_id: sourceId, query }),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json()
}
