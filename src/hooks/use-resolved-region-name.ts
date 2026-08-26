"use client"

import { useMemo } from "react"

/**
 * Case/whitespace-insensitive, and ignores a trailing "Region" or
 * "District" word — this same helper resolves both region names (e.g.
 * region-detail.tsx) and district names (district-detail.tsx) against
 * Zeus/MMS's own naming, so it has to strip either administrative-unit
 * qualifier, not just "Region". Confirmed from real matched-meter data
 * this session: Zeus's districtname carries a "District" suffix
 * ("Cape Coast District", "Nsawam District") that MMS's district column
 * doesn't ("CapeCoast", "Nsawam") — the same mismatch pattern as regions,
 * just never extended here until district-detail.tsx's Customer Sales
 * section came back all zeros because of it.
 */
export function normalizeRegionName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+(region|district)$/, "")
}

/**
 * Short display form of a region/district name — same trailing
 * "Region"/"District" strip as normalizeRegionName, but case-preserving
 * (for showing to a user, not for matching). "Accra East Region" and
 * "Accra East" both display as "Accra East"; "Nsawam District" and
 * "Nsawam" both display as "Nsawam".
 */
export function shortRegionLabel(name: string): string {
  return name.trim().replace(/\s+(region|district)$/i, "")
}

/**
 * The region/district-detail pages' `region`/`district` prop comes from
 * meter-infrastructure data (BSP/DTX/boundary/geometry) via the
 * regions/districts list pages. Zeus billing and MMS each maintain their
 * own independent regionname/districtname columns, which aren't
 * guaranteed to be the exact same string as that — typically just a
 * trailing "Region" or "District" qualifier (e.g. "Accra East" vs
 * "Accra East Region", "Nsawam" vs "Nsawam District") — an exact-match
 * filter against it can silently return nothing even though the
 * region/district genuinely has data.
 *
 * Resolves the page's region/district to whichever value in a data
 * source's own known list it actually matches, so callers don't have to
 * assume the two naming conventions agree. Matches only after stripping
 * that specific "Region"/"District" suffix, not via a generic prefix
 * match — Ghana has real regions where one name is a genuine prefix of a
 * different region (Bono vs Bono East, Western vs Western North), so a
 * broader startsWith() would risk silently merging two distinct
 * regions'/districts' data.
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
