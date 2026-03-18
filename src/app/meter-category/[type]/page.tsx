"use client"

import { useEffect } from "react"
import { useParams } from "next/navigation"
import { AppLayout } from "@/components/layout/app-layout"
import { FeedersTrafoTab } from "@/components/dashboard/feeders-trafo-tab"
import { DtxTab } from "@/components/dashboard/dtx-tab"
import { RegionalBoundaryTab } from "@/components/dashboard/regional-boundary-tab"
import { DistrictBoundaryTab } from "@/components/dashboard/district-boundary-tab"
import { useAppStore } from "@/stores/app-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatNumber, formatApiDate } from "@/lib/utils"
import { useConsumptionAggregate } from "@/hooks/api/use-consumption-aggregate-api"
import { useMeterStatusSummary } from "@/hooks/api/use-meter-status-api"

export default function MeterCategoryPage() {
  const params = useParams()
  const typeSlug = params.type as string

  const {
    dateRange,
    selectedRegions,
    selectedDistricts,
    selectedStations,
    selectedBoundaryMeteringPoints,
    selectedVoltageKvs,
    clearNonDateFilters,
  } = useAppStore()

  // Clear non-date filters when user leaves the page
  useEffect(() => {
    return () => {
      clearNonDateFilters()
    }
  }, [clearNonDateFilters])

  const defaultDateRange = {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date(),
  }
  const effectiveDateRange = dateRange || defaultDateRange

  const meterTypeMapping: Record<string, string> = {
    bsp: "BSP Incomers",
    "distribution-transformers": "Distribution Transformers",
    dtx: "Distribution Transformers",
    "regional-boundary": "Regional Boundary",
    "district-boundary": "District Boundary",
  }

  const apiMeterTypeMapping: Record<string, string> = {
    bsp: "BSP",
    "distribution-transformers": "DTX",
    dtx: "DTX",
    "regional-boundary": "REGIONAL_BOUNDARY",
    "district-boundary": "DISTRICT_BOUNDARY",
  }

  const displayName = meterTypeMapping[typeSlug] || typeSlug
  const apiMeterType = apiMeterTypeMapping[typeSlug] || typeSlug.toUpperCase()

  const { data: consumptionData } = useConsumptionAggregate({
    meterTypes: [apiMeterType],
    dateFrom: formatApiDate(effectiveDateRange.start),
    dateTo: formatApiDate(effectiveDateRange.end),
  })

  const { data: statusData } = useMeterStatusSummary({
    meterTypes: [apiMeterType],
    dateFrom: formatApiDate(effectiveDateRange.start),
    dateTo: formatApiDate(effectiveDateRange.end),
  })

  return (
    <AppLayout>
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">{displayName}</h1>

        {typeSlug === "bsp" ? (
          <FeedersTrafoTab />
        ) : typeSlug === "distribution-transformers" || typeSlug === "dtx" ? (
          <DtxTab />
        ) : typeSlug === "regional-boundary" ? (
          <RegionalBoundaryTab />
        ) : typeSlug === "district-boundary" ? (
          <DistrictBoundaryTab />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle>Total Consumption</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{formatNumber(consumptionData?.totalKwh || 0)} kWh</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Active Meters</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{formatNumber(statusData?.active || 0)}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Total Meters</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{formatNumber(statusData?.total || 0)}</p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}
