"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { Fragment, useMemo } from "react"
import { useAppStore } from "@/stores/app-store"

/** Intermediate path segments that have no index page — link back to the parent hub. */
const BREADCRUMB_HREF_OVERRIDES: Record<string, string> = {
  "/customer-sales/service-point": "/customer-sales",
  "/customer-sales/account": "/customer-sales",
}

const BREADCRUMB_LABEL_OVERRIDES: Record<string, string> = {
  "customer-sales": "Customer Consumption",
  amr: "AMR",
  postpaid: "Postpaid",
  prepaid: "Prepaid",
}

function formatMeterType(text: string) {
  if (text === "BSP") return "BSP Incomer"
  if (text === "DTX") return "Distribution Transformer"
  if (text === "REGIONAL_BOUNDARY") return "Regional Boundary"
  if (text === "DISTRICT_BOUNDARY") return "District Boundary"
  return text.replace(/_/g, " ")
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const { filters } = useAppStore()

  // Split path and filter empty strings
  const segments = pathname.split("/").filter(Boolean)

  // Build breadcrumb items
  const breadcrumbs = segments.map((segment, index) => {
    const hrefPath = "/" + segments.slice(0, index + 1).join("/")
    const href = BREADCRUMB_HREF_OVERRIDES[hrefPath] ?? hrefPath
    // Decode URI component and format display name
    const label =
      BREADCRUMB_LABEL_OVERRIDES[segment] ??
      decodeURIComponent(segment)
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")

    return { href, label }
  })

  const activeFilterLabels = useMemo(() => {
    const parts: string[] = []
    if (filters.regions?.length) parts.push(...filters.regions)
    if (filters.districts?.length) parts.push(...filters.districts)
    if (filters.stations?.length) parts.push(...filters.stations)
    if (filters.locations?.length) parts.push(...filters.locations)
    if (filters.boundaryMeteringPoints?.length) {
      parts.push(...filters.boundaryMeteringPoints)
    }
    if (filters.meterTypes?.length) {
      parts.push(...filters.meterTypes.map(formatMeterType))
    }
    if (filters.voltages?.length) {
      parts.push(...filters.voltages.map((v) => `${v} kV`))
    }
    return parts
  }, [
    filters.regions,
    filters.districts,
    filters.stations,
    filters.locations,
    filters.boundaryMeteringPoints,
    filters.meterTypes,
    filters.voltages,
  ])

  if (breadcrumbs.length === 0) return null

  return (
    <nav className="flex items-center gap-2.5 text-base min-w-0">
      <div className="flex items-center space-x-2.5 min-w-0 flex-wrap">
        {breadcrumbs.map((crumb, index) => (
          <Fragment key={`${crumb.href}-${index}`}>
            {index > 0 && (
              <ChevronRight className="h-5 w-5 text-gray-400 shrink-0" />
            )}
            {index === breadcrumbs.length - 1 ? (
              <span className="font-semibold text-gray-900 truncate">
                {crumb.label}
                {activeFilterLabels.length > 0 && (
                  <span className="font-normal text-muted-foreground">
                    {` (Filters: ${activeFilterLabels.join(", ")})`}
                  </span>
                )}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-gray-600 hover:text-gray-900 transition-colors shrink-0"
              >
                {crumb.label}
              </Link>
            )}
          </Fragment>
        ))}
      </div>
    </nav>
  )
}
