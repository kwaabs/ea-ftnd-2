"use client"

import { AppLayout } from "@/components/layout/app-layout"
import { PurchasesSalesReportView } from "@/components/reports/purchases-sales-report-view"

export default function ReportsPage() {
  return (
    <AppLayout>
      <PurchasesSalesReportView />
    </AppLayout>
  )
}
