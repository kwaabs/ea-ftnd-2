"use client"

import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import { TablePagination } from "@/components/ui/table-pagination"
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { useMeters } from "@/hooks/api/use-meter-api"
import { useFilterOptionsWithAvailability } from "@/hooks/api/use-filter-options"
import {
  createMeter,
  updateMeter,
  deleteMeter,
  type MeterAdminInput,
} from "@/hooks/api/use-meters-admin-api"
import type { Meter } from "@/lib/types/api"

const EMPTY_FORM: MeterAdminInput = {
  meter_number: "",
  meter_type: "",
  spn: null,
  meter_brand: null,
  location: null,
  digital_address: null,
  status: null,
  metering_point: null,
  boundary_metering_point: null,
  incomer: null,
  region: null,
  district: null,
  station: null,
  multiply_factor: null,
  ct_ratio_primary: null,
  ct_ratio_secondary: null,
  vt_ratio_primary: null,
  vt_ratio_secondary: null,
  latitude: null,
  longitude: null,
  voltage_kv: null,
  feeder_panel_name: null,
}

function meterToForm(meter: Meter): MeterAdminInput {
  return {
    meter_number: meter.meter_number,
    meter_type: meter.meter_type,
    spn: null,
    meter_brand: null,
    location: meter.location ?? null,
    digital_address: null,
    status: meter.status ?? null,
    metering_point: null,
    boundary_metering_point: meter.boundary_metering_point ?? null,
    incomer: null,
    region: meter.region ?? null,
    district: meter.district ?? null,
    station: meter.station ?? null,
    multiply_factor: null,
    ct_ratio_primary: null,
    ct_ratio_secondary: null,
    vt_ratio_primary: null,
    vt_ratio_secondary: null,
    latitude: null,
    longitude: null,
    voltage_kv: meter.voltage_kv ?? null,
    feeder_panel_name: null,
  }
}

const PAGE_SIZE = 20

function numField(
  value: number | null | undefined,
  onChange: (v: number | null) => void,
  placeholder?: string,
) {
  return (
    <Input
      type="number"
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
    />
  )
}

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

