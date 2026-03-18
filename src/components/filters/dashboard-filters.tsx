"use client"

import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFilterOptions } from "@/hooks/api/use-filter-options"
import { Loader2 } from "lucide-react"

interface DashboardFiltersProps {
  region: string
  district: string
  location: string
  meteringPoint?: string
  boundaryMeteringPoint?: string
  onRegionChange: (value: string) => void
  onDistrictChange: (value: string) => void
  onLocationChange: (value: string) => void
  onMeteringPointChange?: (value: string) => void
  onBoundaryMeteringPointChange?: (value: string) => void
  showMeteringPoint?: boolean
  showBoundaryMeteringPoint?: boolean
}

export function DashboardFilters({
  region,
  district,
  location,
  meteringPoint,
  boundaryMeteringPoint,
  onRegionChange,
  onDistrictChange,
  onLocationChange,
  onMeteringPointChange,
  onBoundaryMeteringPointChange,
  showMeteringPoint = false,
  showBoundaryMeteringPoint = false,
}: DashboardFiltersProps) {
  const { data: filterOptions, isLoading } = useFilterOptions()

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading filters...</span>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {/* Region Filter */}
      <div className="space-y-2">
        <Label htmlFor="region-filter">Region</Label>
        <Select value={region} onValueChange={onRegionChange}>
          <SelectTrigger id="region-filter">
            <SelectValue placeholder="All Regions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-regions">All Regions</SelectItem>
            {filterOptions?.regions.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* District Filter */}
      <div className="space-y-2">
        <Label htmlFor="district-filter">District</Label>
        <Select value={district} onValueChange={onDistrictChange}>
          <SelectTrigger id="district-filter">
            <SelectValue placeholder="All Districts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-districts">All Districts</SelectItem>
            {filterOptions?.districts.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Location Filter */}
      <div className="space-y-2">
        <Label htmlFor="location-filter">Location</Label>
        <Select value={location} onValueChange={onLocationChange}>
          <SelectTrigger id="location-filter">
            <SelectValue placeholder="All Locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-locations">All Locations</SelectItem>
            {filterOptions?.locations.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Metering Point Filter (conditional) */}
      {showMeteringPoint && onMeteringPointChange && (
        <div className="space-y-2">
          <Label htmlFor="metering-point-filter">Metering Point</Label>
          <Select value={meteringPoint} onValueChange={onMeteringPointChange}>
            <SelectTrigger id="metering-point-filter">
              <SelectValue placeholder="All Metering Points" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-metering-points">All Metering Points</SelectItem>
              {filterOptions?.meteringPoints.map((mp) => (
                <SelectItem key={mp} value={mp}>
                  {mp}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Boundary Metering Point Filter (conditional) */}
      {showBoundaryMeteringPoint && onBoundaryMeteringPointChange && (
        <div className="space-y-2">
          <Label htmlFor="boundary-metering-point-filter">Boundary Metering Point</Label>
          <Select value={boundaryMeteringPoint} onValueChange={onBoundaryMeteringPointChange}>
            <SelectTrigger id="boundary-metering-point-filter">
              <SelectValue placeholder="All Boundary Points" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-boundary-points">All Boundary Points</SelectItem>
              {filterOptions?.boundaryMeteringPoints.map((bmp) => (
                <SelectItem key={bmp} value={bmp}>
                  {bmp}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
