"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useMeters } from "@/hooks/api/use-meter-api"
import { ChevronDown } from "lucide-react"

interface ConsumptionMapFiltersProps {
  onFilterChange: (filters: {
    region?: string
    station?: string
    district?: string
    boundaryMeteringPoint?: string
    location?: string
  }) => void
}

export function ConsumptionMapFilters({ onFilterChange }: ConsumptionMapFiltersProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState<string>()
  const [selectedStation, setSelectedStation] = useState<string>()
  const [selectedDistrict, setSelectedDistrict] = useState<string>()
  const [selectedBoundaryPoint, setSelectedBoundaryPoint] = useState<string>()
  const [selectedLocation, setSelectedLocation] = useState<string>()

  // Fetch all meters to get unique values for filters
  const { data: allMetersData } = useMeters({ limit: 10000 })

  // Extract unique values
  const regions = Array.from(new Set(allMetersData?.data?.data?.map(m => m.region).filter(Boolean))) as string[]
  const allStations = Array.from(new Set(allMetersData?.data?.data?.map(m => m.station).filter(Boolean))) as string[]
  const allDistricts = Array.from(new Set(allMetersData?.data?.data?.map(m => m.district).filter(Boolean))) as string[]
  const allBoundaryPoints = Array.from(new Set(allMetersData?.data?.data
    ?.filter(m => m.meter_type === "REGIONAL_BOUNDARY")
    ?.map(m => m.boundary_metering_point).filter(Boolean))) as string[]

  // Dependent filters - stations and districts filtered by selected region
  const stations = selectedRegion 
    ? allStations.filter(station => 
        allMetersData?.data?.data?.some(m => m.region === selectedRegion && m.station === station)
      )
    : allStations

  const districts = selectedRegion
    ? allDistricts.filter(district =>
        allMetersData?.data?.data?.some(m => m.region === selectedRegion && m.district === district)
      )
    : allDistricts

  // Locations filtered by selected boundary point
  const locations = selectedBoundaryPoint
    ? Array.from(new Set(allMetersData?.data?.data
        ?.filter(m => m.boundary_metering_point === selectedBoundaryPoint)
        ?.map(m => m.location).filter(Boolean))) as string[]
    : []

  // Notify parent of filter changes
  useEffect(() => {
    onFilterChange({
      region: selectedRegion,
      station: selectedStation,
      district: selectedDistrict,
      boundaryMeteringPoint: selectedBoundaryPoint,
      location: selectedLocation,
    })
  }, [selectedRegion, selectedStation, selectedDistrict, selectedBoundaryPoint, selectedLocation, onFilterChange])

  // Reset dependent filters when region changes
  useEffect(() => {
    setSelectedStation(undefined)
    setSelectedDistrict(undefined)
  }, [selectedRegion])

  // Reset location when boundary point changes
  useEffect(() => {
    setSelectedLocation(undefined)
  }, [selectedBoundaryPoint])

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-sm">Consumption Filters</div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-muted rounded transition-colors"
            aria-label={isCollapsed ? "Expand filters" : "Collapse filters"}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${isCollapsed ? "-rotate-180" : ""}`} />
          </button>
        </div>

        {!isCollapsed && (
          <div className="grid grid-cols-5 gap-4 pt-2 border-t">
            {/* Region Filter */}
            <div className="space-y-2">
              <Label htmlFor="region-filter" className="text-xs">Region</Label>
              <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                <SelectTrigger id="region-filter" className="h-9">
                  <SelectValue placeholder="All regions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All regions</SelectItem>
                  {regions.sort().map(region => (
                    <SelectItem key={region} value={region}>{region}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Station Filter */}
            <div className="space-y-2">
              <Label htmlFor="station-filter" className="text-xs">Station</Label>
              <Select value={selectedStation} onValueChange={setSelectedStation} disabled={!selectedRegion}>
                <SelectTrigger id="station-filter" className="h-9">
                  <SelectValue placeholder="All stations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All stations</SelectItem>
                  {stations.sort().map(station => (
                    <SelectItem key={station} value={station}>{station}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* District Filter */}
            <div className="space-y-2">
              <Label htmlFor="district-filter" className="text-xs">District</Label>
              <Select value={selectedDistrict} onValueChange={setSelectedDistrict} disabled={!selectedRegion}>
                <SelectTrigger id="district-filter" className="h-9">
                  <SelectValue placeholder="All districts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All districts</SelectItem>
                  {districts.sort().map(district => (
                    <SelectItem key={district} value={district}>{district}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Boundary Metering Point Filter */}
            <div className="space-y-2">
              <Label htmlFor="boundary-filter" className="text-xs">Boundary Point</Label>
              <Select value={selectedBoundaryPoint} onValueChange={setSelectedBoundaryPoint}>
                <SelectTrigger id="boundary-filter" className="h-9">
                  <SelectValue placeholder="All boundaries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All boundaries</SelectItem>
                  {allBoundaryPoints.sort().map(point => (
                    <SelectItem key={point} value={point}>{point}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Location Filter */}
            <div className="space-y-2">
              <Label htmlFor="location-filter" className="text-xs">Location</Label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation} disabled={!selectedBoundaryPoint}>
                <SelectTrigger id="location-filter" className="h-9">
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All locations</SelectItem>
                  {locations.sort().map(location => (
                    <SelectItem key={location} value={location}>{location}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
