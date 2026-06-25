"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFilterOptionsWithAvailability } from "@/hooks/api/use-filter-options"
import { X } from "lucide-react"

interface CustomerSalesHeaderProps {
    filters: {
        region?: string
        district?: string
        serviceType?: string
        serviceClass?: string
        customerType?: string
        accountType?: string
    }
    onFiltersChange: (filters: any) => void
}

export function CustomerSalesHeader({ filters, onFiltersChange }: CustomerSalesHeaderProps) {
    const { data: filterOptions } = useFilterOptionsWithAvailability()

    const serviceTypes = ["Residential", "Commercial", "Industrial", "Public Institutions"] // Add actual options
    const serviceClasses = ["LV", "MV", "HV"] // Add actual options from API
    const customerTypes = ["Individual", "Corporate", "Government"] // Add actual options
    const accountTypes = ["Prepaid", "Postpaid"] // Add actual options

    const handleFilterChange = (key: string, value: string) => {
        onFiltersChange({
            ...filters,
            [key]: value === "all" ? undefined : value,
        })
    }

    const hasActiveFilters = Object.values(filters).some(v => v !== undefined)

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Filters</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-2 block">Region</label>
                        <Select value={filters.region || "all"} onValueChange={(v) => handleFilterChange("region", v)}>
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="All Regions" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Regions</SelectItem>
                                {(filterOptions?.all?.regions || []).map((region) => (
                                    <SelectItem key={region} value={region}>
                                        {region}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-2 block">District</label>
                        <Select value={filters.district || "all"} onValueChange={(v) => handleFilterChange("district", v)}>
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="All Districts" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Districts</SelectItem>
                                {(filterOptions?.all?.districts || []).map((district) => (
                                    <SelectItem key={district} value={district}>
                                        {district}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-2 block">Service Type</label>
                        <Select value={filters.serviceType || "all"} onValueChange={(v) => handleFilterChange("serviceType", v)}>
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="All Types" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                {serviceTypes.map((type) => (
                                    <SelectItem key={type} value={type}>
                                        {type}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-2 block">Customer Type</label>
                        <Select value={filters.customerType || "all"} onValueChange={(v) => handleFilterChange("customerType", v)}>
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                {customerTypes.map((type) => (
                                    <SelectItem key={type} value={type}>
                                        {type}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-2 block">Account Type</label>
                        <Select value={filters.accountType || "all"} onValueChange={(v) => handleFilterChange("accountType", v)}>
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                {accountTypes.map((type) => (
                                    <SelectItem key={type} value={type}>
                                        {type}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {hasActiveFilters && (
                        <div className="flex items-end">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-full"
                                onClick={() => onFiltersChange({
                                    region: undefined,
                                    district: undefined,
                                    serviceType: undefined,
                                    serviceClass: undefined,
                                    customerType: undefined,
                                    accountType: undefined,
                                })}
                            >
                                <X className="h-3 w-3 mr-1" />
                                Clear
                            </Button>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
