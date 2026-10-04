"use client"

import { useState } from "react"
import type { RefObject } from "react"
import { ChevronRight, Download, FileText, Loader2, Presentation } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { MonthPoint, PurchasesSalesReport } from "@/hooks/api/use-purchases-sales-report"
import {
  buildReportExportData,
  districtScopeKey,
  type ReportChartImage,
  type ReportLogo,
  type ReportType,
} from "@/lib/report-export/build-report-data"
import { captureElementAsPngDataUrl } from "@/lib/export-utils"
import { loadImageAsDataUrl } from "@/lib/report-export/logo"
import { downloadReportPdf } from "@/lib/report-export/pdf-renderer"
import { downloadReportPptx } from "@/lib/report-export/pptx-renderer"

export interface ReportChartRefs {
  trend: RefObject<HTMLDivElement | null>
  lossHeatMap: RefObject<HTMLDivElement | null>
  purchasesHeatMap: RefObject<HTMLDivElement | null>
  prepaidHeatMap: RefObject<HTMLDivElement | null>
  postpaidHeatMap: RefObject<HTMLDivElement | null>
}

type FileFormat = "pdf" | "pptx"

interface GenerateReportDialogProps {
  report: PurchasesSalesReport
  periodLabel: string
  chartRefs: ReportChartRefs
}

// Captures whatever is currently mounted at each ref -- the charts/heat
// maps are always in the DOM (Carousel keeps every slide mounted, just
// translated off-screen; only the Postpaid slide's own "All Postpaid" vs
// "Streetlighting" sub-tab is Radix-unmounted when inactive, so that one is
// captured in its default "All Postpaid" state regardless of what the user
// has toggled open on screen).
async function captureChartImages(refs: ReportChartRefs): Promise<ReportChartImage[]> {
  const specs: { label: string; ref: RefObject<HTMLDivElement | null> }[] = [
    { label: "Purchases vs Sales vs Loss % — monthly trend", ref: refs.trend },
    { label: "Loss % heat map — region × month", ref: refs.lossHeatMap },
    { label: "Purchases heat map — region × month", ref: refs.purchasesHeatMap },
    { label: "Prepaid heat map — region × month", ref: refs.prepaidHeatMap },
    { label: "Postpaid heat map — region × month", ref: refs.postpaidHeatMap },
  ]

  const images: ReportChartImage[] = []
  for (const spec of specs) {
    if (!spec.ref.current) continue
    try {
      const { dataUrl, width, height } = await captureElementAsPngDataUrl(spec.ref.current, { pixelRatio: 2 })
      images.push({ label: spec.label, dataUrl, width, height })
    } catch {
      // A single chart failing to capture (e.g. not yet laid out) shouldn't
      // block the rest of the report -- it's just left out of the images.
    }
  }
  return images
}

function formatMonthForFilename(m: MonthPoint): string {
  return `${m.year}-${String(m.month).padStart(2, "0")}`
}

