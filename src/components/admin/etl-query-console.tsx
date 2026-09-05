"use client"

import { useState } from "react"
import { Loader2, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SqlTextarea } from "@/components/admin/sql-textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  type EtlSourceRecord,
  type EtlTestQueryResult,
  testEtlQuery,
} from "@/hooks/api/use-etl-admin-api"

interface EtlQueryConsoleProps {
  sources: EtlSourceRecord[]
  sourceId: string
  onSourceIdChange: (id: string) => void
  query: string
  onQueryChange: (q: string) => void
  /** Compact mode for embedding inside the job form dialog — smaller
   * heading, no page-level framing. */
  embedded?: boolean
  /** Fired after each run — the result on success, or null on failure/no
   * result. The Job form's mapping step uses this to capture the exact
   * source columns (and the query they came from) it needs to map against
   * a destination table, without keeping its own separate copy of the
   * test-run logic. */
  onResult?: (result: EtlTestQueryResult | null, forQuery: string) => void
}

/**
 * A source-scoped, read-only query runner — the "does this query work"
 * check described as the planning step before a job is trusted with a
 * schedule. Runs whatever SELECT the operator types: a handful of sample
 * rows, a SELECT COUNT(*), a SELECT COUNT(DISTINCT col), anything —
 * doesn't touch a destination table or a job's watermark, purely a
 * preview against the source. Backend enforces SELECT-only and caps
 * results at 200 rows (see internal/etl/service.go's TestQuery).
 *
 * Fully controlled (sourceId/query are owned by the caller) so this same
 * component works both standalone (its own local state) and embedded in
 * the job form dialog, where testing and editing a job's source_query are
 * literally the same state — no separate copy to keep in sync.
 */
export function EtlQueryConsole({
  sources,
  sourceId,
  onSourceIdChange,
  query,
  onQueryChange,
  embedded,
  onResult,
}: EtlQueryConsoleProps) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<EtlTestQueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    if (!sourceId) {
      setError("Choose a source first")
      return
    }
    if (!query.trim()) {
      setError("Enter a query first")
      return
    }
    setRunning(true)
    setError(null)
    try {
      const res = await testEtlQuery(sourceId, query)
      setResult(res)
      onResult?.(res, query)
    } catch (err) {
      setResult(null)
      setError(err instanceof Error ? err.message : "Query failed")
      onResult?.(null, query)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-3">
      {!embedded && (
        <div>
          <h3 className="text-sm font-semibold text-foreground">Test query</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Run a read-only query against a source and preview the result — a few sample rows, a
            row count, a count of distinct values, whatever you want to check. Nothing here is
            saved or loaded anywhere.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Select value={sourceId} onValueChange={onSourceIdChange}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Choose a source" />
          </SelectTrigger>
          <SelectContent>
            {sources.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} ({s.kind})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" onClick={run} disabled={running} size="sm">
          {running ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5 mr-1.5" />
          )}
          Run
        </Button>
      </div>

      <SqlTextarea
        value={query}
        onChange={onQueryChange}
        placeholder="SELECT * FROM invoices FETCH FIRST 20 ROWS ONLY"
        className="min-h-[100px]"
      />

      {error && <p className="text-xs text-red-600">{error}</p>}

      {result && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {result.rows.length} row{result.rows.length === 1 ? "" : "s"}
            {result.truncated ? " (truncated at 200)" : ""} · {result.elapsed_ms}ms
          </p>
          {result.columns.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No columns returned.</p>
          ) : (
            <div className="overflow-x-auto max-h-[320px] overflow-y-auto rounded border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr className="border-b">
                    {result.columns.map((c) => (
                      <th key={c} className="text-left py-1.5 px-2 font-medium text-muted-foreground whitespace-nowrap">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.length === 0 ? (
                    <tr>
                      <td colSpan={result.columns.length} className="text-center text-muted-foreground py-4">
                        No rows.
                      </td>
                    </tr>
                  ) : (
                    result.rows.map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        {row.map((v, j) => (
                          <td key={j} className="py-1 px-2 whitespace-nowrap font-mono">
                            {v === null || v === undefined ? (
                              <span className="text-muted-foreground">NULL</span>
                            ) : (
                              String(v)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
