"use client"

import { AppLayout } from "@/components/layout/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown } from "lucide-react"

export default function TrendsPage() {
  const trends = [
    { title: "User Growth", value: "+34.5%", direction: "up", description: "Month over month increase" },
    { title: "Revenue Growth", value: "+28.3%", direction: "up", description: "Quarter over quarter increase" },
    { title: "Bounce Rate", value: "-12.1%", direction: "up", description: "Improved user retention" },
    { title: "Session Duration", value: "+18.7%", direction: "up", description: "Better engagement" },
    { title: "Cart Abandonment", value: "-8.4%", direction: "up", description: "Fewer abandoned carts" },
    { title: "Support Tickets", value: "-15.2%", direction: "up", description: "Reduced customer issues" },
  ]

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">Trends Analysis</h2>
          <p className="text-muted-foreground mt-1">Track changes and patterns in your key metrics over time</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {trends.map((trend, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{trend.title}</CardTitle>
                {trend.direction === "up" ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${trend.direction === "up" ? "text-green-600" : "text-red-600"}`}>
                  {trend.value}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{trend.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Insights</CardTitle>
            <CardDescription>Key takeaways from your trending data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-l-4 border-primary pl-4">
                <p className="font-medium text-foreground">Strong user acquisition momentum</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your user base is growing at an accelerated rate, driven by improved marketing campaigns
                </p>
              </div>
              <div className="border-l-4 border-green-600 pl-4">
                <p className="font-medium text-foreground">Improved customer experience</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Reduced bounce rates and longer sessions indicate better user engagement
                </p>
              </div>
              <div className="border-l-4 border-blue-600 pl-4">
                <p className="font-medium text-foreground">Revenue growth outpacing costs</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Healthy revenue growth combined with operational improvements
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
