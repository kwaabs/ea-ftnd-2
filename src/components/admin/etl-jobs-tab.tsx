"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { CheckCircle2, Clock, Loader2, Pencil, Play, Plus, Trash2, XCircle } from "lucide-react"
import { EtlQueryConsole } from "@/components/admin/etl-query-console"
import {
  createEtlJob,
  deleteEtlJob,
  runEtlJobNow,
  updateEtlJob,
  useEtlJobRuns,
  useEtlJobState,
  useEtlJobs,
  useEtlSources,
  type EtlJobInput,
  type EtlJobRecord,
  type EtlWatermarkType,
} from "@/hooks/api/use-etl-admin-api"

const EMPTY_FORM: EtlJobInput = {
  name: "",
  source_id: "",
  source_query: "",
  dest_schema: "app",
  dest_table: "",
  dest_columns: [],
  mode: "full_refresh",
  watermark_column: null,
  watermark_type: null,
  conflict_columns: [],
  trigger_times: [],
  batch_size: 5000,
  timeout_seconds: 3600,
  enabled: false,
}

function jobToForm(j: EtlJobRecord): EtlJobInput {
  return {
    name: j.name,
    source_id: j.source_id,
    source_query: j.source_query,
    dest_schema: j.dest_schema,
    dest_table: j.dest_table,
    dest_columns: j.dest_columns ?? [],
    mode: j.mode,
    watermark_column: j.watermark_column,
    watermark_type: j.watermark_type,
    conflict_columns: j.conflict_columns ?? [],
    trigger_times: j.trigger_times ?? [],
    batch_size: j.batch_size,
    timeout_seconds: j.timeout_seconds,
    enabled: j.enabled,
  }
}

/** Comma-separated list <-> array — kept as raw text while typing (no
 * per-keystroke parse/rejoin, which fights the user over commas/spaces),
 * parsed to a trimmed, non-empty-entry array only at submit. */
function parseCsv(s: string): string[] {
  return s
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
}

