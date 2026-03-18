// "use client"
//
// import { useQuery } from "@tanstack/react-query"
// import { useMemo } from "react"
//
// const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"
//
// interface Meter {
//     region: string | null
//     district: string | null
//     location: string | null
//     boundary_metering_point: string | null
//     meter_type: string | null
//     voltage_kv: number | null
//     station: string | null
// }
//
// interface MetersListResponse {
//     data: {
//         data: Meter[]
//         meta: {
//             limit: number
//             page: number
//             pages: number
//             total: number
//         }
//     }
// }
//
// export function useFilterOptionsWithAvailability(selectedFilters?: {
//     regions?: string[]
//     districts?: string[]
//     stations?: string[]
//     boundaryMeteringPoints?: string[]
// }) {
//     const query = useQuery({
//         queryKey: ["filter-options"],
//         queryFn: async () => {
//             const response = await fetch(`${API_BASE_URL}/api/v1/meters?limit=5000`)
//             if (!response.ok) throw new Error("Failed to fetch filter options")
//
//             const result: MetersListResponse = await response.json()
//             return result.data.data
//         },
//         staleTime: 5 * 60 * 1000,
//     })
//
//     const options = useMemo(() => {
//         if (!query.data) return null
//
//         // Get ALL options (unfiltered)
//         const allRegions = Array.from(
//             new Set(query.data.map((m) => m.region).filter((v): v is string => v != null && v !== "")),
//         ).sort()
//
//         const allDistricts = Array.from(
//             new Set(query.data.map((m) => m.district).filter((v): v is string => v != null && v !== "")),
//         ).sort()
//
//         const allLocations = Array.from(
//             new Set(query.data.map((m) => m.location).filter((v): v is string => v != null && v !== "")),
//         ).sort()
//
//         const allStations = Array.from(
//             new Set(query.data.map((m) => m.station).filter((v): v is string => v != null && v !== "")),
//         ).sort()
//
//         const allBoundaryMeteringPoints = Array.from(
//             new Set(query.data.map((m) => m.boundary_metering_point).filter((v): v is string => v != null && v !== "")),
//         ).sort()
//
//         const allMeterTypes = Array.from(
//             new Set(query.data.map((m) => m.meter_type).filter((v): v is string => v != null && v !== "")),
//         ).sort()
//
//         const allVoltageKvs = Array.from(new Set(query.data.map((m) => m.voltage_kv).filter((v): v is number => v != null)))
//             .sort((a, b) => a - b)
//             .map((v) => v.toString())
//
//         // Get AVAILABLE options based on current filters
//         let filteredMeters = query.data
//
//         if (selectedFilters?.regions && selectedFilters.regions.length > 0) {
//             filteredMeters = filteredMeters.filter((m) => m.region && selectedFilters.regions!.includes(m.region))
//         }
//
//         if (selectedFilters?.districts && selectedFilters.districts.length > 0) {
//             filteredMeters = filteredMeters.filter((m) => m.district && selectedFilters.districts!.includes(m.district))
//         }
//
//         if (selectedFilters?.stations && selectedFilters.stations.length > 0) {
//             filteredMeters = filteredMeters.filter((m) => m.station && selectedFilters.stations!.includes(m.station))
//         }
//
//         if (selectedFilters?.boundaryMeteringPoints && selectedFilters.boundaryMeteringPoints.length > 0) {
//             filteredMeters = filteredMeters.filter(
//                 (m) => m.boundary_metering_point && selectedFilters.boundaryMeteringPoints!.includes(m.boundary_metering_point),
//             )
//         }
//
//         const availableDistricts = new Set(
//             filteredMeters.map((m) => m.district).filter((v): v is string => v != null && v !== ""),
//         )
//
//         const availableStations = new Set(
//             filteredMeters.map((m) => m.station).filter((v): v is string => v != null && v !== ""),
//         )
//
//         const availableBoundaryMeteringPoints = new Set(
//             filteredMeters.map((m) => m.boundary_metering_point).filter((v): v is string => v != null && v !== ""),
//         )
//
//         return {
//             all: {
//                 regions: allRegions,
//                 districts: allDistricts,
//                 locations: allLocations,
//                 stations: allStations,
//                 boundaryMeteringPoints: allBoundaryMeteringPoints,
//                 meterTypes: allMeterTypes,
//                 voltageKvs: allVoltageKvs,
//             },
//             available: {
//                 districts: availableDistricts,
//                 stations: availableStations,
//                 boundaryMeteringPoints: availableBoundaryMeteringPoints,
//             },
//         }
//     }, [query.data, selectedFilters])
//
//     return {
//         data: options,
//         isLoading: query.isLoading,
//         error: query.error,
//     }
// }
//
// // Keep the original hook for backward compatibility
// export function useFilterOptions(
//     selectedFilters?: {
//         regions?: string[]
//         districts?: string[]
//         stations?: string[]
//         boundaryMeteringPoints?: string[]
//         regionalBoundaryPoints?: string[]
//         districtBoundaryPoints?: string[]
//         meterTypes?: string[]
//     },
//     disableCascading = false,
//     activeTab?: string,
// ) {
//     const query = useQuery({
//         queryKey: ["filter-options"],
//         queryFn: async () => {
//             const response = await fetch(`${API_BASE_URL}/api/v1/meters?limit=5000`)
//             if (!response.ok) throw new Error("Failed to fetch filter options")
//
//             const result: MetersListResponse = await response.json()
//             return result.data.data
//         },
//         staleTime: 5 * 60 * 1000, // Cache for 5 minutes
//     })
//
//     const filteredOptions = useMemo(() => {
//         if (!query.data) return null
//
//         let baseMeters = query.data
//         if (selectedFilters?.meterTypes && selectedFilters.meterTypes.length > 0) {
//             baseMeters = query.data.filter((m) => m.meter_type && selectedFilters.meterTypes!.includes(m.meter_type))
//         }
//
//         let boundaryMetersForFilter = query.data
//
//         if (activeTab === "boundary-regional") {
//             boundaryMetersForFilter = query.data.filter((m) => m.meter_type === "REGIONAL_BOUNDARY")
//             console.log("[v0] Regional Boundary Tab - Filtered Meters:", boundaryMetersForFilter.length)
//         } else if (activeTab === "boundary-district") {
//             boundaryMetersForFilter = query.data.filter((m) => m.meter_type === "DISTRICT_BOUNDARY")
//             console.log("[v0] District Boundary Tab - Filtered Meters:", boundaryMetersForFilter.length)
//         } else {
//             console.log("[v0] Other Tab - All Meters:", query.data.length)
//         }
//
//         const regionalBoundaryMeters = query.data.filter((m) => m.meter_type === "REGIONAL_BOUNDARY")
//         const districtBoundaryMeters = query.data.filter((m) => m.meter_type === "DISTRICT_BOUNDARY")
//
//         const regionalBoundaryPoints = Array.from(
//             new Set(
//                 regionalBoundaryMeters.map((m) => m.boundary_metering_point).filter((v): v is string => v != null && v !== ""),
//             ),
//         ).sort()
//
//         const districtBoundaryPoints = Array.from(
//             new Set(
//                 districtBoundaryMeters.map((m) => m.boundary_metering_point).filter((v): v is string => v != null && v !== ""),
//             ),
//         ).sort()
//
//         const regionalLocations = Array.from(
//             new Set(regionalBoundaryMeters.map((m) => m.location).filter((v): v is string => v != null && v !== "")),
//         ).sort()
//
//         const districtLocations = Array.from(
//             new Set(districtBoundaryMeters.map((m) => m.location).filter((v): v is string => v != null && v !== "")),
//         ).sort()
//
//         if (disableCascading) {
//             let metersForLocationFilter = baseMeters
//
//             if (selectedFilters?.boundaryMeteringPoints && selectedFilters.boundaryMeteringPoints.length > 0) {
//                 metersForLocationFilter = baseMeters.filter(
//                     (m) =>
//                         m.boundary_metering_point && selectedFilters.boundaryMeteringPoints!.includes(m.boundary_metering_point),
//                 )
//             }
//
//             const regions = Array.from(
//                 new Set(baseMeters.map((m) => m.region).filter((v): v is string => v != null && v !== "")),
//             ).sort()
//
//             const districts = Array.from(
//                 new Set(baseMeters.map((m) => m.district).filter((v): v is string => v != null && v !== "")),
//             ).sort()
//
//             const locations = Array.from(
//                 new Set(metersForLocationFilter.map((m) => m.location).filter((v): v is string => v != null && v !== "")),
//             ).sort()
//
//             const stations = Array.from(
//                 new Set(baseMeters.map((m) => m.station).filter((v): v is string => v != null && v !== "")),
//             ).sort()
//
//             const boundaryMeteringPoints = Array.from(
//                 new Set(
//                     boundaryMetersForFilter
//                         .map((m) => m.boundary_metering_point)
//                         .filter((v): v is string => v != null && v !== ""),
//                 ),
//             ).sort()
//
//             const meterTypes = Array.from(
//                 new Set(baseMeters.map((m) => m.meter_type).filter((v): v is string => v != null && v !== "")),
//             ).sort()
//
//             const voltageKvs = Array.from(new Set(baseMeters.map((m) => m.voltage_kv).filter((v): v is number => v != null)))
//                 .sort((a, b) => a - b)
//                 .map((v) => v.toString())
//
//             return {
//                 regions,
//                 districts,
//                 locations,
//                 boundaryMeteringPoints,
//                 regionalBoundaryPoints,
//                 districtBoundaryPoints,
//                 regionalLocations,
//                 districtLocations,
//                 meterTypes,
//                 voltageKvs,
//                 stations,
//             }
//         }
//
//         let meters = baseMeters
//
//         if (selectedFilters?.regions && selectedFilters.regions.length > 0) {
//             meters = meters.filter((m) => m.region && selectedFilters.regions!.includes(m.region))
//         }
//
//         if (selectedFilters?.districts && selectedFilters.districts.length > 0) {
//             meters = meters.filter((m) => m.district && selectedFilters.districts!.includes(m.district))
//         }
//
//         if (selectedFilters?.stations && selectedFilters.stations.length > 0) {
//             meters = meters.filter((m) => m.station && selectedFilters.stations!.includes(m.station))
//         }
//
//         if (selectedFilters?.boundaryMeteringPoints && selectedFilters.boundaryMeteringPoints.length > 0) {
//             meters = meters.filter(
//                 (m) => m.boundary_metering_point && selectedFilters.boundaryMeteringPoints!.includes(m.boundary_metering_point),
//             )
//         }
//
//         if (selectedFilters?.regionalBoundaryPoints && selectedFilters.regionalBoundaryPoints.length > 0) {
//             meters = meters.filter(
//                 (m) => m.boundary_metering_point && selectedFilters.regionalBoundaryPoints!.includes(m.boundary_metering_point),
//             )
//         }
//
//         if (selectedFilters?.districtBoundaryPoints && selectedFilters.districtBoundaryPoints.length > 0) {
//             meters = meters.filter(
//                 (m) => m.boundary_metering_point && selectedFilters.districtBoundaryPoints!.includes(m.boundary_metering_point),
//             )
//         }
//
//         const locationsSource =
//             activeTab === "boundary-regional" || activeTab === "boundary-district" ? boundaryMetersForFilter : meters
//         const locations = Array.from(
//             new Set(locationsSource.map((m) => m.location).filter((v): v is string => v != null && v !== "")),
//         ).sort()
//
//         const regions = Array.from(
//             new Set(baseMeters.map((m) => m.region).filter((v): v is string => v != null && v !== "")),
//         ).sort()
//
//         const districts = Array.from(
//             new Set(meters.map((m) => m.district).filter((v): v is string => v != null && v !== "")),
//         ).sort()
//
//         const stations = Array.from(
//             new Set(meters.map((m) => m.station).filter((v): v is string => v != null && v !== "")),
//         ).sort()
//
//         const boundaryMeteringPoints = Array.from(
//             new Set(
//                 boundaryMetersForFilter.map((m) => m.boundary_metering_point).filter((v): v is string => v != null && v !== ""),
//             ),
//         ).sort()
//
//         console.log("[v0] Active Tab:", activeTab)
//         console.log("[v0] Boundary Metering Points Count:", boundaryMeteringPoints.length)
//         console.log("[v0] Regional Boundary Points:", regionalBoundaryPoints.length)
//         console.log("[v0] District Boundary Points:", districtBoundaryPoints.length)
//         console.log("[v0] Regional Locations:", regionalLocations.length)
//         console.log("[v0] District Locations:", districtLocations.length)
//
//         const meterTypes = Array.from(
//             new Set(meters.map((m) => m.meter_type).filter((v): v is string => v != null && v !== "")),
//         ).sort()
//
//         const voltageKvs = Array.from(new Set(meters.map((m) => m.voltage_kv).filter((v): v is number => v != null)))
//             .sort((a, b) => a - b)
//             .map((v) => v.toString())
//
//         console.log("[v0] Locations Count:", locations.length)
//         console.log("[v0] Locations:", locations.slice(0, 5))
//
//         return {
//             regions,
//             districts,
//             locations,
//             boundaryMeteringPoints,
//             regionalBoundaryPoints,
//             districtBoundaryPoints,
//             regionalLocations,
//             districtLocations,
//             meterTypes,
//             voltageKvs,
//             stations,
//         }
//     }, [query.data, selectedFilters, disableCascading, activeTab])
//
//     return {
//         data: filteredOptions,
//         isLoading: query.isLoading,
//         error: query.error,
//     }
// }