export function GenerateReportDialog({ report, periodLabel, chartRefs }: GenerateReportDialogProps) {
  const [open, setOpen] = useState(false)
  const [reportType, setReportType] = useState<ReportType>("executive")
  const [format, setFormat] = useState<FileFormat>("pdf")
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Scope selection -- everything included by default ("by default is
  // everything"); excluding a region drops it (and its districts) from the
  // report, excluding a single district only matters for the Detailed
  // drill-down. expandedRegionKeys is purely a UI concern (which regions'
  // district lists are open), kept separate from what's actually excluded.
  const [includeNational, setIncludeNational] = useState(true)
  const [excludedRegionKeys, setExcludedRegionKeys] = useState<Set<string>>(new Set())
  const [excludedDistrictKeys, setExcludedDistrictKeys] = useState<Set<string>>(new Set())
  const [expandedRegionKeys, setExpandedRegionKeys] = useState<Set<string>>(new Set())

  const includedRegionCount = report.regions.length - excludedRegionKeys.size
  const hasAnyScope = includeNational || includedRegionCount > 0
  const canGenerate = !report.isLoading && report.regions.length > 0 && hasAnyScope

  function toggleRegion(regionKey: string) {
    setExcludedRegionKeys((prev) => {
      const next = new Set(prev)
      if (next.has(regionKey)) next.delete(regionKey)
      else next.add(regionKey)
      return next
    })
  }

  function toggleDistrict(regionKey: string, districtKey: string) {
    const key = districtScopeKey(regionKey, districtKey)
    setExcludedDistrictKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleExpand(regionKey: string) {
    setExpandedRegionKeys((prev) => {
      const next = new Set(prev)
      if (next.has(regionKey)) next.delete(regionKey)
      else next.add(regionKey)
      return next
    })
  }

  function selectAllRegions() {
    setExcludedRegionKeys(new Set())
    setExcludedDistrictKeys(new Set())
  }

  function clearAllRegions() {
    setExcludedRegionKeys(new Set(report.regions.map((r) => r.regionKey)))
  }

  async function handleGenerate() {
    setIsGenerating(true)
    setError(null)
    try {
      const [chartImages, logo] = await Promise.all([
        captureChartImages(chartRefs),
        loadImageAsDataUrl("/images/ecg-logo.jpg").catch((): ReportLogo | null => null),
      ])
      const data = buildReportExportData({
        report,
        reportType,
        chartImages,
        logo,
        scope: { includeNational, excludedRegionKeys, excludedDistrictKeys },
      })

      const months = report.months
      const dateRangePart =
        months.length <= 1
          ? formatMonthForFilename(months[0])
          : `${formatMonthForFilename(months[0])}-to-${formatMonthForFilename(months[months.length - 1])}`
      const filenameBase = `ECG-${reportType === "executive" ? "Executive" : "Detailed"}-Report-${dateRangePart}`

      if (format === "pdf") {
        downloadReportPdf(data, filenameBase)
      } else {
        await downloadReportPptx(data, filenameBase)
      }
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate the report.")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isGenerating && setOpen(next)}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Generate Report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Report</DialogTitle>
          <DialogDescription>
            Purchases and Customer Consumption for {periodLabel} — regardless of any region/district filter
            currently applied on this page. Everything is included by default; narrow the scope below if needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Report type</Label>
            <RadioGroup value={reportType} onValueChange={(v) => setReportType(v as ReportType)} className="gap-3">
              <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50">
                <RadioGroupItem value="executive" className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium">Executive</span>
                  <span className="block text-xs text-muted-foreground">
                    National summary, charts, and one row per region — a few pages, no district drill-down.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50">
                <RadioGroupItem value="detailed" className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium">Detailed</span>
                  <span className="block text-xs text-muted-foreground">
                    Everything in Executive, plus a month-by-month table for every region and every district.
                    Can run long for a wide date range.
                  </span>
                </span>
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Format</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as FileFormat)} className="flex gap-3">
              <label className="flex flex-1 items-center gap-2 rounded-lg border p-3 cursor-pointer has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50">
                <RadioGroupItem value="pdf" />
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">PDF</span>
              </label>
              <label className="flex flex-1 items-center gap-2 rounded-lg border p-3 cursor-pointer has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50">
                <RadioGroupItem value="pptx" />
                <Presentation className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">PPTX</span>
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Scope</Label>
              <div className="flex gap-3 text-xs">
                <button type="button" onClick={selectAllRegions} className="text-blue-600 hover:underline">
                  Select all
                </button>
                <button type="button" onClick={clearAllRegions} className="text-blue-600 hover:underline">
                  Clear all regions
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer">
              <Checkbox checked={includeNational} onCheckedChange={(v) => setIncludeNational(v === true)} />
              <span className="text-sm font-medium">National summary</span>
              <span className="text-xs text-muted-foreground">(totals, narrative, national monthly table)</span>
            </label>

            <div className="rounded-lg border max-h-56 overflow-y-auto divide-y">
              {report.regions.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3">No regions in this window yet.</p>
              ) : (
                report.regions.map((r) => {
                  const regionIncluded = !excludedRegionKeys.has(r.regionKey)
                  const isExpanded = expandedRegionKeys.has(r.regionKey)
                  return (
                    <div key={r.regionKey}>
                      <div className="flex items-center gap-2 px-2.5 py-2">
                        <Checkbox checked={regionIncluded} onCheckedChange={() => toggleRegion(r.regionKey)} />
                        <span className="flex-1 text-sm">{r.region}</span>
                        <span className="text-xs text-muted-foreground">
                          {r.districts.length} district{r.districts.length === 1 ? "" : "s"}
                        </span>
                        {r.districts.length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(r.regionKey)}
                            className="p-1 -m-1 text-muted-foreground hover:text-foreground"
                          >
                            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-90")} />
                          </button>
                        )}
                      </div>
                      {isExpanded && r.districts.length > 0 && (
                        <div className="pb-1.5 pl-8 pr-2.5 space-y-1">
                          {r.districts.map((d) => {
                            const key = districtScopeKey(r.regionKey, d.districtKey)
                            const districtIncluded = regionIncluded && !excludedDistrictKeys.has(key)
                            return (
                              <label
                                key={d.districtKey}
                                className={cn(
                                  "flex items-center gap-2 py-0.5 cursor-pointer",
                                  !regionIncluded && "opacity-40 pointer-events-none",
                                )}
                              >
                                <Checkbox
                                  checked={districtIncluded}
                                  onCheckedChange={() => toggleDistrict(r.regionKey, d.districtKey)}
                                />
                                <span className="text-xs">{d.district}</span>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              District selection only affects the Detailed report&apos;s drill-down — Executive never shows
              district rows.
            </p>
          </div>

          {!canGenerate && !report.isLoading && !hasAnyScope && (
            <p className="text-xs text-amber-700">Nothing selected — include National or at least one region.</p>
          )}
          {!canGenerate && report.isLoading && (
            <p className="text-xs text-amber-700">Report data is still loading — try again in a moment.</p>
          )}
          {error && <p className="text-xs text-red-700">{error}</p>}
        </div>

        <DialogFooter>
          <Button onClick={handleGenerate} disabled={!canGenerate || isGenerating} className="gap-2">
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
