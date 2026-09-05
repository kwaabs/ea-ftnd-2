"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { CheckCircle2, Loader2, Pencil, Plug, Plus, Trash2, XCircle } from "lucide-react"
import {
  createEtlSource,
  deleteEtlSource,
  testEtlSourceConnection,
  testEtlSourceConnectionDraft,
  updateEtlSource,
  useEtlSources,
  type EtlSourceInput,
  type EtlSourceRecord,
} from "@/hooks/api/use-etl-admin-api"

const EMPTY_FORM: EtlSourceInput = {
  name: "",
  kind: "postgres",
  host: "",
  port: 5432,
  database_name: "",
  username: "",
  password: "",
  extra_params: {},
  enabled: false,
}

const DEFAULT_PORT: Record<EtlSourceInput["kind"], number> = {
  oracle: 1521,
  mssql: 1433,
  postgres: 5432,
  http_api: 0, // unused for this kind
}

function sourceToForm(s: EtlSourceRecord): EtlSourceInput {
  return {
    name: s.name,
    kind: s.kind,
    host: s.host,
    port: s.port,
    database_name: s.database_name,
    username: s.username,
    // Never prefilled — the API never returns the actual password (see
    // EtlSourceInput.password's doc comment). Left blank = keep unchanged.
    password: "",
    extra_params: s.extra_params ?? {},
    enabled: s.enabled,
  }
}

