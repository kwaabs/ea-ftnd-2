import { AppLayout } from "@/components/layout/app-layout"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function DashboardLoading() {
  return (
    <AppLayout>
      <div className="space-y-6 animate-pulse">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-24" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-32 mb-2" />
                <div className="h-3 bg-muted rounded w-20" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="h-5 bg-muted rounded w-40" />
            </CardHeader>
            <CardContent>
              <div className="h-[300px] bg-muted rounded" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="h-5 bg-muted rounded w-40" />
            </CardHeader>
            <CardContent>
              <div className="h-[300px] bg-muted rounded" />
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <div className="h-5 bg-muted rounded w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
