"use client"

import React, { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useSidebarStore } from "@/stores/sidebar-store"
import { useUserStore } from "@/stores/user-store"
import { usePathname, useRouter } from "next/navigation"
import { useFilterOptionsWithAvailability } from "@/hooks/api/use-filter-options"
import { LayoutDashboard, Map, BarChart3, Globe, ChevronRight, ChevronLeft, Settings, LogOut, User, MessageSquare } from "lucide-react"
import { CommentsSheet } from "@/components/comments/comments-sheet"

interface MenuItem {
    id: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    href?: string
    subItems?: {
        id: string
        label: string
        href: string
        onClick?: () => void
        isHeader?: boolean
        isIndented?: boolean
        isDoubleIndented?: boolean
        hasSubItems?: boolean
        onChevronClick?: () => void
    }[]
}

export function Sidebar() {
    const { isCollapsed, toggleCollapsed, openMenus, toggleMenu } = useSidebarStore()
    const { user, logout } = useUserStore()
    const pathname = usePathname()
    const router = useRouter()
    const [commentsOpen, setCommentsOpen] = useState(false)

    const { data: filterOptions, isLoading: isLoadingFilters } = useFilterOptionsWithAvailability()

    const handleLogout = async () => {
        await fetch("/api/auth/logout", { method: "POST" })
        logout()
        router.push("/")
    }

    const handleNavigation = (href: string) => {
        router.push(href)
    }

    const regionToDistricts = React.useMemo(() => {
        if (!filterOptions?.allMeters) return {}

        const mapping: Record<string, string[]> = {}
        filterOptions.allMeters.forEach((meter: any) => {
            if (meter.region && meter.district) {
                if (!mapping[meter.region]) {
                    mapping[meter.region] = []
                }
                if (!mapping[meter.region].includes(meter.district)) {
                    mapping[meter.region].push(meter.district)
                }
            }
        })
        return mapping
    }, [filterOptions?.allMeters])

    const meterTypeMapping: Record<string, string> = {
        BSP: "BSP Incomers",
        DTX: "Distribution Transformers",
        DISTRICT_BOUNDARY: "District Boundaries",
        REGIONAL_BOUNDARY: "Regional Boundaries",
        EXPRESS_FEEDER: "Express Feeders",
    }

    const organizeMeterTypes = React.useMemo(() => {
        const types = filterOptions?.all?.meterTypes || []
        const organized: any[] = []

        // Define the desired order
        const desiredOrder = ["BSP", "REGIONAL_BOUNDARY", "DTX", "DISTRICT_BOUNDARY", "EXPRESS_FEEDER"]

        // Sort types according to desired order
        const sortedTypes = [...types].sort((a, b) => {
            const indexA = desiredOrder.indexOf(a)
            const indexB = desiredOrder.indexOf(b)

            // If both are in desired order, sort by their position
            if (indexA !== -1 && indexB !== -1) {
                return indexA - indexB
            }

            // If only a is in desired order, it comes first
            if (indexA !== -1) return -1

            // If only b is in desired order, it comes first
            if (indexB !== -1) return 1

            // If neither is in desired order, maintain original order
            return 0
        })

        // Add all meter types in sorted order
        sortedTypes.forEach((type) => {
            organized.push({
                id: `meter-${type}`,
                label: meterTypeMapping[type] || type,
                href: `/meter-category/${type.toLowerCase().replace(/_/g, "-")}`,
                isIndented: true,
            })
        })

        return organized
    }, [filterOptions?.all?.meterTypes])

    const menuItems: MenuItem[] = [
        {
            id: "dashboard",
            label: "Dashboard",
            icon: LayoutDashboard,
            href: "/dashboard",
            subItems: [
                ...((filterOptions?.all?.meterTypes || []).length > 0
                    ? [
                        {
                            id: "meter-category-header",
                            label: "CATEGORY",
                            href: "#",
                            isHeader: true,
                            hasSubItems: true,
                            onClick: undefined,
                            onChevronClick: () => toggleMenu("meter-category"),
                        },
                        ...(openMenus.includes("meter-category") ? organizeMeterTypes : []),
                    ]
                    : []),
            ],
        },
        {
            id: "regions",
            label: "Regions",
            icon: Globe,
            href: "/regions",
            subItems: [
                ...((filterOptions?.all?.regions || []).length > 0
                    ? (filterOptions?.all?.regions || []).flatMap((region) => [
                        {
                            id: `region-${region}`,
                            label: region,
                            href: `/regions/${region.toLowerCase().replace(/\s+/g, "-")}`,
                            isIndented: false,
                            hasSubItems: (regionToDistricts[region] || []).length > 0,
                            onChevronClick:
                                (regionToDistricts[region] || []).length > 0 ? () => toggleMenu(`region-${region}`) : undefined,
                        },
                        ...(openMenus.includes(`region-${region}`)
                            ? (regionToDistricts[region] || []).map((district) => ({
                                id: `district-${region}-${district}`,
                                label: district,
                                href: `/regions/${region.toLowerCase().replace(/\s+/g, "-")}/districts/${district.toLowerCase().replace(/\s+/g, "-")}`,
                                isIndented: true,
                            }))
                            : []),
                    ])
                    : []),
            ],
        },
        {
            id: "map",
            label: "Map",
            icon: Map,
            href: "/map",
        },
        {
            id: "analytics",
            label: "Data",
            icon: BarChart3,
            href: "/analytics",
        },
    ]

    return (
        <>
            <aside
                className={cn(
                    "fixed left-0 top-0 z-40 h-screen border-r border-border bg-sidebar text-white transition-all duration-300",
                    isCollapsed ? "w-16" : "w-64",
                )}
            >
                <div className="flex h-full flex-col">
                    <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
                        {!isCollapsed && <span className="text-lg font-semibold text-sidebar-foreground">Dashboard</span>}
                        <Button variant="ghost" size="icon" onClick={toggleCollapsed} className="h-8 w-8">
                            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                        </Button>
                    </div>

                    <div className="flex-1 overflow-hidden">
                        <ScrollArea className="h-full">
                            <nav className="space-y-1 px-3 py-4">
                                {menuItems.map((item) => {
                                    const Icon = item.icon
                                    const isActive = pathname === item.href || (item.subItems?.some((sub) => pathname === sub.href) ?? false)
                                    const isOpen = openMenus.includes(item.id)

                                    if (item.subItems && item.subItems.length > 0) {
                                        return (
                                            <div key={item.id}>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        className={cn(
                                                            "flex-1 cursor-pointer justify-start",
                                                            isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-semibold",
                                                            isCollapsed && "justify-center",
                                                        )}
                                                        onClick={() => item.href && handleNavigation(item.href)}
                                                    >
                                                        <Icon className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                                                        {!isCollapsed && <span className="flex-1 text-left">{item.label}</span>}
                                                    </Button>
                                                    {!isCollapsed && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 shrink-0"
                                                            onClick={() => toggleMenu(item.id)}
                                                        >
                                                            <ChevronRight className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")} />
                                                        </Button>
                                                    )}
                                                </div>
                                                {!isCollapsed && isOpen && (
                                                    <div className="mt-1 ml-4 border-l-2 border-sidebar-border/50 pl-2 space-y-1">
                                                        {item.subItems.map((subItem) => {
                                                            // Check if this subItem has districts
                                                            const hasChevron = subItem.hasSubItems && subItem.onChevronClick

                                                            return (
                                                                <div key={subItem.id} className="flex items-center gap-1">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className={cn(
                                                                            "w-full cursor-pointer justify-start text-sm text-gray-300 hover:text-white hover:bg-sidebar-accent/50",
                                                                            pathname === subItem.href &&
                                                                            subItem.href !== "#" &&
                                                                            "bg-sidebar-accent text-white font-semibold",
                                                                            subItem.isHeader && "font-medium text-gray-200 hover:bg-sidebar-accent/30 pl-2",
                                                                            subItem.isIndented && "pl-4",
                                                                            subItem.isDoubleIndented && "pl-8",
                                                                            hasChevron && "flex-1",
                                                                        )}
                                                                        onClick={() => {
                                                                            if (subItem.onClick) {
                                                                                subItem.onClick()
                                                                            } else if (subItem.href !== "#") {
                                                                                handleNavigation(subItem.href)
                                                                            }
                                                                        }}
                                                                    >
                                                                        {subItem.hasSubItems && !hasChevron && (
                                                                            <ChevronRight
                                                                                className={cn(
                                                                                    "h-3 w-3 mr-1 transition-transform",
                                                                                    openMenus.includes(subItem.id) && "rotate-90",
                                                                                )}
                                                                            />
                                                                        )}
                                                                        {subItem.label}
                                                                    </Button>
                                                                    {hasChevron && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-7 w-7 shrink-0"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                subItem.onChevronClick?.()
                                                                            }}
                                                                        >
                                                                            <ChevronRight
                                                                                className={cn(
                                                                                    "h-3 w-3 transition-transform",
                                                                                    openMenus.includes(subItem.id) && "rotate-90",
                                                                                )}
                                                                            />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    }

                                    return (
                                        <Button
                                            key={item.id}
                                            variant="ghost"
                                            className={cn(
                                                "w-full cursor-pointer justify-start",
                                                isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-semibold",
                                                isCollapsed && "justify-center",
                                            )}
                                            onClick={() => item.href && handleNavigation(item.href)}
                                        >
                                            <Icon className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                                            {!isCollapsed && item.label}
                                        </Button>
                                    )
                                })}
                            </nav>
                        </ScrollArea>
                    </div>

                    {user && (
                        <div className="border-t border-sidebar-border p-3">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className={cn("w-full cursor-pointer", isCollapsed ? "justify-center p-2" : "justify-start")}
                                    >
                                        <Avatar className={cn("h-8 w-8", !isCollapsed && "mr-2")}>
                                            <AvatarFallback className="bg-primary text-primary-foreground">
                                                {user.name?.charAt(0).toUpperCase() || "U"}
                                            </AvatarFallback>
                                        </Avatar>
                                        {!isCollapsed && (
                                            <div className="flex flex-col items-start flex-1 min-w-0">
                                                <span className="text-sm font-medium truncate w-full">{user.name}</span>
                                                <span className="text-xs text-white truncate w-full">{user.email}</span>
                                            </div>
                                        )}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuItem onClick={() => setCommentsOpen(true)}>
                                        <MessageSquare className="mr-2 h-4 w-4" />
                                        Comments
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleLogout}>
                                        <LogOut className="mr-2 h-4 w-4" />
                                        Logout
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )}
                </div>
            </aside>

            <CommentsSheet open={commentsOpen} onClose={() => setCommentsOpen(false)} />
        </>
)
}
