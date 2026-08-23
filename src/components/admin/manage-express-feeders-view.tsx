"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
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
import { TablePagination } from "@/components/ui/table-pagination"
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { MeterPicker } from "@/components/admin/meter-picker"
import {
  useExpressFeedersAdmin,
  createExpressFeeder,
  updateExpressFeeder,
  deleteExpressFeeder,
  type ExpressFeederAdminInput,
  type ExpressFeederAdminRecord,
} from "@/hooks/api/use-express-feeders-admin-api"

const EMPTY_FORM: ExpressFeederAdminInput = {
  feeder_name: "",
  sap_version: null,
  comments: null,
  sending_meter_id: "",
  sending_station: null,
  sending_type_of_station: null,
  sending_code: null,
  sending_region: null,
  sending_district: null,
  receiving_meter_id: "",
  receiving_station: null,
  receiving_type_of_station: null,
  receiving_code: null,
  receiving_region: null,
  receiving_district: null,
}

function feederToForm(f: ExpressFeederAdminRecord): ExpressFeederAdminInput {
  return {
    feeder_name: f.feeder_name,
    sap_version: f.sap_version ?? null,
    comments: f.comments ?? null,
    sending_meter_id: f.sending_meter_id,
    sending_station: f.sending_station ?? null,
    sending_type_of_station: f.sending_type_of_station ?? null,
    sending_code: f.sending_code ?? null,
    sending_region: f.sending_region ?? null,
    sending_district: f.sending_district ?? null,
    receiving_meter_id: f.receiving_meter_id,
    receiving_station: f.receiving_station ?? null,
    receiving_type_of_station: f.receiving_type_of_station ?? null,
    receiving_code: f.receiving_code ?? null,
    receiving_region: f.receiving_region ?? null,
    receiving_district: f.receiving_district ?? null,
  }
}

const PAGE_SIZE = 20

function textField(
  value: string | null | undefined,
  onChange: (v: string | null) => void,
  placeholder?: string,
) {
  return (
    <Input
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
    />
  )
}

