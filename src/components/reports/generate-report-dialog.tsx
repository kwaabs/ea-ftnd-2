"use client"

import { useState } from "react"
import type { RefObject } from "react"
import { Download, FileText, Loader2, Presentation } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import type { PurchasesSalesReport } from "@/hooks/api/use-purchases-sales-report"
import { buildReportExportData, type ReportChartImage, type ReportType } from "@/lib/report-export/build-report-data"
import { captureElementAsPngDataUrl } from "@/lib/export-utils"
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

export function GenerateReportDialog({ report, periodLabel, chartRefs }: GenerateReportDialogProps) {
  const [open, setOpen] = useState(false)
  const [reportType, setReportType] = useState<ReportType>("executive")
  const [format, setFormat] = useState<FileFormat>("pdf")
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canGenerate = !report.isLoading && report.regions.length > 0

  async function handleGenerate() {
    setIsGenerating(true)
    setError(null)
    try {
      const chartImages = await captureChartImages(chartRefs)
      const data = buildReportExportData({ report, reportType, chartImages })
      const filenameBase = `energy-accounting-${reportType}-${periodLabel.replace(/\s+/g, "-").replace(/[^\w-]/g, "")}`

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Report</DialogTitle>
          <DialogDescription>
            Purchases and Customer Consumption for {periodLabel}, nationwide — regardless of any region/district
            filter currently applied on this page.
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

          {!canGenerate && (
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
