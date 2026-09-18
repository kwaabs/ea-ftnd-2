"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { statusBadge, formatElapsed } from "@/components/admin/etl-jobs-tab"
import { useEtlRunLogs } from "@/hooks/api/use-etl-admin-api"

/** "9m 42s" between two timestamps -- a finished run's actual duration,
 * same coarse (no ms) style as formatElapsed's "still running" elapsed. */
function formatDuration(startedAt: string, finishedAt: string): string {
  const totalSeconds = Math.max(0, Math.floor((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

/** Every run of every job, most recent first -- a single place to see what
 * ran, when, and how it went, instead of opening each job's own Runs
 * history one at a time. Read-only: no filters, no actions, just the log. */
export function EtlLogsTab() {
  const { data, isLoading } = useEtlRunLogs({ limit: 100 })
  const logs = data?.data ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logs</CardTitle>
        <CardDescription>The last {logs.length} run{logs.length === 1 ? "" : "s"}, across every job.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No runs yet.</p>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[700px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Job</th>
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground">Started</th>
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground">Duration</th>
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground">Rows</th>
                  <th className="text-left py-2 pl-4 font-medium text-muted-foreground">Detail</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((r) => (
                  <tr key={r.run_id} className="border-b last:border-0 align-top hover:bg-muted/40">
                    <td className="py-2.5 pr-4 font-medium">{r.job_name}</td>
                    <td className="py-2.5 px-4">{statusBadge(r.status)}</td>
                    <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap">
                      {new Date(r.started_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap">
                      {r.finished_at ? formatDuration(r.started_at, r.finished_at) : `${formatElapsed(r.started_at)} so far`}
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap">
                      {r.rows_extracted.toLocaleString()} extracted, {r.rows_loaded.toLocaleString()} loaded
                    </td>
                    <td className="py-2.5 pl-4 max-w-md space-y-1.5">
                      {r.error_message && (
                        <p className="text-xs text-red-700 break-words">{r.error_message}</p>
                      )}
                      {r.query_text && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground w-fit">
                            View query sent
                          </summary>
                          <pre className="mt-1.5 max-h-64 overflow-auto rounded bg-muted p-2 font-mono text-[11px] whitespace-pre-wrap break-all">
                            {r.query_text}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