export function ManageMetersView() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [regionFilter, setRegionFilter] = useState<string>("all")
  const [meterTypeFilter, setMeterTypeFilter] = useState<string>("all")

  const { data: filterOptions } = useFilterOptionsWithAvailability()
  const regions = filterOptions?.all?.regions ?? []
  const districts = filterOptions?.all?.districts ?? []
  const stations = filterOptions?.all?.stations ?? []

  const { data, isLoading } = useMeters({
    search: search || undefined,
    region: regionFilter !== "all" ? regionFilter : undefined,
    meter_type: meterTypeFilter !== "all" ? (meterTypeFilter as never) : undefined,
    page,
    limit: PAGE_SIZE,
  })
  const meters = data?.data?.data ?? []
  const meta = data?.data?.meta

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<MeterAdminInput>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const setField = <K extends keyof MeterAdminInput>(key: K, value: MeterAdminInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const openAdd = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setDialogOpen(true)
  }

  const openEdit = (meter: Meter) => {
    setEditingId(meter.id)
    setForm(meterToForm(meter))
    setFormError(null)
    setDialogOpen(true)
  }

  const invalidateList = () => queryClient.invalidateQueries({ queryKey: ["meters"] })

  const handleSubmit = async () => {
    if (!form.meter_number.trim() || !form.meter_type.trim()) {
      setFormError("Meter number and meter type are required")
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      if (editingId) {
        await updateMeter(editingId, form)
      } else {
        await createMeter(form)
      }
      await invalidateList()
      setDialogOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save meter")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteMeter(id)
      await invalidateList()
    } catch (err) {
      console.error(err)
    } finally {
      setDeletingId(null)
    }
  }

  const totalPages = meta?.pages ?? 1
  const totalItems = meta?.total ?? 0

  const meterTypeOptions = useMemo(
    () => [...new Set(filterOptions?.all?.meterTypes ?? [])].sort(),
    [filterOptions],
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            Manage Meters
          </h2>
          <p className="text-muted-foreground mt-1">
            Add, edit, or retire meters across all categories
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Meter
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Meter" : "Add Meter"}</DialogTitle>
              <DialogDescription>
                {editingId
                  ? "Update this meter's details."
                  : "Register a new meter. Meter number and meter type are required."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Identity</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Meter number *</label>
                    {textField(form.meter_number, (v) => setField("meter_number", v ?? ""))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Meter type *</label>
                    <Input
                      list="meter-type-options"
                      value={form.meter_type}
                      onChange={(e) => setField("meter_type", e.target.value)}
                      placeholder="e.g. BSP, DTX, REGIONAL_BOUNDARY"
                    />
                    <datalist id="meter-type-options">
                      {meterTypeOptions.map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">SPN</label>
                    {textField(form.spn, (v) => setField("spn", v))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Meter brand</label>
                    {textField(form.meter_brand, (v) => setField("meter_brand", v))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Status</label>
                    {textField(form.status, (v) => setField("status", v))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Location</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Region</label>
                    <Input
                      list="region-options"
                      value={form.region ?? ""}
                      onChange={(e) => setField("region", e.target.value || null)}
                    />
                    <datalist id="region-options">
                      {regions.map((r) => (
                        <option key={r} value={r} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">District</label>
                    <Input
                      list="district-options"
                      value={form.district ?? ""}
                      onChange={(e) => setField("district", e.target.value || null)}
                    />
                    <datalist id="district-options">
                      {districts.map((d) => (
                        <option key={d} value={d} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Station</label>
                    <Input
                      list="station-options"
                      value={form.station ?? ""}
                      onChange={(e) => setField("station", e.target.value || null)}
                    />
                    <datalist id="station-options">
                      {stations.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Location (free text)</label>
                    {textField(form.location, (v) => setField("location", v))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Digital address</label>
                    {textField(form.digital_address, (v) => setField("digital_address", v))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Latitude</label>
                    {numField(form.latitude, (v) => setField("latitude", v))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Longitude</label>
                    {numField(form.longitude, (v) => setField("longitude", v))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Electrical</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Voltage (kV)</label>
                    {numField(form.voltage_kv, (v) => setField("voltage_kv", v))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Multiply factor</label>
                    {numField(form.multiply_factor, (v) => setField("multiply_factor", v))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">CT ratio primary</label>
                    {numField(form.ct_ratio_primary, (v) => setField("ct_ratio_primary", v))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">CT ratio secondary</label>
                    {numField(form.ct_ratio_secondary, (v) => setField("ct_ratio_secondary", v))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">VT ratio primary</label>
                    {numField(form.vt_ratio_primary, (v) => setField("vt_ratio_primary", v))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">VT ratio secondary</label>
                    {numField(form.vt_ratio_secondary, (v) => setField("vt_ratio_secondary", v))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Network</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Metering point</label>
                    {textField(form.metering_point, (v) => setField("metering_point", v))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Boundary metering point</label>
                    {textField(
                      form.boundary_metering_point,
                      (v) => setField("boundary_metering_point", v),
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Incomer</label>
                    {textField(form.incomer, (v) => setField("incomer", v))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Feeder panel name</label>
                    {textField(form.feeder_panel_name, (v) => setField("feeder_panel_name", v))}
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
                  "Create meter"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Meters</CardTitle>
          <CardDescription>{totalItems.toLocaleString()} total</CardDescription>
          <div className="flex flex-wrap gap-3 pt-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search meter number, station, feeder…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <Select
              value={regionFilter}
              onValueChange={(v) => {
                setRegionFilter(v)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All regions</SelectItem>
                {regions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={meterTypeFilter}
              onValueChange={(v) => {
                setMeterTypeFilter(v)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Meter type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All meter types</SelectItem>
                {meterTypeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                        Meter number
                      </th>
                      <th className="text-left py-2 px-4 font-medium text-muted-foreground">
                        Type
                      </th>
                      <th className="text-left py-2 px-4 font-medium text-muted-foreground">
                        Region
                      </th>
                      <th className="text-left py-2 px-4 font-medium text-muted-foreground">
                        District
                      </th>
                      <th className="text-left py-2 px-4 font-medium text-muted-foreground">
                        Station
                      </th>
                      <th className="text-left py-2 px-4 font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="text-right py-2 pl-4 font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {meters.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center text-muted-foreground py-8">
                          No meters match these filters.
                        </td>
                      </tr>
                    ) : (
                      meters.map((meter) => (
                        <tr key={meter.id} className="border-b last:border-0 hover:bg-muted/40">
                          <td className="py-2.5 pr-4 font-medium">{meter.meter_number}</td>
                          <td className="py-2.5 px-4">
                            <Badge variant="outline" className="text-xs font-normal">
                              {meter.meter_type}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-4 text-muted-foreground">
                            {meter.region || "—"}
                          </td>
                          <td className="py-2.5 px-4 text-muted-foreground">
                            {meter.district || "—"}
                          </td>
                          <td className="py-2.5 px-4 text-muted-foreground">
                            {meter.station || "—"}
                          </td>
                          <td className="py-2.5 px-4 text-muted-foreground">
                            {meter.status || "—"}
                          </td>
                          <td className="py-2.5 pl-4">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEdit(meter)}
                                title="Edit meter"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-red-600"
                                    disabled={deletingId === meter.id}
                                    title="Retire meter"
                                  >
                                    {deletingId === meter.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Retire this meter?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {meter.meter_number} will stop appearing in meter lists
                                      and the map. Historical consumption and billing data
                                      tied to it is preserved.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(meter.id)}>
                                      Retire meter
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
