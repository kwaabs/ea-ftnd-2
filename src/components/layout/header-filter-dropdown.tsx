// "use client"
//
// import { useState, useEffect } from "react"
// import { usePathname } from "next/navigation"
// import { Calendar, Filter } from "lucide-react"
// import { Button } from "@/components/ui/button"
// import Select from "react-select"
// import { useAppStore } from "@/stores/app-store"
// import { useFilterOptions } from "@/hooks/api/use-filter-options"
// import { DateRangePicker } from "@/components/filters/date-range-picker"
//
// export function HeaderFilterDropdown() {
//     const pathname = usePathname()
//     const { filters, setFilters } = useAppStore()
//
//     // Pending filters (not applied yet)
//     const [pendingFilters, setPendingFilters] = useState(filters)
//     const [showCustomDate, setShowCustomDate] = useState(false)
//
//     // Check if on detail pages that only need date filters
//     const isMeterDetailsPage = pathname?.startsWith("/meters/") && pathname.split("/").length === 3
//     const isStationDetailsPage = pathname?.startsWith("/stations/") && pathname.split("/").length === 3
//     const isBoundaryDetailsPage = pathname?.startsWith("/regional-boundary/") || pathname?.startsWith("/district-boundary/")
//     const isRegionDetailsPage = pathname?.startsWith("/regions/") && pathname.split("/").length === 3
//     const isDistrictDetailsPage = pathname?.startsWith("/districts/") && pathname.split("/").length === 3
//     const isExpressFeederDetailPage = (pathname?.startsWith("/express-feeders/") && pathname.split("/").length === 3)
//         || (pathname?.startsWith("/meter-category/express-feeder/"))
//     const isDateOnlyPage = isMeterDetailsPage || isStationDetailsPage || isBoundaryDetailsPage || isRegionDetailsPage || isDistrictDetailsPage || isExpressFeederDetailPage
//
//     // Regions overview page — show only date + region filters
//     const isRegionsOverviewPage = pathname === "/regions"
//
//     // Express feeders overview page — show only date + region + station filters
//
//     const meterCategory = pathname?.includes("/meter-category/")
//         ? pathname.split("/meter-category/")[1]?.split("/")[0]
//         : null
//
//     // Matches both /express-feeders and /meter-category/express-feeder
//     const isExpressFeedersPage = pathname === "/express-feeders" || meterCategory === "express-feeder"
//
//
//     // Map meterCategory to activeTab expected by the hook
//     const getActiveTab = () => {
//         if (meterCategory === "district-boundary") return "boundary-district"
//         if (meterCategory === "regional-boundary") return "boundary-regional"
//         return undefined
//     }
//
//     const formatMeterType = (text?: string) => {
//         if (!text) return "—"
//         if (text === "BSP") return "BSP Incomer"
//         if (text === "DTX") return "Distribution Transformer"
//         if (text === "REGIONAL_BOUNDARY") return "Regional Boundary"
//         if (text === "DISTRICT_BOUNDARY") return "District Boundary"
//         return text
//     }
//
//     // Determine meter type filter based on page
//     const getMeterTypeFilter = () => {
//         if (meterCategory === "district-boundary") return ["DISTRICT_BOUNDARY"]
//         if (meterCategory === "regional-boundary") return ["REGIONAL_BOUNDARY"]
//         return undefined
//     }
//
//     // Fetch filter options with cascading dependencies
//     const { data: filterOptions } = useFilterOptions({
//         regions: pendingFilters.regions || [],
//         districts: pendingFilters.districts || [],
//         stations: pendingFilters.stations || [],
//         boundaryMeteringPoints: pendingFilters.boundaryMeteringPoints || [],
//         meterTypes: getMeterTypeFilter(),
//     }, false, getActiveTab())
//
//     // Sync pending filters when global filters change
//     useEffect(() => {
//         setPendingFilters(filters)
//     }, [filters])
//
//     // Reset locations when boundary points change (cascading filter)
//     useEffect(() => {
//         if (meterCategory === "district-boundary" || meterCategory === "regional-boundary") {
//             // When boundary points change, locations need to be re-filtered
//             // Keep only locations that are still valid under new boundary selection
//             if (pendingFilters.boundaryMeteringPoints && pendingFilters.boundaryMeteringPoints.length > 0) {
//                 // Clear locations to force user to re-select after boundary point changes
//                 // OR keep them if the API automatically filters - depends on your API behavior
//             }
//         }
//     }, [pendingFilters.boundaryMeteringPoints, meterCategory])
//
//     // Check if voltage filter should be shown
//     const hasVoltageData = filterOptions?.voltages && filterOptions.voltages.length > 0
//
//     const handleDatePreset = (preset: string) => {
//         const end = new Date()
//         const start = new Date()
//
//         switch (preset) {
//             case "lastDay":
//                 start.setDate(end.getDate() - 1)
//                 break
//             case "lastWeek":
//                 start.setDate(end.getDate() - 7)
//                 break
//             case "lastMonth":
//                 start.setMonth(end.getMonth() - 1)
//                 break
//         }
//
//         setPendingFilters({
//             ...pendingFilters,
//             preset,
//             dateRange: { start, end },
//         })
//         setShowCustomDate(false)
//     }
//
//     const handleApplyFilters = () => {
//         setFilters(pendingFilters)
//     }
//
//     const handleReset = () => {
//         const defaultFilters = {
//             preset: "lastMonth" as const,
//             dateRange: {
//                 start: new Date(new Date().setMonth(new Date().getMonth() - 1)),
//                 end: new Date(),
//             },
//             regions: [],
//             districts: [],
//             locations: [],
//             boundaryMeteringPoints: [],
//             meterTypes: [],
//             voltages: [],
//             stations: [],
//             activeTab: "consumption" as const,
//         }
//         setPendingFilters(defaultFilters)
//         setFilters(defaultFilters)
//     }
//
//     const showMeterType = !isRegionsOverviewPage && !isExpressFeedersPage && !["bsp", "dtx", "district-boundary", "regional-boundary"].includes(meterCategory || "")
//     const showStation = !isRegionsOverviewPage && !["dtx", "district-boundary", "regional-boundary"].includes(meterCategory || "")
//     const showRegion = !["district-boundary", "regional-boundary"].includes(meterCategory || "")
//     const showDistrict = !isRegionsOverviewPage && !isExpressFeedersPage && !["bsp", "district-boundary", "regional-boundary"].includes(meterCategory || "")
//     const showBoundaryPoint = !isRegionsOverviewPage && !isExpressFeedersPage && !["bsp", "dtx"].includes(meterCategory || "")
//     const showLocation = !isRegionsOverviewPage && !isExpressFeedersPage && ["district-boundary", "regional-boundary"].includes(meterCategory || "")
//     const showVoltage = !isRegionsOverviewPage && !isExpressFeedersPage && hasVoltageData
//
//     // Transform options for react-select
//     const regionOptions = (filterOptions?.regions || []).map((r) => ({ value: r, label: r }))
//     const districtOptions = (filterOptions?.districts || []).map((d) => ({ value: d, label: d }))
//     const stationOptions = (filterOptions?.stations || []).map((s) => ({ value: s, label: s }))
//
//     // Use specialized location arrays for boundary pages
//     const getLocationOptions = () => {
//         if (meterCategory === "district-boundary") {
//             return (filterOptions?.districtLocations || []).map((l) => ({ value: l, label: l }))
//         } else if (meterCategory === "regional-boundary") {
//             return (filterOptions?.regionalLocations || []).map((l) => ({ value: l, label: l }))
//         }
//         return (filterOptions?.locations || []).map((l) => ({ value: l, label: l }))
//     }
//     const locationOptions = getLocationOptions()
//
//     const voltageOptions = (filterOptions?.voltages || []).map((v) => ({ value: v, label: `${v} kV` }))
//     const meterTypeOptions = (filterOptions?.meterTypes || []).map((m) => ({
//         value: m,
//         label: formatMeterType(m)
//     }))
//
//     // Use specialized boundary point arrays for boundary pages
//     const getBoundaryOptions = () => {
//         if (meterCategory === "district-boundary") {
//             return (filterOptions?.districtBoundaryPoints || []).map((b) => ({ value: b, label: b }))
//         } else if (meterCategory === "regional-boundary") {
//             return (filterOptions?.regionalBoundaryPoints || []).map((b) => ({ value: b, label: b }))
//         }
//         return (filterOptions?.boundaryMeteringPoints || []).map((b) => ({ value: b, label: b }))
//     }
//     const boundaryOptions = getBoundaryOptions()
//
//     // 🔥 FIXED: Custom styles with proper z-index and portal settings
//     const selectStyles = {
//         control: (base: any) => ({
//             ...base,
//             minHeight: "36px",
//             fontSize: "0.875rem",
//         }),
//         menu: (base: any) => ({
//             ...base,
//             zIndex: 9999,
//         }),
//         menuPortal: (base: any) => ({
//             ...base,
//             zIndex: 9999,
//         }),
//     }
//
//     return (
//         <div className="w-[800px] bg-slate-50 p-6 space-y-6">
//             {/* Header */}
//             <div className="flex items-start gap-3">
//                 <Filter className="h-5 w-5 text-primary mt-0.5" />
//                 <div className="flex-1">
//                     <h3 className="font-semibold text-lg">Filters</h3>
//                 </div>
//             </div>
//
//             {/* Date Range */}
//             <div className="space-y-3">
//                 <label className="text-sm font-medium">Date Range</label>
//                 <div className="flex gap-2 flex-wrap">
//                     <Button
//                         variant={pendingFilters.preset === "lastDay" ? "default" : "outline"}
//                         size="sm"
//                         onClick={() => handleDatePreset("lastDay")}
//                     >
//                         Last Day
//                     </Button>
//                     <Button
//                         variant={pendingFilters.preset === "lastWeek" ? "default" : "outline"}
//                         size="sm"
//                         onClick={() => handleDatePreset("lastWeek")}
//                     >
//                         Last Week
//                     </Button>
//                     <Button
//                         variant={pendingFilters.preset === "lastMonth" ? "default" : "outline"}
//                         size="sm"
//                         onClick={() => handleDatePreset("lastMonth")}
//                     >
//                         Last Month
//                     </Button>
//                     <Button
//                         variant={showCustomDate ? "default" : "outline"}
//                         size="sm"
//                         onClick={() => setShowCustomDate(!showCustomDate)}
//                     >
//                         <Calendar className="h-4 w-4 mr-2" />
//                         Custom Range
//                     </Button>
//                 </div>
//
//                 {showCustomDate && (
//                     <DateRangePicker
//                         value={pendingFilters.dateRange}
//                         onChange={(range) =>
//                             setPendingFilters({
//                                 ...pendingFilters,
//                                 preset: "custom",
//                                 dateRange: range,
//                             })
//                         }
//                     />
//                 )}
//             </div>
//
//             {/* Filter Grid - Hidden on meter/station details pages */}
//             {!isDateOnlyPage && (
//                 <div className="grid grid-cols-3 gap-4">
//                     {showMeterType && (
//                         <div className="space-y-2">
//                             <label className="text-sm font-medium">Metering type</label>
//                             <Select
//                                 isMulti
//                                 placeholder="Select metering types..."
//                                 options={meterTypeOptions}
//                                 value={meterTypeOptions.filter((o) => pendingFilters.meterTypes?.includes(o.value))}
//                                 onChange={(selected) =>
//                                     setPendingFilters({
//                                         ...pendingFilters,
//                                         meterTypes: selected.map((s) => s.value),
//                                     })
//                                 }
//                                 styles={selectStyles}
//                                 menuPortalTarget={document.body}
//                                 menuPosition="fixed"
//                                 className="text-sm"
//                                 classNamePrefix="select"
//                             />
//                         </div>
//                     )}
//
//                     {showStation && (
//                         <div className="space-y-2">
//                             <label className="text-sm font-medium">Station</label>
//                             <Select
//                                 isMulti
//                                 placeholder="Select stations..."
//                                 options={stationOptions}
//                                 value={stationOptions.filter((o) => pendingFilters.stations?.includes(o.value))}
//                                 onChange={(selected) =>
//                                     setPendingFilters({
//                                         ...pendingFilters,
//                                         stations: selected.map((s) => s.value),
//                                     })
//                                 }
//                                 styles={selectStyles}
//                                 menuPortalTarget={document.body}
//                                 menuPosition="fixed"
//                                 className="text-sm"
//                                 classNamePrefix="select"
//                             />
//                         </div>
//                     )}
//
//                     {showVoltage && (
//                         <div className="space-y-2">
//                             <label className="text-sm font-medium">Voltage (kV)</label>
//                             <Select
//                                 isMulti
//                                 placeholder="Select voltage levels..."
//                                 options={voltageOptions}
//                                 value={voltageOptions.filter((o) => pendingFilters.voltages?.includes(o.value))}
//                                 onChange={(selected) =>
//                                     setPendingFilters({
//                                         ...pendingFilters,
//                                         voltages: selected.map((s) => s.value),
//                                     })
//                                 }
//                                 styles={selectStyles}
//                                 menuPortalTarget={document.body}
//                                 menuPosition="fixed"
//                                 className="text-sm"
//                                 classNamePrefix="select"
//                             />
//                         </div>
//                     )}
//
//                     {showRegion && (
//                         <div className="space-y-2">
//                             <label className="text-sm font-medium">Region</label>
//                             <Select
//                                 isMulti
//                                 placeholder="Select regions..."
//                                 options={regionOptions}
//                                 value={regionOptions.filter((o) => pendingFilters.regions?.includes(o.value))}
//                                 onChange={(selected) =>
//                                     setPendingFilters({
//                                         ...pendingFilters,
//                                         regions: selected.map((s) => s.value),
//                                     })
//                                 }
//                                 styles={selectStyles}
//                                 menuPortalTarget={document.body}
//                                 menuPosition="fixed"
//                                 className="text-sm"
//                                 classNamePrefix="select"
//                             />
//                         </div>
//                     )}
//
//                     {showDistrict && (
//                         <div className="space-y-2">
//                             <label className="text-sm font-medium">District</label>
//                             <Select
//                                 isMulti
//                                 placeholder="Select districts..."
//                                 options={districtOptions}
//                                 value={districtOptions.filter((o) => pendingFilters.districts?.includes(o.value))}
//                                 onChange={(selected) =>
//                                     setPendingFilters({
//                                         ...pendingFilters,
//                                         districts: selected.map((s) => s.value),
//                                     })
//                                 }
//                                 styles={selectStyles}
//                                 menuPortalTarget={document.body}
//                                 menuPosition="fixed"
//                                 className="text-sm"
//                                 classNamePrefix="select"
//                             />
//                         </div>
//                     )}
//
//                     {showBoundaryPoint && (
//                         <div className="space-y-2">
//                             <label className="text-sm font-medium">Boundary Metering Point</label>
//                             <Select
//                                 isMulti
//                                 placeholder="Select boundary points..."
//                                 options={boundaryOptions}
//                                 value={boundaryOptions.filter((o) => pendingFilters.boundaryMeteringPoints?.includes(o.value))}
//                                 onChange={(selected) =>
//                                     setPendingFilters({
//                                         ...pendingFilters,
//                                         boundaryMeteringPoints: selected.map((s) => s.value),
//                                         locations: [],
//                                     })
//                                 }
//                                 styles={selectStyles}
//                                 menuPortalTarget={document.body}
//                                 menuPosition="fixed"
//                                 className="text-sm"
//                                 classNamePrefix="select"
//                             />
//                         </div>
//                     )}
//
//                     {showLocation && (
//                         <div className="space-y-2">
//                             <label className="text-sm font-medium">
//                                 Location
//                                 {pendingFilters.boundaryMeteringPoints && pendingFilters.boundaryMeteringPoints.length > 0 && (
//                                     <span className="text-xs text-muted-foreground ml-1">
//                                         (filtered by boundary point)
//                                     </span>
//                                 )}
//                             </label>
//                             <Select
//                                 isMulti
//                                 placeholder={
//                                     pendingFilters.boundaryMeteringPoints && pendingFilters.boundaryMeteringPoints.length > 0
//                                         ? "Select locations..."
//                                         : "Select boundary point first..."
//                                 }
//                                 options={locationOptions}
//                                 value={locationOptions.filter((o) => pendingFilters.locations?.includes(o.value))}
//                                 onChange={(selected) =>
//                                     setPendingFilters({
//                                         ...pendingFilters,
//                                         locations: selected.map((s) => s.value),
//                                     })
//                                 }
//                                 isDisabled={!pendingFilters.boundaryMeteringPoints || pendingFilters.boundaryMeteringPoints.length === 0}
//                                 styles={selectStyles}
//                                 menuPortalTarget={document.body}
//                                 menuPosition="fixed"
//                                 className="text-sm"
//                                 classNamePrefix="select"
//                             />
//                         </div>
//                     )}
//                 </div>
//             )}
//
//             {/* Actions */}
//             <div className="flex items-center justify-between pt-2 border-t">
//                 <div className="flex gap-2">
//                     <Button onClick={handleApplyFilters} size="sm">
//                         <Filter className="h-4 w-4 mr-2" />
//                         Apply Filters
//                     </Button>
//                     <Button variant="outline" size="sm" onClick={handleReset}>
//                         Reset
//                     </Button>
//                 </div>
//                 <span className="text-sm text-muted-foreground">
//                     {pendingFilters.regions?.length ||
//                     pendingFilters.districts?.length ||
//                     pendingFilters.stations?.length ||
//                     pendingFilters.boundaryMeteringPoints?.length ||
//                     pendingFilters.locations?.length
//                         ? `${
//                             (pendingFilters.regions?.length || 0) +
//                             (pendingFilters.districts?.length || 0) +
//                             (pendingFilters.stations?.length || 0) +
//                             (pendingFilters.boundaryMeteringPoints?.length || 0) +
//                             (pendingFilters.locations?.length || 0)
//                         } filters selected`
//                         : "No filters selected"}
//                 </span>
//             </div>
//         </div>
//     )
// }