export function ManageExpressFeedersView() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")

  const { data, isLoading } = useExpressFeedersAdmin({
    search: search || undefined,
    page,
    limit: PAGE_SIZE,
  })
  const feeders = data?.data ?? []
  const meta = data?.meta

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingSendingMeterNumber, setEditingSendingMeterNumber] = useState<string | null>(null)
  const [editingReceivingMeterNumber, setEditingReceivingMeterNumber] = useState<string | null>(null)
  const [form, setForm] = useState<ExpressFeederAdminInput>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const setField = <K extends keyof ExpressFeederAdminInput>(
    key: K,
    value: ExpressFeederAdminInput[K],
  ) => setForm((f) => ({ ...f, [key]: value }))

  const openAdd = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setEditingSendingMeterNumber(null)
    setEditingReceivingMeterNumber(null)
    setFormError(null)
    setDialogOpen(true)
  }

  const openEdit = (feeder: ExpressFeederAdminRecord) => {
    setEditingId(feeder.id)
    setForm(feederToForm(feeder))
    setEditingSendingMeterNumber(feeder.sending_meter_number)
    setEditingReceivingMeterNumber(feeder.receiving_meter_number)
    setFormError(null)
    setDialogOpen(true)
  }

  const invalidateList = () => queryClient.invalidateQueries({ queryKey: ["express-feeders-admin"] })

  const handleSubmit = async () => {
    if (!form.feeder_name.trim()) {
      setFormError("Feeder name is required")
      return
    }
    if (!form.sending_meter_id || !form.receiving_meter_id) {
      setFormError("Both a sending and receiving meter are required")
      return
    }
    if (form.sending_meter_id === form.receiving_meter_id) {
      setFormError("Sending and receiving meters must be different")
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      if (editingId) {
        await updateExpressFeeder(editingId, form)
      } else {
        await createExpressFeeder(form)
      }
      await invalidateList()
      setDialogOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save express feeder")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteExpressFeeder(id)
      await invalidateList()
    } catch (err) {
      console.error(err)
    } finally {
      setDeletingId(null)
    }
  }

  const totalPages = meta?.pages ?? 1
  const totalItems = meta?.total ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            Express Feeders
          </h2>
          <p className="text-muted-foreground mt-1">
            Pair sending and receiving meters under one feeder name
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Express Feeder
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Express Feeder" : "Add Express Feeder"}</DialogTitle>
              <DialogDescription>
                {editingId
                  ? "Update this pairing's details."
                  : "Register a new sending/receiving meter pair. Feeder name and both meters are required."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Identity</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Feeder name *</label>
                    {textField(form.feeder_name, (v) => setField("feeder_name", v ?? ""))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">SAP version</label>
                    {textField(form.sap_version, (v) => setField("sap_version", v))}
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs text-muted-foreground">Comments</label>
                    {textField(form.comments, (v) => setField("comments", v))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Sending meter</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs text-muted-foreground">Meter *</label>
                    <MeterPicker
                      value={form.sending_meter_id || null}
                      meterNumber={editingSendingMeterNumber}
                      excludeId={form.receiving_meter_id || null}
                      onChange={(id, meterNumber) => {
                        setField("sending_meter_id", id ?? "")
                        setEditingSendingMeterNumber(meterNumber)
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Station</label>
                    {textField(form.sending_station, (v) => setField("sending_station", v))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Type of station</label>
                    {textField(
                      form.sending_type_of_station,
                      (v) => setField("sending_type_of_station", v),
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Code</label>
                    {textField(form.sending_code, (v) => setField("sending_code", v))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Region</label>
                    {textField(form.sending_region, (v) => setField("sending_region", v))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">District</label>
                    {textField(form.sending_district, (v) => setField("sending_district", v))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Receiving meter</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs text-muted-foreground">Meter *</label>
                    <MeterPicker
                      value={form.receiving_meter_id || null}
                      meterNumber={editingReceivingMeterNumber}
                      excludeId={form.sending_meter_id || null}
                      onChange={(id, meterNumber) => {
                        setField("receiving_meter_id", id ?? "")
                        setEditingReceivingMeterNumber(meterNumber)
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Station</label>
                    {textField(form.receiving_station, (v) => setField("receiving_station", v))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Type of station</label>
                    {textField(
                      form.receiving_type_of_station,
                      (v) => setField("receiving_type_of_station", v),
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Code</label>
                    {textField(form.receiving_code, (v) => setField("receiving_code", v))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Region</label>
                    {textField(form.receiving_region, (v) => setField("receiving_region", v))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">District</label>
                    {textField(form.receiving_district, (v) => setField("receiving_district", v))}
                  </div>
                </div>
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
                  "Create express feeder"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Express Feeders</CardTitle>
          <CardDescription>{totalItems.toLocaleString()} total</CardDescription>
          <div className="flex flex-wrap gap-3 pt-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search feeder name or meter number…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                        Feeder name
                      </th>
                      <th className="text-left py-2 px-4 font-medium text-muted-foreground">
                        SAP version
                      </th>
                      <th className="text-left py-2 px-4 font-medium text-blue-700 dark:text-blue-400 border-l-2 border-blue-300 dark:border-blue-800">
                        Sending
                      </th>
                      <th className="text-left py-2 px-4 font-medium text-emerald-700 dark:text-emerald-400 border-l-2 border-emerald-300 dark:border-emerald-800">
                        Receiving
                      </th>
                      <th className="text-right py-2 pl-4 font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {feeders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center text-muted-foreground py-8">
                          No express feeders match these filters.
                        </td>
                      </tr>
                    ) : (
                      feeders.map((feeder) => (
                        <tr key={feeder.id} className="border-b last:border-0 hover:bg-muted/40">
                          <td className="py-2.5 pr-4 font-medium">{feeder.feeder_name}</td>
                          <td className="py-2.5 px-4 text-muted-foreground">
                            {feeder.sap_version || "—"}
                          </td>
                          <td className="py-2.5 px-4 border-l-2 border-blue-200 dark:border-blue-900">
                            <p className="font-medium text-blue-900 dark:text-blue-100">
                              {feeder.sending_meter_number}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {[feeder.sending_station, feeder.sending_region].filter(Boolean).join(" — ") || "—"}
                            </p>
                          </td>
                          <td className="py-2.5 px-4 border-l-2 border-emerald-200 dark:border-emerald-900">
                            <p className="font-medium text-emerald-900 dark:text-emerald-100">
                              {feeder.receiving_meter_number}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {[feeder.receiving_station, feeder.receiving_region].filter(Boolean).join(" — ") || "—"}
                            </p>
                          </td>
                          <td className="py-2.5 pl-4">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEdit(feeder)}
                                title="Edit express feeder"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-red-600"
                                    disabled={deletingId === feeder.id}
                                    title="Retire express feeder"
                                  >
                                    {deletingId === feeder.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Retire this express feeder?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {feeder.feeder_name} will stop appearing in Express Feeder
                                      dashboards going forward. Historical consumption data tied
                                      to it is preserved.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(feeder.id)}>
                                      Retire express feeder
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

              {totalPages > 1 && (
                <div className="mt-4">
                  <TablePagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    pageSize={PAGE_SIZE}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
