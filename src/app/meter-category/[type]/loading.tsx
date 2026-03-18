import { AppLayout } from "@/components/layout/app-layout"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function MeterCategoryLoading() {
  return (
    <AppLayout>
      <div className="space-y-6 animate-pulse">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-28" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-36 mb-2" />
                <div className="h-3 bg-muted rounded w-24" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="h-5 bg-muted rounded w-44" />
            </CardHeader>
            <CardContent>
              <div className="h-[350px] bg-muted rounded" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="h-5 bg-muted rounded w-40" />
            </CardHeader>
            <CardContent>
              <div className="h-[350px] bg-muted rounded" />
            </CardContent>
          </Card>
        </div>

        {/* Breakdown Table */}
        <Card>
          <CardHeader>
            <div className="h-5 bg-muted rounded w-52" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded" />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Meter Details */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="h-5 bg-muted rounded w-48" />
            <div className="h-9 bg-muted rounded w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-14 bg-muted rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
