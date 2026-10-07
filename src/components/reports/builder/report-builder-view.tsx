"use client"

// Report Builder (Phase 1) — drag-and-drop canvas composed from blocks,
// each backed by an already-built aggregate endpoint (see
// src/lib/report-builder/data-sources.ts's doc comment for why this is
// NOT a generic ad-hoc query tool). No persistence yet: the layout lives
// only in this component's state for the session — see this session's
// design discussion for why that's the deliberate v1 scope. Phase 2
// adds PDF/PPTX export of whatever's on the canvas.
import { useRef, useState } from "react"
import { Responsive, WidthProvider } from "react-grid-layout/legacy"
import "react-grid-layout/css/styles.css"
import "react-resizable/css/styles.css"
import { Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DATA_SOURCE_LIST, DATA_SOURCES, type DataSourceKey } from "@/lib/report-builder/data-sources"
import type { ReportBlock } from "@/lib/report-builder/types"
import { ReportBlockCard } from "@/components/reports/builder/report-block"
import { useFilterOptionsWithAvailability } from "@/hooks/api/use-filter-options"

const ALL_SENTINEL = "__all__"

const ResponsiveGridLayout = WidthProvider(Responsive)

interface PlacedBlock extends ReportBlock {
  x: number
  y: number
  w: number
  h: number
}

const COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }
const DEFAULT_W = 4
const DEFAULT_H = 4

