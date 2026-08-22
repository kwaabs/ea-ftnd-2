"use client"

import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"
import { useMeters } from "@/hooks/api/use-meter-api"

interface MeterOption {
  id: string
  meter_number: string
  station: string | null
  region: string | null
}

function meterLabel(m: MeterOption): string {
  const parts = [m.station, m.region].filter(Boolean)
  return parts.length > 0 ? `${m.meter_number} — ${parts.join(", ")}` : m.meter_number
}

/**
 * Search-select for picking a meter by meter_number, resolving to a real
 * meter.id. Unlike the free-text/<datalist> fields on the meter form
 * (which only validate a string), express-feeder sending/receiving fields
 * are real foreign keys.
 *
 * Deliberately a small hand-rolled dropdown, not the shadcn/base-ui
 * Combobox primitive (@/components/ui/combobox.tsx): that component's
 * floating-popup portal doesn't compose with this app's Radix-based
 * Dialog (@/components/ui/dialog.tsx) — confirmed via DOM inspection that
 * opening the combobox marks the surrounding Radix dialog-content as
 * inert, so mouse clicks on an option are swallowed by the dialog's own
 * form content underneath instead of reaching the option. This dropdown
 * renders as a normal in-flow descendant of the Dialog (no portal), so it
 * inherits the Dialog's stacking correctly with no cross-library
 * coordination needed.
 */
export function MeterPicker({
  value,
  meterNumber,
  onChange,
  excludeId,
  placeholder = "Search meter number…",
}: {
  value: string | null
  meterNumber: string | null
  onChange: (id: string | null, meterNumber: string | null) => void
  excludeId?: string | null
  placeholder?: string
}) {
  const [rawSearch, setRawSearch] = useState(meterNumber ?? "")
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setSearch(rawSearch), 250)
    return () => clearTimeout(t)
  }, [rawSearch])

  const { data, isFetching } = useMeters({ search: search || undefined, limit: 8 })
  const options: MeterOption[] = (data?.data?.data ?? [])
    .filter((m) => m.id !== excludeId)
    .map((m) => ({
      id: m.id,
      meter_number: m.meter_number,
      station: m.station ?? null,
      region: m.region ?? null,
    }))

  const select = (option: MeterOption) => {
    onChange(option.id, option.meter_number)
    setRawSearch(option.meter_number)
    setOpen(false)
  }

  return (
    <div className="relative" ref={containerRef}>
      <Input
        value={rawSearch}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setRawSearch(e.target.value)
          setOpen(true)
          if (value) onChange(null, null)
        }}
        onBlur={() => {
          // Delay so a click on a dropdown option (onMouseDown below,
          // fired before blur) registers before the list unmounts.
          setTimeout(() => setOpen(false), 150)
        }}
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {isFetching ? (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Searching…
            </div>
          ) : options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">No meters found</div>
          ) : (
            options.map((option) => (
              <button
                key={option.id}
                type="button"
                className="block w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                onMouseDown={(e) => {
                  e.preventDefault()
                  select(option)
                }}
              >
                {meterLabel(option)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
