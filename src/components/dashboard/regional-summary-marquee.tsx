"use client";

import { useMemo, useState } from "react";
import { Megaphone, Plus, Trash2, Loader2 } from "lucide-react";
import { Marquee, MarqueeItem } from "@/components/ui/marquee";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAllRegionsGeometry } from "@/hooks/api/use-regions-geometry-api";
import { useBspAggregate } from "@/hooks/api/use-bsp-api";
import { useRegionalBoundaryAggregate } from "@/hooks/api/use-regional-boundary-api";
import { useExpressFeederAggregate } from "@/hooks/api/use-express-feeder-api";
import { useCustomerConsumptionAggregate } from "@/hooks/api/use-customer-consumption-aggregate-api";
import { useMmsCustomerSalesAggregate } from "@/hooks/api/use-mms-customer-sales-aggregate-api";
import { useAmrConsumptionAggregate } from "@/hooks/api/use-amr-consumption-aggregate-api";
import {
  useAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
} from "@/hooks/api/use-announcements-api";
import { useUserStore } from "@/stores/user-store";
import { NOTIFY_EMAILS } from "@/lib/notify-config";

interface RegionalSummaryMarqueeProps {
  dateRange: { start: string; end: string };
  /** Tighter chrome for no-scroll dashboard layouts */
  compact?: boolean;
}

