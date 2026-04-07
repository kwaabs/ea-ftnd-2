"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ChevronDown, ChevronUp, Filter, RotateCcw, CalendarIcon } from "lucide-react"
import { useFilterOptions } from "@/hooks/api/use-filter-options"
import Select from "react-select"
import { format, isValid, parseISO } from "date-fns"
import type { DateRange } from "react-day-picker"

interface FilterOption {
  value: string
  label: string
  isAvailable?: boolean
}

interface DashboardFilterPanelProps {
  preset: "last_day" | "last_week" | "last_month" | "custom"
  dateRange: { start: string; end: string }
  regions: string[]
  districts: string[]
  locations: string[]
  boundaryMeteringPoints: string[]
  meterTypes: string[]
  voltageKvs: string[]
  stations: string[]
  activeTab?: string
  onApplyFilters: (filters: {
    preset: "last_day" | "last_week" | "last_month" | "custom"
    dateRange: { start: string; end: string }
    regions: string[]
    districts: string[]
    locations: string[]
    boundaryMeteringPoints: string[]
    meterTypes: string[]
    voltageKvs: string[]
    stations: string[]
  }) => void
  onResetFilters: () => void
}

export function DashboardFilterPanel({
                                       preset,
                                       dateRange,
                                       regions,
                                       districts,
                                       locations,
                                       boundaryMeteringPoints,
                                       meterTypes,
                                       voltageKvs,
                                       stations,
                                       activeTab = "overview",
                                       onApplyFilters,
                                       onResetFilters,
                                     }: DashboardFilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false)

  const [pendingPreset, setPendingPreset] = useState<"last_day" | "last_week" | "last_month" | "custom">(preset)
  const [pendingDateRange, setPendingDateRange] = useState(dateRange)
  const [pendingRegions, setPendingRegions] = useState<FilterOption[]>(
      (regions || []).map((r) => ({ value: r, label: r })),
  )
  const [pendingDistricts, setPendingDistricts] = useState<FilterOption[]>(
      (districts || []).map((d) => ({ value: d, label: d })),
  )
  const [pendingLocations, setPendingLocations] = useState<FilterOption[]>(
      (locations || []).map((l) => ({ value: l, label: l })),
  )
  const [pendingBoundaryPoints, setPendingBoundaryPoints] = useState<FilterOption[]>(
      (boundaryMeteringPoints || []).map((b) => ({ value: b, label: b })),
  )
  const [pendingMeterTypes, setPendingMeterTypes] = useState<FilterOption[]>(
      (meterTypes || []).map((m) => ({ value: m, label: m })),
  )
  const [pendingVoltageKvs, setPendingVoltageKvs] = useState<FilterOption[]>(
      (voltageKvs || []).map((v) => ({ value: v, label: `${v} kV` })),
  )
  const [pendingStations, setPendingStations] = useState<FilterOption[]>(
      (stations || []).map((s) => ({ value: s, label: s })),
  )

  const disableCascading =
      activeTab === "boundary" || activeTab === "boundary-regional" || activeTab === "boundary-district"

  const { data: filterData, isLoading } = useFilterOptions(
      {
        regions: pendingRegions.map((r) => r.value),
        districts: pendingDistricts.map((d) => d.value),
        stations: pendingStations.map((s) => s.value),
        boundaryMeteringPoints: pendingBoundaryPoints.map((b) => b.value),
      },
      disableCascading,
      activeTab,
  )

  const { data: boundaryFilterOptions } = useFilterOptions(
      {
        boundaryMeteringPoints: pendingBoundaryPoints.map((b) => b.value),
      },
      false,
      activeTab,
  )

  useEffect(() => {
    setPendingPreset(preset)
    setPendingDateRange(dateRange)
    setPendingRegions((regions || []).map((r) => ({ value: r, label: r })))
    setPendingDistricts((districts || []).map((d) => ({ value: d, label: d })))
    setPendingLocations((locations || []).map((l) => ({ value: l, label: l })))
    setPendingBoundaryPoints((boundaryMeteringPoints || []).map((b) => ({ value: b, label: b })))
    setPendingMeterTypes((meterTypes || []).map((m) => ({ value: m, label: m })))
    setPendingVoltageKvs((voltageKvs || []).map((v) => ({ value: v, label: `${v} kV` })))
    setPendingStations((stations || []).map((s) => ({ value: s, label: s })))
  }, [preset, dateRange, regions, districts, locations, boundaryMeteringPoints, meterTypes, voltageKvs, stations])

  const regionOptions: FilterOption[] = filterData?.regions.map((r) => ({ value: r, label: r })) || []
  const districtOptions: FilterOption[] = filterData?.districts.map((d) => ({ value: d, label: d })) || []

  const locationOptions: FilterOption[] =
      activeTab === "boundary-regional"
          ? filterData?.regionalLocations?.map((l) => ({ value: l, label: l })) || []
          : activeTab === "boundary-district"
              ? filterData?.districtLocations?.map((l) => ({ value: l, label: l })) || []
              : filterData?.locations?.map((l) => ({ value: l, label: l })) || []

  const boundaryPointOptions: FilterOption[] =
      activeTab === "boundary-regional"
          ? boundaryFilterOptions?.regionalBoundaryPoints?.map((b) => ({ value: b, label: b })) || []
          : activeTab === "boundary-district"
              ? boundaryFilterOptions?.districtBoundaryPoints?.map((b) => ({ value: b, label: b })) || []
              : boundaryFilterOptions?.boundaryMeteringPoints?.map((b) => ({ value: b, label: b })) || []



  const stationOptions: FilterOption[] = filterData?.stations.map((s) => ({ value: s, label: s })) || []
  const meterTypeOptions: FilterOption[] = filterData?.meterTypes.map((m) => ({ value: m, label: m })) || []
  const voltageKvOptions: FilterOption[] = filterData?.voltageKvs.map((v) => ({ value: v, label: `${v} kV` })) || []

  const selectStyles = {
    control: (base: any, state: any) => ({
      ...base,
      minHeight: "36px",
      borderColor: state.isFocused ? "hsl(var(--ring))" : "hsl(var(--input))",
      backgroundColor: "hsl(var(--background))",
      boxShadow: state.isFocused ? "0 0 0 3px hsl(var(--ring) / 0.2)" : "none",
      "&:hover": {
        borderColor: "hsl(var(--ring))",
      },
    }),
    menu: (base: any) => ({
      ...base,
      backgroundColor: "#ffffff",
      border: "1px solid hsl(var(--border))",
      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -1px rgb(0 0 0 / 0.06)",
      zIndex: 9999,
    }),
    menuList: (base: any) => ({
      ...base,
      backgroundColor: "#ffffff",
      padding: "4px",
    }),
    menuPortal: (base: any) => ({
      ...base,
      zIndex: 9999,
    }),
    option: (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isSelected
          ? "rgb(59 130 246)" // Blue background for selected
          : state.isFocused
              ? "rgb(59 130 246 / 0.8)" // Lighter blue for focused
              : "#ffffff", // Solid white background for non-selected
      color: state.isSelected || state.isFocused ? "white" : "hsl(var(--foreground))",
      cursor: "pointer",
      padding: "8px 12px",
      "&:active": {
        backgroundColor: "rgb(59 130 246)",
      },
    }),
    multiValue: (base: any) => ({
      ...base,
      backgroundColor: "hsl(var(--secondary))",
    }),
    multiValueLabel: (base: any) => ({
      ...base,
      color: "hsl(var(--secondary-foreground))",
    }),
    multiValueRemove: (base: any) => ({
      ...base,
      color: "hsl(var(--secondary-foreground))",
      "&:hover": {
        backgroundColor: "hsl(var(--destructive))",
        color: "hsl(var(--destructive-foreground))",
      },
    }),
    input: (base: any) => ({
      ...base,
      color: "hsl(var(--foreground))",
    }),
    placeholder: (base: any) => ({
      ...base,
      color: "hsl(var(--muted-foreground))",
    }),
    singleValue: (base: any) => ({
      ...base,
      color: "hsl(var(--foreground))",
    }),
  }

  const handlePresetClick = (newPreset: "last_day" | "last_week" | "last_month") => {
    setPendingPreset(newPreset)
    const today = new Date()
    let start: Date
    const end = today

    switch (newPreset) {
      case "last_day":
        start = new Date(today)
        start.setDate(start.getDate() - 1)
        break
      case "last_week":
        start = new Date(today)
        start.setDate(start.getDate() - 7)
        break
      case "last_month":
        start = new Date(today)
        start.setMonth(start.getMonth() - 1)
        break
    }

    setPendingDateRange({
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd"),
    })
  }

  const handleCustomDateChange = (range: DateRange | undefined) => {
    if (!range) return

    if (range.from && range.to) {
      setPendingDateRange({
        start: format(range.from, "yyyy-MM-dd"),
        end: format(range.to, "yyyy-MM-dd"),
      })
      setPendingPreset("custom")
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

  const startDate = parseDate(pendingDateRange?.start)
  const endDate = parseDate(pendingDateRange?.end)
  const hasValidDates = startDate !== null && endDate !== null

  const handleApply = () => {
    onApplyFilters({
      preset: pendingPreset,
      dateRange: pendingDateRange,
      regions: pendingRegions.map((r) => r.value),
      districts: pendingDistricts.map((d) => d.value),
      locations: pendingLocations.map((l) => l.value),
      boundaryMeteringPoints: pendingBoundaryPoints.map((b) => b.value),
      meterTypes: pendingMeterTypes.map((m) => m.value),
      voltageKvs: pendingVoltageKvs.map((v) => v.value),
      stations: pendingStations.map((s) => s.value),
    })
  }

  const handleReset = () => {
    const today = new Date()
    const lastWeekStart = new Date(today)
    lastWeekStart.setDate(lastWeekStart.getDate() - 7)

    setPendingPreset("last_week")
    setPendingDateRange({
      start: format(lastWeekStart, "yyyy-MM-dd"),
      end: format(today, "yyyy-MM-dd"),
    })
    setPendingRegions([])
    setPendingDistricts([])
    setPendingLocations([])
    setPendingBoundaryPoints([])
    setPendingMeterTypes([])
    setPendingVoltageKvs([])
    setPendingStations([])
    onResetFilters()
  }

  const getVisibleFilters = () => {
    switch (activeTab) {
      case "bsp":
      case "pss":
        return {
          region: true,
          district: false,
          location: false,
          station: true,
          boundaryMeteringPoint: false,
          meterType: false,
          voltage: true,
        }
      case "feeders-trafo":
        return {
          region: true,
          district: false,
          location: false,
          station: true,
          boundaryMeteringPoint: false,
          meterType: false,
          voltage: true,
        }
      case "boundary":
      case "boundary-regional":
      case "boundary-district":
        return {
          region: false,
          district: false,
          location: true,
          station: false,
          boundaryMeteringPoint: true,
          meterType: false,
          voltage: false,
        }
      case "transformers":
        return {
          region: true,
          district: true,
          location: false,
          station: false,
          boundaryMeteringPoint: false,
          meterType: false,
          voltage: false,
        }
      case "overview":
      case "overview-main":
        return {
          region: true,
          district: true,
          location: false,
          station: true,
          boundaryMeteringPoint: true,
          meterType: true,
          voltage: true,
        }
      case "overview-map":
        return {
          region: false,
          district: false,
          location: false,
          station: false,
          boundaryMeteringPoint: false,
          meterType: false,
          voltage: false,
        }
      case "express-feeders":
        return {
          region: true,
          district: false,
          location: false,
          station: true,
          boundaryMeteringPoint: false,
          meterType: false,
          voltage: false,
        }
      case "express-feeder-detail":
        return {
          region: false,
          district: false,
          location: false,
          station: false,
          boundaryMeteringPoint: false,
          meterType: false,
          voltage: false,
        }
      case "switching":
      default:
        return {
          region: true,
          district: true,
          location: false,
          station: true,
          boundaryMeteringPoint: true,
          meterType: true,
          voltage: true,
        }
    }
  }

  const visibleFilters = getVisibleFilters()

  return (
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
          <div className="flex items-center gap-3">
            <Filter className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-base font-semibold text-foreground">Filters</h3>
              <p className="text-sm text-muted-foreground">
                {isOpen ? "Collapse to hide filters" : "Expand to configure filters"}
              </p>
            </div>
          </div>
          {isOpen ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground transition-transform" />
          ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform" />
          )}
        </CardHeader>
        {isOpen && (
            <CardContent className="space-y-6">
              {/* Date Range Filters */}
              <div className="space-y-3 pb-6 border-b border-border/50">
                <Label className="text-sm font-medium">Date Range</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex gap-2">
                    <Button
                        variant={pendingPreset === "last_day" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePresetClick("last_day")}
                        type="button"
                    >
                      Last Day
                    </Button>
                    <Button
                        variant={pendingPreset === "last_week" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePresetClick("last_week")}
                        type="button"
                    >
                      Last Week
                    </Button>
                    <Button
                        variant={pendingPreset === "last_month" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePresetClick("last_month")}
                        type="button"
                    >
                      Last Month
                    </Button>
                  </div>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                          variant={pendingPreset === "custom" ? "default" : "outline"}
                          size="sm"
                          className="gap-2"
                          type="button"
                      >
                        <CalendarIcon className="h-4 w-4" />
                        {pendingPreset === "custom" && hasValidDates ? (
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
              </div>

              {/* Additional Filters */}
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {visibleFilters.meterType && (
                      <div className="space-y-2">
                        <Label htmlFor="meter-type-filter" className="text-sm font-medium">
                          Metering type
                        </Label>
                        <Select
                            id="meter-type-filter"
                            isMulti
                            options={meterTypeOptions}
                            value={pendingMeterTypes}
                            onChange={(selected) => setPendingMeterTypes(selected as FilterOption[])}
                            placeholder="Select metering types..."
                            isLoading={isLoading}
                            isDisabled={isLoading}
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                            menuPosition="fixed"
                            className="react-select-container"
                            classNamePrefix="react-select"
                            isClearable
                        />
                      </div>
                  )}

                  {visibleFilters.station && (
                      <div className="space-y-2">
                        <Label htmlFor="station-filter" className="text-sm font-medium">
                          Station
                        </Label>
                        <Select
                            id="station-filter"
                            isMulti
                            options={stationOptions}
                            value={pendingStations}
                            onChange={(selected) => setPendingStations(selected as FilterOption[])}
                            placeholder="Select stations..."
                            isLoading={isLoading}
                            isDisabled={isLoading}
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                            menuPosition="fixed"
                            className="react-select-container"
                            classNamePrefix="react-select"
                            isClearable
                        />
                      </div>
                  )}

                  {visibleFilters.voltage && (
                      <div className="space-y-2">
                        <Label htmlFor="voltage-filter" className="text-sm font-medium">
                          Voltage (kV)
                        </Label>
                        <Select
                            id="voltage-filter"
                            isMulti
                            options={voltageKvOptions}
                            value={pendingVoltageKvs}
                            onChange={(selected) => setPendingVoltageKvs(selected as FilterOption[])}
                            placeholder="Select voltage levels..."
                            isLoading={isLoading}
                            isDisabled={isLoading}
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                            menuPosition="fixed"
                            className="react-select-container"
                            classNamePrefix="react-select"
                            isClearable
                        />
                      </div>
                  )}

                  {visibleFilters.region && (
                      <div className="space-y-2">
                        <Label htmlFor="region-filter" className="text-sm font-medium">
                          Region
                        </Label>
                        <Select
                            id="region-filter"
                            isMulti
                            options={regionOptions}
                            value={pendingRegions}
                            onChange={(selected) => setPendingRegions(selected as FilterOption[])}
                            placeholder="Select regions..."
                            isLoading={isLoading}
                            isDisabled={isLoading}
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                            menuPosition="fixed"
                            className="react-select-container"
                            classNamePrefix="react-select"
                            isClearable
                        />
                      </div>
                  )}

                  {visibleFilters.district && (
                      <div className="space-y-2">
                        <Label htmlFor="district-filter" className="text-sm font-medium">
                          District
                        </Label>
                        <Select
                            id="district-filter"
                            isMulti
                            options={districtOptions}
                            value={pendingDistricts}
                            onChange={(selected) => setPendingDistricts(selected as FilterOption[])}
                            placeholder="Select districts..."
                            isLoading={isLoading}
                            isDisabled={isLoading}
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                            menuPosition="fixed"
                            className="react-select-container"
                            classNamePrefix="react-select"
                            isClearable
                        />
                      </div>
                  )}

                  {visibleFilters.boundaryMeteringPoint && (
                      <div className="space-y-2">
                        <Label htmlFor="boundary-point-filter" className="text-sm font-medium">
                          Boundary Metering Point
                        </Label>
                        <Select
                            id="boundary-point-filter"
                            isMulti
                            options={boundaryPointOptions}
                            value={pendingBoundaryPoints}
                            onChange={(selected) => setPendingBoundaryPoints(selected as FilterOption[])}
                            placeholder="Select boundary points..."
                            isLoading={isLoading}
                            isDisabled={isLoading}
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                            menuPosition="fixed"
                            className="react-select-container"
                            classNamePrefix="react-select"
                            isClearable
                        />
                      </div>
                  )}

                  {visibleFilters.location && (
                      <div className="space-y-2">
                        <Label htmlFor="location-filter" className="text-sm font-medium">
                          Location
                        </Label>
                        <Select
                            id="location-filter"
                            isMulti
                            options={locationOptions}
                            value={pendingLocations}
                            onChange={(selected) => setPendingLocations(selected as FilterOption[])}
                            placeholder="Select locations..."
                            isLoading={isLoading}
                            isDisabled={isLoading}
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                            menuPosition="fixed"
                            className="react-select-container"
                            classNamePrefix="react-select"
                            isClearable
                        />
                      </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                <Button onClick={handleApply} className="gap-2">
                  <Filter className="h-4 w-4" />
                  Apply Filters
                </Button>
                <Button onClick={handleReset} variant="outline" className="gap-2 bg-transparent">
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
                <div className="ml-auto text-sm text-muted-foreground">
                  {[
                    pendingRegions.length && `${pendingRegions.length} region(s)`,
                    pendingDistricts.length && `${pendingDistricts.length} district(s)`,
                    pendingLocations.length && `${pendingLocations.length} location(s)`,
                    pendingStations.length && `${pendingStations.length} station(s)`,
                    pendingBoundaryPoints.length && `${pendingBoundaryPoints.length} boundary point(s)`,
                    pendingMeterTypes.length && `${pendingMeterTypes.length} metering type(s)`,
                    pendingVoltageKvs.length && `${pendingVoltageKvs.length} voltage level(s)`,
                  ]
                      .filter(Boolean)
                      .join(", ") || "No filters selected"}
                </div>
              </div>
            </CardContent>
        )}
      </Card>
  )
}
