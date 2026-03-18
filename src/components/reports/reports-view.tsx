"use client"

import type React from "react"

import { useState } from "react"
import { useAppStore } from "@/stores/app-store"
import { formatApiDate } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, FileSpreadsheet, Loader2, Search, ArrowUp, ArrowDown, GripVertical } from "lucide-react"
import { useFeedersTrafoDaily } from "@/hooks/api/use-feeders-trafo-api"
import { useDtxDaily } from "@/hooks/api/use-dtx-api"
import { useRegionalBoundaryDaily } from "@/hooks/api/use-regional-boundary-api"
import { useDistrictBoundaryDaily } from "@/hooks/api/use-district-boundary-api"
import { useMeterStatusDetails } from "@/hooks/api/use-meter-status-api"
import { exportToCSV, exportToExcel } from "@/lib/export-utils"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

function flattenObject(obj: any, prefix = ""): Record<string, any> {
  const flattened: Record<string, any> = {}

  for (const key in obj) {
    if (obj[key] === null || obj[key] === undefined) {
      flattened[prefix + key] = ""
    } else if (typeof obj[key] === "object" && !Array.isArray(obj[key])) {
      // Recursively flatten nested objects
      Object.assign(flattened, flattenObject(obj[key], `${prefix}${key}.`))
    } else if (Array.isArray(obj[key])) {
      // Convert arrays to string representation
      flattened[prefix + key] = `[${obj[key].length} items]`
    } else {
      flattened[prefix + key] = obj[key]
    }
  }

  return flattened
}

