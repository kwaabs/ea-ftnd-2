"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Home } from "lucide-react"
import { Fragment } from "react"

export function Breadcrumbs() {
  const pathname = usePathname()

  // Split path and filter empty strings
  const segments = pathname.split("/").filter(Boolean)

  // Build breadcrumb items
  const breadcrumbs = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/")
    // Decode URI component and format display name
    const label = decodeURIComponent(segment)
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")

    return { href, label }
  })

  return (
    <nav className="flex items-center space-x-2 text-sm">
      <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-gray-900 transition-colors">
        <Home className="h-4 w-4" />
      </Link>

      {breadcrumbs.map((crumb, index) => (
        <Fragment key={crumb.href}>
          <ChevronRight className="h-4 w-4 text-gray-400" />
          {index === breadcrumbs.length - 1 ? (
            <span className="font-medium text-gray-900">{crumb.label}</span>
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
