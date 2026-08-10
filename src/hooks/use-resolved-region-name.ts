"use client"

import { useMemo } from "react"

/**
 * The region-detail page's `region` comes from meter-infrastructure data
 * (BSP/DTX/boundary/geometry) via the regions list page. Zeus billing and
 * MMS each maintain their own independent regionname column, which is not
 * guaranteed to be the exact same string (e.g. a "Region" suffix, casing,
 * or an entirely different label) — an exact-match filter against it can
 * silently return nothing even though the region genuinely has data.
 *
 * Resolves the page's region to whichever value in a data source's own
 * known region list it actually matches, so callers don't have to assume
 * the two naming conventions agree.
 */
export function useResolvedRegionName(
  pageRegion: string,
  knownNames: (string | null | undefined)[] | undefined,
): string {
  return useMemo(() => {
    const names = (knownNames || []).filter((n): n is string => Boolean(n && n.trim()))
    if (names.length === 0) return pageRegion

    const target = pageRegion.trim().toLowerCase()

    const exact = names.find((n) => n.trim().toLowerCase() === target)
    if (exact) return exact

    // Real name carries an extra word our side doesn't (e.g. "X Region").
    const prefixMatch = names.find((n) => n.trim().toLowerCase().startsWith(target))
    if (prefixMatch) return prefixMatch

    // Our side carries an extra word the real name doesn't.
    const reverseMatch = names.find((n) => target.startsWith(n.trim().toLowerCase()))
    if (reverseMatch) return reverseMatch

    return pageRegion
  }, [knownNames, pageRegion])
}
