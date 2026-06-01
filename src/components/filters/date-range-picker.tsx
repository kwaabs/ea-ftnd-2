"use client"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import type { DateRange as ReactDayPickerDateRange } from "react-day-picker"

interface DateRangePickerProps {
    value: { start: Date; end: Date }
    onChange: (range: { start: Date; end: Date }) => void
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
    // Disable future dates
    const disabledDates = (date: Date) => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        return date > today
    }

    const handleDateChange = (range: ReactDayPickerDateRange | undefined) => {
        if (!range) return

        // If both dates are selected, update the range
        if (range.from && range.to) {
            onChange({
                start: range.from,
                end: range.to,
            })
        }
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 w-full justify-start bg-transparent">
                    <CalendarIcon className="h-4 w-4" />
                    <span>
            {format(value.start, "MMM dd, yyyy")} - {format(value.end, "MMM dd, yyyy")}
          </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="range"
                    selected={{
                        from: value.start,
                        to: value.end,
                    }}
                    onSelect={handleDateChange}
                    disabled={disabledDates}
                    numberOfMonths={2}
                />
            </PopoverContent>
        </Popover>
    )
}