function formatKwh(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function lossSeverityStyles(hasSalesData: boolean, lossPct: number | null) {
  const severity =
    !hasSalesData || lossPct === null
      ? "muted"
      : lossPct < 10
        ? "good"
        : lossPct < 25
          ? "warn"
          : "bad";

  return {
    dotColor:
      severity === "good"
        ? "bg-green-500"
        : severity === "warn"
          ? "bg-amber-500"
          : severity === "bad"
            ? "bg-red-500"
            : "bg-slate-400",
    lossTextColor:
      severity === "good"
        ? "text-green-700 dark:text-green-400"
        : severity === "warn"
          ? "text-amber-700 dark:text-amber-400"
          : severity === "bad"
            ? "text-red-600"
            : "text-slate-500",
  };
}

/**
 * Loss ticker — global organization first, then per-region:
 *   Global:  purchases (BSP import) − sales (Zeus + MMS + AMR)
 *   Region:  availableSupply = BSP + boundaryNet + expressNet
 *            loss            = availableSupply − sales
 *
 * Also scrolls shared announcements. Posting/removing is limited to emails in
 * NOTIFY_EMAILS (enforced on the API as well).
 */
export function RegionalSummaryMarquee({
  dateRange,
  compact = false,
}: RegionalSummaryMarqueeProps) {
  const dateFrom = dateRange.start;
  const dateTo = dateRange.end;

  const { user } = useUserStore();
  const userEmail = (user?.email || user?.username || "").toLowerCase();
  const canManageAnnouncements = NOTIFY_EMAILS.map((e) => e.toLowerCase()).includes(userEmail);

  const [composeOpen, setComposeOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { announcements, mutate: mutateAnnouncements } = useAnnouncements({
    refreshInterval: 30_000,
  });

  const { data: geometryData } = useAllRegionsGeometry();
  const { data: bspData, isLoading: isLoadingBsp } = useBspAggregate({ dateFrom, dateTo });
  const { data: boundaryData, isLoading: isLoadingBoundary } = useRegionalBoundaryAggregate({
    dateFrom,
    dateTo,
  });
  const { data: expressFeederData, isLoading: isLoadingExpress } = useExpressFeederAggregate({
    dateFrom,
    dateTo,
  });
  const { data: zeusData, isLoading: isLoadingZeus } = useCustomerConsumptionAggregate({
    dateFrom,
    dateTo,
  });
  const { data: mmsData, isLoading: isLoadingMms } = useMmsCustomerSalesAggregate({
    dateFrom,
    dateTo,
    groupBy: "region",
  });
  const { data: amrData, isLoading: isLoadingAmr } = useAmrConsumptionAggregate({
    dateFrom,
    dateTo,
  });

  const isLoadingGlobal =
    isLoadingBsp || isLoadingZeus || isLoadingMms || isLoadingAmr;
  const isLoadingRegional =
    isLoadingBoundary || isLoadingExpress || isLoadingGlobal;

  /** National totals — same basis as dashboard Purchases / Sales / Losses cards */
  const globalSummary = useMemo(() => {
    const purchases = bspData?.totalSupplyKwh ?? 0;
    const zeusKwh = (zeusData ?? []).reduce(
      (sum, z) => sum + (z.sum_lastbillconsumption ?? 0),
      0,
    );
    const mmsKwh = (mmsData ?? []).reduce(
      (sum, m) => sum + (m.sum_last_month_kwh_read ?? 0),
      0,
    );
    const amrKwh = (amrData ?? []).reduce(
      (sum, a) => sum + (a.total_consumption ?? 0),
      0,
    );
    const sales = zeusKwh + mmsKwh + amrKwh;
    const hasSalesData = sales > 0;
    const loss = hasSalesData && purchases > 0 ? purchases - sales : null;
    const lossPct =
      hasSalesData && purchases > 0 && loss !== null
        ? (loss / purchases) * 100
        : null;

    return { purchases, sales, loss, lossPct, hasSalesData };
  }, [bspData, zeusData, mmsData, amrData]);

  const regionSummaries = useMemo(() => {
    const regionNames = (geometryData?.data?.regions ?? []).map((r) => r.region);
    if (regionNames.length === 0) return [];

    const getBspImport = (regionName: string): number => {
      const match = bspData?.byRegion?.find(
        (r) => r.region.toLowerCase() === regionName.toLowerCase(),
      );
      return match?.supplyKwh ?? 0;
    };

    const getBoundaryNet = (regionName: string): number => {
      if (!boundaryData?.byBoundaryPoint) return 0;
      const lower = regionName.toLowerCase();
      let totalImport = 0;
      let totalExport = 0;

      for (const bp of boundaryData.byBoundaryPoint) {
        const parts = bp.boundaryPoint.split("/").map((p) => p.trim());
        if (parts.length !== 2) continue;

        const [leftRegion, rightRegion] = parts;
        const isLeft = leftRegion.toLowerCase() === lower;
        const isRight = rightRegion.toLowerCase() === lower;
        if (!isLeft && !isRight) continue;

        if (isLeft) {
          totalImport += bp.exportKwh ?? 0;
          totalExport += bp.importKwh ?? 0;
        } else {
          totalImport += bp.importKwh ?? 0;
          totalExport += bp.exportKwh ?? 0;
        }
      }

      return totalImport - totalExport;
    };

    const getExpressNet = (regionName: string): number => {
      const feeders = expressFeederData?.feederBreakdown;
      if (!feeders || feeders.length === 0) return 0;

      const regionUpper = regionName.trim().toUpperCase();
      const norm = (r?: string | null) => (r || "").trim().toUpperCase();

      let inboundImport = 0;
      let outboundExport = 0;

      for (const f of feeders) {
        const sendingHere = norm(f.sendingMeter?.region) === regionUpper;
        const receivingHere = norm(f.receivingMeter?.region) === regionUpper;
        if (!sendingHere && !receivingHere) continue;

        if (receivingHere) {
          inboundImport += f.receivingMeter?.importKwh || 0;
        }
        if (sendingHere) {
          outboundExport += f.sendingMeter?.exportKwh || 0;
        }
      }

      return inboundImport - outboundExport;
    };

    const getZeusKwh = (regionName: string): number => {
      const match = zeusData?.find(
        (z) => (z.regionname || "").toLowerCase() === regionName.toLowerCase(),
      );
      return match?.sum_lastbillconsumption ?? 0;
    };

    const getMmsKwh = (regionName: string): number => {
      const match = mmsData?.find(
        (m) => (m.region || "").toLowerCase() === regionName.toLowerCase(),
      );
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
      const bspImport = getBspImport(region);
      const boundaryNet = getBoundaryNet(region);
      const expressNet = getExpressNet(region);
      const availableSupply = bspImport + boundaryNet + expressNet;
      const sales = getZeusKwh(region) + getMmsKwh(region) + getAmrKwh(region);
      // Loss is only meaningful when sales data exists; otherwise supply − 0 is nonsense.
      const hasSalesData = sales > 0;
      const loss = hasSalesData ? availableSupply - sales : null;
      const lossPct =
        hasSalesData && availableSupply > 0 && loss !== null
          ? (loss / availableSupply) * 100
          : null;

      return { region, availableSupply, sales, loss, lossPct, hasSalesData };
    });
  }, [geometryData, bspData, boundaryData, expressFeederData, zeusData, mmsData, amrData]);

  const globalStyles = lossSeverityStyles(
    globalSummary.hasSalesData,
    globalSummary.lossPct,
  );

  const handlePost = async () => {
    if (!userEmail || !draft.trim()) return;
    setSubmitting(true);
    setComposeError(null);
    try {
      await createAnnouncement({
        body: draft.trim(),
        author_email: userEmail,
        author_name: user?.name || user?.username,
      });
      setDraft("");
      setComposeOpen(false);
      await mutateAnnouncements();
    } catch (err) {
      setComposeError(err instanceof Error ? err.message : "Failed to post announcement");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!userEmail) return;
    setDeletingId(id);
    try {
      await deleteAnnouncement(id, userEmail);
      await mutateAnnouncements();
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className={
        compact
          ? "flex items-center gap-2.5 rounded-lg border border-border/80 bg-card px-3 py-2 shadow-sm"
          : "space-y-2"
      }
    >
      {canManageAnnouncements && (
        <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={compact ? "h-8 text-xs px-2.5 shrink-0" : "h-7 text-xs"}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Announce
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Post announcement</DialogTitle>
              <DialogDescription>
                Visible to everyone on the dashboard marquee. Only notify-list users can post.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. BSP data for Accra East will be late today…"
              rows={4}
              maxLength={500}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{draft.length}/500</span>
              {composeError && <span className="text-red-600">{composeError}</span>}
            </div>

            {announcements.length > 0 && (
              <div className="border-t pt-3 space-y-2 max-h-40 overflow-y-auto">
                <p className="text-xs font-medium text-muted-foreground">Active announcements</p>
                {announcements.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start justify-between gap-2 text-xs rounded-md bg-muted/50 px-2 py-1.5"
                  >
                    <span className="line-clamp-2">{a.body}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-red-600"
                      disabled={deletingId === a.id}
                      onClick={() => handleDelete(a.id)}
                      title="Remove announcement"
                    >
                      {deletingId === a.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                onClick={handlePost}
                disabled={submitting || !draft.trim()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Posting…
                  </>
                ) : (
                  "Post"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <div className="min-w-0 flex-1">
      {isLoadingGlobal && isLoadingRegional ? (
        <Marquee
          speed="normal"
          gap="medium"
          className={compact ? "bg-transparent border-0" : undefined}
        >
          <MarqueeItem
            className={
              compact
                ? "text-base font-medium text-muted-foreground"
                : "text-sm font-medium text-muted-foreground"
            }
          >
            Loading organization purchases, sales, and loss figures…
          </MarqueeItem>
        </Marquee>
      ) : (
        <Marquee
          speed="normal"
          gap="medium"
          className={compact ? "bg-transparent border-0" : undefined}
        >
          {announcements.map((a) => (
            <MarqueeItem
              key={a.id}
              className={
                compact
                  ? "text-base font-medium text-amber-900 dark:text-amber-100 flex items-center gap-2"
                  : "text-sm font-medium text-amber-900 dark:text-amber-100 flex items-center gap-2"
              }
            >
              <Megaphone className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="font-semibold text-amber-700 dark:text-amber-300">Announcement:</span>
              <span>{a.body}</span>
              {(a.author_name || a.author_email) && (
                <span className="text-muted-foreground text-sm">
                  — {a.author_name || a.author_email}
                </span>
              )}
            </MarqueeItem>
          ))}

          {/* Global organization — Purchases − Sales (same as dashboard KPI cards) */}
          {!isLoadingGlobal && (
            <MarqueeItem
              key="__global__"
              className={
                compact
                  ? "text-base font-medium text-foreground flex items-center gap-2"
                  : "text-sm font-medium text-foreground flex items-center gap-2"
              }
            >
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${globalStyles.dotColor}`} />
              <span className="font-semibold text-foreground">ECG Global:</span>
              <span className="text-emerald-700 dark:text-emerald-400">
                Purchases {formatKwh(globalSummary.purchases)} kWh
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-blue-700 dark:text-blue-400">
                Sales{" "}
                {globalSummary.hasSalesData
                  ? `${formatKwh(globalSummary.sales)} kWh`
                  : "—"}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className={globalStyles.lossTextColor}>
                {globalSummary.hasSalesData && globalSummary.loss !== null
                  ? `Loss ${formatKwh(globalSummary.loss)} kWh${
                      globalSummary.lossPct !== null
                        ? ` (${globalSummary.lossPct.toFixed(1)}%)`
                        : ""
                    }`
                  : "Loss — (no sales data)"}
              </span>
            </MarqueeItem>
          )}

          {isLoadingRegional || regionSummaries.length === 0 ? (
            <MarqueeItem
              className={
                compact
                  ? "text-base font-medium text-muted-foreground"
                  : "text-sm font-medium text-muted-foreground"
              }
            >
              Loading regional available supply…
            </MarqueeItem>
          ) : (
            regionSummaries.map(({ region, availableSupply, sales, loss, lossPct, hasSalesData }) => {
              const { dotColor, lossTextColor } = lossSeverityStyles(
                hasSalesData,
                lossPct,
              );

              return (
                <MarqueeItem
                  key={region}
                  className={
                    compact
                      ? "text-base font-medium text-foreground flex items-center gap-2"
                      : "text-sm font-medium text-foreground flex items-center gap-2"
                  }
                >
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotColor}`} />
                  <span className="font-semibold text-foreground">{region}:</span>
                  <span className="text-emerald-700 dark:text-emerald-400">
                    Available Supply {formatKwh(availableSupply)} kWh
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-blue-700 dark:text-blue-400">
                    Sales {hasSalesData ? `${formatKwh(sales)} kWh` : "—"}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className={lossTextColor}>
                    {hasSalesData && loss !== null
                      ? `Loss ${formatKwh(loss)} kWh${
                          lossPct !== null ? ` (${lossPct.toFixed(1)}%)` : ""
                        }`
                      : "Loss — (no sales data)"}
                  </span>
                </MarqueeItem>
              );
            })
          )}
        </Marquee>
      )}
      </div>
    </div>
  );
}