"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

interface Meter {
  region: string | null
  district: string | null
  location: string | null
  boundary_metering_point: string | null
  meter_type: string | null
  voltage_kv: number | null
  station: string | null
}

interface MetersListResponse {
  data: {
    data: Meter[]
    meta: {
      limit: number
      page: number
      pages: number
      total: number
    }
  }
}

export function useFilterOptionsWithAvailability(selectedFilters?: {
  regions?: string[]
  districts?: string[]
  stations?: string[]
  boundaryMeteringPoints?: string[]
}) {
  const query = useQuery({
    queryKey: ["filter-options"],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/meters?limit=5000`)
      if (!response.ok) throw new Error("Failed to fetch filter options")

      const result: MetersListResponse = await response.json()
      return result.data.data
    },
    staleTime: 5 * 60 * 1000,
  })

  const options = useMemo(() => {
    if (!query.data) return null

    // Get ALL options (unfiltered)
    const allRegions = Array.from(
      new Set(query.data.map((m) => m.region).filter((v): v is string => v != null && v !== "")),
    ).sort()

    const allDistricts = Array.from(
      new Set(query.data.map((m) => m.district).filter((v): v is string => v != null && v !== "")),
    ).sort()

    const allLocations = Array.from(
      new Set(query.data.map((m) => m.location).filter((v): v is string => v != null && v !== "")),
    ).sort()

    const allStations = Array.from(
      new Set(query.data.map((m) => m.station).filter((v): v is string => v != null && v !== "")),
    ).sort()

    const allBoundaryMeteringPoints = Array.from(
      new Set(query.data.map((m) => m.boundary_metering_point).filter((v): v is string => v != null && v !== "")),
    ).sort()

    const allMeterTypes = Array.from(
      new Set(query.data.map((m) => m.meter_type).filter((v): v is string => v != null && v !== "")),
    ).sort()

    const allVoltageKvs = Array.from(new Set(query.data.map((m) => m.voltage_kv).filter((v): v is number => v != null)))
      .sort((a, b) => a - b)
      .map((v) => v.toString())

    // Get AVAILABLE options based on current filters
    let filteredMeters = query.data

    if (selectedFilters?.regions && selectedFilters.regions.length > 0) {
      filteredMeters = filteredMeters.filter((m) => m.region && selectedFilters.regions!.includes(m.region))
    }

    if (selectedFilters?.districts && selectedFilters.districts.length > 0) {
      filteredMeters = filteredMeters.filter((m) => m.district && selectedFilters.districts!.includes(m.district))
    }

    if (selectedFilters?.stations && selectedFilters.stations.length > 0) {
      filteredMeters = filteredMeters.filter((m) => m.station && selectedFilters.stations!.includes(m.station))
    }

    if (selectedFilters?.boundaryMeteringPoints && selectedFilters.boundaryMeteringPoints.length > 0) {
      filteredMeters = filteredMeters.filter(
        (m) => m.boundary_metering_point && selectedFilters.boundaryMeteringPoints!.includes(m.boundary_metering_point),
      )
    }

    const availableDistricts = new Set(
      filteredMeters.map((m) => m.district).filter((v): v is string => v != null && v !== ""),
    )

    const availableStations = new Set(
      filteredMeters.map((m) => m.station).filter((v): v is string => v != null && v !== ""),
    )

    const availableBoundaryMeteringPoints = new Set(
      filteredMeters.map((m) => m.boundary_metering_point).filter((v): v is string => v != null && v !== ""),
    )

    return {
      all: {
        regions: allRegions,
        districts: allDistricts,
        locations: allLocations,
        stations: allStations,
        boundaryMeteringPoints: allBoundaryMeteringPoints,
        meterTypes: allMeterTypes,
        voltageKvs: allVoltageKvs,
      },
      available: {
        districts: availableDistricts,
        stations: availableStations,
        boundaryMeteringPoints: availableBoundaryMeteringPoints,
      },
    }
  }, [query.data, selectedFilters])

  return {
    data: options,
    isLoading: query.isLoading,
    error: query.error,
  }
}

// Keep the original hook for backward compatibility
export function useFilterOptions(
  selectedFilters?: {
    regions?: string[]
    districts?: string[]
    stations?: string[]
    boundaryMeteringPoints?: string[]
    regionalBoundaryPoints?: string[]
    districtBoundaryPoints?: string[]
    meterTypes?: string[]
  },
  disableCascading = false,
  activeTab?: string,
) {
  const query = useQuery({
    queryKey: ["filter-options"],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/meters?limit=5000`)
      if (!response.ok) throw new Error("Failed to fetch filter options")

      const result: MetersListResponse = await response.json()
      return result.data.data
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  const filteredOptions = useMemo(() => {
    if (!query.data) return null

    let baseMeters = query.data
    if (selectedFilters?.meterTypes && selectedFilters.meterTypes.length > 0) {
      baseMeters = query.data.filter((m) => m.meter_type && selectedFilters.meterTypes!.includes(m.meter_type))
    }

    let boundaryMetersForFilter = query.data
    let boundaryMeterType: string | null = null

    if (activeTab === "boundary-regional") {
      boundaryMetersForFilter = query.data.filter((m) => m.meter_type === "REGIONAL_BOUNDARY")
      boundaryMeterType = "REGIONAL_BOUNDARY"
    } else if (activeTab === "boundary-district") {
      boundaryMetersForFilter = query.data.filter((m) => m.meter_type === "DISTRICT_BOUNDARY")
      boundaryMeterType = "DISTRICT_BOUNDARY"
    }

    let metersForLocationFilter = boundaryMetersForFilter
    if (
      boundaryMeterType &&
      selectedFilters?.boundaryMeteringPoints &&
      selectedFilters.boundaryMeteringPoints.length > 0
    ) {
      metersForLocationFilter = boundaryMetersForFilter.filter(
        (m) => m.boundary_metering_point && selectedFilters.boundaryMeteringPoints!.includes(m.boundary_metering_point),
      )
    }

    const regionalBoundaryMeters = query.data.filter((m) => m.meter_type === "REGIONAL_BOUNDARY")
    const districtBoundaryMeters = query.data.filter((m) => m.meter_type === "DISTRICT_BOUNDARY")

    const regionalBoundaryPoints = Array.from(
      new Set(
        regionalBoundaryMeters.map((m) => m.boundary_metering_point).filter((v): v is string => v != null && v !== ""),
      ),
    ).sort()

    const districtBoundaryPoints = Array.from(
      new Set(
        districtBoundaryMeters.map((m) => m.boundary_metering_point).filter((v): v is string => v != null && v !== ""),
      ),
    ).sort()

    const regionalLocations = Array.from(
      new Set(
        (activeTab === "boundary-regional" ? metersForLocationFilter : regionalBoundaryMeters)
          .map((m) => m.location)
          .filter((v): v is string => v != null && v !== ""),
      ),
    ).sort()

    const districtLocations = Array.from(
      new Set(
        (activeTab === "boundary-district" ? metersForLocationFilter : districtBoundaryMeters)
          .map((m) => m.location)
          .filter((v): v is string => v != null && v !== ""),
      ),
    ).sort()

    if (disableCascading) {
      let metersForLocationFilter = baseMeters

      if (selectedFilters?.boundaryMeteringPoints && selectedFilters.boundaryMeteringPoints.length > 0) {
        metersForLocationFilter = baseMeters.filter(
          (m) =>
            m.boundary_metering_point && selectedFilters.boundaryMeteringPoints!.includes(m.boundary_metering_point),
        )
      }

      const regions = Array.from(
        new Set(baseMeters.map((m) => m.region).filter((v): v is string => v != null && v !== "")),
      ).sort()

      const districts = Array.from(
        new Set(baseMeters.map((m) => m.district).filter((v): v is string => v != null && v !== "")),
      ).sort()

      const locations = Array.from(
        new Set(metersForLocationFilter.map((m) => m.location).filter((v): v is string => v != null && v !== "")),
      ).sort()

      const stations = Array.from(
        new Set(baseMeters.map((m) => m.station).filter((v): v is string => v != null && v !== "")),
      ).sort()

      const boundaryMeteringPoints = Array.from(
        new Set(
          boundaryMetersForFilter
            .map((m) => m.boundary_metering_point)
            .filter((v): v is string => v != null && v !== ""),
        ),
      ).sort()

      const meterTypes = Array.from(
        new Set(baseMeters.map((m) => m.meter_type).filter((v): v is string => v != null && v !== "")),
      ).sort()

      const voltageKvs = Array.from(new Set(baseMeters.map((m) => m.voltage_kv).filter((v): v is number => v != null)))
        .sort((a, b) => a - b)
        .map((v) => v.toString())

      return {
        regions,
        districts,
        locations,
        boundaryMeteringPoints,
        regionalBoundaryPoints: [],
        districtBoundaryPoints: [],
        regionalLocations,
        districtLocations,
        meterTypes,
        voltageKvs,
        stations,
      }
    }

    let meters = baseMeters

    if (selectedFilters?.regions && selectedFilters.regions.length > 0) {
      meters = meters.filter((m) => m.region && selectedFilters.regions!.includes(m.region))
    }

    if (selectedFilters?.districts && selectedFilters.districts.length > 0) {
      meters = meters.filter((m) => m.district && selectedFilters.districts!.includes(m.district))
    }

    if (selectedFilters?.stations && selectedFilters.stations.length > 0) {
      meters = meters.filter((m) => m.station && selectedFilters.stations!.includes(m.station))
    }

    if (selectedFilters?.boundaryMeteringPoints && selectedFilters.boundaryMeteringPoints.length > 0) {
      meters = meters.filter(
        (m) => m.boundary_metering_point && selectedFilters.boundaryMeteringPoints!.includes(m.boundary_metering_point),
      )
    }

    if (selectedFilters?.regionalBoundaryPoints && selectedFilters.regionalBoundaryPoints.length > 0) {
      meters = meters.filter(
        (m) => m.boundary_metering_point && selectedFilters.regionalBoundaryPoints!.includes(m.boundary_metering_point),
      )
    }

    if (selectedFilters?.districtBoundaryPoints && selectedFilters.districtBoundaryPoints.length > 0) {
      meters = meters.filter(
        (m) => m.boundary_metering_point && selectedFilters.districtBoundaryPoints!.includes(m.boundary_metering_point),
      )
    }

    const locationsSource =
      activeTab === "boundary-regional" || activeTab === "boundary-district" ? metersForLocationFilter : meters
    const locations = Array.from(
      new Set(locationsSource.map((m) => m.location).filter((v): v is string => v != null && v !== "")),
    ).sort()

    const regions = Array.from(
      new Set(baseMeters.map((m) => m.region).filter((v): v is string => v != null && v !== "")),
    ).sort()

    const districts = Array.from(
      new Set(meters.map((m) => m.district).filter((v): v is string => v != null && v !== "")),
    ).sort()

    const stations = Array.from(
      new Set(meters.map((m) => m.station).filter((v): v is string => v != null && v !== "")),
    ).sort()

    const boundaryMeteringPoints = Array.from(
      new Set(
        boundaryMetersForFilter.map((m) => m.boundary_metering_point).filter((v): v is string => v != null && v !== ""),
      ),
    ).sort()

    console.log("[v0] Active Tab:", activeTab)
    console.log("[v0] Boundary Metering Points Count:", boundaryMeteringPoints.length)
    console.log("[v0] Regional Boundary Points:", regionalBoundaryPoints.length)
    console.log("[v0] District Boundary Points:", districtBoundaryPoints.length)
    console.log("[v0] Regional Locations:", regionalLocations.length)
    console.log("[v0] District Locations:", districtLocations.length)

    const meterTypes = Array.from(
      new Set(meters.map((m) => m.meter_type).filter((v): v is string => v != null && v !== "")),
    ).sort()

    const voltageKvs = Array.from(new Set(meters.map((m) => m.voltage_kv).filter((v): v is number => v != null)))
      .sort((a, b) => a - b)
      .map((v) => v.toString())

    console.log("[v0] Locations Count:", locations.length)
    console.log("[v0] Locations:", locations.slice(0, 5))

    return {
      regions,
      districts,
      locations,
      boundaryMeteringPoints,
      regionalBoundaryPoints,
      districtBoundaryPoints,
      regionalLocations,
      districtLocations,
      meterTypes,
      voltageKvs,
      stations,
    }
  }, [query.data, selectedFilters, disableCascading, activeTab])

  return {
    data: filteredOptions,
    isLoading: query.isLoading,
    error: query.error,
  }
}
