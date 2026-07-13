"use client";

import { useMemo } from "react";
import { Marquee, MarqueeItem } from "@/components/ui/marquee";
import { useAllRegionsGeometry } from "@/hooks/api/use-regions-geometry-api";
import { useBspAggregate } from "@/hooks/api/use-bsp-api";
import { useRegionalBoundaryAggregate } from "@/hooks/api/use-regional-boundary-api";
import { useCustomerConsumptionAggregate } from "@/hooks/api/use-customer-consumption-aggregate-api";
import { useMmsCustomerSalesAggregate } from "@/hooks/api/use-mms-customer-sales-aggregate-api";
import { useAmrConsumptionAggregate } from "@/hooks/api/use-amr-consumption-aggregate-api";

interface RegionalSummaryMarqueeProps {
  dateRange: { start: string; end: string };
}

function formatKwh(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// Same purchase/sales/loss methodology as the consumption map's Loss metric
// (internal/components/map/choropleth-map.tsx) — purchase = BSP import +
// regional boundary import into the region; sales = Zeus + MMS + AMR billed
// consumption; loss = purchase − sales. Kept as a separate, self-contained
// component rather than sharing a hook with the map, since the map's getters
// are tightly coupled to its click-handling/color-scale logic.
export function RegionalSummaryMarquee({ dateRange }: RegionalSummaryMarqueeProps) {
  const dateFrom = dateRange.start;
  const dateTo = dateRange.end;

  const { data: geometryData } = useAllRegionsGeometry();
  const { data: bspData, isLoading: isLoadingBsp } = useBspAggregate({ dateFrom, dateTo });
  const { data: boundaryData, isLoading: isLoadingBoundary } = useRegionalBoundaryAggregate({ dateFrom, dateTo });
  const { data: zeusData, isLoading: isLoadingZeus } = useCustomerConsumptionAggregate({ dateFrom, dateTo });
  const { data: mmsData, isLoading: isLoadingMms } = useMmsCustomerSalesAggregate({
    dateFrom,
    dateTo,
    groupBy: "region",
  });
  const { data: amrData, isLoading: isLoadingAmr } = useAmrConsumptionAggregate({ dateFrom, dateTo });

  const isLoading = isLoadingBsp || isLoadingBoundary || isLoadingZeus || isLoadingMms || isLoadingAmr;

  const regionSummaries = useMemo(() => {
    const regionNames = (geometryData?.data?.regions ?? []).map((r) => r.region);
    if (regionNames.length === 0) return [];

    const getBspImport = (regionName: string): number => {
      const match = bspData?.byRegion?.find((r) => r.region.toLowerCase() === regionName.toLowerCase());
      return match?.supplyKwh ?? 0;
    };

    const getBoundaryImport = (regionName: string): number => {
      if (!boundaryData?.byBoundaryPoint) return 0;
      const lower = regionName.toLowerCase();
      return boundaryData.byBoundaryPoint
        .filter((b) => b.boundaryPoint.toLowerCase().includes(lower))
        .reduce((sum, b) => sum + (b.importKwh ?? 0), 0);
    };

    const getZeusKwh = (regionName: string): number => {
      const match = zeusData?.find((z) => (z.regionname || "").toLowerCase() === regionName.toLowerCase());
      return match?.sum_lastbillconsumption ?? 0;
    };

    const getMmsKwh = (regionName: string): number => {
      const match = mmsData?.find((m) => (m.region || "").toLowerCase() === regionName.toLowerCase());
      return match?.sum_last_month_kwh_read ?? 0;
    };

    const getAmrKwh = (regionName: string): number => {
      if (!amrData) return 0;
      const lower = regionName.toLowerCase();
      return amrData
        .filter((a) => (a.region || "").toLowerCase() === lower)
        .reduce((sum, a) => sum + (a.total_consumption ?? 0), 0);
    };

    return regionNames.map((region) => {
      const purchase = getBspImport(region) + getBoundaryImport(region);
      const sales = getZeusKwh(region) + getMmsKwh(region) + getAmrKwh(region);
      const loss = purchase - sales;
      const lossPct = purchase > 0 ? (loss / purchase) * 100 : null;
      const hasSalesData = sales > 0;

      return { region, purchase, sales, loss, lossPct, hasSalesData };
    });
  }, [geometryData, bspData, boundaryData, zeusData, mmsData, amrData]);

  if (isLoading || regionSummaries.length === 0) {
    return (
      <Marquee speed="normal" gap="medium">
        <MarqueeItem className="text-sm font-medium text-muted-foreground">
          Loading regional purchase, sales, and loss figures…
        </MarqueeItem>
      </Marquee>
    );
  }

  return (
    <Marquee speed="normal" gap="medium">
      {regionSummaries.map(({ region, purchase, sales, loss, lossPct, hasSalesData }) => {
        const dotColor =
          !hasSalesData ? "bg-slate-400" : lossPct === null ? "bg-slate-400" : lossPct < 10 ? "bg-green-500" : lossPct < 25 ? "bg-amber-500" : "bg-red-500";

        return (
          <MarqueeItem
            key={region}
            className="text-sm font-medium text-foreground flex items-center gap-2"
          >
            <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`}></span>
            <span className="font-semibold">{region}:</span>
            <span>Purchase {formatKwh(purchase)} kWh</span>
            <span className="text-muted-foreground">·</span>
            <span>Sales {formatKwh(sales)} kWh</span>
            <span className="text-muted-foreground">·</span>
            <span className={loss >= 0 ? "text-red-600" : "text-blue-600"}>
              Loss {formatKwh(loss)} kWh{hasSalesData && lossPct !== null ? ` (${lossPct.toFixed(1)}%)` : " (no sales data)"}
            </span>
          </MarqueeItem>
        );
      })}
    </Marquee>
  );
}
