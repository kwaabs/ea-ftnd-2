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

/** Latest date users can select — always yesterday (today is incomplete). */
function getMaxSelectableDate() {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - 1)
    return d
}

function startOfDay(date: Date) {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
    const maxDate = getMaxSelectableDate()

    const handleDateChange = (range: ReactDayPickerDateRange | undefined) => {
        if (!range) return

        if (range.from && range.to) {
            const start = startOfDay(range.from)
            let end = startOfDay(range.to)
            if (end > maxDate) end = new Date(maxDate)
            if (start > end) {
                onChange({ start: end, end })
                return
            }
            onChange({ start, end })
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
                    disabled={{ after: maxDate }}
                    endMonth={maxDate}
                    numberOfMonths={2}
                />
            </PopoverContent>
        </Popover>
    )
}
