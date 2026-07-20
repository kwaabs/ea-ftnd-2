"use client";

import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { useAppStore } from "@/stores/app-store";
import { CustomerSalesOverview } from "@/components/customer-sales/customer-sales-overview";
import { ArrowRight } from "lucide-react";

export default function CustomerSalesPage() {
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

  const sources = [
    {
      href: "/customer-sales/zeus",
      title: "Zeus — Postpaid",
      description: "Postpaid billing, consumption and balances",
      accent: "border-blue-200 bg-blue-50/60 text-blue-900",
      linkClass: "bg-blue-600 hover:bg-blue-700",
    },
    {
      href: "/customer-sales/mms",
      title: "MMS — Prepaid",
      description: "Prepaid sales and customer consumption",
      accent: "border-green-200 bg-green-50/60 text-green-900",
      linkClass: "bg-green-600 hover:bg-green-700",
    },
    {
      href: "/amr",
      title: "AMR Meters",
      description: "Daily AMR readings, health and SLT detail",
      accent: "border-orange-200 bg-orange-50/60 text-orange-900",
      linkClass: "bg-orange-600 hover:bg-orange-700",
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            Customer Consumption
          </h2>
          <p className="text-muted-foreground mt-1">
            Overview across Zeus (postpaid), MMS (prepaid), and AMR meters
          </p>
        </div>

        <CustomerSalesOverview dateRange={dateRange} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {sources.map((source) => (
            <div
              key={source.href}
              className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${source.accent}`}
            >
              <div>
                <p className="text-sm font-medium">{source.title}</p>
                <p className="text-xs opacity-80 mt-0.5">{source.description}</p>
              </div>
              <Link
                href={source.href}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white ${source.linkClass}`}
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
