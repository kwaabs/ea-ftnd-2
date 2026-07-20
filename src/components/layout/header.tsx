"use client"
import Link from "next/link"
import { Filter, Calendar, BarChart3 } from "lucide-react"
import { useState, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useAppStore } from "@/stores/app-store"
import { useUserStore } from "@/stores/user-store"
import { HeaderFilterDropdown } from "@/components/layout/header-filter-dropdown"
import { Breadcrumbs } from "./breadcrumbs"
import { NotificationBell } from "@/components/comments/notification-bell"
import { NOTIFY_EMAILS } from "@/lib/notify-config"

export function Header() {
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const { filters } = useAppStore()
    const { user } = useUserStore()
    const userEmail = user?.email || user?.username || ""
    const canSeeNotifications = NOTIFY_EMAILS.includes(userEmail)

    const dateRange = {
        start: filters.dateRange?.start || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString(),
        end: filters.dateRange?.end || new Date().toISOString(),
    }

    const formatDisplayDate = (date: string) => {
        return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    }

    const fromDate = formatDisplayDate(dateRange.start)
    const toDate = formatDisplayDate(dateRange.end)

    // Check if end date is today
    const today = new Date()
    const endDateObj = new Date(dateRange.end)
    const isEndDateToday =
        endDateObj.getFullYear() === today.getFullYear() &&
        endDateObj.getMonth() === today.getMonth() &&
        endDateObj.getDate() === today.getDate()

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border bg-card shrink-0">
            <div className="flex h-16 items-center px-6 gap-4">
                {/* Breadcrumbs */}
                <div className="flex-1 flex items-center min-w-0">
                    <Suspense fallback={<div className="h-5 w-40 bg-gray-200 animate-pulse rounded" />}>
                        <Breadcrumbs />
                    </Suspense>
                </div>

                {/* Right section - Date and Filters */}
                <div className="flex items-center gap-4 shrink-0">
                    <div className="flex flex-col gap-1">
                        <div
                            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm"
                            style={{ backgroundColor: 'hsl(0, 100%, 97%)' }}
                        >
                            <Calendar className="h-4 w-4 text-rose-600"/>
                            <span className="font-semibold whitespace-nowrap text-rose-900">
                                {fromDate} <span className="mx-1">to</span> {toDate}
                            </span>
                        </div>
                        {isEndDateToday && (
                            <span className="text-xs text-amber-600 font-medium px-3">
                                Today&apos;s data not included
                            </span>
                        )}
                    </div>


                    {canSeeNotifications && (
                        <Link href="/admin/logins">
                            <Button variant="outline" size="icon" title="Login activity">
                                <BarChart3 className="h-4 w-4" />
                            </Button>
                        </Link>
                    )}

                    {canSeeNotifications && <NotificationBell userEmail={userEmail} />}

                    <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 bg-transparent"
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
