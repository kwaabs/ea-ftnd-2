"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { AmrPageView } from "@/components/amr/amr-page-view";
import { useAppStore } from "@/stores/app-store";

export default function AmrPage() {
  const { filters: globalFilters } = useAppStore();

  const formatDateToString = (
    date: Date | string | undefined,
    fallback: string,
  ): string => {
    if (!date) return fallback;
    if (date instanceof Date) return date.toISOString().split("T")[0];
    if (typeof date === "string")
      return date.includes("T") ? date.split("T")[0] : date;
    return fallback;
  };

  const defaultStart = new Date(new Date().setDate(new Date().getDate() - 30))
    .toISOString()
    .split("T")[0];
  const defaultEnd = new Date().toISOString().split("T")[0];

  const dateRange = {
    start: formatDateToString(globalFilters.dateRange?.start, defaultStart),
    end: formatDateToString(globalFilters.dateRange?.end, defaultEnd),
  };

  const region =
    globalFilters.regions?.length > 0
      ? globalFilters.regions.join(",")
      : undefined;
  const district =
    globalFilters.districts?.length > 0
      ? globalFilters.districts.join(",")
      : undefined;

  return (
    <AppLayout>
      <AmrPageView
        dateRange={dateRange}
        region={region}
        district={district}
      />
    </AppLayout>
  );
}