function defaultBlockFor(key: DataSourceKey, x: number, y: number): PlacedBlock {
  const def = DATA_SOURCES[key]
  return {
    id: `${key}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    dataSource: key,
    groupBy: def.defaultGroupBy,
    visualization: def.kpiOnly ? "kpi" : "table",
    x,
    y,
    w: def.kpiOnly ? 3 : DEFAULT_W,
    h: def.kpiOnly ? 3 : DEFAULT_H,
  }
}

function todayIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function defaultDateRange() {
  const to = new Date()
  const from = new Date(to.getFullYear(), to.getMonth(), 1)
  return { from: todayIso(from), to: todayIso(to) }
}

export function ReportBuilderView() {
  const [blocks, setBlocks] = useState<PlacedBlock[]>([])
  const [dateFrom, setDateFrom] = useState(() => defaultDateRange().from)
  const [dateTo, setDateTo] = useState(() => defaultDateRange().to)
  const [region, setRegion] = useState("")
  const [district, setDistrict] = useState("")
  const [paletteSource, setPaletteSource] = useState<DataSourceKey>(DATA_SOURCE_LIST[0].key)

  // Region/district options come from app.meters (the same source every
  // other meter-filter dropdown in this app already draws from, via this
  // same hook) -- not from any one report-builder source's own naming.
  // Good enough as a canonical list and immune to typos, but worth
  // knowing: a source with its own naming quirks (Zeus's "X Region"
  // suffix, PNS's opaque region/district codes, Alpha's lack of a
  // region/district concept at all) may not match these names exactly,
  // the same caveat that already applies anywhere else in the app this
  // hook is used for a source with non-standard naming.
  const { data: filterOptions } = useFilterOptionsWithAvailability(region ? { regions: [region] } : undefined)
  const regionOptions = filterOptions?.all.regions ?? []
  const districtOptions = region
    ? Array.from(filterOptions?.available.districts ?? [])
    : (filterOptions?.all.districts ?? [])

  // Dragging a palette card onto the grid: react-grid-layout computes the
  // drop x/y internally from the native dragover position and hands it
  // back via onDrop(layout, item) — WHICH data source was being dragged
  // isn't part of that payload (onDrop doesn't see dataTransfer contents
  // reliably across browsers), so it's tracked separately here, set the
  // moment the palette card's own onDragStart fires and read back in
  // onDrop. A real ref (not state) so the value survives without waiting
  // on a re-render between dragstart and drop. e.dataTransfer.setData is
  // still called (empty payload) only because Firefox refuses to start a
  // native drag at all without it.
  const draggingSourceRef = useRef<DataSourceKey>(paletteSource)

  const nextY = () => (blocks.length === 0 ? 0 : Math.max(...blocks.map((b) => b.y + b.h)))

  const addBlock = (key: DataSourceKey) => {
    setBlocks((prev) => [...prev, defaultBlockFor(key, 0, nextY())])
  }

  const updateBlock = (id: string, patch: Partial<ReportBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  }

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id))
  }

  const layout = blocks.map((b) => ({ i: b.id, x: b.x, y: b.y, w: b.w, h: b.h, minW: 2, minH: 2 }))

  const filters = {
    dateFrom,
    dateTo,
    region: region.trim() || undefined,
    district: district.trim() || undefined,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Report Builder</h1>
        <p className="text-muted-foreground mt-1">
          Drag a source onto the canvas, arrange and resize blocks however you want. Nothing is saved yet — this is a
          session-only workspace (Phase 1).
        </p>
      </div>

      <Card>
        <CardContent className="pt-5 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">From</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[160px]" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">To</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[160px]" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Region</label>
            <Select
              value={region || ALL_SENTINEL}
              onValueChange={(v) => {
                setRegion(v === ALL_SENTINEL ? "" : v)
                setDistrict("") // the previous district selection may not exist in the new region
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All regions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SENTINEL}>All regions</SelectItem>
                {regionOptions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">District</label>
            <Select value={district || ALL_SENTINEL} onValueChange={(v) => setDistrict(v === ALL_SENTINEL ? "" : v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All districts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SENTINEL}>All districts</SelectItem>
                {districtOptions.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Applies to every block on the canvas (Region/District narrow results; each block&apos;s own groupBy still
            controls what it breaks down BY).
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card className="h-fit lg:sticky lg:top-4">
          <CardHeader>
            <CardTitle className="text-base">Data sources</CardTitle>
            <CardDescription>Drag a card onto the canvas, or pick one and click Add.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              <Select value={paletteSource} onValueChange={(v) => setPaletteSource(v as DataSourceKey)}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATA_SOURCE_LIST.map((s) => (
                    <SelectItem key={s.key} value={s.key} className="text-xs">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => addBlock(paletteSource)} title="Add block">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1.5 pt-2 max-h-[60vh] overflow-y-auto">
              {DATA_SOURCE_LIST.map((s) => (
                <div
                  key={s.key}
                  draggable
                  onDragStart={(e) => {
                    draggingSourceRef.current = s.key
                    setPaletteSource(s.key)
                    e.dataTransfer.setData("text/plain", "")
                  }}
                  onClick={() => addBlock(s.key)}
                  className="text-xs border rounded-md px-2.5 py-2 cursor-grab active:cursor-grabbing hover:bg-muted/50 transition-colors"
                  title="Drag onto the canvas, or click to add"
                >
                  <div className="font-medium">{s.label}</div>
                  <div className="text-muted-foreground text-[10px]">{s.description}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="relative min-h-[400px] rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/10 p-2">
          {/* The grid itself owns all drag/drop handling (isDroppable),
              so it must stay mounted even with zero blocks -- it used to
              be swapped out for a plain static placeholder div here,
              which meant the very first drag onto an empty canvas landed
              on an element with no drop handling at all and silently did
              nothing (only "Add" worked until a block already existed).
              The empty-state message is now a non-blocking overlay
              (pointer-events-none) drawn on top of the still-live grid,
              not a replacement for it. */}
          {blocks.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground pointer-events-none z-0">
              Drag a data source here, or click Add in the panel on the left.
            </div>
          )}
          <ResponsiveGridLayout
            className="layout relative z-10"
            layouts={{ lg: layout, md: layout, sm: layout, xs: layout, xxs: layout }}
            breakpoints={{ lg: 1024, md: 768, sm: 540, xs: 360, xxs: 0 }}
            cols={COLS}
            rowHeight={70}
            margin={[12, 12]}
            draggableHandle=".report-block-drag-handle"
            isDroppable
            droppingItem={{ i: "__dropping__", x: 0, y: 0, w: DEFAULT_W, h: DEFAULT_H }}
            onDrop={(_layout, item) => {
              if (!item) return
              setBlocks((prev) => [...prev, defaultBlockFor(draggingSourceRef.current, item.x, item.y)])
            }}
            onLayoutChange={(newLayout) => {
              setBlocks((prev) =>
                prev.map((b) => {
                  const l = newLayout.find((li) => li.i === b.id)
                  return l ? { ...b, x: l.x, y: l.y, w: l.w, h: l.h } : b
                }),
              )
            }}
          >
            {blocks.map((b) => (
              <div key={b.id}>
                <ReportBlockCard
                  block={b}
                  filters={filters}
                  onChange={(patch) => updateBlock(b.id, patch)}
                  onRemove={() => removeBlock(b.id)}
                  dragHandleClassName="report-block-drag-handle"
                />
              </div>
            ))}
          </ResponsiveGridLayout>
        </div>
      </div>
    </div>
  )
}
