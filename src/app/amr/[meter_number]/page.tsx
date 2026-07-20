"use client";

import { useParams } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { AmrMeterDetailView } from "@/components/amr/amr-meter-detail-view";

export default function AmrMeterDetailPage() {
  const params = useParams();
  const meterNumber = decodeURIComponent(
    String(params.meter_number || ""),
  );

  return (
    <AppLayout>
      <AmrMeterDetailView meterNumber={meterNumber} />
    </AppLayout>
  );
}
