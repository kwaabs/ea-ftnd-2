"use client"

import { useMemo } from "react"

/** Case/whitespace-insensitive, and ignores a trailing "Region" word. */
export function normalizeRegionName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+region$/, "")
}

/**
 * The region-detail page's `region` comes from meter-infrastructure data
 * (BSP/DTX/boundary/geometry) via the regions list page. Zeus billing and
 * MMS each maintain their own independent regionname column, which is not
 * guaranteed to be the exact same string — typically just a trailing
 * "Region" (e.g. "Accra East" vs "Accra East Region") — an exact-match
 * filter against it can silently return nothing even though the region
 * genuinely has data.
 *
 * Resolves the page's region to whichever value in a data source's own
 * known region list it actually matches, so callers don't have to assume
 * the two naming conventions agree. Matches only after stripping that
 * specific "Region" suffix, not via a generic prefix match — Ghana has
 * real regions where one name is a genuine prefix of a different region
 * (Bono vs Bono East, Western vs Western North), so a broader startsWith()
 * would risk silently merging two distinct regions' data.
 */
export function useResolvedRegionName(
  pageRegion: string,
  knownNames: (string | null | undefined)[] | undefined,
): string {
  return useMemo(() => {
    const names = (knownNames || []).filter((n): n is string => Boolean(n && n.trim()))
    if (names.length === 0) return pageRegion

    const target = normalizeRegionName(pageRegion)
    const match = names.find((n) => normalizeRegionName(n) === target)
    return match ?? pageRegion
  }, [knownNames, pageRegion])
}
