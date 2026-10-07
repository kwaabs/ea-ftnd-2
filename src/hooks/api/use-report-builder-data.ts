"use client"

// Report Builder's single data-fetch entry point. Calls every underlying
// source's ALREADY-BUILT hook unconditionally (React's rules of hooks
// forbid calling a different, dynamically-chosen set of hooks per
// render), each gated by its own `enabled: dataSource === "<key>"` --
// only the one a block actually selected ever fires a network request,
// the rest sit idle at near-zero cost (no remount/key gymnastics needed
// when a block's source changes). Normalizes whichever one is active
// into one common shape so a single generic chart/table/KPI renderer
// (block-renderer.tsx) never needs to know which domain it's looking at.
import { useMemo } from "react"
import type { DataSourceKey } from "@/lib/report-builder/data-sources"
import { useZeusBillingAggregate } from "@/hooks/api/use-zeus-billing-aggregate-api"
import { useMmsCustomerSalesAggregate } from "@/hooks/api/use-mms-customer-sales-aggregate-api"
import { useBotConsumptionAggregate } from "@/hooks/api/use-bot-consumption-api"
import { useBxcConsumptionAggregate } from "@/hooks/api/use-bxc-consumption-api"
import { useHolleyConsumptionAggregate } from "@/hooks/api/use-holley-consumption-api"
import { useEcash4ConsumptionAggregate } from "@/hooks/api/use-ecash4-consumption-api"
import { usePnsConsumptionAggregate } from "@/hooks/api/use-pns-consumption-api"
import { useAlphaConsumptionAggregate } from "@/hooks/api/use-alpha-consumption-api"
import { useBspAggregate } from "@/hooks/api/use-bsp-api"
import { useMeterStatusSummary, useMeterHealthSummary } from "@/hooks/api/use-meter-status-api"

export interface ReportBuilderFilters {
  dateFrom: string
  dateTo: string
  region?: string
  district?: string
}

export interface NormalizedRow {
  label: string
  value: number
  secondary?: number
}

export interface BlockKpi {
  numerator: number
  denominator: number
  pct: number
  extraLabel?: string
}

export interface BlockData {
  rows: NormalizedRow[]
  kpi?: BlockKpi
  isLoading: boolean
  isError: boolean
}

const EMPTY: BlockData = { rows: [], isLoading: false, isError: false }

