"use client"
import Image from "next/image"
import { Filter, Calendar } from "lucide-react"
import { useState, Suspense } from "react"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useAppStore } from "@/stores/app-store"
import { HeaderFilterDropdown } from "@/components/layout/header-filter-dropdown"
import { formatApiDate } from "@/lib/utils"
import { Breadcrumbs } from "./breadcrumbs"

export function Header() {
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const { filters } = useAppStore()
    const pathname = usePathname()

    const isMapPage = pathname === "/map"

    const dateRange = {
        start: filters.dateRange?.start || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString(),
        end: filters.dateRange?.end || new Date().toISOString(),
    }

    const formatDisplayDate = (date: string) => {
        return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    }

    const fromDate = formatDisplayDate(dateRange.start)
    const toDate = formatDisplayDate(dateRange.end)

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border bg-card">
            <div className="flex h-16 items-center px-6 gap-4">
                {/* Left section - Logo and Title */}
                <div className="flex items-center gap-4">
                    <Image src="/images/ecg-logo.jpg" alt="ECG Logo" width={48} height={48} />
                    <h1 className="text-xl font-semibold text-foreground whitespace-nowrap">
                        Electric energy accounting and monitoring
                    </h1>
                </div>

                {/* Middle section - Breadcrumbs */}
                <div className="flex-1 flex items-center min-w-0">
                    <Suspense fallback={<div className="h-4 w-32 bg-gray-200 animate-pulse rounded" />}>
                        <Breadcrumbs />
                    </Suspense>
                </div>

                {/* Right section - Date and Filters */}
                <div className="flex items-center gap-4 shrink-0">
                    <div
                        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm"
                        style={{ backgroundColor: 'hsl(0, 100%, 97%)' }}
                    >
                        <Calendar className="h-4 w-4 text-rose-600"/>
                        <span className="font-semibold whitespace-nowrap text-rose-900">
                            {fromDate} <span className="mx-1">to</span> {toDate}
                        </span>
                    </div>


                    <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 bg-transparent"
                                disabled={isMapPage}
                            >
                                <Filter className="h-4 w-4"/>
                                Filters
                            </Button>
                        </PopoverTrigger>
                        {/* 🔥 FIXED: Removed max-h and overflow-y-auto to allow react-select dropdowns to escape */}
                        <PopoverContent
                            className="w-auto p-0"
                            align="end"
                            side="bottom"
                            sideOffset={8}
                        >
                            {/* 🔥 FIXED: Added wrapper with max-height and overflow for just the content, not the dropdowns */}
                            <div className="max-h-[80vh] overflow-y-auto">
                                <HeaderFilterDropdown/>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
        </header>
    )
}
