"use client"

import { useState } from "react"
import { Activity, MapPin } from "lucide-react"
import { ChoroplethMap } from "./choropleth-map"
import { MeterInformationalMap } from "./meter-informational-map"

export function MapCarousel() {
    const [currentView, setCurrentView] = useState<"consumption" | "informational">("informational")

    return (
        <div className="space-y-4">
            {/* Header with Tab Navigation */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-semibold tracking-tight text-foreground">Regional Energy Map</h2>
                    <p className="text-muted-foreground mt-1">
                        {currentView === "consumption"
                            ? "Visualize energy consumption patterns across regions"
                            : "Explore meter locations and infrastructure"}
                    </p>
                </div>

                {/* Tab Navigation on the Right */}
                <div className="flex gap-2">

                    <button
                        onClick={() => setCurrentView("informational")}
                        className={`flex items-center h-10 gap-2 px-4 py-2.5 rounded-lg border-2 transition-all ${
                            currentView === "informational"
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <MapPin className="h-4 w-4 flex-shrink-0"/>
                        <div className="font-medium text-sm">Infrastructure</div>
                    </button>

                    <button
                        onClick={() => setCurrentView("consumption")}
                        className={`flex items-center h-10 gap-2 px-4 py-2.5 rounded-lg border-2 transition-all ${
                            currentView === "consumption"
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <Activity className="h-4 w-4 flex-shrink-0"/>
                        <div className="font-medium text-sm">Consumption</div>
                    </button>

                </div>
            </div>

            {/* Map Views */}
            <div className="relative">
                {currentView === "informational" && <MeterInformationalMap/>}
                {currentView === "consumption" && <ChoroplethMap/>}
            </div>
        </div>
    )
}
