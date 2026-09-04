"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
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
  useEtlDestTableColumns,
  useEtlDestTables,
  useEtlJobRuns,
  useEtlJobState,
  useEtlJobs,
  useEtlSources,
  type EtlJobInput,
  type EtlJobRecord,
  type EtlTestQueryResult,
  type EtlWatermarkType,
} from "@/hooks/api/use-etl-admin-api"

type JobWizardStep = 1 | 2 | 3 | 4 | 5

const WIZARD_STEPS: { step: JobWizardStep; label: string }[] = [
  { step: 1, label: "Basics" },
  { step: 2, label: "Source query" },
  { step: 3, label: "Destination table" },
  { step: 4, label: "Column mapping" },
  { step: 5, label: "Review & save" },
]

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
  filter_query: null,
  filter_batch_size: null,
}

const FILTER_TOKEN = "{{FILTER}}"

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
    filter_query: j.filter_query,
    filter_batch_size: j.filter_batch_size,
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
  const [triggerTimesText, setTriggerTimesText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [runFeedback, setRunFeedback] = useState<Record<string, string>>({})

  // ---- Job wizard state -------------------------------------------------
  // Step 4 (column mapping) needs the source query's actual result columns
  // — not something typed in, run for real via Test query so the mapping
  // is against columns that actually exist. sourceColumns/testedQuery
  // together guard against a stale mapping: if the query text changes
  // after a test, testedQuery no longer matches form.source_query and
  // step 2 blocks Next until it's re-tested.
  const [step, setStep] = useState<JobWizardStep>(1)
  const [maxStepReached, setMaxStepReached] = useState<JobWizardStep>(1)
  const [sourceColumns, setSourceColumns] = useState<string[]>([])
  const [testedQuery, setTestedQuery] = useState<string | null>(null)
  // Parallel to sourceColumns — mapping[i] is the destination column
  // sourceColumns[i] loads into (or null while unmapped).
  const [mapping, setMapping] = useState<(string | null)[]>([])
  // When editing an existing job, its current dest_columns are a
  // best-effort prefill for the mapping once a fresh test tells us how
  // many source columns there are and confirms the count still matches.
  const [prefillDestColumns, setPrefillDestColumns] = useState<string[] | null>(null)
  const [useCustomTableName, setUseCustomTableName] = useState(false)

  const { data: destTablesData } = useEtlDestTables(form.dest_schema)
  const destTables = destTablesData?.data ?? []
  const { data: destTableColumnsData, isLoading: destColumnsLoading } = useEtlDestTableColumns(
    form.dest_schema,
    form.dest_table || null,
  )
  const destTableColumns = destTableColumnsData?.data ?? []
  const destTableColumnNames = destTableColumns.map((c) => c.name)

  // The job's actual dest_columns — always derived from the mapping, never
  // typed twice. Used for the mapping step itself, the watermark/conflict
  // pickers in Review, and the final submit payload.
  const destColumns = mapping.filter((c): c is string => Boolean(c && c.trim()))

  const [runsJobId, setRunsJobId] = useState<string | null>(null)
  const runsJob = jobs.find((j) => j.id === runsJobId) ?? null
  const { data: runsData } = useEtlJobRuns(runsJobId, { refetchInterval: runsJobId ? 3000 : undefined })
  const { data: jobState } = useEtlJobState(runsJobId)

  const setField = <K extends keyof EtlJobInput>(key: K, value: EtlJobInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const toggleConflictColumn = (col: string) => {
    setForm((f) => ({
      ...f,
      conflict_columns: f.conflict_columns.includes(col)
        ? f.conflict_columns.filter((c) => c !== col)
        : [...f.conflict_columns, col],
    }))
  }

  const handleQueryTestResult = (result: EtlTestQueryResult | null, forQuery: string) => {
    if (!result) return
    setSourceColumns(result.columns)
    setTestedQuery(forQuery)
    setMapping(
      prefillDestColumns && prefillDestColumns.length === result.columns.length
        ? prefillDestColumns
        : result.columns.map(() => null),
    )
    setPrefillDestColumns(null)
  }

  const setMappingAt = (i: number, value: string) => setMapping((m) => m.map((v, idx) => (idx === i ? value : v)))

  // filter_query is null whenever the job isn't seeded from this app
  // database — the toggle just flips between that and a starting "" so
  // there's something to type into, while forcing mode to full_refresh
  // (filter_query only supports that server-side, see JobInput.validate).
  const filterEnabled = form.filter_query !== null

  const toggleFilterEnabled = (checked: boolean) => {
    setForm((f) =>
      checked
        ? { ...f, filter_query: f.filter_query ?? "", filter_batch_size: f.filter_batch_size ?? 1000, mode: "full_refresh" }
        : { ...f, filter_query: null, filter_batch_size: null },
    )
  }

  // Changing the destination table invalidates whatever was mapped against
  // the previous table's columns.
  const handleDestTableChange = (table: string) => {
    setField("dest_table", table)
    setMapping(sourceColumns.map(() => null))
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["etl-jobs"] })

  const resetWizard = () => {
    setStep(1)
    setMaxStepReached(1)
    setSourceColumns([])
    setTestedQuery(null)
    setMapping([])
    setUseCustomTableName(false)
  }

  const openAdd = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setTriggerTimesText("")
    setPrefillDestColumns(null)
    resetWizard()
    setFormError(null)
    setDialogOpen(true)
  }

  const openEdit = (j: EtlJobRecord) => {
    setEditingId(j.id)
    const f = jobToForm(j)
    setForm(f)
    setTriggerTimesText(f.trigger_times.join(", "))
    setPrefillDestColumns(f.dest_columns.length > 0 ? f.dest_columns : null)
    resetWizard()
    setFormError(null)
    setDialogOpen(true)
  }

  const canProceed = (s: JobWizardStep): boolean => {
    switch (s) {
      case 1:
        return Boolean(form.name.trim() && form.source_id && parseCsv(triggerTimesText).length > 0)
      case 2: {
        // Not an exact re-test-the-current-text match: a query referencing
        // {{WATERMARK}} or {{FILTER}} can never test clean, since Test
        // sends the raw text as-is (no substitution) — the source has no
        // idea what a literal "{{FILTER}}" is. Any successful test (even
        // of an earlier version of the query, e.g. before the WHERE ...
        // IN ({{FILTER}}) clause was added) is enough to detect columns
        // and move on; a stale-query hint below nudges a re-test only
        // when the SELECT list itself might have changed.
        if (!form.source_query.trim() || sourceColumns.length === 0) return false
        const hasToken = form.source_query.includes(FILTER_TOKEN)
        return filterEnabled
          ? Boolean(form.filter_query?.trim()) && hasToken && form.mode === "full_refresh"
          : !hasToken
      }
      case 3:
        return Boolean(form.dest_schema.trim() && form.dest_table.trim())
      case 4:
        return (
          mapping.length === sourceColumns.length &&
          mapping.every((v) => v && v.trim()) &&
          new Set(mapping).size === mapping.length
        )
      default:
        return true
    }
  }

  const goNext = () => {
    if (!canProceed(step)) return
    const next = (step + 1) as JobWizardStep
    setStep(next)
    setMaxStepReached((m) => (next > m ? next : m))
  }

  const goToStep = (s: JobWizardStep) => {
    if (s <= maxStepReached) setStep(s)
  }

  const handleSubmit = async () => {
    const triggerTimes = parseCsv(triggerTimesText)
    // Drop any picked conflict column that's no longer part of the mapping
    // (e.g. the user checked it, then went back and remapped that source
    // column elsewhere) rather than submitting a stale value.
    const conflictColumns = form.conflict_columns.filter((c) => destColumns.includes(c))

    if (!form.name.trim() || !form.source_id || !form.source_query.trim() || !form.dest_table.trim()) {
      setFormError("Name, source, source query, and destination table are all required")
      return
    }
    if (destColumns.length === 0 || destColumns.length !== sourceColumns.length) {
      setFormError("Map every source column to a destination column first")
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
    if (form.mode === "incremental" && form.watermark_column && !destColumns.includes(form.watermark_column)) {
      setFormError("Watermark column must be one of the mapped destination columns")
      return
    }
    if (filterEnabled && (!form.filter_query?.trim() || form.mode !== "full_refresh")) {
      setFormError("A filter query requires Full refresh mode and a non-empty query")
      return
    }

    const payload: EtlJobInput = {
      ...form,
      dest_columns: destColumns,
      conflict_columns: conflictColumns,
      trigger_times: triggerTimes,
      watermark_column: form.mode === "incremental" ? form.watermark_column : null,
      watermark_type: form.mode === "incremental" ? form.watermark_type : null,
      filter_query: filterEnabled ? (form.filter_query?.trim() ?? null) : null,
      filter_batch_size: filterEnabled ? (form.filter_batch_size ?? 1000) : null,
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
          <DialogContent
            className="sm:max-w-3xl max-h-[85vh] overflow-y-auto"
            onPointerDownOutside={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Job" : "Add Job"}</DialogTitle>
              <DialogDescription>
                {editingId ? "Update this job's configuration." : "Configure a new nightly pull."}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5 border-b pb-3">
              {WIZARD_STEPS.map(({ step: s, label }, i) => (
                <div key={s} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => goToStep(s)}
                    disabled={s > maxStepReached}
                    className={
                      "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs whitespace-nowrap transition-colors " +
                      (s === step
                        ? "bg-primary text-primary-foreground"
                        : s <= maxStepReached
                          ? "text-muted-foreground hover:bg-muted cursor-pointer"
                          : "text-muted-foreground/40 cursor-not-allowed")
                    }
                  >
                    {s < maxStepReached ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <span className="tabular-nums">{s}</span>
                    )}
                    {label}
                  </button>
                  {i < WIZARD_STEPS.length - 1 && <span className="text-muted-foreground/30">›</span>}
                </div>
              ))}
            </div>

            {step === 1 && (
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

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Mode *</label>
                  <Select value={form.mode} onValueChange={(v) => setField("mode", v as EtlJobInput["mode"])}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_refresh">Full refresh</SelectItem>
                      <SelectItem value="incremental" disabled={filterEnabled}>
                        Incremental
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {filterEnabled
                      ? "Incremental is unavailable while this job is seeded from a filter query (Source query step)."
                      : form.mode === "incremental"
                        ? "You'll pick the watermark column once the destination mapping is set, later in this form."
                        : "Every run reloads the full result set."}
                  </p>
                </div>

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

                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Enabled</p>
                    <p className="text-xs text-muted-foreground">
                      Off by default — flip on once you&apos;ve tested the query and run it manually.
                    </p>
                  </div>
                  <Switch checked={form.enabled} onCheckedChange={(v) => setField("enabled", v)} />
                </div>
              </div>
            )}

            {step === 2 && (
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
                <EtlQueryConsole
                  sources={sources}
                  sourceId={form.source_id}
                  onSourceIdChange={(v) => setField("source_id", v)}
                  query={form.source_query}
                  onQueryChange={(v) => setField("source_query", v)}
                  onResult={handleQueryTestResult}
                  embedded
                />
                {sourceColumns.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-xs text-emerald-700">
                      {sourceColumns.length} column{sourceColumns.length === 1 ? "" : "s"} detected:{" "}
                      <span className="font-mono">{sourceColumns.join(", ")}</span>
                    </p>
                    {testedQuery !== form.source_query && (
                      <p className="text-xs text-amber-700">
                        Query edited since that test — if you only added a WHERE clause (e.g. the{" "}
                        {"{{WATERMARK}}"} or {"{{FILTER}}"} token), the columns above are still correct
                        and you&apos;re fine to continue. If you changed the SELECT list itself, re-run
                        the test. (Test can&apos;t run a query containing {"{{WATERMARK}}"}/
                        {"{{FILTER}}"} literally — that&apos;s expected, not an error.)
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-amber-700">
                    Run the test above — this step needs the query&apos;s real columns to build the
                    mapping next. Test it before adding a {"{{WATERMARK}}"}/{"{{FILTER}}"} clause if
                    your query needs one, since Test can&apos;t run those tokens literally.
                  </p>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Seed this pull from your own database</p>
                    <p className="text-xs text-muted-foreground">
                      Run a query against this app database first (e.g. <code className="font-mono">app.meters</code>)
                      and use its results to filter the source query above, in batches — reference{" "}
                      <code className="font-mono">{FILTER_TOKEN}</code> inside an{" "}
                      <code className="font-mono">IN (...)</code> clause. Only for Full refresh jobs — the source
                      database never joins live against this one.
                    </p>
                  </div>
                  <Switch checked={filterEnabled} onCheckedChange={toggleFilterEnabled} />
                </div>
                {filterEnabled && (
                  <div className="space-y-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Filter query * (runs against this app database)</label>
                      <Textarea
                        value={form.filter_query ?? ""}
                        onChange={(e) => setField("filter_query", e.target.value)}
                        placeholder="SELECT meter_number FROM app.meters WHERE status = 'active'"
                        className="font-mono text-xs min-h-[70px]"
                      />
                    </div>
                    <div className="space-y-1 w-[180px]">
                      <label className="text-xs text-muted-foreground">Batch size</label>
                      <Input
                        type="number"
                        value={form.filter_batch_size ?? 1000}
                        onChange={(e) => setField("filter_batch_size", Number(e.target.value) || 1000)}
                      />
                    </div>
                    {!form.source_query.includes(FILTER_TOKEN) && (
                      <p className="text-xs text-amber-700">
                        Add <code className="font-mono">{FILTER_TOKEN}</code> to the source query above, e.g.{" "}
                        <code className="font-mono">WHERE meter_number IN ({FILTER_TOKEN})</code>.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Schema</label>
                    <Input
                      value={form.dest_schema}
                      onChange={(e) => {
                        setField("dest_schema", e.target.value)
                        handleDestTableChange("")
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-muted-foreground">Table *</label>
                      <button
                        type="button"
                        className="text-xs text-primary"
                        onClick={() => setUseCustomTableName((v) => !v)}
                      >
                        {useCustomTableName ? "Choose from list instead" : "Can't find it? Type it"}
                      </button>
                    </div>
                    {useCustomTableName ? (
                      <Input
                        value={form.dest_table}
                        onChange={(e) => handleDestTableChange(e.target.value)}
                        placeholder="table_name"
                      />
                    ) : (
                      <Select
                        value={form.dest_table || undefined}
                        onValueChange={handleDestTableChange}
                        disabled={destTables.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={destTables.length === 0 ? "No tables found in this schema" : "Choose a table"}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {destTables.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
                {form.dest_table && (
                  <p className="text-xs text-muted-foreground">
                    {destColumnsLoading
                      ? "Loading columns…"
                      : destTableColumnNames.length > 0
                        ? `${destTableColumnNames.length} column(s) found — you'll match them to the source query's columns next.`
                        : "No existing columns found for this table (maybe it hasn't been created yet) — you'll type destination column names manually in the mapping step."}
                  </p>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Match each column the source query returns to a column on{" "}
                  <span className="font-mono">
                    {form.dest_schema}.{form.dest_table}
                  </span>
                  . Every source column needs a destination — that&apos;s what gets loaded, in this
                  order.
                </p>
                <div className="rounded-md border divide-y">
                  {sourceColumns.map((sc, i) => {
                    const usingSelect = destTableColumnNames.length > 0
                    const available = destTableColumnNames.filter(
                      (name) => mapping[i] === name || !mapping.includes(name),
                    )
                    return (
                      <div key={`${sc}-${i}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-2.5">
                        <span className="text-xs font-mono truncate" title={sc}>
                          {sc}
                        </span>
                        <span className="text-muted-foreground text-xs">→</span>
                        {usingSelect ? (
                          <Select value={mapping[i] ?? undefined} onValueChange={(v) => setMappingAt(i, v)}>
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Choose a column" />
                            </SelectTrigger>
                            <SelectContent>
                              {available.map((name) => {
                                const info = destTableColumns.find((c) => c.name === name)
                                return (
                                  <SelectItem key={name} value={name}>
                                    {name}
                                    {info ? ` — ${info.data_type}` : ""}
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            className="h-8"
                            value={mapping[i] ?? ""}
                            onChange={(e) => setMappingAt(i, e.target.value)}
                            placeholder="destination_column_name"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
                {mapping.some((v) => v && mapping.filter((x) => x === v).length > 1) && (
                  <p className="text-xs text-red-600">Each destination column can only be used once.</p>
                )}
              </div>
            )}

            {step === 5 && (
              <div className="space-y-5">
                <div className="space-y-1.5 rounded-md border p-3 text-xs">
                  <p>
                    <span className="text-muted-foreground">Name:</span> {form.name}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Source:</span> {sourceName(form.source_id)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Destination:</span>{" "}
                    <span className="font-mono">
                      {form.dest_schema}.{form.dest_table}
                    </span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Mode:</span>{" "}
                    {form.mode === "incremental" ? "Incremental" : "Full refresh"}
                  </p>
                  {filterEnabled && (
                    <p>
                      <span className="text-muted-foreground">Filter query:</span>{" "}
                      <span className="font-mono">{form.filter_query}</span> (batches of{" "}
                      {form.filter_batch_size ?? 1000})
                    </p>
                  )}
                  <div>
                    <span className="text-muted-foreground">Column mapping:</span>
                    <ul className="mt-1 space-y-0.5 font-mono">
                      {sourceColumns.map((sc, i) => (
                        <li key={`${sc}-${i}`}>
                          {sc} → {mapping[i] ?? "—"}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {form.mode === "incremental" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Watermark column *</label>
                      <Select
                        value={form.watermark_column ?? undefined}
                        onValueChange={(v) => setField("watermark_column", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a column" />
                        </SelectTrigger>
                        <SelectContent>
                          {destColumns.map((col) => (
                            <SelectItem key={col} value={col}>
                              {col}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Conflict columns (optional — upsert key; leave unchecked to plain-append every run)
                  </label>
                  <div className="flex flex-wrap gap-3 rounded-md border p-2">
                    {destColumns.map((col) => (
                      <label key={col} className="flex items-center gap-1.5 text-xs">
                        <Checkbox
                          checked={form.conflict_columns.includes(col)}
                          onCheckedChange={() => toggleConflictColumn(col)}
                        />
                        {col}
                      </label>
                    ))}
                  </div>
                </div>

                {formError && <p className="text-xs text-red-600">{formError}</p>}
              </div>
            )}

            <DialogFooter className="sm:justify-between">
              <div>
                {step > 1 && (
                  <Button type="button" variant="outline" onClick={() => setStep((s) => (s - 1) as JobWizardStep)}>
                    Back
                  </Button>
                )}
              </div>
              {step < 5 ? (
                <Button type="button" onClick={goNext} disabled={!canProceed(step)}>
                  Next
                </Button>
              ) : (
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
              )}
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
        <DialogContent
          className="sm:max-w-2xl max-h-[85vh] overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
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