function statusBadge(status: string) {
  if (status === "success") {
    return (
      <Badge variant="outline" className="text-xs font-normal text-emerald-700 border-emerald-300 gap-1">
        <CheckCircle2 className="h-3 w-3" /> success
      </Badge>
    )
  }
  if (status === "failed") {
    return (
      <Badge variant="outline" className="text-xs font-normal text-red-700 border-red-300 gap-1">
        <XCircle className="h-3 w-3" /> failed
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-xs font-normal text-amber-700 border-amber-300 gap-1">
      <Clock className="h-3 w-3" /> running
    </Badge>
  )
}

export function EtlJobsTab() {
  const queryClient = useQueryClient()
  const { data: jobsData, isLoading } = useEtlJobs()
  const jobs = jobsData?.data ?? []
  const { data: sourcesData } = useEtlSources()
  const sources = sourcesData?.data ?? []

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<EtlJobInput>(EMPTY_FORM)
  const [destColumnsText, setDestColumnsText] = useState("")
  const [conflictColumnsText, setConflictColumnsText] = useState("")
  const [triggerTimesText, setTriggerTimesText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [runFeedback, setRunFeedback] = useState<Record<string, string>>({})

  const [runsJobId, setRunsJobId] = useState<string | null>(null)
  const runsJob = jobs.find((j) => j.id === runsJobId) ?? null
  const { data: runsData } = useEtlJobRuns(runsJobId, { refetchInterval: runsJobId ? 3000 : undefined })
  const { data: jobState } = useEtlJobState(runsJobId)

  const setField = <K extends keyof EtlJobInput>(key: K, value: EtlJobInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["etl-jobs"] })

  const openAdd = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDestColumnsText("")
    setConflictColumnsText("")
    setTriggerTimesText("")
    setFormError(null)
    setDialogOpen(true)
  }

  const openEdit = (j: EtlJobRecord) => {
    setEditingId(j.id)
    const f = jobToForm(j)
    setForm(f)
    setDestColumnsText(f.dest_columns.join(", "))
    setConflictColumnsText(f.conflict_columns.join(", "))
    setTriggerTimesText(f.trigger_times.join(", "))
    setFormError(null)
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    const destColumns = parseCsv(destColumnsText)
    const conflictColumns = parseCsv(conflictColumnsText)
    const triggerTimes = parseCsv(triggerTimesText)

    if (!form.name.trim() || !form.source_id || !form.source_query.trim() || !form.dest_table.trim()) {
      setFormError("Name, source, source query, and destination table are all required")
      return
    }
    if (destColumns.length === 0) {
      setFormError("Destination columns must have at least one entry")
      return
    }
    if (triggerTimes.length === 0) {
      setFormError("Trigger times must have at least one entry, e.g. 01:00")
      return
    }
    if (form.mode === "incremental" && (!form.watermark_column || !form.watermark_type)) {
      setFormError("Incremental jobs need a watermark column and type")
      return
    }

    const payload: EtlJobInput = {
      ...form,
      dest_columns: destColumns,
      conflict_columns: conflictColumns,
      trigger_times: triggerTimes,
      watermark_column: form.mode === "incremental" ? form.watermark_column : null,
      watermark_type: form.mode === "incremental" ? form.watermark_type : null,
    }

    setSubmitting(true)
    setFormError(null)
    try {
      if (editingId) {
        await updateEtlJob(editingId, payload)
      } else {
        await createEtlJob(payload)
      }
      await invalidate()
      setDialogOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save job")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteEtlJob(id)
      await invalidate()
    } catch (err) {
      console.error(err)
    } finally {
      setDeletingId(null)
    }
  }

  const handleRunNow = async (id: string) => {
    setRunningId(id)
    setRunFeedback((f) => ({ ...f, [id]: "" }))
    try {
      await runEtlJobNow(id)
      setRunFeedback((f) => ({ ...f, [id]: "Started — check Runs for progress" }))
      setRunsJobId(id)
    } catch (err) {
      setRunFeedback((f) => ({ ...f, [id]: err instanceof Error ? err.message : "Failed to start" }))
    } finally {
      setRunningId(null)
    }
  }

  const sourceName = (id: string) => sources.find((s) => s.id === id)?.name ?? "—"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-muted-foreground text-sm max-w-2xl">
          What to pull and where to land it, on its own nightly schedule. The worker just obeys
          this once it&apos;s enabled — use Test query (in the form) and Run now (in the table) to
          validate before turning it on.
        </p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAdd} disabled={sources.length === 0}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Job
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Job" : "Add Job"}</DialogTitle>
              <DialogDescription>
                {editingId ? "Update this job's configuration." : "Configure a new nightly pull."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Name *</label>
                  <Input value={form.name} onChange={(e) => setField("name", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Source *</label>
                  <Select value={form.source_id} onValueChange={(v) => setField("source_id", v)}>
                    <SelectTrigger>
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
                </div>
              </div>

              <div className="space-y-2 rounded-md border p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Source query * — SELECT only. For an incremental job, include the literal token{" "}
                  <code className="font-mono">{"{{WATERMARK}}"}</code> and{" "}
                  <code className="font-mono">ORDER BY</code> the watermark column ascending.
                </p>
                <Textarea
                  value={form.source_query}
                  onChange={(e) => setField("source_query", e.target.value)}
                  placeholder="SELECT id, amount, updated_at FROM invoices WHERE updated_at > {{WATERMARK}} ORDER BY updated_at"
                  className="font-mono text-xs min-h-[90px]"
                />
                {form.source_id ? (
                  <details className="pt-1">
                    <summary className="text-xs text-primary cursor-pointer select-none">
                      Test this query
                    </summary>
                    <div className="pt-2">
                      <EtlQueryConsole
                        sources={sources}
                        sourceId={form.source_id}
                        onSourceIdChange={(v) => setField("source_id", v)}
                        query={form.source_query}
                        onQueryChange={(v) => setField("source_query", v)}
                        embedded
                      />
                    </div>
                  </details>
                ) : (
                  <p className="text-xs text-muted-foreground">Choose a source above to test this query.</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Destination</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Schema</label>
                    <Input value={form.dest_schema} onChange={(e) => setField("dest_schema", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Table *</label>
                    <Input value={form.dest_table} onChange={(e) => setField("dest_table", e.target.value)} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs text-muted-foreground">
                      Columns * (comma-separated, in the same order as the SELECT list)
                    </label>
                    <Input
                      value={destColumnsText}
                      onChange={(e) => setDestColumnsText(e.target.value)}
                      placeholder="id, amount, updated_at"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs text-muted-foreground">
                      Conflict columns (optional — upsert key; leave blank to plain-append every run)
                    </label>
                    <Input
                      value={conflictColumnsText}
                      onChange={(e) => setConflictColumnsText(e.target.value)}
                      placeholder="id"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Mode</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Mode *</label>
                    <Select value={form.mode} onValueChange={(v) => setField("mode", v as EtlJobInput["mode"])}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_refresh">Full refresh</SelectItem>
                        <SelectItem value="incremental">Incremental</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.mode === "incremental" && (
                    <>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Watermark column *</label>
                        <Input
                          value={form.watermark_column ?? ""}
                          onChange={(e) => setField("watermark_column", e.target.value || null)}
                          placeholder="updated_at"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Watermark type *</label>
                        <Select
                          value={form.watermark_type ?? undefined}
                          onValueChange={(v) => setField("watermark_type", v as EtlWatermarkType)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="timestamp">Timestamp</SelectItem>
                            <SelectItem value="integer">Integer</SelectItem>
                            <SelectItem value="string">String</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Schedule &amp; limits</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs text-muted-foreground">
                      Trigger times * (comma-separated, 24h UTC)
                    </label>
                    <Input
                      value={triggerTimesText}
                      onChange={(e) => setTriggerTimesText(e.target.value)}
                      placeholder="01:00, 03:30"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Batch size</label>
                    <Input
                      type="number"
                      value={form.batch_size}
                      onChange={(e) => setField("batch_size", Number(e.target.value) || 5000)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Timeout (seconds)</label>
                    <Input
                      type="number"
                      value={form.timeout_seconds}
                      onChange={(e) => setField("timeout_seconds", Number(e.target.value) || 3600)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Enabled</p>
                  <p className="text-xs text-muted-foreground">
                    Off by default — flip on once you&apos;ve tested the query and run it manually.
                  </p>
                </div>
                <Switch checked={form.enabled} onCheckedChange={(v) => setField("enabled", v)} />
              </div>

              {formError && <p className="text-xs text-red-600">{formError}</p>}
            </div>

            <DialogFooter>
              <Button type="button" onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Saving…
                  </>
                ) : editingId ? (
                  "Save changes"
                ) : (
                  "Create job"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {sources.length === 0 && (
        <p className="text-xs text-amber-700">Register a source first (Sources tab) before adding a job.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Jobs</CardTitle>
          <CardDescription>{jobs.length} configured</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Name</th>
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground">Source</th>
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground">Destination</th>
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground">Mode</th>
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground">Trigger times</th>
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-2 pl-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center text-muted-foreground py-8">
                        No jobs configured yet.
                      </td>
                    </tr>
                  ) : (
                    jobs.map((j) => (
                      <tr key={j.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="py-2.5 pr-4 font-medium">{j.name}</td>
                        <td className="py-2.5 px-4 text-muted-foreground">{sourceName(j.source_id)}</td>
                        <td className="py-2.5 px-4 text-muted-foreground font-mono text-xs">
                          {j.dest_schema}.{j.dest_table}
                        </td>
                        <td className="py-2.5 px-4">
                          <Badge variant="outline" className="text-xs font-normal">
                            {j.mode === "incremental" ? "Incremental" : "Full refresh"}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground">{j.trigger_times.join(", ")}</td>
                        <td className="py-2.5 px-4">
                          <Badge
                            variant="outline"
                            className={
                              j.enabled
                                ? "text-xs font-normal text-emerald-700 border-emerald-300"
                                : "text-xs font-normal text-muted-foreground"
                            }
                          >
                            {j.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </td>
                        <td className="py-2.5 pl-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs"
                              onClick={() => setRunsJobId(j.id)}
                              title="View run history"
                            >
                              Runs
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={runningId === j.id}
                              onClick={() => handleRunNow(j.id)}
                              title="Run now"
                            >
                              {runningId === j.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Play className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(j)}
                              title="Edit job"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-red-600"
                                  disabled={deletingId === j.id}
                                  title="Delete job"
                                >
                                  {deletingId === j.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete this job?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {j.name} and its run history/watermark will be removed. The
                                    destination table itself is not touched.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(j.id)}>
                                    Delete job
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                          {runFeedback[j.id] && (
                            <p className="text-[11px] text-muted-foreground text-right mt-0.5">
                              {runFeedback[j.id]}
                            </p>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(runsJobId)} onOpenChange={(open) => !open && setRunsJobId(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Runs — {runsJob?.name ?? ""}</DialogTitle>
            <DialogDescription>
              {jobState?.last_watermark
                ? `Current watermark: ${jobState.last_watermark}`
                : "No watermark recorded yet (full refresh, or no successful incremental run)."}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Started</th>
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-right py-2 px-4 font-medium text-muted-foreground">Extracted</th>
                  <th className="text-right py-2 px-4 font-medium text-muted-foreground">Loaded</th>
                  <th className="text-left py-2 pl-4 font-medium text-muted-foreground">Error</th>
                </tr>
              </thead>
              <tbody>
                {!runsData || runsData.data.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-muted-foreground py-8">
                      No runs yet.
                    </td>
                  </tr>
                ) : (
                  runsData.data.map((run) => (
                    <tr key={run.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 text-xs whitespace-nowrap">
                        {new Date(run.started_at).toLocaleString()}
                      </td>
                      <td className="py-2 px-4">{statusBadge(run.status)}</td>
                      <td className="py-2 px-4 text-right tabular-nums">{run.rows_extracted.toLocaleString()}</td>
                      <td className="py-2 px-4 text-right tabular-nums">{run.rows_loaded.toLocaleString()}</td>
                      <td className="py-2 pl-4 text-xs text-red-600 max-w-[220px] truncate" title={run.error_message ?? ""}>
                        {run.error_message ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
