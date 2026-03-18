"use client"

import { AppLayout } from "@/components/layout/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, FileText } from "lucide-react"

export default function ReportsPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">Reports</h2>
          <p className="text-muted-foreground mt-1">Generate and download detailed analytics reports</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {[
            { title: "Monthly Revenue Report", description: "Detailed breakdown of revenue by source and category" },
            { title: "User Activity Report", description: "Comprehensive user behavior and engagement analysis" },
            { title: "Conversion Funnel Report", description: "Step-by-step conversion analysis and drop-off points" },
            { title: "Performance Summary", description: "Executive summary of all key performance indicators" },
          ].map((report, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <FileText className="h-8 w-8 text-primary" />
                  <Button size="sm" variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
                <CardTitle className="mt-4">{report.title}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Last generated: 2 days ago</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