"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Calendar, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import Select from "react-select"
import { useAppStore } from "@/stores/app-store"
import { useFilterOptions } from "@/hooks/api/use-filter-options"
import { DateRangePicker } from "@/components/filters/date-range-picker"

export function HeaderFilterDropdown() {
    const pathname = usePathname()
    const { filters, setFilters } = useAppStore()

    // Pending filters (not applied yet)
    const [pendingFilters, setPendingFilters] = useState(filters)
    const [showCustomDate, setShowCustomDate] = useState(false)

    // Check if on detail pages that only need date filters
    const isMeterDetailsPage = pathname?.startsWith("/meters/") && pathname.split("/").length === 3
    const isStationDetailsPage = pathname?.startsWith("/stations/") && pathname.split("/").length === 3
    const isBoundaryDetailsPage = pathname?.startsWith("/regional-boundary/") || pathname?.startsWith("/district-boundary/")
    const isRegionDetailsPage = pathname?.startsWith("/regions/") && pathname.split("/").length === 3
    const isDistrictDetailsPage = pathname?.startsWith("/districts/") && pathname.split("/").length === 3
    const isExpressFeederDetailPage = (pathname?.startsWith("/express-feeders/") && pathname.split("/").length === 3)
        || (pathname?.startsWith("/meter-category/express-feeder/"))
    // Map and Customer Sales pages build their own region/source breakdowns
    // client-side rather than filtering server-side by region/district/etc,
    // so only the date range applies there — the rest of the filter grid
    // wouldn't do anything on these pages.
    const isMapPage = pathname === "/map"
    const isCustomerSalesPage = pathname === "/customer-sales"
    const isAdminLoginsPage = pathname === "/admin/logins"
    // Zeus / MMS / AMR list: date + region + district; AMR meter detail: date only
    const isZeusPage = pathname === "/customer-sales/zeus"
    const isMmsPage = pathname === "/customer-sales/mms"
    const isAmrPage = pathname === "/amr"
    const isAmrMeterDetailPage = Boolean(pathname?.startsWith("/amr/") && pathname.split("/").length === 3)
    const isDateOnlyPage = isMeterDetailsPage || isStationDetailsPage || isBoundaryDetailsPage || isRegionDetailsPage || isDistrictDetailsPage || isExpressFeederDetailPage || isMapPage || isCustomerSalesPage || isAmrMeterDetailPage || isAdminLoginsPage

    // Regions overview page — show only date + region filters
    const isRegionsOverviewPage = pathname === "/regions"

    const meterCategory = pathname?.includes("/meter-category/")
        ? pathname.split("/meter-category/")[1]?.split("/")[0]
        : null

    // Express feeders overview page — show date + region + district + station + voltage filters
    // Matches both /express-feeders and /meter-category/express-feeder
    const isExpressFeedersPage = pathname === "/express-feeders" || meterCategory === "express-feeder"

    // Map meterCategory to activeTab expected by the hook
    const getActiveTab = () => {
        if (meterCategory === "district-boundary") return "boundary-district"
        if (meterCategory === "regional-boundary") return "boundary-regional"
        return undefined
    }

    const formatMeterType = (text?: string) => {
        if (!text) return "—"
        if (text === "BSP") return "BSP Incomer"
        if (text === "DTX") return "Distribution Transformer"
        if (text === "REGIONAL_BOUNDARY") return "Regional Boundary"
        if (text === "DISTRICT_BOUNDARY") return "District Boundary"
        return text
    }

    // Determine meter type filter based on page
    const getMeterTypeFilter = () => {
        if (meterCategory === "district-boundary") return ["DISTRICT_BOUNDARY"]
        if (meterCategory === "regional-boundary") return ["REGIONAL_BOUNDARY"]
        return undefined
    }

    // Fetch filter options with cascading dependencies
    const { data: filterOptions } = useFilterOptions({
        regions: pendingFilters.regions || [],
        districts: pendingFilters.districts || [],
        stations: pendingFilters.stations || [],
        boundaryMeteringPoints: pendingFilters.boundaryMeteringPoints || [],
        meterTypes: getMeterTypeFilter(),
    }, false, getActiveTab())

    // Sync pending filters when global filters change
    useEffect(() => {
        setPendingFilters(filters)
    }, [filters])

    // Reset locations when boundary points change (cascading filter)
    useEffect(() => {
        if (meterCategory === "district-boundary" || meterCategory === "regional-boundary") {
            // When boundary points change, locations need to be re-filtered
            // Keep only locations that are still valid under new boundary selection
            if (pendingFilters.boundaryMeteringPoints && pendingFilters.boundaryMeteringPoints.length > 0) {
                // Clear locations to force user to re-select after boundary point changes
                // OR keep them if the API automatically filters - depends on your API behavior
            }
        }
    }, [pendingFilters.boundaryMeteringPoints, meterCategory])

    // Check if voltage filter should be shown
    const hasVoltageData = filterOptions?.voltages && filterOptions.voltages.length > 0

    const handleDatePreset = (preset: string) => {
        // Max end date is always yesterday (today excluded)
        const end = new Date()
        end.setHours(0, 0, 0, 0)
        end.setDate(end.getDate() - 1)

        const start = new Date(end)

        switch (preset) {
            case "lastDay":
                // Most recent complete day only
                break
            case "lastWeek":
                start.setDate(end.getDate() - 6)
                break
            case "lastMonth":
                start.setMonth(end.getMonth() - 1)
                break
        }

        setPendingFilters({
            ...pendingFilters,
            preset,
            dateRange: { start, end },
        })
        setShowCustomDate(false)
    }

    const handleApplyFilters = () => {
        const maxEnd = new Date()
        maxEnd.setHours(0, 0, 0, 0)
        maxEnd.setDate(maxEnd.getDate() - 1)

        const start = new Date(pendingFilters.dateRange.start)
        start.setHours(0, 0, 0, 0)
        let end = new Date(pendingFilters.dateRange.end)
        end.setHours(0, 0, 0, 0)
        if (end > maxEnd) end = new Date(maxEnd)
        if (start > end) {
            start.setTime(end.getTime())
        }

        setFilters({
            ...pendingFilters,
            dateRange: { start, end },
        })
    }

    const handleReset = () => {
        const end = new Date()
        end.setHours(0, 0, 0, 0)
        end.setDate(end.getDate() - 1)
        const start = new Date(end)
        start.setMonth(start.getMonth() - 1)

        const defaultFilters = {
            preset: "lastMonth" as const,
            dateRange: {
                start,
                end,
            },
            regions: [],
            districts: [],
            locations: [],
            boundaryMeteringPoints: [],
            meterTypes: [],
            voltages: [],
            stations: [],
            activeTab: "consumption" as const,
        }
        setPendingFilters(defaultFilters)
        setFilters(defaultFilters)
    }

    const showMeterType = !isZeusPage && !isMmsPage && !isAmrPage && !isRegionsOverviewPage && !isExpressFeedersPage && !["bsp", "dtx", "district-boundary", "regional-boundary"].includes(meterCategory || "")
    const showStation = !isZeusPage && !isMmsPage && !isAmrPage && !isRegionsOverviewPage && !["dtx", "district-boundary", "regional-boundary"].includes(meterCategory || "")
    const showRegion = !["district-boundary", "regional-boundary"].includes(meterCategory || "")
    const showDistrict = !isRegionsOverviewPage && !["bsp", "district-boundary", "regional-boundary"].includes(meterCategory || "")
    const showBoundaryPoint = !isZeusPage && !isMmsPage && !isAmrPage && !isRegionsOverviewPage && !isExpressFeedersPage && !["bsp", "dtx"].includes(meterCategory || "")
    const showLocation = !isZeusPage && !isMmsPage && !isAmrPage && !isRegionsOverviewPage && !isExpressFeedersPage && ["district-boundary", "regional-boundary"].includes(meterCategory || "")
    const showVoltage = !isZeusPage && !isMmsPage && !isAmrPage && !isRegionsOverviewPage && hasVoltageData

    // Transform options for react-select
    const regionOptions = (filterOptions?.regions || []).map((r) => ({ value: r, label: r }))
    const districtOptions = (filterOptions?.districts || []).map((d) => ({ value: d, label: d }))
    const stationOptions = (filterOptions?.stations || []).map((s) => ({ value: s, label: s }))

    // Use specialized location arrays for boundary pages
    const getLocationOptions = () => {
        if (meterCategory === "district-boundary") {
            return (filterOptions?.districtLocations || []).map((l) => ({ value: l, label: l }))
        } else if (meterCategory === "regional-boundary") {
            return (filterOptions?.regionalLocations || []).map((l) => ({ value: l, label: l }))
        }
        return (filterOptions?.locations || []).map((l) => ({ value: l, label: l }))
    }
    const locationOptions = getLocationOptions()

    const voltageOptions = (filterOptions?.voltages || []).map((v) => ({ value: v, label: `${v} kV` }))
    const meterTypeOptions = (filterOptions?.meterTypes || []).map((m) => ({
        value: m,
        label: formatMeterType(m)
    }))

    // Use specialized boundary point arrays for boundary pages
    const getBoundaryOptions = () => {
        if (meterCategory === "district-boundary") {
            return (filterOptions?.districtBoundaryPoints || []).map((b) => ({ value: b, label: b }))
        } else if (meterCategory === "regional-boundary") {
            return (filterOptions?.regionalBoundaryPoints || []).map((b) => ({ value: b, label: b }))
        }
        return (filterOptions?.boundaryMeteringPoints || []).map((b) => ({ value: b, label: b }))
    }
    const boundaryOptions = getBoundaryOptions()

    // 🔥 FIXED: Custom styles with proper z-index and portal settings
    const selectStyles = {
        control: (base: any) => ({
            ...base,
            minHeight: "36px",
            fontSize: "0.875rem",
        }),
        menu: (base: any) => ({
            ...base,
            zIndex: 9999,
        }),
        menuPortal: (base: any) => ({
            ...base,
            zIndex: 9999,
        }),
    }

    return (
        <div className="w-[800px] bg-slate-50 p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start gap-3">
                <Filter className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                    <h3 className="font-semibold text-lg">Filters</h3>
                </div>
            </div>

            {/* Date Range */}
            <div className="space-y-3">
                <label className="text-sm font-medium">Date Range</label>
                <div className="flex gap-2 flex-wrap">
                    <Button
                        variant={pendingFilters.preset === "lastDay" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleDatePreset("lastDay")}
                    >
                        Last Day
                    </Button>
                    <Button
                        variant={pendingFilters.preset === "lastWeek" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleDatePreset("lastWeek")}
                    >
                        Last Week
                    </Button>
                    <Button
                        variant={pendingFilters.preset === "lastMonth" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleDatePreset("lastMonth")}
                    >
                        Last Month
                    </Button>
                    <Button
                        variant={showCustomDate ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowCustomDate(!showCustomDate)}
                    >
                        <Calendar className="h-4 w-4 mr-2" />
                        Custom Range
                    </Button>
                </div>

                {showCustomDate && (
                    <DateRangePicker
                        value={pendingFilters.dateRange}
                        onChange={(range) =>
                            setPendingFilters({
                                ...pendingFilters,
                                preset: "custom",
                                dateRange: range,
                            })
                        }
                    />
                )}
            </div>

            {/* Filter Grid - Hidden on meter/station details pages */}
            {!isDateOnlyPage && (
                <div className="grid grid-cols-3 gap-4">
                    {showMeterType && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Metering type</label>
                            <Select
                                isMulti
                                placeholder="Select metering types..."
                                options={meterTypeOptions}
                                value={meterTypeOptions.filter((o) => pendingFilters.meterTypes?.includes(o.value))}
                                onChange={(selected) =>
                                    setPendingFilters({
                                        ...pendingFilters,
                                        meterTypes: selected.map((s) => s.value),
                                    })
                                }
                                styles={selectStyles}
                                menuPortalTarget={document.body}
                                menuPosition="fixed"
                                className="text-sm"
                                classNamePrefix="select"
                            />
                        </div>
                    )}

                    {showStation && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Station</label>
                            <Select
                                isMulti
                                placeholder="Select stations..."
                                options={stationOptions}
                                value={stationOptions.filter((o) => pendingFilters.stations?.includes(o.value))}
                                onChange={(selected) =>
                                    setPendingFilters({
                                        ...pendingFilters,
                                        stations: selected.map((s) => s.value),
                                    })
                                }
                                styles={selectStyles}
                                menuPortalTarget={document.body}
                                menuPosition="fixed"
                                className="text-sm"
                                classNamePrefix="select"
                            />
                        </div>
                    )}

                    {showVoltage && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Voltage (kV)</label>
                            <Select
                                isMulti
                                placeholder="Select voltage levels..."
                                options={voltageOptions}
                                value={voltageOptions.filter((o) => pendingFilters.voltages?.includes(o.value))}
                                onChange={(selected) =>
                                    setPendingFilters({
                                        ...pendingFilters,
                                        voltages: selected.map((s) => s.value),
                                    })
                                }
                                styles={selectStyles}
                                menuPortalTarget={document.body}
                                menuPosition="fixed"
                                className="text-sm"
                                classNamePrefix="select"
                            />
                        </div>
                    )}

                    {showRegion && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Region</label>
                            <Select
                                isMulti
                                placeholder="Select regions..."
                                options={regionOptions}
                                value={regionOptions.filter((o) => pendingFilters.regions?.includes(o.value))}
                                onChange={(selected) =>
                                    setPendingFilters({
                                        ...pendingFilters,
                                        regions: selected.map((s) => s.value),
                                    })
                                }
                                styles={selectStyles}
                                menuPortalTarget={document.body}
                                menuPosition="fixed"
                                className="text-sm"
                                classNamePrefix="select"
                            />
                        </div>
                    )}

                    {showDistrict && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">District</label>
                            <Select
                                isMulti
                                placeholder="Select districts..."
                                options={districtOptions}
                                value={districtOptions.filter((o) => pendingFilters.districts?.includes(o.value))}
                                onChange={(selected) =>
                                    setPendingFilters({
                                        ...pendingFilters,
                                        districts: selected.map((s) => s.value),
                                    })
                                }
                                styles={selectStyles}
                                menuPortalTarget={document.body}
                                menuPosition="fixed"
                                className="text-sm"
                                classNamePrefix="select"
                            />
                        </div>
                    )}

                    {showBoundaryPoint && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Boundary Metering Point</label>
                            <Select
                                isMulti
                                placeholder="Select boundary points..."
                                options={boundaryOptions}
                                value={boundaryOptions.filter((o) => pendingFilters.boundaryMeteringPoints?.includes(o.value))}
                                onChange={(selected) =>
                                    setPendingFilters({
                                        ...pendingFilters,
                                        boundaryMeteringPoints: selected.map((s) => s.value),
                                        locations: [],
                                    })
                                }
                                styles={selectStyles}
                                menuPortalTarget={document.body}
                                menuPosition="fixed"
                                className="text-sm"
                                classNamePrefix="select"
                            />
                        </div>
                    )}

                    {showLocation && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                Location
                                {pendingFilters.boundaryMeteringPoints && pendingFilters.boundaryMeteringPoints.length > 0 && (
                                    <span className="text-xs text-muted-foreground ml-1">
                                        (filtered by boundary point)
                                    </span>
                                )}
                            </label>
                            <Select
                                isMulti
                                placeholder={
                                    pendingFilters.boundaryMeteringPoints && pendingFilters.boundaryMeteringPoints.length > 0
                                        ? "Select locations..."
                                        : "Select boundary point first..."
                                }
                                options={locationOptions}
                                value={locationOptions.filter((o) => pendingFilters.locations?.includes(o.value))}
                                onChange={(selected) =>
                                    setPendingFilters({
                                        ...pendingFilters,
                                        locations: selected.map((s) => s.value),
                                    })
                                }
                                isDisabled={!pendingFilters.boundaryMeteringPoints || pendingFilters.boundaryMeteringPoints.length === 0}
                                styles={selectStyles}
                                menuPortalTarget={document.body}
                                menuPosition="fixed"
                                className="text-sm"
                                classNamePrefix="select"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex gap-2">
                    <Button onClick={handleApplyFilters} size="sm">
                        <Filter className="h-4 w-4 mr-2" />
                        Apply Filters
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleReset}>
                        Reset
                    </Button>
                </div>
                <span className="text-sm text-muted-foreground">
                    {pendingFilters.regions?.length ||
                    pendingFilters.districts?.length ||
                    pendingFilters.stations?.length ||
                    pendingFilters.boundaryMeteringPoints?.length ||
                    pendingFilters.locations?.length
                        ? `${
                            (pendingFilters.regions?.length || 0) +
                            (pendingFilters.districts?.length || 0) +
                            (pendingFilters.stations?.length || 0) +
                            (pendingFilters.boundaryMeteringPoints?.length || 0) +
                            (pendingFilters.locations?.length || 0)
                        } filters selected`
                        : "No filters selected"}
                </span>
            </div>
        </div>
    )
}
