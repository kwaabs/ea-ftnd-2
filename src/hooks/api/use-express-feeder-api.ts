import { useQuery } from "@tanstack/react-query"
import { formatApiDate } from "@/lib/utils"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8780"

export interface ExpressFeederParams {
    dateFrom: string
    dateTo: string
    regions?: string[]
    districts?: string[]
    stations?: string[]
    boundaryMeteringPoints?: string[]
    voltages?: string[]
}

// ---------------------------------------------------------------------------
// New aggregate response shape (one record per feeder per group_period day)
// ---------------------------------------------------------------------------
export interface ExpressFeederAggregateRecord {
    group_period: string
    feeder_name: string
    sap_version: string
    meter_type: string
    sending_station: string
    sending_type_of_station: string
    sending_code: string
    sending_region: string
    sending_district: string
    sending_meter_number: string
    receiving_station: string
    receiving_type_of_station: string
    receiving_code: string
    receiving_region: string
    receiving_meter_number: string
    sending_meter: {
        import_kwh: number
        export_kwh: number
        net_kwh: number
    }
    receiving_meter: {
        import_kwh: number
        export_kwh: number
        net_kwh: number
    }
}

// ---------------------------------------------------------------------------
// New daily response shape (one record per feeder per consumption_date)
// ---------------------------------------------------------------------------
export interface ExpressFeederDailyRecord {
    consumption_date: string
    feeder_name: string
    sap_version: string
    sending_meter: {
        meter_number: string
        meter_type: string
        multiply_factor: string
        voltage_kv: string
        import_kwh: number
        export_kwh: number
        net_kwh: number
        station: string
        type_of_station: string
        code: string
        region: string
        district: string
    }
    receiving_meter: {
        meter_number: string
        meter_type: string
        multiply_factor: string
        voltage_kv: string
        import_kwh: number
        export_kwh: number
        net_kwh: number
        station: string
        type_of_station: string
        code: string
        region: string
        district: string
    }
}

function buildQueryString(params: ExpressFeederParams): string {
    const queryParams = new URLSearchParams()

    queryParams.append("dateFrom", formatApiDate(params.dateFrom))
    queryParams.append("dateTo", formatApiDate(params.dateTo))

    if (params.regions && params.regions.length > 0) {
        queryParams.append("region", params.regions.join(","))
    }
    if (params.districts && params.districts.length > 0) {
        queryParams.append("district", params.districts.join(","))
    }
    if (params.stations && params.stations.length > 0) {
        queryParams.append("station", params.stations.join(","))
    }
    if (params.boundaryMeteringPoints && params.boundaryMeteringPoints.length > 0) {
        queryParams.append("boundaryMeteringPoint", params.boundaryMeteringPoints.join(","))
    }
    if (params.voltages && params.voltages.length > 0) {
        queryParams.append("voltage_kv", params.voltages.join(","))
    }

    return queryParams.toString()
}

export function useExpressFeederDaily(params: ExpressFeederParams) {
    return useQuery({
        queryKey: ["express-feeder-daily", params],
        queryFn: async () => {
            const queryString = buildQueryString(params)
            const url = `${API_BASE_URL}/api/v1/meters/consumption/daily/express-feeder?${queryString}`
            const response = await fetch(url)
            if (!response.ok) throw new Error("Failed to fetch Express Feeder daily data")
            const data: ExpressFeederDailyRecord[] = await response.json()
            return data
        },
        enabled: !!params.dateFrom && !!params.dateTo,
    })
}

// ---------------------------------------------------------------------------
// Derived types used throughout the app
// ---------------------------------------------------------------------------

export interface FeederMeter {
    sapVersion: string
    meterNumber: string
    role: "sending" | "receiving"
    station: string
    stationType: string
    stationCode: string
    region: string
    district: string
    importKwh: number
    exportKwh: number
    netKwh: number
}

export interface FeederDetail {
    feederName: string
    sapVersion: string
    isCrossRegion: boolean
    /** Combined import across both meters */
    totalImport: number
    /** Combined export across both meters */
    totalExport: number
    /** Net = totalImport - totalExport */
    netKwh: number
    sendingMeter: FeederMeter
    receivingMeter: FeederMeter
}

export interface ExpressFeederAggregateResult {
    totalImportKwh: number
    totalExportKwh: number
    netKwh: number
    uniqueFeederCount: number
    rawData: ExpressFeederAggregateRecord[]
    feederBreakdown: FeederDetail[]
    sendingStationBreakdown: {
        station: string
        region: string
        district: string
        import: number
        export: number
        net: number
        feederCount: number
    }[]
    receivingStationBreakdown: {
        station: string
        region: string
        type: string
        import: number
        export: number
        net: number
        feederCount: number
    }[]
}

