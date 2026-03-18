"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Meter } from "@/lib/types/api"

interface MeterDetailsSidebarProps {
  meters: Meter[]
  groupName: string
  groupType: "BSP Station" | "Regional Boundary" | "District Boundary"
  onClose: () => void
}

export function MeterDetailsSidebar({ meters, groupName, groupType, onClose }: MeterDetailsSidebarProps) {
  return (
    <div className="absolute top-0 right-0 w-96 h-full bg-background border-l shadow-lg z-20 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b bg-muted/30 flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline" className="text-sm font-semibold">{groupType}</Badge>
            <Badge className="text-sm font-semibold">{meters.length} {meters.length === 1 ? 'meter' : 'meters'}</Badge>
          </div>
          <h3 className="font-bold text-2xl">{groupName}</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-background">
          <X className="h-6 w-6" />
        </Button>
      </div>

      {/* Meters List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {meters.map((meter) => (
            <div key={meter.meter_number} className="p-5 border-2 rounded-lg hover:border-primary/50 transition-all bg-card">
              <div className="flex items-start justify-between mb-4">
                <span className="font-mono text-xl font-bold text-foreground">{meter.meter_number}</span>
                <Badge variant={meter.status === "ONLINE" ? "default" : "destructive"} className="text-base font-semibold px-3 py-1.5">
                  {meter.status}
                </Badge>
              </div>

              <div className="space-y-3 text-lg">
                {meter.station && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground font-medium">Station:</span>
                    <span className="font-bold text-foreground">{meter.station}</span>
                  </div>
                )}

                {meter.region && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground font-medium">Region:</span>
                    <span className="font-bold text-foreground">{meter.region}</span>
                  </div>
                )}

                {meter.district && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground font-medium">District:</span>
                    <span className="font-bold text-foreground">{meter.district}</span>
                  </div>
                )}

                {meter.location && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground font-medium">Location:</span>
                    <span className="font-bold text-foreground text-right">{meter.location}</span>
                  </div>
                )}

                {meter.voltage_kv && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground font-medium">Voltage:</span>
                    <span className="font-bold text-foreground">{meter.voltage_kv} kV</span>
                  </div>
                )}

                {meter.from_region && meter.to_region && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground font-medium">Flow:</span>
                    <span className="font-bold text-foreground">
                      {meter.from_region} → {meter.to_region}
                    </span>
                  </div>
                )}

                {meter.boundary_metering_point && (
                  <div className="flex flex-col gap-1 py-1">
                    <span className="text-muted-foreground font-medium">Boundary Point:</span>
                    <span className="font-bold text-foreground break-words">{meter.boundary_metering_point}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
