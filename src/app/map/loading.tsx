import { AppLayout } from "@/components/layout/app-layout"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function MapLoading() {
  return (
    <AppLayout>
      <div className="space-y-4 p-6">
        {/* Map Controls Skeleton */}
        <Card>
          <CardHeader>
            <div className="h-6 w-48 bg-muted animate-pulse rounded" />
          </CardHeader>
          <CardContent className="flex gap-6">
            <div className="h-5 w-24 bg-muted animate-pulse rounded" />
            <div className="h-5 w-32 bg-muted animate-pulse rounded" />
            <div className="h-5 w-28 bg-muted animate-pulse rounded" />
            <div className="h-5 w-36 bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>

        {/* Map Container Skeleton */}
        <Card>
          <CardContent className="p-0">
            <div className="h-[600px] w-full bg-muted animate-pulse rounded-lg flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">Loading map...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