export function useReportBuilderData(
  dataSource: DataSourceKey,
  filters: ReportBuilderFilters,
  groupBy: string | undefined,
): BlockData {
  const hasRange = Boolean(filters.dateFrom && filters.dateTo)
  const common = { dateFrom: filters.dateFrom, dateTo: filters.dateTo, region: filters.region, district: filters.district }

  const zeusAll = useZeusBillingAggregate({
    ...common,
    groupBy: (groupBy as never) || "metermodeltype",
    enabled: hasRange && dataSource === "zeus-all",
  } as never)
  const zeusPostpaid = useZeusBillingAggregate({
    ...common,
    meterModelType: "Postpaid",
    groupBy: (groupBy as never) || "regionname",
    enabled: hasRange && dataSource === "zeus-postpaid",
  } as never)
  const zeusAmr = useZeusBillingAggregate({
    ...common,
    meterModelType: "AMR",
    groupBy: (groupBy as never) || "regionname",
    enabled: hasRange && dataSource === "zeus-amr",
  } as never)
  const zeusPrepaid = useZeusBillingAggregate({
    ...common,
    meterModelType: "Prepaid",
    excludeMmsDuplicates: true,
    groupBy: (groupBy as never) || "regionname",
    enabled: hasRange && dataSource === "zeus-prepaid",
  } as never)
  const streetlighting = useZeusBillingAggregate({
    ...common,
    tariffClassCode: "E03",
    groupBy: (groupBy as never) || "regionname",
    enabled: hasRange && dataSource === "streetlighting",
  } as never)
  const mms = useMmsCustomerSalesAggregate({
    ...common,
    groupBy: (groupBy as never) || "region",
    enabled: hasRange && dataSource === "mms",
  } as never)
  const bot = useBotConsumptionAggregate({
    ...common,
    groupBy: (groupBy as never) || "region",
    enabled: hasRange && dataSource === "bot",
  } as never)
  const bxc = useBxcConsumptionAggregate({
    ...common,
    groupBy: (groupBy as never) || "region",
    enabled: hasRange && dataSource === "bxc",
  } as never)
  const holley = useHolleyConsumptionAggregate({
    ...common,
    groupBy: (groupBy as never) || "region",
    enabled: hasRange && dataSource === "holley",
  } as never)
  const ecash4 = useEcash4ConsumptionAggregate({
    ...common,
    groupBy: (groupBy as never) || "region",
    enabled: hasRange && dataSource === "ecash4",
  } as never)
  const pns = usePnsConsumptionAggregate({
    ...common,
    groupBy: (groupBy as never) || "region",
    enabled: hasRange && dataSource === "pns",
  } as never)
  const alpha = useAlphaConsumptionAggregate({
    ...common,
    groupBy: (groupBy as never) || "substation",
    enabled: hasRange && dataSource === "alpha",
  })
  const bspPurchases = useBspAggregate({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    meterType: ["BSP"],
  })
  const bspStatus = useMeterStatusSummary({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    meterTypes: ["BSP"],
  })
  const meterHealth = useMeterHealthSummary({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  })

  return useMemo<BlockData>(() => {
    switch (dataSource) {
      case "zeus-all":
        return zeusAggregateToBlockData(zeusAll.data, zeusAll.isLoading, zeusAll.isError, groupBy || "metermodeltype")
      case "zeus-postpaid":
        return zeusAggregateToBlockData(zeusPostpaid.data, zeusPostpaid.isLoading, zeusPostpaid.isError, groupBy || "regionname")
      case "zeus-amr":
        return zeusAggregateToBlockData(zeusAmr.data, zeusAmr.isLoading, zeusAmr.isError, groupBy || "regionname")
      case "zeus-prepaid":
        return zeusAggregateToBlockData(zeusPrepaid.data, zeusPrepaid.isLoading, zeusPrepaid.isError, groupBy || "regionname")
      case "streetlighting":
        return zeusAggregateToBlockData(streetlighting.data, streetlighting.isLoading, streetlighting.isError, groupBy || "regionname")
      case "mms":
        if (dataSource !== "mms") return EMPTY
        return {
          rows: (mms.data || []).map((r) => ({
            label: pickLabel(r as unknown as Record<string, unknown>, groupBy || "region") || "Unknown",
            value: r.sum_last_month_kwh_read || 0,
            secondary: r.customer_count || 0,
          })),
          isLoading: mms.isLoading,
          isError: mms.isError,
        }
      case "bot":
        return simpleAggregateToBlockData(bot.data, bot.isLoading, bot.isError, groupBy || "region")
      case "bxc":
        return simpleAggregateToBlockData(bxc.data, bxc.isLoading, bxc.isError, groupBy || "region")
      case "holley":
        return {
          rows: (holley.data || []).map((r) => ({
            label: pickLabel(r as unknown as Record<string, unknown>, groupBy || "region") || "Unknown",
            value: r.sum_kwh || 0,
            secondary: r.customer_count || 0,
          })),
          isLoading: holley.isLoading,
          isError: holley.isError,
        }
      case "ecash4":
        return simpleAggregateToBlockData(ecash4.data, ecash4.isLoading, ecash4.isError, groupBy || "region")
      case "pns": {
        const rows = (pns.data || []).map((r) => ({
          label: pickLabel(r as unknown as Record<string, unknown>, groupBy || "region") || "Unknown",
          value: r.sum_energy_kwh || 0,
          secondary: r.customer_count || 0,
        }))
        return { rows, isLoading: pns.isLoading, isError: pns.isError }
      }
      case "alpha": {
        const rows = (alpha.data || []).map((r) => ({
          label: pickLabel(r as unknown as Record<string, unknown>, groupBy || "substation") || "Unknown",
          value: r.sum_value || 0,
          secondary: r.consumer_count || 0,
        }))
        return { rows, isLoading: alpha.isLoading, isError: alpha.isError }
      }
      case "bsp-purchases": {
        // Same client-side rollup as use-purchases-sales-report.ts's
        // fetchBspPurchasesByRegionMonth and the dashboard's energyPurchases
        // calc -- the BSP endpoint always returns rows grouped by
        // (meter_type, region, station), never a single caller-chosen
        // dimension, so picking one of those two is done here, not server-side.
        const dim = (groupBy || "region") as "region" | "station"
        const totals = new Map<string, number>()
        for (const row of bspPurchases.data?.rawData || []) {
          if (row.meter_type !== "BSP" || row.system_name !== "import_kwh") continue
          const key = (dim === "station" ? row.station : row.region) || "Unknown"
          totals.set(key, (totals.get(key) || 0) + (row.total_consumption || 0))
        }
        return {
          rows: Array.from(totals.entries()).map(([label, value]) => ({ label, value })),
          isLoading: bspPurchases.isLoading,
          isError: bspPurchases.isError,
        }
      }
      case "bsp-status": {
        if (!bspStatus.data) return { rows: [], isLoading: bspStatus.isLoading, isError: bspStatus.isError }
        const s = bspStatus.data
        return {
          rows: [],
          kpi: { numerator: s.online, denominator: s.total, pct: s.online_percentage, extraLabel: `${s.total_offline} offline` },
          isLoading: bspStatus.isLoading,
          isError: bspStatus.isError,
        }
      }
      case "meter-health": {
        const byType = meterHealth.data?.data?.by_meter_type || []
        return {
          rows: byType.map((t) => ({ label: t.meter_type, value: t.avg_uptime || 0, secondary: t.total })),
          isLoading: meterHealth.isLoading,
          isError: meterHealth.isError,
        }
      }
      default:
        return EMPTY
    }
  }, [
    dataSource,
    groupBy,
    zeusAll.data,
    zeusAll.isLoading,
    zeusAll.isError,
    zeusPostpaid.data,
    zeusPostpaid.isLoading,
    zeusPostpaid.isError,
    zeusAmr.data,
    zeusAmr.isLoading,
    zeusAmr.isError,
    zeusPrepaid.data,
    zeusPrepaid.isLoading,
    zeusPrepaid.isError,
    streetlighting.data,
    streetlighting.isLoading,
    streetlighting.isError,
    mms.data,
    mms.isLoading,
    mms.isError,
    bot.data,
    bot.isLoading,
    bot.isError,
    bxc.data,
    bxc.isLoading,
    bxc.isError,
    holley.data,
    holley.isLoading,
    holley.isError,
    ecash4.data,
    ecash4.isLoading,
    ecash4.isError,
    pns.data,
    pns.isLoading,
    pns.isError,
    alpha.data,
    alpha.isLoading,
    alpha.isError,
    bspPurchases.data,
    bspPurchases.isLoading,
    bspPurchases.isError,
    bspStatus.data,
    bspStatus.isLoading,
    bspStatus.isError,
    meterHealth.data,
    meterHealth.isLoading,
    meterHealth.isError,
  ])
}

