"use client"

import React from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useSidebarStore } from "@/stores/sidebar-store"
import { useUserStore } from "@/stores/user-store"
import { usePathname, useRouter } from "next/navigation"
import { useFilterOptionsWithAvailability } from "@/hooks/api/use-filter-options"
import { LayoutDashboard, Map, BarChart3, Globe, Users, ChevronRight, ChevronLeft, Settings, LogOut, User, MessageSquare } from "lucide-react"
import { useCommentsSheetStore } from "@/stores/comments-sheet-store"

interface SidebarSubItem {
    id: string
    label: string
    href: string
    onClick?: () => void
    isHeader?: boolean
    isIndented?: boolean
    isDoubleIndented?: boolean
    hasSubItems?: boolean
    onChevronClick?: () => void
    /** Nested items rendered under this row with their own tree line */
    children?: SidebarSubItem[]
    /** Menu id used for expand/collapse (defaults to id) */
    menuId?: string
}

interface MenuItem {
    id: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    href?: string
    subItems?: SidebarSubItem[]
}

export function Sidebar() {
    const { isCollapsed, toggleCollapsed, openMenus, toggleMenu } = useSidebarStore()
    const { user, logout } = useUserStore()
    const pathname = usePathname()
    const router = useRouter()
    const openCommentsSheet = useCommentsSheetStore(s => s.open)

    const { data: filterOptions, isLoading: isLoadingFilters } = useFilterOptionsWithAvailability()

    const handleLogout = async () => {
        await fetch("/api/auth/logout", { method: "POST" })
        logout()
        router.push("/")
    }

    const handleNavigation = (href: string) => {
        router.push(href)
    }

    const userInitials = (() => {
        const parts = (user?.name || "").trim().split(/\s+/).filter(Boolean)
        if (parts.length >= 2) {
            return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        }
        if (parts.length === 1) {
            return parts[0].slice(0, 2).toUpperCase()
        }
        return user?.email?.charAt(0).toUpperCase() || "U"
    })()

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

        sortedTypes.forEach((type) => {
            organized.push({
                id: `meter-${type}`,
                label: meterTypeMapping[type] || type,
                href: `/meter-category/${type.toLowerCase().replace(/_/g, "-")}`,
            })
        })

        return organized
    }, [filterOptions?.all?.meterTypes])

    const isCustomerConsumptionPath =
        pathname === "/customer-sales" ||
        pathname.startsWith("/customer-sales/") ||
        pathname === "/amr" ||
        pathname.startsWith("/amr/")

    React.useEffect(() => {
        if (isCustomerConsumptionPath && !openMenus.includes("customer-sales")) {
            toggleMenu("customer-sales")
        }
        // Only auto-expand when entering these routes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname])

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
                            id: "meter-category",
                            label: "CATEGORY",
                            href: "#",
                            isHeader: true,
                            hasSubItems: true,
                            menuId: "meter-category",
                            onChevronClick: () => toggleMenu("meter-category"),
                            children: organizeMeterTypes,
                        },
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
                ...((filterOptions?.all?.regions || []).map((region) => {
                    const districts = regionToDistricts[region] || []
                    const regionSlug = region.toLowerCase().replace(/\s+/g, "-")
                    return {
                        id: `region-${region}`,
                        label: region,
                        href: `/regions/${regionSlug}`,
                        hasSubItems: districts.length > 0,
                        menuId: `region-${region}`,
                        onChevronClick:
                            districts.length > 0
                                ? () => toggleMenu(`region-${region}`)
                                : undefined,
                        children: districts.map((district) => ({
                            id: `district-${region}-${district}`,
                            label: district,
                            href: `/regions/${regionSlug}/districts/${district.toLowerCase().replace(/\s+/g, "-")}`,
                        })),
                    }
                })),
            ],
        },
        {
            id: "customer-sales",
            label: "Customer Consumption",
            icon: Users,
            href: "/customer-sales",
            subItems: [
                {
                    id: "customer-overview",
                    label: "Overview",
                    href: "/customer-sales",
                },
                {
                    id: "customer-zeus",
                    label: "Zeus — Postpaid",
                    href: "/customer-sales/zeus",
                },
                {
                    id: "customer-mms",
                    label: "MMS — Prepaid",
                    href: "/customer-sales/mms",
                },
                {
                    id: "customer-amr",
                    label: "AMR Meters",
                    href: "/amr",
                },
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

    return(
    <>
        <aside
            className={cn(
                "fixed left-0 top-0 z-40 h-screen border-r border-border bg-sidebar text-white transition-all duration-300",
                isCollapsed ? "w-16" : "w-64",
            )}
        >
            <div className="flex h-full flex-col">
                <div
                    className={cn(
                        "flex items-center border-b border-sidebar-border",
                        isCollapsed ? "h-16 justify-center px-0" : "h-16 justify-between gap-2 px-3",
                    )}
                >
                    {!isCollapsed && (
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Image
                                src="/images/ecg-logo.jpg"
                                alt="ECG Logo"
                                width={36}
                                height={36}
                                className="rounded-full shrink-0"
                            />
                            <span className="min-w-0 text-sm font-semibold text-sidebar-foreground leading-snug">
                                Energy Accounting
                                <br />
                                and Monitoring
                            </span>
                        </div>
                    )}
                    <Button variant="ghost" size="icon" onClick={toggleCollapsed} className="h-8 w-8 shrink-0">
                        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    </Button>
                </div>

                <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                        <nav className="space-y-1 px-3 py-4">
                            {menuItems.map((item) => {
                                const Icon = item.icon
                                const isActive =
                                    pathname === item.href ||
                                    (item.id === "customer-sales" && isCustomerConsumptionPath) ||
                                    (item.subItems?.some(
                                        (sub) =>
                                            pathname === sub.href ||
                                            (sub.href === "/amr" && pathname.startsWith("/amr/")) ||
                                            (sub.children?.some((child) => pathname === child.href) ?? false),
                                    ) ?? false)
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
                                                        const hasChevron = Boolean(subItem.hasSubItems && subItem.onChevronClick)
                                                        const childMenuId = subItem.menuId || subItem.id
                                                        const childrenOpen = openMenus.includes(childMenuId)
                                                        const isSubActive =
                                                            subItem.href !== "#" &&
                                                            (pathname === subItem.href ||
                                                                (subItem.href === "/amr" &&
                                                                    pathname.startsWith("/amr/")) ||
                                                                (subItem.children?.some(
                                                                    (child) => pathname === child.href,
                                                                ) ?? false) ||
                                                                // Keep region highlighted on its district pages
                                                                (subItem.href.startsWith("/regions/") &&
                                                                    pathname.startsWith(`${subItem.href}/`)))

                                                        return (
                                                            <div key={subItem.id} className="space-y-1">
                                                                <div className="flex items-center gap-1">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className={cn(
                                                                            "w-full cursor-pointer justify-start text-sm text-gray-300 hover:text-white hover:bg-sidebar-accent/50",
                                                                            isSubActive &&
                                                                            "bg-sidebar-accent text-white font-semibold",
                                                                            subItem.isHeader && "font-medium text-gray-200 hover:bg-sidebar-accent/30",
                                                                            subItem.isIndented && "pl-5",
                                                                            subItem.isDoubleIndented && "pl-8",
                                                                            hasChevron && "flex-1",
                                                                        )}
                                                                        onClick={() => {
                                                                            // Header-only rows (e.g. CATEGORY) toggle; link rows navigate
                                                                            if (subItem.isHeader && hasChevron) {
                                                                                subItem.onChevronClick?.()
                                                                            } else if (subItem.onClick) {
                                                                                subItem.onClick()
                                                                            } else if (subItem.href !== "#") {
                                                                                handleNavigation(subItem.href)
                                                                            }
                                                                        }}
                                                                    >
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
                                                                                    childrenOpen && "rotate-90",
                                                                                )}
                                                                            />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                                {/* Nested tree: children sit under this item */}
                                                                {hasChevron && childrenOpen && (subItem.children?.length ?? 0) > 0 && (
                                                                    <div className="ml-3 border-l-2 border-sidebar-border/40 pl-2 space-y-0.5">
                                                                        {subItem.children!.map((child) => {
                                                                            const isChildActive = pathname === child.href
                                                                            return (
                                                                                <Button
                                                                                    key={child.id}
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    className={cn(
                                                                                        "w-full cursor-pointer justify-start text-sm text-gray-300 hover:text-white hover:bg-sidebar-accent/50",
                                                                                        isChildActive &&
                                                                                        "bg-sidebar-accent text-white font-semibold",
                                                                                    )}
                                                                                    onClick={() => handleNavigation(child.href)}
                                                                                >
                                                                                    {child.label}
                                                                                </Button>
                                                                            )
                                                                        })}
                                                                    </div>
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
                                    className={cn(
                                        "w-full h-auto cursor-pointer text-sidebar-foreground",
                                        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                        "aria-expanded:bg-sidebar-accent aria-expanded:text-sidebar-accent-foreground",
                                        isCollapsed ? "justify-center p-2" : "justify-start gap-2 px-2 py-2",
                                    )}
                                >
                                    <Avatar className="h-8 w-8 shrink-0">
                                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                            {userInitials}
                                        </AvatarFallback>
                                    </Avatar>
                                    {!isCollapsed && (
                                        <div className="flex flex-col items-start flex-1 min-w-0 text-left">
                                            <span className="text-sm font-medium truncate w-full">{user.name}</span>
                                            <span className="text-xs truncate w-full opacity-70 font-normal">
                                                {user.email}
                                            </span>
                                        </div>
                                    )}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem onClick={openCommentsSheet}>
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
    </>
)
}
