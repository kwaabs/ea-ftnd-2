"use client";

import { useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useAppStore } from "@/stores/app-store";
import { OverviewMainTabV3 } from "@/components/dashboard/overview-main-tab-v3";
import { TrendingUp, TrendingDown, Users, Activity } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { RegionalSummaryMarquee } from "@/components/dashboard/regional-summary-marquee";

export default function DashboardPage() {
  const { metrics, setMetrics, setLoading } = useDashboardStore();
  const { filters, applyFilters, clearFilters, clearNonDateFilters } =
    useAppStore();

  // Clear non-date filters when user leaves the page
  useEffect(() => {
    return () => {
      clearNonDateFilters();
    };
  }, [clearNonDateFilters]);

  const handleApplyFilters = (newFilters: any) => {
    applyFilters(newFilters);
  };

  const handleResetFilters = () => {
    clearFilters();
  };

  const { data: chartData, isLoading } = useQuery({
    queryKey: ["dashboard-data", filters],
    queryFn: async () => {
      console.log("[v0] Dashboard fetching with filters:", filters);
      // TODO: Replace with actual API endpoint when backend is ready
      // const response = await fetch('/api/dashboard/metrics', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ filters })
      // })
      // return response.json()

      // Mock data
      setLoading(false);
      const mockMetrics = {
        totalUsers: 12543,
        activeUsers: 8234,
        revenue: 456789,
        growth: 23.5,
      };
      setMetrics(mockMetrics);

      return {
        revenue: Array.from({ length: 7 }, (_, i) => ({
          date: `Day ${i + 1}`,
          value: Math.floor(Math.random() * 50000) + 20000,
        })),
        users: Array.from({ length: 7 }, (_, i) => ({
          date: `Day ${i + 1}`,
          value: Math.floor(Math.random() * 3000) + 1000,
        })),
      };
    },
  });

  const metricCards = [
    {
      title: "Total Consumption",
      value: metrics.totalUsers?.toLocaleString() || "0",
      unit: "kWh",
      icon: Activity,
      trend: "+12.5%",
      trendUp: true,
      description: "from last period",
    },
    {
      title: "Active Meters",
      value: metrics.activeUsers?.toLocaleString() || "0",
      icon: Users,
      trend: "+8.2%",
      trendUp: true,
      description: "online meters",
    },
    {
      title: "Import Energy",
      value: `${metrics.revenue?.toLocaleString() || "0"}`,
      unit: "kWh",
      icon: TrendingUp,
      trend: `+${metrics.growth?.toFixed(1)}%`,
      trendUp: true,
      description: "from last period",
    },
    {
      title: "Export Energy",
      value: "234,567",
      unit: "kWh",
      icon: TrendingDown,
      trend: "-3.1%",
      trendUp: false,
      description: "from last period",
    },
  ];

  // Helper to convert Date or string to YYYY-MM-DD format
  const formatDateToString = (
    date: Date | string | undefined,
    fallback: string,
  ): string => {
    if (!date) return fallback;
    if (date instanceof Date) {
      return date.toISOString().split("T")[0];
    }
    if (typeof date === "string") {
      return date.includes("T") ? date.split("T")[0] : date;
    }
    return fallback;
  };

  const defaultStart = new Date(new Date().setDate(new Date().getDate() - 30))
    .toISOString()
    .split("T")[0];
  const defaultEnd = new Date().toISOString().split("T")[0];

  const dateRange = {
    start: formatDateToString(filters.dateRange?.start, defaultStart),
    end: formatDateToString(filters.dateRange?.end, defaultEnd),
  };

  const componentFilters = {
    regions: filters.regions || [],
    districts: filters.districts || [],
    stations: filters.stations || [],
    boundaryMeteringPoints: filters.boundaryMeteringPoints || [],
    meterTypes: filters.meterTypes || [],
    voltages: (filters.voltageKvs || []).map((v: string) => Number.parseInt(v)),
    locations: filters.locations || [],
    feeders: filters.feeders || [],
  };

  return (
    <AppLayout>
      <div className="h-full min-h-0 flex flex-col gap-2.5 overflow-hidden">
        <div className="shrink-0 min-w-0">
          <h2 className="text-xl font-semibold tracking-tight text-foreground leading-tight">
            Dashboard Overview
          </h2>
          <p className="text-muted-foreground text-xs truncate">
            Consumption, sales, losses, and meter health at a glance
          </p>
        </div>

        <div className="shrink-0">
          <RegionalSummaryMarquee dateRange={dateRange} compact />
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <OverviewMainTabV3
            dateRange={dateRange}
            filters={componentFilters}
            compact
          />
        </div>
      </div>
    </AppLayout>
  );
}
