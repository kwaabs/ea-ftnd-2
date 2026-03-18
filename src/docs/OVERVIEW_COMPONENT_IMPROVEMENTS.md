# Overview Component Data Fetching Improvements

## Current Status
Your `overview-main-tab-v2.tsx` component is **functional and complete** but uses a different hook pattern than the reference implementation.

## Recommended Improvements

### 1. Add Missing Hooks for Better Data Visualization

#### Add Grouped Consumption Aggregate
```typescript
// Add after existing useConsumptionAggregate call
const { data: categoryData, isLoading: categoryLoading } = useGroupedConsumptionAggregate({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    region: filters.regions?.[0], // Single value
    district: filters.districts?.[0],
    station: filters.stations?.[0],
    boundaryMeteringPoint: filters.boundaryMeteringPoints?.[0],
    meterType: filters.meterTypes?.[0],
    voltage_kv: filters.voltages?.[0],
    group: "meter_type", // Groups by meter type
})

const { data: regionData, isLoading: regionDataLoading } = useGroupedConsumptionAggregate({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    region: filters.regions?.[0],
    district: filters.districts?.[0],
    station: filters.stations?.[0],
    group: "meter_type,region", // Groups by both
})
```

**Benefit:** Better category and regional breakdowns for stacked charts

#### Add Consumption Breakdown
```typescript
const { data: meterTypeBreakdown, isLoading: meterTypeLoading } = useConsumptionBreakdown({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    regions: filters.regions,
    districts: filters.districts,
    stations: filters.stations,
    boundaryMeteringPoints: filters.boundaryMeteringPoints,
    meterTypes: filters.meterTypes,
    voltages: filters.voltages,
    group_by: "meter_type",
})

const { data: regionBreakdown, isLoading: regionLoading } = useConsumptionBreakdown({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    regions: filters.regions,
    districts: filters.districts,
    stations: filters.stations,
    group_by: "region",
    meter_type_view: true, // Shows meter types within regions
})
```

**Benefit:** Detailed breakdowns with proper meter type separation per region

#### Add Daily Consumption for Rankings
```typescript
const { data: meterRankings, isLoading: rankingsLoading } = useDailyConsumption({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    region: filters.regions?.[0],
    district: filters.districts?.[0],
    station: filters.stations?.[0],
    boundaryMeteringPoint: filters.boundaryMeteringPoints?.[0],
    meterType: filters.meterTypes?.[0],
    voltage_kv: filters.voltages?.[0],
})
```

**Benefit:** Consistent with backend API and provides both rankings + rawData for charts

#### Add Status Timeline
```typescript
const { data: statusTimelineData, isLoading: isLoadingTimeline } = useStatusTimeline({
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    regions: filters.regions,
    districts: filters.districts,
    stations: filters.stations,
    boundaryMeteringPoints: filters.boundaryMeteringPoints,
    meterTypes: filters.meterTypes,
    voltages: filters.voltages,
})
```

**Benefit:** Shows meter status trends over time for health monitoring

### 2. Adopt Dual Parameter Pattern

Create two parameter objects like the reference:

```typescript
// For hooks supporting arrays (multiple selections)
const params = {
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    regions: filters.regions && filters.regions.length > 0 ? filters.regions : undefined,
    districts: filters.districts && filters.districts.length > 0 ? filters.districts : undefined,
    stations: filters.stations && filters.stations.length > 0 ? filters.stations : undefined,
    boundaryMeteringPoints: filters.boundaryMeteringPoints && filters.boundaryMeteringPoints.length > 0 ? filters.boundaryMeteringPoints : undefined,
    meterTypes: filters.meterTypes && filters.meterTypes.length > 0 ? filters.meterTypes : undefined,
    voltages: filters.voltages && filters.voltages.length > 0 ? filters.voltages : undefined,
    feeders: filters.feeders && filters.feeders.length > 0 ? filters.feeders : undefined,
}

// For aggregate hooks needing single values
const aggregateParams = {
    dateFrom: dateRange.start,
    dateTo: dateRange.end,
    region: filters.regions && filters.regions.length > 0 ? filters.regions[0] : undefined,
    district: filters.districts && filters.districts.length > 0 ? filters.districts[0] : undefined,
    station: filters.stations && filters.stations.length > 0 ? filters.stations[0] : undefined,
    boundaryMeteringPoint: filters.boundaryMeteringPoints && filters.boundaryMeteringPoints.length > 0 ? filters.boundaryMeteringPoints[0] : undefined,
    meterType: filters.meterTypes && filters.meterTypes.length > 0 ? filters.meterTypes[0] : undefined,
    voltage_kv: filters.voltages && filters.voltages.length > 0 ? filters.voltages[0] : undefined,
}
```