// pickLabel reads a dimension value off an aggregate row by whichever
// groupBy key is active, tolerating the handful of different property
// names each domain uses for the "same" dimension (region vs regionname,
// bill_month vs billingmonth, etc).
function pickLabel(row: Record<string, unknown>, groupBy: string): string {
  const v = row[groupBy]
  if (v === null || v === undefined) return ""
  return String(v)
}

function simpleAggregateToBlockData(
  data: { region?: string | null; district?: string | null; tariff?: string | null; bill_month?: string | null; customer_count: number; sum_kwh: number }[] | undefined,
  isLoading: boolean,
  isError: boolean,
  groupBy: string,
): BlockData {
  return {
    rows: (data || []).map((r) => ({
      label: pickLabel(r as unknown as Record<string, unknown>, groupBy) || "Unknown",
      value: r.sum_kwh || 0,
      secondary: r.customer_count || 0,
    })),
    isLoading,
    isError,
  }
}

function zeusAggregateToBlockData(
  data: { customer_count: number; sum_billconsumptionvalue: number }[] | undefined,
  isLoading: boolean,
  isError: boolean,
  groupBy: string,
): BlockData {
  return {
    rows: (data || []).map((r) => ({
      label: pickLabel(r as unknown as Record<string, unknown>, groupBy) || "Unknown",
      value: r.sum_billconsumptionvalue || 0,
      secondary: r.customer_count || 0,
    })),
    isLoading,
    isError,
  }
}
