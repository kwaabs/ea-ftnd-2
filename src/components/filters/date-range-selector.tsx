"use client"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format, isValid, parseISO } from "date-fns"
import type { DateRange } from "react-day-picker"

interface DateRangeSelectorProps {
  dateRange: { start_date: string; end_date: string }
  onDateRangeChange: (range: { start_date: string; end_date: string }) => void
  preset: "last_day" | "last_week" | "last_month" | "custom"
  onPresetChange: (preset: "last_day" | "last_week" | "last_month" | "custom") => void
}

export function DateRangeSelector({ dateRange, onDateRangeChange, preset, onPresetChange }: DateRangeSelectorProps) {
  const handlePresetClick = (newPreset: "last_day" | "last_week" | "last_month") => {
    onPresetChange(newPreset)
  }

  const handleCustomDateChange = (range: DateRange | undefined) => {
    console.log("[v0] Date range selected:", range)

    if (!range) {
      console.log("[v0] No range selected")
      return
    }

    // If both dates are selected, update the range
    if (range.from && range.to) {
      console.log("[v0] Both dates selected, updating range")
      onDateRangeChange({
        start_date: format(range.from, "yyyy-MM-dd"),
        end_date: format(range.to, "yyyy-MM-dd"),
      })
      onPresetChange("custom")
    } else if (range.from) {
      // User has selected the first date, waiting for second date
      console.log("[v0] Only start date selected, waiting for end date")
    }
  }

  const parseDate = (dateString: string | undefined | null): Date | null => {
    if (!dateString || typeof dateString !== "string") return null
    try {
      const parsed = parseISO(dateString)
      return isValid(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  const startDate = parseDate(dateRange?.start_date)
  const endDate = parseDate(dateRange?.end_date)
  const hasValidDates = startDate !== null && endDate !== null

  console.log("[v0] DateRangeSelector render:", {
    dateRange,
    startDate,
    endDate,
    hasValidDates,
    preset,
  })

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-2">
        <Button
          variant={preset === "last_day" ? "default" : "outline"}
          size="sm"
          onClick={() => handlePresetClick("last_day")}
        >
          Last Day
        </Button>
        <Button
          variant={preset === "last_week" ? "default" : "outline"}
          size="sm"
          onClick={() => handlePresetClick("last_week")}
        >
          Last Week
        </Button>
        <Button
          variant={preset === "last_month" ? "default" : "outline"}
          size="sm"
          onClick={() => handlePresetClick("last_month")}
        >
          Last Month
        </Button>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant={preset === "custom" ? "default" : "outline"} size="sm" className="gap-2">
            <CalendarIcon className="h-4 w-4" />
            {preset === "custom" && hasValidDates ? (
              <span>
                {format(startDate!, "MMM dd")} - {format(endDate!, "MMM dd")}
              </span>
            ) : (
              <span>Custom Range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={
              hasValidDates
                ? {
                    from: startDate!,
                    to: endDate!,
                  }
                : undefined
            }
            onSelect={handleCustomDateChange}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