**Usage:**
- `aggregateParams` → useConsumptionAggregate, useGroupedConsumptionAggregate, useDailyConsumption
- `params` → useConsumptionBreakdown, useMeterStatusSummary, useStatusTimeline, useMeterStatusDetails

### 3. Keep Your Unique Features

Your component has valuable additions not in the reference:
- ✅ `useTopBottomConsumers` - Keep for additional insights
- ✅ `useConsumptionTimeseriesIndividual` - Keep for individual meter trends
- ✅ `useRegionalBoundaryDaily` - Keep for boundary metering analysis
- ✅ `useMeterHealthSummary/Details` - Keep for enhanced health tracking

### 4. Data Processing Improvements

#### For Chart Data
The reference component has efficient data processing patterns:

```typescript
const chartData = useMemo(() => {
    if (!aggregateData?.rawData || aggregateData.rawData.length === 0) {
        return []
    }

    // Group by date first
    const dateMap = new Map<string, { date: string; import_kwh: number; export_kwh: number }>()

    aggregateData.rawData.forEach((item) => {
        const date = item.group_period.split("T")[0]
        
        if (!dateMap.has(date)) {
            dateMap.set(date, { date, import_kwh: 0, export_kwh: 0 })
        }

        const entry = dateMap.get(date)!
        
        if (item.system_name === "import_kwh") {
            entry.import_kwh += item.total_consumption
        } else if (item.system_name === "export_kwh") {
            entry.export_kwh += item.total_consumption
        }
    })

    // Convert to array and add calculated fields
    return Array.from(dateMap.values())
        .map((item) => ({
            ...item,
            net_kwh: item.import_kwh - item.export_kwh,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
}, [aggregateData])
```

**Apply this pattern to all your chart data processing for consistency**

### 5. Error Handling & Loading States

Add comprehensive error handling:

```typescript
const { data: aggregateData, isLoading: aggregateLoading, error: aggregateError } = useConsumptionAggregate(aggregateParams)

// In render
if (aggregateError) {
    return <ErrorDisplay message="Failed to load consumption data" />
}

if (aggregateLoading) {
    return <SkeletonLoader />
}
```

## Implementation Priority

### High Priority (Do First)
1. ✅ Add `useGroupedConsumptionAggregate` for better category charts
2. ✅ Add `useConsumptionBreakdown` for regional breakdowns
3. ✅ Adopt dual parameter pattern (params vs aggregateParams)

### Medium Priority
4. ✅ Add `useStatusTimeline` for health trends
5. ✅ Replace `useConsumptionMetersRanking` with `useDailyConsumption` for consistency
6. ✅ Improve error handling across all hooks

### Low Priority (Nice to Have)
7. ✅ Optimize data processing with better memoization
8. ✅ Add more granular loading states per section
9. ✅ Implement data caching strategies

## Conclusion

Your component is **production-ready** but can be enhanced by:
- Adding the missing hooks for richer visualizations
- Adopting the dual parameter pattern for API consistency
- Keeping your unique features that add value

The reference component and yours serve similar purposes but with different hook combinations. Both approaches work - the reference is more standardized while yours has additional health monitoring features.