export function useExpressFeederAggregate(params: ExpressFeederParams) {
    return useQuery({
        queryKey: ["express-feeder-aggregate", params],
        queryFn: async () => {
            const queryString = buildQueryString(params)
            const url = `${API_BASE_URL}/api/v1/meters/consumption/aggregate/express-feeder?${queryString}`
            const response = await fetch(url)
            if (!response.ok) throw new Error("Failed to fetch Express Feeder aggregate data")
            const data: ExpressFeederAggregateRecord[] = await response.json()

            // ---------------------------------------------------------------------------
            // Group daily rows by feeder_name and sum up both meters across all periods.
            // Each row = one feeder for one group_period day.
            // ---------------------------------------------------------------------------
            const byFeeder = new Map<
                string,
                {
                    records: ExpressFeederAggregateRecord[]
                    sendingImport: number
                    sendingExport: number
                    receivingImport: number
                    receivingExport: number
                }
            >()

            for (const record of data) {
                const key = record.feeder_name || record.sap_version
                if (!byFeeder.has(key)) {
                    byFeeder.set(key, {
                        records: [],
                        sendingImport: 0,
                        sendingExport: 0,
                        receivingImport: 0,
                        receivingExport: 0,
                    })
                }
                const entry = byFeeder.get(key)!
                entry.records.push(record)
                entry.sendingImport += record.sending_meter.import_kwh
                entry.sendingExport += record.sending_meter.export_kwh
                entry.receivingImport += record.receiving_meter.import_kwh
                entry.receivingExport += record.receiving_meter.export_kwh
            }

            // ---------------------------------------------------------------------------
            // Build FeederDetail for each unique feeder
            // ---------------------------------------------------------------------------
            const feederBreakdown: FeederDetail[] = []

            byFeeder.forEach((entry, feederName) => {
                const ref = entry.records[0]

                const sendingMeter: FeederMeter = {
                    sapVersion: ref.sap_version,
                    meterNumber: ref.sending_meter_number,
                    role: "sending",
                    station: ref.sending_station,
                    stationType: ref.sending_type_of_station,
                    stationCode: ref.sending_code,
                    region: ref.sending_region,
                    district: ref.sending_district,
                    importKwh: entry.sendingImport,
                    exportKwh: entry.sendingExport,
                    netKwh: entry.sendingImport - entry.sendingExport,
                }

                const receivingMeter: FeederMeter = {
                    // receiving has same sap_version root but different meter number
                    sapVersion: ref.sap_version,
                    meterNumber: ref.receiving_meter_number,
                    role: "receiving",
                    station: ref.receiving_station,
                    stationType: ref.receiving_type_of_station,
                    stationCode: ref.receiving_code,
                    region: ref.receiving_region,
                    district: "",
                    importKwh: entry.receivingImport,
                    exportKwh: entry.receivingExport,
                    netKwh: entry.receivingImport - entry.receivingExport,
                }

                const totalImport = entry.sendingImport + entry.receivingImport
                const totalExport = entry.sendingExport + entry.receivingExport

                feederBreakdown.push({
                    feederName,
                    sapVersion: ref.sap_version,
                    isCrossRegion: ref.sending_region !== ref.receiving_region,
                    totalImport,
                    totalExport,
                    netKwh: totalImport - totalExport,
                    sendingMeter,
                    receivingMeter,
                })
            })

            feederBreakdown.sort((a, b) =>
                (b.sendingMeter.exportKwh + b.receivingMeter.importKwh) -
                (a.sendingMeter.exportKwh + a.receivingMeter.importKwh)
            )

            // ---------------------------------------------------------------------------
            // Global totals across all feeders
            // ---------------------------------------------------------------------------
            const totalImportKwh = feederBreakdown.reduce((s, f) => s + f.totalImport, 0)
            const totalExportKwh = feederBreakdown.reduce((s, f) => s + f.totalExport, 0)

            // ---------------------------------------------------------------------------
            // Sending station breakdown
            // ---------------------------------------------------------------------------
            const sendingMap = new Map<
                string,
                ExpressFeederAggregateResult["sendingStationBreakdown"][0] & { feederNames: Set<string> }
            >()
            for (const f of feederBreakdown) {
                const key = f.sendingMeter.station
                if (!sendingMap.has(key)) {
                    sendingMap.set(key, {
                        station: f.sendingMeter.station,
                        region: f.sendingMeter.region,
                        district: f.sendingMeter.district,
                        import: 0,
                        export: 0,
                        net: 0,
                        feederCount: 0,
                        feederNames: new Set(),
                    })
                }
                const entry = sendingMap.get(key)!
                entry.import += f.sendingMeter.importKwh
                entry.export += f.sendingMeter.exportKwh
                entry.net = entry.import - entry.export
                entry.feederNames.add(f.feederName)
            }
            const sendingStationBreakdown = Array.from(sendingMap.values())
                .map(({ feederNames, ...rest }) => ({ ...rest, feederCount: feederNames.size }))
                .sort((a, b) => b.export - a.export)

            // ---------------------------------------------------------------------------
            // Receiving station breakdown
            // ---------------------------------------------------------------------------
            const receivingMap = new Map<
                string,
                ExpressFeederAggregateResult["receivingStationBreakdown"][0] & { feederNames: Set<string> }
            >()
            for (const f of feederBreakdown) {
                const key = f.receivingMeter.station
                if (!key) continue
                if (!receivingMap.has(key)) {
                    receivingMap.set(key, {
                        station: f.receivingMeter.station,
                        region: f.receivingMeter.region,
                        type: f.receivingMeter.stationType,
                        import: 0,
                        export: 0,
                        net: 0,
                        feederCount: 0,
                        feederNames: new Set(),
                    })
                }
                const entry = receivingMap.get(key)!
                entry.import += f.receivingMeter.importKwh
                entry.export += f.receivingMeter.exportKwh
                entry.net = entry.import - entry.export
                entry.feederNames.add(f.feederName)
            }
            const receivingStationBreakdown = Array.from(receivingMap.values())
                .map(({ feederNames, ...rest }) => ({ ...rest, feederCount: feederNames.size }))
                .sort((a, b) => b.import - a.import)

            return {
                totalImportKwh,
                totalExportKwh,
                netKwh: totalImportKwh - totalExportKwh,
                uniqueFeederCount: feederBreakdown.length,
                rawData: data,
                feederBreakdown,
                sendingStationBreakdown,
                receivingStationBreakdown,
            } as ExpressFeederAggregateResult
        },
        enabled: !!params.dateFrom && !!params.dateTo,
    })
}
