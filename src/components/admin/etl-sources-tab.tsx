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
  password_env_var: "",
  extra_params: {},
  enabled: false,
}

const DEFAULT_PORT: Record<EtlSourceInput["kind"], number> = {
  oracle: 1521,
  mssql: 1433,
  postgres: 5432,
}

function sourceToForm(s: EtlSourceRecord): EtlSourceInput {
  return {
    name: s.name,
    kind: s.kind,
    host: s.host,
    port: s.port,
    database_name: s.database_name,
    username: s.username,
    password_env_var: s.password_env_var,
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

  const setField = <K extends keyof EtlSourceInput>(key: K, value: EtlSourceInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["etl-sources"] })

  const openAdd = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setDialogOpen(true)
  }

  const openEdit = (s: EtlSourceRecord) => {
    setEditingId(s.id)
    setForm(sourceToForm(s))
    setFormError(null)
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.host.trim() || !form.database_name.trim() || !form.username.trim() || !form.password_env_var.trim()) {
      setFormError("Name, host, database, username, and password env var are all required")
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
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
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
                  </SelectContent>
                </Select>
              </div>
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Username *</label>
                  <Input value={form.username} onChange={(e) => setField("username", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Password env var *</label>
                  <Input
                    value={form.password_env_var}
                    onChange={(e) => setField("password_env_var", e.target.value)}
                    placeholder="ETL_ORACLE_FINANCE_PASSWORD"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Set <code className="font-mono">{form.password_env_var || "ETL_..._PASSWORD"}</code> in
                the server&apos;s environment — this password is never sent to or stored by this UI.
              </p>

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
                          {s.host}:{s.port}
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground">{s.database_name}</td>
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