export function ReportsView() {
  const filters = useAppStore((state) => state.filters)
  const [activeTab, setActiveTab] = useState("bsp")
  const [meterStatusPage, setMeterStatusPage] = useState(1)
  const [meterStatusLimit, setMeterStatusLimit] = useState(1000)

  // Build params from filters
  const params = {
    dateFrom: filters.dateRange?.start ? formatApiDate(filters.dateRange.start) : undefined,
    dateTo: filters.dateRange?.end ? formatApiDate(filters.dateRange.end) : undefined,
    regions: filters.regions,
    districts: filters.districts,
    stations: filters.stations,
    locations: filters.locations,
    boundaryMeteringPoints: filters.boundaryMeteringPoints,
    meterTypes: filters.meterTypes,
    voltages: filters.voltages,
  }

  // Fetch data for each report type
  const bspData = useFeedersTrafoDaily({ ...params, meterTypes: ["BSP"] })
  const dtxData = useDtxDaily({ ...params, meterTypes: ["DTX"] })
  const regionalBoundaryData = useRegionalBoundaryDaily({ ...params, meterTypes: ["REGIONAL_BOUNDARY"] })
  const districtBoundaryData = useDistrictBoundaryDaily({ ...params, meterTypes: ["DISTRICT_BOUNDARY"] })
  const meterStatusData = useMeterStatusDetails({
    ...params,
    page: meterStatusPage,
    limit: meterStatusLimit,
  })

  const handleExport = (data: any[] | undefined, filename: string, format: "csv" | "excel") => {
    if (!data || data.length === 0) {
      alert("No data available to export")
      return
    }

    const flattenedData = data.map((row) => flattenObject(row))

    if (format === "csv") {
      exportToCSV(flattenedData, filename)
    } else {
      exportToExcel(flattenedData, filename)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Data Reports & Export</h2>
        <p className="text-muted-foreground">View and export raw meter data for external analysis</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="bsp">BSP Supply</TabsTrigger>
          <TabsTrigger value="dtx">DTX Distribution</TabsTrigger>
          <TabsTrigger value="regional">Regional Boundary</TabsTrigger>
          <TabsTrigger value="district">District Boundary</TabsTrigger>
          <TabsTrigger value="status">Meter Status</TabsTrigger>
        </TabsList>

        <TabsContent value="bsp" className="space-y-4">
          <ReportCard
            title="BSP Supply Data"
            description="Bulk Supply Point meter readings and consumption data"
            data={bspData.data}
            isLoading={bspData.isLoading}
            onExport={(format) => handleExport(bspData.data, "bsp-supply-data", format)}
          />
        </TabsContent>

        <TabsContent value="dtx" className="space-y-4">
          <ReportCard
            title="DTX Distribution Data"
            description="Distribution Transformer meter readings and consumption data"
            data={dtxData.data}
            isLoading={dtxData.isLoading}
            onExport={(format) => handleExport(dtxData.data, "dtx-distribution-data", format)}
          />
        </TabsContent>

        <TabsContent value="regional" className="space-y-4">
          <ReportCard
            title="Regional Boundary Flow Data"
            description="Inter-regional energy transfer data at boundary points"
            data={regionalBoundaryData.data}
            isLoading={regionalBoundaryData.isLoading}
            onExport={(format) => handleExport(regionalBoundaryData.data, "regional-boundary-flows", format)}
          />
        </TabsContent>

        <TabsContent value="district" className="space-y-4">
          <ReportCard
            title="District Boundary Flow Data"
            description="District-level energy transfer data at boundary points"
            data={districtBoundaryData.data}
            isLoading={districtBoundaryData.isLoading}
            onExport={(format) => handleExport(districtBoundaryData.data, "district-boundary-flows", format)}
          />
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <ReportCard
            title="Meter Status & Health Data"
            description="Meter operational status and health metrics"
            data={meterStatusData.data?.data}
            isLoading={meterStatusData.isLoading}
            onExport={(format) => handleExport(meterStatusData.data?.data, "meter-status-data", format)}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface ReportCardProps {
  title: string
  description: string
  data: any[] | undefined
  isLoading: boolean
  onExport: (format: "csv" | "excel") => void
}

function ReportCard({ title, description, data, isLoading, onExport }: ReportCardProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [visibleColumns, setVisibleColumns] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [sortingEnabled, setSortingEnabled] = useState(true)
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)

  const recordCount = data?.length || 0

  const isMeterStatus = title.includes("Meter Status")

  const statusOptions =
    isMeterStatus && data
      ? ["all", ...Array.from(new Set(data.map((row: any) => row.status).filter(Boolean)))]
      : ["all"]

  const flattenedData = data?.map((row) => flattenObject(row))
  const filteredData = flattenedData?.filter((row) => {
    if (searchQuery) {
      const meterNumber = row.meter_number || row.meterNumber || ""
      if (!String(meterNumber).toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }
    }

    if (isMeterStatus && statusFilter !== "all") {
      const rowStatus = row.status || ""
      if (String(rowStatus).toLowerCase() !== statusFilter.toLowerCase()) {
        return false
      }
    }

    return true
  })

  const sortedData =
    sortColumn && sortingEnabled
      ? [...(filteredData || [])].sort((a, b) => {
          const aVal = a[sortColumn]
          const bVal = b[sortColumn]

          if (aVal === bVal) return 0
          if (aVal === null || aVal === undefined) return 1
          if (bVal === null || bVal === undefined) return -1

          const aNum = Number(aVal)
          const bNum = Number(bVal)

          if (!isNaN(aNum) && !isNaN(bNum)) {
            return sortDirection === "asc" ? aNum - bNum : bNum - aNum
          }

          const aStr = String(aVal).toLowerCase()
          const bStr = String(bVal).toLowerCase()

          if (sortDirection === "asc") {
            return aStr < bStr ? -1 : aStr > bStr ? 1 : 0
          } else {
            return aStr > bStr ? -1 : aStr < bStr ? 1 : 0
          }
        })
      : filteredData

  const allColumns = flattenedData && flattenedData.length > 0 ? Object.keys(flattenedData[0]) : []

  if (visibleColumns.length === 0 && allColumns.length > 0) {
    setVisibleColumns(allColumns.slice(0, 10))
  }

  const totalPages = Math.ceil((sortedData?.length || 0) / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedData = sortedData?.slice(startIndex, endIndex)

  const formatHeader = (header: string) => {
    return header
      .split(/[._]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  const formatCellValue = (value: any, columnName: string) => {
    if (value === null || value === undefined || value === "") return "-"

    // Date formatting
    if (
      typeof value === "string" &&
      (value.includes("T") || columnName.toLowerCase().includes("date")) &&
      !isNaN(Date.parse(value))
    ) {
      return new Date(value).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    }

    // Return raw values without locale formatting
    return String(value)
  }

  const toggleColumn = (column: string) => {
    if (visibleColumns.includes(column)) {
      setVisibleColumns(visibleColumns.filter((c) => c !== column))
    } else {
      setVisibleColumns([...visibleColumns, column])
    }
  }

  const toggleSort = (column: string) => {
    if (!sortingEnabled) return

    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  const handleDragStart = (column: string) => {
    setDraggedColumn(column)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (targetColumn: string) => {
    if (!draggedColumn || draggedColumn === targetColumn) {
      setDraggedColumn(null)
      return
    }

    const newOrder = [...visibleColumns]
    const draggedIndex = newOrder.indexOf(draggedColumn)
    const targetIndex = newOrder.indexOf(targetColumn)

    newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, draggedColumn)

    setVisibleColumns(newOrder)
    setDraggedColumn(null)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExport("csv")}
              disabled={isLoading || recordCount === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExport("excel")}
              disabled={isLoading || recordCount === 0}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Excel
            </Button>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {isLoading ? "Loading..." : `${recordCount.toLocaleString()} records`}
        </div>
      </CardHeader>
      <CardContent>
        {!isLoading && allColumns.length > 0 && (
          <div className="mb-4 space-y-3">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by meter number..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="pl-9"
                />
              </div>

              {isMeterStatus && (
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value)
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {statusOptions
                      .filter((s) => s !== "all")
                      .map((status) => (
                        <SelectItem key={status} value={status}>
                          {String(status).charAt(0).toUpperCase() + String(status).slice(1)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}

              <div className="flex items-center justify-between rounded-lg border px-4 bg-muted/30 min-w-[400px]">
                <div className="flex items-center gap-2">
                  <Switch id="sorting-toggle" checked={sortingEnabled} onCheckedChange={setSortingEnabled} />
                  <label htmlFor="sorting-toggle" className="text-sm font-medium cursor-pointer whitespace-nowrap">
                    Enable Column Sorting
                  </label>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {sortingEnabled ? "Click column headers to sort" : "Sorting disabled"}
                </span>
              </div>
            </div>
            <details className="rounded-lg border p-3">
              <summary className="cursor-pointer text-sm font-medium mb-3">
                Column Visibility & Order ({visibleColumns.length}/{allColumns.length})
              </summary>
              <p className="text-xs text-muted-foreground mb-3">Drag columns to reorder • Check/uncheck to show/hide</p>
              <div className="grid grid-cols-5 gap-2">
                {visibleColumns.map((col) => (
                  <div
                    key={col}
                    draggable
                    onDragStart={() => handleDragStart(col)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(col)}
                    className={`flex items-center space-x-2 text-sm cursor-move rounded-sm px-2 py-1.5 hover:bg-accent border-2 transition-colors ${
                      draggedColumn === col ? "border-primary bg-accent" : "border-transparent"
                    }`}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => toggleColumn(col)}
                      className="rounded border-gray-300 flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="truncate flex-1 text-xs">{formatHeader(col)}</span>
                  </div>
                ))}
              </div>
              {allColumns.filter((col) => !visibleColumns.includes(col)).length > 0 && (
                <>
                  <div className="pt-2 mt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Hidden Columns</p>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {allColumns
                      .filter((col) => !visibleColumns.includes(col))
                      .map((col) => (
                        <label
                          key={col}
                          className="flex items-center space-x-2 text-sm cursor-pointer rounded-sm px-2 py-1.5 hover:bg-accent opacity-60"
                        >
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={() => toggleColumn(col)}
                            className="rounded border-gray-300 flex-shrink-0"
                          />
                          <span className="truncate flex-1 text-xs">{formatHeader(col)}</span>
                        </label>
                      ))}
                  </div>
                </>
              )}
            </details>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : paginatedData && paginatedData.length > 0 ? (
          <>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    {visibleColumns.map((col) => (
                      <TableHead
                        key={col}
                        className={`whitespace-nowrap font-semibold ${sortingEnabled ? "cursor-pointer hover:bg-muted transition-colors" : ""}`}
                        onClick={() => toggleSort(col)}
                      >
                        <div className="flex items-center gap-2">
                          <span>{formatHeader(col)}</span>
                          {sortingEnabled && (
                            <div className="flex flex-col">
                              {sortColumn === col ? (
                                sortDirection === "asc" ? (
                                  <ArrowUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ArrowDown className="h-3.5 w-3.5" />
                                )
                              ) : (
                                <div className="h-3.5 w-3.5 opacity-30">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M12 5v14M19 12l-7 7-7-7" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((row, idx) => (
                    <TableRow key={idx}>
                      {visibleColumns.map((col) => (
                        <TableCell key={col} className="max-w-[250px] truncate">
                          {formatCellValue(row[col], col)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex items-center justify-between border-t pt-4">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  Showing {startIndex + 1}-{Math.min(endIndex, sortedData?.length || 0)} of{" "}
                  {(sortedData?.length || 0).toLocaleString()}
                  {searchQuery && ` (filtered from ${recordCount.toLocaleString()} total)`}
                </span>
                <div className="flex items-center gap-2">
                  <label htmlFor="pageSize">Rows per page:</label>
                  <select
                    id="pageSize"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="rounded border px-2 py-1"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={500}>500</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  Last
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            {searchQuery ? "No matching records found" : "No data available for the selected filters"}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