export function EtlSourcesTab() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useEtlSources()
  const sources = data?.data ?? []

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<EtlSourceInput>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; message: string }>>({})
  const [draftTesting, setDraftTesting] = useState(false)
  const [draftTestResult, setDraftTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const currentSourceHasPassword = sources.find((s) => s.id === editingId)?.has_password ?? false

  const setField = <K extends keyof EtlSourceInput>(key: K, value: EtlSourceInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["etl-sources"] })

  const openAdd = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setDraftTestResult(null)
    setDialogOpen(true)
  }

  const openEdit = (s: EtlSourceRecord) => {
    setEditingId(s.id)
    setForm(sourceToForm(s))
    setFormError(null)
    setDraftTestResult(null)
    setDialogOpen(true)
  }

  const isHttpApi = form.kind === "http_api"

  const handleSubmit = async () => {
    if (isHttpApi) {
      if (!form.name.trim() || !form.host.trim() || !form.username.trim()) {
        setFormError("Name, base URL, and API ID are all required")
        return
      }
    } else if (!form.name.trim() || !form.host.trim() || !form.database_name.trim() || !form.username.trim()) {
      setFormError("Name, host, database, and username are all required")
      return
    }
    if (!editingId && !form.password?.trim()) {
      setFormError(isHttpApi ? "API key is required" : "Password is required")
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      if (editingId) {
        await updateEtlSource(editingId, form)
      } else {
        await createEtlSource(form)
      }
      await invalidate()
      setDialogOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save source")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteEtlSource(id)
      await invalidate()
    } catch (err) {
      setTestResult((r) => ({
        ...r,
        [id]: { ok: false, message: err instanceof Error ? err.message : "Failed to delete" },
      }))
    } finally {
      setDeletingId(null)
    }
  }

  const handleDraftTest = async () => {
    if (isHttpApi) {
      if (!form.host.trim() || !form.username.trim()) {
        setDraftTestResult({ ok: false, message: "Fill in the base URL and API ID first" })
        return
      }
    } else if (!form.host.trim() || !form.database_name.trim() || !form.username.trim()) {
      setDraftTestResult({ ok: false, message: "Fill in host, database, and username first" })
      return
    }
    const hasNewPassword = Boolean(form.password?.trim())
    if (!hasNewPassword && !editingId) {
      setDraftTestResult({ ok: false, message: "Enter a password first" })
      return
    }
    setDraftTesting(true)
    setDraftTestResult(null)
    try {
      // Editing with the password field left blank -> test the currently
      // saved password (via the id-based endpoint) rather than the draft
      // one, since a blank password here means "keep existing," not "no
      // password" — see EtlSourceInput.password's doc comment.
      const res =
        hasNewPassword || !editingId
          ? await testEtlSourceConnectionDraft(form)
          : await testEtlSourceConnection(editingId)
      setDraftTestResult(
        res.ok
          ? { ok: true, message: `Connected in ${res.elapsed_ms}ms` }
          : { ok: false, message: res.error || "Connection failed" },
      )
    } catch (err) {
      setDraftTestResult({ ok: false, message: err instanceof Error ? err.message : "Connection failed" })
    } finally {
      setDraftTesting(false)
    }
  }

  const handleTest = async (id: string) => {
    setTestingId(id)
    try {
      const res = await testEtlSourceConnection(id)
      setTestResult((r) => ({
        ...r,
        [id]: res.ok
          ? { ok: true, message: `Connected in ${res.elapsed_ms}ms` }
          : { ok: false, message: res.error || "Connection failed" },
      }))
    } catch (err) {
      setTestResult((r) => ({
        ...r,
        [id]: { ok: false, message: err instanceof Error ? err.message : "Connection failed" },
      }))
    } finally {
      setTestingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-muted-foreground text-sm max-w-2xl">
            External databases the ETL engine can pull from. Passwords are never stored here —
            each source names an environment variable the server reads at connect time.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Source
            </Button>
          </DialogTrigger>
          <DialogContent
            className="sm:max-w-lg max-h-[85vh] overflow-y-auto"
            onPointerDownOutside={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Source" : "Add Source"}</DialogTitle>
              <DialogDescription>
                {editingId
                  ? "Update this source's connection details."
                  : "Register a new external database. Leave disabled until you've tested the connection."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Name *</label>
                <Input
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="e.g. oracle_finance"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Kind *</label>
                <Select
                  value={form.kind}
                  onValueChange={(v) => {
                    const kind = v as EtlSourceInput["kind"]
                    setForm((f) => ({
                      ...f,
                      kind,
                      port: f.port === DEFAULT_PORT[f.kind] ? DEFAULT_PORT[kind] : f.port,
                    }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oracle">Oracle</SelectItem>
                    <SelectItem value="mssql">MSSQL</SelectItem>
                    <SelectItem value="postgres">Postgres</SelectItem>
                    <SelectItem value="http_api">HTTP API</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isHttpApi ? (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Base URL *</label>
                  <Input
                    value={form.host}
                    onChange={(e) => setField("host", e.target.value)}
                    placeholder="https://api.example.com"
                  />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-1">
                      <label className="text-xs text-muted-foreground">Host *</label>
                      <Input value={form.host} onChange={(e) => setField("host", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Port *</label>
                      <Input
                        type="number"
                        value={form.port}
                        onChange={(e) => setField("port", Number(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      {form.kind === "oracle" ? "Service name *" : "Database *"}
                    </label>
                    <Input
                      value={form.database_name}
                      onChange={(e) => setField("database_name", e.target.value)}
                    />
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    {isHttpApi ? "API ID *" : "Username *"}
                  </label>
                  <Input value={form.username} onChange={(e) => setField("username", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    {isHttpApi ? "API key" : "Password"} {editingId ? "" : "*"}
                  </label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={form.password ?? ""}
                    onChange={(e) => setField("password", e.target.value)}
                    placeholder={editingId ? `Leave blank to keep the current ${isHttpApi ? "API key" : "password"}` : ""}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {editingId
                  ? currentSourceHasPassword
                    ? `Stored encrypted. ${isHttpApi ? "An API key is" : "A password is"} currently set — leave this field blank to keep it unchanged, or enter a new one to rotate it.`
                    : `Stored encrypted. No ${isHttpApi ? "API key" : "password"} is currently set — enter one to add it.`
                  : `Stored encrypted. Required to create this source.${isHttpApi ? " Never sent on the wire itself — only used locally to sign requests (HMAC)." : ""}`}
              </p>

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleDraftTest} disabled={draftTesting}>
                  {draftTesting ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Plug className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Test connection
                </Button>
                {draftTestResult && (
                  <span
                    className={
                      "text-xs flex items-center gap-1 " +
                      (draftTestResult.ok ? "text-emerald-700" : "text-red-600")
                    }
                  >
                    {draftTestResult.ok ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    {draftTestResult.message}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Enabled</p>
                  <p className="text-xs text-muted-foreground">
                    Disabled sources can still be tested here, but no job can run against them.
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
                  "Create source"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sources</CardTitle>
          <CardDescription>{sources.length} registered</CardDescription>
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
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground">Kind</th>
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground">Host</th>
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground">Database</th>
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground">Test</th>
                    <th className="text-right py-2 pl-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center text-muted-foreground py-8">
                        No sources registered yet.
                      </td>
                    </tr>
                  ) : (
                    sources.map((s) => (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="py-2.5 pr-4 font-medium">{s.name}</td>
                        <td className="py-2.5 px-4">
                          <Badge variant="outline" className="text-xs font-normal uppercase">
                            {s.kind}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground">
                          {s.kind === "http_api" ? s.host : `${s.host}:${s.port}`}
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground">
                          {s.kind === "http_api" ? "—" : s.database_name}
                        </td>
                        <td className="py-2.5 px-4">
                          <Badge
                            variant="outline"
                            className={
                              s.enabled
                                ? "text-xs font-normal text-emerald-700 border-emerald-300"
                                : "text-xs font-normal text-muted-foreground"
                            }
                          >
                            {s.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              disabled={testingId === s.id}
                              onClick={() => handleTest(s.id)}
                              title="Test connection"
                            >
                              {testingId === s.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Plug className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            {testResult[s.id] && (
                              <span
                                className={
                                  "text-xs flex items-center gap-1 " +
                                  (testResult[s.id].ok ? "text-emerald-700" : "text-red-600")
                                }
                              >
                                {testResult[s.id].ok ? (
                                  <CheckCircle2 className="h-3 w-3" />
                                ) : (
                                  <XCircle className="h-3 w-3" />
                                )}
                                {testResult[s.id].message}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 pl-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(s)}
                              title="Edit source"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-red-600"
                                  disabled={deletingId === s.id}
                                  title="Delete source"
                                >
                                  {deletingId === s.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete this source?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {s.name} will be removed. This fails if any job still uses it —
                                    delete or repoint those jobs first.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(s.id)}>
                                    Delete source
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
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
    </div>
  )
}
