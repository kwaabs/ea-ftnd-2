"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { useAppStore } from "@/stores/app-store";
import { CustomerSalesOverview } from "@/components/customer-sales/customer-sales-overview";
import { ArrowRight } from "lucide-react";

export default function CustomerSalesPage() {
  const { filters: globalFilters, clearNonDateFilters } = useAppStore();

  // Region/district/etc. filters set on another page shouldn't carry over
  // here — only the date range should persist.
  useEffect(() => {
    clearNonDateFilters();
  }, [clearNonDateFilters]);

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

  const categories = [
    {
      href: "/customer-sales/postpaid",
      title: "Postpaid",
      description: "Zeus postpaid billing + daily AMR (SLT / NSLT)",
      accent: "border-blue-200 bg-blue-50/60 text-blue-900",
      linkClass: "bg-blue-600 hover:bg-blue-700",
    },
    {
      href: "/customer-sales/prepaid",
      title: "Prepaid",
      description: "Zeus prepaid accounts + MMS prepaid meters",
      accent: "border-emerald-200 bg-emerald-50/60 text-emerald-900",
      linkClass: "bg-emerald-600 hover:bg-emerald-700",
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            Customer Consumption (Sales)
          </h2>
          <p className="text-muted-foreground mt-1">
            Overview across Postpaid (Zeus: AMR + Non-AMR) and Prepaid (Zeus + MMS + Legacy)
          </p>
        </div>

        <CustomerSalesOverview dateRange={dateRange} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {categories.map((category) => (
            <div
              key={category.href}
              className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${category.accent}`}
            >
              <div>
                <p className="text-sm font-medium">{category.title}</p>
                <p className="text-xs opacity-80 mt-0.5">{category.description}</p>
              </div>
              <Link
                href={category.href}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white ${category.linkClass}`}
              >
                Open
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
