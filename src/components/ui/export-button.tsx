"use client"

import { useState, type RefObject } from "react"
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { exportElementAsPng, exportToCSV, exportToExcel } from "@/lib/export-utils"

type ExportFormat = "csv" | "xlsx" | "png"

interface ExportButtonProps {
  data?: Record<string, any>[]
  filename: string
  label?: string
  disabled?: boolean
  className?: string
  /** When provided, PNG is included in the dropdown and captures this element */
  chartRef?: RefObject<HTMLElement | null>
  /** Override which formats appear. Defaults: csv+xlsx, plus png if chartRef is set */
  formats?: ExportFormat[]
}

export function ExportButton({
  data = [],
  filename,
  label = "Download",
  disabled,
  className,
  chartRef,
  formats,
}: ExportButtonProps) {
  const [busy, setBusy] = useState<ExportFormat | null>(null)

  const resolvedFormats: ExportFormat[] =
    formats ?? (chartRef ? ["csv", "png", "xlsx"] : ["csv", "xlsx"])

  const hasData = Array.isArray(data) && data.length > 0
  const menuDisabled = disabled || busy !== null

  const run = async (format: ExportFormat) => {
    if (busy) return
    setBusy(format)
    try {
      if (format === "csv") {
        if (!hasData) return
        exportToCSV(data, filename)
      } else if (format === "xlsx") {
        if (!hasData) return
        await exportToExcel(data, filename)
      } else if (format === "png") {
        const el = chartRef?.current
        if (!el) {
          console.error("Chart element not ready for PNG export")
          return
        }
        await exportElementAsPng(el, filename)
      }
    } catch (err) {
      console.error(`Failed to export as ${format}`, err)
    } finally {
      setBusy(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={className}
          disabled={menuDisabled}
        >
          {busy ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="mr-1.5 h-3.5 w-3.5" />
          )}
          {label}
          <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {resolvedFormats.includes("csv") && (
          <DropdownMenuItem
            disabled={!hasData}
            onSelect={() => run("csv")}
          >
            <FileText className="mr-2 h-4 w-4" />
            CSV
          </DropdownMenuItem>
        )}
        {resolvedFormats.includes("png") && (
          <DropdownMenuItem
            disabled={!chartRef}
            onSelect={() => run("png")}
          >
            <ImageIcon className="mr-2 h-4 w-4" />
            PNG
          </DropdownMenuItem>
        )}
        {resolvedFormats.includes("xlsx") && (
          <DropdownMenuItem
            disabled={!hasData}
            onSelect={() => run("xlsx")}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Excel (XLSX)
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
