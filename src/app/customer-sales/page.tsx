// "use client"

// import { AppLayout } from "@/components/layout/app-layout"
// import { useAppStore } from "@/stores/app-store"
// import { CustomerSalesOverview } from "@/components/customer-sales/customer-sales-overview"
// import { CustomerSalesDetail } from "@/components/customer-sales/customer-sales-detail"
// import { MmsCustomerSalesDetail } from "@/components/customer-sales/mms-customer-sales-detail"
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// export default function CustomerSalesPage() {
//   const { filters: globalFilters } = useAppStore()

//   const formatDateToString = (date: Date | string | undefined, fallback: string): string => {
//     if (!date) return fallback
//     if (date instanceof Date) return date.toISOString().split("T")[0]
//     if (typeof date === "string") return date.includes("T") ? date.split("T")[0] : date
//     return fallback
//   }

//   const defaultStart = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0]
//   const defaultEnd = new Date().toISOString().split("T")[0]

//   const dateRange = {
//     start: formatDateToString(globalFilters.dateRange?.start, defaultStart),
//     end: formatDateToString(globalFilters.dateRange?.end, defaultEnd),
//   }

//   return (
//     <AppLayout>
//       <div className="space-y-6">
//         <div>
//           <h2 className="text-3xl font-semibold tracking-tight text-foreground">Customer Sales</h2>
//           <p className="text-muted-foreground mt-1">Customer consumption, billing and balance analysis — postpaid (Zeus) and prepaid (MMS)</p>
//         </div>

//         <CustomerSalesOverview dateRange={dateRange} />

//         {/* Detail Records — tabbed by source */}
//         <Tabs defaultValue="zeus">
//           <TabsList className="grid w-full grid-cols-2 max-w-sm">
//             <TabsTrigger value="zeus" className="data-[state=active]:text-blue-700">
//               Zeus — Postpaid
//             </TabsTrigger>
//             <TabsTrigger value="mms" className="data-[state=active]:text-green-700">
//               MMS — Prepaid
//             </TabsTrigger>
//           </TabsList>
//           <TabsContent value="zeus" className="mt-4">
//             <CustomerSalesDetail dateRange={dateRange} />
//           </TabsContent>
//           <TabsContent value="mms" className="mt-4">
//             <MmsCustomerSalesDetail dateRange={dateRange} />
//           </TabsContent>
//         </Tabs>
//       </div>
//     </AppLayout>
//   )
// }

"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { useAppStore } from "@/stores/app-store";
import { CustomerSalesOverview } from "@/components/customer-sales/customer-sales-overview";
import { CustomerSalesDetail } from "@/components/customer-sales/customer-sales-detail";
import { MmsCustomerSalesDetail } from "@/components/customer-sales/mms-customer-sales-detail";
import { AmrCustomerSalesDetail } from "@/components/customer-sales/amr-customer-sales-detail";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            Customer Sales
          </h2>
          <p className="text-muted-foreground mt-1">
            Customer consumption, billing and balance analysis — Zeus
            (postpaid), MMS (prepaid), and AMR (daily meters)
          </p>
        </div>

        <CustomerSalesOverview dateRange={dateRange} />

        {/* Detail Records — tabbed by source */}
        <Tabs defaultValue="zeus">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger
              value="zeus"
              className="data-[state=active]:text-blue-700"
            >
              Zeus — Postpaid
            </TabsTrigger>
            <TabsTrigger
              value="mms"
              className="data-[state=active]:text-green-700"
            >
              MMS — Prepaid
            </TabsTrigger>
            <TabsTrigger
              value="amr"
              className="data-[state=active]:text-orange-700"
            >
              AMR — Daily
            </TabsTrigger>
          </TabsList>
          <TabsContent value="zeus" className="mt-4">
            <CustomerSalesDetail dateRange={dateRange} />
          </TabsContent>
          <TabsContent value="mms" className="mt-4">
            <MmsCustomerSalesDetail dateRange={dateRange} />
          </TabsContent>
          <TabsContent value="amr" className="mt-4">
            <AmrCustomerSalesDetail dateRange={dateRange} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
