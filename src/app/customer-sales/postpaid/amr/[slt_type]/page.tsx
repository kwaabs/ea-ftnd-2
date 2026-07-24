"use client"

import { useParams } from "next/navigation"
import { AppLayout } from "@/components/layout/app-layout"
import { AmrSltTypePageView } from "@/components/customer-sales/amr-slt-type-page-view"

export default function PostpaidAmrSltTypePage() {
  const params = useParams()
  const sltType = decodeURIComponent(String(params.slt_type || ""))

  return (
    <AppLayout>
      <AmrSltTypePageView sltType={sltType} />
    </AppLayout>
  )
}
