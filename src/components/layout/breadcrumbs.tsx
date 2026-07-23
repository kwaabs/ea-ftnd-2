"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { Fragment } from "react"

/** Intermediate path segments that have no index page — link back to the parent hub. */
const BREADCRUMB_HREF_OVERRIDES: Record<string, string> = {
  "/customer-sales/service-point": "/customer-sales",
  "/customer-sales/account": "/customer-sales",
}

export function Breadcrumbs() {
  const pathname = usePathname()

  // Split path and filter empty strings
  const segments = pathname.split("/").filter(Boolean)

  // Build breadcrumb items
  const breadcrumbs = segments.map((segment, index) => {
    const hrefPath = "/" + segments.slice(0, index + 1).join("/")
    const href = BREADCRUMB_HREF_OVERRIDES[hrefPath] ?? hrefPath
    // Decode URI component and format display name
    const label = decodeURIComponent(segment)
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")

    return { href, label }
  })

  if (breadcrumbs.length === 0) return null

  return (
    <nav className="flex items-center space-x-2.5 text-base">
      {breadcrumbs.map((crumb, index) => (
        <Fragment key={`${crumb.href}-${index}`}>
          {index > 0 && <ChevronRight className="h-5 w-5 text-gray-400 shrink-0" />}
          {index === breadcrumbs.length - 1 ? (
            <span className="font-semibold text-gray-900">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="text-gray-600 hover:text-gray-900 transition-colors">
              {crumb.label}
            </Link>
          )}
        </Fragment>
      ))}
    </nav>
  )
}
