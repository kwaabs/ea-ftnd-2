"use client"

import { Monitor, X } from "lucide-react"
import { useState } from "react"

export function DesktopWarningBanner() {
  const [isDismissed, setIsDismissed] = useState(false)

  if (isDismissed) return null

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-amber-500/95 backdrop-blur-sm text-amber-950 px-4 py-3 shadow-lg">
      <div className="flex items-center gap-3">
        <Monitor className="h-5 w-5 flex-shrink-0" />
        <p className="text-sm font-medium flex-1">
          This application is optimized for desktop viewing. Some features may not work properly on smaller screens.
        </p>
        <button
          onClick={() => setIsDismissed(true)}
          className="flex-shrink-0 p-1 hover:bg-amber-600/20 rounded transition-colors"
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
