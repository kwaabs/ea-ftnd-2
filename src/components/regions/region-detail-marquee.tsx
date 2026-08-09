"use client"

import { useEffect, useMemo, useState } from "react"
import { Marquee, MarqueeItem } from "@/components/ui/marquee"
import { useZeusBillingAggregate } from "@/hooks/api/use-zeus-billing-aggregate-api"
import { useMmsCustomerSalesAggregate } from "@/hooks/api/use-mms-customer-sales-aggregate-api"
import { useAmrConsumptionAggregate } from "@/hooks/api/use-amr-consumption-aggregate-api"

/** Rotate sales (region + its districts) -> debt (region + its districts), two minutes each. */
const PHASE_MS = 2 * 60 * 1000

type Phase = "sales" | "debt"
const PHASES: Phase[] = ["sales", "debt"]
const PHASE_LABELS: Record<Phase, string> = {
  sales: "Customer sales",
  debt: "Debt",
}

interface RegionDetailMarqueeProps {
  region: string
  dateRange: { start: string; end: string }
}

function formatKwh(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} MWh`
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)} MWh`
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 0 })} kWh`
}

function formatMoney(value: number): string {
  return `₵${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function normalizeType(raw?: string | null): "Postpaid" | "Prepaid" | "Other" {
  const t = (raw || "").trim().toLowerCase()
  if (t === "postpaid") return "Postpaid"
  if (t === "prepaid") return "Prepaid"
  return "Other"
}

/**
 * Region-detail page ticker: cycles between customer sales (region total,
 * then each district) and debt (region total, then each district) — two
 * minutes each, within one continuous scroll per phase rather than as
 * separate region/district phases. Debt is Zeus-only (the only source that
 * carries debt/due/outstanding); sales combine Zeus + MMS (+ AMR for the
 * region total — AMR has no per-district breakdown available).
 */
export function RegionDetailMarquee({ region, dateRange }: RegionDetailMarqueeProps) {
  const [phaseIndex, setPhaseIndex] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % PHASES.length)
    }, PHASE_MS)
    return () => window.clearInterval(id)
  }, [])

  const phase = PHASES[phaseIndex]
  const params = { dateFrom: dateRange.start, dateTo: dateRange.end, region }

  const { data: zeusDistrictData, isLoading: zeusLoading } = useZeusBillingAggregate({
    ...params,
    groupBy: ["districtname", "metermodeltype"],
  })
  const { data: mmsDistrictData, isLoading: mmsLoading } = useMmsCustomerSalesAggregate({
    ...params,
    groupBy: "district",
  })
  const { data: amrData, isLoading: amrLoading } = useAmrConsumptionAggregate(params)

  const isLoading = zeusLoading || mmsLoading || amrLoading

  // Per-district sales (Zeus + MMS) and debt (Zeus only).
  const districtRows = useMemo(() => {
    const map = new Map<
      string,
      { district: string; postpaidKwh: number; prepaidKwh: number; debt: number }
    >()
    const ensure = (d: string) => {
      if (!map.has(d)) {
        map.set(d, { district: d, postpaidKwh: 0, prepaidKwh: 0, debt: 0 })
      }
      return map.get(d)!
    }

    ;(zeusDistrictData || []).forEach((item) => {
      const row = ensure(item.districtname || "Unknown")
      const type = normalizeType(item.metermodeltype)
      if (type === "Postpaid") row.postpaidKwh += item.sum_billconsumptionvalue || 0
      else if (type === "Prepaid") row.prepaidKwh += item.sum_billconsumptionvalue || 0
      row.debt += item.sum_debtamount || 0
    })
    ;(mmsDistrictData || []).forEach((item) => {
      ensure(item.district || "Unknown").prepaidKwh += item.sum_last_month_kwh_read || 0
    })

    return [...map.values()]
  }, [zeusDistrictData, mmsDistrictData])

  // Region totals — derived from the district rows (sum) plus AMR, which has
  // no district breakdown and only contributes at the region level.
  const regionSummary = useMemo(() => {
    let postpaidKwh = districtRows.reduce((s, r) => s + r.postpaidKwh, 0)
    const prepaidKwh = districtRows.reduce((s, r) => s + r.prepaidKwh, 0)
    const debt = districtRows.reduce((s, r) => s + r.debt, 0)
    ;(amrData || []).forEach((item) => {
      postpaidKwh += item.total_consumption || 0
    })
    return { postpaidKwh, prepaidKwh, totalKwh: postpaidKwh + prepaidKwh, debt }
  }, [districtRows, amrData])

  const districtSalesRows = useMemo(
    () =>
      [...districtRows].sort(
        (a, b) => b.postpaidKwh + b.prepaidKwh - (a.postpaidKwh + a.prepaidKwh),
      ),
    [districtRows],
  )
  const districtDebtRows = useMemo(
    () => [...districtRows].sort((a, b) => b.debt - a.debt),
    [districtRows],
  )

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/80 bg-card px-3 py-2 shadow-sm">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {PHASE_LABELS[phase]}
      </span>

      {isLoading ? (
        <Marquee key="loading" speed="slow" gap="medium" className="bg-transparent border-0 flex-1">
          <MarqueeItem className="text-sm font-medium text-muted-foreground">
            Loading {PHASE_LABELS[phase].toLowerCase()}…
          </MarqueeItem>
        </Marquee>
      ) : phase === "sales" ? (
        <Marquee key="sales" speed="slow" gap="medium" className="bg-transparent border-0 flex-1">
          <MarqueeItem className="text-sm font-medium text-foreground flex items-center gap-2">
            <span className="font-semibold text-foreground">{region} (Region):</span>
            <span className="text-blue-700 dark:text-blue-400">
              Postpaid {formatKwh(regionSummary.postpaidKwh)}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-emerald-700 dark:text-emerald-400">
              Prepaid {formatKwh(regionSummary.prepaidKwh)}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="font-semibold text-purple-700 dark:text-purple-400">
              Total {formatKwh(regionSummary.totalKwh)}
            </span>
          </MarqueeItem>
          {districtSalesRows.length === 0 ? (
            <MarqueeItem className="text-sm font-medium text-muted-foreground">
              No district sales data for this period.
            </MarqueeItem>
          ) : (
            districtSalesRows.map((row) => (
              <MarqueeItem
                key={row.district}
                className="text-sm font-medium text-foreground flex items-center gap-2"
              >
                <span className="font-semibold text-foreground">{row.district}:</span>
                <span className="text-blue-700 dark:text-blue-400">
                  Postpaid {formatKwh(row.postpaidKwh)}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-emerald-700 dark:text-emerald-400">
                  Prepaid {formatKwh(row.prepaidKwh)}
                </span>
              </MarqueeItem>
            ))
          )}
        </Marquee>
      ) : (
        <Marquee key="debt" speed="slow" gap="medium" className="bg-transparent border-0 flex-1">
          <MarqueeItem className="text-sm font-medium text-foreground flex items-center gap-2">
            <span className="font-semibold text-foreground">{region} (Region):</span>
            <span className="text-sky-700 dark:text-sky-400">
              Debt {formatMoney(regionSummary.debt)}
            </span>
          </MarqueeItem>
          {districtDebtRows.length === 0 ? (
            <MarqueeItem className="text-sm font-medium text-muted-foreground">
              No district debt data for this period.
            </MarqueeItem>
          ) : (
            districtDebtRows.map((row) => (
              <MarqueeItem
                key={row.district}
                className="text-sm font-medium text-foreground flex items-center gap-2"
              >
                <span className="font-semibold text-foreground">{row.district}:</span>
                <span className="text-sky-700 dark:text-sky-400">
                  Debt {formatMoney(row.debt)}
                </span>
              </MarqueeItem>
            ))
          )}
        </Marquee>
      )}
    </div>
  )
}
